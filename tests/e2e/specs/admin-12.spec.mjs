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
  expect((await page.request.get('/?dp_ad_reset=1')).status()).toBe(200);
  for (const name of ['wdp_button_settings', 'wdp_placement_settings', 'wdp_delete_data_on_uninstall', 'dp_ad_palette_mode', 'dp_ad_css_vars']) {
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
  await expect(page.locator('.dpa-status--ok', { hasText: /Guest checkout is on|Misafir ödeme açık/ })).toBeVisible();
  await expect(page.locator('.dpa-ring')).toBeVisible();
  await setOpt(page, 'woocommerce_enable_guest_checkout', 'no');
  await page.goto(P('donation-panel'));
  const warn = page.locator('.dpa-status--warn', { hasText: /Guest checkout is off|Misafir ödeme kapalı/ });
  await expect(warn).toBeVisible();
  await expect(warn.locator('a')).toHaveAttribute('href', /wc-settings&tab=account/);
  await shot(page, info, 'AdminGenel', 'uygulama-uyari');
  await setOpt(page, 'woocommerce_enable_guest_checkout', 'yes');
});

test('renk kaynağı: palet okunamazsa uyarı + Genel Bakış satırı + düğme iki renk seçiciye odaklar; palet varsa uyarı yok', async ({ page }, info) => {
  await setOpt(page, 'dp_ad_palette_mode', 'none');
  await page.goto(P('donation-panel-forms'));
  const note = page.locator('[data-dpa-colors-note="none"]');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/could not be read|okunamad/);
  expect(await axe(page)).toEqual([]);
  await note.locator('[data-dpa-colors-custom]').click();
  await expect(page.locator('#dpa-f-design-colors')).toHaveValue('custom');
  await expect(page.locator('[data-dpa-field="design.brand"]')).toBeFocused();
  await expect(page.locator('[data-dpa-field="design.accent"]')).toBeVisible();
  await shot(page, info, 'AdminFormlar', 'renk-uyari');
  await page.goto(P('donation-panel'));
  await expect(page.locator('.dpa-status--warn', { hasText: /Colors could not be read|Renkler temadan okunamad/ })).toBeVisible();
  await setOpt(page, 'dp_ad_palette_mode', 'good');
  await page.goto(P('donation-panel-forms'));
  await expect(page.locator('[data-dpa-colors-note="theme"]')).toBeVisible();
  await expect(page.locator('[data-dpa-colors-note="none"]')).toHaveCount(0);
  await page.goto(P('donation-panel'));
  await expect(page.locator('.dpa-status--warn', { hasText: /Colors could not be read|Renkler temadan okunamad/ })).toHaveCount(0);
  await setOpt(page, 'dp_ad_palette_mode', 'none');
  await page.goto(P('donation-panel-setup'));
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-colors-note="none"]')).toBeVisible();
  await expect(page.locator('#dpa-w-colors-custom')).toBeChecked();
  await setOpt(page, 'dp_ad_palette_mode', 'good');
  await page.goto(P('donation-panel-setup')); // ilerleme kalıcı: 2. adımda açılır.
  await expect(page.locator('[data-dpa-wstep="2"]')).toBeVisible();
  await expect(page.locator('[data-dpa-colors-note="none"]')).toHaveCount(0);
  await expect(page.locator('#dpa-w-colors-theme')).toBeChecked();
});

/** Ön yüzde uygulanan renk değişkenleri (bağış düğmesinde hesaplanan). */
async function appliedVars(page) {
  await page.goto(`/?p=${process.env.WDP_EXP_PRODUCT_ID}`);
  const btn = page.locator('.donation-panel-trigger').first();
  await expect(btn).toBeVisible();
  return btn.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { primary: cs.getPropertyValue('--dp-color-primary').trim().toLowerCase(), accent: cs.getPropertyValue('--dp-accent').trim().toLowerCase() };
  });
}

/** Renkler bölümündeki kaynak satırları: slot -> { hex, src, source }. */
async function noteRows(page) {
  return page.locator('[data-dpa-when="design.colors=theme"] [data-dpa-color-source]').evaluateAll((rows) => Object.fromEntries(rows.map((r) => {
    const [slot, source] = r.getAttribute('data-dpa-color-source').split(':');
    return [slot, { hex: r.querySelector('code').textContent.trim().toLowerCase(), src: r.querySelector('.dpa-colors-note__src').textContent.trim(), source }];
  })));
}

test('12.3 renk kuralı: yalnız adlı rol renkleri; rol yoksa nötr varsayılan + uyarı; her rengin kaynağı yazılır ve ön yüzde aynısı uygulanır', async ({ page }, info) => {
  test.skip(!process.env.WDP_EXP_PRODUCT_ID, 'ürün yok');
  const cases = [
    // [palet senaryosu, durum, ana renk, ana kaynak, düğme rengi, düğme kaynağı]
    ['good', 'theme', '#1d3557', /Theme palette: primary|Tema paleti: primary/, '#e63946', /Theme palette: accent|Tema paleti: accent/],
    ['roleless', 'none', '#1e2a3b', /^(Default|Varsayılan)$/, '#1e2a3b', /Follows the main color|Ana rengi izler/],
    ['numbered', 'none', '#1e2a3b', /^(Default|Varsayılan)$/, '#1e2a3b', /Follows the main color|Ana rengi izler/],
    ['none', 'none', '#1e2a3b', /^(Default|Varsayılan)$/, '#1e2a3b', /Follows the main color|Ana rengi izler/],
  ];
  for (const [mode, status, primary, primarySrc, accent, accentSrc] of cases) {
    await setOpt(page, 'dp_ad_palette_mode', mode);
    await page.goto(P('donation-panel-forms'));
    await expect(page.locator(`[data-dpa-colors-note="${status}"]`), mode).toBeVisible();
    const rows = await noteRows(page);
    expect(rows.primary.hex, mode).toBe(primary);
    expect(rows.primary.src, mode).toMatch(primarySrc);
    expect(rows.action.hex, mode).toBe(accent);
    expect(rows.action.src, mode).toMatch(accentSrc);
    if (status === 'none') {
      await shot(page, info, 'AdminFormlar', `renk-kaynak-${mode}`);
    }
    await page.goto(P('donation-panel'));
    await expect(page.locator('.dpa-status--warn', { hasText: /Colors could not be read|Renkler temadan okunamad/ }), mode).toHaveCount(status === 'none' ? 1 : 0);
    // Ayarda görünen = uygulanan: ön yüzdeki değişkenler yönetici satırındaki değerlerle aynı (kırmızı "ilk canlı renk" yok).
    const applied = await appliedVars(page);
    expect(applied.primary, mode).toBe(primary);
    expect(applied.accent, mode).toBe(accent);
  }

  // Özel renkler: boş alan uygulanacak kaynağı, dolu alan "Sizin seçiminiz" der; kayıtlı seçim palet değişse de korunur.
  await setOpt(page, 'dp_ad_palette_mode', 'good');
  await page.goto(P('donation-panel-forms'));
  await shot(page, info, 'AdminFormlar', 'renk-kaynak-good');
  await page.selectOption('#dpa-f-design-colors', 'custom');
  const brand = page.locator('#dpa-f-design-brand');
  const brandStatus = page.locator('#dpa-f-design-brand-status');
  const accentStatus = page.locator('#dpa-f-design-accent-status');
  await brand.fill('');
  await page.locator('#dpa-f-design-accent').fill('');
  await expect(brandStatus).toContainText(/Theme palette: primary|Tema paleti: primary/);
  await expect(brandStatus).toContainText('#1d3557');
  await expect(accentStatus).toContainText(/Theme palette: accent|Tema paleti: accent/);
  await brand.fill('#7a1f5c');
  await expect(brandStatus).toContainText(/Source: your choice|Kaynak: sizin seçiminiz/);
  expect(await axe(page)).toEqual([]);
  await shot(page, info, 'AdminFormlar', 'renk-ozel-kaynak');
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  for (const mode of ['good', 'none', 'roleless']) {
    await setOpt(page, 'dp_ad_palette_mode', mode);
    const applied = await appliedVars(page);
    expect(applied.primary, `özel renk ${mode}`).toBe('#7a1f5c');
  }
  expect((await state(page)).settings.design.brand).toBe('#7a1f5c');
});

/** WCAG kontrastı (rgb() dizgeleri). */
function wcag(a, b) {
  const lum = (s) => {
    const [r, g, bl] = s.match(/[\d.]+/g).slice(0, 3).map(Number).map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function saveBrand(page, value) {
  await page.goto(P('donation-panel-forms'));
  await page.selectOption('#dpa-f-design-colors', 'custom');
  await page.fill('#dpa-f-design-brand', value);
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
}

async function triggerColors(page) {
  await page.goto(`/?p=${process.env.WDP_EXP_PRODUCT_ID}`);
  const btn = page.locator('.donation-panel-trigger').first();
  await expect(btn).toBeVisible();
  await page.waitForLoadState('load');
  return btn.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
}

test('renk alanı CSS değişkeni kabul eder: yönetici "sitede çözülecek" der; ön yüzde çözülür, yazı kontrastı ≥4.5; tanımsızsa yedek', async ({ page }, info) => {
  test.skip(!process.env.WDP_EXP_PRODUCT_ID, 'ürün yok');
  await setOpt(page, 'dp_ad_css_vars', '1');
  await page.goto(P('donation-panel-forms'));
  await page.selectOption('#dpa-f-design-colors', 'custom');
  const brand = page.locator('#dpa-f-design-brand');
  const status = page.locator('#dpa-f-design-brand-status');
  // Geçersiz değer: anında uyarı + kayıt reddedilir (CSS enjeksiyonu yok).
  await brand.fill('var(--test-brand);color:red');
  await expect(status).toContainText(/CSS variable|CSS değişkeni/);
  await expect(brand).toHaveAttribute('aria-invalid', 'true');
  await page.click('[data-dpa-save]');
  await expect(page.locator('.dpa-notice--error')).toBeVisible();
  // Değişken yönetici sayfasında tanımlı değil: "sitede çözülecek" bilgisi, renk okunamadı uyarısı yok.
  await brand.fill('var(--test-brand)');
  await expect(status).toContainText(/not defined on this page|bu sayfada tanımlı değil/);
  await expect(brand).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('[data-dpa-colors-note="none"]')).toBeHidden();
  // Yönetici sayfasında tanımlı bir değişken tarayıcıda çözülür ve kontrast uyarısı ona göre verilir.
  await page.evaluate(() => document.documentElement.style.setProperty('--dp-admin-probe', '#ffd60a'));
  await brand.fill('var(--dp-admin-probe)');
  await expect(status).toContainText(/#ffd60a/);
  await expect(status).toContainText(/Low contrast|düşük kontrast/i);
  await brand.fill('var(--test-brand)');
  expect(await axe(page)).toEqual([]);
  await shot(page, info, 'AdminFormlar', 'renk-degisken');
  await page.click('[data-dpa-save]');
  await expect(page.locator('[data-dpa-msg]')).toHaveText(/Saved|Kaydedildi/);
  expect((await state(page)).settings.design.brand).toBe('var(--test-brand)');

  // Ön yüz: değişken temada tanımlı (#ffd60a, açık sarı) -> düğme o renkte, yazı siyah (≥4.5:1).
  let c = await triggerColors(page);
  expect(c.bg).toBe('rgb(255, 214, 10)');
  expect(c.fg).toBe('rgb(0, 0, 0)');
  expect(wcag(c.bg, c.fg)).toBeGreaterThanOrEqual(4.5);

  // Tanımlı koyu değişken -> okunur (beyaz) yazı.
  await saveBrand(page, 'var(--test-ink)');
  c = await triggerColors(page);
  expect(c.bg).toBe('rgb(18, 52, 86)');
  expect(wcag(c.bg, c.fg)).toBeGreaterThanOrEqual(4.5);

  // Tanımsız değişken -> verilen yedek renk.
  await saveBrand(page, 'var(--test-missing, #1d3557)');
  c = await triggerColors(page);
  expect(c.bg).toBe('rgb(29, 53, 87)');
  expect(wcag(c.bg, c.fg)).toBeGreaterThanOrEqual(4.5);
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
  await page.locator('#dpa-c-display-mode-popup').check();
  await page.locator('#dpa-f-form-presets_enabled').check();
  await page.fill('#dpa-f-form-presets', '25, 50, 100');
  await page.fill('#dpa-f-design-button_text', TURKISH);
  await page.locator('#dpa-f-form-dedication').check();
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
  await page.locator('#dpa-f-general-delete_data_on_uninstall').check();
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
  await page.locator('#dpa-c-display-mode-inline').check();
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="3"]')).toBeVisible();
  let st = await state(page);
  expect(st.settings.display.mode).toBe('inline');
  expect(st.settings.admin.wizard_step).toBe(3);
  await page.reload();
  await expect(page.locator('[data-dpa-wstep="3"]')).toBeVisible();
  await page.click('[data-dpa-next]');
  await expect(page.locator('[data-dpa-wstep="4"]')).toBeVisible();
  await page.locator('#dpa-mod-thanks').check();
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
