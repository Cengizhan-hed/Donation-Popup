#!/usr/bin/env node
/**
 * E4/E5 + önbellek denetimi (CLAUDE.md §24; yalnız yerel WP + SQLite, tarayıcı yok, uzak komut yok).
 *
 *   npm run measure:seo-debug [-- --theme twentytwentyfive]
 *
 *  - E5 SEO: eklenti KAPALI ↔ AÇIK, sayfa başına `<h1>` sayısı ve `application/ld+json` blok sayısı (eklenti H1 ve JSON-LD üretmemeli).
 *  - E4 WP_DEBUG: WP_DEBUG_LOG açık yerel WP; tüm sayfa ziyaretlerinden sonra debug.log'da eklenti kaynaklı (woo-donation-popup) satır sayısı.
 *  - Önbellek: sepet çerezi YOKKEN arayüzlü sayfa HTML'inde sepet içeriği (satır/tutar) YOK; çerezli ziyaretçide yan sepet çekmecesi
 *    sepeti basar (yalnız çerezli ziyaretçiye; sayfa önbelleği eklentileri woocommerce_items_in_cart çerezli isteği atlar).
 * Çıkış kodu: ihlalde 1. Çıktı: konsol tablosu + build/e2e/load/seo-debug.json. Port: WDP_LOCAL_E2E_PORT (varsayılan 8935).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.WDP_WP_DEBUG_LOG = '1';
const { loadMatrix } = await import('../tests/e2e/helpers/matrix-cover.mjs');
const { ensureMatrixTemplate, ensureTheme, prepareConfigSnapshot, materializeWorker, startPhpServer, restoreSqlite } = await import('../tests/e2e/helpers/matrix-setup.mjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8935);
const OUT_DIR = path.join(ROOT, 'build/e2e/load');

const PAGES = [
  { id: 'ana-sayfa', page: 'home', ui: false },
  { id: 'blog-yazisi', page: 'blog', ui: false },
  { id: 'duz-sayfa', page: 'page', ui: false },
  { id: 'bagis-disi-urun', page: 'plainprod', ui: false },
  { id: 'sepet-bos', page: 'cart', ui: false },
  { id: 'odeme-bos', page: 'checkout', ui: false },
  { id: 'magaza-bagis-urunleriyle', page: 'shop', ui: true },
  { id: 'bagis-urunu', page: 'donation', ui: true },
  { id: 'bagis-listesi', page: 'list', ui: true },
];

/**
 * @param {string} html Sayfa.
 * @return {{h1:number, ldjson:number, phpNotices:number}} Sayımlar.
 */
export function seoCounts(html) {
  const clean = html.replace(/<!--wdp-probe [\s\S]*?-->/, '');
  return {
    h1: (clean.match(/<h1[\s>]/gi) || []).length,
    ldjson: (clean.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length,
    phpNotices: (clean.match(/<b>(?:Warning|Notice|Deprecated|Fatal error)<\/b>/g) || []).length,
  };
}

async function get(base, p, headers = {}) {
  const res = await fetch(`${base}${p}`, { redirect: 'follow', headers, signal: AbortSignal.timeout(120000) });
  return { res, html: await res.text() };
}

async function main() {
  const argv = process.argv.slice(2);
  const theme = argv.includes('--theme') ? argv[argv.indexOf('--theme') + 1] : 'twentytwentyfive';
  const matrix = loadMatrix();
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `seo-${theme}`, themeSpec: { slug: theme }, storeSpec: matrix.stores.try, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probeMeta = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  const muDir = path.join(wpDir, 'wp-content/mu-plugins');
  fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers/wdp-scope-sim.php'), path.join(muDir, 'wdp-scope-sim.php'));
  fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers/wdp-load-probe.php'), path.join(muDir, 'wdp-load-probe.php'));
  restoreSqlite(wpDir, snap);
  fs.rmSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), { force: true });
  fs.rmSync(path.join(wpDir, 'wp-content/debug.log'), { force: true });
  const setState = (s) => fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-load-probe.json'), JSON.stringify(s));
  setState({});
  fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim.json'), '{}');

  const server = await startPhpServer({ wpDir, port: PORT });
  const base = server.url.replace(/\/$/, '');
  const violations = [];
  const rows = [];
  let cache = {};
  try {
    await get(base, '/');
    const urls = JSON.parse(fs.readFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), 'utf8'));
    urls.donation = probeMeta.products.fixed.path;

    for (const pg of PAGES) {
      setState({ plugin_off: 1 });
      await get(base, urls[pg.page]);
      const off = seoCounts((await get(base, urls[pg.page])).html);
      setState({ modules_all: 1, direct: 1 });
      await get(base, urls[pg.page]);
      const on = seoCounts((await get(base, urls[pg.page])).html);
      const row = { id: pg.id, ui: pg.ui, h1Off: off.h1, h1On: on.h1, ldOff: off.ldjson, ldOn: on.ldjson, noticesOn: on.phpNotices };
      rows.push(row);
      if (on.h1 !== off.h1) violations.push(`${pg.id}: H1 farkı ${off.h1}→${on.h1}`);
      if (on.ldjson !== off.ldjson) violations.push(`${pg.id}: JSON-LD farkı ${off.ldjson}→${on.ldjson}`);
      if (on.phpNotices) violations.push(`${pg.id}: HTML'de PHP uyarısı ${on.phpNotices}`);
      console.log(`| ${pg.id} | ${pg.ui ? 'arayüzlü' : 'arayüzsüz'} | H1 ${off.h1}→${on.h1} | JSON-LD ${off.ldjson}→${on.ldjson} | HTML PHP uyarısı ${on.phpNotices} |`);
    }

    // Önbellek: çerezsiz ziyaretçide sepet içeriği yok; çerezli ziyaretçide çekmece sepeti basar.
    setState({ modules_all: 1 });
    const pid = probeMeta.products.fixed.id;
    const cookieless = await get(base, urls.shop);
    const linesNoCookie = (cookieless.html.match(/data-dp-sc-line=/g) || []).length;
    const cartApi = await fetch(`${base}/?rest_route=/wc/store/v1/cart`, { signal: AbortSignal.timeout(60000) });
    const nonce = cartApi.headers.get('nonce') || '';
    const jar = (cartApi.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
    const add = await fetch(`${base}/?rest_route=/wc/store/v1/cart/add-item`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', nonce, cookie: jar.join('; ') },
      body: JSON.stringify({ id: pid, quantity: 1 }),
      signal: AbortSignal.timeout(60000),
    });
    const jar2 = [...jar, ...(add.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]), 'woocommerce_items_in_cart=1'];
    const withCookie = await get(base, urls.shop, { cookie: jar2.join('; ') });
    const afterNoCookie = await get(base, urls.shop);
    cache = {
      addStatus: add.status,
      cookielessBytes: Buffer.byteLength(cookieless.html.replace(/<!--wdp-probe [\s\S]*?-->/, '')),
      cookielessHasCartLines: linesNoCookie,
      cookiedHasCartLines: (withCookie.html.match(/data-dp-sc-line=/g) || []).length,
      cookiedBytes: Buffer.byteLength(withCookie.html.replace(/<!--wdp-probe [\s\S]*?-->/, '')),
      afterCookielessBytes: Buffer.byteLength(afterNoCookie.html.replace(/<!--wdp-probe [\s\S]*?-->/, '')),
    };
    if (cache.cookielessHasCartLines) violations.push('çerezsiz HTML sepet satırı içeriyor');
    if (cache.cookielessBytes !== cache.afterCookielessBytes) violations.push('çerezsiz HTML sepet eklendikten sonra değişti (sızıntı)');
    console.log('\nÖnbellek denetimi:', JSON.stringify(cache));
  } finally {
    await server.stop?.();
  }
  const logFile = path.join(wpDir, 'wp-content/debug.log');
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
  const ours = log.filter((l) => /woo-donation-popup|donation-panel/i.test(l));
  console.log(`\ndebug.log: toplam ${log.length} satır, eklenti kaynaklı ${ours.length}`);
  for (const l of ours.slice(0, 10)) console.log('  ' + l.slice(0, 220));
  if (ours.length) violations.push(`debug.log eklenti kaynaklı ${ours.length} satır`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'seo-debug.json'), JSON.stringify({ theme, rows, cache, debugLogTotal: log.length, debugLogOwn: ours.length }, null, 2));
  console.log(violations.length ? `\nİHLAL (${violations.length}):\n- ${violations.join('\n- ')}` : '\nmeasure:seo-debug: ihlal yok');
  process.exit(violations.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
