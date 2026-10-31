/**
 * Experiences (E2B): Store API sepet köprüsü — tutar -> sepet -> ödeme, bayat nonce, sipariş meta (HPOS).
 * YALNIZ yerel WP (`npm run e2e:experiences -- --spec experiences-cart [--checkout blocks]`); uzak yok.
 */
import { test, expect } from '@playwright/test';
import { parseLocalEvalJson, runLocalEvalFile } from '../helpers/local-wp-eval.mjs';
import { completeLocalCheckout } from '../helpers/place-order.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const STORE = JSON.parse(process.env.WDP_EXP_STORE || '{}');
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
const DONOR = {
  name: 'Çağlar Şükrü Öztürk İğdır',
  phone: '+44 7700 900123',
  note: 'Ğüşiöç ĞÜŞİÖÇ notu',
  email: 'caglar.sukru@wdp-e2e.test',
};
const AMOUNT = '125';
const CHECKOUT_URL = /checkout|odeme|ödeme/i;

const pageUrl = (extra = '') => `/?dp_exp_test=inline&dp_product=${PRODUCT}${extra}`;

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} [extra] Ek sorgu.
 */
async function loadForm(page, extra = '') {
  await page.goto(pageUrl(extra));
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillForm(page) {
  await page.locator('input[name="amount"]').fill(AMOUNT);
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
  await page.locator('[data-dp-note-toggle]').click();
  await page.locator('textarea[name="donation_note"]').fill(DONOR.note);
}

/**
 * Store API sepeti (aynı oturum çerezleriyle).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<object>} Sepet.
 */
async function storeApiCart(page) {
  const response = await page.request.get('/?rest_route=/wc/store/v1/cart');
  expect(response.status()).toBe(200);
  return response.json();
}

// 12.4 email4: sepetli akışta hiçbir yüzeyde e-posta alanı yoktur (e-posta WooCommerce ödeme sayfasında alınır).
for (const kind of ['inline', 'popup', 'side_panel', 'bottom_sheet']) {
  test(`sepetli, ${kind}: formda e-posta alanı yok`, async ({ page }) => {
    await page.goto(`/?dp_exp_test=${kind}&dp_product=${PRODUCT}`);
    if (kind !== 'inline') {
      await page.locator('[data-dp-open]').click();
      await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
    }
    await expect(page.locator('[data-dp-form]').first()).toBeAttached({ timeout: 20000 });
    expect(await page.locator('input[name="donation_email"]').count()).toBe(0);
    expect(await page.locator('[data-dp-field="donation_email"]').count()).toBe(0);
  });
}

test.describe('sepet köprüsü (yeni motor)', () => {
  test('tutar -> sepet -> ödeme: doğru ürün ve tutar, Store API uzantısı kişi verisiz', async ({ page }) => {
    await loadForm(page);
    await fillForm(page);
    let captured = null;
    await page.route('**/donation-panel/v1/cart/add*', async (route) => {
      const upstream = await route.fetch();
      captured = { status: upstream.status(), headers: upstream.headers(), text: await upstream.text() };
      await route.fulfill({ response: upstream, body: captured.text });
    });
    await page.locator('[data-dp-submit]').click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    expect(captured.status).toBe(200);
    expect(captured.headers['cache-control'] || '').toContain('no-store');
    const body = JSON.parse(captured.text);
    expect(body.success).toBe(true);
    expect(JSON.stringify(body)).not.toContain('Çağlar');
    await expect(page.locator('body')).toContainText(AMOUNT);

    const cart = await storeApiCart(page);
    expect(cart.items).toHaveLength(1);
    const line = cart.items[0];
    expect(line.id).toBe(Number(PRODUCT));
    const minor = 10 ** Number(cart.totals.currency_minor_unit);
    expect(Number(cart.totals.total_items) / minor).toBe(Number(AMOUNT));
    expect(line.extensions['donation-panel'].is_donation).toBe(true);
    const ext = JSON.stringify(line.extensions['donation-panel']);
    for (const secret of [DONOR.name, DONOR.phone, DONOR.note]) {
      expect(ext).not.toContain(secret);
    }
  });

  test('bayat nonce (anonim): form yine de sepete ekler', async ({ page }) => {
    await loadForm(page);
    await page.locator('[data-dp-exp]').evaluate((el) => {
      el.dataset.dpNonce = 'bayat-nonce';
    });
    await fillForm(page);
    const statuses = [];
    page.on('response', (r) => {
      if (r.url().includes('/donation-panel/v1/cart/add')) {
        statuses.push(r.status());
      }
    });
    await page.locator('[data-dp-submit]').click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    expect(statuses[statuses.length - 1]).toBe(200);
    expect((await storeApiCart(page)).items).toHaveLength(1);
  });

  test('bayat nonce (girişli kullanıcı): 403 -> taze nonce -> yeniden dener ve kullanıcının sepetine ekler', async ({ page, context, baseURL }) => {
    const auth = parseLocalEvalJson(runLocalEvalFile('tests/local-wp/auth-cookies.php', [], { env: { WDP_LOCAL_WP_DIR: WP_DIR } }));
    expect(auth.ok).toBe(true);
    await context.addCookies([
      { name: auth.logged_in_name, value: auth.logged_in, url: baseURL },
      { name: auth.auth_name, value: auth.auth, url: baseURL },
    ]);
    await loadForm(page);
    await page.locator('[data-dp-exp]').evaluate((el) => {
      el.dataset.dpNonce = 'bayat-nonce';
    });
    await fillForm(page);
    const statuses = [];
    let nonceCalls = 0;
    page.on('response', (r) => {
      if (r.url().includes('/donation-panel/v1/cart/add')) {
        statuses.push(r.status());
      }
      if (r.url().includes('/donation-panel/v1/nonce')) {
        nonceCalls += 1;
      }
    });
    await page.locator('[data-dp-submit]').click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    expect(statuses).toEqual([403, 200]);
    expect(nonceCalls).toBe(1);
    expect((await storeApiCart(page)).items).toHaveLength(1);
  });

  test('REST uçları: JSON zorunlu, hata biçimi, nonce önbelleksiz', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'cihazdan bağımsız API denetimi bir kez');
    await page.goto(pageUrl());
    const base = '/?rest_route=/donation-panel/v1';
    const form = await page.request.post(`${base}/cart/add`, { form: { product_id: PRODUCT, amount: AMOUNT } });
    expect(form.status()).toBe(415);

    const unknown = await page.request.post(`${base}/cart/add`, { data: { product_id: 99999999, amount: AMOUNT } });
    expect(unknown.status()).toBe(404);

    const invalid = await page.request.post(`${base}/cart/add`, { data: { product_id: Number(PRODUCT), amount: '0', donation_full_name: '' } });
    expect(invalid.status()).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.code).toBe('donation_panel_cart_rejected');
    expect(Object.keys(invalidBody.data.errors)).toEqual(expect.arrayContaining(['amount', 'donation_full_name']));

    const nonce = await page.request.get(`${base}/nonce`);
    expect(nonce.status()).toBe(200);
    expect(nonce.headers()['cache-control']).toContain('no-store');
    expect((await nonce.json()).nonce).toMatch(/^[a-f0-9]{10}$/);
    expect((await storeApiCart(page)).items).toHaveLength(0);
  });

  test('sipariş: bağışçı alanları Türkçe karakterle HPOS sipariş kalemine eksiksiz yazılır', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'sipariş denemesi bir cihazda (yerel)');
    test.setTimeout(180000);
    await loadForm(page);
    await fillForm(page);
    await page.locator('[data-dp-submit]').click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    const { rec } = await completeLocalCheckout(page, {
      store: STORE,
      checkoutKind: CHECKOUT === 'blocks' ? 'blocks' : 'classic',
      wpDir: WP_DIR,
      donor: { name: DONOR.name, email: DONOR.email, phone: DONOR.phone },
      expected: { donorName: DONOR.name, donorPhone: DONOR.phone, amount: AMOUNT, hpos: true, currency: 'TRY' },
    });
    const meta = rec.items[0].meta;
    expect(meta.wdp_donor_name).toBe(DONOR.name);
    expect(meta.wdp_donation_note).toBe(DONOR.note);
    expect(String(meta.wdp_donor_phone).replace(/\D/g, '')).toBe(DONOR.phone.replace(/\D/g, ''));
  });
});
