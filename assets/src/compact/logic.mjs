/**
 * Compact bağış kartı — saf mantık (DOM yok; birim test edilebilir).
 */
import { parseAmountDetailed } from '../experiences/amount.mjs';
import { describeImpact } from '../campaign/format.mjs';

/**
 * Adımlar (sıra sabit). Serbest tutar: tutar → ad/telefon (düğme sepete ekleyip ödeme sayfasına götürür). Sabit fiyatta tek
 * ekran ("amount" adıyla, ad/telefon dahil) vardır.
 */
export const STEPS = ['amount', 'details'];

/**
 * Seçilen tutarın etki ifadesi ("2 sıcak yemek"; tutar aynı satırda ayrıca yazılır); kademe yoksa ''.
 *
 * @param {number|null} amount Tutar.
 * @param {Array<{unit: number, one: string, other: string}>} tiers Kademeler.
 * @param {string} locale Dil.
 * @return {string} Metin.
 */
export function effectLine(amount, tiers, locale) {
  if (!(Number(amount) > 0) || !Array.isArray(tiers) || !tiers.length) {
    return '';
  }
  return describeImpact(Number(amount), tiers, locale);
}

/**
 * Kart içinde kalan (dışarı yayılmayan) olaylar — kaydırıcıya ulaşmaz. Bitiş olayları (pointerup/touchend) bilerek YOK:
 * kartın dışında başlamış bir sürüklemenin kaydırıcıda düzgün bitmesi gerekir.
 */
export const ISOLATED_EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'mousedown', 'wheel', 'keydown'];

/**
 * Tutarın durumu: değer + hata türü.
 *
 * @param {{fixed: boolean, quick: number|null, raw: string, unit: number, qty: number, min: number, currency: object}} input Girdi.
 * @return {{value: number|null, error: ''|'amount'|'format'|'min'}} Sonuç.
 */
export function evaluateAmount(input) {
  const { fixed, min } = input;
  const picked = pickAmount(input);
  if (picked.error) {
    return picked;
  }
  const { value } = picked;
  const floor = fixed ? 0 : Math.max(Number(min) || 0, 0.01);
  return value < floor ? { value, error: 'min' } : { value, error: '' };
}

/**
 * Seçilen/yazılan ham tutar (en düşük tutar denetimi yok).
 *
 * @param {{fixed: boolean, quick: number|null, raw: string, unit: number, qty: number, currency: object}} input Girdi.
 * @return {{value: number|null, error: ''|'amount'|'format'}} Sonuç.
 */
function pickAmount(input) {
  const { fixed, quick, raw, unit, qty, currency } = input;
  if (fixed) {
    return unit > 0 ? { value: unit * Math.max(1, qty || 1), error: '' } : { value: null, error: 'amount' };
  }
  if (typeof quick === 'number' && quick > 0) {
    return { value: quick, error: '' };
  }
  const text = String(raw || '').trim();
  const detail = text === '' ? null : parseAmountDetailed(text, currency);
  if (detail && detail.status === 'ambiguous') {
    return { value: null, error: 'format' };
  }
  return detail && detail.ok && detail.amount > 0 ? { value: detail.amount, error: '' } : { value: null, error: 'amount' };
}

/**
 * Ödeme yönlendirmesi doğrulaması (derinlemesine savunma): http/https, sayfayla aynı alan adı, kimlik bilgisi yok ve yol,
 * beklenen ödeme sayfasının (sunucunun `dpCheckout` adresi) yolu ya da altındaki bir uç (ör. `order-pay`) olmalı.
 * Geçersizse '' (yönlendirme yapılmaz).
 *
 * @param {string} target   Yönlendirilecek adres (sunucu yanıtı ya da yedek).
 * @param {string} expected Beklenen ödeme sayfası adresi.
 * @param {string} pageHref Sayfa adresi.
 * @return {string} Güvenli adres ya da ''.
 */
export function safeCheckoutTarget(target, expected, pageHref) {
  try {
    const page = new URL(String(pageHref));
    const url = new URL(String(target || ''), page.href);
    const base = new URL(String(expected || ''), page.href);
    const root = base.pathname.replace(/\/+$/, '');
    const web = (u) => u.protocol === 'https:' || u.protocol === 'http:';
    const under = url.pathname.replace(/\/+$/, '') === root || url.pathname.startsWith(`${root}/`);
    const same = url.hostname === page.hostname && base.hostname === page.hostname;
    return web(url) && web(base) && same && !url.username && !url.password && root !== '' && under ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Gezinme sonrası adım dizini (0–1 aralığı).
 *
 * @param {number} current Mevcut dizin.
 * @param {number} delta   +1 / -1.
 * @return {number} Yeni dizin.
 */
export function moveStep(current, delta) {
  return Math.min(STEPS.length - 1, Math.max(0, (Number(current) || 0) + delta));
}

/**
 * `%1$d`, `%2$s`, `%s` yer tutucularını sırayla doldurur (çevrilebilir metinler sunucudan gelir).
 *
 * @param {string}             format Metin.
 * @param {Array<string|number>} values Değerler.
 * @return {string} Sonuç.
 */
export function fill(format, values) {
  let next = 0;
  return String(format || '').replace(/%(?:(\d+)\$)?([sd])/g, (match, position) => {
    const index = position ? Number(position) - 1 : next++;
    return index < values.length ? String(values[index]) : match;
  });
}

/**
 * Ekran okuyucu adım duyurusu ("Adım 2/2: Bilgileriniz").
 *
 * @param {string} format Biçim (`Step %1$d of %2$d: %3$s`).
 * @param {number} index  Adım dizini.
 * @param {string} name   Adım adı.
 * @param {number} total  Sayılan adım sayısı (serbest tutar 2, sabit fiyat 1).
 * @return {string} Duyuru.
 */
export function announcement(format, index, name, total = STEPS.length - 1) {
  return index >= total ? name : fill(format, [index + 1, total, name]);
}

/**
 * Kaydırıcı uyumu: kart içinde sonuçlanan olay dışarı yayılmamalı mı.
 *
 * @param {string} type Olay türü.
 * @return {boolean} Yayılım durdurulsun mu.
 */
export function isolates(type) {
  return ISOLATED_EVENTS.includes(type);
}

/**
 * Yatay tekerlek hareketi mi (yatay kaydırıcının sayfayı kaydırmasını önlemek için).
 *
 * @param {number} deltaX Yatay.
 * @param {number} deltaY Dikey.
 * @return {boolean} Yatay mı.
 */
export function horizontalWheel(deltaX, deltaY) {
  return Math.abs(Number(deltaX) || 0) > Math.abs(Number(deltaY) || 0);
}

/**
 * Bağışçı sayısı metni (tekil/çoğul biçimi sunucudan).
 *
 * @param {number} count  Sayı.
 * @param {string} one    Tekil biçim (`%s supporter`).
 * @param {string} many   Çoğul biçim (`%s supporters`).
 * @param {string} locale Dil.
 * @return {string} Metin ('' = gösterme).
 */
export function donorsText(count, one, many, locale) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n < 1) {
    return '';
  }
  return fill(n === 1 ? one : many, [formatCount(n, locale)]);
}

/**
 * @param {number} n      Sayı.
 * @param {string} locale Dil.
 * @return {string} Yerel biçimli sayı.
 */
function formatCount(n, locale) {
  try {
    return new Intl.NumberFormat(locale || undefined).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Yüzde (0–100 tam sayı).
 *
 * @param {unknown} value Ham değer.
 * @return {number} Yüzde.
 */
export function percentOf(value) {
  const n = Math.round(Number(value) || 0);
  return Math.min(100, Math.max(0, n));
}
