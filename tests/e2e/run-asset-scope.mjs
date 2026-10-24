#!/usr/bin/env node
/**
 * Yükleme kapsamı ölçümü — yerel WP (HTTP düzeyi, tarayıcı yok). Eklenti varlıkları yalnız gereken sayfada yüklenmeli.
 *
 *   npm run e2e:asset-scope [-- --only twentytwentyfive] [-- --table]
 *
 * Her sayfa türü için: eklenti CSS/JS dosyaları, satır içi stil/betik, wdp DOM düğümleri ölçülür ve beklentiyle
 * karşılaştırılır (expect.none = hiç eklenti varlığı yok; expect.assets = yüklenmeli). Yalnız yerel WP + SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import { ensureMatrixTemplate, ensureTheme, prepareConfigSnapshot, materializeWorker, startPhpServer, restoreSqlite } from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_SRC = path.join(__dirname, 'helpers/wdp-scope-sim.php');
const PORT = 8932;
const OUT_DIR = path.join(__dirname, '../../build/e2e/asset-scope');

/**
 * Ölçüm: eklentiye ait varlıklar.
 * @param {string} html
 */
export function measure(html) {
  const assetRe = /<(?:link|script)\b[^>]*(?:href|src)=["'][^"']*\/woo-donation-popup\/[^"']*["'][^>]*>/gi;
  const files = [...html.matchAll(assetRe)].map((m) => (m[0].match(/\/woo-donation-popup\/([^"'?#]+)/) || [])[1]);
  const inlineRe = /<(style|script)\b[^>]*\bid=["'](wdp-[^"']*)["'][^>]*>/gi;
  const inline = [...html.matchAll(inlineRe)].map((m) => `${m[1]}#${m[2]}`);
  // Satır içi betik/stil içinde eklenti verisi (id'siz): wdpData, wdp_ ya da .wdp- seçici.
  const anon = [...html.matchAll(/<(style|script)\b(?![^>]*\bid=["']wdp-)[^>]*>([\s\S]*?)<\/\1>/gi)].filter((m) => /\bwdp[A-Z]|\bwdp_|[.#]wdp-/.test(m[2]) && !/woo-donation-popup\//.test(m[0].slice(0, 200)));
  const bodyStart = html.search(/<body\b/i);
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const stripped = body.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const nodes = (stripped.match(/<[a-z][^>]*\s(?:class|id)=["'](?:[^"']*\s)?wdp-[^"']*["'][^>]*>/gi) || []).length;
  return { files, inline, anonInline: anon.length, nodes, total: files.length + inline.length + anon.length + nodes };
}

/** @type {{id:string, page:string, state?:object, expect:'none'|'assets'}[]} */
export const SCENARIOS = [
  { id: 'ana-sayfa', page: 'home', expect: 'none' },
  { id: 'blog-yazisi', page: 'blog', expect: 'none' },
  { id: 'duz-sayfa', page: 'page', expect: 'none' },
  { id: 'magaza-bagis-girisi-yok', page: 'shop', state: { none_donation: 1 }, expect: 'none' },
  { id: 'bagis-disi-urun', page: 'plainprod', expect: 'none' },
  { id: 'magaza-bagis-urunleriyle', page: 'shop', expect: 'assets' },
  { id: 'bagis-urunu', page: 'donation', expect: 'assets' },
  { id: 'bagis-listesi', page: 'list', expect: 'assets' },
  { id: 'sepet-bos', page: 'cart', expect: 'none' },
  { id: 'odeme-bos', page: 'checkout', expect: 'none' },
  { id: 'hesabim', page: 'account', expect: 'none' },
];

async function main() {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx > 0 ? String(process.argv[onlyIdx + 1] || '').split(',') : [];
  const matrix = loadMatrix();
  const themes = (matrix.entryPoints && matrix.entryPoints.themes) || ['twentytwentyfive', 'storefront'];
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  for (const t of themes) ensureTheme(template, t);
  const rows = [];
  const table = [];
  let failed = 0;
  for (const theme of themes) {
    if (only.length && !only.includes(theme)) continue;
    const resolved = { id: `sc-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
    const { snap, meta } = prepareConfigSnapshot(resolved);
    const probe = meta.probe || meta;
    const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
    fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-scope-sim.php'));
    restoreSqlite(wpDir, snap);
    fs.rmSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), { force: true });
    const server = await startPhpServer({ wpDir, port: PORT });
    const base = server.url.replace(/\/$/, '');
    try {
      fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim.json'), '{}');
      await fetch(`${base}/`, { signal: AbortSignal.timeout(90000) }); // tohumlama (wp_loaded)
      const urls = JSON.parse(fs.readFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), 'utf8'));
      urls.donation = probe.products.fixed.path;
      for (const sc of SCENARIOS) {
        fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim.json'), JSON.stringify(sc.state || {}));
        const res = await fetch(`${base}${urls[sc.page]}`, { signal: AbortSignal.timeout(90000) });
        const html = await res.text();
        const m = measure(html);
        let ok = res.status === 200 && !/\b(Fatal error|Warning:|Notice:|Deprecated:)\b/.test(html);
        if (sc.expect === 'none' && m.total > 0) ok = false;
        if (sc.expect === 'assets' && (m.files.length < 2 || m.nodes < 1)) ok = false;
        if (!ok) {
          failed += 1;
          fs.mkdirSync(OUT_DIR, { recursive: true });
          fs.writeFileSync(path.join(OUT_DIR, `${theme}-${sc.id}.html`), html);
        }
        const handles = m.files.map((f) => f.split('/').pop()).join(',');
        rows.push(`${ok ? 'GEÇTİ' : 'HATA '} ${theme.padEnd(16)} ${sc.id.padEnd(26)} http=${res.status} dosya=${m.files.length} satırİçi=${m.inline.length + m.anonInline} düğüm=${m.nodes} beklenen=${sc.expect}`);
        table.push(`| ${theme} | ${sc.id} | ${m.files.length} | ${m.inline.length + m.anonInline} | ${m.nodes} | ${Math.round(html.length / 1024)} KB |${process.argv.includes('--files') ? ' ' + handles + ' |' : ''}`);
      }
    } finally {
      await server.stop();
    }
  }
  console.log(rows.join('\n'));
  if (process.argv.includes('--table')) console.log('\n| tema | sayfa | dosya | satır içi | wdp düğüm | HTML |\n|---|---|---|---|---|---|\n' + table.join('\n'));
  console.log(`\ne2e:asset-scope: ${rows.length - failed} geçti, ${failed} hata`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
