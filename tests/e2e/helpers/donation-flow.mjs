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
} from './checks.mjs';
import { markOrderAsE2E } from './test-cleanup.mjs';
import { getActiveProfile, isRemoteProfile } from './profile.mjs';
import { popupPagePath } from './catalog-core.mjs';
import { checkoutPathFromUrl } from './checkout-setup.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { textHasFormattedAmount } from './currency.mjs';
import { withEnvMutationLock } from './mutation-lock.mjs';
import {
  DONOR_NAME,
  DONOR_EMAIL,
  DONOR_PHONE,
  DEDICATION,
  SHAREHOLDER_NAME,
  SHAREHOLDER_PHONE,
  completeLocalCheckout,
} from './place-order.mjs';

const CHECK_MS = 25000;

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {{ kind: 'custom'|'shares', amount: number }} spec
 */
async function fillDonationShell(shell, spec) {
  if (spec.kind === 'shares') {
    const shName = shell.locator('input[name="shareholder_name_1"]').first();
    if ((await shName.count()) > 0 && !(await shName.isVisible())) {
      const header = shell.locator('.wdp-shareholder-header').first();
      if ((await header.count()) > 0) await header.click({ timeout: CHECK_MS });
    }
    await shName.waitFor({ state: 'visible', timeout: CHECK_MS });
    await shName.fill(SHAREHOLDER_NAME);
    const shPhone = shell.locator('input[name="shareholder_phone_1"]').first();
    if ((await shPhone.count()) > 0) await shPhone.fill(SHAREHOLDER_PHONE);
    return;
  }
  const amount = shell.locator(SEL.customPrice).first();
  if (await amount.count()) {
    await amount.fill(String(spec.amount));
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
    skips.push({
      check: `checkout-flow-${deviceId}`,
      description: 'Ürün/liste/mağaza yolu yok, akış atlandı',
    });
    stats.skipped += 1;
    return;
  }

  const checkoutPath = checkoutPathFromUrl(checkoutUrl || '', env.E2E_BASE_URL);
  const remote = isRemoteProfile(profile);
  const viewOnly = remote;
  let filledAmount = profile.products?.custom?.min || 10;

  /**
   * @param {{ kind: 'custom'|'shares', productId: number, productPath: string, productName: string }} job
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

    if (job.kind === 'custom') {
      const min = profile.products?.custom?.min || 10;
      filledAmount = min;
    }
    await fillDonationShell(shell, { kind: job.kind, amount: filledAmount });

    const add = shell.locator(SEL.addToCart).first();
    const go = shell.locator(SEL.goCheckout).first();
    if ((await go.count()) > 0) {
      await go.click({ timeout: CHECK_MS, noWaitAfter: true });
    } else {
      await clickAddToCartWithRetry(page, add, { timeout: CHECK_MS });
    }
    if (!/checkout|odeme|ödeme/i.test(page.url())) {
      try {
        await page.waitForURL(/checkout|odeme|ödeme/i, { timeout: 4000 });
      } catch {
        /* ödeme URL’sine gitmediyse aşağıda goto */
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

    const checkoutHost = (() => {
      try {
        return new URL(checkoutUrl || checkoutPath, env.E2E_BASE_URL).pathname.replace(/\/$/, '');
      } catch {
        return checkoutPath.replace(/\/$/, '');
      }
    })();
    await page
      .waitForURL(
        (u) => {
          const p = u.pathname.replace(/\/$/, '');
          return (
            p === checkoutHost ||
            /checkout|order-pay|order-received|odeme|ödeme/i.test(u.pathname + u.search)
          );
        },
        { timeout: CHECK_MS }
      )
      .catch(() => {});
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
    if (!onCheckout) {
      let pathNow = url;
      try {
        pathNow = new URL(url).pathname;
      } catch {
        pathNow = url;
      }
      throw new Error(`ödeme sayfasına gidilmedi: ${pathNow} (beklenen ${checkoutPath})`);
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
      skips.push({
        check: `checkout-flow-order-${deviceId}`,
        description:
          skipOrderReason ||
          'Sipariş tamamlama atlandı (checkout-view-only; uzakta sipariş yok)',
        detail: url,
      });
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
            shareholderName: SHAREHOLDER_NAME,
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

  try {
    page.setDefaultTimeout(CHECK_MS);
    page.setDefaultNavigationTimeout(CHECK_MS);
    await runOneJob({
      kind: 'custom',
      productId: customId,
      productPath: customPath,
      productName: 'WDP E2E Custom',
    });
  } catch (e) {
    failures.push(
      makeFailure({
        check: `checkout-flow-${deviceId}`,
        description: 'Bağış akışı (liste→form→sepet→ödeme) başarısız',
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
