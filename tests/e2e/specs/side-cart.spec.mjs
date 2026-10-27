/**
 * Yan sepet (E4): yeni + eski motor x iPhone/Android/masaüstü — açılış, ekleme sonrası açılış, ithaf/hissedar satırı,
 * miktar, kaldırma, ödemeye gidiş, odak tuzağı/Esc, dokunma boyutu, RTL, axe.
 * YALNIZ yerel WP: `npm run e2e:side-cart [-- --project iphone]`; uzak yok.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const DEDICATION = 'Anneannem Şükriye İğdır için';
const SHARES = 'Çağlar Öztürk,Ayşe Yılmaz';
const NARROW = 639.98;

const q = (extra = '') => `/?dp_sc_test=1${extra}`;
const addUrl = (extra = '') => `/?dp_sc_add=${PRODUCT}${extra}`;

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} extra Ek sorgu.
 * @return {Promise<string[]>} Sayfa hataları (dizi, test sonunda boş olmalı).
 */
async function load(page, extra = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(q(extra));
  await expect(page.locator('[data-dp-sc-open]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-dp-sc][data-dp-sc-mounted="1"]')).toHaveCount(1);
  return errors;
}

/**
 * Sepete bağış ekler (eski sepet öğesi sözleşmesi; iki motorda aynı).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} extra Ek sorgu.
 */
async function addDonation(page, extra = '') {
  const response = await page.request.get(addUrl(extra));
  expect(response.status()).toBe(200);
  expect((await response.json()).ok).toBe(true);
}

/**
 * Ekleme olayı (WooCommerce blok olayı) ile açar.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function fireAdded(page) {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true })));
  await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
}

test.describe('yan sepet', () => {
  test('boş sepet: tetikleyici, sayaç gizli, açılır, boş durum, Esc kapatır ve odak döner', async ({ page }) => {
    const errors = await load(page);
    await expect(page.locator('[data-dp-sc-count]').first()).toBeHidden();
    const trigger = page.locator('[data-dp-sc-open]');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.dp-sc__empty')).toBeVisible();
    await expect(page.locator('[data-dp-sc-go]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('ekleme sonrası açılış: ithaf + hissedar adları (Türkçe), tutar, sayaç, ödemeye gidiş', async ({ page }) => {
    const errors = await load(page);
    await addDonation(page, `&amount=75&dedication=${encodeURIComponent(DEDICATION)}&shares=${encodeURIComponent(SHARES)}`);
    await fireAdded(page);
    const row = page.locator('[data-dp-sc-line]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(DEDICATION);
    await expect(row).toContainText('Çağlar Öztürk, Ayşe Yılmaz');
    await expect(row).toContainText('75');
    await expect(page.locator('.dp-sc__subtotal')).toContainText('75');
    await expect(page.locator('[data-dp-sc-count]').first()).toHaveText('1');
    // Hisse bağışında miktar değiştirilmez; kaldırma vardır.
    await expect(page.locator('[data-dp-sc-qty]')).toHaveCount(0);
    await expect(page.locator('[data-dp-sc-remove]')).toHaveCount(1);
    await page.locator('[data-dp-sc-go]').click();
    await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
    await expect(page.locator('body')).toContainText('75');
    expect(errors).toEqual([]);
  });

  test('miktar artır/azalt ve kaldır: Store API ile sepet eşleşir, boş duruma döner', async ({ page }) => {
    await load(page);
    await addDonation(page, '&amount=40');
    await fireAdded(page);
    const row = page.locator('[data-dp-sc-line]');
    await expect(row).toHaveAttribute('data-qty', '1');
    await expect(page.locator('[data-dp-sc-qty="-1"]')).toBeDisabled();
    await page.locator('[data-dp-sc-qty="1"]').click();
    await expect(row).toHaveAttribute('data-qty', '2');
    await expect(page.locator('.dp-sc__subtotal')).toContainText('80');
    let cart = await (await page.request.get('/?rest_route=/wc/store/v1/cart')).json();
    expect(cart.items[0].quantity).toBe(2);
    await page.locator('[data-dp-sc-qty="-1"]').click();
    await expect(row).toHaveAttribute('data-qty', '1');
    await page.locator('[data-dp-sc-remove]').click();
    await expect(page.locator('.dp-sc__empty')).toBeVisible();
    await expect(page.locator('[data-dp-sc-count]').first()).toBeHidden();
    cart = await (await page.request.get('/?rest_route=/wc/store/v1/cart')).json();
    expect(cart.items).toHaveLength(0);
  });

  test('yerleşim: dar ekranda alttan panel, geniş ekranda yan panel; RTL ters yön', async ({ page }) => {
    await load(page);
    await addDonation(page, '&amount=30');
    await fireAdded(page);
    await page.waitForTimeout(900);
    const surface = page.locator('[data-dp-sc-surface]');
    const box = await surface.boundingBox();
    const vp = page.viewportSize();
    if (vp.width <= NARROW) {
      expect(Math.abs(box.y + box.height - vp.height)).toBeLessThan(2);
      expect(box.width).toBeGreaterThan(vp.width - 2);
    } else {
      expect(Math.abs(box.x + box.width - vp.width)).toBeLessThan(2);
      expect(box.width).toBeLessThan(vp.width / 2);
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
      });
      await page.locator('[data-dp-sc-open]').click();
      await page.waitForTimeout(900);
      const rtl = await surface.boundingBox();
      expect(rtl.x).toBeLessThan(2);
    }
  });

  test('odak tuzağı, dokunma boyutu ≥44 px ve sabit ödeme düğmesi görünür', async ({ page }) => {
    await load(page);
    await addDonation(page, '&amount=30');
    await fireAdded(page);
    await page.waitForTimeout(700);
    const surface = page.locator('[data-dp-sc-surface]');
    for (let i = 0; i < 9; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('[data-dp-sc-surface]')));
      expect(inside).toBe(true);
    }
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-dp-sc-surface] button, [data-dp-sc-surface] a[href], [data-dp-sc-open]').forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.height > 0 && (r.height < 43.5 || r.width < 43.5)) {
          out.push(`${node.tagName}.${node.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
      return out;
    });
    expect(small).toEqual([]);
    await expect(page.locator('[data-dp-sc-go]')).toBeInViewport();
    await expect(surface).toBeVisible();
  });

  test('axe WCAG 2.2 AA: 0 hata (dolu sepet)', async ({ page }) => {
    await load(page);
    await addDonation(page, `&amount=30&dedication=${encodeURIComponent(DEDICATION)}`);
    await fireAdded(page);
    await page.waitForTimeout(800);
    await page.evaluate(AXE);
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      return axe.run(document.querySelector('[data-dp-sc-surface]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    });
    const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    expect(summary).toEqual([]);
  });
});

test.describe('yan sepet: yeni motorun kendi ekleme yolu', () => {
  test('REST cart/add sonrası olay çekmeceyi açar ve satırı gösterir', async ({ page }) => {
    await page.goto('/?dp_sc_test=1');
    await expect(page.locator('[data-dp-sc-open]')).toBeVisible({ timeout: 20000 });
    const nonce = (await (await page.request.get('/?rest_route=/donation-panel/v1/nonce')).json()).nonce;
    const post = await page.request.post('/?rest_route=/donation-panel/v1/cart/add', {
      data: {
        product_id: Number(PRODUCT),
        amount: '125',
        donation_full_name: 'Çağlar Öztürk',
        donation_phone: '+44 7700 900123',
        submission_key: `sc-${Date.now()}`,
      },
      headers: { 'X-WP-Nonce': nonce },
    });
    expect(post.status(), await post.text()).toBe(200);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('donation-panel:cart-added')));
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await expect(page.locator('[data-dp-sc-line]')).toHaveCount(1);
    await expect(page.locator('.dp-sc__subtotal')).toContainText('125');
  });
});

test.describe('yan sepet: ek bağış önerisi ve tasarım görüntüsü (yeni tasarım)', () => {
  test('öneri kartı: tek dokunuşla ek bağış eklenir, satır sayısı ve toplam güncellenir', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/?dp_sc_test=1');
    await expect(page.locator('[data-dp-sc-open]')).toBeVisible({ timeout: 20000 });
    const add = await page.request.get(`/?dp_sc_add=${PRODUCT}&amount=40&name=Ayse`);
    expect((await add.json()).ok).toBe(true);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true })));
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    const suggest = page.locator('[data-dp-sc-suggest]');
    await expect(suggest).toHaveCount(2);
    expect(await suggest.first().evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43.5);
    await suggest.first().click();
    await expect(page.locator('[data-dp-sc-line]')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('[data-dp-sc-sub]')).toContainText(/2/);
    await expect(page.locator('[data-dp-sc-suggest]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('tasarım görüntüsü (yalnız WDP_UI2_SHOTS ile)', async ({ page }, testInfo) => {
    test.skip(!process.env.WDP_UI2_SHOTS, 'yalnız ekran görüntüsü toplama koşusunda');
    await page.goto('/?dp_sc_test=1');
    await expect(page.locator('[data-dp-sc-open]')).toBeVisible({ timeout: 20000 });
    await page.request.get(`/?dp_sc_add=${PRODUCT}&amount=1000&shares=${encodeURIComponent('Ahmet Yılmaz,Ayşe Yılmaz')}`);
    await page.request.get(`/?dp_sc_add=${PRODUCT}&amount=500&dedication=${encodeURIComponent('Anneannem için')}`);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true })));
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await page.waitForTimeout(900);
    const name = testInfo.project.name === 'desktop' ? 'masaustu' : 'mobil';
    await page.screenshot({ path: path.join(process.env.WDP_UI2_SHOTS, 'YanSepet', `uygulama-${name}.png`) });
  });
});
