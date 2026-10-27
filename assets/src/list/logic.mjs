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
