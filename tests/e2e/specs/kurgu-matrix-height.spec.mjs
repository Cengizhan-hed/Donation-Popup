/**
 * 12.4 compact kart yükseklikleri (YALNIZ yerel WP): sepetli = doğrudan, en kalabalık haller, serbest tutar = sabit fiyat,
 * yönetici tablosu (Compact_Tools::HEIGHTS) ±tolerans. Ortak yardımcılar: helpers/kurgu-matrix.mjs.
 * Çalıştırma: `npm run e2e:queue -- npm run e2e:experiences -- --spec kurgu-matrix-height --env local`.
 */
import { test, expect } from '@playwright/test';
import { IDS, BEHAVIORS, CARD, adminHeights, setBehavior } from '../helpers/kurgu-matrix.mjs';

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
        // En kalabalık haller (beyan + etki ifadesi; serbest tutar + kampanya + etki; sabit fiyat + adet + beyan) aynı yükseklikte.
        for (const behavior of BEHAVIORS) {
          await page.context().clearCookies();
          await setBehavior(page, baseURL, behavior);
          await page.goto(`/?dp_compact=plain&dp_ids=${id}&dp_ctax=1&dp_cimpact=1`);
          const worst = page.locator(`${CARD}[data-dp-ready="1"]`).first();
          await expect(worst).toBeVisible({ timeout: 20000 });
          await page.evaluate(() => document.fonts.ready);
          const h = await worst.evaluate((el) => el.getBoundingClientRect().height);
          expect(Math.abs(h - measured.cart), `${key}/${col}/${behavior}: beyan+etki ${h} ≠ ${measured.cart}`).toBeLessThanOrEqual(0.5);
        }
        if (col > 0) {
          expect(Math.abs(measured.cart - out[key][0]), `${key}/${col}: ${measured.cart} ≠ serbest tutar ${out[key][0]}`).toBeLessThanOrEqual(0.5);
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
