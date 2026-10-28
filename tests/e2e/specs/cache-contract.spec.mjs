/**
 * Önbellek sözleşmesi (12.1): sunucu HTML'i hiçbir ziyaretçiye özel değildir.
 * (a) çerezsiz, (b) dolu sepet çerezli, (c) giriş yapmış, (d) ikisi birden: aynı sayfaların gövdesi normalize edilince
 * bayt bayt aynı; sepet satırı/tutarı HTML'de yok. (e) yanlış yapılandırılmış önbellek benzetimi: çerezli yanıt çerezsiz
 * ziyaretçiye sunulur, sepet bilgisi görünmez.
 * YALNIZ yerel WP: `npm run e2e:side-cart -- --spec cache-contract --project desktop`; uzak yok.
 */
import { test, expect, request as pwRequest } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const AMOUNT = '6137'; // Ayırt edici tutar: HTML'de hiçbir yerde geçmemeli.
const PAGES = [
  ['ana sayfa', '/'],
  ['mağaza', '/?post_type=product'],
  ['bağış ürünü', `/?p=${PRODUCT}`],
  ['liste + simgeler', '/?dp_cc_test=1'],
];

/**
 * Zamana/ziyaretçiye bağlı çekirdek alanları ayıklar (eklenti çıktısı hariç hiçbir şey saklanmaz).
 *
 * @param {string} html Ham HTML.
 * @return {string} Normalize HTML.
 */
function normalize(html) {
  return html
    .replace(/<body([^>]*)\sclass="[^"]*"/i, '<body$1')
    .replace(/(nonce["'\s:=]+)[0-9a-f]{8,12}/gi, '$1N')
    .replace(/([?&](?:ver|_wpnonce|_)=)[\w.-]+/g, '$1V')
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} base Taban adres.
 * @param {'anon'|'cart'|'user'|'both'} kind Ziyaretçi türü.
 * @return {Promise<import('@playwright/test').APIRequestContext>} Çerezleri tutan istemci.
 */
async function visitor(base, kind) {
  const ctx = await pwRequest.newContext({ baseURL: base });
  if (kind === 'user' || kind === 'both') {
    const r = await ctx.get('/?dp_cc_login=1');
    expect((await r.json()).ok).toBe(true);
  }
  if (kind === 'cart' || kind === 'both') {
    const r = await ctx.get(`/?dp_sc_add=${PRODUCT}&amount=${AMOUNT}`);
    expect((await r.json()).ok).toBe(true);
  }
  return ctx;
}

test.describe('önbellek sözleşmesi', () => {
  let base = '';
  const bodies = {};

  test.beforeAll(async ({ baseURL }) => {
    base = baseURL;
    for (const kind of ['anon', 'cart', 'user', 'both']) {
      const ctx = await visitor(base, kind);
      bodies[kind] = {};
      for (const [name, url] of PAGES) {
        const r = await ctx.get(url);
        expect(r.status(), `${kind} ${name}`).toBe(200);
        bodies[kind][name] = await r.text();
      }
      await ctx.dispose();
    }
  });

  for (const [name] of PAGES) {
    test(`${name}: çerezsiz = sepet çerezli = girişli = ikisi (bayt bayt)`, () => {
      const ref = normalize(bodies.anon[name]);
      expect(ref.length).toBeGreaterThan(500);
      for (const kind of ['cart', 'user', 'both']) {
        expect(normalize(bodies[kind][name]), `${kind} ≠ anon (${name})`).toBe(ref);
      }
    });

    test(`${name}: sepet satırı, tutar, oturum bilgisi HTML'de yok`, () => {
      for (const kind of ['cart', 'both']) {
        const html = bodies[kind][name];
        expect(html).not.toContain('data-dp-sc-line');
        expect(html).not.toContain('donation-panel-sc__row');
        expect(html).not.toContain('donation-panel-sc__subtotal');
        expect(html).not.toContain(AMOUNT);
      }
      for (const kind of ['user', 'both']) {
        expect(bodies[kind][name]).not.toMatch(/class="[^"]*donation-panel-ac__trigger[^"]*"[^>]*href=/);
      }
    });
  }

  test('yanlış yapılandırılmış önbellek: çerezli yanıt çerezsiz ziyaretçiye sunulur, sepet bilgisi görünmez', async ({ page }) => {
    const served = bodies.both['liste + simgeler'];
    const calls = [];
    page.on('request', (r) => {
      if (/donation-panel\/v1\/side-cart/.test(r.url())) {
        calls.push(r.url());
      }
    });
    await page.route('**/?dp_cc_test=1', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: served }));
    await page.goto('/?dp_cc_test=1');
    await expect(page.locator('[data-dp-sc][data-dp-sc-mounted="1"]')).toHaveCount(1);
    await expect(page.locator('[data-dp-sc-line]')).toHaveCount(0);
    await expect(page.locator('[data-dp-sc-open] [data-dp-sc-count]')).toBeHidden();
    await expect(page.locator('[data-dp-sc-fab]')).toBeHidden();
    await expect(page.locator('[data-dp-acc-open]')).toBeVisible();
    await page.waitForTimeout(2000);
    expect(calls).toEqual([]);
    expect(await page.content()).not.toContain(AMOUNT);
  });

  test('istemci: sepet çerezli ziyaretçide sayaç/satır REST ile gelir, girişli ziyaretçide simge Hesabım bağlantısı olur', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.request.get('/?dp_cc_login=1');
    await page.request.get(`/?dp_sc_add=${PRODUCT}&amount=${AMOUNT}`);
    await page.goto('/?dp_cc_test=1');
    await expect(page.locator('[data-dp-sc-open] [data-dp-sc-count]')).toHaveText('1', { timeout: 20000 });
    await expect(page.locator('a.donation-panel-ac__trigger')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-dp-sc-open]').click();
    await expect(page.locator('[data-dp-sc-line]')).toHaveCount(1);
    await ctx.close();
  });
});
