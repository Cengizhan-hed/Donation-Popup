/**
 * İki göç anlık görüntüsünü karşılaştırır. Rapora değer yazılmaz.
 */
import { canonical, valueHash, valueType, flattenOptionEntries, flattenValue } from './migration-util.mjs';

export const CLASSES = [
  'KORUNDU',
  'KORUNDU (tür)',
  'TAŞINDI',
  'DEĞİŞTİ',
  'VARSAYILANA DÖNDÜ',
  'KAYBOLDU',
  'YENİ',
  'BEKLENEN DEĞİŞİM',
];

export const EXPECTED_CHANGE_KEYS = [
  'wdp_version',
  'wdp_db_version',
  'wdp_cache_version',
  'wdp_list_cache_version',
  'wdp_migration_log',
  // CSS bundle hash: kurulum/göç sonrası assets registry imzayı yeniler (veri kaybı değil).
  'wdp_css_signature',
];

/**
 * Yalnız 12.0.0 hedef sürümü için beklenen farklar (Release_12_Upgrade bilerek siler / yeniler).
 * Başka anahtarlar yine KAYBOLDU/DEĞİŞTİ olarak kırmızı kalır.
 */
export const EXPECTED_CHANGE_KEYS_12_0_0 = [
  'donation_panel_settings.experiences.engine',
  'donation_panel_migrations.version',
];

/**
 * @param {string|undefined} targetVersion
 */
function appliesTo12(targetVersion) {
  return targetVersion === undefined || /^12\.0(\.|$)/.test(String(targetVersion));
}

/**
 * Sürüm / önbellek / log / wdp_migrated_* — çıkış 2 üretmez.
 * @param {string} key
 * @param {string} [targetVersion]
 */
export function isExpectedChangeKey(key, targetVersion) {
  const k = String(key || '').replace(/^option:/, '');
  if (EXPECTED_CHANGE_KEYS.includes(k)) return true;
  if (appliesTo12(targetVersion) && EXPECTED_CHANGE_KEYS_12_0_0.includes(k)) return true;
  if (k.startsWith('wdp_migrated_')) return true;
  return false;
}

const MISSING = Symbol('missing');

/**
 * @param {unknown} entry
 */
export function entryValue(entry) {
  if (entry === undefined) return MISSING;
  if (entry !== null && typeof entry === 'object' && !Array.isArray(entry) && Object.prototype.hasOwnProperty.call(entry, 'value')) {
    return entry.value;
  }
  return entry;
}

/**
 * @param {object} snap
 * @returns {Record<string, unknown>}
 */
export function flattenSnapshot(snap) {
  /** @type {Record<string, unknown>} */
  const out = {};
  Object.assign(out, flattenOptionEntries(snap?.options || {}, 'option'));
  Object.assign(out, flattenOptionEntries(snap?.woocommerce || {}, 'wc'));
  const products = Array.isArray(snap?.products) ? snap.products : [];
  for (const p of products) {
    const id = p?.id;
    const matchId = p?.source_id || p?.sourceId || id;
    const prefix = `product:${matchId}`;
    out[`${prefix}._status`] = p?.status ?? '';
    const meta = p?.meta || {};
    for (const [k, raw] of Object.entries(meta)) {
      const value = entryValue(raw);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, flattenValue(value, `${prefix}.meta.${k}`));
      } else {
        out[`${prefix}.meta.${k}`] = value;
      }
    }
  }
  return out;
}

/**
 * @param {object} before
 * @param {object} after
 * @param {{ remap?: Record<string,string>, defaults?: Record<string, unknown>, fieldDefaults?: Record<string, unknown>, idMap?: Record<string, number|string> }} [opts]
 */
export function compareSnapshots(before, after, opts = {}) {
  const remap = opts.remap || {};
  const defaults = opts.defaults || {};
  const fieldDefaults = opts.fieldDefaults || {};
  const idMap = opts.idMap || after?.id_map || after?.idMap || {};

  const beforeAdj = remapProductIds(before, idMap);
  const a = flattenSnapshot(beforeAdj);
  const b = flattenSnapshot(after || {});

  const consumedNew = new Set();
  const consumedOld = new Set();
  /** @type {Array<{ key: string, class: string, beforeHash: string, afterHash: string, type: string }>} */
  const rows = [];

  const remapLeaves = expandRemap(remap, a, b);
  for (const [oldKey, newKey] of Object.entries(remapLeaves)) {
    if (!(oldKey in a) || oldKey in b) continue;
    if (!(newKey in b)) continue;
    if (canonical(a[oldKey]) === canonical(b[newKey])) {
      rows.push(row(oldKey, 'TAŞINDI', a[oldKey], b[newKey]));
      consumedOld.add(oldKey);
      consumedNew.add(newKey);
    }
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of [...keys].sort()) {
    if (consumedOld.has(key) || consumedNew.has(key)) continue;
    const hasA = Object.prototype.hasOwnProperty.call(a, key);
    const hasB = Object.prototype.hasOwnProperty.call(b, key);
    const va = hasA ? a[key] : MISSING;
    const vb = hasB ? b[key] : MISSING;
    const cls = classify(key, va, vb, defaults, fieldDefaults, opts.targetVersion);
    rows.push(row(key, cls, hasA ? va : undefined, hasB ? vb : undefined));
  }

  const counts = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  for (const r of rows) counts[r.class] += 1;

  const problems = rows.filter(
    (r) => r.class === 'KAYBOLDU' || r.class === 'VARSAYILANA DÖNDÜ' || r.class === 'DEĞİŞTİ'
  );
  const byteIdentical = canonical(a) === canonical(b);

  return {
    rows,
    counts,
    problems,
    remap,
    identical: byteIdentical,
    fail: problems.length > 0,
  };
}

function expandRemap(remap, a, b) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [oldKey, newKey] of Object.entries(remap || {})) {
    out[`option:${oldKey}`] = `option:${newKey}`;
    for (const ak of Object.keys(a)) {
      if (ak === `option:${oldKey}` || ak.startsWith(`option:${oldKey}.`)) {
        const suffix = ak.slice(`option:${oldKey}`.length);
        out[ak] = `option:${newKey}${suffix}`;
      }
    }
  }
  return out;
}

function classify(key, va, vb, defaults, fieldDefaults, targetVersion) {
  const hasA = va !== MISSING;
  const hasB = vb !== MISSING;
  if (!hasA && hasB) return isExpectedChangeKey(key, targetVersion) ? 'BEKLENEN DEĞİŞİM' : 'YENİ';
  if (hasA && !hasB) return isExpectedChangeKey(key, targetVersion) ? 'BEKLENEN DEĞİŞİM' : 'KAYBOLDU';
  if (canonical(va) === canonical(vb)) return 'KORUNDU';
  if (isExpectedChangeKey(key, targetVersion)) return 'BEKLENEN DEĞİŞİM';
  if (numericTypeEqual(va, vb)) return 'KORUNDU (tür)';
  const def = lookupDefault(key, defaults, fieldDefaults);
  if (def !== undefined && canonical(vb) === canonical(def) && canonical(va) !== canonical(def)) {
    return 'VARSAYILANA DÖNDÜ';
  }
  return 'DEĞİŞTİ';
}

/**
 * Same number after stripping a trailing px/% and string/number cast ("12" → 12, "12px" → 12).
 * Hex, lists and empty string are not numeric.
 * @param {unknown} a
 * @param {unknown} b
 */
export function numericTypeEqual(a, b) {
  const na = coerceNumeric(a);
  const nb = coerceNumeric(b);
  return Number.isFinite(na) && na === nb;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function coerceNumeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return NaN;
  const t = value.trim();
  if (t === '') return NaN;
  if (/^-?\d+(\.\d+)?px$/i.test(t)) return Number(t.slice(0, -2));
  if (/^-?\d+(\.\d+)?%$/.test(t)) return Number(t.slice(0, -1));
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return NaN;
}

function lookupDefault(key, defaults, fieldDefaults) {
  if (Object.prototype.hasOwnProperty.call(defaults, key)) return defaults[key];
  const opt = key.startsWith('option:') ? key.slice('option:'.length) : key;
  if (Object.prototype.hasOwnProperty.call(defaults, opt)) return defaults[opt];
  const field = opt.includes('.') ? opt.slice(opt.lastIndexOf('.') + 1) : opt;
  if (Object.prototype.hasOwnProperty.call(fieldDefaults, field)) return fieldDefaults[field];
  return undefined;
}

function row(key, cls, va, vb) {
  return {
    key,
    class: cls,
    beforeHash: va === undefined || va === MISSING ? '-' : valueHash(va),
    afterHash: vb === undefined || vb === MISSING ? '-' : valueHash(vb),
    type: vb !== undefined && vb !== MISSING ? valueType(vb) : va !== undefined && va !== MISSING ? valueType(va) : 'boş',
  };
}

function remapProductIds(snap, idMap) {
  if (!snap || !idMap || Object.keys(idMap).length === 0) return snap;
  const products = Array.isArray(snap.products)
    ? snap.products.map((p) => {
        const oldId = p?.id;
        const mapped = idMap[String(oldId)] ?? idMap[oldId];
        return mapped ? { ...p, id: mapped, source_id: oldId } : p;
      })
    : [];
  return { ...snap, products };
}

/**
 * @param {ReturnType<typeof compareSnapshots>} result
 * @param {{ title?: string, beforeLabel?: string, afterLabel?: string }} [meta]
 */
export function formatCompareMarkdown(result, meta = {}) {
  const title = meta.title || 'Göç karşılaştırması';
  const lines = [
    `# ${title}`,
    '',
    `Önce: ${meta.beforeLabel || 'before'}`,
    `Sonra: ${meta.afterLabel || 'after'}`,
    '',
    '## Sınıf sayıları',
    '',
    '| Sınıf | Adet |',
    '|-------|------|',
  ];
  for (const c of CLASSES) {
    lines.push(`| ${c} | ${result.counts[c] || 0} |`);
  }
  lines.push('', '## Eşleme tablosu (TAŞINDI)', '');
  const remapEntries = Object.entries(result.remap || {});
  if (!remapEntries.length) {
    lines.push('_Eşleme yok._');
  } else {
    lines.push('| Eski | Yeni |', '|------|------|');
    for (const [a, b] of remapEntries) lines.push(`| \`${a}\` | \`${b}\` |`);
  }
  lines.push('', '## Anahtarlar (ad, sınıf, hash)', '');
  lines.push('| Anahtar | Sınıf | Tür | Önce hash | Sonra hash |');
  lines.push('|---------|-------|-----|-----------|------------|');
  for (const r of result.rows) {
    lines.push(`| \`${r.key}\` | ${r.class} | ${r.type} | ${r.beforeHash} | ${r.afterHash} |`);
  }
  if (result.problems.length) {
    lines.push('', '## Sorunlu anahtarlar', '');
    for (const r of result.problems) {
      lines.push(`- ${r.class}: \`${r.key}\` (${r.beforeHash} → ${r.afterHash})`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * İdempotent: iki görüntü birebir aynı olmalı.
 * @param {object} a
 * @param {object} b
 */
export function compareIdempotent(a, b) {
  const r = compareSnapshots(a, b, {});
  const notSame = r.rows.filter(
    (row) => row.class !== 'KORUNDU' && row.class !== 'KORUNDU (tür)' && row.class !== 'BEKLENEN DEĞİŞİM'
  );
  return {
    ...r,
    fail: notSame.length > 0,
    problems: notSame,
  };
}
