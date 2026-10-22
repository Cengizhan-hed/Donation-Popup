/**
 * WooCommerce sayı/para biçimi — siteye özel değerler profilden.
 */

/**
 * @param {number|string} amount
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string,symbol?:string,symbolPosition?:string}} currency
 */
/**
 * Woo ayırıcılarına göre ham sayı.
 * 0 ondalık: her ayırıcı binlik. Ondalıklı: bilinen ondalık/binlik karakterleri.
 *
 * @param {string|number} raw
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} currency
 */
export function parseMoney(raw, currency) {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  let s = String(raw).trim().replace(/\s+/g, '').replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return NaN;
  const c = currency || {};
  const decimals = Number.isFinite(Number(c.decimals)) ? Number(c.decimals) : 2;
  const thousand = c.thousandSeparator != null ? String(c.thousandSeparator) : ',';
  const decimal = c.decimalSeparator != null ? String(c.decimalSeparator) : '.';
  if (decimals <= 0) {
    const n = Number.parseFloat(s.replace(/[.,]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  const hasT = thousand !== '' && s.includes(thousand);
  const hasD = decimal !== '' && decimal !== thousand && s.includes(decimal);
  if (hasT && hasD) s = s.split(thousand).join('').split(decimal).join('.');
  else if (hasD) s = s.split(decimal).join('.');
  else if (hasT) s = s.split(thousand).join('');
  else s = s.replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
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
