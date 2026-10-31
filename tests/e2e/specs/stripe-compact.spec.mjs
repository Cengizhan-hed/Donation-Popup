/**
 * 12.4 Stripe (TEST modu) — compact kartın çerçeveli (iframe) ödeme adımı, YALNIZ yerel WP:
 * `npm run e2e:queue -- node tests/e2e/run-stripe.mjs --spec specs/stripe-compact.spec [--project desktop]`.
 * Doğrudan bağış: order-pay aynı kökenli çerçevede (`donation_panel_embed=1`); Stripe Payment Element ve 3D Secure
 * sınaması çerçevenin içinde. Kapatma = yarıda bırakma. Eklentimizde Stripe'a özel kod yok.
 */
import { test, expect } from '@playwright/test';
import { applyLocalThirdPartyAllowlist } from '../helpers/network-guard.mjs';
import { CARDS, answer3ds, expectRaised, assertLocal, hookCounts, record, state, typeCard } from '../helpers/stripe-flow.mjs';

const READY = process.env.WDP_STRIPE_READY === '1';
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const PAID = ['processing', 'completed'];
const CARD = '[data-dp-compact]';

test.skip(!READY, 'Stripe test anahtarı yok ya da koşu run-stripe.mjs dışında: spec atlandı.');

const step = (page, name) => page.locator(CARD).first().locator(`[data-dp-cstep="${name}"]`);

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseURL
 * @param {string} amount
 * @param {string} email
 */
async function toPayStep(page, baseURL, amount, email) {
  await page.context().addCookies([{ name: 'dp_direct', value: '1', url: baseURL }]);
  await page.goto(`/?dp_stripe=compact&dp_product=${PRODUCT}`);
  await expect(page.locator(`${CARD}[data-dp-ready="1"]`).first()).toBeVisible({ timeout: 20000 });
  await step(page, 'amount').locator('[data-dp-camount-in]').fill(amount);
  await step(page, 'amount').locator('[data-dp-cnext]').click();
  const details = step(page, 'details');
  await expect(details).toHaveClass(/is-on/);
  await details.locator('input[name="donation_full_name"]').fill('Çağlar Şükrü Öztürk İğdır');
  await expect(details.locator('input[name="donation_email"]'), 'doğrudan akışta e-posta zorunlu').toHaveAttribute('required', '');
  await details.locator('input[name="donation_email"]').fill(email);
  await details.locator('input[name="donation_phone"]').fill('+44 7700 900123');
  await details.locator('button[type="submit"]').click();
  await expect(step(page, 'pay')).toHaveClass(/is-on/);
}

/**
 * Katmanı açar, çerçevedeki order-pay sayfasını döndürür.
 * @param {import('@playwright/test').Page} page
 */
async function openLayer(page) {
  await step(page, 'pay').locator('[data-dp-cpay]').click();
  await expect(page.locator('dialog[data-dp-overlay]')).toBeVisible({ timeout: 15000 });
  let embed = null;
  await expect
    .poll(async () => {
      embed = page.frames().find((f) => f.url().includes('donation_panel_embed')) || null;
      return embed ? await embed.locator('#place_order').count() : 0;
    }, { timeout: 30000, message: 'çerçevede order-pay' })
    .toBeGreaterThan(0);
  return /** @type {import('@playwright/test').Frame} */ (embed);
}

/** @param {import('@playwright/test').Frame} embed */
async function pay(embed) {
  const btn = embed.locator('#place_order');
  await btn.scrollIntoViewIfNeeded();
  await embed.page().waitForTimeout(400);
  await btn.click({ noWaitAfter: true });
}

test.describe('Stripe — compact kart çerçeveli ödeme (yerel)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    assertLocal(baseURL);
    await applyLocalThirdPartyAllowlist(page.context(), { siteHost: new URL(String(baseURL)).hostname });
  });

  for (const card of ['success', 'threeds']) {
    test(`çerçevede ${card === 'success' ? 'kartla' : '3D Secure ile'} ödeme → teşekkür adımı, toplam bir kez`, async ({ page, request, baseURL }, info) => {
      test.setTimeout(300000);
      const amount = card === 'success' ? '210' : '220';
      const before = await state(request, PRODUCT);
      await toPayStep(page, String(baseURL), amount, `stripe-compact-${card}-${info.project.name}@wdp-e2e.test`);
      const embed = await openLayer(page);
      await typeCard(page, CARDS[card]);
      await pay(embed);
      if (card === 'threeds') await answer3ds(page, 'complete');
      await expect(step(page, 'thanks')).toHaveClass(/is-on/, { timeout: 60000 });
      await expect(page.locator('dialog[data-dp-overlay]')).toBeHidden();
      await page.waitForTimeout(4000);
      const after = await state(request, PRODUCT, before.now);
      const order = after.orders.find((o) => PAID.includes(o.status));
      expect(order, 'ödenmiş sipariş').toBeTruthy();
      expect(order.via).toBe('donation_panel_direct');
      expect(order.email_set).toBe(true);
      const hooks = hookCounts(after.log, order.id);
      expect(hooks.payment_complete).toBe(1);
      expect(hooks.to_processing).toBe(1);
      expectRaised(before, after, { paidOrder: order.id, amount: Number(amount) });
      record({ scenario: `compact-iframe-${card}`, flow: 'direct-compact', project: info.project.name, status: order.status, hooks, raisedDelta: after.raised - before.raised });
    });
  }

  test('çerçeve kapatılır (yarıda bırakma) → ödenmez, toplam artmaz, kart yeniden açılır', async ({ page, request, baseURL }, info) => {
    test.setTimeout(300000);
    const before = await state(request, PRODUCT);
    await toPayStep(page, String(baseURL), '230', `stripe-compact-close-${info.project.name}@wdp-e2e.test`);
    await openLayer(page);
    await typeCard(page, CARDS.success);
    await page.locator('dialog[data-dp-overlay] [data-dp-close]').first().click();
    await expect(page.locator('dialog[data-dp-overlay]')).toBeHidden();
    await expect(step(page, 'pay')).toHaveClass(/is-on/);
    const mid = await state(request, PRODUCT, before.now);
    for (const o of mid.orders) expect(PAID).not.toContain(o.status);
    expectRaised(before, mid, { unpaid: mid.orders.map((o) => o.id) });
    // Yeniden açılır ve ödeme yapılabilir (akış kilitlenmez).
    const embed = await openLayer(page);
    await typeCard(page, CARDS.success);
    await pay(embed);
    await expect(step(page, 'thanks')).toHaveClass(/is-on/, { timeout: 60000 });
    await page.waitForTimeout(3000);
    const after = await state(request, PRODUCT, before.now);
    const paid = after.orders.filter((o) => PAID.includes(o.status));
    expect(paid.length).toBe(1);
    expectRaised(before, after, { paidOrder: paid[0].id, amount: 230 });
    record({ scenario: 'compact-iframe-kapat+tekrar', flow: 'direct-compact', project: info.project.name, orders: after.orders.length, paid: paid.length, raisedDelta: after.raised - before.raised });
  });
});
