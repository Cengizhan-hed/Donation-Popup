/**
 * 12.4 Stripe (TEST modu) — compact kart YALNIZ sepetli ödeme sayfasına yönlendirir, YALNIZ yerel WP:
 * `npm run e2e:queue -- node tests/e2e/run-stripe.mjs --spec specs/stripe-compact.spec [--project desktop]`.
 * Compact kartın ödeme adımı/iframe'i yoktur: doğrudan bağış açık olsa da kart bağışı sepete ekler ve WooCommerce ödeme
 * sayfasına götürür (order-pay çerçevesi, doğrudan sipariş yok). Stripe iframe/3D Secure sınamaları doğrudan akışlar için
 * `stripe-payments.spec` içindedir. Eklentimizde Stripe'a özel kod yok.
 */
import { test, expect } from '@playwright/test';
import { applyLocalThirdPartyAllowlist } from '../helpers/network-guard.mjs';
import { assertLocal, record, state } from '../helpers/stripe-flow.mjs';

const READY = process.env.WDP_STRIPE_READY === '1';
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CARD = '[data-dp-compact]';

test.skip(!READY, 'Stripe test anahtarı yok ya da koşu run-stripe.mjs dışında: spec atlandı.');

const step = (page, name) => page.locator(CARD).first().locator(`[data-dp-cstep="${name}"]`);

test.describe('Stripe — compact kart yalnız sepetli ödeme sayfasına yönlendirir (yerel)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assertLocal(baseURL);
    await applyLocalThirdPartyAllowlist(page.context(), { siteHost: new URL(String(baseURL)).hostname });
  });

  test('doğrudan bağış açıkken de: sepete ekler, Woo ödeme sayfasına gider; ödeme adımı/çerçeve ve doğrudan sipariş yok', async ({ page, request, baseURL }, info) => {
    test.setTimeout(180000);
    const before = await state(request, PRODUCT);
    await page.context().addCookies([{ name: 'dp_direct', value: '1', url: String(baseURL) }]);
    await page.goto(`/?dp_stripe=compact&dp_product=${PRODUCT}`);
    await expect(page.locator(`${CARD}[data-dp-ready="1"]`).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator(`${CARD} [data-dp-cstep="pay"], ${CARD} iframe`)).toHaveCount(0);
    await step(page, 'amount').locator('[data-dp-camount-in]').fill('210');
    await step(page, 'amount').locator('[data-dp-cnext]').click();
    const details = step(page, 'details');
    await expect(details).toHaveClass(/is-on/);
    await expect(details.locator('input[name="donation_email"]'), 'kartta e-posta alanı yok').toHaveCount(0);
    await details.locator('input[name="donation_full_name"]').fill('Çağlar Şükrü Öztürk İğdır');
    await details.locator('input[name="donation_phone"]').fill('+44 7700 900123');
    await details.locator('button[type="submit"]').click();
    await page.waitForURL(/checkout|odeme|ödeme/i, { timeout: 30000 });
    expect(page.url()).not.toMatch(/order-pay/);
    const after = await state(request, PRODUCT, before.now);
    expect(after.orders.filter((o) => o.via === 'donation_panel_direct'), 'doğrudan sipariş oluşmaz').toHaveLength(0);
    record({ scenario: 'compact-sepetli-yonlendirme', flow: 'cart-compact', project: info.project.name, orders: after.orders.length });
  });
});
