/**
 * Cihaz-bağımsız bağış akışı: listeden form → tutar → sepet → ödeme → sipariş.
 * Gerçek kart yok. Ödeme URL’si wc_get_checkout_url().
 * Sipariş tamamlama yalnız yerel; uzakta checkout-view-only.
 */
import { SEL } from './selectors.mjs';
import { fillDonationForm, formOf, clickSubmit } from './dp-form.mjs';
import { withCacheBust } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  makeFailure,
  assertNoUnexpectedPluginErrors,
  cartItemCount,
  attachCheckoutFlowProbes,
  collectWooSessionCookieFlags,
  collectWdpAjaxCheckoutPathname,
  classifyCheckoutNavFailure,
  urlPathnameOnly,
  writeCheckoutFlowDebug,
  visibleValidationErrors,
} from './checks.mjs';
import { markOrderAsE2E } from './test-cleanup.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS, classifySkip, makeSkip } from './skip-policy.mjs';
import { getActiveProfile, isRemoteProfile, getActiveTimeouts } from './profile.mjs';
import { popupPagePath } from './catalog-core.mjs';
import { checkoutPathFromUrl } from './checkout-setup.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { textHasFormattedAmount, pickDonationFillAmount, mergeFillCurrency } from './currency.mjs';
import { withEnvMutationLock } from './mutation-lock.mjs';
import {
  DONOR_NAME,
  DONOR_EMAIL,
  DONOR_PHONE,
  DEDICATION,
  SHAREHOLDERS,
  completeLocalCheckout,
} from './place-order.mjs';
import {
  attachPostClickNetwork,
  attachSanitizedConsole,
  collectClickTarget,
  collectCtaReadyState,
  collectPluginRuntime,
  shotDebugPng,
} from './flow-diag.mjs';
import { attachNativeSubmitReloadGuard } from './native-submit-guard.mjs';

function checkMs() {
  return getActiveTimeouts().navigation;
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {{ kind: 'custom'|'shares'|'campaign', amount: number, fill?: string }} spec
 */
export async function fillDonationShell(shell, spec) {
  await fillDonationForm(shell, {
    kind: spec.kind,
    fill: spec.fill != null ? String(spec.fill) : String(spec.amount),
    holders: SHAREHOLDERS.slice(0, 2),
    donor: { name: DONOR_NAME, phone: DONOR_PHONE, email: DONOR_EMAIL, dedication: DEDICATION, anonymous: true },
  });
}

/**
 * Formdaki en düşük / önerilen tutar (sunucu çıktısı: `data-min`, ondalık/ayırıcılar form özniteliklerinde).
 * @param {import('@playwright/test').Locator} shell
 * @param {object} [currency]
 * @returns {Promise<{ amount: number, fill: string }>}
 */
export async function resolveDonationFillAmount(shell, currency) {
  const form = formOf(shell);
  await form.waitFor({ state: 'visible', timeout: checkMs() });
  const bounds = await form.evaluate((f) => {
    // Serbest tutar formunda (ör. Zekat) önerilen yoksa ilk hazır tutar geçerli bir tutardır.
    const rec =
      f.querySelector('button.donation-panel-amount[aria-checked="true"][data-dp-preset]') ||
      f.querySelector('button.donation-panel-amount[data-dp-preset]');
    const custom = f.querySelector('input.donation-panel-custom__in[name="amount"]');
    return {
      min: f.getAttribute('data-min') || '',
      max: '',
      recommended: (rec && rec.getAttribute('data-dp-preset')) || '',
      type: custom ? 'text' : '',
      step: '',
      pageCurrency: {
        decimals: Number(f.getAttribute('data-decimals')),
        thousandSeparator: f.getAttribute('data-thousand-sep') || '',
        decimalSeparator: f.getAttribute('data-decimal-sep') || '',
      },
    };
  });
  const fillCurrency = mergeFillCurrency(currency, bounds.pageCurrency);
  const picked = pickDonationFillAmount(bounds, fillCurrency);
  if (Number.isFinite(picked.amount) && picked.amount > 0) return picked;
  throw new Error(`form-tutar-okunamadi: min/önerilen yok min=${bounds.min || '-'} rec=${bounds.recommended || '-'}`);
}

function localStore(profile, amount) {
  const c = profile.currency || {};
  return {
    amount,
    currency: c.code || 'TRY',
    decimals: Number.isFinite(Number(c.decimals)) ? Number(c.decimals) : 0,
    thousandSeparator: c.thousandSeparator ?? '.',
    decimalSeparator: c.decimalSeparator ?? ',',
    symbolPosition: c.symbolPosition || 'left',
    symbol: c.symbol || '₺',
    country: 'TR',
    city: 'Istanbul',
    postcode: '34000',
    address: 'Test Cad. 1',
    state: 'TR34',
    stateLabel: 'Istanbul',
  };
}

/**
 * @param {object} args
 */
export async function runDonationFlowChecks({
  page,
  env,
  productUrls,
  productIds,
  listPagePath,
  failures,
  stats,
  skips,
  deviceId,
  checkoutUrl,
  offlineGateway,
  skipOrderReason,
}) {
  const profile = getActiveProfile();
  const customPath = productUrls.custom || productUrls.fixed;
  const customId = productIds.custom || productIds.fixed || 0;
  const listPath = popupPagePath(env, listPagePath);
  if (!customPath || !listPath) {
    const row = makeSkip({
      check: `checkout-flow-${deviceId}`,
      reason: !customPath ? SKIP_REASONS.NO_PRODUCT_PATH : SKIP_REASONS.NO_LIST_PAGE,
      evidence: SKIP_EVIDENCE.WP_DATA,
    });
    if (classifySkip(row) === 'fail') {
      failures.push(makeFailure({ check: row.check, description: `Altyapı atlaması hata: ${row.description}` }));
      stats.failed += 1;
      return;
    }
    skips.push(row);
    stats.skipped += 1;
    return;
  }

  const checkoutPath = checkoutPathFromUrl(checkoutUrl || '', env.E2E_BASE_URL);
  const remote = isRemoteProfile(profile);
  const viewOnly = remote;
  let filledAmount = 0;
  let filledText = '';

  /**
   * @param {{ kind: 'custom'|'shares'|'campaign', productId: number, productPath: string, productName: string, check: string }} job
   */
  const runOneJob = async (job) => {
    await Promise.race([
      emptyCart(page, env.E2E_BASE_URL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('emptyCart timeout')), 15000)),
    ]).catch((e) => {
      console.error(`[e2e:catch-fail] emptyCart: ${e && e.message ? e.message : e}`);
    });
    const extra = { ...comingSoonQuery(env, profile) };
    await page.goto(withCacheBust(env.E2E_BASE_URL, listPath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: checkMs(),
    });
    await revealListProductTrigger(page, job.productId);
    let trigger = shellTriggerLocator(page, 'popup', { productId: job.productId });
    if ((await trigger.count()) === 0) {
      trigger = page.locator(
        `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`
      );
    }
    await clickShellTrigger(trigger, checkMs());
    const shell = openShellLocator(page, '');
    await shell.waitFor({ state: 'visible', timeout: checkMs() });
    const reloadGuard = attachNativeSubmitReloadGuard(page);
    reloadGuard.clearHits();
    reloadGuard.arm();
    await assertNoUnexpectedPluginErrors(page, { scenarioId: `checkout-flow-${deviceId}` });

    if (job.kind === 'custom' || job.kind === 'campaign') {
      const picked = await resolveDonationFillAmount(shell, profile.currency);
      filledAmount = picked.amount;
      filledText = picked.fill;
    }
    await fillDonationShell(shell, { kind: job.kind, amount: filledAmount, fill: filledText });

    const checkoutHost = (() => {
      try {
        return new URL(checkoutUrl || checkoutPath, env.E2E_BASE_URL).pathname.replace(/\/$/, '');
      } catch {
        return checkoutPath.replace(/\/$/, '');
      }
    })();
    const expectedPath = urlPathnameOnly(checkoutUrl || checkoutPath, env.E2E_BASE_URL) || checkoutPath;
    const diag = {
      items_count_before_click: -1,
      items_count: -1,
      redirects: [],
      cookies: { wp_woocommerce_session: false, woocommerce_items_in_cart: false },
      add_to_cart: {},
      wdp_ajax_checkout_pathname: '',
      click_pathname: '',
      final_pathname: '',
      expected_checkout_pathname: expectedPath,
      navigated: false,
    };

    const probes = attachCheckoutFlowProbes(page);
    const postNet = attachPostClickNetwork(page);
    const cons = attachSanitizedConsole(page);
    try {
      diag.wdp_ajax_checkout_pathname = await collectWdpAjaxCheckoutPathname(page);
      diag.items_count_before_click = await cartItemCount(page, env.E2E_BASE_URL);
      diag.click_pathname = urlPathnameOnly(page.url());

      diag.cta_ready = await collectCtaReadyState(shell);
      diag.plugin = await collectPluginRuntime(page);
      const clickLoc = formOf(shell).locator(SEL.goCheckout).first();
      diag.click_target = await collectClickTarget(page, clickLoc);
      diag.png_before = await shotDebugPng(page, `checkout-flow-${deviceId}-before`);
      const tClick = Date.now();
      await clickSubmit(shell, checkMs());
      reloadGuard.assertClear(job.check);

      const addHit = await probes.waitForAddToCart(8000);
      if (addHit) diag.add_to_cart = addHit;
      if (!addHit) {
        const left = Math.max(0, 5000 - (Date.now() - tClick));
        if (left) await postNet.wait(left);
      }
      diag.network_after_click = postNet.hits.slice();
      diag.console_errors = cons.errors.slice();
      diag.png_after = await shotDebugPng(page, `checkout-flow-${deviceId}-after`);
      const valErrs = await visibleValidationErrors(page);
      diag.validation_errors = valErrs;
      diag.validation_message = String(valErrs[0] || '').slice(0, 80);
      if (!addHit && valErrs.length) {
        const cls = classifyCheckoutNavFailure(diag);
        writeCheckoutFlowDebug(deviceId, { ...diag, class: cls });
        throw new Error(
          `ödeme sayfasına gidilmedi [${cls}]: ${diag.validation_message}`
        );
      }

      diag.items_count = await cartItemCount(page, env.E2E_BASE_URL);

      if (!/checkout|odeme|ödeme/i.test(page.url())) {
        try {
          await page.waitForURL(/checkout|odeme|ödeme/i, { timeout: 4000 });
        } catch (waitErr) {
          console.error(
            `[e2e:catch-fail] checkout-wait: ${waitErr && waitErr.message ? waitErr.message : waitErr}`
          );
        }
      }
      if (!/checkout|odeme|ödeme/i.test(page.url())) {
        await page.goto(withCacheBust(env.E2E_BASE_URL, checkoutPath, extra), {
          waitUntil: 'domcontentloaded',
          timeout: checkMs(),
        }).catch(async (navErr) => {
          if (reloadGuard.hits.length) {
            throw reloadGuard.wrapError(job.check, navErr);
          }
          const msg = String(navErr && navErr.message);
          if (/interrupted/i.test(msg)) return;
          if (/ERR_ABORTED/i.test(msg)) {
            await page.goto(withCacheBust(env.E2E_BASE_URL, checkoutPath, extra), {
              waitUntil: 'domcontentloaded',
              timeout: checkMs(),
            });
            return;
          }
          throw navErr;
        });
      }

      try {
        await page.waitForURL(
          (u) => {
            const p = u.pathname.replace(/\/$/, '');
            return (
              p === checkoutHost ||
              /checkout|order-pay|order-received|odeme|ödeme/i.test(u.pathname + u.search)
            );
          },
          { timeout: checkMs() }
        );
      } catch (settleErr) {
        console.error(
          `[e2e:catch-fail] checkout-settle: ${settleErr && settleErr.message ? settleErr.message : settleErr}`
        );
      }

      const url = page.url();
      let onCheckout = false;
      try {
        const now = new URL(url);
        const dest = new URL(checkoutUrl || checkoutPath, env.E2E_BASE_URL);
        onCheckout =
          now.pathname.replace(/\/$/, '') === dest.pathname.replace(/\/$/, '') ||
          /checkout|order-pay|odeme|ödeme/i.test(now.pathname + now.search);
      } catch {
        onCheckout = /checkout|order-pay|odeme|ödeme/i.test(url);
      }

      diag.redirects = probes.redirects.slice();
      diag.final_pathname = urlPathnameOnly(url);
      diag.navigated =
        (!!diag.final_pathname &&
          !!diag.click_pathname &&
          diag.final_pathname.replace(/\/+$/, '') !== diag.click_pathname.replace(/\/+$/, '')) ||
        diag.redirects.length > 0;
      diag.cookies = await collectWooSessionCookieFlags(page);

      if (!onCheckout) {
        const cls = classifyCheckoutNavFailure(diag);
        writeCheckoutFlowDebug(deviceId, { ...diag, class: cls });
        throw new Error(
          `ödeme sayfasına gidilmedi [${cls}]: ${diag.final_pathname} (beklenen ${checkoutPath})`
        );
      }
      writeCheckoutFlowDebug(deviceId, { ...diag, class: 'ok' });
    } finally {
      try {
        reloadGuard.assertClear(job.check);
      } finally {
        reloadGuard.disarm();
      }
      probes.dispose();
      postNet.dispose();
      cons.dispose();
    }
    stats.passed += 1;

    if (viewOnly) {
      const nameEl = page.locator(
        '.product-name, .wc-block-components-product-name, td.product-name, .cart_item .product-name a'
      ).first();
      let nameText = '';
      if ((await nameEl.count()) > 0) {
        nameText = ((await nameEl.textContent()) || '').trim();
      }
      if (!nameText) {
        throw new Error('checkout-view-only: ödeme sayfasında ürün adı görünmüyor');
      }
      const bodyText = await page.locator('body').innerText();
      if (!textHasFormattedAmount(bodyText, filledAmount, profile.currency)) {
        throw new Error(
          'checkout-view-only: WooCommerce biçimli tutar ödeme sayfasında görünmüyor'
        );
      }
      const orderSkip = makeSkip({
        check: `checkout-flow-order-${deviceId}`,
        reason: SKIP_REASONS.NO_REMOTE_ORDERS,
        evidence: SKIP_EVIDENCE.POLICY,
        detail: skipOrderReason || url,
      });
      if (classifySkip(orderSkip) === 'fail') {
        throw new Error(`Altyapı atlaması hata: ${orderSkip.description}`);
      }
      skips.push(orderSkip);
      stats.skipped += 1;
      stats.passed += 1;
      return 'view-only';
    }

    if (!offlineGateway) {
      throw new Error('yerel sipariş: çevrimdışı ödeme yöntemi yok (cod/cheque/bacs)');
    }

    const store = localStore(profile, job.kind === 'shares' ? 50 : filledAmount);
    const expected =
      job.kind === 'shares'
        ? {
            shareholders: SHAREHOLDERS.slice(0, 2),
            currency: store.currency,
            productName: job.productName,
          }
        : {
            donorName: DONOR_NAME,
            donorEmail: DONOR_EMAIL,
            donorPhone: DONOR_PHONE,
            dedication: DEDICATION,
            amount: filledAmount,
            currency: store.currency,
            anonymous: true,
            productName: job.productName,
          };

    const { orderId } = await withEnvMutationLock(profile.id || 'local', async () =>
      completeLocalCheckout(page, {
        store,
        gatewayId: offlineGateway.id,
        donor: { name: DONOR_NAME, email: DONOR_EMAIL, phone: DONOR_PHONE },
        expected,
      })
    );
    if (orderId) {
      await markOrderAsE2E(orderId);
    }
    stats.passed += 1;
    return 'ordered';
  };

  /** @type {Array<{ kind: 'custom'|'shares'|'campaign', productId: number, productPath: string, productName: string, check: string }>} */
  const jobs = [
    {
      kind: 'custom',
      productId: customId,
      productPath: customPath,
      productName: 'WDP E2E Custom',
      check: `checkout-flow-${deviceId}`,
    },
  ];
  // Hisseli + kampanya siparişi yalnız iphone: sunucu meta cihazdan bağımsız;
  // üç cihazda tekrarı e2e:full süresini şişirir (hedef ≤10 dk).
  if (deviceId === 'iphone' && !remote) {
    if (productIds.shares && productUrls.shares) {
      jobs.push({
        kind: 'shares',
        productId: productIds.shares,
        productPath: productUrls.shares,
        productName: 'WDP E2E Shares',
        check: `checkout-flow-shares-${deviceId}`,
      });
    } else {
      failures.push(
        makeFailure({
          check: `checkout-flow-shares-${deviceId}`,
          description: 'Yerel hisseli sipariş: shares ürünü yok',
        })
      );
      stats.failed += 1;
    }
    if (productIds.campaign && productUrls.campaign) {
      jobs.push({
        kind: 'campaign',
        productId: productIds.campaign,
        productPath: productUrls.campaign,
        productName: 'WDP E2E Campaign',
        check: `checkout-flow-campaign-${deviceId}`,
      });
    } else {
      failures.push(
        makeFailure({
          check: `checkout-flow-campaign-${deviceId}`,
          description: 'Yerel kampanya siparişi: campaign ürünü yok',
        })
      );
      stats.failed += 1;
    }
  }

  page.setDefaultTimeout(checkMs());
  page.setDefaultNavigationTimeout(checkMs());
  for (const job of jobs) {
    const tJob = Date.now();
    try {
      await runOneJob(job);
      console.log(
        `[e2e] ${job.check}: ${((Date.now() - tJob) / 1000).toFixed(1)}s`
      );
    } catch (e) {
      failures.push(
        makeFailure({
          check: job.check,
          description:
            job.kind === 'shares'
              ? 'Hisseli bağış akışı (liste→form→ödeme→sipariş) başarısız'
              : job.kind === 'campaign'
                ? 'Kampanya bağış akışı (liste→form→ödeme→sipariş) başarısız'
                : 'Bağış akışı (liste→form→sepet→ödeme) başarısız',
          error: e,
        })
      );
      stats.failed += 1;
    } finally {
      await Promise.race([
        emptyCart(page, env.E2E_BASE_URL),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]).catch((e) => {
        console.error(`[e2e:catch-fail] emptyCart-finally: ${e && e.message ? e.message : e}`);
      });
    }
  }
}
