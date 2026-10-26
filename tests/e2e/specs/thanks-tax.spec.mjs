/**
 * E6: teşekkür ekranı (özet, kişi bilgisi yok, kutlama, paylaşım, axe) + vergi indirimi beyanı (sipariş meta, HPOS).
 * Yalnız yerel WP; `npm run e2e:e6 [-- --checkout blocks]`. Uzak yok.
 *
 * Yeni motor 3 adımlı: tutar -> bilgiler -> vergi indirimi (onay kutusu adım kancasından; E2C).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeLocalCheckout } from '../helpers/place-order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const STORE = JSON.parse(process.env.WDP_EXP_STORE || '{}');
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const DONOR = { name: 'Çağlar Şükrü Öztürk İğdır', phone: '+44 7700 900123', note: 'Ğüşiöç ĞÜŞİÖÇ notu', email: 'caglar.sukru@wdp-e2e.test' };
const LEGACY_PHONE = '5551234567';
const AMOUNT = '125';
const WOO_CONTENT = '.woocommerce-order, .wc-block-order-confirmation-status, .wp-block-woocommerce-order-confirmation-status';

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} selector Kapsam.
 * @return {Promise<string[]>} İhlal kimlikleri.
 */
async function axeViolations(page, selector) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async (sel) => {
    const result = await window.axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } });
    return result.violations.map((v) => `${v.id}:${v.nodes.length}:${v.nodes[0].target.join(' ')}:${v.nodes[0].any.map((a) => a.message).join('|')}`);
  }, selector);
}

/**
 * Formu doldurur, 3 adımda ilerler, (isteğe bağlı) vergi indirimi kutusunu işaretler, ödeme sayfasında siparişi verir.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {{tax: boolean}} opts Seçenekler.
 * @return {Promise<{orderId: number, thanksUrl: string}>} Sipariş.
 */
async function placeDonation(page, { tax, legacy = false }) {
  // Eski motor telefon kutusu ülke ön ekini (mağaza ülkesi) kendisi ekler; ulusal numara yazılır.
  const phone = legacy ? LEGACY_PHONE : DONOR.phone;
  if (legacy) {
    await fillLegacy(page);
  } else {
    await fillNew(page, tax);
  }
  await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
  const { orderId } = await completeLocalCheckout(page, {
    store: STORE,
    checkoutKind: CHECKOUT,
    wpDir: WP_DIR,
    donor: { name: DONOR.name, email: DONOR.email, phone: phone },
    expected: { donorName: DONOR.name, donorPhone: phone, amount: AMOUNT, hpos: true },
  });
  await page.waitForURL(/order-received|key=wc_order/i);
  return { orderId, thanksUrl: page.url() };
}

/**
 * Eski motor (engine=legacy): ürün düğmesi -> modal -> sepete ekle. Vergi indirimi adımı yalnız yeni motor formundadır.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fillLegacy(page) {
  await page.context().addCookies([{ name: 'dp_e6_legacy', value: '1', url: process.env.E2E_BASE_URL }]);
  await page.goto(`/?dp_e6_test=legacy&dp_product=${PRODUCT}`);
  await page.locator('.wdp-open-modal').first().click();
  const shell = page.locator('.hdf-donation-modal-wrapper.wdp-modal.show');
  await expect(shell).toBeVisible({ timeout: 20000 });
  await shell.locator('input[name="custom_price"]').first().fill(AMOUNT);
  await shell.locator('input[name="donation_full_name"]').first().fill(DONOR.name);
  await shell.locator('input[name="donation_phone"]').first().fill(LEGACY_PHONE);
  await shell.locator('textarea[name="donation_note"]').first().fill(DONOR.note);
  await shell.locator('button[name="donation_go_checkout"]').first().click();
}

/**
 * Yeni motor: 3 adımlı satır içi form.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {boolean} tax Vergi indirimi kutusu işaretlensin mi.
 */
async function fillNew(page, tax) {
  await page.goto(`/?dp_e6_test=form&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
  await page.locator('input[name="amount"]').fill(AMOUNT);
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
  await page.locator('textarea[name="donation_note"]').fill(DONOR.note);
  await page.locator('[data-dp-submit]').click();
  // Üçüncü adım (vergi indirimi): onay kutusu gerçek adım kancasından gelir.
  await expect(page.locator('[data-dp-step="tax_relief"]')).toBeVisible();
  const box = page.locator('[data-dp-step="tax_relief"] input[name="donation_tax_relief"]');
  if (tax) {
    await box.check();
  } else {
    await expect(box).not.toBeChecked();
  }
  await page.locator('[data-dp-submit]').click();
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {number} orderId Sipariş.
 * @return {Promise<{order: Record<string,string>, items: Array<Record<string,string>>, hpos: boolean}>} Meta.
 */
async function readMeta(page, orderId) {
  const response = await page.request.get(`/?dp_e6_test=meta&dp_order=${orderId}`);
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe('teşekkür + vergi indirimi', () => {
  test('sipariş sonrası teşekkür özeti: kişi bilgisi yok, kutlama, paylaşım, axe, taşma yok; beyan sipariş metasında', async ({ page, context }, testInfo) => {
    test.setTimeout(240000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const desktop = testInfo.project.name === 'desktop';
    if (desktop) {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await context.addInitScript(() => Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true }));
    } else {
      await context.addInitScript(() => {
        window.__shared = [];
        Object.defineProperty(window.navigator, 'share', { value: (d) => { window.__shared.push(d); return Promise.resolve(); }, configurable: true });
      });
    }

    const { orderId } = await placeDonation(page, { tax: true });

    const thanks = page.locator('[data-dp-thanks]');
    await expect(thanks).toBeVisible();
    await expect(page.locator(WOO_CONTENT).first()).toBeVisible();
    await expect(thanks.locator('h2')).toHaveText(/thank you|teşekkür/i);
    await expect(thanks.locator('.dp-thanks__amount')).toContainText('125');
    await expect(thanks.locator('.dp-thanks__project')).toHaveCount(1);
    await expect(thanks.locator('a[href]', { hasText: /give again|tekrar/i })).toBeVisible();

    const text = (await thanks.innerText()) + (await thanks.innerHTML());
    for (const secret of [DONOR.name, 'Çağlar', DONOR.email, '7700', DONOR.note, 'Şükrü']) {
      expect(text).not.toContain(secret);
    }

    // Kutlama: konfeti oluşur ve süre sonunda silinir.
    await expect(page.locator('.dp-thanks-confetti i')).toHaveCount(26);
    await expect(page.locator('.dp-thanks-confetti')).toHaveCount(0, { timeout: 8000 });
    if (process.env.WDP_UI2_SHOTS) {
      // Yalnız ekran görüntüsü toplama koşusunda: ONCE-SONRA/Tesekkur/uygulama-<mobil|masaustu>.png
      await thanks.screenshot({ path: path.join(process.env.WDP_UI2_SHOTS, 'Tesekkur', `uygulama-${desktop ? 'masaustu' : 'mobil'}.png`) });
    }

    // Paylaşım: Web Share (mobil) ya da bağlantı kopyalama (masaüstü).
    const share = thanks.locator('[data-dp-share]');
    await expect(share).toBeVisible();
    await share.click();
    if (desktop) {
      await expect(thanks.locator('[data-dp-thanks-toast]')).toContainText(/link copied|bağlantı kopyalandı/i);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https?:\/\//);
    } else {
      const shared = await page.evaluate(() => window.__shared);
      expect(shared).toHaveLength(1);
      expect(shared[0].url).toMatch(/^https?:\/\//);
      for (const secret of [DONOR.name, DONOR.email, '7700', DONOR.note]) {
        expect(JSON.stringify(shared[0])).not.toContain(secret);
      }
    }

    expect(await axeViolations(page, '[data-dp-thanks]')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    // Beyan: sipariş + kalem meta (HPOS), bağışçı alanları bozulmadan.
    const meta = await readMeta(page, orderId);
    expect(meta.hpos).toBe(true);
    expect(meta.order._wdp_tax_relief_declared).toBe('yes');
    expect(meta.order._wdp_tax_relief_text_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.items[0]._wdp_tax_relief_declared).toBe('yes');
    expect(meta.items[0]._wdp_tax_relief_text_hash).toBe(meta.order._wdp_tax_relief_text_hash);
    expect(meta.items[0].wdp_donor_name).toBe(DONOR.name);
    expect(meta.items[0].wdp_donation_note).toBe(DONOR.note);
    expect(errors).toEqual([]);
  });

  test('azaltılmış hareket: konfeti oluşmaz, onay işareti tam görünür; modül kapalıyken özet yok, Woo sayfası durur; beyan yoksa meta yok', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'sipariş denemesi bir cihazda (yerel)');
    test.setTimeout(240000);
    const { orderId, thanksUrl } = await placeDonation(page, { tax: false });

    const meta = await readMeta(page, orderId);
    expect(meta.order._wdp_tax_relief_declared).toBe('');
    expect(meta.items[0]._wdp_tax_relief_declared).toBe('');
    expect(meta.items[0].wdp_donor_name).toBe(DONOR.name);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(thanksUrl);
    await expect(page.locator('[data-dp-thanks]')).toBeVisible();
    await expect(page.locator('.dp-thanks-confetti')).toHaveCount(0);
    expect(await page.locator('.dp-thanks__tick').evaluate((el) => getComputedStyle(el).strokeDashoffset)).toBe('0px');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await context.addCookies([{ name: 'dp_e6_off', value: '1', url: page.url() }]);
    await page.goto(thanksUrl);
    await expect(page.locator(WOO_CONTENT).first()).toBeVisible();
    await expect(page.locator('[data-dp-thanks]')).toHaveCount(0);
    expect(await page.locator('link[href*="build/thanks"], script[src*="build/thanks"]').count()).toBe(0);
  });

  test('eski motor (engine=legacy): sipariş sonrası teşekkür özeti çalışır, kişi bilgisi yok; bağışçı alanları bozulmaz; vergi beyanı yazılmaz', async ({ page }) => {
    test.setTimeout(240000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const { orderId } = await placeDonation(page, { tax: false, legacy: true });

    const thanks = page.locator('[data-dp-thanks]');
    await expect(thanks).toBeVisible();
    await expect(page.locator(WOO_CONTENT).first()).toBeVisible();
    await expect(thanks.locator('h2')).toHaveText(/thank you|teşekkür/i);
    await expect(thanks.locator('.dp-thanks__amount')).toContainText('125');
    const text = (await thanks.innerText()) + (await thanks.innerHTML());
    for (const secret of [DONOR.name, 'Çağlar', DONOR.email, '7700', DONOR.note, 'Şükrü']) {
      expect(text).not.toContain(secret);
    }
    expect(await axeViolations(page, '[data-dp-thanks]')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

    const meta = await readMeta(page, orderId);
    expect(meta.order._wdp_tax_relief_declared).toBe('');
    expect(meta.items[0].wdp_donor_name).toBe(DONOR.name);
    expect(meta.items[0].wdp_donation_note).toBe(DONOR.note);
    expect(errors).toEqual([]);
  });
});
