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
 *     50 ms üzeri uzun görev sayısı.
 *  4) CLS katkısı: `layout-shift` kayıtlarından kaynağı eklenti öğesi (`.donation-panel*` / `[data-dp-*]`) olanlar.
 *  5) INP: dokunma → panel ve tutar kartına dokunma (Event Timing `duration`), yavaş ağ + 4× CPU.
 *  6) Dokunuş → panel: click → `dialog[open]` görünür + iki rAF, 5 koşu medyanı.
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
  inlinePluginStyles,
  isPluginCookie,
  isPluginUrl,
  judgeMetric,
  median,
  parsePagesArg,
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
  { id: 'bagis-listesi', key: 'list', ui: true },
  { id: 'sayfa-ici-form', key: 'form', ui: true },
  { id: 'compact-kart', key: 'compact', ui: true },
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
  window.__dpPerf = { shifts: [], events: [], errors: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__dpPerf.shifts.push({
          value: e.value,
          hadRecentInput: e.hadRecentInput,
          sources: (e.sources || []).map((s) => ({ plugin: !!s.node && isPluginNode(s.node), detached: !s.node })),
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
async function measureUi(browser, url, prepare) {
  const out = {};
  const { context, page } = await openPage(browser, { throttle: true, prepare });
  try {
    await browser.startTracing(page, { categories: TRACE_CATEGORIES });
    const res = await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    const html = res ? await res.text() : '';
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

    // INP: dokunma → panel, tutar kartı (izleme kapalıyken; yavaşlatma sürer).
    const trigger = page.locator('[data-dp-open]:visible').first();
    const hasTrigger = (await page.locator('[data-dp-open]:visible').count()) > 0;
    const marks = {};
    if (hasTrigger) {
      marks.open = await page.evaluate(() => performance.now());
      await trigger.tap();
      await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 20000 });
      await settle(page);
    }
    const presetSel = hasTrigger ? 'dialog[open] [data-dp-preset]' : '[data-dp-preset]';
    const presets = page.locator(`${presetSel}[aria-checked="false"]:visible`);
    if ((await presets.count()) > 0) {
      marks.amount = await page.evaluate(() => performance.now());
      await presets.first().tap();
      await settle(page);
    }
    await settle(page);
    const perf = await page.evaluate(() => window.__dpPerf);
    const inter = (from, to) => {
      const byId = new Map();
      for (const e of perf.events) {
        if (!e.interactionId || e.startTime < from || e.startTime >= to) continue;
        byId.set(e.interactionId, Math.max(byId.get(e.interactionId) || 0, e.duration));
      }
      return byId.size ? Math.max(...byId.values()) : 0; // Event Timing yalnız ≥16 ms kaydeder: 0 = <16 ms.
    };
    out.inpOpen = marks.open !== undefined ? inter(marks.open, marks.amount !== undefined ? marks.amount : Infinity) : NaN;
    out.inpAmount = marks.amount !== undefined ? inter(marks.amount, Infinity) : NaN;
    // CLS: yalnız yükleme (girdi öncesi kaymalar; hadRecentInput olanlar zaten dışarıda).
    out.cls = clsAttribution(perf.shifts);
    out.observerErrors = perf.errors;
    out.hasTrigger = hasTrigger;

    // 6) Dokunuş → panel: 5 koşu (her koşu yeni yükleme), click + 60 ms basılı kalma, dialog[open] görünür + iki rAF.
    out.tapRuns = [];
    if (hasTrigger) {
      for (let i = 0; i < TAP_RUNS; i += 1) {
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await settle(page);
        await page.evaluate(() => {
          const trig = Array.from(document.querySelectorAll('[data-dp-open]')).find((el) => el.getClientRects().length > 0);
          window.__dpTap = { t0: 0, t1: 0 };
          trig.addEventListener(
            'click',
            (event) => {
              window.__dpTap.t0 = event.timeStamp;
              const loop = () => {
                const d = Array.from(document.querySelectorAll('dialog[open]')).find((x) => x.getClientRects().length > 0 && getComputedStyle(x).visibility === 'visible');
                if (d) {
                  requestAnimationFrame(() => requestAnimationFrame(() => (window.__dpTap.t1 = performance.now())));
                  return;
                }
                requestAnimationFrame(loop);
              };
              requestAnimationFrame(loop);
            },
            { capture: true, once: true }
          );
        });
        await page.locator('[data-dp-open]:visible').first().click({ delay: 60 });
        await page.waitForFunction(() => window.__dpTap && window.__dpTap.t1 > 0, null, { timeout: 20000 });
        out.tapRuns.push(Math.round(await page.evaluate(() => window.__dpTap.t1 - window.__dpTap.t0)));
      }
    }
    out.tapMedian = out.tapRuns.length ? median(out.tapRuns) : NaN;
  } finally {
    await context.close();
  }
  return out;
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
  console.log('| sayfa | engelleyen | satır içi CSS gz | CSS gz | JS gz | toplam gz | ana iş ms | uzun görev | CLS | INP aç/tutar ms | dokunuş→panel medyan (5) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.ui && !x.error)) {
    const m = r.m;
    if (m.skipped) {
      console.log(`| ${r.id} | — atlandı: ${m.skipped} |`);
      continue;
    }
    console.log(
      `| ${r.id} | ${m.blocking} | ${m.inlineCss.gzip} B (${m.inlineCss.count}) | ${m.cssGzip} B | ${m.jsGzip} B | ${m.totalGzip} B | ${m.mainThreadMs} | ${m.longTasks} (+${m.contributedLongTasks} katkılı) | ${m.cls.plugin} | ${fmt(m.inpOpen)}/${fmt(m.inpAmount)} | ${fmt(m.tapMedian)} [${m.tapRuns.join(',')}] |`
    );
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
  for (const f of ['wdp-scope-sim.php', 'wdp-load-probe.php', 'wdp-perf-pages.php']) fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers', f), path.join(mu, f));
  restoreSqlite(wpDir, snap);
  const wc = (f) => path.join(wpDir, 'wp-content', f);
  for (const f of ['wdp-scope-sim-urls.json', 'wdp-perf-pages-urls.json']) fs.rmSync(wc(f), { force: true });
  const setState = (s) => fs.writeFileSync(wc('wdp-load-probe.json'), JSON.stringify(s));
  setState({});
  fs.writeFileSync(wc('wdp-scope-sim.json'), '{}');
  fs.writeFileSync(wc('wdp-perf-pages.json'), JSON.stringify({ product_id: probeMeta.products.fixed.id }));

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
          rows.push({ id: pg.id, ui: true, url: urls[pg.key], m: await measureUi(browser, url) });
        }
        console.error(`[plugin-perf] ${theme}/${pg.id} tamam`);
      } catch (e) {
        rows.push({ id: pg.id, ui: pg.ui, url: urls[pg.key], error: String(e && e.message ? e.message : e).slice(0, 300) });
      }
    }
    if (!argv.includes('--no-lh')) {
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
  return { label: `local-${theme}`, theme, rows, lh };
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
