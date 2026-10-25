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
 * Yuvarlama (PHP `round` gibi: yarım değer sıfırdan uzağa).
 *
 * @param {number} value    Değer.
 * @param {number} decimals Ondalık hane.
 * @return {number} Yuvarlanmış değer.
 */
export function roundTo(value, decimals) {
  const factor = 10 ** Math.max(0, decimals);
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  return (Math.sign(value) * Math.round(scaled)) / factor;
}

/**
 * İşlem ücretli birim tutar (sunucudaki `Cart_Data::with_fee` ile aynı kural).
 *
 * @param {number} amount   Birim tutar.
 * @param {number} percent  Ücret yüzdesi.
 * @param {number} decimals Woo ondalık hane sayısı.
 * @return {number} Ücret dahil tutar.
 */
export function withFee(amount, percent, decimals) {
  if (!(percent > 0) || !(amount > 0)) {
    return amount;
  }
  return roundTo(amount * (1 + percent / 100), decimals);
}

/**
 * Satır dökümü ve toplam. Sabit tutar/hisseli: birim x adet; diğerlerinde yazılan/seçilen tutar.
 * İşlem ücreti birim tutar üzerinden hesaplanır (sunucuyla aynı).
 *
 * @param {{kind: string, amount: number|null, unit: number, qty: number, feePercent: number, fee: boolean, addon: boolean, addonAmount: number|null, decimals: number}} input Girdi.
 * @return {{donation: number, fee: number, addon: number, total: number}} Döküm.
 */
export function computeTotals(input) {
  const derived = input.kind === 'fixed' || input.kind === 'shares';
  const qty = derived ? Math.max(1, input.qty || 1) : 1;
  const unit = derived ? input.unit || 0 : Number.isFinite(input.amount) ? input.amount : 0;
  const donation = roundTo(unit * qty, input.decimals);
  const feeUnit = input.fee ? withFee(unit, input.feePercent, input.decimals) - unit : 0;
  const fee = roundTo(feeUnit * qty, input.decimals);
  const addon = input.addon && Number.isFinite(input.addonAmount) && input.addonAmount > 0 ? input.addonAmount : 0;
  return { donation, fee, addon, total: roundTo(donation + fee + addon, input.decimals) };
}

/**
 * Adedi sınırlar içinde tutar.
 *
 * @param {number} value Değer.
 * @param {number} max   En çok.
 * @return {number} 1..max.
 */
export function clampQty(value, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(Math.max(1, max), Math.max(1, n));
}

/**
 * Adım işareti: "Adım 1/2 · Tutar".
 *
 * @param {string} format Biçim (`Step %1$d of %2$d`).
 * @param {number} index  Geçerli (0 tabanlı).
 * @param {number} count  Adım sayısı.
 * @param {string} label  Adım adı.
 * @return {string} Metin.
 */
export function stepLabel(format, index, count, label) {
  const text = String(format || '%1$d/%2$d')
    .replace('%1$d', String(index + 1))
    .replace('%2$d', String(count));
  return label ? `${text} · ${label}` : text;
}

/**
 * Hata anahtarlarından ilk hatalı adımın sırası (adım alanı eşlemesiyle).
 *
 * @param {string[]} names      Hatalı alan adları.
 * @param {Record<string, number>} stepOf Alan adı -> adım sırası.
 * @return {number} En küçük adım sırası; hiçbiri tanınmazsa -1.
 */
export function firstErrorStep(names, stepOf) {
  const indexes = names.map((name) => (name in stepOf ? stepOf[name] : -1)).filter((i) => i >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
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
    step: 0,
    qty: 1,
    fee: false,
    addon: false,
    addonAmount: '',
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
    case 'goStep':
      return { ...state, step: Math.max(0, action.value), status: state.status === 'submitting' ? state.status : 'idle' };
    case 'setQty':
      return { ...state, qty: action.value, errors: omit(omit(state.errors, 'quantity'), 'share_count') };
    case 'setFee':
      return { ...state, fee: Boolean(action.value) };
    case 'setAddon':
      return { ...state, addon: Boolean(action.value), errors: Boolean(action.value) ? state.errors : omit(state.errors, 'addon_amount') };
    case 'setAddonAmount':
      return { ...state, addonAmount: String(action.value), errors: omit(state.errors, 'addon_amount') };
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
