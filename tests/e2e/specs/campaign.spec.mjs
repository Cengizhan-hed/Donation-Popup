/**
 * Kampanya (E3): ilerleme kartı, ara hedefler, etki ifadesi, sosyal kanıt — iPhone/Android/masaüstü + axe.
 * Yalnız yerel WP; `npm run e2e:campaign`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const URL = `/?dp_cmp_test=1&dp_product=${PRODUCT}&dp_seed=1`;

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

test.describe('kampanya kartı', () => {
  test('SSR değerleri, ara hedefler, taze veri, tutarlı çubuk, axe', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(URL);
    const card = page.locator('[data-dp-progress]');
    await expect(card).toBeVisible();
    await expect(card.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '40');
    await expect(card.locator('[data-dp-percent]')).toHaveText('40%');
    await expect(card.locator('[data-dp-donors]')).toContainText('12');
    await expect(card.locator('.dp-bar__ms')).toHaveCount(3);
    await expect(card.locator('.dp-bar__ms.is-hit')).toHaveCount(1);
    await expect(card.locator('[data-dp-reached]')).toBeHidden();
    // Çubuk dolgusu son değere ulaşır (animasyon bitince): genişlik ~%40.
    await expect
      .poll(async () => card.locator('.dp-bar__fill').evaluate((el) => Math.round((el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width) * 100)))
      .toBe(40);
    expect(await axeViolations(page, '[data-dp-progress]')).toEqual([]);
    // Yatay taşma yok (mobil dahil).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('azaltılmış harekette dolgu anında son değerde', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    const fill = page.locator('[data-dp-progress] .dp-bar__fill');
    await expect(fill).toBeVisible();
    expect(await fill.evaluate((el) => el.style.getPropertyValue('--p'))).toBe('40');
  });

  test('RTL: çubuk sağdan dolar ve taşma olmaz', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const box = await page.locator('[data-dp-progress] .dp-bar__fill').evaluate((el) => {
      const a = el.getBoundingClientRect();
      const b = el.parentElement.getBoundingClientRect();
      return { fillRight: Math.round(a.right), trackRight: Math.round(b.right) };
    });
    expect(box.fillRight).toBe(box.trackRight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
});

test.describe('REST', () => {
  test('progress: yalnız toplu alanlar; olmayan kampanya 404', async ({ request }) => {
    const ok = await request.get(`/?rest_route=/donation-panel/v1/progress/${PRODUCT}`);
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(Object.keys(body).sort()).toEqual(['currency', 'donors', 'goal', 'milestones', 'percent', 'product_id', 'raised', 'reached', 'remaining']);
    expect(body.percent).toBe(40);
    const missing = await request.get('/?rest_route=/donation-panel/v1/progress/999999');
    expect(missing.status()).toBe(404);
  });

  test('donations: kişi verisi yok; yalnız izinli ad', async ({ page, request }) => {
    await page.goto(URL); // örnek siparişleri oluşturur
    const res = await request.get(`/?rest_route=/donation-panel/v1/donations&product_id=${PRODUCT}&per_page=20`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/example\.test|gizli@|ayse@|Gizli|Kişi/i);
    const body = JSON.parse(text);
    const names = body.items.map((i) => i.name);
    expect(names).toContain('Ayşe Y.');
    expect(names.filter((n) => n === '').length).toBeGreaterThanOrEqual(1);
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(['ago', 'amount', 'date', 'label', 'name']);
    }
    const stats = await (await request.get(`/?rest_route=/donation-panel/v1/donations/stats&product_id=${PRODUCT}`)).json();
    expect(Object.keys(stats).sort()).toEqual(['donors', 'raised', 'today']);
  });
});

test.describe('sosyal kanıt', () => {
  test('tek satır, sayaç şeridi, liste + daha fazla; axe', async ({ page }) => {
    await page.goto(URL);
    await page.goto(URL); // ikinci yükleme: siparişler hazır
    await expect(page.locator('#social-line [data-dp-social="line"]')).toContainText('12');
    await expect(page.locator('#social-counters [data-dp-social="counters"] .dp-social__cell')).toHaveCount(3);
    const feed = page.locator('#social-feed [data-dp-social="feed"]');
    await expect(feed.locator('.dp-list__row')).toHaveCount(1);
    await feed.locator('[data-dp-feed-more]').click();
    await expect(feed.locator('.dp-list__row')).toHaveCount(2);
    await expect(feed).toContainText('Ayşe Y.');
    await expect(feed).not.toContainText('example.test');
    expect(await axeViolations(page, '#social-feed')).toEqual([]);
    expect(await axeViolations(page, '#social-counters')).toEqual([]);
  });
});

test.describe('etki ifadesi', () => {
  test('çip seçilince ifade görünür, yazılan tutarda canlı güncellenir, karşılığı yoksa gizlenir; axe', async ({ page }) => {
    await page.goto(URL);
    const form = page.locator('#form [data-dp-form]');
    await expect(form).toBeVisible();
    const impact = form.locator('.dp-impact');
    // Hazır tutarlar: 10, 25, 50, 1234
    await form.locator('[data-dp-preset="25"]').click();
    await expect(impact).toBeVisible();
    await expect(impact).toContainText('= 1 food parcel');
    await form.locator('[data-dp-preset="50"]').click();
    await expect(impact).toContainText('= 2 food parcels');
    await form.locator('[data-dp-preset="10"]').click();
    await expect(impact).toBeHidden();
    await form.locator('input[name="amount"]').fill('125');
    await expect(impact).toBeVisible();
    await expect(impact).toContainText('= 5 food parcels');
    // Giriş animasyonu bitmeden kontrast ölçülmez (kısmi saydamlık yanlış ihlal üretir).
    await impact.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await axeViolations(page, '#form')).toEqual([]);
  });
});
