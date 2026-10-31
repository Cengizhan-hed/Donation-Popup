/**
 * kurgu-matrix ortak yardımcıları (kurulum sabitleri, adminHeights, setBehavior, cart, watch, formFlow, compactFlow).
 * Konu dosyaları: kurgu-matrix-layout-pay.spec.mjs (düzen × ödeme; formFlow içindeki klavye/e-posta alan kuralları dahil),
 * kurgu-matrix-height.spec.mjs (compact yükseklik). YALNIZ yerel WP.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
export const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || String(IDS.custom || 0);
export const DONOR = { name: 'Çağlar Şükrü Öztürk', email: 'caglar@example.org', phone: '7700 900123' };
export const CHECKOUT_URL = /checkout|odeme|ödeme/i;
export const LAYOUTS = ['popup', 'side_panel', 'bottom_sheet', 'inline', 'compact'];
export const BEHAVIORS = ['cart', 'direct'];
export const CARD = '[data-dp-compact]';

/**
 * Yönetici ekranında gösterilen yükseklik tablosu (tek kaynak: PHP sınıfı).
 *
 * @return {{heights: Record<string, number[]>, tolerance: number}} Tablo.
 */
export function adminHeights() {
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
export async function setBehavior(page, baseURL, behavior) {
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
export async function cart(page) {
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
export function watch(page) {
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
export async function formFlow(page, layout, behavior) {
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
 * Compact kart akışı (tutar → ad/telefon → "Ödemeye geç"): ödeme davranışı HER ZAMAN sepetli (doğrudan bağış ayarı uygulanmaz).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 */
export async function compactFlow(page) {
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
  await step('details').locator('input[name="donation_phone"]').fill(DONOR.phone);
  // Ödeme adımı, çerçeve ve e-posta alanı yok; son adımın düğmesi sepete ekleyip ödeme sayfasına geçer.
  await expect(card.locator('[data-dp-cstep="pay"], iframe, input[name="donation_email"]')).toHaveCount(0);
  const pay = step('details').locator('[data-dp-cpay]');
  await expect(pay).not.toHaveAttribute('aria-haspopup', 'dialog');
  await pay.click();
  await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
}
