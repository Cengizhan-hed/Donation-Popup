/**
 * e2e:full iPhone çocuk dilimleri: çekirdek + iki mutasyon.
 * Mutasyon kilidi yalnız mut dilimlerinde alınır (alan süzgeci + device=iphone).
 * staging30 iphone-mut 10.34.13: form-fields 444s + campaign-blocks 512s +
 * product-theme 151s + shortcodes 64s → 20 dk üst süre (empty-price kesildi).
 */

export const IPHONE_CORE_AREAS = Object.freeze([
  'core',
  'shell',
  'sadaka',
  'shares',
  'mobile-a11y',
  'checkout-flow',
  'layout',
  'admin',
]);

/** form-fields 444s + product-theme 151s + amount-options ~3s */
export const IPHONE_MUT_AREAS_A = Object.freeze([
  'amount-options',
  'form-fields',
  'product-theme',
]);

/** campaign-blocks 512s + shortcodes 64s + empty-price (önce kesilen) */
export const IPHONE_MUT_AREAS_B = Object.freeze([
  'campaign-blocks',
  'shortcodes',
  'empty-price',
]);

export const IPHONE_MUT_AREAS = Object.freeze([
  ...IPHONE_MUT_AREAS_A,
  ...IPHONE_MUT_AREAS_B,
]);

export const CHILD_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * @param {string} slice
 */
export function isMutationSlice(slice) {
  return /^mut\d*$/.test(String(slice || ''));
}

/**
 * @param {string} deviceId
 * @param {string} slice
 */
export function outputDeviceId(deviceId, slice) {
  const d = String(deviceId || 'desktop');
  const s = String(slice || '');
  if (s && s !== 'core') return `${d}-${s}`;
  return d;
}

/**
 * @param {string} deviceId
 * @param {string[]|null|undefined} explicitAreas
 * @returns {Array<{ deviceId: string, slice: string, areas: string[]|null }>}
 */
export function fullChildJobs(deviceId, explicitAreas) {
  if (explicitAreas && explicitAreas.length) {
    return [{ deviceId: String(deviceId), slice: '', areas: explicitAreas }];
  }
  if (String(deviceId) === 'iphone') {
    return [
      { deviceId: 'iphone', slice: 'core', areas: [...IPHONE_CORE_AREAS] },
      { deviceId: 'iphone', slice: 'mut', areas: [...IPHONE_MUT_AREAS_A] },
      { deviceId: 'iphone', slice: 'mut2', areas: [...IPHONE_MUT_AREAS_B] },
    ];
  }
  return [{ deviceId: String(deviceId), slice: '', areas: null }];
}

/**
 * Mutasyon alanlarından en az biri isteniyor mu?
 * @param {(id: string) => boolean} want
 * @param {string[][]} suites [area, ...]
 */
/**
 * Mut dilimleri birbirini kilitlemesin: her mut ayrı dalga.
 * Yerel SQLite: mut çekirdekten sonra. Uzak: ilk mut çekirdek/android/desktop ile paralel.
 * @param {Array<{ slice?: string }>} jobs
 * @param {{ local?: boolean }} [opts]
 * @returns {Array<Array>}
 */
export function partitionSpawnWaves(jobs, opts = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  const rest = list.filter((j) => !isMutationSlice(j.slice));
  const muts = list.filter((j) => isMutationSlice(j.slice));
  const waves = [];
  if (opts.local) {
    if (rest.length) waves.push(rest);
    for (const m of muts) waves.push([m]);
    return waves.filter((w) => w.length);
  }
  if (muts.length) {
    waves.push([...rest, muts[0]].filter(Boolean));
    for (const m of muts.slice(1)) waves.push([m]);
    return waves.filter((w) => w.length);
  }
  return rest.length ? [rest] : [];
}

export function wantAnyMutationArea(want, suites) {
  const list = Array.isArray(suites) ? suites : [];
  return list.some((row) => want(Array.isArray(row) ? row[0] : row));
}
