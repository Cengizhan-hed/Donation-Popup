/**
 * Cihaz-bağımsız bağış akışı: listeden form → tutar → sepet → ödeme → sipariş.
 * Gerçek kart yok. Ödeme URL’si wc_get_checkout_url().
 * Sipariş tamamlama yalnız yerel; uzakta checkout-view-only.
 */
import { SEL } from './selectors.mjs';
import { withCacheBust } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  clickAddToCartWithRetry,
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
import { getActiveProfile, isRemoteProfile } from './profile.mjs';
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

const CHECK_MS = 25000;

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {number} index 1-based
 */
async function revealShareholderRow(shell, index) {
  const shName = shell.locator(`input[name="shareholder_name_${index}"]`).first();
  if ((await shName.count()) === 0) return shName;
  if (await shName.isVisible()) return shName;
  const header = shell.locator('.wdp-shareholder-header').nth(index - 1);
  if ((await header.count()) > 0) await header.click({ timeout: CHECK_MS });
  return shName;
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {{ kind: 'custom'|'shares'|'campaign', amount: number, fill?: string }} spec
 */
async function fillDonationShell(shell, spec) {
  if (spec.kind === 'shares') {
    const people = SHAREHOLDERS.slice(0, 2);
    const increase = shell.locator('.wdp-share-btn-increase').first();
    await increase.waitFor({ state: 'visible', timeout: CHECK_MS });
    const name1 = await revealShareholderRow(shell, 1);
    await name1.waitFor({ state: 'visible', timeout: CHECK_MS });
    if (people.length >= 2) {
      await increase.click({ timeout: CHECK_MS });
      await shell.locator('input[name="shareholder_name_2"]').first().waitFor({
        state: 'attached',
        timeout: CHECK_MS,
      });
    }
    for (let i = 0; i < people.length; i += 1) {
      const idx = i + 1;
      const shName = await revealShareholderRow(shell, idx);
      await shName.waitFor({ state: 'visible', timeout: CHECK_MS });
      await shName.fill(people[i].name);
      const shPhone = shell.locator(`input[name="shareholder_phone_${idx}"]`).first();
      if ((await shPhone.count()) > 0) await shPhone.fill(people[i].phone);
    }
    return;
  }
  const amount = shell.locator(SEL.customPrice).first();
  if (await amount.count()) {
    await amount.fill(spec.fill != null ? String(spec.fill) : String(spec.amount));
  }
  const name = shell.locator(SEL.donorName).first();
  if (await name.count()) await name.fill(DONOR_NAME);
  const phoneLoc = shell.locator(SEL.donorPhone).first();
  if (await phoneLoc.count()) await phoneLoc.fill(DONOR_PHONE);
  const emailLoc = shell.locator('input[name="donation_email"], input[type="email"]').first();
  if ((await emailLoc.count()) > 0 && (await emailLoc.isVisible())) {
    await emailLoc.fill(DONOR_EMAIL);
  }
  const ded = shell.locator('input[name="donation_dedication"]').first();
  if ((await ded.count()) > 0) await ded.fill(DEDICATION);
  const anon = shell.locator('input[name="donation_anonymous"]').first();
  if ((await anon.count()) > 0) await anon.check();
}

/**
 * Formdaki min / önerilen (eklenti çıktısı). product_info min yazana kadar bekler.
 * @param {import('@playwright/test').Locator} shell
 * @param {object} [currency]
 * @returns {Promise<{ amount: number, fill: string }>}
 */
async function resolveDonationFillAmount(shell, currency) {
  const input = shell.locator(SEL.customPrice).first();
  if ((await input.count()) === 0) {
    throw new Error('form-tutar-okunamadi: custom_price yok');
  }
  await input.waitFor({ state: 'visible', timeout: CHECK_MS });
  const t0 = Date.now();
  let bounds = { min: '', recommended: '', max: '' };
  while (Date.now() - t0 < 8000) {
    const pageState = await shell.evaluate((root) => {
      const inp = root.querySelector('input[name="custom_price"]');
      const rec = root.querySelector(
        '.wdp-amount-preset.is-popular, .wdp-amount-preset[data-recommended="1"]'
      );
      const cur = (window.wdp_ajax && window.wdp_ajax.currency) || {};
      return {
        min:
          (inp &&
            (inp.getAttribute('min') ||
              inp.getAttribute('data-min') ||
              inp.dataset.baseMin ||
              inp.dataset.wdpMin ||
              '')) ||
          '',
        max: (inp && (inp.getAttribute('max') || inp.getAttribute('data-max') || '')) || '',
        recommended: (rec && (rec.getAttribute('data-amount') || '')) || '',
        placeholder: (inp && String(inp.placeholder || '').trim()) || '',
        type: (inp && String(inp.type || inp.getAttribute('type') || '').toLowerCase()) || '',
        step: (inp && inp.getAttribute('step')) || '',
        pageCurrency: {
          decimals: cur.decimals,
          thousandSeparator: cur.thousandSeparator,
          decimalSeparator: cur.decimalSeparator,
        },
      };
    });
    bounds = pageState;
    const fillCurrency = mergeFillCurrency(currency, pageState.pageCurrency);
    const picked = pickDonationFillAmount(bounds, fillCurrency);
    const infoReady = /^min:\s/i.test(bounds.placeholder || '') || !!bounds.recommended;
    if (infoReady && Number.isFinite(picked.amount) && picked.amount > 0) return picked;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `form-tutar-okunamadi: min/önerilen yok min=${bounds.min || '-'} rec=${bounds.recommended || '-'}`
  );
}

/**
 * Yerel kanıt: handler yokken erken CTA — sessiz yutma olmamalı (kuyruk → add_to_cart).
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} shell
 * @param {Record<string,string>} env
 */
async function proveEarlyCtaTap(page, shell, env) {
  const delayMs = 2000;
  const delayProductInfo = async (route) => {
    const req = route.request();
    const post = req.postData() || '';
    if (/wdp_get_product_info/.test(post)) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    await route.continue();
  };
  await page.route(/admin-ajax\.php/i, delayProductInfo);

  await shell.evaluate(() => {
    const form =
      document.querySelector('.wdp-modal.show form') ||
      document.querySelector('.wdp-donation-form form') ||
      document.querySelector('form.wdp-donation-form');
    if (!form) return;
    if (form._wdpSubmitHandler) {
      form.removeEventListener('submit', form._wdpSubmitHandler, true);
      form.removeEventListener('submit', form._wdpSubmitHandler, false);
      form._wdpSubmitHandler = null;
    }
    if (form.dataset) form.dataset.wdpFormReady = '0';
    form.querySelectorAll(
      'button[name="donation_go_checkout"], button[name="donation_add_to_cart"]'
    ).forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute('data-wdp-await-js', '1');
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('wdp-cta-await-js', 'wdp-loading');
      const gate = btn.closest('.wdp-cta-gate');
      if (gate) gate.classList.remove('is-ready');
    });
  });

  const ctaState = await collectCtaReadyState(shell);
  const probes = attachCheckoutFlowProbes(page);
  try {
    const dispatched = await shell.evaluate(() => {
      const form =
        document.querySelector('.wdp-modal.show form') ||
        document.querySelector('.wdp-donation-form form') ||
        document.querySelector('form.wdp-donation-form');
      const hit = form && form.querySelector('.wdp-cta-gate__hit');
      const go = form && form.querySelector('button[name="donation_go_checkout"]');
      const target = hit || go;
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    });
    if (!dispatched) {
      const go = shell.locator(SEL.goCheckout).first();
      await go.click({ timeout: CHECK_MS, force: true, noWaitAfter: true });
    }
    const addHit = await probes.waitForAddToCart(12000);
    if (!addHit) {
      const errs = await visibleValidationErrors(page);
      writeCheckoutFlowDebug('early-cta', { ...ctaState, class: 'early-tap-silent', errors: errs });
      throw new Error(
        `erken-dokunuş sessiz yutma: add_to_cart yok form_ready=${ctaState.form_ready} await=${ctaState.await_js} err=${JSON.stringify(errs)}`
      );
    }
    writeCheckoutFlowDebug('early-cta', { ...ctaState, class: 'ok', add_to_cart: addHit });
  } finally {
    probes.dispose();
    await page.unroute(/admin-ajax\.php/i, delayProductInfo).catch((e) => {
      console.error(`[e2e:catch-fail] early-cta unroute: ${e && e.message ? e.message : e}`);
    });
  }
  void env;
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
    const extra = { hdf_no_side_cart: '1', ...comingSoonQuery(env, profile) };
    await page.goto(withCacheBust(env.E2E_BASE_URL, listPath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: CHECK_MS,
    });
    await revealListProductTrigger(page, job.productId);
    let trigger = shellTriggerLocator(page, 'popup', { productId: job.productId });
    if ((await trigger.count()) === 0) {
      trigger = page.locator(
        `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`
      );
    }
    await clickShellTrigger(trigger, CHECK_MS);
    const shell = openShellLocator(page, '');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
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
      const add = shell.locator(SEL.addToCart).first();
      const go = shell.locator(SEL.goCheckout).first();
      const gate = shell.locator('.wdp-cta-gate__hit').first();
      const clickLoc = (await go.count()) > 0 ? go : (await gate.count()) > 0 ? gate : add;
      diag.click_target = await collectClickTarget(page, clickLoc);
      diag.png_before = await shotDebugPng(page, `checkout-flow-${deviceId}-before`);
      const tClick = Date.now();
      if ((await go.count()) > 0) {
        try {
          await go.click({ timeout: CHECK_MS, noWaitAfter: true });
        } catch (clickErr) {
          const msg = String(clickErr && clickErr.message ? clickErr.message : clickErr);
          if (/intercepts pointer events|not stable/i.test(msg) && (await gate.count()) > 0) {
            await gate.click({ timeout: CHECK_MS, force: true, noWaitAfter: true });
          } else if (/intercepts pointer events|not stable/i.test(msg)) {
            await go.click({ timeout: CHECK_MS, force: true, noWaitAfter: true });
          } else {
            throw clickErr;
          }
        }
      } else if ((await gate.count()) > 0) {
        await gate.click({ timeout: CHECK_MS, force: true, noWaitAfter: true });
      } else {
        await clickAddToCartWithRetry(page, add, { timeout: CHECK_MS });
      }

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
          timeout: 20000,
        }).catch(async (navErr) => {
          const msg = String(navErr && navErr.message);
          if (/interrupted/i.test(msg)) return;
          if (/ERR_ABORTED/i.test(msg)) {
            await page.goto(withCacheBust(env.E2E_BASE_URL, checkoutPath, extra), {
              waitUntil: 'domcontentloaded',
              timeout: 20000,
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
          { timeout: CHECK_MS }
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

  page.setDefaultTimeout(CHECK_MS);
  page.setDefaultNavigationTimeout(CHECK_MS);
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

  if (!remote && deviceId === 'iphone' && customId && listPath) {
    const check = `checkout-flow-early-cta-${deviceId}`;
    const tJob = Date.now();
    try {
      await Promise.race([
        emptyCart(page, env.E2E_BASE_URL),
        new Promise((_, rej) => setTimeout(() => rej(new Error('emptyCart timeout')), 15000)),
      ]).catch((e) => {
        console.error(`[e2e:catch-fail] emptyCart-early-cta: ${e && e.message ? e.message : e}`);
      });
      const extra = { hdf_no_side_cart: '1', ...comingSoonQuery(env, profile) };
      await page.goto(withCacheBust(env.E2E_BASE_URL, listPath, extra), {
        waitUntil: 'domcontentloaded',
        timeout: CHECK_MS,
      });
      await revealListProductTrigger(page, customId);
      let trigger = shellTriggerLocator(page, 'popup', { productId: customId });
      if ((await trigger.count()) === 0) {
        trigger = page.locator(
          `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`
        );
      }
      await clickShellTrigger(trigger, CHECK_MS);
      const shell = openShellLocator(page, '');
      await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
      const pickedEarly = await resolveDonationFillAmount(shell, profile.currency);
      filledAmount = pickedEarly.amount;
      filledText = pickedEarly.fill;
      await fillDonationShell(shell, { kind: 'custom', amount: filledAmount, fill: filledText });
      await proveEarlyCtaTap(page, shell, env);
      stats.passed += 1;
      console.log(`[e2e] ${check}: ${((Date.now() - tJob) / 1000).toFixed(1)}s`);
    } catch (e) {
      failures.push(
        makeFailure({
          check,
          description: 'Erken CTA dokunuşu sessiz yutulmamalı (kuyruk veya görünür hata)',
          error: e,
        })
      );
      stats.failed += 1;
    } finally {
      await Promise.race([
        emptyCart(page, env.E2E_BASE_URL),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]).catch((e) => {
        console.error(`[e2e:catch-fail] emptyCart-early-cta-finally: ${e && e.message ? e.message : e}`);
      });
    }
  }
}
