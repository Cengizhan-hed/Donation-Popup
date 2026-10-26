/**
 * 12.0.0 yönetici (adm): tek menü (WooCommerce altında eklenti girişi 0), alt sayfalar, Genel Bakış durum kutusu +
 * misafir ödeme uyarısı, modül anahtarları (REST), alan kaydı + eski seçenek yansıtması, sihirbaz (kalıcı ilerleme),
 * eski adres yönlendirmesi, yetki/nonce, axe WCAG 2.2 AA, mobil taşma, ekran görüntüleri.
 * YALNIZ yerel WP: `npm run e2e:queue -- npm run e2e:admin-e7 -- --env local --spec admin-12 [--project iphone]`.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SHOTS = process.env.WDP_ADM_SHOTS || '';
const P = (slug) => `/wp-admin/admin.php?page=${slug}`;
const PAGES = {
  overview: ['donation-panel', 'AdminGenel'],
  campaigns: ['donation-panel-campaigns', 'AdminKampanyalar'],
  forms: ['donation-panel-forms', 'AdminFormlar'],
  checkout: ['donation-panel-checkout', 'AdminSepet'],
  account: ['donation-panel-account', 'AdminHesap'],
  privacy: ['donation-panel-privacy', 'AdminGizlilik'],
  tools: ['donation-panel-tools', 'AdminAraclar'],
  guide: ['donation-panel-guide', 'AdminRehber'],
};
const TURKISH = 'Bağışınız için çok teşekkürler: şğüıİöç ÇŞĞÜÖ';

test.describe.configure({ mode: 'serial' });

async function login(page, role = 'administrator') {
  const r = await page.request.get(`/?dp_ad_login=1&role=${role}`);
  expect(r.status(), await r.text()).toBe(200);
}
async function reset(page) {
  expect((await page.request.get('/?dp_ad_reset=1&ui=new')).status()).toBe(200);
  for (const name of ['wdp_button_settings', 'wdp_placement_settings', 'wdp_delete_data_on_uninstall']) {
    await page.request.get(`/?dp_ad_opt=${name}&del=1`);
  }
}
async function setOpt(page, name, value) {
  const r = await page.request.get(`/?dp_ad_opt=${name}&val=${encodeURIComponent(JSON.stringify(value))}`);
  expect(r.status()).toBe(200);
}
async function state(page) {
  const r = await page.request.get('/?dp_ad_state=1');
  return r.json();
}
async function axe(page, where = '.dpa') {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async ({ tags, ctx }) => {
      const out = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    { tags: AXE_TAGS, ctx: where },
  );
}
async function noOverflow(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'yatay taşma').toBeLessThanOrEqual(1);
}
async function shot(page, info, folder, name = 'uygulama') {
  if (!SHOTS) return;
  const dev = info.project.name === 'desktop' ? 'masaustu' : 'mobil';
  const dir = path.join(SHOTS, folder);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${dev}.png`), fullPage: false });
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await reset(page);
});

test('tek menü: üst düzey "Donation Panel", alt sayfalar sırayla, WooCommerce altında giriş yok', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'menü yapısı masaüstünde denetlenir');
  await page.goto(P('donation-panel'));
  const top = page.locator('#adminmenu > li.menu-top:has(> a[href$="page=donation-panel"])');
  await expect(top).toHaveCount(1);
  const subs = await top.locator('.wp-submenu li:not(.wp-submenu-head) a').evaluateAll((els) => els.map((a) => new URL(a.href).searchParams.get('page')));
  expect(subs).toEqual(Object.values(PAGES).map((v) => v[0]));
  // WooCommerce menüsü altında hiçbir eklenti girişi yok.
  const woo = await page.locator('#toplevel_page_woocommerce .wp-submenu a').evaluateAll((els) => els.map((a) => a.getAttribute('href') || ''));
  expect(woo.filter((h) => /donation-panel|wdp-popup-settings|wdp_/.test(h))).toEqual([]);
  // Sihirbaz menüde görünmez ama açılır.
  expect(subs).not.toContain('donation-panel-setup');
});

for (const [key, [slug, folder]] of Object.entries(PAGES)) {
  test(`sayfa ${key}: açılır, JS hatası yok, axe 0, taşma yok`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(P(slug));
    await expect(page.locator('.dpa')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await axe(page), 'axe').toEqual([]);
    await noOverflow(page);
    await shot(page, info, folder);
    expect(errors).toEqual([]);
  });
}

test('eski adres wdp-popup-settings yeni Genel Bakış sayfasına yönlenir', async ({ page }) => {
  await page.goto('/wp-admin/admin.php?page=wdp-popup-settings');
  await expect(page).toHaveURL(/page=donation-panel$/);
  await expect(page.locator('.dpa-title')).toBeVisible();
});

test('Genel Bakış: durum kutusu; misafir ödeme kapalıysa uyarı', async ({ page }, info) => {
  await setOpt(page, 'woocommerce_enable_guest_checkout', 'yes');
  await page.goto(P('donation-panel'));
  await expect(page.locator('.dpa-status--ok', { hasText: /Guest checkout is on/ })).toBeVisible();
  await expect(page.locator('.dpa-ring')).toBeVisible();
  await setOpt(page, 'woocommerce_enable_guest_checkout', 'no');
  await page.goto(P('donation-panel'));
  const warn = page.locator('.dpa-status--warn', { hasText: /Guest checkout is off/ });
  await expect(warn).toBeVisible();
  await expect(warn.locator('a')).toHaveAttribute('href', /wc-settings&tab=account/);
  await shot(page, info, 'AdminGenel', 'uygulama-uyari');
  await setOpt(page, 'woocommerce_enable_guest_checkout', 'yes');
});

test('modül anahtarı REST ile kaydedilir ve kalıcıdır', async ({ page }) => {
  await page.goto(P('donation-panel'));
  const sw = page.locator('#dpa-mod-social_proof');
  const was = await sw.isChecked();
  const resp = page.waitForResponse((r) => r.url().includes('/admin/settings') && r.request().method() === 'POST');
  await sw.click();
  expect((await resp).status()).toBe(200);
  const st = await state(page);
  expect(st.settings.modules.social_proof).toBe(!was);
  await page.reload();
  expect(await page.locator('#dpa-mod-social_proof').isChecked()).toBe(!was);
});

test('Formlar: kaydet; Türkçe bozulmaz; eski seçenek yansıtılır; geçersiz tutar reddedilir', async ({ page }) => {
  await page.goto(P('donation-panel-forms'));
  await page.locator('#dpa-c-display-mode-popup').check({ force: true });
  await page.locator('#dpa-f-form-presets_enabled').check({ force: true });
  await page.fill('#dpa-f-form-presets', '25, 50, 100');
  await page.fill('#dpa-f-design-button_text', TURKISH);
  await page.locator('#dpa-f-form-dedication').check({ force: true });
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  const st = await state(page);
  expect(st.settings.display.mode).toBe('popup');
  expect(st.settings.design.button_text).toBe(TURKISH);
  expect(st.options.button.popup_button_text).toBe(TURKISH);
  expect(st.options.button.enable_amount_presets).toBe('1');
  expect(st.options.button.amount_presets).toBe('25, 50, 100');
  expect(st.options.button.enable_dedication).toBe('1');
  expect(st.options.placement.display).toBe('button_popup');

  await page.fill('#dpa-f-form-presets', '25, abc');
  await page.click('[data-dpa-save]');
  await expect(page.locator('.dpa-notice--error')).toBeVisible();
  const after = await state(page);
  expect(after.settings.form.presets).toBe('25, 50, 100');
});

test('Formlar: eski seçenekte kayıtlı değer yeni ekranda görünür (kayıp yok)', async ({ page }) => {
  await setOpt(page, 'wdp_button_settings', { enable_dedication: '1', popup_button_text: TURKISH, amount_presets: '10, 20' });
  await setOpt(page, 'wdp_placement_settings', { display: 'inline', auto_place: 'no' });
  await page.goto(P('donation-panel-forms'));
  await expect(page.locator('#dpa-f-form-dedication')).toBeChecked();
  await expect(page.locator('#dpa-f-design-button_text')).toHaveValue(TURKISH);
  await expect(page.locator('#dpa-f-form-presets')).toHaveValue('10, 20');
  await expect(page.locator('#dpa-c-display-mode-inline')).toBeChecked();
  await expect(page.locator('#dpa-f-placement-auto_place')).not.toBeChecked();
});

test('Araçlar: veri silme anahtarı onay ister ve kaydedilir', async ({ page }) => {
  await page.goto(P('donation-panel-tools'));
  page.once('dialog', (d) => d.accept());
  await page.locator('#dpa-f-general-delete_data_on_uninstall').check({ force: true });
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  const st = await state(page);
  expect(st.settings.general.delete_data_on_uninstall).toBe(true);
  expect(String(st.options.delete)).toBe('1');
});

test('sihirbaz: adımlar kaydedilir, ilerleme kalıcı, bitirince tamamlandı yazılır', async ({ page }, info) => {
  await page.goto(P('donation-panel-setup'));
  await expect(page.locator('[data-dpa-wstep="1"]')).toBeVisible();
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="2"]')).toBeVisible();
  await shot(page, info, 'AdminSihirbaz');
  await page.locator('#dpa-c-display-mode-inline').check({ force: true });
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="3"]')).toBeVisible();
  let st = await state(page);
  expect(st.settings.display.mode).toBe('inline');
  expect(st.settings.admin.wizard_step).toBe(3);
  await page.reload();
  await expect(page.locator('[data-dpa-wstep="3"]')).toBeVisible();
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="4"]')).toBeVisible();
  await page.locator('#dpa-mod-thanks').check({ force: true });
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="5"]')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.click('[data-dpa-finish]');
  await expect(page).toHaveURL(/page=donation-panel$/);
  st = await state(page);
  expect(st.settings.admin.wizard).toBe('done');
  expect(st.settings.modules.thanks).toBe(true);
});

test('sihirbaz atlanabilir', async ({ page }) => {
  await page.goto(P('donation-panel-setup'));
  await page.click('[data-dpa-skip]');
  await expect(page).toHaveURL(/page=donation-panel$/);
  expect((await state(page)).settings.admin.wizard).toBe('skipped');
});

test('yetki ve nonce: abone sayfayı açamaz; REST yazma nonce/oturum olmadan reddedilir', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'yetki desktop');
  const anon = await browser.newContext({ baseURL: info.project.use.baseURL });
  const ar = await anon.request.post('/?rest_route=/donation-panel/v1/admin/settings', { data: { modules: { thanks: true } } });
  expect([401, 403]).toContain(ar.status());
  await anon.close();
  const noNonce = await page.request.post('/?rest_route=/donation-panel/v1/admin/settings', { data: { modules: { thanks: true } } });
  expect([401, 403]).toContain(noNonce.status());
  await login(page, 'subscriber');
  const r = await page.goto(P('donation-panel'));
  expect(r.status()).toBeGreaterThanOrEqual(400);
});

test('varlıklar yalnız kendi ekranlarında yüklenir', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'varlık kapsamı desktop');
  await page.goto('/wp-admin/index.php');
  expect(await page.locator('link[href*="build/admin/index"], script[src*="build/admin/index"]').count()).toBe(0);
  await page.goto(P('donation-panel'));
  expect(await page.locator('script[src*="build/admin/index"]').count()).toBe(1);
  expect(await page.locator('script[src*="jquery"]').count()).toBeGreaterThanOrEqual(0);
});

test('mobilde Kampanyalar ve Formlar kullanılabilir (dokunma hedefi ≥44px)', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'mobil');
  await page.goto(P('donation-panel-forms'));
  const small = await page.locator('.dpa button, .dpa .dpa-input, .dpa .dpa-btn').evaluateAll((els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43).map((e) => e.className));
  expect(small).toEqual([]);
  await noOverflow(page);
});
