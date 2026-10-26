/**
 * Onaylı tasarım ekran görüntüleri (yalnız WDP_SHOTS_DIR verilince): Main (tutar), Bilgiler, Masaustu (yan panel).
 * Yerel WP; `WDP_SHOTS_DIR=<klasör> npm run e2e:experiences -- --env local --spec experiences-shots`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.WDP_SHOTS_DIR || '';
const PRODUCTS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');

test.skip(!DIR, 'WDP_SHOTS_DIR yok');

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} kind Kap.
 * @param {number|string} id Ürün.
 */
async function open(page, kind, id) {
  await page.goto(`/?dp_exp_test=${kind}&dp_product=${id}`);
  await expect(page.locator('[data-dp-exp][data-dp-mounted="1"]')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-dp-open]').click();
  await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
  await page.waitForTimeout(900);
}

test('ekran: tutar seçimi (Main)', async ({ page }, info) => {
  fs.mkdirSync(DIR, { recursive: true });
  await open(page, 'popup', PRODUCTS.campaign || PRODUCTS.custom);
  await page.screenshot({ path: path.join(DIR, `main-${info.project.name}.png`) });
});

test('ekran: bilgiler (Bilgiler)', async ({ page }, info) => {
  fs.mkdirSync(DIR, { recursive: true });
  await open(page, 'popup', PRODUCTS.campaign || PRODUCTS.custom);
  await page.locator('[data-dp-preset]').nth(2).click();
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill('Ayşe Yılmaz');
  await page.locator('input[name="donation_phone"]').fill('532 000 00 00');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, `bilgiler-${info.project.name}.png`) });
});

test('ekran: hisseli yan panel (Masaustu)', async ({ page }, info) => {
  fs.mkdirSync(DIR, { recursive: true });
  await open(page, 'side_panel', PRODUCTS.shares || PRODUCTS.fixed);
  await page.locator('[data-dp-qty="1"]').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(DIR, `masaustu-${info.project.name}.png`) });
});
