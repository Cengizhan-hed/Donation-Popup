/**
 * Yönetici deneyimi (E7): iPhone/Android/masaüstü — sade ayar ekranı (kaydet/yükle, modül anahtarları, önizleme, klavye),
 * kurulum sihirbazı (ürün oluşturmaz), rehber + yardım sekmeleri, yetki/nonce, varlık kapsamı, eski ekran varsayılanı, RTL, axe WCAG 2.2 AA.
 * YALNIZ yerel WP: `npm run e2e:admin-e7 [-- --project iphone]`; uzak yok. Oturum yalnız yerel test uç noktasıyla açılır.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SETTINGS = '/wp-admin/admin.php?page=donation-panel';
const WIZARD = '/wp-admin/admin.php?page=donation-panel-setup';
const GUIDE = '/wp-admin/admin.php?page=donation-panel-guide';
const OPT = 'donation_panel_settings';
const TURKISH = 'Bağışınız için çok teşekkürler: şğüıİöç ÇŞĞÜÖ';

test.describe.configure({ mode: 'serial' });

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {'administrator'|'subscriber'} role Rol.
 * @return {Promise<void>}
 */
async function login(page, role = 'administrator') {
  const r = await page.request.get(`/?dp_ad_login=1&role=${role}`);
  expect(r.status(), await r.text()).toBe(200);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {'new'|'legacy'} ui Ekran seçimi.
 * @return {Promise<void>}
 */
async function reset(page, ui = 'new') {
  const r = await page.request.get(`/?dp_ad_reset=1&ui=${ui}`);
  expect(r.status()).toBe(200);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{settings: Record<string, any>, legacy: Record<string, string>, products: number}>} Durum.
 */
async function state(page) {
  const r = await page.request.get('/?dp_ad_state=1');
  expect(r.status()).toBe(200);
  return r.json();
}

/**
 * Yalnız eklentimizin bölgesinde axe (WP çekirdek menüsü/çubuğu kapsam dışı).
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} where Seçici.
 * @return {Promise<string[]>} İhlaller.
 */
async function axe(page, where = '.dpa') {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(
    async ({ tags, ctx }) => {
      const out = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      return out.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
    },
    { tags: AXE_TAGS, ctx: where },
  );
  return res;
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<void>}
 */
async function noOverflow(page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, 'yatay taşma').toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await reset(page, 'new');
});

test('ayar ekranı açılır, sekmeler klavyeyle gezilir, önizleme modüle uyar, taşma yok', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(SETTINGS);
  await expect(page.locator('h1.dpa-title')).toHaveText(/Donation Panel|Bağış Paneli/);
  await expect(page.locator('[data-dpa-panel="general"]')).toBeVisible();
  await expect(page.locator('[data-dpa-panel="modules"]')).toBeHidden();

  await page.locator('#dpa-tab-general').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#dpa-tab-modules')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-dpa-panel="modules"]')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#dpa-tab-advanced')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.locator('#dpa-tab-general')).toHaveAttribute('aria-selected', 'true');

  await page.locator('#dpa-tab-modules').click();
  const block = page.locator('[data-dpa-preview="tax_relief"]');
  const sw = page.locator('#dpa-mod-tax_relief');
  await expect(sw).not.toBeChecked();
  await expect(block).toBeHidden();
  await sw.check();
  await expect(block).toBeVisible();
  await expect(page.locator('[data-dpa-msg]')).not.toHaveText('');
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('ayarlar kaydedilir ve kalıcıdır; Türkçe karakter bozulmaz; eski ayarlar değişmez', async ({ page }) => {
  const before = await state(page);
  await page.goto(`${SETTINGS}#modules`);
  await page.locator('#dpa-tab-modules').click();
  await page.locator('#dpa-mod-social_proof').check();
  await page.locator('#dpa-mod-impact').check();
  await page.locator('#dpa-tab-general').click();
  await page.selectOption('#dpa-engine', 'new');
  await page.locator('#dpa-tab-details').click();
  await page.fill('#dpa-thanks-message', TURKISH);
  await page.fill('#dpa-impact-map', '25 = 1 gıda kolisi|gıda kolisi');
  await page.locator('.dpa-save').click();
  await expect(page.locator('#setting-error-settings_updated, .notice-success').first()).toBeVisible();

  const after = await state(page);
  expect(after.settings.modules.social_proof).toBe(true);
  expect(after.settings.modules.impact).toBe(true);
  expect(after.settings.experiences.engine).toBe('new');
  expect(after.settings.thanks.message).toBe(TURKISH);
  expect(after.settings.impact.map).toContain('gıda kolisi');
  expect(after.settings.admin.ui).toBe('new');
  expect(after.settings.version).toBe(before.settings.version);
  expect(after.legacy, 'eski wdp_* seçenekleri değişmemeli').toEqual(before.legacy);
  expect(after.products, 'ürün oluşturulmamalı').toBe(before.products);

  // Yeniden yükle: değerler formda.
  await page.goto(SETTINGS);
  await page.locator('#dpa-tab-modules').click();
  await expect(page.locator('#dpa-mod-social_proof')).toBeChecked();
  await page.locator('#dpa-tab-details').click();
  await expect(page.locator('#dpa-thanks-message')).toHaveValue(TURKISH);
});

test('klasik ekrana geri dönüş: ayar kaydedilir, yeni ekran kaybolur, klasik ekran açılır', async ({ page }) => {
  await page.goto(SETTINGS);
  await page.locator('#dpa-tab-advanced').click();
  await page.selectOption('#dpa-ui', 'legacy');
  await page.locator('.dpa-save').click();
  await expect.poll(async () => (await state(page)).settings.admin.ui).toBe('legacy');
  const gone = await page.goto(SETTINGS);
  expect(gone.status()).toBe(403);
  const classic = await page.goto('/wp-admin/admin.php?page=wdp-popup-settings');
  expect(classic.status()).toBe(200);
});

test('varsayılan ESKİ ekran: yeni menü yok, yeni varlık yok', async ({ page }) => {
  await reset(page, 'legacy');
  const r = await page.goto('/wp-admin/admin.php?page=wdp-popup-settings');
  expect(r.status()).toBe(200);
  expect(await page.locator('a[href*="page=donation-panel"]').count()).toBe(0);
  const html = await page.content();
  expect(html).not.toContain('donation-panel-admin');
  const denied = await page.goto(SETTINGS);
  expect(denied.status()).toBe(403);
});

test('yönetici varlıkları yalnız kendi ekranlarında', async ({ page }) => {
  for (const url of ['/wp-admin/index.php', '/wp-admin/admin.php?page=wdp-popup-settings', '/wp-admin/admin.php?page=wc-settings', '/wp-admin/plugins.php']) {
    await page.goto(url);
    const html = await page.content();
    expect(html, url).not.toContain('donation-panel-admin-css');
    expect(html, url).not.toContain('src/Admin/assets/admin');
  }
  for (const url of [SETTINGS, GUIDE, WIZARD]) {
    await page.goto(url);
    const html = await page.content();
    expect(html, url).toContain('src/Admin/assets/admin.css');
    expect(html, url).toContain('src/Admin/assets/admin.js');
  }
});

test('sihirbaz: amaç → varsayılan → ürün (oluşturmaz) → bitir; ayarlar yazılır', async ({ page }) => {
  const before = await state(page);
  await page.goto(SETTINGS);
  await expect(page.locator('.dpa-prompt')).toBeVisible();
  await page.goto(WIZARD);
  await expect(page.locator('[data-dpa-step="0"]')).toBeVisible();
  await expect(page.locator('[data-dpa-step="1"]')).toBeHidden();
  await page.locator('input[name="goal"][value="campaign"]').check();
  await page.locator('[data-dpa-next]').click();
  await expect(page.locator('[data-dpa-step="1"]')).toBeVisible();
  await expect(page.locator('[data-dpa-back]')).toBeVisible();
  await page.locator('[data-dpa-next]').click();
  await expect(page.locator('[data-dpa-step="2"]')).toBeVisible();
  await expect(page.locator('[data-dpa-step="2"] a[href*="post_type=product"]')).toBeVisible();
  await page.locator('[data-dpa-next]').click();
  await expect(page.locator('[data-dpa-step="3"]')).toBeVisible();
  await expect(page.locator('[data-dpa-finish]')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.locator('[data-dpa-finish]').click();
  await expect(page).toHaveURL(/page=donation-panel/);
  const after = await state(page);
  expect(after.settings.admin.wizard).toBe('done');
  expect(after.settings.modules.campaign).toBe(true);
  expect(after.settings.modules.impact).toBe(true);
  expect(after.settings.modules.donor_account).toBe(false);
  expect(after.settings.experiences.engine).toBe('legacy');
  expect(after.products, 'sihirbaz ürün oluşturmamalı').toBe(before.products);
  expect(after.legacy).toEqual(before.legacy);
  await expect(page.locator('.dpa-prompt')).toHaveCount(0);
});

test('sihirbaz atlanır: modüller değişmez', async ({ page }) => {
  await page.goto(WIZARD);
  await page.locator('[data-dpa-skip]').click();
  await expect(page).toHaveURL(/page=donation-panel/);
  const s = await state(page);
  expect(s.settings.admin.wizard).toBe('skipped');
  expect(Object.keys(s.settings.modules ?? {})).toEqual([]);
  await expect(page.locator('.dpa-prompt')).toHaveCount(0);
});

test('rehber ve WordPress yardım sekmeleri', async ({ page }) => {
  await page.goto(GUIDE);
  for (const id of ['placing', 'modules', 'trouble', 'currency', 'privacy']) {
    await expect(page.locator(`#dpa-g-${id}`)).toBeVisible();
  }
  await expect(page.locator('.dpa-code code').first()).toHaveText('[wdp_donation_button_panel]');
  expect(await axe(page)).toEqual([]);
  await page.goto(SETTINGS);
  await page.locator('#contextual-help-link').click();
  await expect(page.locator('#tab-link-donation-panel-trouble')).toBeAttached();
  await expect(page.locator('#tab-panel-donation-panel-trouble')).toBeAttached();
});

test('yetki ve nonce: abone erişemez, nonce yoksa yazılmaz', async ({ page }) => {
  const before = await state(page);
  const nonceless = await page.request.post('/wp-admin/admin-post.php', { form: { action: 'donation_panel_wizard', wizard_result: 'done', goal: 'regular' }, maxRedirects: 0 });
  expect([403, 400]).toContain(nonceless.status());
  const optNonce = await page.request.post('/wp-admin/options.php', { form: { option_page: 'donation_panel', action: 'update', [`${OPT}[_form]`]: '1', [`${OPT}[modules][thanks]`]: '1' }, maxRedirects: 0 });
  expect([403, 400]).toContain(optNonce.status());
  const same = await state(page);
  expect(same.settings).toEqual(before.settings);

  // Abone: ekran 403 ve yazma yok.
  const sub = await page.context().browser().newContext({ baseURL: test.info().project.use.baseURL });
  const sp = await sub.newPage();
  await login(sp, 'subscriber');
  const r = await sp.goto(SETTINGS);
  expect(r.status()).toBe(403);
  const post = await sp.request.post('/wp-admin/admin-post.php', { form: { action: 'donation_panel_wizard', wizard_result: 'done', goal: 'regular' }, maxRedirects: 0 });
  expect([403, 400]).toContain(post.status());
  await sub.close();
  expect((await state(page)).settings).toEqual(before.settings);
});

const CLASSIC = '/wp-admin/admin.php?page=wdp-popup-settings';

test('E8Q geçiş: eski ekranda kutu → "yeni ekranı aç" (POST) → yeni ekran → "klasik ekrana dön" → eski ekran; yalnız admin.ui değişir; axe 0', async ({ page }) => {
  await reset(page, 'legacy');
  await page.goto(CLASSIC); // ilk yönetim isteği (eklenti göçleri) bitsin; karşılaştırma bundan sonra.
  const before = await state(page);
  await page.goto(CLASSIC);
  const box = page.locator('.wdp-ui-switch');
  await expect(box).toBeVisible();
  await expect(box).toContainText(/Donation Panel|Bağış Paneli/);
  expect(await box.locator('a').count(), 'geçiş GET bağlantısı olmamalı').toBe(0);
  expect(await axe(page, '.wdp-ui-switch')).toEqual([]);
  await noOverflow(page);

  await box.locator('button.button-primary').click();
  await page.waitForURL(/page=donation-panel/);
  await expect(page.locator('#dpa-settings')).toBeVisible();
  const mid = await state(page);
  expect(mid.settings.admin.ui).toBe('new');
  expect(mid.legacy, 'eski ayarlar değişmez').toEqual(before.legacy);
  await expect(page.locator('#dpa-back-classic')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await noOverflow(page);

  await page.locator('#dpa-back-classic').click();
  await page.waitForURL(/page=wdp-popup-settings/);
  await expect(page.locator('.wdp-ui-switch')).toBeVisible();
  const end = await state(page);
  expect(end.settings.admin.ui).toBe('legacy');
  expect(end.legacy).toEqual(before.legacy);
  expect(end.products).toBe(before.products);
});

test('E8Q geçiş: kutu kapatılır (kullanıcı başına), yenilemede dönmez; nonce yoksa ekran değişmez; eklentiler listesi bağlantısı etkin ekrana gider', async ({ page }) => {
  await reset(page, 'legacy');
  await page.goto(CLASSIC);
  await page.locator('.wdp-ui-switch button:not(.button-primary)').click();
  await page.waitForURL(/page=wdp-popup-settings/);
  await expect(page.locator('.wdp-ui-switch')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.wdp-ui-switch')).toHaveCount(0);
  expect((await state(page)).settings.admin.ui).toBe('legacy');

  const nonceless = await page.request.post('/wp-admin/admin-post.php', { form: { action: 'donation_panel_switch_ui', ui: 'new' }, maxRedirects: 0 });
  expect([403, 400]).toContain(nonceless.status());
  expect((await state(page)).settings.admin.ui).toBe('legacy');

  await page.goto('/wp-admin/plugins.php');
  const legacyLink = page.locator('tr[data-plugin$="woo-donation-popup.php"] .settings a[href*="page=wdp-popup-settings"]');
  await expect(legacyLink).toHaveCount(1);
  await reset(page, 'new');
  await page.goto('/wp-admin/plugins.php');
  await expect(page.locator('tr[data-plugin$="woo-donation-popup.php"] .settings a[href*="page=donation-panel"]')).toHaveCount(1);
});

test('erişilebilirlik (axe WCAG 2.2 AA): her sekme', async ({ page }) => {
  await page.goto(SETTINGS);
  for (const id of ['general', 'modules', 'details', 'advanced']) {
    await page.locator(`#dpa-tab-${id}`).click();
    expect(await axe(page), id).toEqual([]);
  }
});

test('RTL: yön rtl, taşma yok, kaydet çubuğu görünür', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'dp_ad_rtl', value: '1', url: baseURL }]);
  await page.goto(SETTINGS);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await noOverflow(page);
  await expect(page.locator('.dpa-save')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await context.clearCookies({ name: 'dp_ad_rtl' });
});

test('mobil: dokunma hedefleri ve kaydet düğmesi erişilebilir', async ({ page }, info) => {
  await page.goto(SETTINGS);
  await page.locator('#dpa-tab-modules').click();
  const box = await page.locator('#dpa-tab-modules').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const save = await page.locator('.dpa-save').boundingBox();
  expect(save.height).toBeGreaterThanOrEqual(40);
  await noOverflow(page);
  if (/iphone|android/.test(info.project.name)) {
    const vp = page.viewportSize();
    expect(save.x + save.width).toBeLessThanOrEqual(vp.width + 1);
  }
});
