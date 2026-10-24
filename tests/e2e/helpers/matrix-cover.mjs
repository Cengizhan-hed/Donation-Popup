/**
 * Yerel tema × WooCommerce uyum matrisi tanımı ve CLI.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from './env-root.mjs';
import { DEVICE_ORDER, parseDeviceList } from './devices.mjs';

export const MATRIX_JSON = path.join(ROOT, 'tests/e2e/matrix.json');
export const MATRIX_OUT_DIR = path.join(ROOT, 'build/e2e/matrix');

/**
 * @param {string} [file]
 */
export function loadMatrix(file = MATRIX_JSON) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new Error('matrix.json bozuk');
  if (!raw.stores || !raw.themes || !Array.isArray(raw.configs)) {
    throw new Error('matrix.json stores/themes/configs zorunlu');
  }
  return raw;
}

/**
 * Pairwise kapsama: her değer ≥1, her tema hem blok hem klasik ödeme,
 * HPOS her iki durumda ≥2.
 * @param {ReturnType<typeof loadMatrix>} matrix
 */
export function assertCovering(matrix) {
  const configs = matrix.configs || [];
  if (!configs.length) throw new Error('matrix.configs boş');
  const themeIds = Object.keys(matrix.themes || {});
  const storeIds = Object.keys(matrix.stores || {});
  const usedThemes = new Set(configs.map((c) => c.theme));
  const usedStores = new Set(configs.map((c) => c.store));
  const usedCheckout = new Set(configs.map((c) => c.checkout));
  for (const id of themeIds) {
    if (!usedThemes.has(id)) throw new Error(`tema hiç yok: ${id}`);
  }
  for (const id of storeIds) {
    if (!usedStores.has(id)) throw new Error(`mağaza hiç yok: ${id}`);
  }
  if (!usedCheckout.has('blocks') || !usedCheckout.has('classic')) {
    throw new Error('checkout blocks ve classic en az birer kez olmalı');
  }
  for (const theme of themeIds) {
    const subset = configs.filter((c) => c.theme === theme);
    const ch = new Set(subset.map((c) => c.checkout));
    if (!ch.has('blocks') || !ch.has('classic')) {
      throw new Error(`tema ${theme} hem blocks hem classic ödeme ile yok`);
    }
  }
  const hposOn = configs.filter((c) => c.hpos === true).length;
  const hposOff = configs.filter((c) => c.hpos === false).length;
  if (hposOn < 2 || hposOff < 2) {
    throw new Error(`HPOS her iki durumda ≥2 (açık=${hposOn} kapalı=${hposOff})`);
  }
  const ids = new Set();
  for (const c of configs) {
    if (!c.id) throw new Error('yapılandırma id boş');
    if (ids.has(c.id)) throw new Error(`yinelenen id: ${c.id}`);
    ids.add(c.id);
    if (!matrix.themes[c.theme]) throw new Error(`bilinmeyen tema: ${c.theme}`);
    if (!matrix.stores[c.store]) throw new Error(`bilinmeyen mağaza: ${c.store}`);
    if (c.checkout !== 'blocks' && c.checkout !== 'classic') {
      throw new Error(`checkout geçersiz: ${c.checkout}`);
    }
  }
  return true;
}

/**
 * @param {ReturnType<typeof loadMatrix>} matrix
 * @param {string} id
 */
export function resolveConfig(matrix, id) {
  const row = (matrix.configs || []).find((c) => c.id === id);
  if (!row) throw new Error(`yapılandırma yok: ${id}`);
  const theme = matrix.themes[row.theme];
  const store = matrix.stores[row.store];
  return { ...row, themeSpec: theme, storeSpec: store };
}

/**
 * @param {string[]} argv
 */
export function parseMatrixArgs(argv = []) {
  const a = argv.filter((x) => x !== '--');
  /** @type {string[]} */
  let only = [];
  let device = 'all';
  let workers = 0;
  let help = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--help' || x === '-h') help = true;
    else if (x === '--only') only = String(a[++i] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    else if (x.startsWith('--only='))
      only = x
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x === '--device') device = String(a[++i] || 'all');
    else if (x.startsWith('--device=')) device = x.slice('--device='.length) || 'all';
    else if (x === '--workers') workers = Number(a[++i] || 0);
    else if (x.startsWith('--workers=')) workers = Number(x.slice('--workers='.length) || 0);
  }
  const devices = parseDeviceList(device);
  return { only, devices, workers, help, deviceRaw: device };
}

/**
 * @param {number} [requested]
 * @param {number} [fallback]
 */
export function resolveWorkerCount(requested = 0, fallback = 3) {
  const cpu =
    typeof os.availableParallelism === 'function'
      ? os.availableParallelism()
      : os.cpus()?.length || 1;
  const def = Math.min(Math.max(1, fallback), Math.max(1, cpu));
  const n = Number(requested) > 0 ? Number(requested) : def;
  return Math.max(1, Math.min(n, Math.max(1, cpu)));
}

export { DEVICE_ORDER };

export const RTL_LOCALES = ['ar', 'he_IL', 'fa_IR', 'ur'];

/**
 * @param {string} locale
 */
export function isRtlLocale(locale) {
  const loc = String(locale || '');
  const base = loc.includes('_') ? loc.slice(0, loc.indexOf('_')) : loc;
  return ['ar', 'he', 'fa', 'ur'].includes(base);
}

/**
 * @param {ReturnType<typeof loadMatrix>} matrix
 */
export function rtlSpec(matrix) {
  const rtl = matrix.rtl || {};
  return {
    locales: Array.isArray(rtl.locales) && rtl.locales.length ? rtl.locales : ['ar', 'he_IL'],
    baseConfig: rtl.baseConfig || 'tt5-try-blocks-hpos',
    devices: Array.isArray(rtl.devices) && rtl.devices.length ? rtl.devices : ['iphone', 'desktop'],
    screens: Array.isArray(rtl.screens) && rtl.screens.length
      ? rtl.screens
      : ['popup', 'panel', 'inline', 'cart', 'checkout', 'related', 'progress', 'error'],
  };
}
