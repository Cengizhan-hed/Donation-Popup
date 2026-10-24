/**
 * e2e:full iPhone çocuk dilimleri: çekirdek + mutasyon.
 * Mutasyon kilidi yalnız mut diliminde alınır (alan süzgeci + device=iphone).
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

export const IPHONE_MUT_AREAS = Object.freeze([
  'amount-options',
  'form-fields',
  'campaign-blocks',
  'product-theme',
  'shortcodes',
  'empty-price',
]);

export const CHILD_TIMEOUT_MS = 20 * 60 * 1000;

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
      { deviceId: 'iphone', slice: 'mut', areas: [...IPHONE_MUT_AREAS] },
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
 * Yerel SQLite: mutasyon dilimi çekirdekle örtüşmesin.
 * Uzak: tüm çocuklar paralel (üst süre).
 * @param {Array<{ slice?: string }>} jobs
 * @param {{ local?: boolean }} [opts]
 * @returns {Array<Array>}
 */
export function partitionSpawnWaves(jobs, opts = {}) {
  const list = Array.isArray(jobs) ? jobs : [];
  if (!opts.local) return [list];
  const core = list.filter((j) => String(j.slice || '') !== 'mut');
  const mut = list.filter((j) => String(j.slice || '') === 'mut');
  return [core, mut].filter((w) => w.length);
}

export function wantAnyMutationArea(want, suites) {
  const list = Array.isArray(suites) ? suites : [];
  return list.some((row) => want(Array.isArray(row) ? row[0] : row));
}
