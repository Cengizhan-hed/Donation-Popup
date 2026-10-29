#!/usr/bin/env node
/**
 * Eklentiye ait KESİN hız sayıları (CLAUDE.md §25 hız kabul ölçütü; Lighthouse gürültüsünden bağımsız).
 *
 *   Yerel (varsayılan; tek kullanımlık işçi WP + SQLite, gzip vekili):
 *     npm run e2e:queue -- node scripts/measure-plugin-perf.mjs [--theme twentytwentyfive] [--lh-runs 7] [--no-lh]
 *   Uzak (yalnız GET; yazma/sipariş yok; yalnız Claude, merkezi profil korumasıyla):
 *     npm run e2e:queue -- node scripts/measure-plugin-perf.mjs --env staging-hedef \
 *       --pages "ana=/,urun=/urun/x/,liste=/bagislar/" --ui urun,liste [--lh-label on|off] [--lh-pages urun]
 *   Çalışan yerel site: --url http://127.0.0.1:PORT --pages … --ui … (yalnız localhost/127.0.0.1).
 *
 * Ölçütler (eşikler scripts/lib/plugin-perf.mjs THRESHOLDS):
 *  1) Arayüzsüz sayfa: eklentiden istek/bayt/çerez/DOM = 0 (tarayıcı); yerelde sorgu farkı (kapalı→açık) = 0 (yoklama).
 *  2) Arayüzlü sayfa: render engelleyen eklenti dosyası (Resource Timing `renderBlockingStatus`) = 0; ilk yük eklenti
 *     baytları: satır içi CSS (`<style id="donation-panel-inline-*">`, gzip tahmini), CSS ve JS (aktarılan gövde,
 *     `encodedBodySize`) ayrı ayrı ve toplam.
 *  3) Eklenti betiklerinin ana iş parçacığı süresi: CDP Tracing (devtools.timeline + v8), 4× CPU + yavaş 4G'de yükleme;
 *     eklenti dizinindeki betiklerin derleme + değerlendirme + çağrı aralıkları birleşimi (ms) ve eklentiye atfedilen
 *     50 ms üzeri uzun görev sayısı; soğuk yüklemede WDP_PERF_TRACE_RUNS (varsayılan 3) koşu medyanı.
 *  4) CLS katkısı: `layout-shift` kayıtlarından kaynağı eklenti öğesi (`.donation-panel*` / `[data-dp-*]`) olanlar;
 *     eklenti dışı öğe de kayıyorsa ve kayma web fontu yüklenmesiyle aynı penceredeyse "tema/font" sütununa (eşik dışı).
 *  5) INP: dokunma → panel ve tutar kartına dokunma (Event Timing `duration`), yavaş ağ + 4× CPU; INP_RUNS (5)
 *     yükleme örneğinin medyanı (eşik medyana).
 *  6b) İsteğe bağlı `--forced-layout`: açılış tıklamasının (EventDispatch click) içindeki zorunlu eşzamanlı
 *     UpdateLayoutTree/Layout sayısı ve süresi (CDP izi, 3 koşu medyanı). Yerelde `--heavy-css`: ağır tema CSS'i benzetimi.
 *  6) Dokunuş → panel: click → `dialog[open]` görünür (MutationObserver ile algılanır; rAF yoklaması yok) + iki rAF,
 *     5 koşu medyanı. INP ve dokunuşta hedef: görünür + üstte (elementFromPoint) ilk öğe; yoksa ÖLÇÜLMEDİ.
 *  7) Lighthouse (bilgi): ≥7 koşu medyanı; yerelde eklenti açık/kapalı, uzakta `--lh-label` ile etiketli tek mod.
 * Çıktı: konsol tablosu + build/e2e/plugin-perf/<env>[-<tema>]-<tarih>.json. Çıkış kodu: KALDI varsa 1.
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 8964; PHP = port + 100, önünde gzip vekili).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';
import {
  attributeTrace,
  clsAttribution,
  INP_RUNS,
  inlinePluginStyles,
  inpSummary,
  installTapProbe,
  isPluginCookie,
  isPluginUrl,
  judgeMetric,
  maxInteraction,
  median,
  parsePagesArg,
  pickVisibleTarget,
  verdict,
} from './lib/plugin-perf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'build/e2e/plugin-perf');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8964);
const DEVICE = devices['Pixel 7'];
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'toplevel', 'loading', 'blink.user_timing'];
/** Lighthouse "slow 4G" (mevcut anında açılma ölçümüyle aynı). */
const SLOW_NET = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const TAP_RUNS = 5;
/** İsteğe bağlı (`--forced-layout`): açılış tıklamasında zorunlu stil/düzen sayısı (CDP izi), FORCED_RUNS koşu medyanı. */
const FORCED_LAYOUT = process.argv.includes('--forced-layout');
const FORCED_RUNS = 3;
const TRACE_RUNS = Math.max(1, Number(process.env.WDP_PERF_TRACE_RUNS || 3));
const REMOTE_ENVS = new Set(['staging-hedef', 'ikram-aid']);

/** Yerel sayfa kümesi: measure:load ile aynı kimlikler + sayfa içi form / compact kart. */
const LOCAL_PAGES = [
  { id: 'ana-sayfa', key: 'home', ui: false },
  { id: 'blog-yazisi', key: 'blog', ui: false },
  { id: 'duz-sayfa', key: 'page', ui: false },
  { id: 'bagis-disi-urun', key: 'plainprod', ui: false },
  { id: 'sepet-bos', key: 'cart', ui: false },
  { id: 'odeme-bos', key: 'checkout', ui: false },
  { id: 'hesabim-misafir', key: 'account', ui: false },
  { id: 'magaza', key: 'shop', ui: true },
  { id: 'bagis-urunu', key: 'donation', ui: true },
  { id: 'bagis-urunu-tutar', key: 'donation_custom', ui: true },
  { id: 'bagis-listesi', key: 'list', ui: true },
  { id: 'sayfa-ici-form', key: 'form', ui: true },
  { id: 'compact-kart', key: 'compact', ui: true },
  { id: 'popup', key: 'popup', ui: true },
  { id: 'sag-panel', key: 'panel', ui: true },
  { id: 'alttan-panel', key: 'sheet', ui: true },
  { id: 'slider-6-form', key: 'slider6', ui: true },
  { id: 'slider-6-compact', key: 'slider6c', ui: true },
];

/** Sayfada çalışan gözlemciler: layout-shift (kaynak düğüm atfı) ve Event Timing. */
function pageObservers() {
  const isPluginNode = (node) => {
    for (let el = node && (node.nodeType === 1 ? node : node.parentElement); el; el = el.parentElement) {
      if (el.classList && Array.from(el.classList).some((c) => c === 'donation-panel' || c.indexOf('donation-panel-') === 0)) return true;
      if (el.getAttributeNames && el.getAttributeNames().some((a) => a.indexOf('data-dp-') === 0)) return true;
    }
    return false;
  };
  window.__dpPerf = { shifts: [], events: [], errors: [], fontTimes: [] };
  try {
    // Web fontu yüklenme anları (CLS atfı: font swap kaymaları ayrı sütun).
    // `loadingdone` yalnız TÜM bekleyen yüklemeler bitince bir kez gelir; her yazı tipinin kendi bitişi için
    // `loading` olayındaki her FontFace'in `loaded` sözü izlenir.
    if (document.fonts && document.fonts.addEventListener) {
      const mark = () => window.__dpPerf.fontTimes.push(performance.now());
      document.fonts.addEventListener('loadingdone', mark);
      document.fonts.addEventListener('loading', (e) => {
        for (const face of e.fontfaces || []) face.loaded.then(mark, () => {});
      });
    }
  } catch (e) {
    window.__dpPerf.errors.push(String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__dpPerf.shifts.push({
          value: e.value,
          startTime: e.startTime,
          hadRecentInput: e.hadRecentInput,
          sources: (e.sources || []).map((s) => ({
            plugin: !!s.node && isPluginNode(s.node),
            detached: !s.node,
            // Tanı (JSON'a): düğüm ve dikey/yatay kayma; yalnız etiket + sınıf, içerik yok.
            sel: s.node && s.node.nodeType === 1 ? `${s.node.tagName.toLowerCase()}.${String(s.node.className || '').trim().split(/\s+/).slice(0, 2).join('.')}` : s.node ? '#text' : '',
            dy: Math.round(s.currentRect.y - s.previousRect.y),
            dh: Math.round(s.currentRect.height - s.previousRect.height),
            dx: Math.round(s.currentRect.x - s.previousRect.x),
          })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    window.__dpPerf.errors.push(String(e));
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__dpPerf.events.push({ name: e.name, duration: e.duration, interactionId: e.interactionId || 0, startTime: e.startTime });
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch (e) {
    window.__dpPerf.errors.push(String(e));
  }
}

/** Ana iş parçacığı boşa çıkana kadar (iki rAF + boşta geri çağırma); sabit bekleme değil. */
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 4000 });
            else setTimeout(resolve, 0);
          })
        );
      })
  );
}

/**
 * Bağlam + sayfa; yavaşlatma isteğe bağlı (CDP; yalnız Chromium).
 *
 * @param {import('@playwright/test').Browser} browser Tarayıcı.
 * @param {{throttle?: boolean, prepare?: (ctx: import('@playwright/test').BrowserContext) => Promise<void>}} opts Seçenekler.
 */
async function openPage(browser, opts = {}) {
  const context = await browser.newContext({ ...DEVICE });
  if (opts.prepare) await opts.prepare(context);
  await context.addInitScript(pageObservers);
  const page = await context.newPage();
  if (opts.throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_NET);
  }
  return { context, page };
}

/** Eklenti kaynakları (Resource Timing) ve gezinme zamanları. */
async function resourceSnapshot(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      loadEnd: nav ? nav.loadEventEnd : 0,
      resources: performance.getEntriesByType('resource').map((r) => ({
        url: r.name,
        type: r.initiatorType,
        start: r.startTime,
        end: r.responseEnd,
        transfer: r.transferSize,
        encoded: r.encodedBodySize,
        decoded: r.decodedBodySize,
        blocking: r.renderBlockingStatus || '',
      })),
    };
  });
}

/** Eklenti DOM işareti sayısı (kök sınıf ve `data-dp-*`). */
async function domMarkers(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('*')) {
      if (Array.from(el.classList).some((c) => c === 'donation-panel' || c.indexOf('donation-panel-') === 0) || el.getAttributeNames().some((a) => a.indexOf('data-dp-') === 0)) n += 1;
    }
    return n;
  });
}

const kindOf = (r) => (/\.css(?:\?|$)/i.test(r.url) || r.type === 'link' ? 'css' : /\.m?js(?:\?|$)/i.test(r.url) || r.type === 'script' ? 'js' : 'other');
const short = (u) => u.split('?')[0].split('/woo-donation-popup/').pop();

/**
 * Arayüzsüz sayfa: tarayıcıda eklenti isteği/baytı/çerezi/DOM'u.
 */
async function measureUiLess(browser, url, prepare) {
  const { context, page } = await openPage(browser, { prepare });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    await settle(page);
    const snap = await resourceSnapshot(page);
    const plugin = snap.resources.filter((r) => isPluginUrl(r.url));
    const cookies = (await context.cookies()).filter((c) => isPluginCookie(c.name)).map((c) => c.name);
    return {
      requests: plugin.length,
      bytes: plugin.reduce((n, r) => n + (r.transfer || r.encoded || 0), 0),
      cookies: cookies.length,
      cookieNames: cookies,
      dom: await domMarkers(page),
      files: plugin.map((r) => short(r.url)),
    };
  } finally {
    await context.close();
  }
}

/**
 * Arayüzlü sayfa: yük izi (4× CPU + yavaş 4G), baytlar, engelleyenler, CLS, INP; sonra 5 koşu dokunuş → panel.
 */
async function measureUi(browser, url, prepare, dumpName = '') {
  const out = {};
  const { context, page } = await openPage(browser, { throttle: true, prepare });
  try {
    await browser.startTracing(page, { categories: TRACE_CATEGORIES });
    const res = await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    const html = res ? await res.text() : '';
    if (dumpName && process.env.WDP_PERF_DUMP) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUT_DIR, `${dumpName}.html`), html);
    }
    await settle(page);
    const trace = JSON.parse((await browser.stopTracing()).toString('utf8'));
    const t = attributeTrace(trace);
    out.mainThreadMs = t.scriptMs;
    out.mainThreadByFile = t.byUrl;
    out.longTasks = t.longTasks;
    out.longTaskDetails = t.longTaskDetails;
    out.contributedLongTasks = t.contributedLongTasks;
    out.allLongTasks = t.allLongTasks;

    const snap = await resourceSnapshot(page);
    const plugin = snap.resources.filter((r) => isPluginUrl(r.url));
    const initial = plugin.filter((r) => r.start <= snap.loadEnd || !snap.loadEnd);
    const later = plugin.filter((r) => snap.loadEnd && r.start > snap.loadEnd);
    const sum = (list) => list.reduce((n, r) => n + (r.encoded || 0), 0);
    const css = initial.filter((r) => kindOf(r) === 'css');
    const js = initial.filter((r) => kindOf(r) === 'js');
    const inline = inlinePluginStyles(html);
    out.blocking = plugin.filter((r) => r.blocking === 'blocking').length;
    out.blockingFiles = plugin.filter((r) => r.blocking === 'blocking').map((r) => short(r.url));
    out.inlineCss = inline;
    out.cssGzip = sum(css);
    out.jsGzip = sum(js);
    out.cssFiles = css.map((r) => `${short(r.url)} ${r.encoded}B`);
    out.jsFiles = js.map((r) => `${short(r.url)} ${r.encoded}B`);
    out.otherInitial = initial.filter((r) => kindOf(r) === 'other').map((r) => short(r.url));
    out.laterFiles = later.map((r) => `${short(r.url)} ${r.encoded}B`);
    out.totalGzip = inline.gzip + out.cssGzip + out.jsGzip;
    out.dom = await domMarkers(page);

    // INP: dokunma → panel, tutar kartı (izleme kapalıyken; yavaşlatma sürer). İlk örnek bu yüklemeden; kalan
    // INP_RUNS-1 örnek aşağıda yeni yüklemelerle; eşik medyana uygulanır.
    const hasTrigger = (await page.locator('[data-dp-open]:visible').count()) > 0;
    const first = await inpSample(page, hasTrigger);
    const perf = first.perf;
    const inpSamples = [first];
    // CLS: yalnız yükleme (girdi öncesi kaymalar; hadRecentInput olanlar zaten dışarıda).
    const fontEnds = snap.resources.filter((r) => /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(r.url) || r.type === 'font').map((r) => r.end);
    out.fontTimes = [...perf.fontTimes, ...fontEnds].filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n));
    out.cls = clsAttribution(perf.shifts, { fontTimes: out.fontTimes });
    out.foreignCss = snap.resources.filter((r) => !isPluginUrl(r.url) && kindOf(r) === 'css').map((r) => `${short(r.url).slice(-50)} @${Math.round(r.end)} ${r.blocking}`);
    out.shifts = perf.shifts.filter((s) => !s.hadRecentInput).map((s) => ({ v: +Number(s.value).toFixed(5), t: Math.round(s.startTime), src: s.sources.map((x) => (x.plugin ? 'P' : x.detached ? 'D' : 'T')).join(''), nodes: s.sources.map((x) => `${x.sel} dy${x.dy} dh${x.dh} dx${x.dx}`) }));
    out.observerErrors = perf.errors;
    out.hasTrigger = hasTrigger;
    for (let i = 1; i < INP_RUNS; i += 1) {
      await page.goto(url, { waitUntil: 'load', timeout: 180000 });
      await settle(page);
      inpSamples.push(await inpSample(page, hasTrigger));
    }
    const inp = inpSummary(inpSamples);
    out.inpOpen = inp.open;
    out.inpAmount = inp.amount;
    out.inpOpenRuns = inp.openRuns;
    out.inpAmountRuns = inp.amountRuns;
    out.inpSkips = inpSamples.flatMap((s) => s.skips || []);

    // 6) Dokunuş → panel: 5 koşu (her koşu yeni yükleme), click + 60 ms basılı kalma, dialog[open] görünür + iki rAF.
    out.tapRuns = [];
    out.tapSkips = [];
    if (hasTrigger) {
      for (let i = 0; i < TAP_RUNS; i += 1) {
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await settle(page);
        // Görünür ve üstteki ilk tetikleyici; yoksa ya da dokunulamazsa bu koşu ÖLÇÜLMEDİ (hata değil; neden satıra).
        const target = await visibleTarget(page, '[data-dp-open]');
        if (target.index < 0) {
          out.tapSkips.push(target.reason);
          continue;
        }
        // Algılama MutationObserver ile (rAF yoklaması değil): açılış anına kare gecikmesi eklenmez.
        await page.evaluate(`(${installTapProbe})(window, '[data-dp-open]', ${target.index})`);
        if (!(await tapAt(page, target, 'click'))) continue;
        await page.waitForFunction(() => window.__dpTap && window.__dpTap.t1 > 0, null, { timeout: 20000 });
        out.tapRuns.push(Math.round(await page.evaluate(() => window.__dpTap.t1 - window.__dpTap.t0)));
      }
    }
    out.tapMedian = out.tapRuns.length ? median(out.tapRuns) : NaN;
    // İsteğe bağlı: açılış tıklamasının içindeki zorunlu eşzamanlı stil/düzen hesapları (CDP izi).
    if (FORCED_LAYOUT && hasTrigger) {
      const runs = [];
      for (let i = 0; i < FORCED_RUNS; i += 1) {
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await settle(page);
        const target = await visibleTarget(page, '[data-dp-open]');
        if (target.index < 0) continue;
        await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
        const tapped = await tapAt(page, target, 'click');
        if (tapped) await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 20000 });
        await settle(page);
        const trace = JSON.parse((await browser.stopTracing()).toString('utf8'));
        if (tapped) runs.push(forcedLayoutsInClick(trace));
      }
      out.forcedLayout = runs.length
        ? { forced: median(runs.map((r) => r.forced)), clickMs: median(runs.map((r) => r.clickMs)), styleMs: median(runs.map((r) => r.styleMs)), layoutMs: median(runs.map((r) => r.layoutMs)), runs: runs.map((r) => r.forced), items: runs[runs.length - 1].items }
        : null;
    }
  } finally {
    await context.close();
  }
  // Ana iş parçacığı tek izde gürültülü (aynı sayfa 34–113 ms görüldü): ek soğuk yüklemelerle TRACE_RUNS koşu medyanı.
  out.mainThreadRuns = [out.mainThreadMs];
  out.longTaskRuns = [out.longTasks];
  for (let i = 1; i < TRACE_RUNS; i += 1) {
    const t = await traceLoad(browser, url, prepare);
    out.mainThreadRuns.push(t.scriptMs);
    out.longTaskRuns.push(t.longTasks);
  }
  out.mainThreadMs = median(out.mainThreadRuns);
  out.longTasks = median(out.longTaskRuns);
  return out;
}

/**
 * Tek INP örneği (yüklenmiş ve durulmuş sayfada): tetikleyici varsa dokunma → panel, sonra seçilmemiş tutar kartı.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {boolean} hasTrigger Panel tetikleyicisi var mı.
 * @return {Promise<{open:number, amount:number, perf:object}>} Süreler (ms; ölçülmediyse NaN) ve gözlemci verisi.
 */
async function inpSample(page, hasTrigger) {
  const marks = {};
  const skips = [];
  let opened = false;
  if (hasTrigger) {
    const target = await visibleTarget(page, '[data-dp-open]');
    if (target.index < 0) skips.push(target.reason);
    const t = await page.evaluate(() => performance.now());
    if (target.index >= 0 && (await tapAt(page, target))) {
      await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 20000 });
      marks.open = t;
      opened = true;
      await settle(page);
    }
  }
  // Tutar kartı: görünür ve üstteki ilk seçilmemiş kart (slider'da ekran dışı / üst üste slayt elenir); yoksa ÖLÇÜLMEDİ.
  if (!hasTrigger || opened) {
    const presetSel = `${hasTrigger ? 'dialog[open] ' : ''}[data-dp-preset][aria-checked="false"]`;
    const target = await visibleTarget(page, presetSel);
    if (target.index < 0) skips.push(target.reason);
    const t = await page.evaluate(() => performance.now());
    if (target.index >= 0 && (await tapAt(page, target))) {
      marks.amount = t;
      await settle(page);
    }
  }
  await settle(page);
  const perf = await page.evaluate(() => window.__dpPerf);
  return {
    open: marks.open !== undefined ? maxInteraction(perf.events, marks.open, marks.amount !== undefined ? marks.amount : Infinity) : NaN,
    amount: marks.amount !== undefined ? maxInteraction(perf.events, marks.amount) : NaN,
    perf,
    skips,
  };
}

/**
 * Görünür, yatayda ekran içinde, dikeyde ortalanmış ve üstteki (elementFromPoint kendisi/soyu) ilk hedef ve doğrulanmış
 * dokunma noktası; yoksa `index:-1` ve neden (konsola da yazılır).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} selector Saf CSS seçici.
 * @return {Promise<{index:number, x:number, y:number, reason:string}>} Hedef.
 */
async function visibleTarget(page, selector) {
  const t = await page.evaluate(`(${pickVisibleTarget})(window, ${JSON.stringify(selector)})`);
  if (t.index < 0) console.warn(`ÖLÇÜLMEDİ (${selector}): ${t.reason}`);
  return t;
}

/**
 * Doğrulanmış noktaya dokunma (ya da 60 ms basılı tıklama). Playwright'ın kendi kaydırması/isabet denetimi kullanılmaz
 * (yapışkan üstbilgi altına kaydırıp "örtülü" sayabiliyordu); nokta `pickVisibleTarget` ile az önce doğrulandı ve
 * arada kaydırma yok. Hata olursa false → ÖLÇÜLMEDİ (hata değil).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {{x:number, y:number}} target Nokta.
 * @param {'tap'|'click'} [how] Yöntem.
 * @return {Promise<boolean>} Dokunuldu mu.
 */
async function tapAt(page, target, how = 'tap') {
  try {
    if (how === 'click') await page.mouse.click(target.x, target.y, { delay: 60 });
    else await page.touchscreen.tap(target.x, target.y);
    return true;
  } catch (e) {
    console.warn(`ÖLÇÜLMEDİ (dokunma): ${e && e.message ? e.message.split('\n')[0] : e}`);
    return false;
  }
}

/** Yalnız iz: soğuk bağlamda 4× CPU + yavaş 4G yükleme. */
async function traceLoad(browser, url, prepare) {
  const { context, page } = await openPage(browser, { throttle: true, prepare });
  try {
    await browser.startTracing(page, { categories: TRACE_CATEGORIES });
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    await settle(page);
    return attributeTrace(JSON.parse((await browser.stopTracing()).toString('utf8')));
  } finally {
    await context.close();
  }
}

/** Ölçüm satırlarını eşiklerle değerlendirir. */
function judgeRows(rows) {
  const checks = [];
  for (const r of rows) {
    const add = (key, v) => checks.push({ page: r.id, ...judgeMetric(key, v) });
    if (r.error) {
      checks.push({ page: r.id, key: 'error', label: 'Ölçüm hatası', value: NaN, limit: '-', pass: false });
      continue;
    }
    if (!r.ui) {
      add('uiLessRequests', r.m.requests);
      add('uiLessBytes', r.m.bytes);
      add('uiLessCookies', r.m.cookies);
      add('uiLessDom', r.m.dom);
      add('uiLessQueries', r.m.queries === undefined ? NaN : r.m.queries);
      continue;
    }
    if (r.m.skipped) continue;
    add('blocking', r.m.blocking);
    add('inlineCssSurfaceGzip', r.m.inlineCss.maxSurfaceGzip);
    add('inlineCssGzip', r.m.inlineCss.gzip);
    add('cssGzip', r.m.cssGzip);
    add('jsGzip', r.m.jsGzip);
    add('mainThreadMs', r.m.mainThreadMs);
    add('longTasks', r.m.longTasks);
    add('cls', r.m.cls.plugin);
    add('inpOpen', r.m.inpOpen);
    add('inpAmount', r.m.inpAmount);
    add('tapToPanel', r.m.tapMedian);
  }
  return checks;
}

function printReport(label, rows, checks, lh) {
  const fmt = (v) => (Number.isFinite(v) ? String(v) : '—');
  console.log(`\n## measure:plugin-perf — ${label}`);
  console.log('\nArayüzsüz sayfalar (hedef 0)');
  console.log('| sayfa | istek | bayt | çerez | DOM | sorgu Δ |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => !x.ui && !x.error)) {
    console.log(`| ${r.id} | ${r.m.requests} | ${r.m.bytes} | ${r.m.cookies} | ${r.m.dom} | ${fmt(r.m.queries)} |`);
  }
  console.log('\nArayüzlü sayfalar (4× CPU + yavaş 4G, Pixel 7)');
  console.log('| sayfa | engelleyen | satır içi CSS gz (en büyük yüzey) | CSS dosyası gz | JS gz | toplam gz | ana iş ms medyan [koşular] | uzun görev | CLS eklenti | CLS tema/font | INP aç/tutar ms medyan (5) [koşular] | dokunuş→panel medyan (5) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.ui && !x.error)) {
    const m = r.m;
    if (m.skipped) {
      console.log(`| ${r.id} | — atlandı: ${m.skipped} |`);
      continue;
    }
    console.log(
      `| ${r.id} | ${m.blocking} | ${m.inlineCss.gzip} B (${m.inlineCss.count}; ${m.inlineCss.maxSurfaceGzip} B) | ${m.cssGzip} B | ${m.jsGzip} B | ${m.totalGzip} B | ${m.mainThreadMs} [${(m.mainThreadRuns || []).join(',')}] | ${m.longTasks} (+${m.contributedLongTasks} katkılı) | ${m.cls.plugin} | ${m.cls.font} | ${fmt(m.inpOpen)}/${fmt(m.inpAmount)} [${(m.inpOpenRuns || []).join(',')}/${(m.inpAmountRuns || []).join(',')}] | ${fmt(m.tapMedian)} [${m.tapRuns.join(',')}] |`
    );
  }
  for (const r of rows.filter((x) => x.ui && !x.error && x.m && !x.m.skipped)) {
    const skips = [...new Set([...(r.m.tapSkips || []), ...(r.m.inpSkips || [])])];
    if (skips.length) console.log(`ÖLÇÜLMEDİ nedeni ${r.id}: ${skips.join(' | ')}`);
  }
  const forcedRows = rows.filter((x) => x.ui && !x.error && x.m && x.m.forcedLayout);
  if (forcedRows.length) {
    console.log('\nAçılış tıklamasında zorunlu eşzamanlı stil/düzen (CDP izi, ≥0.5 ms; medyan [koşular])');
    console.log('| sayfa | zorunlu sayı | click işleyici ms | stil ms | düzen ms | son koşu ayrıntı |');
    console.log('|---|---|---|---|---|---|');
    for (const r of forcedRows) {
      const f = r.m.forcedLayout;
      console.log(`| ${r.id} | ${f.forced} [${f.runs.join(',')}] | ${f.clickMs} | ${f.styleMs} | ${f.layoutMs} | ${f.items.map((i) => `${i.name === 'Layout' ? 'L' : 'S'}${i.ms}${i.elements ? `/${i.elements}` : ''}`).join(' ')} |`);
    }
  }
  for (const r of rows.filter((x) => x.error)) console.log(`HATA ${r.id}: ${r.error}`);
  if (lh && lh.length) {
    console.log('\nLighthouse (bilgi; medyan) | sayfa | mod | koşu | puan | LCP | CLS | TBT |');
    for (const l of lh) console.log(`| ${l.page} | ${l.mode} | ${l.runs} | ${l.score} | ${Math.round(l.lcp)} | ${l.cls.toFixed(3)} | ${Math.round(l.tbt)} |`);
  }
  const bad = checks.filter((c) => c.pass === false);
  console.log(`\nÖlçüt: ${checks.filter((c) => c.pass).length} GEÇTİ, ${bad.length} KALDI, ${checks.filter((c) => c.pass === null).length} ÖLÇÜLMEDİ`);
  for (const c of bad) console.log(`- KALDI ${c.page}: ${c.label} = ${c.value} (${c.limit})`);
}

/** Lighthouse medyanları (bilgi). */
async function runLighthouseSet(urls, runs, modes, setMode, extraFlags = []) {
  const { lighthouse } = await import('./measure-lighthouse.mjs');
  const out = [];
  for (const { id, url } of urls) {
    const samples = Object.fromEntries(modes.map((m) => [m, []]));
    for (let i = 0; i < runs; i += 1) {
      for (const mode of i % 2 ? modes.slice().reverse() : modes) {
        if (setMode) setMode(mode);
        await fetch(url, { signal: AbortSignal.timeout(120000) }); // ısınma
        samples[mode].push(await lighthouse(url, '', extraFlags));
      }
    }
    for (const mode of modes) {
      const s = samples[mode];
      out.push({ page: id, mode, runs: s.length, score: median(s.map((x) => x.score)), lcp: median(s.map((x) => x.lcp)), cls: median(s.map((x) => x.cls)), tbt: median(s.map((x) => x.tbt)), fcp: median(s.map((x) => x.fcp)) });
    }
  }
  return out;
}

function arg(argv, name, def) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}

function writeOut(envLabel, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(OUT_DIR, `${envLabel}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

/** Yerel: işçi WP kur, sayfaları ölç (eklenti durumları dosyayla). */
async function runLocal(argv) {
  const { loadMatrix } = await import('../tests/e2e/helpers/matrix-cover.mjs');
  const { ensureMatrixTemplate, ensureTheme, prepareConfigSnapshot, materializeWorker, startPhpServer, restoreSqlite } = await import('../tests/e2e/helpers/matrix-setup.mjs');
  const { parsePage } = await import('./measure-load.mjs');
  const { startGzipProxy } = await import('./measure-lighthouse.mjs');
  const theme = arg(argv, '--theme', 'twentytwentyfive');
  const only = String(arg(argv, '--only', '')).split(',').filter(Boolean);
  const matrix = loadMatrix();
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `pp-${theme}`, themeSpec: { slug: theme }, storeSpec: matrix.stores.try, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probeMeta = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  const mu = path.join(wpDir, 'wp-content/mu-plugins');
  for (const f of ['wdp-scope-sim.php', 'wdp-load-probe.php', 'wdp-perf-pages.php', 'wdp-heavy-css-sim.php']) fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers', f), path.join(mu, f));
  restoreSqlite(wpDir, snap);
  const wc = (f) => path.join(wpDir, 'wp-content', f);
  // `--heavy-css`: ağır tema CSS'i + kalabalık DOM + sabit üstbilgi benzetimi (tema adı yok; tests/e2e/helpers/wdp-heavy-css-sim.php).
  const heavy = argv.includes('--heavy-css');
  fs.writeFileSync(wc('wdp-heavy-css.json'), JSON.stringify(heavy ? { rules: 3000, nodes: 1000, sticky: 1 } : {}));
  for (const f of ['wdp-scope-sim-urls.json', 'wdp-perf-pages-urls.json']) fs.rmSync(wc(f), { force: true });
  const setState = (s) => fs.writeFileSync(wc('wdp-load-probe.json'), JSON.stringify(s));
  setState({});
  fs.writeFileSync(wc('wdp-scope-sim.json'), '{}');
  fs.writeFileSync(wc('wdp-perf-pages.json'), JSON.stringify({ product_id: probeMeta.products.custom.id }));

  const phpPort = PORT + 100;
  const server = await startPhpServer({ wpDir, port: phpPort });
  const proxy = await startGzipProxy(PORT, phpPort);
  const base = `http://127.0.0.1:${PORT}`;
  const rows = [];
  let lh = [];
  const browser = await chromium.launch({ headless: true });
  try {
    await fetch(`${base}/`, { signal: AbortSignal.timeout(120000) }); // tohumlama (sayfalar oluşur)
    const urls = { ...JSON.parse(fs.readFileSync(wc('wdp-scope-sim-urls.json'), 'utf8')), ...JSON.parse(fs.readFileSync(wc('wdp-perf-pages-urls.json'), 'utf8')) };
    urls.donation = probeMeta.products.fixed.path;
    urls.donation_custom = probeMeta.products.custom.path;
    const queries = async (p) => {
      const q = async (s) => {
        setState(s);
        await fetch(`http://127.0.0.1:${phpPort}${p}`, { signal: AbortSignal.timeout(120000) });
        const r = await fetch(`http://127.0.0.1:${phpPort}${p}`, { signal: AbortSignal.timeout(120000) });
        const probe = parsePage(await r.text(), base).probe;
        return probe.queries - probe.sql.filter((x) => /_transient(?:_timeout)?_wc_related_/.test(x)).length;
      };
      const off = await q({ plugin_off: 1 });
      const on = await q({ modules_all: 1 });
      return on - off;
    };
    for (const pg of LOCAL_PAGES.filter((p) => !only.length || only.includes(p.id))) {
      const url = `${base}${urls[pg.key]}`;
      try {
        if (!pg.ui) {
          const dq = await queries(urls[pg.key]);
          setState({ modules_all: 1 }); // en kötü durum: tüm modüller açık
          const m = await measureUiLess(browser, url);
          rows.push({ id: pg.id, ui: false, url: urls[pg.key], m: { ...m, queries: dq } });
        } else {
          setState({}); // gerçek kurulum: varsayılan modüller
          if (pg.key === 'compact') {
            const html = await (await fetch(url, { signal: AbortSignal.timeout(120000) })).text();
            if (!/data-dp-[a-z-]*compact|donation-panel[a-z-]*compact/i.test(html)) {
              rows.push({ id: pg.id, ui: true, url: urls[pg.key], m: { skipped: 'compact düzen bu sürümde yok (kısa kod bugünkü formu çiziyor)' } });
              continue;
            }
          }
          rows.push({ id: pg.id, ui: true, url: urls[pg.key], m: await measureUi(browser, url, undefined, `local-${theme}-${pg.id}`) });
        }
        console.error(`[plugin-perf] ${theme}/${pg.id} tamam`);
      } catch (e) {
        rows.push({ id: pg.id, ui: pg.ui, url: urls[pg.key], error: String(e && e.message ? e.message : e).slice(0, 300) });
      }
    }
    if (!argv.includes('--no-lh')) {
      await browser.close(); // bellek: Lighthouse kendi Chrome'unu açar
      const runs = Math.max(7, Number(arg(argv, '--lh-runs', '7')));
      const ids = String(arg(argv, '--lh-pages', 'bagis-urunu')).split(',').filter(Boolean);
      const lhUrls = LOCAL_PAGES.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, url: `${base}${urls[p.key]}` }));
      lh = await runLighthouseSet(lhUrls, runs, ['off', 'on'], (mode) => setState(mode === 'off' ? { plugin_off: 1 } : {}));
    }
  } finally {
    await browser.close();
    proxy.close();
    await server.stop();
  }
  return { label: `local-${theme}${heavy ? '-agir-css' : ''}`, theme, rows, lh };
}

/** Uzak (ya da çalışan yerel site): yalnız GET gezinme, dokunma ile panel açma; gönderim yok. */
async function runRemote(argv) {
  const envId = arg(argv, '--env', '');
  const urlArg = arg(argv, '--url', '');
  const pages = parsePagesArg(arg(argv, '--pages', ''));
  const uiIds = new Set(String(arg(argv, '--ui', '')).split(',').filter(Boolean));
  if (!pages.length) throw new Error('--pages "id=/yol,…" zorunlu (uzak ya da --url modunda)');
  let base = '';
  let prepare;
  let withShare = (u) => u;
  let lhFlags = [];
  if (envId) {
    if (!REMOTE_ENVS.has(envId)) throw new Error(`izinli uzak ortamlar: ${[...REMOTE_ENVS].join(', ')}`);
    if (urlArg) throw new Error('--env ile --url birlikte verilmez (adres profilden gelir)');
    const { loadE2EEnv } = await import('../tests/e2e/helpers/env.mjs');
    const { applyComingSoonBypass, withComingSoonShare } = await import('../tests/e2e/helpers/coming-soon.mjs');
    const { installBrowserGuard, TRACKER_HOST_SUFFIXES } = await import('../tests/e2e/helpers/network-guard.mjs');
    const env = loadE2EEnv({ envId });
    base = env.E2E_BASE_URL.replace(/\/$/, '');
    const profile = env._profile;
    prepare = async (ctx) => {
      await applyComingSoonBypass(ctx, profile, env);
    };
    withShare = (u) => withComingSoonShare(u, env, profile);
    lhFlags = TRACKER_HOST_SUFFIXES.map((h) => `--blocked-url-patterns=*${h}*`);
    return { base, prepare, withShare, lhFlags, pages, uiIds, label: envId, guard: (b) => installBrowserGuard(b, env, { remote: true, siteHost: new URL(base).hostname }) };
  }
  const host = new URL(urlArg).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('--url yalnız yerel adres (uzak site için --env staging-hedef|ikram-aid)');
  base = urlArg.replace(/\/$/, '');
  return { base, prepare, withShare, lhFlags, pages, uiIds, label: 'url-local', guard: () => {} };
}

async function measureRemote(argv) {
  const cfg = await runRemote(argv);
  const browser = await chromium.launch({ headless: true });
  cfg.guard(browser);
  const rows = [];
  let lh = [];
  try {
    for (const pg of cfg.pages) {
      const url = cfg.withShare(`${cfg.base}${pg.path}`);
      const ui = cfg.uiIds.has(pg.id);
      try {
        const m = ui ? await measureUi(browser, url, cfg.prepare) : await measureUiLess(browser, url, cfg.prepare);
        rows.push({ id: pg.id, ui, url: pg.path, m });
        console.error(`[plugin-perf] ${cfg.label}/${pg.id} tamam`);
      } catch (e) {
        rows.push({ id: pg.id, ui, url: pg.path, error: String(e && e.message ? e.message : e).slice(0, 300) });
      }
    }
  } finally {
    await browser.close();
  }
  const lhIds = String(arg(argv, '--lh-pages', '')).split(',').filter(Boolean);
  if (lhIds.length && !argv.includes('--no-lh')) {
    const runs = Math.max(7, Number(arg(argv, '--lh-runs', '7')));
    const mode = arg(argv, '--lh-label', 'on');
    const lhUrls = cfg.pages.filter((p) => lhIds.includes(p.id)).map((p) => ({ id: p.id, url: cfg.withShare(`${cfg.base}${p.path}`) }));
    lh = await runLighthouseSet(lhUrls, runs, [mode], null, cfg.lhFlags);
  }
  return { label: cfg.label, rows, lh };
}

async function main() {
  const argv = process.argv.slice(2);
  const remote = argv.includes('--env') && arg(argv, '--env', 'local') !== 'local';
  const res = remote || argv.includes('--url') ? await measureRemote(argv) : await runLocal(argv);
  const checks = judgeRows(res.rows);
  const file = writeOut(res.label, { ...res, at: new Date().toISOString(), checks: checks.map((c) => ({ ...c, verdict: verdict(c.pass) })) });
  printReport(res.label, res.rows, checks, res.lh);
  console.log(`\nJSON: ${path.relative(ROOT, file)}`);
  process.exit(checks.some((c) => c.pass === false) ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
