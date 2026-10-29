/**
 * Compact bağış kartı — saf mantık (DOM yok; birim test edilebilir).
 */
import { parseAmountDetailed } from '../experiences/amount.mjs';

/** Adımlar (sıra sabit). Göstergede yalnız ilk üçü sayılır. */
export const STEPS = ['amount', 'details', 'pay', 'thanks'];

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
 * Gezinme sonrası adım dizini (0–3 aralığı).
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
 * Ekran okuyucu adım duyurusu ("Adım 2/3: Bilgileriniz"); teşekkür adımı sayaçsızdır.
 *
 * @param {string} format Biçim (`Step %1$d of %2$d: %3$s`).
 * @param {number} index  Adım dizini.
 * @param {string} name   Adım adı.
 * @return {string} Duyuru.
 */
export function announcement(format, index, name) {
  return index >= STEPS.length - 1 ? name : fill(format, [index + 1, STEPS.length - 1, name]);
}

/**
 * Ödeme adresine gömülü görünüm bayrağı ekler (aynı kökende değilse dokunmaz).
 *
 * @param {string} url    order-pay adresi.
 * @param {string} origin Sayfanın kökeni.
 * @return {string} Çerçeve adresi ('' = çerçevede açılmaz).
 */
export function embedUrl(url, origin) {
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) {
      return '';
    }
    parsed.searchParams.set('donation_panel_embed', '1');
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Çerçevedeki belgenin durumu: teşekkür sayfası (ödeme bitti), ödeme sayfası ya da okunamıyor (başka köken/engelli).
 *
 * @param {{bodyClasses: string[]|null, hasReceived: boolean}} probe Çerçeve gözlemi (null: okunamadı).
 * @return {'paid'|'page'|'unknown'} Durum.
 */
export function frameState(probe) {
  if (!probe || !probe.bodyClasses) {
    return 'unknown';
  }
  return probe.bodyClasses.includes('woocommerce-order-received') || probe.hasReceived ? 'paid' : 'page';
}

/**
 * Kaydırıcı uyumu: kart içinde sonuçlanan olay dışarı yayılmamalı mı. Katman (ödeme penceresi) açıkken de kart içi sayılır.
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
