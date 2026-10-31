/**
 * Kalite kapıları (E8B) ortak yardımcıları: yerel WP işçisi kur, durum dosyası, sonuç kaydı. YALNIZ yerel (uzak profil yok).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './matrix-cover.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  matrixEval,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');
export const QUALITY_DIR = path.join(ROOT, 'build/quality');
const SIM_SRC = path.join(__dirname, 'wdp-quality-sim.php');
const ADMIN_SIM_SRC = path.join(__dirname, 'wdp-admin-sim.php');

/**
 * Kalite yapılandırmaları: 4 tema × 4 para birimi × blok/klasik ödeme × HPOS açık/kapalı (her boyutun iki değeri de kapsanır).
 * @return {{id:string, theme:string, store:string, checkout:'blocks'|'classic', hpos:boolean}[]} Liste.
 */
export function qualityConfigs() {
  return [
    { id: 'q-tt5-try-blocks-hpos', theme: 'twentytwentyfive', store: 'try', checkout: 'blocks', hpos: true },
    { id: 'q-sf-gbp-classic-hpos', theme: 'storefront', store: 'gbp', checkout: 'classic', hpos: true },
    { id: 'q-blocksy-eur-blocks-nohpos', theme: 'blocksy', store: 'eur', checkout: 'blocks', hpos: false },
    { id: 'q-tt4-usd-classic-nohpos', theme: 'twentytwentyfour', store: 'usd', checkout: 'classic', hpos: false },
  ];
}

/**
 * @param {string} wpDir İşçi WP.
 * @param {{modules?:string, override?:boolean}} state Durum.
 */
export function setQualityState(wpDir, state) {
  const merged = { ...state, ...(process.env.WDP_Q_NODEFER === '1' ? { nodefer: true } : {}), ...(process.env.WDP_Q_NOSPLIT === '1' ? { nosplit: true } : {}), ...(process.env.WDP_Q_NOSTYLEDEFER === '1' ? { nostyledefer: true } : {}) };
  fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-quality-state.json'), JSON.stringify(merged));
}

/**
 * Yerel WP işçisini kurar, sunucuyu başlatır.
 * @param {{id:string, theme:string, store:string, checkout:string, hpos:boolean}} cfg Yapılandırma.
 * @param {number} port Port.
 * @param {{admin?:boolean}} [opts] Seçenekler.
 */
export async function bootQualityWorker(cfg, port, opts = {}) {
  const matrix = loadMatrix();
  const store = matrix.stores[cfg.store];
  const template = ensureMatrixTemplate();
  ensureTheme(template, cfg.theme);
  const resolved = { id: cfg.id, themeSpec: { slug: cfg.theme }, storeSpec: store, checkout: cfg.checkout, hpos: cfg.hpos };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(cfg.id, port, snap, { hpos: cfg.hpos });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-quality-sim.php'));
  if (opts.admin) fs.copyFileSync(ADMIN_SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-admin-sim.php'));
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) throw new Error(`çevrimdışı ödeme açılamadı: ${gateways.error || ''}`);
  setQualityState(wpDir, { modules: 'all', override: true });
  const server = await startPhpServer({ wpDir, port });
  return { wpDir, server, base: `http://127.0.0.1:${port}`, probe, store, cfg };
}

/**
 * Sonuç kaydı (tek satır JSON; koşucu toplar).
 * @param {object} rec Kayıt: {gate, config, device, name, ok, detail?}
 */
export function recordResult(rec) {
  const file = process.env.WDP_Q_RESULTS;
  if (!file) return;
  fs.appendFileSync(file, `${JSON.stringify(rec)}\n`);
}
