/**
 * Form deneyimi durum makinesi (saf işlevler; DOM yok, birim test edilebilir).
 */

/** Katman sunumları: mobilde popup ve yan panel alttan panele döner. */
export const NARROW_QUERY = '(max-width: 639.98px)';

/**
 * Tutar metnini sayıya çevirir (sunucudaki Field_Validator::parse_amount ile aynı kural).
 *
 * @param {unknown} raw Ham metin.
 * @return {number|null} Geçersizse null.
 */
export function parseAmount(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) {
    return null;
  }
  const last = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','));
  let number;
  if (last > 0 && /^\d{1,2}$/.test(text.slice(last + 1))) {
    number = `${text.slice(0, last).replace(/\D/g, '')}.${text.slice(last + 1)}`;
  } else {
    number = text.replace(/\D/g, '');
  }
  const value = Number(number);
  return Number.isFinite(value) ? value : null;
}

/**
 * Kabın gerçekte nasıl sunulduğu.
 *
 * @param {string}  kind   popup | side_panel | bottom_sheet | inline
 * @param {boolean} narrow Ekran <= 639 px mi.
 * @return {string} modal | panel | sheet | inline
 */
export function presentedAs(kind, narrow) {
  if (kind === 'inline') {
    return 'inline';
  }
  if (kind === 'bottom_sheet' || narrow) {
    return 'sheet';
  }
  return kind === 'side_panel' ? 'panel' : 'modal';
}

/**
 * @param {{presets?: number[], recommended?: number|null}} [seed] Başlangıç verisi.
 * @return {object} İlk durum.
 */
export function initialState(seed = {}) {
  const presets = Array.isArray(seed.presets) ? seed.presets : [];
  const recommended = typeof seed.recommended === 'number' ? seed.recommended : null;
  const first = recommended ?? (presets.length ? presets[0] : null);
  return {
    open: false,
    amount: recommended,
    preset: recommended,
    custom: '',
    focusPreset: first,
    errors: {},
    status: 'idle',
  };
}

/**
 * @param {object} state  Önceki durum.
 * @param {object} action { type, ... }
 * @return {object} Yeni durum (aynı nesne değil).
 */
export function reducer(state, action) {
  switch (action.type) {
    case 'open':
      return { ...state, open: true };
    case 'close':
      return { ...state, open: false, status: state.status === 'submitting' ? state.status : 'idle' };
    case 'selectPreset':
      return {
        ...state,
        amount: action.value,
        preset: action.value,
        focusPreset: action.value,
        custom: '',
        errors: omit(state.errors, 'amount'),
      };
    case 'setCustom': {
      const parsed = parseAmount(action.value);
      return {
        ...state,
        custom: String(action.value),
        preset: null,
        amount: parsed,
        errors: omit(state.errors, 'amount'),
      };
    }
    case 'setErrors':
      return { ...state, errors: { ...action.errors }, status: 'invalid' };
    case 'clearError':
      return { ...state, errors: omit(state.errors, action.name) };
    case 'submitStart':
      return { ...state, status: 'submitting', errors: {} };
    case 'submitFail':
      return { ...state, status: 'failed' };
    case 'submitDone':
      return { ...state, status: 'done' };
    default:
      return state;
  }
}

/**
 * @param {object} state Durum.
 * @param {string} key   Silinecek anahtar.
 * @return {object} Anahtarsız kopya.
 */
function omit(state, key) {
  const copy = { ...state };
  delete copy[key];
  return copy;
}

/**
 * Toplam metni: tutar sayısı için sade biçim (ondalık yalnız gerekiyorsa).
 *
 * @param {number|null} amount   Tutar.
 * @param {string}      symbol   Para birimi simgesi.
 * @param {number}      decimals Woo ondalık hane sayısı.
 * @param {string}      locale   Tarayıcı dili.
 * @return {string} Biçimli toplam.
 */
export function formatTotal(amount, symbol, decimals, locale) {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const whole = Number.isInteger(value);
  let text;
  try {
    text = new Intl.NumberFormat(locale || undefined, {
      minimumFractionDigits: whole ? 0 : Math.min(decimals, 2),
      maximumFractionDigits: Math.max(0, Math.min(decimals, 2)),
    }).format(value);
  } catch {
    text = String(value);
  }
  return `${symbol}${text}`;
}

/**
 * Ok tuşuyla tutar çipi geçişi için sonraki dizin (RTL'de yön tersine).
 *
 * @param {number}  index  Mevcut dizin.
 * @param {number}  count  Çip sayısı.
 * @param {string}  key    ArrowRight | ArrowLeft | ArrowDown | ArrowUp | Home | End
 * @param {boolean} rtl    Sağdan sola mı.
 * @return {number} Yeni dizin (değişmediyse aynı).
 */
export function nextPresetIndex(index, count, key, rtl) {
  if (count < 1) {
    return index;
  }
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward || key === 'ArrowDown') {
    return (index + 1) % count;
  }
  if (key === backward || key === 'ArrowUp') {
    return (index - 1 + count) % count;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return count - 1;
  }
  return index;
}

/**
 * Sürükleyerek kapatma kararı.
 *
 * @param {number} distance Dikey sürükleme (px, aşağı pozitif).
 * @return {boolean} Kapatılmalı mı.
 */
export function shouldDismissOnDrag(distance) {
  return distance > 110;
}
