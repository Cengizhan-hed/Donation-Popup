/**
 * Bağış listesi: DOM'suz saf yardımcılar (birim testli).
 */

const SLUG_OK = /^[a-z0-9_-]+$/i;
const HASH_PREFIX = 'bagis-';

/**
 * `#bagis-<slug>` adresinden kategori slug'ı.
 *
 * @param {string} hash Adres parçası.
 * @return {string} Slug ya da ''.
 */
export function parseHashSlug(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith(HASH_PREFIX)) {
    return '';
  }
  const slug = raw.slice(HASH_PREFIX.length);
  return SLUG_OK.test(slug) ? slug : '';
}

/**
 * Kart kategorileri seçili sekmeye uyuyor mu.
 *
 * @param {string} cats Boşlukla ayrılmış kategori slug'ları.
 * @param {string} slug Sekme slug'ı ('all' = hepsi).
 * @return {boolean} Görünmeli mi.
 */
export function matchesCategory(cats, slug) {
  if (!slug || slug === 'all') {
    return true;
  }
  return String(cats || '')
    .split(/\s+/)
    .includes(slug);
}

/**
 * Form ucu adresi.
 *
 * @param {string} rest Kök REST adresi (`.../donation-panel/v1/`).
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {string} Adres.
 */
export function buildExperienceUrl(rest, id, kind) {
  const base = String(rest || '');
  const joiner = base.includes('?') ? '&' : '?';
  // Düz bağlantı yapısında (`?rest_route=/donation-panel/v1/`) yol sonuna eklenir, sorgu `&` ile.
  return `${base}experience/${encodeURIComponent(String(id))}${joiner}kind=${encodeURIComponent(String(kind || 'popup'))}`;
}

/**
 * Tıklama betiğe mi ait (yeni sekme/pencere istekleri varsayılan kalır).
 *
 * @param {{button?: number, metaKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean}} event Olay.
 * @return {boolean} Betik açsın mı.
 */
export function shouldHandleClick(event) {
  return !event.button && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Toplu ön alma isteği başına en çok ürün (sunucu sınırıyla aynı). */
export const BATCH_MAX = 12;

/**
 * Toplu form ucu adresi (`experiences?ids=1,2&kind=…`).
 *
 * @param {string}   rest Kök REST adresi.
 * @param {string[]} ids  Ürün kimlikleri (yinelenen/geçersiz atılır).
 * @param {string}   kind Kap türü.
 * @return {string} Adres ('' = geçerli kimlik yok).
 */
export function buildBatchUrl(rest, ids, kind) {
  const list = uniqueIds(ids);
  if (!list.length) {
    return '';
  }
  const base = String(rest || '');
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}experiences${joiner}ids=${list.join(',')}&kind=${encodeURIComponent(String(kind || 'popup'))}`;
}

/**
 * @param {Array<string|number>} ids Kimlikler.
 * @return {string[]} Yalnız pozitif tam sayılar, sırası korunmuş, tekrarsız.
 */
export function uniqueIds(ids) {
  const out = [];
  (ids || []).forEach((raw) => {
    const id = String(raw).trim();
    if (/^[1-9]\d*$/.test(id) && !out.includes(id)) {
      out.push(id);
    }
  });
  return out;
}

/**
 * Kimlikleri en çok `size` boyutlu parçalara böler.
 *
 * @param {string[]} ids  Kimlikler.
 * @param {number}   size Parça boyutu.
 * @return {string[][]} Parçalar.
 */
export function chunk(ids, size = BATCH_MAX) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Görünür alana yaklaşan kartların formu boşta önceden alınsın mı (veri tasarrufu / 2G'de yalnız niyetle alınır).
 *
 * @param {{saveData?: boolean, effectiveType?: string}|undefined} connection `navigator.connection`.
 * @return {boolean} Önceden alınsın mı.
 */
export function shouldPrefetchAhead(connection) {
  if (!connection) {
    return true;
  }
  if (connection.saveData) {
    return false;
  }
  return !/(^|-)2g$/.test(String(connection.effectiveType || ''));
}

/**
 * Önbellek anahtarı (aynı ürün + kap türü sayfada bir kez alınır; liste ve mağaza kartı paylaşır).
 *
 * @param {string} rest Kök REST adresi.
 * @param {string} id   Ürün kimliği.
 * @param {string} kind Kap türü.
 * @return {string} Anahtar.
 */
export function hostKey(rest, id, kind) {
  return `${String(rest || '')}|${String(id)}|${String(kind || 'popup')}`;
}
