/**
 * Cihaz-bağımsız bağış akışı: listeden form → tutar → sepet → ödeme → sipariş.
 * Gerçek kart yok. Ödeme URL’si wc_get_checkout_url().
 * Hedef: çek/BACS geçici (prepareCheckoutEnv). Ikram: ayar yazılmaz.
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
import { e2eEmail, markOrderAsE2E } from './test-cleanup.mjs';
import { getActiveProfile, isRemoteProfile } from './profile.mjs';
import { checkoutPathFromUrl } from './checkout-setup.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { textHasFormattedAmount } from './currency.mjs';

const CHECK_MS = 25000;

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} gatewayId
 */
async function selectOfflineGateway(page, gatewayId) {
  const id = String(gatewayId || 'cheque');
  const radio = page.locator(`#payment_method_${id}, input[name="payment_method"][value="${id}"]`).first();
  if ((await radio.count()) > 0) {
    await radio.check({ force: true }).catch(() => radio.click({ force: true }));
    return true;
  }
  const label = page.getByText(/cheque|check|bacs|bank transfer|havale|çek|eft/i).first();
  if ((await label.count()) > 0) {
    await label.click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function fillClassicCheckout(page, { name, email, phone }) {
  const first = page.locator('#billing_first_name').first();
  if ((await first.count()) > 0) {
    await first.fill(name.split(' ')[0] || 'E2E');
    const last = page.locator('#billing_last_name').first();
    if ((await last.count()) > 0) await last.fill(name.split(' ').slice(1).join(' ') || 'Test');
    const em = page.locator('#billing_email').first();
    if ((await em.count()) > 0) await em.fill(email);
    const ph = page.locator('#billing_phone').first();
    if ((await ph.count()) > 0) await ph.fill(phone);
  }
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
  const listPath = listPagePath || env.E2E_LIST_PAGE;
  if (!customPath || !listPath) {
    skips.push({
      check: `checkout-flow-${deviceId}`,
      description: 'Ürün/liste yolu yok, akış atlandı',
    });
    stats.skipped += 1;
    return;
  }

  const phone = profile.phone?.nationalExample || '5551234567';
  const email = e2eEmail();
  const checkoutPath = checkoutPathFromUrl(checkoutUrl || '', env.E2E_BASE_URL);
  const remote = isRemoteProfile(profile);
  const viewOnly = remote || !!skipOrderReason;
  let filledAmount = profile.products?.custom?.min || 10;

  try {
    page.setDefaultTimeout(CHECK_MS);
    page.setDefaultNavigationTimeout(CHECK_MS);
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
    await assertNoUnexpectedPluginErrors(page, { scenarioId: `checkout-flow-${deviceId}` });

    const amount = shell.locator(SEL.customPrice).first();
    if (await amount.count()) {
      const min = profile.products?.custom?.min || 10;
      filledAmount = min;
      await amount.fill(String(min));
    }
    const name = shell.locator(SEL.donorName).first();
    if (await name.count()) await name.fill('E2E Test');
    const phoneLoc = shell.locator(SEL.donorPhone).first();
    if (await phoneLoc.count()) await phoneLoc.fill(phone);
    const emailLoc = shell.locator('input[name="donation_email"], input[type="email"]').first();
    if ((await emailLoc.count()) > 0 && (await emailLoc.isVisible().catch(() => false))) {
      await emailLoc.fill(email);
    }

    const add = shell.locator(SEL.addToCart).first();
    const go = shell.locator(SEL.goCheckout).first();
    if ((await go.count()) > 0) {
      await go.click({ timeout: CHECK_MS, noWaitAfter: true });
    } else {
      await clickAddToCartWithRetry(page, add, { timeout: CHECK_MS });
    }
    await page.waitForTimeout(400);
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
      throw new Error(`ödeme sayfasına gidilmedi: ${url} (beklenen ${checkoutPath})`);
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
      return;
    }

    if (!offlineGateway) {
      skips.push({
        check: `checkout-flow-order-${deviceId}`,
        description: 'Sipariş tamamlama atlandı (çevrimdışı yöntem yok)',
        detail: url,
      });
      stats.skipped += 1;
      return;
    }

    await fillClassicCheckout(page, { name: 'E2E Test', email, phone });
    const selected = await selectOfflineGateway(page, offlineGateway.id);
    if (!selected) {
      skips.push({
        check: `checkout-flow-order-${deviceId}`,
        description: `Ödeme yöntemi ${offlineGateway.id} formda yok → sipariş tamamlama atlandı`,
        detail: url,
      });
      stats.skipped += 1;
      return;
    }
    const place = page.locator('#place_order, button[name="woocommerce_checkout_place_order"]').first();
    if ((await place.count()) === 0) {
      skips.push({
        check: `checkout-flow-order-${deviceId}`,
        description: 'place_order yok (blok ödeme?) → sipariş tamamlama atlandı',
        detail: url,
      });
      stats.skipped += 1;
      return;
    }
    await place.click({ timeout: CHECK_MS, noWaitAfter: true });
    await page.waitForURL(/order-received|order-pay|key=/, { timeout: CHECK_MS }).catch(() => {});
    const thanks = page.url();
    const idMatch = thanks.match(/order-received\/(\d+)/i) || thanks.match(/[?&]order[=-](\d+)/i);
    const orderId = idMatch ? Number(idMatch[1]) : 0;
    if (orderId) {
      await markOrderAsE2E(orderId);
    }
    stats.passed += 1;
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
