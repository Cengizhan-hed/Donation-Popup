/**
 * 12.3 canlı kampanya ilerleme çubuğu — iPhone / Android / masaüstü. YALNIZ yerel WP (sipariş yalnız bu geçici WP'de):
 *   npm run e2e:queue -- node tests/e2e/run-live-progress.mjs --env local
 *
 * Kapsam: tutar seç/değiştir/sil (aynı sayfada birden çok çubuk), sepete ekle (iyimser + Store API), yeniden yükle
 * ("sepetinizde"), yan sepetten çıkar, ödeme sonrası tek istekle gerçek toplam + birleşme, 0 bağış, hedefe ulaşmış
 * kampanya, ekran dışı → ekrana girince dolum + sayım, azaltılmış hareket, ayarlar (önizleme/sayma kapalı), compact kart
 * (yükseklik sabit), katman kapanınca önizleme düşer, CLS 0, erişilebilirlik (progressbar + duyuru + axe), kare şeridi.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const SHOTS = path.join(ROOT, 'build/handoff/RAPOR-123-progress');
const PRODUCT = Number(process.env.WDP_EXP_PRODUCT_ID || '0');
const FIXED = Number(process.env.WDP_EXP_FIXED_ID || '0');
const SHOTS2 = path.join(ROOT, 'build/handoff/RAPOR-123-progress2');
/** Eklentinin çubuk paketi (betik dosyası; stil satır içi). */
const PROGRESS_JS = /\/assets\/build\/progress\/index\.js\?ver=[A-Za-z0-9._-]+$/;

const url = (raised, parts = 'card,inline', extra = '') => `/?dp_lp=1&dp_product=${PRODUCT}&dp_raised=${raised}&dp_parts=${parts}${extra}`;
const card = (page) => page.locator('#lp-card [data-dp-live-cfg]');
const form = (page) => page.locator('#lp-inline [data-dp-live-cfg]');
const num = (text) => Number(String(text).replace(/[^0-9]/g, ''));

/**
 * Sayfa hatalarını toplar (çubuk paketini beklemeden: döngü/liste sayfasında paket yüklemede yoktur).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {string[]} Hatalar (canlı dizi).
 */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // WebKit yerel http sunucuda ön alma isteklerini reddeder ("URL must be secure"). 12.3 fix'ten beri eklenti `<link
  // rel="prefetch">` basmaz (form bellekte); ileti WordPress çekirdeğinin bağlantı ön alması (speculative loading) gibi
  // eklenti dışı kaynaklardan gelir — ortam notu, hata sayılmaz.
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|Prefetch request denied: URL must be secure/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

/**
 * Sayfadaki çubuk paketi durumu.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{js: boolean, css: boolean, live: boolean, cfg: number}>} Durum.
 */
const packageState = (page) =>
  page.evaluate(() => ({
    js: Boolean(document.getElementById('donation-panel-progress-js')) || Array.from(document.scripts).some((s) => /\/assets\/build\/progress\//.test(s.src)),
    css: Boolean(document.getElementById('donation-panel-inline-progress')),
    live: Boolean(window.__donationPanelLiveProgress),
    cfg: document.querySelectorAll('[data-dp-live-cfg]').length,
  }));

/**
 * Sayfayı açar; çubuk betiği bağlanana dek bekler; sayfa hatalarını ve düzen kaymalarını toplar.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} target Adres.
 * @return {Promise<string[]>} Hatalar.
 */
async function open(page, target) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.addInitScript(() => {
    window.__lpShift = 0;
    window.__lpShiftSources = [];
    window.__lpFontsAt = Infinity;
    // Tema web yazı tipi değişimi (font-display: swap) tüm metni kaydırır; eklentiye ait değildir, ayrı tutulur.
    document.fonts.ready.then(() => {
      window.__lpFontsAt = performance.now();
    });
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          window.__lpShift += entry.value;
          (entry.sources || []).forEach((src) => {
            const n = src.node;
            const a = src.previousRect;
            const b = src.currentRect;
            const label = n && n.nodeType === 1 ? `${n.tagName}.${n.className}[${Object.keys(n.dataset).join(',')}]` : String(n && n.nodeName);
            window.__lpShiftSources.push(`${label} x${Math.round(a.x)}→${Math.round(b.x)} y${Math.round(a.y)}→${Math.round(b.y)} w${Math.round(a.width)}→${Math.round(b.width)} t${Math.round(entry.startTime)}`);
          });
        }
      });
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(target);
  await page.waitForFunction(() => Boolean(window.__donationPanelLiveProgress));
  // İkinci yükleme: tema web yazı tipi önbellekte (yazı tipi değişimi kayması ölçümü bozmaz; sayım/taze veri kayması görünür).
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__donationPanelLiveProgress));
  return errors;
}

/**
 * Yükleme sonrası kaymaları ayırır: buradan sonrası yalnız çubuk etkileşiminin kaymasıdır (0 olmalı). Yüklemedeki
 * kaymalarda çubuk öğesi kaynak olamaz.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 */
async function settleShift(page) {
  await page.waitForFunction(() => window.__lpFontsAt < Infinity);
  await page.waitForTimeout(1000);
  // Yazı tipi yüklenip yerleşene dek (≤150 ms) olan kaymalar temanındır; sonrası eklentinin (sayım, taze veri).
  const sources = await page.evaluate(() =>
    window.__lpShiftSources.filter((s) => Number(s.slice(s.lastIndexOf(' t') + 2)) > window.__lpFontsAt + 150).join(' | ')
  );
  expect(sources, 'yüklemede çubuk kaynaklı kayma').not.toMatch(/dpLive|live__|progress__|camp__|compact__camp|compact__nums|compact__meta/);
  await page.evaluate(() => {
    window.__lpShift = 0;
    window.__lpShiftSources = [];
  });
}

/**
 * Bir katmanın (dolum ya da önizleme) iz içinde görünen genişliği (%), LTR/RTL bağımsız.
 *
 * @param {import('@playwright/test').Locator} el Katman.
 * @return {Promise<number>} Yüzde.
 */
const visible = (el) =>
  el.evaluate((node) => {
    const a = node.getBoundingClientRect();
    const b = node.parentElement.getBoundingClientRect();
    return Math.round((Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) / b.width) * 100);
  });

/**
 * Sayfa içi formda tutar yazar (bağışçı eylemi).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} value Tutar.
 */
async function typeAmount(page, value) {
  await typeInto(page, page.locator('#lp-inline input[name="amount"]:not([type="hidden"])'), value);
}

/**
 * Gerçek tuş girişi (dokunma/klavye gibi): tarayıcı girdiye bağlı kaymayı bağışçı eylemi sayar.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').Locator} input Alan.
 * @param {string} value Tutar ('' = sil).
 */
async function typeInto(page, input, value) {
  await input.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  if (value) {
    await input.pressSequentially(value);
  }
}

test.describe('canlı kampanya çubuğu', () => {
  test.beforeEach(() => {
    test.skip(!PRODUCT, 'test ürünü yok');
    test.setTimeout(90000);
  });

  test('tutar seç/değiştir/sil: aynı sayfadaki iki çubukta önizleme, gerçek dolum değişmez, CLS 0, duyuru', async ({ page }, info) => {
    const errors = await open(page, url(400));
    await expect(card(page).locator('[data-dp-live-pct]')).toHaveText(/40/);
    await expect(form(page).locator('[data-dp-live-pct]')).toHaveText(/40/);
    await expect.poll(() => visible(card(page).locator('.donation-panel-live__fill'))).toBe(40);
    const heights = await page.evaluate(() => Array.from(document.querySelectorAll('[data-dp-live-cfg]')).map((el) => el.getBoundingClientRect().height));
    await settleShift(page);

    await typeAmount(page, '100');
    for (const bar of [card(page), form(page)]) {
      await expect(bar).toHaveClass(/is-preview/);
      await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/50/);
      await expect(bar.locator('.donation-panel-live__note')).toHaveText(/100.*500|500.*100/);
      await expect.poll(() => visible(bar.locator('.donation-panel-live__pv'))).toBe(50);
      await expect.poll(() => visible(bar.locator('.donation-panel-live__fill'))).toBe(40);
      await expect(bar.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '40');
    }
    // Kısa, seyrek ekran okuyucu duyurusu.
    await expect(form(page).locator('[role="status"]')).toHaveText(/500/, { timeout: 3000 });
    if (info.project.name === 'desktop' || info.project.name === 'iphone') {
      fs.mkdirSync(SHOTS, { recursive: true });
      await typeAmount(page, '');
      await expect(form(page)).not.toHaveClass(/is-preview/);
      await page.waitForTimeout(500);
      await typeAmount(page, '350');
      for (const ms of [0, 120, 260, 480]) {
        await page.waitForTimeout(ms === 0 ? 0 : 120);
        await form(page).screenshot({ path: path.join(SHOTS, `${info.project.name}-onizleme-${String(ms).padStart(3, '0')}ms.png`), animations: 'allow' });
      }
    }
    await typeAmount(page, '250');
    await expect(form(page).locator('[data-dp-live-pct]')).toHaveText(/65/);
    await expect.poll(() => visible(card(page).locator('.donation-panel-live__pv'))).toBe(65);

    await typeAmount(page, '');
    for (const bar of [card(page), form(page)]) {
      await expect(bar).not.toHaveClass(/is-preview/);
      await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/40/);
      await expect(bar.locator('[data-dp-live-meta]')).not.toHaveClass(/is-preview/);
    }
    const after = await page.evaluate(() => Array.from(document.querySelectorAll('[data-dp-live-cfg]')).map((el) => el.getBoundingClientRect().height));
    expect(after).toEqual(heights);
    expect(await page.evaluate(() => window.__lpShift), await page.evaluate(() => window.__lpShiftSources.join(' | '))).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('sepete ekle → "sepetinizde"; yeniden yükle (Store API) → kalır; yan sepetten çıkar → tüm çubuklarda kaybolur', async ({ page }) => {
    const errors = await open(page, url(400));
    await typeAmount(page, '100');
    await expect(form(page)).toHaveClass(/is-preview/);
    // Sepete ekleme (yerel sim; eklentinin sepet öğesi sözleşmesi), sonra formun yaydığı olay.
    const added = await page.request.get(`/?dp_lp_add=${PRODUCT}&amount=100`);
    expect((await added.json()).ok).toBe(true);
    const storeCalls = [];
    page.on('request', (r) => r.url().includes('wc/store/v1/cart') && r.method() === 'GET' && storeCalls.push(r.url()));
    await page.evaluate((id) => {
      const formEl = document.querySelector('#lp-inline [data-dp-form]');
      document.dispatchEvent(new CustomEvent('donation-panel:cart-added', { detail: { productId: id, amount: 100 } }));
      formEl.dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: id, amount: 0 } }));
    }, PRODUCT);
    await typeAmount(page, '');
    for (const bar of [card(page), form(page)]) {
      await expect(bar).toHaveClass(/is-in-cart/);
    }
    await expect.poll(() => storeCalls.length).toBeGreaterThanOrEqual(1);
    const inCart = num(await form(page).locator('.donation-panel-live__note').textContent());
    expect(inCart).toBeGreaterThan(0);

    // Yeniden yükle: önizleme yalnız Woo sepet çerezi varken, tarayıcıda Store API'den gelir (sunucu HTML'inde yok).
    const html = await (await page.request.get(url(400))).text();
    expect(html).not.toMatch(/class="[^"]*\b(is-in-cart|is-preview)\b|<i class="donation-panel-live__pv/);
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__donationPanelLiveProgress));
    await expect(card(page)).toHaveClass(/is-in-cart/, { timeout: 15000 });
    await expect(form(page)).toHaveClass(/is-in-cart/);

    // Yan sepetten çıkar: Store API yanıtı paylaşılır, iki çubuk da anında küçülür (ek sepet isteği yok).
    await page.locator('[data-dp-sc-open], [data-dp-sc-fab]').first().click();
    const remove = page.locator('[data-dp-sc-remove]').first();
    await expect(remove).toBeVisible({ timeout: 15000 });
    const before = storeCalls.length;
    await remove.click();
    for (const bar of [card(page), form(page)]) {
      await expect(bar).not.toHaveClass(/is-preview/, { timeout: 15000 });
    }
    // En çok yan sepetin kendi Store API nonce isteği (GET cart); çubuk modülü ek sepet isteği yapmaz.
    expect(storeCalls.length - before).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('ödeme sonrası: tek istekle gerçek yeni toplam, önizleme gerçek dolumla birleşir', async ({ page }) => {
    const errors = await open(page, url(400));
    await typeAmount(page, '50');
    await expect(card(page)).toHaveClass(/is-preview/);
    const calls = [];
    page.on('request', (r) => r.url().includes('donation-panel/v1/progress/') && calls.push(r.url()));
    const order = await page.request.get(`/?dp_lp_order=${PRODUCT}&amount=50`);
    expect((await order.json()).ok).toBe(true);
    await page.evaluate((id) => {
      document.querySelector('#lp-inline [data-dp-form]').dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: id, amount: 0 } }));
      document.dispatchEvent(new CustomEvent('donation-panel:progress-refresh', { detail: { productId: id, amount: 50 } }));
    }, PRODUCT);
    for (const bar of [card(page), form(page)]) {
      await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/45/, { timeout: 15000 });
      await expect(bar).not.toHaveClass(/is-preview/);
    }
    await expect.poll(() => visible(form(page).locator('.donation-panel-live__fill'))).toBe(45);
    await expect.poll(async () => num(await card(page).locator('[data-dp-live-raised]').textContent())).toBe(450);
    expect(calls.filter((u) => u.includes('_=')).length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('0 bağış: "ilk bağışı siz yapın", yüzde ve bağışçı yok; önizleme yine çalışır', async ({ page }) => {
    const errors = await open(page, url(0));
    await expect(card(page).locator('[data-dp-live-zero="show"]')).toBeVisible();
    await expect(card(page).locator('[data-dp-live-zero="hide"]')).toBeHidden();
    await expect(card(page).locator('[data-dp-live-donors]')).toBeHidden();
    await expect(form(page).locator('[data-dp-live-zero="show"]')).toBeVisible();
    await expect(card(page).locator('[data-dp-live-raised]')).toHaveText(/0/);
    await settleShift(page);
    await typeAmount(page, '100');
    await expect(form(page)).toHaveClass(/is-preview/);
    await expect.poll(() => visible(form(page).locator('.donation-panel-live__pv'))).toBe(10);
    expect(await page.evaluate(() => window.__lpShift), await page.evaluate(() => window.__lpShiftSources.join(' | '))).toBe(0);
    expect(errors).toEqual([]);
  });

  test('hedefe ulaşmış: rozet, tam dolum, kutlama bir kez; önizleme gösterilmez', async ({ page }) => {
    const errors = await open(page, url(1000));
    await expect(card(page)).toHaveClass(/is-complete/);
    await expect(card(page).locator('[data-dp-reached]')).toBeVisible();
    await expect.poll(() => visible(card(page).locator('.donation-panel-live__fill'))).toBe(100);
    await expect(card(page)).toHaveClass(/is-celebrate/, { timeout: 5000 });
    await expect(card(page)).not.toHaveClass(/is-celebrate/, { timeout: 5000 });
    await expect(page.locator('.donation-panel-live__shine')).toHaveCount(0);
    await typeAmount(page, '100');
    await page.waitForTimeout(400);
    await expect(form(page)).not.toHaveClass(/is-preview/);
    expect(errors).toEqual([]);
  });

  test('ekran dışı: bekler (is-wait), ekrana girince dolar ve rakam sayarak artar', async ({ page }, info) => {
    const errors = await open(page, url(400, 'spacer,card'));
    await expect(card(page)).toHaveClass(/is-wait/);
    await page.evaluate(() => {
      window.__lpTexts = [];
      const node = document.querySelector('#lp-card [data-dp-live-raised]');
      new MutationObserver(() => window.__lpTexts.push(node.textContent)).observe(node, { childList: true, characterData: true, subtree: true });
    });
    await card(page).scrollIntoViewIfNeeded();
    await expect(card(page)).not.toHaveClass(/is-wait/);
    await expect.poll(() => visible(card(page).locator('.donation-panel-live__fill'))).toBe(40);
    await expect.poll(async () => num(await card(page).locator('[data-dp-live-raised]').textContent())).toBe(400);
    const texts = await page.evaluate(() => window.__lpTexts.map((t) => Number(t.replace(/[^0-9]/g, ''))));
    expect(texts.length).toBeGreaterThan(3);
    expect(Math.min(...texts)).toBeLessThan(400);
    expect(texts[texts.length - 1]).toBe(400);
    if (info.project.name === 'desktop') {
      fs.mkdirSync(SHOTS, { recursive: true });
      await card(page).screenshot({ path: path.join(SHOTS, `${info.project.name}-kart-son.png`) });
    }
    expect(errors).toEqual([]);
  });

  test('azaltılmış hareket: dolum ve rakamlar anında son değerde, önizleme anında', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = await open(page, url(400, 'card,inline'));
    await settleShift(page);
    await expect(card(page)).not.toHaveClass(/is-wait/);
    expect(await card(page).locator('.donation-panel-live__fill').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await card(page).scrollIntoViewIfNeeded();
    expect(num(await card(page).locator('[data-dp-live-raised]').textContent())).toBe(400);
    await typeAmount(page, '100');
    await expect(form(page).locator('[data-dp-live-pct]')).toHaveText(/50/);
    expect(await form(page).locator('.donation-panel-live__pv').evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0(\.001)?s/);
    expect(errors).toEqual([]);
  });

  test('ayarlar: önizleme kapalı → önizleme yok; sayma kapalı → durağan sınıf, animasyon yok', async ({ page }) => {
    await open(page, url(400, 'card,inline', '&dp_off=preview,count'));
    await expect(card(page)).toHaveClass(/donation-panel-live--static/);
    expect(await card(page).locator('.donation-panel-live__fill').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await typeAmount(page, '100');
    await page.waitForTimeout(500);
    await expect(form(page)).not.toHaveClass(/is-preview/);
    await expect(form(page).locator('[data-dp-live-pct]')).toHaveText(/40/);
  });

  test('compact kart: hızlı tutar önizlemesi, kart yüksekliği değişmez', async ({ page }) => {
    // Kart sayfadaki ilk eklenti yüzeyi (çubuk stilini compact kartın kendisi getirmeli).
    const errors = await open(page, url(400, 'compact,card'));
    const compact = page.locator('#lp-compact [data-dp-compact]');
    const camp = compact.locator('[data-dp-cstep="amount"] [data-dp-live-cfg]');
    await expect(compact).toHaveAttribute('data-dp-ready', '1');
    // Sayfada çizilen kartta çubuk stili satır içi, betik sayfanın kuyruğundan: yükleyici ek dosya getirmez.
    await expect(page.locator('style#donation-panel-inline-progress')).toHaveCount(1);
    await expect(page.locator('link#donation-panel-progress-css')).toHaveCount(0);
    await expect(page.locator('script#donation-panel-progress-js')).toHaveCount(1);
    const h0 = await compact.evaluate((el) => el.getBoundingClientRect().height);
    await settleShift(page);
    await typeInto(page, compact.locator('[data-dp-camount-in]'), '100');
    await expect(camp).toHaveClass(/is-preview/);
    await expect(card(page)).toHaveClass(/is-preview/);
    await expect(camp.locator('[data-dp-live-pct]')).toHaveText(/50/);
    expect(await compact.evaluate((el) => el.getBoundingClientRect().height)).toBe(h0);
    await typeInto(page, compact.locator('[data-dp-camount-in]'), '');
    await expect(camp).not.toHaveClass(/is-preview/);
    expect(await page.evaluate(() => window.__lpShift), await page.evaluate(() => window.__lpShiftSources.join(' | '))).toBe(0);
    expect(errors).toEqual([]);
  });

  test('katman: açılınca çubuk bağlanır, seçim önizlenir; kapanınca önizleme düşer', async ({ page }) => {
    const errors = await open(page, url(400, 'card,popup'));
    await page.locator('[data-dp-open]').click();
    await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
    const layerBar = page.locator('[data-dp-surface] [data-dp-live-cfg]');
    await expect(layerBar).toBeVisible();
    await typeInto(page, page.locator('[data-dp-surface] input[name="amount"]:not([type="hidden"])'), '100');
    await expect(layerBar).toHaveClass(/is-preview/);
    await expect(card(page)).toHaveClass(/is-preview/);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-dp-overlay]')).not.toHaveClass(/is-open/);
    await expect(card(page)).not.toHaveClass(/is-preview/);
    expect(errors).toEqual([]);
  });

  test('döngü katmanı (mağaza/kategori kartı): paket yalnız kampanyalı kartta ve sunucu yanıtından; önizleme, ödeme sonrası birleşme, sepet', async ({ page }, info) => {
    test.skip(!FIXED, 'sabit fiyatlı ürün yok');
    const errors = collectErrors(page);
    const scripts = [];
    page.on('request', (r) => /\/assets\/build\/progress\//.test(r.url()) && scripts.push(r.url()));
    await page.goto(url(400, 'loop', `&dp_loop=${FIXED},${PRODUCT}`));
    const fixedBtn = page.locator(`a.wdp-loop-donate[data-wdp-form="${FIXED}"]`);
    const campBtn = page.locator(`a.wdp-loop-donate[data-wdp-form="${PRODUCT}"]`);
    await expect(campBtn).toBeVisible();
    // Yüklemede çubuk paketi yok (betik, stil, yapılandırma).
    expect(await packageState(page)).toEqual({ js: false, css: false, live: false, cfg: 0 });

    // Kampanyasız ürünün katmanı: açılır, paket yüklenmez.
    const layer = page.locator('[data-dp-overlay].is-open');
    await fixedBtn.click();
    await expect(layer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(layer).toHaveCount(0);
    expect(scripts).toEqual([]);
    expect(await packageState(page)).toMatchObject({ js: false, css: false, live: false });

    // Kampanyalı ürünün katmanı: paket bir kez, eklentinin kendi derleme yolundan (aynı köken); stil kapla birlikte.
    await campBtn.click();
    await expect(layer).toBeVisible();
    const bar = layer.locator('[data-dp-live-cfg]');
    await expect(bar).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__donationPanelLiveProgress));
    expect(scripts.length).toBe(1);
    expect(scripts[0]).toMatch(PROGRESS_JS);
    expect(new URL(scripts[0]).origin).toBe(new URL(page.url()).origin);
    expect(await page.locator('#donation-panel-inline-progress').count()).toBe(1);
    await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/40/);
    await expect.poll(() => visible(bar.locator('.donation-panel-live__fill'))).toBe(40);
    const height = await bar.evaluate((el) => el.getBoundingClientRect().height);

    // Kişisel önizleme (yalnız bu tarayıcı).
    const amount = layer.locator('input[name="amount"]:not([type="hidden"])');
    await typeInto(page, amount, '50');
    await expect(bar).toHaveClass(/is-preview/);
    await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/45/);
    await expect(bar.locator('.donation-panel-live__note')).toHaveText(/50.*450|450.*50/);
    await expect.poll(() => visible(bar.locator('.donation-panel-live__pv'))).toBe(45);
    await expect.poll(() => visible(bar.locator('.donation-panel-live__fill'))).toBe(40);
    expect(await bar.evaluate((el) => el.getBoundingClientRect().height)).toBe(height);
    if (info.project.name === 'desktop' || info.project.name === 'iphone') {
      fs.mkdirSync(SHOTS2, { recursive: true });
      await page.waitForTimeout(500);
      await layer.locator('[data-dp-surface]').screenshot({ path: path.join(SHOTS2, `${info.project.name}-dongu-katmani-onizleme.png`) });
    }
    await page.addScriptTag({ content: AXE });
    const violations = await bar.evaluate(async (el) => {
      const r = await window.axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } });
      return r.violations.map((v) => `${v.id}:${v.nodes[0].target.join(' ')}`);
    });
    expect(violations).toEqual([]);

    // Ödeme sonrası (`donation-panel:progress-refresh`): tek istekle gerçek toplam, önizleme dolumla birleşir.
    const calls = [];
    page.on('request', (r) => r.url().includes('donation-panel/v1/progress/') && calls.push(r.url()));
    const order = await page.request.get(`/?dp_lp_order=${PRODUCT}&amount=50`);
    expect((await order.json()).ok).toBe(true);
    await page.evaluate((id) => {
      document.querySelector('[data-dp-overlay].is-open [data-dp-form]').dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: id, amount: 0 } }));
      document.dispatchEvent(new CustomEvent('donation-panel:progress-refresh', { detail: { productId: id, amount: 50 } }));
    }, PRODUCT);
    await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/45/, { timeout: 15000 });
    await expect(bar).not.toHaveClass(/is-preview/);
    await expect.poll(() => visible(bar.locator('.donation-panel-live__fill'))).toBe(45);
    await expect.poll(async () => num(await bar.locator('[data-dp-live-raised]').textContent())).toBe(450);
    expect(calls.filter((u) => u.includes('_=')).length).toBe(1);

    // Sepete ekle → "sepetinizde" (iyimser + Store API).
    await typeInto(page, amount, '100');
    await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/55/);
    const added = await page.request.get(`/?dp_lp_add=${PRODUCT}&amount=100`);
    expect((await added.json()).ok).toBe(true);
    await page.evaluate((id) => {
      document.dispatchEvent(new CustomEvent('donation-panel:cart-added', { detail: { productId: id, amount: 100 } }));
      document.querySelector('[data-dp-overlay].is-open [data-dp-form]').dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: id, amount: 0 } }));
    }, PRODUCT);
    await expect(bar).toHaveClass(/is-in-cart/);

    // Kapat → yeniden aç: aynı kap, ikinci paket isteği yok. (Sepete ekleme olayı yan sepeti de açar: o da kapatılır.)
    for (let i = 0; i < 3 && (await page.locator('dialog[open]').count()) > 0; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(layer).toHaveCount(0);
    await campBtn.click();
    await expect(layer).toBeVisible();
    await expect(bar).toHaveClass(/is-in-cart/);
    expect(scripts.length).toBe(1);
    expect(await page.locator('#donation-panel-inline-progress').count()).toBe(1);
    expect(errors).toEqual([]);
  });

  test('bağış listesi (kartta çubuk yok): katmandaki çubuk paketi REST yanıtıyla gelir, önizleme çalışır', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(url(400, 'list'));
    const cta = page.locator(`.wdp-card__cta[data-wdp-form="${PRODUCT}"]`);
    await expect(cta).toBeVisible();
    expect(await packageState(page)).toEqual({ js: false, css: false, live: false, cfg: 0 });
    await cta.click();
    const layer = page.locator('[data-dp-overlay].is-open');
    const bar = layer.locator('[data-dp-live-cfg]');
    await expect(bar).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__donationPanelLiveProgress));
    await typeInto(page, layer.locator('input[name="amount"]:not([type="hidden"])'), '100');
    await expect(bar).toHaveClass(/is-preview/);
    await expect(bar.locator('[data-dp-live-pct]')).toHaveText(/50/);
    expect(errors).toEqual([]);
  });

  test('güvenlik: sayfaya eklenen kötü amaçlı çubuk yapılandırması hiçbir betik/stil yükletmez', async ({ page }) => {
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await open(page, url(400));
    const before = await page.evaluate(() => document.querySelectorAll('script, link').length);
    await page.evaluate((id) => {
      const box = document.createElement('div');
      box.className = 'donation-panel';
      box.innerHTML = [
        `<div data-dp-live-cfg='{"id":${id},"goal":10,"src":"https://evil.test/x.js","css":"https://evil.test/x.css","v":"x\\"onload=1"}'><i data-dp-live-fill></i></div>`,
        `<div data-dp-live-cfg='{"id":${id},"goal":10,"src":"javascript:alert(1)"}'></div>`,
        `<div data-dp-live-cfg='{"id":${id},"goal":10,"src":"/wp-content/uploads/evil.js"}'></div>`,
      ].join('');
      document.body.append(box);
      document.dispatchEvent(new CustomEvent('dp:scan'));
      document.querySelector('#lp-inline [data-dp-form]').dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: id, amount: 5 } }));
    }, PRODUCT);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.querySelectorAll('script, link').length)).toBe(before);
    expect(requests.filter((u) => /evil|uploads\/evil|javascript:/.test(u))).toEqual([]);
  });

  test('erişilebilirlik: progressbar değerleri ve axe (kart + form çubuğu)', async ({ page }) => {
    await open(page, url(400));
    const bar = card(page).locator('[role="progressbar"]');
    await expect(bar).toHaveAttribute('aria-valuemin', '0');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');
    await expect(bar).toHaveAttribute('aria-valuenow', '40');
    await expect(bar).toHaveAttribute('aria-valuetext', /40.*400.*1[.,]?000/);
    await typeAmount(page, '100');
    await expect(form(page)).toHaveClass(/is-preview/);
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(async () => {
      const out = [];
      for (const sel of ['#lp-card', '#lp-inline [data-dp-live-cfg]']) {
        const r = await window.axe.run(document.querySelector(sel), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] } });
        r.violations.forEach((v) => out.push(`${sel} ${v.id}:${v.nodes[0].target.join(' ')}`));
      }
      return out;
    });
    expect(violations).toEqual([]);
  });
});
