#!/usr/bin/env node
/**
 * Yük ölçümü (CLAUDE.md §24; yalnız yerel WP + SQLite, tarayıcı yok, uzak komut yok).
 *
 *   npm run measure:load [-- --theme twentytwentyfive] [-- --json] [-- --budget-only]
 *
 * 1) Arayüzsüz sayfalar: eklenti KAPALI (etkin listeden çıkarılmış) ↔ AÇIK (tüm modüller açık) ↔ AÇIK+DONATION_PANEL_DISABLE.
 *    Her sayfada: harici istek sayısı, gzip bayt, render engelleyen kaynak sayısı, satır içi stil/betik sayısı,
 *    Set-Cookie sayısı, HTML baytı, `$wpdb->num_queries`. Kabul: fark 0/0/0 (istek/bayt/sorgu).
 * 2) Arayüzlü sayfalar: eklenti CSS/JS dosyaları ve gzip KB (bütçe: ≤12 KB CSS, ≤25 KB JS; modül parçaları ayrı), sorgu farkı ≤+2.
 *
 * Çıkış kodu: kabul ihlali varsa 1. Çıktı: konsol tablosu + build/e2e/load/measure-load.json.
 * Portu `WDP_LOCAL_E2E_PORT` belirler (varsayılan 8921). Playwright kuyruğu: `npm run e2e:queue -- npm run measure:load`.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from '../tests/e2e/helpers/matrix-cover.mjs';
import { ensureMatrixTemplate, ensureTheme, prepareConfigSnapshot, materializeWorker, startPhpServer, restoreSqlite } from '../tests/e2e/helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SIM_SRC = path.join(ROOT, 'tests/e2e/helpers/wdp-scope-sim.php');
const PROBE_SRC = path.join(ROOT, 'tests/e2e/helpers/wdp-load-probe.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8921);
const OUT_DIR = path.join(ROOT, 'build/e2e/load');
const BUDGET = { css: 12 * 1024, js: 25 * 1024 };

/** Arayüzsüz sayfalar (eklenti hiçbir şey eklememeli) ve arayüzlü sayfalar. */
export const PAGES = [
  { id: 'ana-sayfa', page: 'home', ui: false },
  { id: 'blog-yazisi', page: 'blog', ui: false },
  { id: 'duz-sayfa', page: 'page', ui: false },
  { id: 'bagis-disi-urun', page: 'plainprod', ui: false },
  { id: 'magaza-bagis-girisi-yok', page: 'shop', ui: false, state: { none_donation: 1 } },
  { id: 'sepet-bos', page: 'cart', ui: false },
  { id: 'odeme-bos', page: 'checkout', ui: false },
  { id: 'hesabim-misafir', page: 'account', ui: false },
  { id: 'magaza-bagis-urunleriyle', page: 'shop', ui: true },
  { id: 'bagis-urunu', page: 'donation', ui: true },
  { id: 'bagis-listesi', page: 'list', ui: true },
];

/**
 * HTML'i çözümler: harici kaynaklar, render engelleyenler, satır içi blok sayısı, kök HTML yoklama verisi.
 * @param {string} html Sayfa.
 * @param {string} base Site kökü.
 */
export function parsePage(html, base) {
  const probeMatch = html.match(/<!--wdp-probe (\{[\s\S]*?\})-->/);
  const probe = probeMatch ? JSON.parse(probeMatch[1]) : { queries: -1, sql: [], autoload: 0, owned: {} };
  const clean = html.replace(/<!--wdp-probe [\s\S]*?-->/, '');
  const resources = [];
  const blocking = [];
  const headEnd = clean.search(/<\/head>/i);
  for (const m of clean.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel=["']?(?:stylesheet|modulepreload|preload)/i.test(tag)) continue;
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    resources.push({ type: 'css', url: href });
    const media = (tag.match(/\bmedia=["']([^"']+)["']/i) || [])[1] || 'all';
    if (/rel=["']?stylesheet/i.test(tag) && !/print/i.test(media)) blocking.push(href);
  }
  for (const m of clean.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    resources.push({ type: 'js', url: m[1] });
    const inHead = m.index < headEnd;
    if (inHead && !/\b(?:defer|async)\b|type=["']module/i.test(m[0])) blocking.push(m[1]);
  }
  const inlineStyles = (clean.match(/<style\b/gi) || []).length;
  const inlineScripts = (clean.match(/<script\b(?![^>]*\bsrc=)/gi) || []).length;
  // Eklenti DOM'u: `.dp` kök sınıfı, `data-dp-*` öznitelikleri, `donation-panel/` yolları (ürün adı/slug'ı sayılmaz).
  const markers = (clean.match(/\bdata-dp-[a-z-]+|class="(?:[^"]*\s)?dp(?:\s|-[a-z]|")|donation-panel\//g) || []).length;
  return { probe, resources, blocking, inlineStyles, inlineScripts, markers, htmlBytes: Buffer.byteLength(clean) };
}

const isPlugin = (url) => /\/woo-donation-popup\//.test(url);

async function fetchSize(url, base) {
  const abs = new URL(url, base + '/').toString();
  const res = await fetch(abs, { signal: AbortSignal.timeout(60000) });
  const buf = Buffer.from(await res.arrayBuffer());
  return { raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, status: res.status };
}

async function visit(base, urlPath, tag = '') {
  const res = await fetch(`${base}${urlPath}`, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  const html = await res.text();
  if (tag && process.env.WDP_DUMP) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, `${tag}.html`), html.replace(/<!--wdp-probe [\s\S]*?-->/, ''));
  }
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const parsed = parsePage(html, base);
  let bytes = 0;
  const files = [];
  for (const r of parsed.resources) {
    const size = await fetchSize(r.url, base);
    bytes += size.gzip;
    files.push({ ...r, ...size, plugin: isPlugin(r.url) });
  }
  return { status: res.status, cookies: cookies.length, ...parsed, assetGzip: bytes, files };
}

async function main() {
  const argv = process.argv.slice(2);
  const themeIdx = argv.indexOf('--theme');
  const theme = themeIdx >= 0 ? argv[themeIdx + 1] : 'twentytwentyfive';
  const matrix = loadMatrix();
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);

  const resolved = { id: `load-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probeMeta = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  const muDir = path.join(wpDir, 'wp-content/mu-plugins');
  fs.copyFileSync(SIM_SRC, path.join(muDir, 'wdp-scope-sim.php'));
  fs.copyFileSync(PROBE_SRC, path.join(muDir, 'wdp-load-probe.php'));
  restoreSqlite(wpDir, snap);
  fs.rmSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), { force: true });
  const setState = (state) => fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-load-probe.json'), JSON.stringify(state));
  setState({});
  fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim.json'), '{}');

  const server = await startPhpServer({ wpDir, port: PORT });
  const base = server.url.replace(/\/$/, '');
  const violations = [];
  const rows = [];
  try {
    await fetch(`${base}/`, { signal: AbortSignal.timeout(120000) }); // tohumlama
    const urls = JSON.parse(fs.readFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), 'utf8'));
    urls.donation = probeMeta.products.fixed.path;

    for (const pg of PAGES) {
      const extra = pg.state || {};
      const run = async (state, tag) => {
        setState({ ...extra, ...state });
        await visit(base, urls[pg.page]); // ısınma (önbellek, ilk çalıştırma işleri)
        return visit(base, urls[pg.page], `${pg.id}-${tag}`);
      };
      const off = await run({ plugin_off: 1 }, 'off');
      // `def`: varsayılan modüller (gerçek kurulum); `all`: tüm modüller açık (yan sepet, hesap, sosyal kanıt, teşekkür, vergi indirimi).
      const def = await run({}, 'def');
      const all = await run({ modules_all: 1 }, 'all');
      const dis = await run({ modules_all: 1, disable: 1 }, 'dis');
      const qCount = (r) => r.probe.queries - r.probe.sql.filter((q) => /_transient(?:_timeout)?_wc_related_/.test(q)).length;
      const pf = (r) => r.files.filter((f) => f.plugin);
      const kb = (list) => +(list.reduce((n, f) => n + f.gzip, 0) / 1024).toFixed(1);
      const allCss = pf(all).filter((f) => f.type === 'css');
      const allJs = pf(all).filter((f) => f.type === 'js');
      const on = def;
      const pluginFiles = pf(on);
      const css = pluginFiles.filter((f) => f.type === 'css');
      const js = pluginFiles.filter((f) => f.type === 'js');
      const row = {
        allReq: all.resources.length - off.resources.length,
        allGzip: all.assetGzip - off.assetGzip,
        allBlock: all.blocking.length - off.blocking.length,
        allInline: all.inlineStyles + all.inlineScripts - off.inlineStyles - off.inlineScripts,
        allCookie: all.cookies - off.cookies,
        allQueries: qCount(all) - qCount(off),
        allMarkers: all.markers - off.markers,
        allCssFiles: allCss.length,
        allJsFiles: allJs.length,
        allCssKB: kb(allCss),
        allJsKB: kb(allJs),
        allFiles: pf(all).map((f) => `${f.url.split('/woo-donation-popup/')[1].split('?')[0]} ${(f.gzip / 1024).toFixed(1)}KB`),
        id: pg.id,
        ui: pg.ui,
        http: on.status,
        offReq: off.resources.length,
        onReq: on.resources.length,
        dReq: on.resources.length - off.resources.length,
        dGzip: on.assetGzip - off.assetGzip,
        dBlock: on.blocking.length - off.blocking.length,
        dInline: on.inlineStyles + on.inlineScripts - off.inlineStyles - off.inlineScripts,
        dCookie: on.cookies - off.cookies,
        dHtml: on.htmlBytes - off.htmlBytes,
        // WooCommerce'in kendi ilgili ürün önbelleği (`wc_related_*` geçici verisi) eklentiden bağımsız ve duruma bağlı: sayılmaz.
        dQueries: qCount(on) - qCount(off),
        queriesOn: qCount(on),
        queriesOff: qCount(off),
        cssKB: +(css.reduce((n, f) => n + f.gzip, 0) / 1024).toFixed(1),
        jsKB: +(js.reduce((n, f) => n + f.gzip, 0) / 1024).toFixed(1),
        cssFiles: css.length,
        jsFiles: js.length,
        pluginFiles: pluginFiles.map((f) => `${f.url.split('/woo-donation-popup/')[1]} ${(f.gzip / 1024).toFixed(1)}KB`),
        disabledReq: dis.resources.length - off.resources.length,
        // Kapıdayken eklenti DOM'u ve varlığı 0 olmalı; HTML bayt farkı yalnız bilgi (WooCommerce'in satın alınabilirlik
        // mantığı sepet/sipariş bütünlüğü için çalışır, ör. "Read more" ↔ "Add to cart").
        disabledMarkers: dis.markers - off.markers,
        onMarkers: on.markers - off.markers,
        dMarkers: on.markers - off.markers,
        disabledHtml: dis.htmlBytes - off.htmlBytes,
        disabledQueries: qCount(dis) - qCount(off),
        autoloadBytes: on.probe.autoload,
        extraSql: on.probe.sql.filter((q) => !off.probe.sql.some((o) => o.split(' @@ ')[0] === q.split(' @@ ')[0])),
      };
      rows.push(row);
      if (!pg.ui) {
        for (const [mode, v] of [
          ['varsayılan modüller', [row.dReq, row.dGzip, row.dBlock, row.dInline, row.dCookie, row.dQueries]],
          ['tüm modüller açık', [row.allReq, row.allGzip, row.allBlock, row.allInline, row.allCookie, row.allQueries]],
        ]) {
          if (v.some((n, i) => (i === 5 ? n > 0 : n !== 0))) {
            violations.push(`${pg.id} [${mode}]: arayüzsüz sayfada fark (istek ${v[0]}, gzip ${v[1]}, engelleyen ${v[2]}, satır içi ${v[3]}, çerez ${v[4]}, sorgu ${v[5]})`);
          }
        }
        if (row.allMarkers !== 0) violations.push(`${pg.id}: tüm modüller açıkken arayüzsüz sayfada eklenti DOM'u var (${row.allMarkers})`);
      } else {
        // Çekirdek paket (deneyim): ≤1 CSS + ≤1 JS; modüller ayrı parça ve kendi bütçesiyle gelir (aşağıdaki tabloda ayrı satır).
        const coreCss = css.filter((f) => /\/experiences\//.test(f.url)).length;
        const coreJs = js.filter((f) => /\/experiences\//.test(f.url)).length;
        if (coreCss > 1 || coreJs > 1) violations.push(`${pg.id}: çekirdek paket ${coreCss} CSS + ${coreJs} JS (≤1+1)`);
        if (row.dQueries > 2) violations.push(`${pg.id}: sorgu +${row.dQueries} (≤+2)`);
        if (row.dCookie !== 0 || row.allCookie !== 0) violations.push(`${pg.id}: ilk ziyarette eklenti çerezi/oturumu açtı (çerez Δ ${row.dCookie}/${row.allCookie})`);
        if (row.dReq - css.length - js.length !== 0) violations.push(`${pg.id}: eklenti dışı ek istek (${row.dReq - css.length - js.length})`);
        if (css.some((f) => f.gzip > BUDGET.css)) violations.push(`${pg.id}: CSS bütçesi aşıldı (${row.cssKB} KB > 12 KB)`);
        if (js.some((f) => f.gzip > BUDGET.js)) violations.push(`${pg.id}: JS bütçesi aşıldı (${row.jsKB} KB > 25 KB)`);
      }
      if (row.disabledReq !== 0 || row.disabledMarkers !== 0 || row.disabledQueries > 0) {
        violations.push(`${pg.id}: DONATION_PANEL_DISABLE açıkken çıktı var (istek ${row.disabledReq}, eklenti DOM ${row.disabledMarkers}, sorgu ${row.disabledQueries})`);
      }
      if (pg.ui && pluginFiles.length < 2) violations.push(`${pg.id}: arayüzlü sayfada eklenti varlığı yok (ölçüm geçersiz)`);
      if (!pg.ui && row.dMarkers !== 0) violations.push(`${pg.id}: arayüzsüz sayfada eklenti DOM'u var (${row.dMarkers})`);
    }
  } finally {
    await server.stop();
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'measure-load.json'), JSON.stringify({ theme, rows, violations }, null, 2));
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ rows, violations }, null, 2));
  } else {
    console.log('\nArayüzsüz sayfalar: açık − kapalı farkı (hedef 0)');
    console.log('| sayfa | istek Δ | gzip bayt Δ | engelleyen Δ | satır içi Δ | çerez Δ | HTML bayt Δ | sorgu kapalı→açık | DISABLE Δ(istek/DOM/sorgu) |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const r of rows.filter((x) => !x.ui)) {
      console.log(`| ${r.id} | ${r.dReq} | ${r.dGzip} | ${r.dBlock} | ${r.dInline} | ${r.dCookie} | ${r.dHtml} | ${r.queriesOff}→${r.queriesOn} (${r.dQueries >= 0 ? '+' : ''}${r.dQueries}) | ${r.disabledReq}/${r.disabledMarkers}/${r.disabledQueries} |`);
    }
    console.log('\nArayüzlü sayfalar (bütçe: CSS ≤12 KB, JS ≤25 KB gzip; ≤1 CSS + 1 JS; sorgu ≤+2)');
    console.log('| sayfa | CSS dosya/KB (varsayılan) | JS dosya/KB | engelleyen Δ | sorgu kapalı→açık | HTML bayt Δ | tüm modüller CSS/JS KB | DISABLE Δ(istek/DOM/sorgu) |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of rows.filter((x) => x.ui)) {
      console.log(`| ${r.id} | ${r.cssFiles}/${r.cssKB} | ${r.jsFiles}/${r.jsKB} | ${r.dBlock} | ${r.queriesOff}→${r.queriesOn} (+${r.dQueries}) | ${r.dHtml} | ${r.allCssFiles}/${r.allCssKB} · ${r.allJsFiles}/${r.allJsKB} | ${r.disabledReq}/${r.disabledMarkers}/${r.disabledQueries} |`);
      console.log(`|   ↳ dosyalar | ${r.pluginFiles.join(', ')} | | | | | ${r.allFiles.join(', ')} | |`);
    }
    console.log(`\nAutoload (eklenti seçenekleri, bayt): ${Math.max(...rows.map((r) => r.autoloadBytes))} (sınır 5120)`);
    const extra = rows.filter((r) => r.extraSql.length);
    for (const r of extra) console.log(`Ek sorgular ${r.id}:\n  - ${r.extraSql.slice(0, 6).join('\n  - ')}`);
  }
  if (Math.max(...rows.map((r) => r.autoloadBytes)) > 5120) violations.push('autoload > 5 KB');
  console.log(violations.length ? `\nİHLAL (${violations.length}):\n- ${violations.join('\n- ')}` : '\nmeasure:load: ihlal yok');
  process.exit(violations.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
