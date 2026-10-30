/**
 * 12.3 canlı ilerleme çubuğu (yönetici): Bağış Paneli → Kampanyalar → "Kampanya ilerleme çubuğu" bölümü (3 anahtar, her
 * birinin altında açıklama, varsayılan açık), kaydedilen değer = Core ayarı (ön yüz bu ayarı `data-dp-live-cfg` yapılandırmasına
 * yazar: birim + live-progress e2e), Rehber bölümü (ekran yolu + kısa kod + şema + ayara bağlantı), axe WCAG 2.2 AA 0, taşma 0.
 * YALNIZ yerel WP: `npm run e2e:queue -- npm run e2e:admin-e7 -- --env local --spec admin-progress`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const SHOTS = path.join(ROOT, 'build/handoff/RAPOR-123-progress');
const P = (slug) => `/wp-admin/admin.php?page=${slug}`;
const IDS = ['progress.preview', 'progress.count', 'progress.celebrate'];
const dom = (id) => `#dpa-f-${id.replace('.', '-')}`;

test.describe.configure({ mode: 'serial' });

async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async (ctx) => {
      const out = await window.axe.run(ctx, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    where,
  );
}

async function shot(info, locator, name) {
  const dev = info.project.name === 'desktop' ? 'masaustu' : info.project.name;
  fs.mkdirSync(SHOTS, { recursive: true });
  await locator.screenshot({ path: path.join(SHOTS, `${name}-${dev}.png`) });
}

test.beforeEach(async ({ page }) => {
  const r = await page.request.get('/?dp_ad_login=1&role=administrator');
  expect(r.status(), await r.text()).toBe(200);
  expect((await page.request.get('/?dp_ad_reset=1')).status()).toBe(200);
});

test('Kampanyalar: ilerleme çubuğu bölümü, 3 anahtar + açıklama, varsayılan açık; kapat → kaydedilen ayar; axe 0', async ({ page }, info) => {
  await page.goto(P('donation-panel-campaigns'));
  const section = page.locator('#dpa-s-progress');
  await expect(section).toBeVisible();
  await expect(section).toContainText(/Campaign progress bar|Kampanya ilerleme çubuğu/);
  for (const id of IDS) {
    const input = section.locator(dom(id));
    await expect(input).toBeChecked();
    const desc = await input.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    expect((await page.locator(`#${desc}`).textContent()).trim().length).toBeGreaterThan(30);
  }
  expect(await axe(page, '#dpa-s-progress')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(info, section, 'ayar-ilerleme-cubugu');

  await section.locator(dom('progress.preview')).uncheck();
  await section.locator(dom('progress.celebrate')).uncheck();
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  const saved = (await (await page.request.get('/?dp_ad_state=1')).json()).settings.progress;
  expect(saved).toMatchObject({ preview: false, count: true, celebrate: false });
  await page.reload();
  await expect(page.locator(dom('progress.preview'))).not.toBeChecked();
  await expect(page.locator(dom('progress.count'))).toBeChecked();
  await expect(page.locator(dom('progress.celebrate'))).not.toBeChecked();
});

test('Rehber: "Kampanya ilerleme çubuğu" (ekran yolu + kısa kod + şema + ayara bağlantı); axe 0', async ({ page }, info) => {
  await page.goto(P('donation-panel-guide'));
  const guide = page.locator('#dpa-g-progress');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('[donation_panel_progress id="123"]');
  await expect(guide).toContainText(/Campaigns|Kampanyalar/);
  await expect(guide.locator('svg[role="img"][width][height]')).toBeVisible();
  await expect(guide.locator('a[href*="#dpa-s-progress"]')).toBeVisible();
  expect(await axe(page, '#dpa-g-progress')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(info, guide, 'rehber-ilerleme-cubugu');
});
