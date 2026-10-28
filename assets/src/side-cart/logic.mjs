/**
 * Yan sepet saf mantığı (DOM yok): birim testlenir.
 */

/** Dar ekran (alttan panel) sorgusu: tek form çekirdeğiyle aynı eşik. */
export const NARROW_QUERY = '(max-width: 639.98px)';

/** Sürükleyerek kapatma eşiği (px). */
export const DRAG_DISMISS_PX = 110;

/**
 * Yeni miktar (en az 1, tam sayı).
 *
 * @param {number|string} current Mevcut.
 * @param {number|string} delta Değişim (+1 / -1).
 * @return {number} Yeni miktar.
 */
export function nextQuantity(current, delta) {
  const base = Number.parseInt(String(current), 10);
  const step = Number.parseInt(String(delta), 10);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
  const safeStep = Number.isFinite(step) ? step : 0;
  return Math.max(1, safeBase + safeStep);
}

/**
 * Tab tuzağı: sıradaki odak dizini.
 *
 * @param {number} count Odaklanabilir öğe sayısı.
 * @param {number} index Şu anki dizin (-1 = katman içinde değil).
 * @param {boolean} backwards Shift+Tab mı.
 * @return {number} Hedef dizin (-1 = katmanın kendisi).
 */
export function nextFocusIndex(count, index, backwards) {
  if (count <= 0) {
    return -1;
  }
  if (index < 0) {
    return backwards ? count - 1 : 0;
  }
  if (backwards) {
    return index === 0 ? count - 1 : index - 1;
  }
  return index === count - 1 ? 0 : index + 1;
}

/**
 * Sürükleme yeterince uzun mu.
 *
 * @param {number} distance Piksel.
 * @return {boolean} Kapatılsın mı.
 */
export function shouldDismissOnDrag(distance) {
  return distance > DRAG_DISMISS_PX;
}

/**
 * Store API yanıtından Nonce başlığını okur (büyük/küçük harf duyarsız).
 *
 * @param {{get: Function}|null|undefined} headers Yanıt başlıkları.
 * @return {string} Nonce ya da boş.
 */
export function readNonce(headers) {
  if (!headers || typeof headers.get !== 'function') {
    return '';
  }
  return headers.get('Nonce') || headers.get('nonce') || headers.get('X-WC-Store-API-Nonce') || '';
}

/**
 * Sayaç değerini güvenli tam sayıya çevirir.
 *
 * @param {unknown} value Ham değer.
 * @return {number} 0 ya da büyük.
 */
export function toCount(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * WooCommerce sepet çerezinden kalem sayısı (`woocommerce_items_in_cart`: 0/1 ya da sayı). Çerez yoksa 0.
 *
 * @param {string} cookieString `document.cookie` değeri.
 * @return {number} 0 ya da büyük.
 */
export function itemsInCart(cookieString) {
  const match = /(?:^|;\s*)woocommerce_items_in_cart=([^;]*)/.exec(String(cookieString || ''));
  return match ? toCount(decodeURIComponent(match[1])) : 0;
}
