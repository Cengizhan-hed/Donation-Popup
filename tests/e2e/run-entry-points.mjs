#!/usr/bin/env node
/**
 * Otomatik giriş noktası yedeği — yerel tema × "snippet açık/kapalı" matrisi (HTTP düzeyi, tarayıcı yok).
 *
 *   npm run e2e:entry-points [-- --only storefront]
 *
 * Kural: ürün sayfasında ASLA iki giriş noktası; ayar kapalıysa çizilmez; ID'siz kısa kod ürünü bulur.
 * Yalnız yerel WP + SQLite (uzak profil yok). Avada gerçek tema olarak kurulamaz: "builder_no_atc"
 * durumu Woo özet kancalarını boşaltarak Avada/Elementor düzenini (add-to-cart öğesi yok) taklit eder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_SRC = path.join(__dirname, 'helpers/wdp-entry-sim.php');
// Tam blok şablonlu temalarda giriş, add-to-cart blok yoluyla çizilir (yedek sarmalayıcı gerekmez).
const BLOCK_THEMES = ['twentytwentyfive'];
const PORT = 8931;
const OUT_DIR = path.join(__dirname, '../../build/e2e/entry-points');

/** @type {{id:string, state:object, expect:{count:number, within?:string, form?:boolean}}[]} */
export const SCENARIOS = [
  { id: 'varsayilan-snippet-kapali', state: {}, expect: { count: 1 } },
  { id: 'snippet-acik', state: { snippet: 'summary' }, expect: { count: 1, within: 'hd-snippet' } },
  { id: 'builder-snippet-kapali-yedek-cizer', state: { builder_no_atc: 1 }, expect: { count: 1, within: 'wdp-auto-place-fallback', classicOnly: true } },
  { id: 'builder-snippet-acik', state: { builder_no_atc: 1, snippet: 'summary' }, expect: { count: 1, within: 'hd-snippet' } },
  { id: 'builder-snippet-gec-yedek-kazanir', state: { builder_no_atc: 1, snippet: 'late' }, expect: { count: 1 } },
  { id: 'ayar-kapali-builder', state: { builder_no_atc: 1, auto_place: 'no' }, expect: { count: 0 } },
  { id: 'ayar-kapali-snippet-calisir', state: { auto_place: 'no', snippet: 'summary' }, expect: { count: 1, within: 'hd-snippet' } },
  { id: 'idsiz-panel', state: { auto_place: 'no', snippet: 'idless_panel' }, expect: { count: 1 } },
  { id: 'idsiz-popup', state: { auto_place: 'no', snippet: 'idless_popup' }, expect: { count: 1 } },
  { id: 'idsiz-form', state: { auto_place: 'no', snippet: 'idless_form' }, expect: { count: 1, form: true } },
  { id: 'idsiz-panel-builder-yedekle-cift-yok', state: { builder_no_atc: 1, snippet: 'idless_panel' }, expect: { count: 1 } },
];

/**
 * @param {string} html
 * @param {number} id
 */
export function countEntries(html, id) {
  const buttons = (html.match(new RegExp(`<button\\b[^>]*\\bwdp-donate-button\\b[^>]*data-product-id="${id}"`, 'g')) || []).length;
  const forms = (html.match(new RegExp(`id="wdp-modal-${id}-direct"`, 'g')) || []).length;
  return { buttons, forms, total: buttons + forms };
}

/**
 * @param {string} html
 * @param {number} id
 * @param {string} cls
 */
function entryInside(html, id, cls) {
  const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>(?:(?!</div>|</span>)[\\s\\S])*?data-product-id="${id}"`);
  return re.test(html);
}

async function main() {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx > 0 ? String(process.argv[onlyIdx + 1] || '').split(',') : [];
  const matrix = loadMatrix();
  const themes = (matrix.entryPoints && matrix.entryPoints.themes) || ['twentytwentyfive', 'storefront'];
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  for (const t of themes) ensureTheme(template, t);
  const rows = [];
  let failed = 0;
  for (const theme of themes) {
    if (only.length && !only.includes(theme)) continue;
    const resolved = { id: `ep-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
    const { snap, meta } = prepareConfigSnapshot(resolved);
    const probe = meta.probe || meta;
    const product = probe.products.fixed;
    const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
    fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-entry-sim.php'));
    restoreSqlite(wpDir, snap);
    const server = await startPhpServer({ wpDir, port: PORT });
    try {
      for (const sc of SCENARIOS) {
        fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-entry-sim.json'), JSON.stringify(process.env.WDP_EP_DEBUG ? { ...sc.state, debug: 1 } : sc.state));
        const res = await fetch(`${server.url.replace(/\/$/, '')}${product.path}`, { signal: AbortSignal.timeout(60000) });
        const html = await res.text();
        const c = countEntries(html, product.id);
        let ok = res.status === 200 && c.total === sc.expect.count;
        if (ok && sc.expect.form) ok = c.forms === 1;
        if (ok && sc.expect.within && !(sc.expect.classicOnly && BLOCK_THEMES.includes(theme))) ok = entryInside(html, product.id, sc.expect.within);
        if (/\b(Fatal error|Warning:|Notice:|Deprecated:)\b/.test(html)) ok = false;
        if (!ok || process.env.WDP_EP_DUMP_ALL) {
          if (!ok) failed += 1;
          const dump = path.join(OUT_DIR, `${theme}-${sc.id}.html`);
          fs.mkdirSync(OUT_DIR, { recursive: true });
          fs.writeFileSync(dump, html);
        }
        rows.push(`${ok ? 'GEÇTİ' : 'HATA '} ${theme.padEnd(18)} ${sc.id.padEnd(40)} http=${res.status} düğme=${c.buttons} form=${c.forms} beklenen=${sc.expect.count}${sc.expect.within ? ' içinde=' + sc.expect.within : ''}`);
      }
    } finally {
      await server.stop();
    }
  }
  console.log(rows.join('\n'));
  console.log(`\ne2e:entry-points: ${rows.length - failed} geçti, ${failed} hata`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
