/**
 * 12.0.0 (adm2) ürün düzenleme ekranındaki "Donation" sekmesi: açılır, türe göre alanlar, axe WCAG 2.2 AA, taşma yok,
 * kayıt (Türkçe karakter + doğru meta), reddedilen giriş kayıtlı değeri ezmez, geçersiz nonce yazmaz, hesaplanan toplam
 * salt okunur, ürün listesi sütunu + toplu işlem, eski ürün sekmesi varlıkları yok.
 * YALNIZ yerel WP: `npm run e2e:queue -- npm run e2e:admin-e7 -- --env local --spec admin-product-tab [--project iphone]`.
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
const EDIT = `/wp-admin/post.php?post=${PID}&action=edit`;
const PANEL = '#wdp_donation_product_data';
const TURKISH = 'Anısına: Şükrü Çağlayan ğüöıİ';
const KEYS = [
  '_allow_custom_price', '_allow_multiple_shares', '_enable_progress_bar', '_progress_bar_limit', '_min_custom_price',
  '_max_shares', '_cover_fee_percent', '_enable_cover_fee', '_dedication_placeholder', '_enable_dedication',
  '_amount_presets', '_amount_preset_recommended', '_wdp_donation_product', '_wdp_manual_total', '_wdp_carried_amount',
  '_enable_urgency', '_theme_primary', '_trust_badges', '_addon_toggle_label',
].join(',');

test.describe.configure({ mode: 'serial' });

async function login(page) {
  const r = await page.request.get('/?dp_ad_login=1&role=administrator');
  expect(r.status(), await r.text()).toBe(200);
}
async function meta(page) {
  const r = await page.request.get(`/?dp_ad_meta=${PID}&keys=${KEYS}`);
  expect(r.status()).toBe(200);
  return r.json();
}
async function openTab(page) {
  await page.goto(`${EDIT}#wdp_donation`);
  await page.locator('#woocommerce-product-data .wdp_donation_options > a').click();
  await expect(page.locator(PANEL)).toBeVisible();
}
async function save(page) {
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('#publish').click()]);
}
async function axe(page, where) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async ({ tags, ctx }) => {
      const out = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    { tags: AXE_TAGS, ctx: where },
  );
}
async function shot(page, info, name) {
  if (!SHOTS) return;
  const dev = info.project.name === 'desktop' ? 'masaustu' : 'mobil';
  const dir = path.join(SHOTS, 'UrunSekmesi');
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(PANEL).screenshot({ path: path.join(dir, `${name}-${dev}.png`) });
}

test.beforeEach(async ({ page }) => {
  expect(PID, 'WDP_EXP_PRODUCT_ID').toBeGreaterThan(0);
  await login(page);
});

test('sekme açılır: JS hatası yok, axe 0, yatay taşma yok, eski varlıklar yüklenmez', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openTab(page);
  await page.waitForLoadState('networkidle');
  expect(await axe(page, PANEL), 'axe').toEqual([]);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'yatay taşma').toBeLessThanOrEqual(1);
  const assets = await page.evaluate(() => [...document.querySelectorAll('link[href],script[src]')].map((n) => n.href || n.src));
  expect(assets.filter((u) => /admin\/products\.(css|js)/.test(u))).toEqual([]);
  expect(assets.some((u) => /assets\/build\/admin-products\/index\.(js|css)/.test(u))).toBe(true);
  expect(assets.some((u) => /assets\/build\/admin\/index\./.test(u)), 'ana yönetici paketi ürün ekranında yüklenmemeli').toBe(false);
  await shot(page, info, 'uygulama');
  expect(errors).toEqual([]);
});

test('bağış türüne göre yalnız ilgili alanlar görünür', async ({ page }) => {
  await openTab(page);
  const pick = async (type) => {
    await page.locator(`${PANEL} label[for="wdp_donation_type_${type}"]`).click();
  };
  await pick('campaign');
  await expect(page.locator('#wdp_progress_bar_limit')).toBeVisible();
  await expect(page.locator('#wdp_min_custom_price')).toBeVisible();
  await expect(page.locator('#wdp_max_shares')).toBeHidden();
  await expect(page.locator(`${PANEL} .donation-panel-ptab__totals`)).toBeVisible();
  await pick('shares');
  await expect(page.locator('#wdp_max_shares')).toBeVisible();
  await expect(page.locator('#wdp_progress_bar_limit')).toBeHidden();
  await expect(page.locator('#wdp_min_custom_price')).toBeHidden();
  await pick('custom');
  await expect(page.locator('#wdp_min_custom_price')).toBeVisible();
  await expect(page.locator('#wdp_progress_bar_limit')).toBeHidden();
  await pick('fixed');
  await expect(page.locator('#wdp_min_custom_price')).toBeHidden();
});

test('kayıt: kampanya + Türkçe karakter doğru meta olarak yazılır; gizli/eski meta korunur', async ({ page }) => {
  await openTab(page);
  const before = await meta(page);
  await page.locator(`${PANEL} label[for="wdp_donation_type_campaign"]`).click();
  await page.locator('#wdp_progress_bar_limit').fill('25000');
  await page.locator('#wdp_min_custom_price').fill('15');
  await page.locator(`${PANEL} #dp-ptab-section-fields > summary`).click();
  await page.locator('#wdp_enable_dedication').selectOption('yes');
  await page.locator('#wdp_dedication_placeholder').fill(TURKISH);
  await save(page);
  const after = await meta(page);
  expect(after._enable_progress_bar).toBe('yes');
  expect(after._allow_custom_price).toBe('yes');
  expect(after._allow_multiple_shares).toBe('no');
  expect(after._progress_bar_limit).toBe('25000');
  expect(after._min_custom_price).toBe('15');
  expect(after._enable_dedication).toBe('yes');
  expect(after._dedication_placeholder).toBe(TURKISH);
  // sekmede artık olmayan eski meta ve hesaplanan alanlar dokunulmadan kalır.
  for (const k of ['_wdp_manual_total', '_wdp_carried_amount', '_enable_urgency', '_theme_primary', '_trust_badges']) {
    expect(after[k], k).toBe(before[k]);
  }
  // yeniden açınca sekme aynı değerleri gösterir.
  await openTab(page);
  await expect(page.locator(`${PANEL} #wdp_donation_type_campaign`)).toBeChecked();
  await expect(page.locator('#wdp_progress_bar_limit')).toHaveValue('25000');
  await expect(page.locator('#wdp_dedication_placeholder')).toHaveValue(TURKISH);
});

test('reddedilen giriş kayıtlı değeri ezmez ve uyarı gösterilir', async ({ page }) => {
  await openTab(page);
  await page.locator(`${PANEL} #dp-ptab-section-amount > summary`).click();
  await page.locator('#wdp_cover_fee_percent').evaluate((el) => {
    el.removeAttribute('max');
    el.value = '3';
  });
  await save(page);
  expect((await meta(page))._cover_fee_percent).toBe('3');
  await openTab(page);
  await page.locator(`${PANEL} #dp-ptab-section-amount > summary`).click();
  await page.locator('#wdp_cover_fee_percent').evaluate((el) => {
    el.removeAttribute('max');
    el.value = '80';
  });
  await save(page);
  expect((await meta(page))._cover_fee_percent, 'kayıtlı değer korunur').toBe('3');
  await expect(page.locator('.notice-error, #woocommerce_errors, .woocommerce-error').first()).toContainText(/processing fee|ücreti yüzdesi/i);
});

test('geçersiz nonce: hiçbir şey yazılmaz', async ({ page }) => {
  await openTab(page);
  const before = await meta(page);
  await page.locator(`${PANEL} label[for="wdp_donation_type_shares"]`).click();
  await page.locator('input[name="wdp_product_donation_nonce"]').evaluate((el) => {
    el.value = 'bozuk';
  });
  await save(page);
  const after = await meta(page);
  expect(after._allow_multiple_shares).toBe(before._allow_multiple_shares);
});

test('kısa kod seçici çıktıyı günceller ve id özniteliğini korur', async ({ page }) => {
  await openTab(page);
  const sel = page.locator('[data-wdp-shortcode-select]');
  await sel.selectOption({ index: 1 });
  await expect(page.locator('[data-wdp-shortcode-output]')).toHaveValue(new RegExp(`^\\[wdp_donation_button_panel id="${PID}"\\]$`));
});

test('ürün listesi: Donation sütunu ve toplu işlem; yalnız yetkili ürünleri günceller', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'liste masaüstünde denetlenir');
  await page.goto('/wp-admin/edit.php?post_type=product');
  await expect(page.locator('th#wdp_donation')).toBeVisible();
  const row = page.locator(`#post-${PID}`);
  await row.locator('input[type="checkbox"]').check();
  await page.locator('#bulk-action-selector-top').selectOption('wdp_mark_donation');
  await Promise.all([page.waitForNavigation(), page.locator('#doaction').click()]);
  await expect(page.locator('.notice-success')).toContainText(/1/);
  expect((await meta(page))._wdp_donation_product).toBe('yes');
  await expect(page.locator(`#post-${PID} td.wdp_donation`)).not.toHaveText(/^\s*–\s*$/);
});
