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
 * WordPress/WooCommerce Interactivity durumu (ör. blok tabanlı mağaza/ürün şablonlarında `wp-script-module-data-*`) sepeti
 * çekirdek olarak HTML'e yazabilir; bu çıktı eklentiye ait değildir ve eklenti tarafından değiştirilemez.
 *
 * @param {string} html Ham HTML.
 * @return {string} Çekirdek JSON durum betikleri çıkarılmış HTML.
 */
function stripCore(html) {
  // Yorum formu da çekirdeğe aittir ve oturuma göre değişir (WordPress / WooCommerce değerlendirme formu).
  return html
    .replace(/<script\b[^>]*id="wp-script-module-data-[^"]*"[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<form\b[^>]*id="commentform"[\s\S]*?<\/form>/gi, '');
}

/**
 * Zamana/ziyaretçiye bağlı çekirdek alanları ayıklar (eklenti çıktısı hariç hiçbir şey saklanmaz).
 *
 * @param {string} html Ham HTML.
 * @return {string} Normalize HTML.
 */
function normalize(html) {
  // Çekirdeğe/WooCommerce'e ait betik, stil ve bağlantı öğeleri (Interactivity durumu, speculation rules, blok stilleri)
  // ziyaretçiye göre değişebilir ve eklentiye ait değildir: yalnız eklenti öğeleri (donation-panel / woo-donation-popup) kalır.
  const ownedOnly = () => (m) => (/donation-panel|woo-donation-popup/i.test(m) ? m : '');
  return stripCore(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ownedOnly('script'))
    .replace(/<style\b[\s\S]*?<\/style>/gi, ownedOnly('style'))
    .replace(/<link\b[^>]*>/gi, ownedOnly('link'))
    .replace(/<body([^>]*)\sclass="[^"]*"/i, '<body$1')
    .replace(/(nonce["'\s:=]+)[0-9a-f]{8,12}/gi, '$1N')
    .replace(/([?&](?:ver|_wpnonce|_)=)[\w.-]+/g, '$1V')
    .replace(/\s+/g, ' ');
}

/**
 * İlk farkın çevresi (hata iletisi için).
 *
 * @param {string} a Beklenen.
 * @param {string} b Gelen.
 * @return {string} Özet.
 */
function firstDiff(a, b) {
  if (a === b) {
    return '';
  }
  let i = 0;
  while (i < a.length && a[i] === b[i]) {
    i += 1;
  }
  return `@${i}\n  beklenen: ${a.slice(Math.max(0, i - 80), i + 160)}\n  gelen:    ${b.slice(Math.max(0, i - 80), i + 160)}`;
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
        const got = normalize(bodies[kind][name]);
        expect(got === ref, `${kind} ≠ anon (${name}) ${firstDiff(ref, got)}`).toBe(true);
      }
    });

    test(`${name}: sepet satırı, tutar, oturum bilgisi HTML'de yok`, () => {
      for (const kind of ['cart', 'both']) {
        const html = stripCore(bodies[kind][name]);
        expect(html).not.toContain('data-dp-sc-line');
        expect(html).not.toContain('donation-panel-sc__row');
        expect(html).not.toContain('donation-panel-sc__subtotal');
        const at = html.indexOf(AMOUNT);
        expect(at, `${kind} ${name}: tutar HTML'de: ${html.slice(Math.max(0, at - 120), at + 60)}`).toBe(-1);
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

  test('istemci: sepet çerezli ziyaretçide sayaç/satır REST ile gelir', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.request.get(`/?dp_sc_add=${PRODUCT}&amount=${AMOUNT}`);
    await page.goto('/?dp_cc_test=1');
    await expect(page.locator('[data-dp-sc-open] [data-dp-sc-count]')).toHaveText('1', { timeout: 20000 });
    await page.locator('[data-dp-sc-open]').click();
    await expect(page.locator('[data-dp-sc-line]')).toHaveCount(1);
    await ctx.close();
  });

  test('istemci: girişli ziyaretçide simge Hesabım bağlantısına dönüşür, misafirde düğme kalır', async ({ browser, baseURL }) => {
    const guest = await browser.newContext({ baseURL });
    const gp = await guest.newPage();
    await gp.goto('/?dp_cc_test=1');
    await expect(gp.locator('button.donation-panel-ac__trigger')).toBeVisible();
    await gp.waitForTimeout(1500);
    await expect(gp.locator('a.donation-panel-ac__trigger')).toHaveCount(0);
    await guest.close();

    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.request.get('/?dp_cc_login=1');
    await page.goto('/?dp_cc_test=1');
    await expect(page.locator('a.donation-panel-ac__trigger')).toHaveAttribute('href', /my-account|hesab|account/i, { timeout: 20000 });
    await expect(page.locator('button.donation-panel-ac__trigger')).toHaveCount(0);
    await ctx.close();
  });
});
