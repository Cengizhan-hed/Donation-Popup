/**
 * Bağışçı hesabı — saf mantık (DOM yok; birim test edilir).
 */

/** Parola alt sınırı (sunucuyla aynı). */
const MIN_PASSWORD = 8;

/**
 * E-posta biçimi (gevşek; asıl doğrulama sunucuda).
 *
 * @param {unknown} value Değer.
 * @return {boolean} Geçerli mi.
 */
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

/**
 * @param {unknown} value Değer.
 * @return {boolean} Parola uzunluğu yeterli mi.
 */
export function isStrongEnough(value) {
  return String(value || '').length >= MIN_PASSWORD;
}

/**
 * Sunucu yanıtından kullanıcıya gösterilecek ileti anahtarı.
 *
 * @param {number} status HTTP durumu.
 * @param {string} code Hata kodu.
 * @param {string} view Görünüm (login|register|reset).
 * @return {string} login | rate | email | pass | fail
 */
export function errorKey(status, code, view) {
  if (status === 429 || code === 'donation_panel_rate_limited') {
    return 'rate';
  }
  if (code === 'donation_panel_login_failed') {
    return 'login';
  }
  if (code === 'donation_panel_invalid_email') {
    return 'email';
  }
  if (code === 'donation_panel_weak_password') {
    return 'pass';
  }
  return view === 'login' && status === 401 ? 'login' : 'fail';
}

/**
 * Odak tuzağı için sonraki indeks.
 *
 * @param {number} current Şimdiki.
 * @param {number} length Eleman sayısı.
 * @param {boolean} backwards Shift+Tab.
 * @return {number} Yeni indeks.
 */
export function nextFocusIndex(current, length, backwards) {
  if (length <= 0) {
    return -1;
  }
  if (backwards) {
    return current <= 0 ? length - 1 : current - 1;
  }
  return current >= length - 1 ? 0 : current + 1;
}

/**
 * Alt panel sürüklenerek kapatılsın mı.
 *
 * @param {number} distance Piksel.
 * @param {number} height Panel yüksekliği.
 * @param {number} velocity px/ms.
 * @return {boolean} Kapat.
 */
export function shouldDismissOnDrag(distance, height, velocity) {
  return distance > Math.min(120, height * 0.3) || velocity > 0.6;
}

/**
 * @param {string} base Taban adres.
 * @param {string} path Uç.
 * @return {string} Birleşik adres.
 */
export function endpoint(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}
