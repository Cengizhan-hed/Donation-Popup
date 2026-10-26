/**
 * Kalite kapıları (E8B): axe WCAG 2.2 AA (bağış formu, popup/panel, yan sepet, kampanya kartı, teşekkür, hesap popup'ı),
 * akış (sepet -> ödeme blok/klasik -> sipariş, HPOS), para birimi biçimi, RTL düzeni. 3 cihaz.
 * YALNIZ yerel WP; koşucu: `node tests/e2e/run-quality.mjs` (ortam: WDP_Q_CFG, WDP_Q_RESULTS, E2E_BASE_URL, WDP_LOCAL_WP_DIR).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { recordResult } from '../helpers/quality-env.mjs';
import { formatMoney } from '../helpers/currency.mjs';
import { completeLocalCheckout, detectCheckoutKind, DEDICATION } from '../helpers/place-order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CFG = JSON.parse(process.env.WDP_Q_CFG || '{}');
const IDS = CFG.ids || {};
const STORE = CFG.store || {};

const GATE = (title) => (/^axe/.test(title) ? 'axe' : /^akış/.test(title) ? 'akis-odeme-hpos' : /^para/.test(title) ? 'para-birimi' : /^rtl/.test(title) ? 'rtl' : /^yükleme/.test(title) ? 'yukleme' : 'diger');

test.afterEach(async ({}, info) => {
  recordResult({
    gate: GATE(info.title),
    config: CFG.id,
    theme: CFG.theme,
    device: info.project.name,
    name: info.title,
    ok: info.status === 'passed',
    detail: info.status === 'passed' ? '' : String((info.error && info.error.message) || '').slice(0, 600),
  });
});

/**
 * Sayfada axe çalıştırır; ihlalleri okunur dizi olarak verir (eklentinin kendi alanı: `.wdp-*`/`.dp*` içindekiler öncelikli,
 * ama kapsam tüm sayfadır: tema kaynaklı ihlaller `theme:` önekiyle ayrılır).
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} [include] Kapsam seçicisi (boş = tüm sayfa).
 * @return {Promise<string[]>} İhlaller.
 */
async function axeViolations(page, include = '') {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(
    async ({ tags, scope }) => {
      const ctx = scope && document.querySelector(scope) ? { include: [scope] } : document;
      const res = await window.axe.run(ctx, { runOnly: { type: 'tag', values: tags } });
      const own = /(^|[\s>.#\[])(wdp|dp)[-_a-z]*|data-dp|donation_|custom_price/;
      return res.violations.flatMap((v) =>
        v.nodes.map((n) => `${own.test(n.target.join(' ') + n.html.slice(0, 160)) ? '' : 'theme:'}${v.id} (${v.impact}) ${n.target.join(' ')}`)
      );
    },
    { tags: AXE_TAGS, scope: include }
  );
}

/**
 * Yalnız eklenti kaynaklı ihlaller başarısızlık sayılır (tema ihlali raporlanır, eklentiye yüklenmez).
 * @param {string[]} v İhlaller.
 * @param {string} label Etiket.
 */
function expectNoOwn(v, label) {
  const own = v.filter((x) => !x.startsWith('theme:'));
  const theme = v.filter((x) => x.startsWith('theme:'));
  if (theme.length) test.info().annotations.push({ type: 'tema-ihlali', description: `${label}: ${theme.slice(0, 4).join(' | ')}` });
  expect(own, `${label}: ${own.join(' | ')}`).toEqual([]);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {string[]} Sayfa hataları (yineleyen dizi).
 */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const kit = `/?dp_q_test=kit&dp_product=${IDS.custom}&dp_campaign=${IDS.campaign}`;

test.describe('yükleme', () => {
  test('yükleme: mağazada paket etkileşime kadar yüklenmez; üzerine gelince yüklenir ve panel açılır', async ({ page }) => {
    const errors = trackErrors(page);
    const bundleRequests = [];
    page.on('request', (r) => {
      if (/donation-modal\.[0-9a-f]+\.js/.test(r.url())) bundleRequests.push(r.url());
    });
    await page.goto('/shop/', { waitUntil: 'load' });
    expect(await page.locator('script[type="text/wdp-deferred"]').count(), 'ertelenmiş paket etiketi').toBeGreaterThan(0);
    expect(bundleRequests, 'etkileşimden önce paket isteği yok').toEqual([]);
    expect(await page.evaluate(() => typeof window.WDPApp)).toBe('undefined');
    const btn = page.locator('.wdp-loop-donate').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.hover();
    await page.waitForFunction(() => window.WDPDefer && window.WDPDefer.isReady());
    expect(bundleRequests.length, 'hover sonrası paket yüklendi').toBe(1);
    await btn.click();
    await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.show').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('yükleme: paket yokken yapılan ilk tıklama kaybolmaz (yükleme sonrası yeniden gönderilir)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/shop/', { waitUntil: 'load' });
    const btn = page.locator('.wdp-loop-donate').first();
    await btn.scrollIntoViewIfNeeded();
    // Fare hareketi yok: yalnız doğrudan tıklama olayı (paket henüz yok).
    await btn.evaluate((el) => el.click());
    await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.show').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('yükleme: ürün sayfasında satır içi form etkileşimsiz de boşta hazır olur (gönder düğmesi açılır)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(IDS.fixedPath, { waitUntil: 'load' });
    const cta = page.locator('button[name="donation_add_to_cart"]').first();
    if (!(await cta.count())) return;
    await page.waitForFunction(() => window.WDPDefer && window.WDPDefer.isReady(), null, { timeout: 8000 });
    await expect(cta).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('yükleme: ürün sayfasına ülke listesi ve çeviri sözlüğü gömülmez; paketten önce ayrı betikle gelir ve telefon alanı çalışır', async ({ page }) => {
    const errors = trackErrors(page);
    const res = await page.goto(IDS.fixedPath, { waitUntil: 'load' });
    const html = await (res ? res.text() : Promise.resolve(''));
    const inline = (html.match(/var wdp_ajax = (\{[\s\S]*?\});\n/) || [])[1] || '';
    expect(inline.length, 'satır içi wdp_ajax küçük çekirdek (<= 10 KB)').toBeGreaterThan(0);
    expect(inline.length).toBeLessThan(10 * 1024);
    expect(inline).not.toContain('"countries"');
    expect(inline).not.toContain('"i18n_dict"');
    expect(html, 'ayrı veri betiği ertelenmiş etiketle').toMatch(/data-wdp-src="[^"]*wdp_client_data=/);
    await page.waitForFunction(() => window.WDPDefer && window.WDPDefer.isReady(), null, { timeout: 8000 });
    const state = await page.evaluate(() => ({
      countries: ((window.wdp_ajax.phone || {}).countries || []).length,
      def: (window.wdp_ajax.phone || {}).default_country || '',
      dict: Object.keys(window.wdp_ajax.i18n_dict || {}).length,
    }));
    expect(state.countries, 'ülke listesi yüklendi').toBeGreaterThan(100);
    expect(state.dict, 'sözlük yüklendi').toBeGreaterThan(50);
    expect(state.def).toMatch(/^[a-z]{2}$/i);
    const phone = page.locator('.wdp-phone-field').first();
    if (await phone.count()) {
      await phone.locator('button').first().click();
      expect(await page.locator('#wdp-phone-country-panel [role="option"]').count(), 'ülke listesi çizildi').toBeGreaterThan(50);
    }
    expect(errors).toEqual([]);
  });

  // K3: tam stil paketi (~34 KB gzip) ilk boyamayı engellemez; ilk görünümdeki kurallar satır içi "kritik" alt kümeden gelir.
  test('yükleme: tam stil paketi ilk boyamayı engellemez; kritik alt küme tek başına ilk ekranı tam paketle aynı çizer', async ({ page }) => {
    const res = await page.request.get(IDS.fixedPath);
    const html = await res.text();
    expect(html, 'satır içi kritik stil').toContain('id="wdp-critical-bundle"');
    expect(html, 'tam paket engelleyici değil').toMatch(/<link[^>]+donation-modal\.[0-9a-f]+\.css[^>]*media='print'[^>]*data-wdp-defer-css/);
    expect(html, 'betiksiz yedek').toMatch(/<noscript><link[^>]+donation-modal\.[0-9a-f]+\.css/);
    const critical = (html.match(/<style id="wdp-critical-bundle">([\s\S]*?)<\/style>/) || [, ''])[1];
    expect(critical.length, 'kritik stil boyutu (ham bayt)').toBeLessThan(120000);
    const targets = [IDS.fixedPath, IDS.customPath, IDS.sharesPath, IDS.campaignPath].filter(Boolean);
    const shoot = async (url, withFull) => {
      const p = await page.context().newPage();
      await p.emulateMedia({ reducedMotion: 'reduce' });
      // Yalnız statik ilk boyama karşılaştırılır: paket betiği iki durumda da yok (JS sınıfları tam paketsiz stilsiz kalırdı).
      await p.route(/donation-modal\.[0-9a-f]+\.js|wdp_client_data|wdp-form-cta-ready|cta-ready\.js/, (r) => r.abort());
      if (!withFull) await p.route(/donation-modal\.[0-9a-f]+\.css/, (r) => r.abort());
      await p.goto(url, { waitUntil: 'load' });
      if (withFull) await p.waitForFunction(() => [...document.querySelectorAll('link[data-wdp-defer-css]')].every((l) => l.media === 'all' && l.sheet));
      await p.waitForTimeout(400);
      const png = await p.screenshot({ fullPage: true });
      await p.close();
      return PNG.sync.read(png);
    };
    const failures = [];
    for (const url of targets) {
      const a = await shoot(url, true);
      const b = await shoot(url, false);
      if (a.width !== b.width || Math.abs(a.height - b.height) > 16) {
        failures.push(`${url}: boyut farkı ${a.width}x${a.height} / ${b.width}x${b.height}`);
        continue;
      }
      const h = Math.min(a.height, b.height);
      const diff = pixelmatch(a.data.subarray(0, a.width * h * 4), b.data.subarray(0, b.width * h * 4), null, a.width, h, { threshold: 0.1 });
      const ratio = diff / (a.width * h);
      if (ratio > 0.0005) failures.push(`${url}: ilk boyama farkı %${(ratio * 100).toFixed(2)} (${diff} px)`);
    }
    expect(failures, failures.join(' | ')).toEqual([]);
  });

  test('yükleme: istemci veri betiği herkese açık, önbelleğe alınabilir ve yalnız geçerli yerel ayarı kabul eder', async ({ page, request }) => {
    const ok = await request.get('/?wdp_client_data=en_US&ver=t');
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toContain('javascript');
    expect(ok.headers()['cache-control']).toContain('public');
    expect(await ok.text()).toContain('a.phone.countries=');
    const bad = await request.get('/?wdp_client_data=..%2Fx');
    expect(bad.status()).toBe(400);
    expect(page).toBeTruthy();
  });
});

test.describe('axe', () => {
  test('axe: ürün sayfası bağış formu (eski kabuk) + popup + yan panel', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(IDS.fixedPath);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'ürün sayfası');
    const popup = page.locator('.wdp-open-modal:not(.wdp-open-side-panel)').first();
    if (await popup.isVisible()) {
      await popup.click();
      await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.show')).toBeVisible();
      await page.waitForTimeout(500);
      expectNoOwn(await axeViolations(page), 'popup');
      await page.keyboard.press('Escape');
    }
    const panel = page.locator('.wdp-open-side-panel').first();
    if (await panel.isVisible()) {
      await page.reload();
      await page.locator('.wdp-open-side-panel').first().click();
      await expect(page.locator('.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show')).toBeVisible();
      await page.waitForTimeout(500);
      expectNoOwn(await axeViolations(page), 'yan panel');
    }
    expect(errors).toEqual([]);
  });

  test('axe: mağaza listesi kartları', async ({ page }) => {
    await page.goto('/shop/');
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'mağaza');
  });

  test('axe: yeni motor her yüzey (popup, yan panel, alttan panel, satır içi form, kampanya kartı, sosyal kanıt)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(kit);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'kit (kapalı yüzeyler, satır içi form, kampanya, sosyal kanıt)');
    for (const kind of ['popup', 'side_panel', 'bottom_sheet']) {
      await page.goto(kit);
      await page.locator(`[data-dp-kind="${kind}"] [data-dp-open]`).click();
      await expect(page.locator(`[data-dp-kind="${kind}"] [data-dp-overlay].is-open, [data-dp-kind="${kind}"] [data-dp-overlay][data-open], [data-dp-kind="${kind}"] [data-dp-surface]:visible`).first()).toBeVisible();
      await page.waitForTimeout(700);
      expectNoOwn(await axeViolations(page), `yeni ${kind}`);
    }
    expect(errors).toEqual([]);
  });

  test('axe: bağışçı hesabı giriş popup\'ı + yan sepet', async ({ page }) => {
    await page.goto(kit);
    await page.locator('[data-dp-acc-open]').click();
    await expect(page.locator('#dp-ac-dialog')).toBeVisible();
    await page.waitForTimeout(600);
    expectNoOwn(await axeViolations(page), 'hesap popup');
    await page.keyboard.press('Escape');
    const add = await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${STORE.amount || 50}&dedication=${encodeURIComponent(DEDICATION)}`);
    expect((await add.json()).ok).toBe(true);
    await page.goto(kit);
    await page.locator('[data-dp-sc-open]').click();
    await expect(page.locator('[data-dp-sc-overlay].is-open')).toBeVisible();
    await page.waitForTimeout(700);
    expectNoOwn(await axeViolations(page), 'yan sepet');
  });

  test('axe: teşekkür sayfası', async ({ page }) => {
    const r = await page.request.get(`/?dp_q_order=${IDS.custom}&amount=${STORE.amount || 40}`);
    const o = await r.json();
    expect(o.ok).toBe(true);
    await page.goto(new URL(o.received_url).pathname + new URL(o.received_url).search);
    await page.waitForLoadState('networkidle');
    expectNoOwn(await axeViolations(page), 'teşekkür');
  });
});

test.describe('akış ve para birimi', () => {
  test('akış: sepet -> ödeme (blok/klasik) -> sipariş; kayıt eksiksiz, HPOS ayarına uygun', async ({ page }) => {
    const amount = Number(STORE.amount || 50);
    const add = await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${amount}&dedication=${encodeURIComponent(DEDICATION)}`);
    expect((await add.json()).ok).toBe(true);
    await page.goto(new URL(CFG.checkoutUrl).pathname);
    const kind = await detectCheckoutKind(page);
    expect(kind).toBe(CFG.checkout);
    await completeLocalCheckout(page, {
      store: STORE,
      checkoutKind: kind,
      wpDir: process.env.WDP_LOCAL_WP_DIR,
      expected: { amount, currency: STORE.currency, hpos: !!CFG.hpos, dedication: DEDICATION },
    });
  });

  test('para birimi: ödeme sayfasında tutar WooCommerce biçimiyle (sembol, ondalık, ayırıcı)', async ({ page }) => {
    const amount = Number(STORE.amount || 50);
    await page.request.get(`/?dp_q_add=${IDS.custom}&amount=${amount}`);
    await page.goto(new URL(CFG.checkoutUrl).pathname);
    const want = formatMoney(amount, STORE);
    const alt = want.replace(/\s/g, '');
    // Blok ödeme özeti istemci tarafında (Store API) çizilir: görünene dek yokla.
    await expect
      .poll(async () => (await page.locator('body').innerText()).replace(/\u00a0/g, ' ').replace(/\s/g, '').includes(alt), {
        timeout: 20000,
        message: `ödeme metninde ${want} yok`,
      })
      .toBe(true);
  });

  test('para birimi: yeni motor formu ön ayar ve toplam satırı mağaza biçiminde', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(kit);
    await page.locator('[data-dp-kind="popup"] [data-dp-open]').click();
    const surface = page.locator('[data-dp-kind="popup"] [data-dp-surface]');
    await expect(surface).toBeVisible();
    const preset = surface.locator('[data-dp-preset]').first();
    const label = ((await preset.innerText()) || '').replace(/ /g, ' ').replace(/\s/g, '');
    expect(label.includes(String(STORE.symbol || '').replace(/\s/g, '')), `ön ayar ${label}, sembol ${STORE.symbol}`).toBe(true);
    await preset.click();
    const total = (await surface.locator('[data-dp-line="total"]').innerText()).replace(/ /g, ' ').replace(/\s/g, '');
    expect(total.includes(String(STORE.symbol || '').replace(/\s/g, '')), `toplam ${total}`).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('rtl', () => {
  test('rtl: dir=rtl iken yeni motor yüzeyleri ve satır içi form taşmaz, yatay kaydırma yok', async ({ page }) => {
    await page.goto(kit);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow(), 'kapalı sayfa yatay taşma').toBeLessThanOrEqual(1);
    for (const kind of ['popup', 'side_panel', 'bottom_sheet']) {
      await page.locator(`[data-dp-kind="${kind}"] [data-dp-open]`).click();
      const surface = page.locator(`[data-dp-kind="${kind}"] [data-dp-surface]`);
      await expect(surface).toBeVisible();
      await page.waitForTimeout(800);
      const box = await surface.boundingBox();
      const vp = page.viewportSize();
      expect(box.x, `${kind} sol taşma`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, `${kind} sağ taşma`).toBeLessThanOrEqual(vp.width + 1);
      expect(await overflow(), `${kind} yatay taşma`).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      await expect(surface).toBeHidden();
    }
  });
});
