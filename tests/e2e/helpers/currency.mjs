/**
 * WooCommerce sayı/para biçimi — siteye özel değerler profilden.
 */

import { parseAmountDetailed } from '../../../assets/src/experiences/amount.mjs';

/**
 * @param {number|string} amount
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string,symbol?:string,symbolPosition?:string}} currency
 */
/**
 * Üretim ayrıştırıcısı (assets/src/experiences/amount.mjs) ile aynı işlev; ortak vektörler:
 * tests/fixtures/amount-parse-vectors.json.
 */
export const parseMoneyDetailed = parseAmountDetailed;

/**
 * @param {string|number} raw
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} currency
 * @returns {number} Belirsiz/uyumsuz: NaN.
 */
export function parseMoney(raw, currency) {
  const r = parseAmountDetailed(raw, currency);
  return r.status === 'ok' && Number.isFinite(r.amount) ? r.amount : NaN;
}

/**
 * Doldurma para birimi: sayfa (Woo) ondalığı profili ezer.
 * @param {object} [profileCurrency]
 * @param {object} [pageCurrency]
 */
export function mergeFillCurrency(profileCurrency, pageCurrency) {
  const out = { ...(profileCurrency && typeof profileCurrency === 'object' ? profileCurrency : {}) };
  const p = pageCurrency && typeof pageCurrency === 'object' ? pageCurrency : {};
  if (Number.isFinite(Number(p.decimals))) out.decimals = Math.max(0, Number(p.decimals));
  if (p.decimalSeparator != null && String(p.decimalSeparator) !== '') {
    out.decimalSeparator = String(p.decimalSeparator);
  }
  if (p.thousandSeparator != null && String(p.thousandSeparator) !== '') {
    out.thousandSeparator = String(p.thousandSeparator);
  }
  return out;
}

/** PHP Domain\Amount_Presets (min tutar yer tutucusu) / JS formatMinPlaceholder ile aynı. */
export function formatMinPlaceholder(amount, currency) {
  const num = formatMoney(amount, { ...(currency || {}), symbol: '' });
  if (!num) return '';
  return `min: ${num}`;
}

export function formatMoney(amount, currency) {
  const c = currency || {};
  const decimals = Number.isFinite(Number(c.decimals)) ? Number(c.decimals) : 2;
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? '');
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(decimals);
  const [intRaw, frac = ''] = fixed.split('.');
  const thousand = c.thousandSeparator ?? ',';
  const decimal = c.decimalSeparator ?? '.';
  const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
  const num = decimals > 0 ? `${intFmt}${decimal}${frac}` : intFmt;
  const signed = neg ? `-${num}` : num;
  const symbol = String(c.symbol ?? '');
  const pos = String(c.symbolPosition || 'left');
  if (!symbol) return signed;
  if (pos === 'left') return `${symbol}${signed}`;
  if (pos === 'left_space') return `${symbol} ${signed}`;
  if (pos === 'right') return `${signed}${symbol}`;
  return `${signed} ${symbol}`;
}

/**
 * Görünen metinde tutarın profil biçimiyle geçtiğini kabaca doğrula (sembol + rakamlar).
 * @param {string} hay
 * @param {number|string} amount
 * @param {object} currency
 */
export function textHasFormattedAmount(hay, amount, currency) {
  const formatted = formatMoney(amount, currency);
  const t = String(hay || '');
  if (t.includes(formatted)) return true;
  const digits = String(amount).replace(/\D/g, '');
  const compact = t.replace(/[^\d]/g, '');
  return digits.length >= 2 && compact.includes(digits);
}

/**
 * type=number step ondalık sayısı. step=1 / boş / any → 0 (tam sayı).
 * @param {string|number|null|undefined} step
 * @returns {number}
 */
function decimalsFromNumberStep(step) {
  if (step == null || step === '' || String(step).toLowerCase() === 'any') return 0;
  const n = Number(step);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (Number.isInteger(n)) return 0;
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/**
 * Playwright number input: nokta ondalık, binlik yok, step'e uygun.
 * @param {number} n
 * @param {{step?: string|number}} [field]
 */
function formatMachineFillAmount(n, field) {
  const decimals = decimalsFromNumberStep(field && field.step);
  if (decimals <= 0) return String(Math.round(n));
  const fixed = Math.abs(n).toFixed(decimals);
  return `${n < 0 ? '-' : ''}${fixed}`;
}

/**
 * Input doldurma. type=number → makine biçimi (nokta, binlik yok, step).
 * type=text / yok → 0 dp düz tam sayı ("50"); N>0 mağaza ondalık ayırıcısı. Sabit "10" yok.
 * @param {number|string} amount
 * @param {{decimals?:number,decimalSeparator?:string}} [currency]
 * @param {{type?:string,inputType?:string,step?:string|number}} [field]
 */
export function formatFillAmount(amount, currency, field) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const f = field && typeof field === 'object' ? field : {};
  const type = String(f.type || f.inputType || '').toLowerCase();
  if (type === 'number') return formatMachineFillAmount(n, f);
  const c = currency || {};
  const known = Number.isFinite(Number(c.decimals));
  const decimals = known ? Number(c.decimals) : 0;
  if (decimals <= 0) return String(Math.round(n));
  const decimal = c.decimalSeparator != null ? String(c.decimalSeparator) : '.';
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, frac = ''] = fixed.split('.');
  return `${n < 0 ? '-' : ''}${intPart}${decimal}${frac}`;
}

/**
 * Form min / önerilen / max (DOM veya katalog). Sabit 10 yok.
 * 0 dp mağaza → bağışçı gibi düz tam sayı; ondalıklı → mağaza biçimi.
 * Alan type/step bounds veya 3. argümanda (type=number ve type=text).
 * @param {{ min?: string|number, recommended?: string|number, max?: string|number, type?: string, inputType?: string, step?: string|number }} bounds
 * @param {object} [currency]
 * @param {{type?:string,inputType?:string,step?:string|number}} [field]
 * @returns {{ amount: number, fill: string }}
 */
export function pickDonationFillAmount(bounds, currency, field) {
  const b = bounds && typeof bounds === 'object' ? bounds : {};
  const f = field && typeof field === 'object' ? field : {};
  const type = f.type || f.inputType || b.type || b.inputType || '';
  const step = f.step != null && f.step !== '' ? f.step : b.step;
  const min = Number.parseFloat(String(b.min ?? '').replace(',', '.'));
  const rec = Number.parseFloat(String(b.recommended ?? '').replace(',', '.'));
  const max = Number.parseFloat(String(b.max ?? '').replace(',', '.'));
  let n = NaN;
  if (Number.isFinite(min) && min > 0) n = min;
  if (Number.isFinite(rec) && rec > 0) {
    n = Number.isFinite(n) ? Math.max(n, rec) : rec;
  }
  if (Number.isFinite(max) && max > 0 && Number.isFinite(n) && n > max) n = max;
  if (!Number.isFinite(n) || n <= 0) return { amount: NaN, fill: '' };
  return { amount: n, fill: formatFillAmount(n, currency, { type, step }) };
}
