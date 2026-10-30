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
    await expect(page.locator('.donation-panel-sc__empty')).toBeVisible();
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
    await expect(page.locator('.donation-panel-sc__subtotal')).toContainText('75');
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
    await expect(page.locator('.donation-panel-sc__subtotal')).toContainText('80');
    let cart = await (await page.request.get('/?rest_route=/wc/store/v1/cart')).json();
    expect(cart.items[0].quantity).toBe(2);
    await page.locator('[data-dp-sc-qty="-1"]').click();
    await expect(row).toHaveAttribute('data-qty', '1');
    await page.locator('[data-dp-sc-remove]').click();
    await expect(page.locator('.donation-panel-sc__empty')).toBeVisible();
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
    await expect(page.locator('.donation-panel-sc__subtotal')).toContainText('125');
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

  test('yüzen düğme: sepet boşken gizli ve istek yok; bağış eklenince belirir, sayfalar arası kalır, "başka bağış ekle" vurgular', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => {
      if (/donation-panel\/v1\/side-cart|wc\/store/.test(r.url())) {
        calls.push(r.url());
      }
    });
    const errors = await load(page);
    const fab = page.locator('[data-dp-sc-fab]');
    await expect(fab).toHaveCount(1);
    await expect(fab).toBeHidden();
    // Boş sepet: sayfa yüklendikten sonra boşta bile Store/REST isteği yok.
    await page.waitForTimeout(2500);
    expect(calls).toEqual([]);

    await addDonation(page, '&amount=60');
    await page.goto(q('&p=2'));
    await expect(fab).toBeVisible({ timeout: 15000 });
    await expect(fab.locator('[data-dp-sc-count]')).toHaveText('1');
    await expect(fab).not.toHaveClass(/is-entering/);
    // Güvenli alan içinde, sağ altta.
    const box = await fab.boundingBox();
    const vp = page.viewportSize();
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    expect(box.width).toBeGreaterThanOrEqual(44);

    // Başka eklentinin yüzen öğesi çekmecenin altında kalır (dialog üst katmanı).
    await page.evaluate(() => {
      const fake = document.createElement('div');
      fake.id = 'fake-float';
      fake.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
      document.body.appendChild(fake);
    });
    await fab.click();
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await page.waitForTimeout(700);
    const topInDrawer = await page.evaluate(() => {
      const surface = document.querySelector('[data-dp-sc-surface]');
      const r = surface.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + 30);
      return Boolean(el && surface.contains(el));
    });
    expect(topInDrawer).toBe(true);
    expect(await page.locator('[data-dp-sc-overlay]').evaluate((el) => el.matches(':modal'))).toBe(true);

    await page.locator('.donation-panel-sc__bar [data-dp-sc-close]').click();
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toHaveCount(0);
    await expect(fab).toHaveClass(/is-pulse/);
    expect(errors).toEqual([]);
  });

  test('12.3 hareket: çekmece tek yönlü kayar, katman kaymaz, sayfa yana kaymaz, yalnız transform/opacity', async ({ page }) => {
    const errors = await load(page);
    const rec = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const body0 = document.body.getBoundingClientRect();
          const frames = [];
          const t0 = performance.now();
          const loop = () => {
            const s = document.querySelector('.donation-panel-sc__surface');
            const o = document.querySelector('[data-dp-sc-overlay]');
            const r = s.getBoundingClientRect();
            const b = document.body.getBoundingClientRect();
            frames.push({ t: performance.now() - t0, x: r.x, y: r.y, w: r.width, osl: o.scrollLeft + o.scrollTop, dx: Math.abs(b.x - body0.x), dw: Math.abs(b.width - body0.width) });
            if (performance.now() - t0 < 700) requestAnimationFrame(loop);
            else resolve(frames);
          };
          document.querySelector('[data-dp-sc-open]').click();
          requestAnimationFrame(loop);
        })
    );
    const open = rec.filter((f) => f.w > 0);
    const end = open[open.length - 1];
    const dist = open.map((f) => Math.hypot(f.x - end.x, f.y - end.y));
    let reversals = 0;
    for (let i = 1; i < dist.length; i += 1) if (dist[i] > dist[i - 1] + 0.75) reversals += 1;
    expect(reversals, 'hedeften uzaklaşan kare').toBe(0);
    expect(dist[0], 'açılış animasyonu').toBeGreaterThan(5);
    expect(Math.max(...rec.map((f) => f.osl)), 'katman kaydırıldı').toBe(0);
    expect(Math.max(...rec.map((f) => f.dx + f.dw)), 'sayfa kaydı/daraldı').toBeLessThanOrEqual(0.5);
    const settled = open.find((f, i) => dist.slice(i).every((d) => d < 1));
    expect(settled.t).toBeLessThanOrEqual(340);
    const props = await page.evaluate(() => {
      const list = (el, p) => getComputedStyle(el, p).transitionProperty.split(',').map((x) => x.trim());
      const o = document.querySelector('[data-dp-sc-overlay]');
      return { surface: list(document.querySelector('.donation-panel-sc__surface')), overlay: list(o), scrim: list(o, '::before') };
    });
    for (const p of props.surface) expect(['transform', 'opacity']).toContain(p);
    for (const p of props.overlay) expect(['visibility']).toContain(p);
    for (const p of props.scrim) expect(['opacity']).toContain(p);
    expect(errors).toEqual([]);
  });

  test('12.3 ayarda görünen = uygulanan: yüzen düğme açık/kapalı + köşe, ek bağış önerisi ayardan (ürün, tutarlar, kısa satır)', async ({ page }) => {
    const set = async (value) => {
      const r = await page.request.get(`/?dp_sc_set=${encodeURIComponent(JSON.stringify(value))}`);
      expect((await r.json()).ok).toBe(true);
    };
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await set({ floating: true, position: 'start', suggest: false });
      await page.goto(q());
      // `name` WordPress sorgu değişkeni olduğundan yanıt durumu 404 olabilir; ekleme sonucu JSON'dan okunur.
      const added = await page.request.get(addUrl('&amount=60&name=Ayse'));
      expect((await added.json()).ok).toBe(true);
      await page.goto(q('&p=2'));
      const fab = page.locator('[data-dp-sc-fab]');
      await expect(fab).toBeVisible({ timeout: 15000 });
      const vp = page.viewportSize();
      let box = await fab.boundingBox();
      expect(box.x + box.width / 2, 'sol alt köşe').toBeLessThan(vp.width / 2);
      expect(box.x).toBeGreaterThanOrEqual(0);

      await set({ floating: true, position: 'end', suggest: false });
      await page.goto(q('&dp_v=3'));
      await expect(fab).toBeVisible({ timeout: 15000 });
      box = await fab.boundingBox();
      expect(box.x + box.width / 2, 'sağ alt köşe').toBeGreaterThan(vp.width / 2);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

      // Öneri kapalı: kart yok.
      await fab.click();
      await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
      await expect(page.locator('[data-dp-sc-line]')).toHaveCount(1, { timeout: 15000 });
      await expect(page.locator('[data-dp-sc-suggest]')).toHaveCount(0);

      // Öneri açık: ayardaki ürün, tutarlar ve kısa satır; yüzen düğme kapalı.
      const other = (await (await page.request.get('/?dp_sc_other=1')).json()).id;
      expect(other).toBeGreaterThan(0);
      await set({ floating: false, position: 'end', suggest: true, suggest_product: other, suggest_amounts: '25, 75', suggest_hint: 'Küçük bir katkı, büyük bir dua' });
      await page.goto(q('&dp_v=4'));
      await expect(page.locator('[data-dp-sc][data-dp-sc-mounted="1"]')).toHaveCount(1);
      await expect(page.locator('[data-dp-sc-fab]'), 'yüzen düğme kapalı').toHaveCount(0);
      await page.evaluate(() => document.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true })));
      await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
      const suggest = page.locator('[data-dp-sc-suggest]');
      await expect(suggest).toHaveCount(2, { timeout: 15000 });
      expect(await suggest.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-amount'))))).toEqual([25, 75]);
      expect(await suggest.first().getAttribute('data-product')).toBe(String(other));
      await expect(page.locator('.donation-panel-sc__suggest-hint')).toHaveText('Küçük bir katkı, büyük bir dua');
      await suggest.last().click();
      await expect(page.locator('[data-dp-sc-line]')).toHaveCount(2, { timeout: 15000 });
      await expect(page.locator('[data-dp-sc-suggest]')).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await set({});
    }
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
