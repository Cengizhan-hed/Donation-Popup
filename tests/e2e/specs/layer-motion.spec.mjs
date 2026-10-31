/**
 * 12.3 motion: katman açılışında titreme yok, odak görünümü, liste kartı ön alma. YALNIZ yerel WP:
 *   npm run e2e:queue -- npm run e2e:experiences -- --env local --spec layer-motion
 *
 * A) Hareket: popup / sağ panel / alttan panel — kare kare (rAF) yüzey konumu hedefe TEK yönde yaklaşır (taşma/geri
 *    sekme yok), katman kaydırılmaz (scrollLeft/Top 0), sayfa yatay kayması 0 ve belge genişliği değişimi 0 (klasik
 *    kaydırma çubuklu uzun sayfa dahil, Chromium), açılış 200–300 ms içinde biter, yalnız transform/opacity geçişi;
 *    azaltılmış harekette ilk karede yerinde.
 * B) Odak: fare/dokunuşla alana tıklamada kalın halka yok (yalnız kenarlık marka rengi); klavyede 2 px aralıklı halka
 *    (≥3:1 kontrast); düğmeye tıklamada halka yok, klavyede var.
 * C) Liste kartı: form önceden alınır (`data-wdp-ready`), dokunuşta eklenti REST isteği 0; başka kökene işaret eden
 *    sokulmuş düğme hiçbir istek yapmaz (güvenlik).
 */
import { test, expect, chromium } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const KINDS = ['popup', 'side_panel', 'bottom_sheet'];
const url = (kind, extra = '') => `/?dp_exp_test=${kind}&dp_product=${PRODUCT}${extra}`;

/**
 * Tetikleyiciye tıklar ve açılışı kare kare kaydeder (900 ms).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{frames: Array<object>, before: object}>} Kayıt.
 */
async function recordOpen(page) {
  await page.evaluate(() => {
    const center = document.querySelector('#dp-sim-center') || document.querySelector('main h1');
    // İçerik genişliği (gövde kutusu): kilitte çubuk kaybolsa da içerik alanı aynı kalmalı.
    const read = () => ({ cw: document.body.getBoundingClientRect().width, cx: center.getBoundingClientRect().x, sx: window.scrollX });
    window.__mo = { before: read(), frames: [] };
    document.querySelector('[data-dp-open]').addEventListener(
      'click',
      () => {
        const t0 = performance.now();
        const loop = () => {
          const s = document.querySelector('[data-dp-surface]');
          const o = document.querySelector('[data-dp-overlay]');
          const r = s.getBoundingClientRect();
          window.__mo.frames.push({ t: performance.now() - t0, x: r.x, y: r.y, w: r.width, osl: o.scrollLeft, ost: o.scrollTop, ...read() });
          if (performance.now() - t0 < 900) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      { capture: true, once: true }
    );
  });
  await page.locator('[data-dp-open]').first().click();
  await page.waitForFunction(() => window.__mo.frames.length && window.__mo.frames[window.__mo.frames.length - 1].t >= 900, null, { timeout: 15000 });
  return page.evaluate(() => window.__mo);
}

/**
 * Kayıttan hareket ölçütleri: hedefe tek yönlü yaklaşma, bitiş süresi, kayma.
 *
 * @param {{frames: Array<object>, before: object}} rec Kayıt.
 * @return {object} Özet.
 */
function analyse(rec) {
  const f = rec.frames;
  const end = f[f.length - 1];
  const dist = f.map((x) => Math.hypot(x.x - end.x, x.y - end.y));
  let reversals = 0;
  for (let i = 1; i < dist.length; i += 1) {
    if (dist[i] > dist[i - 1] + 0.75) reversals += 1; // hedeften uzaklaşma = taşma/geri sekme/titreme
  }
  const settled = f.find((x, i) => dist.slice(i).every((d) => d < 1));
  return {
    reversals,
    settleMs: settled ? Math.round(settled.t) : Infinity,
    startDist: Math.round(dist[0]),
    overlayScroll: Math.max(...f.map((x) => Math.abs(x.osl) + Math.abs(x.ost))),
    widthDelta: Math.max(...f.map((x) => Math.abs(x.cw - rec.before.cw))),
    shiftX: Math.max(...f.map((x) => Math.abs(x.cx - rec.before.cx))),
  };
}

for (const kind of KINDS) {
  test.describe(`hareket: ${kind}`, () => {
    test('tek yönlü, katman kaymaz, sayfa yana kaymaz, 200–300 ms, yalnız transform/opacity', async ({ page }, info) => {
      test.setTimeout(90000);
      await page.goto(url(kind, '&dp_long=1'), { waitUntil: 'load' });
      const rec = await recordOpen(page);
      const a = analyse(rec);
      info.annotations.push({ type: 'hareket', description: JSON.stringify(a) });
      expect(a.reversals, 'hedeften uzaklaşan kare (taşma/titreme)').toBe(0);
      expect(a.overlayScroll, 'katman odakla kaydırıldı').toBe(0);
      expect(a.widthDelta, 'belge genişliği değişti').toBe(0);
      expect(a.shiftX, 'sayfa içeriği yana kaydı').toBeLessThanOrEqual(0.5);
      expect(a.startDist, 'açılış animasyonu yok').toBeGreaterThan(5);
      expect(a.settleMs).toBeLessThanOrEqual(340); // 260 ms geçiş + kare payı
      const props = await page.evaluate(() => {
        const s = document.querySelector('[data-dp-surface]');
        const o = document.querySelector('[data-dp-overlay]');
        const list = (el, pseudo) => getComputedStyle(el, pseudo).transitionProperty.split(',').map((x) => x.trim());
        return { surface: list(s), overlay: list(o), scrim: list(o, '::before'), backdrop: getComputedStyle(o).backdropFilter, dur: getComputedStyle(s).transitionDuration };
      });
      for (const p of props.surface) expect(['transform', 'opacity']).toContain(p);
      for (const p of props.overlay) expect(['visibility']).toContain(p);
      for (const p of props.scrim) expect(['opacity']).toContain(p);
      expect(props.backdrop === 'none' || props.backdrop === '' || props.backdrop === undefined).toBe(true);
      for (const d of props.dur.split(',')) {
        const ms = parseFloat(d) * (d.includes('ms') ? 1 : 1000);
        expect(ms).toBeGreaterThanOrEqual(200);
        expect(ms).toBeLessThanOrEqual(280);
      }
    });

    test('kapanış: tek yönlü, sayfa yana kaymaz', async ({ page }) => {
      test.setTimeout(60000);
      await page.goto(url(kind, '&dp_long=1'), { waitUntil: 'load' });
      await page.locator('[data-dp-open]').first().click();
      await expect(page.locator('dialog[open] [data-dp-surface]')).toBeVisible();
      await page.waitForTimeout(400); // açılış geçişi bitsin (sabit bekleme yalnız geçiş süresi kadar)
      const res = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const center = document.querySelector('#dp-sim-center');
            const cx0 = center.getBoundingClientRect().x;
            const cw0 = document.body.getBoundingClientRect().width;
            const frames = [];
            const t0 = performance.now();
            const loop = () => {
              const s = document.querySelector('[data-dp-surface]');
              const r = s.getBoundingClientRect();
              // Diyalog kapandıktan sonraki kareler (yüzey yerleşmez: kutu 0,0) hareket ölçümüne girmez.
              const open = Boolean(document.querySelector('dialog[open]')) && r.width > 0;
              frames.push({ open, x: r.x, y: r.y, cx: center.getBoundingClientRect().x, cw: document.body.getBoundingClientRect().width });
              if (performance.now() - t0 < 500) requestAnimationFrame(loop);
              else resolve({ frames, cx0, cw0 });
            };
            document.querySelector('[data-dp-close]').click();
            requestAnimationFrame(loop);
          })
      );
      const start = res.frames[0];
      const d = res.frames.filter((f) => f.open).map((f) => Math.hypot(f.x - start.x, f.y - start.y));
      expect(res.frames.some((f) => !f.open), 'kapanış 500 ms içinde bitmeli').toBe(true);
      let back = 0;
      for (let i = 1; i < d.length; i += 1) if (d[i] + 0.75 < d[i - 1] && d[i - 1] > 0) back += 1;
      expect(back, 'kapanışta geri dönen kare').toBe(0);
      expect(Math.max(...res.frames.map((f) => Math.abs(f.cx - res.cx0)))).toBeLessThanOrEqual(0.5);
      expect(Math.max(...res.frames.map((f) => Math.abs(f.cw - res.cw0)))).toBe(0);
    });

    test('azaltılmış hareket: ilk karelerde yerinde (animasyonsuz)', async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(`${process.env.E2E_BASE_URL}${url(kind, '&dp_long=1')}`, { waitUntil: 'load' });
      const rec = await recordOpen(page);
      // Animasyonsuz: başlangıç ile son konum arasında ara konumda kare (en çok 1: geçiş 1 ms) — süre ölçümü değil.
      const end = rec.frames[rec.frames.length - 1];
      const dist = rec.frames.map((f) => Math.hypot(f.x - end.x, f.y - end.y));
      const between = dist.filter((d) => d > 1 && d < dist[0] - 1).length;
      expect(between, `ara kare (${JSON.stringify(dist.slice(0, 6).map(Math.round))})`).toBeLessThanOrEqual(1);
      expect(analyse(rec).reversals).toBe(0);
      await context.close();
    });
  });
}

test('klasik (yer kaplayan) kaydırma çubuğu: açılış/kapanışta genişlik ve yatay konum sabit', async ({ browserName }, info) => {
  test.skip(browserName !== 'chromium' || info.project.name !== 'desktop', 'klasik çubuk: masaüstü Chromium');
  test.setTimeout(90000);
  // Başsız Playwright çubukları gizler (--hide-scrollbars): ayrı tarayıcı çubuklu açılır; ::-webkit-scrollbar klasik çubuk verir.
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const page = await browser.newPage({ baseURL: process.env.E2E_BASE_URL, viewport: { width: 1280, height: 800 } });
  for (const kind of KINDS) {
    await page.goto(url(kind, '&dp_long=1&dp_sb=1'), { waitUntil: 'load' });
    const gap = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
    expect(gap, 'klasik çubuk yer kaplamalı').toBeGreaterThan(0);
    const a = analyse(await recordOpen(page));
    expect(a.widthDelta, `${kind}: belge genişliği`).toBe(0);
    expect(a.shiftX, `${kind}: yatay kayma`).toBeLessThanOrEqual(0.5);
  }
  // Çubuk yokken (kısa sayfa) boşluk EKLENMEZ: kilitte genişlik yine değişmez.
  await page.goto(url('side_panel', '&dp_sb=1'), { waitUntil: 'load' });
  const a = analyse(await recordOpen(page));
  expect(a.widthDelta).toBe(0);
  await browser.close();
});

test.describe('odak görünümü', () => {
  const ring = (page, sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, offset: parseFloat(cs.outlineOffset), shadow: cs.boxShadow, border: cs.borderTopColor, bw: parseFloat(cs.borderTopWidth) };
    }, sel);
  const visibleRing = (r) => r.style !== 'none' && r.width > 0 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(r.color);

  test('alan: dokunuş/fareyle ince kenarlık, klavyede 2 px aralıklı halka', async ({ page, browserName }, info) => {
    test.setTimeout(60000);
    await page.goto(url('inline'), { waitUntil: 'load' });
    // Serbest tutar alanı (çerçeveyi saran kap taşır): ilk adımda her zaman görünür metin alanı.
    const box = '.donation-panel-exp .donation-panel-custom';
    const target = page.locator(`${box} .donation-panel-custom__in`).first();
    await expect(target).toBeVisible();
    const before = await ring(page, box);
    if (info.project.name === 'desktop') await target.click();
    else await target.tap();
    await expect(target).toBeFocused();
    await page.waitForTimeout(250); // kenarlık rengi geçişi (160 ms) bitsin
    const r1 = await ring(page, box);
    expect(visibleRing(r1), `tıklamada halka olmamalı (${JSON.stringify(r1)})`).toBe(false);
    expect(r1.shadow, 'kalın gölge halkası yok').toBe('none');
    expect(r1.border, 'kenarlık marka rengine döner').not.toBe(before.border);
    expect(r1.bw).toBeLessThanOrEqual(1.5);
    test.skip(browserName === 'webkit', 'WebKit Tab yalnız sistem ayarıyla alanlara gezinir; klavye halkası Chromium/masaüstünde doğrulanır');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await target.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const r2 = await ring(page, box);
    expect(visibleRing(r2), `klavyede halka olmalı (${JSON.stringify(r2)})`).toBe(true);
    expect(r2.width).toBe(2);
    expect(r2.offset).toBe(2);
  });

  test('düğme: tıklamada halka yok, klavyede 2 px halka (≥3:1)', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit düğmeye Tab ile odaklanmaz (sistem ayarı)');
    await page.goto(url('inline'), { waitUntil: 'load' });
    const btn = page.locator('.donation-panel-exp [data-dp-preset]').first();
    await btn.click();
    const r1 = await ring(page, '.donation-panel-exp [data-dp-preset]');
    expect(visibleRing(r1)).toBe(false);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const r2 = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, inPanel: Boolean(el.closest('.donation-panel')) };
    });
    expect(r2.inPanel).toBe(true);
    expect(r2.style).toBe('solid');
    expect(r2.width).toBe(2);
    // Yarı saydam halka beyaz yüzeyde ≥3:1 (WCAG 1.4.11).
    const contrast = await page.evaluate((color) => {
      const c = document.createElement('canvas').getContext('2d');
      c.fillStyle = '#fff';
      c.fillRect(0, 0, 1, 1);
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      return 1.05 / (L + 0.05);
    }, r2.color);
    expect(contrast).toBeGreaterThanOrEqual(3);
  });
});

test.describe('liste kartı ön alma', () => {
  test('form önceden alınır; dokunuşta REST isteği 0; panel açılır; sokulmuş başka köken düğmesi istek yapmaz', async ({ page }) => {
    test.setTimeout(90000);
    const requests = [];
    page.on('request', (r) => requests.push({ url: r.url(), t: Date.now() }));
    await page.goto(url('list'), { waitUntil: 'load' });
    const cta = page.locator('.wdp-list-wrap .wdp-card__cta[data-wdp-form]:not(#dp-rogue)').first();
    // Yüklemede eklenti isteği yok (ön alma ilk etkileşimde ya da yüklemeden 1 sn sonra boşta başlar; form BELLEKTE tutulur).
    expect(requests.filter((r) => /donation-panel(\/|%2F)v1/.test(r.url)).length, 'yüklemede eklenti REST isteği').toBe(0);
    await page.mouse.move(5, 5); // ilk etkileşim
    await page.mouse.move(40, 40);
    await expect(cta).toHaveAttribute('data-wdp-ready', '1', { timeout: 15000 });
    const batch = requests.filter((r) => /donation-panel(\/|%2F)v1(\/|%2F)experiences/.test(r.url));
    expect(batch.length, 'tek toplu istek').toBe(1);
    const tPre = await page.evaluate(() => performance.now());
    await cta.click();
    await expect(page.locator('dialog[open] [data-dp-surface]')).toBeVisible();
    // Dokunuşta AĞA giden eklenti isteği yok (form bellekte).
    const network = await page.evaluate(
      (from) => performance.getEntriesByType('resource').filter((r) => r.startTime >= from && /donation-panel(\/|%2F)v1/.test(r.name) && r.transferSize > 0).length,
      tPre
    );
    expect(network, 'dokunuşta eklenti REST ağ isteği').toBe(0);
    await page.keyboard.press('Escape');
    // Güvenlik: başka kökene işaret eden sokulmuş düğme yok sayılır (istek yok, varsayılan bağlantı davranışı).
    await page.locator('#dp-rogue').hover();
    await page.locator('#dp-rogue').click();
    expect(requests.some((r) => r.url.includes('evil.invalid'))).toBe(false);
  });
});
