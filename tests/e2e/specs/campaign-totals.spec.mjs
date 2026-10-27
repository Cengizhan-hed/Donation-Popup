/**
 * 12-e kampanya toplamları (yalnız yerel WP): Kampanyalar ekranında devreden tutar + "Yeniden hesapla"
 * (tarih aralığı -> ÖNİZLEME [yazmaz] -> "Uygula" [günlüklü]). axe WCAG 2.2 AA, mobil taşma, ekran görüntüsü.
 * `npm run e2e:queue -- node tests/e2e/run-campaign-totals.mjs --env local [--project iphone]`
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHOTS = process.env.WDP_ADM_SHOTS || '';
const PID = Number(process.env.WDP_EXP_PRODUCT_ID || 0);
const PAGE = '/wp-admin/admin.php?page=donation-panel-campaigns';

test.describe.configure({ mode: 'serial' });

async function login(page) {
  const r = await page.request.get('/?dp_ad_login=1&role=administrator');
  expect(r.status(), await r.text()).toBe(200);
}
async function seed(page) {
  const r = await page.request.get(`/?dp_cs_seed=1&product=${PID}`);
  expect(r.status(), await r.text()).toBe(200);
}
async function state(page) {
  return (await page.request.get(`/?dp_cs_state=1&product=${PID}`)).json();
}
async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async (tags) => {
      const out = await window.axe.run('.dpa', { runOnly: { type: 'tag', values: tags } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    AXE_TAGS,
  );
}
async function shot(page, info, name) {
  if (!SHOTS) return;
  const dev = info.project.name === 'desktop' ? 'masaustu' : 'mobil';
  const dir = path.join(SHOTS, 'Kampanyalar');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${dev}.png`), fullPage: true });
}

test.beforeEach(async ({ page }) => {
  expect(PID, 'WDP_EXP_PRODUCT_ID').toBeGreaterThan(0);
  await login(page);
  await seed(page);
});

test('liste: devreden tutar, başlangıç, Yeniden hesapla düğmesi; mobilde taşma yok; axe 0', async ({ page }, info) => {
  await page.goto(PAGE);
  const input = page.locator(`[data-dpa-carried="${PID}"]`);
  await expect(input).toHaveValue('1000');
  const btn = page.locator(`[data-dpa-recalc-open="${PID}"]`);
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box.height, 'dokunma alanı >= 44px').toBeGreaterThanOrEqual(43.5);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'yatay taşma').toBeLessThanOrEqual(1);
  expect(await axe(page)).toEqual([]);
  await shot(page, info, 'uygulama');
});

test('önizleme yazmaz; uygula yazar, günlüğe düşer, listeyi günceller', async ({ page }, info) => {
  await page.goto(PAGE);
  const before = await state(page);
  expect(before.stored).toBe(1120);

  await page.locator(`[data-dpa-recalc-open="${PID}"]`).click();
  const row = page.locator(`[data-dpa-recalc="${PID}"]`);
  await expect(row).toBeVisible();
  await expect(row.locator('[data-dpa-recalc-apply]')).toBeDisabled();
  await row.locator('[data-dpa-recalc-preview]').click();
  const result = row.locator('[data-dpa-recalc-result]');
  await expect(result).toBeVisible();
  await expect(row.locator('[data-dpa-r="computed"]')).toContainText(/1[.,\s]?200/);
  await expect(row.locator('[data-dpa-r="orders"]')).toHaveText('2');
  await expect(row.locator('[data-dpa-recalc-apply]')).toBeEnabled();

  const mid = await state(page);
  expect(mid.stored, 'önizleme hiçbir şey yazmaz').toBe(1120);
  expect(mid.log.length).toBe(0);
  expect(await axe(page)).toEqual([]);
  await shot(page, info, 'onizleme');

  await row.locator('[data-dpa-recalc-apply]').click();
  await expect(page.locator('[data-dpa-notices]')).toContainText(/updated|güncellen/i);
  const after = await state(page);
  expect(after.stored).toBe(1200);
  expect(after.log.length).toBe(1);
  expect(after.log[0].type).toBe('recalc');
  expect(after.log[0].old).toBe(1120);
  expect(after.log[0].new).toBe(1200);
  await expect(page.locator(`[data-dpa-stored="${PID}"]`)).toContainText(/1[.,\s]?200/);
});

test('devreden tutar kaydı saklanan toplamı aynı farkla kaydırır ve günlüğe düşer', async ({ page }) => {
  await page.goto(PAGE);
  const input = page.locator(`[data-dpa-carried="${PID}"]`);
  await input.fill('1500');
  await page.locator(`[data-dpa-carried-save="${PID}"]`).click();
  await expect(page.locator('[data-dpa-notices]')).toContainText(/carried|devreden/i);
  const s = await state(page);
  expect(s.carried).toBe(1500);
  expect(s.stored).toBe(1620);
  expect(s.log.at(-1).type).toBe('carried');
});

test('yetkisiz kullanıcı uçlara erişemez; nonce olmadan reddedilir', async ({ page, browser }) => {
  await login(page);
  const noNonce = await page.request.post(`/?rest_route=/donation-panel/v1/admin/campaigns/${PID}/recalc/preview`, { data: {} });
  expect([401, 403]).toContain(noNonce.status());
  const ctx = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const anon = await ctx.request.post(`/?rest_route=/donation-panel/v1/admin/campaigns/${PID}/carried`, { data: { amount: 1 } });
  expect([401, 403]).toContain(anon.status());
  expect((await state(page)).carried).toBe(1000);
  await ctx.close();
});
