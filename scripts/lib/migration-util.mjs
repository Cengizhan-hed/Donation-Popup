/**
 * Göç anlık görüntüsü: kanonik JSON, tür, hash. Değerleri konsola yazmaz.
 */
import { createHash } from 'node:crypto';

export const HASH_LEN = 12;

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function sortDeep(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(sortDeep);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortDeep(value[k]);
    }
    return out;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function canonical(value) {
  return JSON.stringify(sortDeep(value));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function valueHash(value) {
  return createHash('sha256').update(canonical(value)).digest('hex').slice(0, HASH_LEN);
}

/**
 * @param {unknown} value
 * @returns {'string'|'array'|'bool'|'sayı'|'boş'}
 */
export function valueType(value) {
  if (value === undefined || value === null || value === '') return 'boş';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'sayı';
  if (Array.isArray(value)) return value.length === 0 ? 'boş' : 'array';
  if (typeof value === 'object') return Object.keys(value).length === 0 ? 'boş' : 'array';
  return 'string';
}

/**
 * @param {unknown} value
 * @returns {{ type: string, hash: string, value: unknown }}
 */
export function makeEntry(value) {
  return { type: valueType(value), hash: valueHash(value), value };
}

/**
 * Dizi/nesne yaprak yolları. Skaler liste tek yaprak kalır.
 * @param {unknown} value
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
export function flattenValue(value, path) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return { [path]: value };
    const out = {};
    for (const k of keys) {
      Object.assign(out, flattenValue(value[k], path ? `${path}.${k}` : k));
    }
    return out;
  }
  return { [path]: value };
}

/**
 * @param {Record<string, { value?: unknown } | unknown>} options
 * @param {string} [ns]
 */
export function flattenOptionEntries(options, ns = 'option') {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, raw] of Object.entries(options || {})) {
    const value =
      raw && typeof raw === 'object' && !Array.isArray(raw) && Object.prototype.hasOwnProperty.call(raw, 'value')
        ? raw.value
        : raw;
    const path = `${ns}:${key}`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenValue(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

/**
 * Konsol / rapor satırı — değer yok.
 * @param {string} key
 * @param {{ type?: string, hash?: string, value?: unknown }} [entry]
 */
export function summaryLine(key, entry) {
  const type = entry?.type || (entry && 'value' in entry ? valueType(entry.value) : 'boş');
  const hash = entry?.hash || (entry && 'value' in entry ? valueHash(entry.value) : valueHash(null));
  return `${key}\t${type}\t${hash}`;
}

/**
 * @param {object} snap
 * @returns {string}
 */
export function formatSnapshotConsole(snap) {
  const options = snap?.options || {};
  const products = Array.isArray(snap?.products) ? snap.products : [];
  const wc = snap?.woocommerce || {};
  const lines = [
    `anahtar(seçenek): ${Object.keys(options).length}`,
    `ürün: ${products.length}`,
    `woocommerce: ${Object.keys(wc).length}`,
    '--- seçenekler (ad, tür, hash) ---',
  ];
  for (const key of Object.keys(options).sort()) {
    lines.push(summaryLine(key, options[key]));
  }
  lines.push('--- woocommerce (ad, tür, hash) ---');
  for (const key of Object.keys(wc).sort()) {
    lines.push(summaryLine(key, wc[key]));
  }
  lines.push('--- ürün meta özeti ---');
  for (const p of products) {
    const meta = p?.meta || {};
    const n = Object.keys(meta).length;
    lines.push(`ürün#${p.id || '?'} status=${p.status || ''} meta=${n}`);
    for (const key of Object.keys(meta).sort()) {
      lines.push(`  ${summaryLine(key, meta[key])}`);
    }
  }
  return lines.join('\n');
}

/**
 * Rapor/konsol metninde örnek değer dizgisi var mı?
 * @param {string} text
 * @param {string[]} forbidden
 */
export function findLeakedValues(text, forbidden) {
  const hay = String(text || '');
  return (forbidden || []).filter((v) => v && hay.includes(v));
}
