/**
 * 12.3 kurgu ayrımı e2e (YALNIZ yerel WP): her düzen (popup, sağ panel, alttan panel, sayfa içi form, compact kart) ×
 * her ödeme davranışı (sepetli, doğrudan). Compact = yalnız görünüm; doğrudan = ödeme davranışı, her düzende aynı uç nokta:
 *  - sepetli: `POST cart/add` → ödeme sayfası, sepette 1 kalem; `direct` isteği 0.
 *  - doğrudan: `POST direct` → order-pay (compact'ta güvenli ödeme katmanında aynı kökenli çerçeve + "ödeme sayfasını açın"
 *    bağlantısı), sepet boş; `cart/add` isteği 0.
 * Ayrıca: compact kart yükseklikleri sepetli = doğrudan ve yönetici ekranındaki tabloyla (Compact_Tools::HEIGHTS) aynı.
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec kurgu-matrix --env local`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || String(IDS.custom || 0);
const DONOR = { name: 'Çağlar Şükrü Öztürk', email: 'caglar@example.org', phone: '7700 900123' };
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const LAYOUTS = ['popup', 'side_panel', 'bottom_sheet', 'inline', 'compact'];
const BEHAVIORS = ['cart', 'direct'];
const CARD = '[data-dp-compact]';

/**
 * Yönetici ekranında gösterilen yükseklik tablosu (tek kaynak: PHP sınıfı).
 *
 * @return {{heights: Record<string, number[]>, tolerance: number}} Tablo.
 */
function adminHeights() {
  const src = fs.readFileSync(path.join(ROOT, 'src/Admin/class-compact-tools.php'), 'utf8');
  const heights = {};
  for (const m of src.matchAll(/'(desktop|tablet|mobile)'\s*=>\s*array\(\s*(\d+),\s*(\d+)\s*\)/g)) {
    heights[m[1]] = [Number(m[2]), Number(m[3])];
  }
  const tol = src.match(/HEIGHT_TOLERANCE\s*=\s*(\d+)/);
  return { heights, tolerance: tol ? Number(tol[1]) : 0 };
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} baseURL Taban.
 * @param {string} behavior cart|direct.
 */
async function setBehavior(page, baseURL, behavior) {
  const cookies = [{ name: 'dp_progress_fresh', value: '1', url: baseURL }];
  if (behavior === 'direct') {
    cookies.push({ name: 'dp_direct', value: '1', url: baseURL });
  }
  await page.context().addCookies(cookies);
}

/**
 * Store API sepeti.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<object>} Sepet.
 */
async function cart(page) {
  const response = await page.request.get('/?rest_route=/wc/store/v1/cart');
  expect(response.status()).toBe(200);
  return response.json();
}

/**
 * İstekleri sayar (cart/add, direct).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {{cart: number[], direct: number[]}} Durum kodları.
 */
function watch(page) {
  const seen = { cart: [], direct: [] };
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/donation-panel/v1/cart/add')) seen.cart.push(r.status());
    if (url.includes('/donation-panel/v1/direct')) seen.direct.push(r.status());
  });
  return seen;
}

/**
 * Popup / sağ panel / alttan panel / sayfa içi form akışı (tutar → bilgiler → gönder).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} layout Düzen.
 * @param {string} behavior cart|direct.
 */
async function formFlow(page, layout, behavior) {
  await page.goto(`/?dp_exp_test=${layout}&dp_product=${PRODUCT}`);
  if (layout !== 'inline') {
    await page.locator('[data-dp-open]').first().click();
    await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/, { timeout: 20000 });
  }
  const form = page.locator('[data-dp-form]');
  await expect(form).toBeVisible({ timeout: 20000 });
  if (behavior === 'direct') {
    await expect(form).toHaveAttribute('data-direct', '1');
  } else {
    await expect(form).not.toHaveAttribute('data-direct', /.*/);
  }
  // 12.4 klavye sözleşmesi: dokunmatik cihazda yazı alanı odaktayken sabit alt bölüm (düğme) gizlidir; bağışçı klavyeyi
  // kapatınca (odak çıkınca) düğme geri gelir. Test aynı adımı yapar (alan odaktan çıkar), sonra düğmeye dokunur.
  await page.locator('input[name="amount"]').fill('60');
  await page.locator('input[name="amount"]').blur();
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
  // 12.4: doğrudan akışta e-posta zorunlu (order-pay fatura sormaz); sepetli akışta formda e-posta alanı yok.
  const email = page.locator('input[name="donation_email"]');
  if (behavior === 'direct') {
    await expect(email).toHaveAttribute('required', '');
    await email.fill('kurgu@wdp-e2e.test');
    await email.blur();
  } else {
    await expect(email).toHaveCount(0);
  }
  // Telefon son alan olabilir: odak çıkışında beliren cep uyarısı düğmeyi kaydırır; önce odağı bırak.
  await page.locator('input[name="donation_phone"]').blur();
  await page.locator('[data-dp-submit]').click();
  await page.waitForURL(behavior === 'direct' ? /order-pay/ : CHECKOUT_URL, { timeout: 30000 });
}

/**
 * Compact kart akışı (tutar → bilgiler → ödeme).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} behavior cart|direct.
 */
async function compactFlow(page, behavior) {
  await page.goto(`/?dp_compact=plain&dp_ids=${PRODUCT}`);
  const card = page.locator(`${CARD}[data-dp-ready="1"]`).first();
  await expect(card).toBeVisible({ timeout: 20000 });
  const step = (name) => card.locator(`[data-dp-cstep="${name}"]`);
  const chip = step('amount').locator('.donation-panel-compact__chip').first();
  if (await chip.count()) {
    await chip.click();
  } else {
    await step('amount').locator('[data-dp-camount-in]').fill('60');
  }
  await step('amount').locator('[data-dp-cnext]').click();
  await expect(step('details')).toHaveClass(/is-on/);
  await step('details').locator('input[name="donation_full_name"]').fill(DONOR.name);
  const email = step('details').locator('input[name="donation_email"]');
  if (await email.count()) {
    await email.fill(DONOR.email);
  }
  await step('details').locator('input[name="donation_phone"]').fill(DONOR.phone);
  // 12.3 compact v2: sepetli akış 2 adım (bilgiler adımının düğmesi sepete ekleyip ödemeye geçer), doğrudan 3 adım.
  if (behavior === 'direct') {
    await expect(step('details').locator('[data-dp-cpay]')).toHaveCount(0);
    await step('details').locator('button[type="submit"]').click();
    await expect(step('pay')).toHaveClass(/is-on/);
  } else {
    await expect(card.locator('[data-dp-cstep="pay"]')).toHaveCount(0);
  }
  const pay = (behavior === 'direct' ? step('pay') : step('details')).locator('[data-dp-cpay]');
  if (behavior === 'direct') {
    await expect(pay).toHaveAttribute('aria-haspopup', 'dialog');
    await pay.click();
    const dialog = page.locator('dialog[data-dp-overlay]');
    await expect(dialog).toBeVisible({ timeout: 15000 });
    const frame = page.frameLocator('[data-dp-cframe]');
    await expect(frame.locator('input[name="payment_method"]').first()).toBeAttached({ timeout: 30000 });
    // Çerçeve engellenirse geri dönüş: aynı order-pay adresine üst pencerede giden bağlantı hazır.
    const alt = dialog.locator('[data-dp-cpayalt]');
    await expect(alt).not.toHaveClass(/is-off/);
    expect(await alt.getAttribute('href')).toMatch(/order-pay/);
    expect(await alt.getAttribute('target')).toBe('_top');
  } else {
    await expect(pay).not.toHaveAttribute('aria-haspopup', 'dialog');
    await pay.click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
  }
}

test.describe('kurgu: düzen × ödeme davranışı', () => {
  test.beforeEach(() => {
    test.skip(!Number(PRODUCT), 'test ürünü yok');
    test.setTimeout(120000);
  });

  for (const layout of LAYOUTS) {
    for (const behavior of BEHAVIORS) {
      test(`${layout} × ${behavior === 'direct' ? 'doğrudan' : 'sepetli'}`, async ({ page, baseURL }) => {
        await setBehavior(page, baseURL, behavior);
        const seen = watch(page);
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        if (layout === 'compact') {
          await compactFlow(page, behavior);
        } else {
          await formFlow(page, layout, behavior);
        }
        if (behavior === 'direct') {
          expect(seen.direct).toEqual([200]);
          expect(seen.cart).toEqual([]);
          expect((await cart(page)).items).toHaveLength(0);
        } else {
          expect(seen.cart).toEqual([200]);
          expect(seen.direct).toEqual([]);
          const items = (await cart(page)).items;
          expect(items).toHaveLength(1);
          expect(items[0].id).toBe(Number(PRODUCT));
        }
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe('compact kart yükseklikleri', () => {
  test('sepetli = doğrudan ve yönetici ekranındaki tablo ile aynı (±tolerans)', async ({ page, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || !IDS.custom || !IDS.campaign, 'genişlik taraması masaüstü projesinde');
    test.setTimeout(180000);
    const { heights, tolerance } = adminHeights();
    const widths = { desktop: 1440, tablet: 820, mobile: 375 };
    const out = {};
    for (const [key, width] of Object.entries(widths)) {
      await page.setViewportSize({ width, height: 900 });
      out[key] = [];
      // Sütun 2: sabit fiyatlı ürün (tek ekran); serbest tutarlı ürünle AYNI yükseklikte olmalı.
      for (const [col, id] of [[0, IDS.custom], [1, IDS.campaign], [2, IDS.fixed]].filter(([, value]) => value)) {
        const measured = {};
        for (const behavior of BEHAVIORS) {
          await page.context().clearCookies();
          await setBehavior(page, baseURL, behavior);
          await page.goto(`/?dp_compact=plain&dp_ids=${id}`);
          const card = page.locator(`${CARD}[data-dp-ready="1"]`).first();
          await expect(card).toBeVisible({ timeout: 20000 });
          await page.evaluate(() => document.fonts.ready);
          measured[behavior] = await card.evaluate((el) => el.getBoundingClientRect().height);
        }
        expect(Math.abs(measured.cart - measured.direct), `${key}/${col}: ${JSON.stringify(measured)}`).toBeLessThanOrEqual(0.5);
        out[key][col] = Math.round(measured.cart);
        if (col === 2) {
          // En kalabalık tek ekran (beyan + etki ayarı + adet + 3 alan + güven satırı) da aynı yükseklikte kalır.
          for (const behavior of BEHAVIORS) {
            await page.context().clearCookies();
            await setBehavior(page, baseURL, behavior);
            await page.goto(`/?dp_compact=plain&dp_ids=${id}&dp_ctax=1&dp_cimpact=1`);
            const worst = page.locator(`${CARD}[data-dp-ready="1"]`).first();
            await expect(worst).toBeVisible({ timeout: 20000 });
            await page.evaluate(() => document.fonts.ready);
            const h = await worst.evaluate((el) => el.getBoundingClientRect().height);
            expect(Math.abs(h - out[key][0]), `${key}/${behavior}: sabit+beyan+etki ${h} ≠ ${out[key][0]}`).toBeLessThanOrEqual(0.5);
          }
          expect(Math.abs(measured.cart - out[key][0]), `${key}: sabit fiyat ${measured.cart} ≠ serbest tutar ${out[key][0]}`).toBeLessThanOrEqual(0.5);
        }
        if (heights[key] && heights[key][col] > 0) {
          expect(Math.abs(measured.cart - heights[key][col]), `${key}/${col}: ölçülen ${measured.cart}, tablo ${heights[key][col]}`).toBeLessThanOrEqual(tolerance);
        }
      }
    }
    console.log(`KURGU_COMPACT_HEIGHTS ${JSON.stringify(out)}`);
    expect(Object.values(heights).every((pair) => pair[0] > 0 && pair[1] > 0), `tablo ölçülmemiş: ${JSON.stringify(out)}`).toBe(true);
  });
});
