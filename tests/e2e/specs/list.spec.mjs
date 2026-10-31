/**
 * Bağış listesi ([wdp_donations]) yerel e2e: yerleşim, sekme süzgeci, kart düğmesiyle form açılışı, JS'siz bağlantı,
 * CLS, axe. Ekran görüntüleri yalnız WDP_SHOTS_DIR verilince.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const AXE = fs.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const SHOTS = process.env.WDP_SHOTS_DIR || '';
const URL = '/?dp_list_test=1&dp_atts=' + encodeURIComponent('title="Bağışlar"');

test('liste: başlık, sekmeler ve üç kart türü', async ({ page }) => {
  await page.goto(URL);
  const wrap = page.locator('.wdp-list-wrap');
  await expect(wrap).toBeVisible();
  await expect(wrap.locator('.wdp-list__title')).toHaveText('Bağışlar');
  await expect(wrap.locator('a.wdp-list__tab').first()).toHaveAttribute('aria-current', 'true');
  expect(await wrap.locator('a.wdp-list__tab').count()).toBeGreaterThan(2);
  const campaign = wrap.locator('.wdp-card--campaign');
  await expect(campaign.first()).toBeVisible();
  await expect(campaign.first().locator('.wdp-card__badge')).toContainText(/18/);
  await expect(campaign.first().locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '61');
  await expect(campaign.first().locator('.wdp-card__donors')).toContainText('412');
  await expect(wrap.locator('.wdp-card--row').first()).toBeVisible();
  await expect(wrap.locator('.wdp-card--custom .wdp-card__price--any').first()).toBeVisible();
  for (const a of await wrap.locator('.wdp-card__title a').all()) {
    expect(await a.getAttribute('href')).toMatch(/^https?:\/\//);
  }
});

test('liste: sekme süzgeci kartları gizler/gösterir', async ({ page }) => {
  await page.goto(URL);
  const items = page.locator('.wdp-list__item');
  const total = await items.count();
  const tab = page.locator('a.wdp-list__tab[data-wdp-tab]:not([data-wdp-tab="all"])').first();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-current', 'true');
  const visible = await page.locator('.wdp-list__item:not([hidden])').count();
  expect(visible).toBeGreaterThan(0);
  expect(visible).toBeLessThan(total);
  await page.locator('a.wdp-list__tab[data-wdp-tab="all"]').click();
  expect(await page.locator('.wdp-list__item:not([hidden])').count()).toBe(total);
});

for (const cta of ['campaign', 'custom']) {
  test(`liste: ${cta} düğmesi formu açar, Esc kapatır, odak düğmeye döner`, async ({ page }) => {
    await page.goto(URL);
    const button = page.locator(`.wdp-card--${cta} a.wdp-card__cta`).first();
    await expect(button).toHaveAttribute('data-wdp-form', /\d+/);
    await button.click();
    await expect(page.locator('.wdp-form-host [data-dp-overlay]')).toHaveClass(/is-open/, { timeout: 15000 });
    await expect(page.locator('.wdp-form-host [data-dp-surface]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.wdp-form-host [data-dp-overlay]')).not.toHaveClass(/is-open/);
    await expect(button).toBeFocused();
    // İkinci açılış: kap yeniden istenmez.
    await button.click();
    await expect(page.locator('.wdp-form-host [data-dp-overlay]')).toHaveClass(/is-open/);
    expect(await page.locator('.wdp-form-host').count()).toBe(1);
  });
}

test('liste: button="link" düğmesi yalnız ürün sayfasına bağlanır', async ({ page }) => {
  await page.goto('/?dp_list_test=1&dp_atts=' + encodeURIComponent('button="link"'));
  const first = page.locator('a.wdp-card__cta').first();
  await expect(first).not.toHaveAttribute('data-wdp-form', /.*/);
  await expect(first).toHaveAttribute('href', /^https?:\/\//);
});

test.describe('JS kapalı', () => {
  test.use({ javaScriptEnabled: false });
  test('liste: tüm kartlar görünür, düğmeler ürün bağlantısıdır', async ({ page }) => {
    await page.goto(URL);
    const count = await page.locator('.wdp-list__item').count();
    expect(count).toBeGreaterThan(2);
    expect(await page.locator('.wdp-list__item:visible').count()).toBe(count);
    for (const a of await page.locator('a.wdp-card__cta').all()) {
      expect(await a.getAttribute('href')).toMatch(/^https?:\/\//);
    }
  });
});

test('liste: yerleşim kayması (CLS) ~0 ve yatay taşma yok', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const cls = await page.evaluate(() => window.__cls);
  expect(cls).toBeLessThan(0.01);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('liste: dokunma hedefleri >= 44 px', async ({ page }) => {
  await page.goto(URL);
  for (const sel of ['a.wdp-list__tab', 'a.wdp-card__cta']) {
    for (const el of await page.locator(sel).all()) {
      const box = await el.boundingBox();
      expect(box && box.height, sel).toBeGreaterThanOrEqual(43.5);
    }
  }
});

test('axe: liste WCAG 2.2 AA ihlali yok (liste alanı)', async ({ page }) => {
  await page.goto(URL);
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(async () => {
    const res = await window.axe.run(document.querySelector('.wdp-list-wrap'), {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return res.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));
  });
  expect(result).toEqual([]);
});

test('ekran: liste (Liste)', async ({ page }, info) => {
  test.skip(!SHOTS, 'WDP_SHOTS_DIR yok');
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.goto(URL);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `liste-${info.project.name}.png`), fullPage: true });
});

test('liste: kartlar dikey, görsel üstte, satırda eşit yükseklik, yatay taşma yok', async ({ page }) => {
  await page.goto(URL);
  const cards = page.locator('.wdp-list__item:not([hidden]) .wdp-card');
  const n = await cards.count();
  expect(n).toBeGreaterThan(2);
  const rows = new Map();
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const media = await card.locator('.wdp-card__media').boundingBox();
    const body = await card.locator('.wdp-card__body').boundingBox();
    const box = await card.boundingBox();
    expect(media, 'görsel/yer tutucu bloğu var').not.toBeNull();
    expect(media.y + media.height, 'görsel gövdenin üstünde').toBeLessThanOrEqual(body.y + 1);
    expect(Math.abs(media.x - box.x), 'görsel kart başında').toBeLessThan(1);
    expect(Math.abs(media.width - box.width), 'görsel kart genişliğinde').toBeLessThan(1);
    const key = Math.round(box.y);
    rows.set(key, [...(rows.get(key) || []), box.height]);
    // Düğme kartın altında (gövde sonuna yakın).
    const cta = await card.locator('a.wdp-card__cta').boundingBox();
    expect(cta.y + cta.height).toBeGreaterThan(box.y + box.height - 40);
  }
  for (const heights of rows.values()) {
    expect(Math.max(...heights) - Math.min(...heights), 'satırda eşit yükseklik').toBeLessThanOrEqual(1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('liste: görselsiz kartta yer tutucu simge, başlıklar h2/h3, H1 yok', async ({ page }) => {
  await page.goto(URL);
  expect(await page.locator('.wdp-card__media--empty svg.wdp-card__ph').count()).toBeGreaterThan(0);
  expect(await page.locator('.wdp-list-wrap h1').count()).toBe(0);
  for (const h of await page.locator('.wdp-card__title').all()) {
    expect(await h.evaluate((el) => el.tagName)).toBe('H3'); // listenin h2 başlığı var
  }
  await page.goto('/?dp_list_test=1');
  for (const h of await page.locator('.wdp-card__title').all()) {
    expect(await h.evaluate((el) => el.tagName)).toBe('H2');
  }
});

test('form: panel içinde ürün/kampanya görseli yok', async ({ page }) => {
  await page.goto(URL);
  await page.locator('a.wdp-card__cta').first().click();
  await expect(page.locator('.wdp-form-host [data-dp-surface]')).toBeVisible({ timeout: 15000 });
  expect(await page.locator('.wdp-form-host .donation-panel-form img, .wdp-form-host .donation-panel-hero').count()).toBe(0);
});

test('12.4 gömülü formlar: etkileşimsiz ve etkileşimli sayfada eklenti REST/PHP isteği 0; hızlı ayrılmalar temiz', async ({ page }) => {
  // 12.3'teki toplu `no-store` ön alma isteği kaldırıldı (her görüntülemede PHP çalıştırıyordu): form verisi sayfa
  // HTML'inde gömülü. Hiç etkileşmeyen ziyaretçide de, etkileşen ziyaretçide de dokunuşa kadar eklenti REST isteği yok.
  // Boşta yalnız form deneyimi betiği (statik, sürümlü, önbelleklenebilir dosya; PHP yok) yüklenir.
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
  const logs = [];
  page.on('console', (m) => m.type() === 'error' && logs.push(m.text()));
  const rest = [];
  const statics = [];
  page.on('request', (r) => {
    if (/donation-panel(\/|%2F)v1/.test(r.url())) rest.push(r.url());
    else if (/woo-donation-popup\/assets\/build\/.+\.js/.test(r.url())) statics.push(r.url());
  });
  await page.goto(URL, { waitUntil: 'load' });
  expect(await page.locator('script[type="application/json"][data-dp-forms]').count(), 'gömülü paket').toBeGreaterThan(0);
  // Etkileşimsiz: boşta hazırlık (1 sn) bitsin; düğmeler hazır, ağ yok.
  await expect(page.locator('.wdp-card__cta[data-wdp-form]').first()).toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
  await page.waitForTimeout(500);
  expect(rest, 'etkileşimsiz sayfada eklenti REST isteği').toEqual([]);
  // Etkileşim (sekme, üzerine gelme) sonrası da yok.
  await page.locator('a.wdp-list__tab').nth(1).click();
  await page.locator('a.wdp-list__tab').first().click();
  await page.locator('.wdp-card__cta[data-wdp-form]').first().hover();
  await page.waitForTimeout(400);
  expect(rest, 'etkileşimde eklenti REST isteği').toEqual([]);
  expect(statics.every((u) => /\/assets\/build\/(list|experiences|progress)\//.test(u)), statics.join(' ')).toBe(true);
  for (let i = 0; i < 3; i += 1) {
    await page.goto(`${URL}&n=${i}`, { waitUntil: 'domcontentloaded' });
  }
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  expect(rest).toEqual([]);
  expect(errors, logs.join(' | ')).toEqual([]);
});

test('12.4 gömülü formlar: sayfa HTML\'i önbellekten (kalıcı önbellek benzetimi) gelse de dokunuşta ağ 0, < 100 ms', async ({ page }) => {
  // Sayfa önbelleği: HTML bir kez üretilip sonraki ziyaretçiye AYNEN verilir (PHP yok). Gömülü pakette nonce/kullanıcı
  // verisi olmadığı için önbellekli HTML'le form çalışır; nonce yalnız gönderimde alınır.
  const first = await page.request.get(URL);
  const cached = await first.text();
  expect(cached).not.toMatch(/data-dp-nonce="[a-f0-9]{6,}"/);
  let served = 0;
  await page.route((u) => u.href.includes('dp_list_test=1') && u.href.includes('dp_cached=1'), async (route) => {
    served += 1;
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: cached });
  });
  await page.goto(`${URL}&dp_cached=1`, { waitUntil: 'load' });
  expect(served).toBe(1);
  const cta = page.locator('.wdp-card__cta[data-wdp-form]').first();
  await expect(cta).toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
  const r = await tapAndMeasure(page, cta);
  expect(r.network, 'dokunuşta eklenti REST ağ isteği').toBe(0);
  expect(r.ms).toBeLessThan(100);
  // Gömülü formun nonce'u boş: form ilk gönderimde REST'ten alır (önbellekte kullanıcıya özel veri yok).
  await expect(page.locator('.wdp-form-host [data-dp-exp]')).toHaveAttribute('data-dp-nonce', '');
});

test('12.4 güvenlik: yönetici çizimi gizli/taslak/şifreli ürünü pakete sokmaz (önbellekten anonim çıktı da temiz)', async ({ page }) => {
  test.skip(!process.env.WDP_LOCAL_WP_DIR, 'yerel WP yok');
  await page.goto(URL);
  const ids = await page.locator('.wdp-card__cta[data-wdp-form]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-wdp-form')))]);
  expect(ids.length).toBeGreaterThanOrEqual(4);
  const r = spawnSync('php', [path.join(ROOT, 'tests/local-wp/eval-file.php'), 'tests/e2e/helpers/wdp-card-forms-private.php', ...ids.slice(0, 4)], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  const out = JSON.parse(String(r.stdout).slice(String(r.stdout).indexOf('{')));
  expect(out.ok && out.admin_is_admin).toBe(true);
  expect(out.admin, 'yönetici çizimi').toEqual([Number(ids[0])]);
  expect(out.guest, 'anonim (önbellekten)').toEqual([Number(ids[0])]);
});

/**
 * Dokunuş → panel (sayfa içinde ölçülür: click yakalama → `dialog[open]` görünür) ve dokunuş anından sonra AĞA giden
 * eklenti REST istekleri (transferSize > 0).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').Locator} cta Kart düğmesi.
 * @return {Promise<{ms: number, network: number}>} Ölçüm.
 */
async function tapAndMeasure(page, cta) {
  await page.evaluate(() => {
    window.__tap = { t0: 0, t1: 0 };
    document.addEventListener('click', () => (window.__tap.t0 = performance.now()), { capture: true, once: true });
    const mo = new MutationObserver(() => {
      const d = document.querySelector('.wdp-form-host dialog[open]');
      if (d && !window.__tap.t1) {
        window.__tap.t1 = performance.now();
        mo.disconnect();
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  });
  const from = await page.evaluate(() => performance.now());
  await cta.click();
  await expect(page.locator('.wdp-form-host dialog[open] [data-dp-surface]')).toBeVisible({ timeout: 15000 });
  return page.evaluate(
    (t) => ({
      ms: Math.round(window.__tap.t1 - window.__tap.t0),
      network: performance.getEntriesByType('resource').filter((r) => r.startTime >= t && /donation-panel(\/|%2F)v1/.test(r.name) && r.transferSize > 0).length,
    }),
    from
  );
}

test.describe('kart ön alma: oluşturucu çıktısı, yeniden çizim, çerez değişimi (12.3 fix)', () => {
  // Genel durumlar (tema/oluşturucu adı yok): kartlar yüklemeden sonra betikle gelir; ziyaretçinin İLK etkileşimi doğrudan
  // karta dokunuş (kaydırma/fare yok); başka betikler çerez yazar (HTTP önbelleği `Vary: Cookie` ıskası). Hepsinde form
  // dokunuştan önce bellekte hazır, dokunuşta eklenti REST ağ isteği 0, panel ağır CSS'te bile < 100 ms.
  const sim = (q) => `${URL}&${q}`;

  test('oluşturucu çıktısı + ağır CSS: kaydırmasız ilk dokunuşta ağ 0, < 100 ms', async ({ page }) => {
    await page.goto(sim('dp_builder=1&dp_heavy=1'), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__simBuilt === 1);
    const cta = page.locator('.wdp-card__cta[data-wdp-form]').first();
    await expect(cta).toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
    const r = await tapAndMeasure(page, cta);
    expect(r.network, 'dokunuşta eklenti REST ağ isteği').toBe(0);
    expect(r.ms, 'dokunuş → panel (ms)').toBeLessThan(100);
  });

  test('yeniden çizilen kart düğmesi de hazır; dokunuşta ağ 0', async ({ page }) => {
    await page.goto(sim('dp_builder=1&dp_rerender=1'), { waitUntil: 'load' });
    await expect(page.locator('.wdp-card__cta[data-wdp-form]').first()).toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
    await page.waitForFunction(() => window.__simRerendered === 1, null, { timeout: 10000 });
    const cta = page.locator('.wdp-card__cta[data-wdp-form]').first();
    await expect(cta, 'yeni düğüm hazır işaretlendi').toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
    const r = await tapAndMeasure(page, cta);
    expect(r.network).toBe(0);
  });

  test('çerez değişse de (başka betik) dokunuşta ağ 0', async ({ page }) => {
    await page.goto(sim('dp_cookie_churn=1'), { waitUntil: 'load' });
    const cta = page.locator('.wdp-card__cta[data-wdp-form]').first();
    await expect(cta).toHaveAttribute('data-wdp-ready', '1', { timeout: 10000 });
    const before = await page.evaluate(() => document.cookie.match(/sim_churn=(\d+)/)?.[1] || '');
    await expect.poll(() => page.evaluate(() => document.cookie.match(/sim_churn=(\d+)/)?.[1] || '')).not.toBe(before);
    const r = await tapAndMeasure(page, cta);
    expect(r.network, 'çerez değişimi sonrası dokunuşta ağ').toBe(0);
  });
});
