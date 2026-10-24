/**
 * WooCommerce sayı/para biçimi — siteye özel değerler profilden.
 */

/**
 * @param {number|string} amount
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string,symbol?:string,symbolPosition?:string}} currency
 */
/**
 * Plugin parseMoney ile aynı kural (tests/fixtures/amount-parse-vectors.json).
 * Belirsiz/uyumsuz → NaN.
 *
 * @param {string|number} raw
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} currency
 */
export function parseMoney(raw, currency) {
  const r = parseMoneyDetailed(raw, currency);
  return r.status === 'ok' && Number.isFinite(r.amount) ? r.amount : NaN;
}

function isValidThousandGrouping(intPart, sep) {
  if (!sep || String(intPart).indexOf(sep) === -1) return false;
  const parts = String(intPart).split(sep);
  if (parts.length < 2 || !/^\d{1,3}$/.test(parts[0])) return false;
  return parts.slice(1).every((p) => /^\d{3}$/.test(p));
}

/**
 * @param {string|number} raw
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} [currency]
 * @returns {{ok:boolean,amount:number,status:string}}
 */
export function parseMoneyDetailed(raw, currency) {
  if (raw === null || raw === undefined || raw === '') return { ok: false, amount: NaN, status: 'invalid' };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, amount: NaN, status: 'invalid' };
    return { ok: true, amount: raw, status: 'ok' };
  }
  const c = currency || {};
  const decimals = Number.isFinite(Number(c.decimals)) ? Math.max(0, Number(c.decimals)) : 2;
  const thousand = c.thousandSeparator != null ? String(c.thousandSeparator) : ',';
  const decimal = c.decimalSeparator != null ? String(c.decimalSeparator) : '.';
  let s = String(raw).trim().replace(/[\s\u00A0\u202F\u2009\u2007\u2060]+/g, '');
  s = s.replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',' || s === thousand || s === decimal) {
    return { ok: false, amount: NaN, status: 'invalid' };
  }
  if (s.charAt(0) === '-' || s.includes('-')) return { ok: false, amount: NaN, status: 'invalid' };
  if (/^\d+$/.test(s)) {
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? { ok: true, amount: n, status: 'ok' } : { ok: false, amount: NaN, status: 'invalid' };
  }
  const fail = (status) => ({ ok: false, amount: NaN, status });
  const ok = (n) => (Number.isFinite(n) ? { ok: true, amount: n, status: 'ok' } : fail('invalid'));
  if (thousand !== '' && thousand === decimal) {
    if (isValidThousandGrouping(s, thousand)) return ok(Number.parseFloat(s.split(thousand).join('')));
    const first = s.indexOf(thousand);
    const last = s.lastIndexOf(thousand);
    if (first < 0 || first !== last || first <= 0) return fail(decimals <= 0 ? 'ambiguous' : 'invalid');
    const intPart = s.slice(0, last);
    const frac = s.slice(last + thousand.length);
    if (!intPart || !frac || !/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) return fail('invalid');
    if (decimals <= 0) return fail('ambiguous');
    if (frac.length > decimals) return fail('invalid');
    return ok(Number.parseFloat(`${intPart}.${frac}`));
  }
  const hasT = thousand !== '' && s.includes(thousand);
  const hasD = decimal !== '' && s.includes(decimal);
  if (hasT && hasD) {
    const dFirst = s.indexOf(decimal);
    const dLast = s.lastIndexOf(decimal);
    if (dFirst !== dLast || s.indexOf(thousand) > dLast) return fail('invalid');
    const intPart = s.slice(0, dLast);
    const frac = s.slice(dLast + decimal.length);
    if (!intPart || !frac || !/^\d+$/.test(frac)) return fail('invalid');
    if (decimals <= 0) return fail('ambiguous');
    if (frac.length > decimals) return fail('invalid');
    if (intPart.includes(thousand) && !isValidThousandGrouping(intPart, thousand)) return fail('ambiguous');
    if (intPart.includes(decimal)) return fail('invalid');
    const intNorm = intPart.split(thousand).join('');
    if (!/^\d+$/.test(intNorm)) return fail('invalid');
    return ok(Number.parseFloat(`${intNorm}.${frac}`));
  }
  if (hasD && !hasT) {
    const dFirst = s.indexOf(decimal);
    const dLast = s.lastIndexOf(decimal);
    if (dFirst !== dLast) return fail('invalid');
    const intPart = s.slice(0, dLast);
    const frac = s.slice(dLast + decimal.length);
    if (!intPart || !frac || !/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) return fail('invalid');
    if (decimals <= 0) return fail('ambiguous');
    if (frac.length > decimals) return fail('invalid');
    return ok(Number.parseFloat(`${intPart}.${frac}`));
  }
  if (hasT && !hasD) {
    if (isValidThousandGrouping(s, thousand)) return ok(Number.parseFloat(s.split(thousand).join('')));
    return fail('ambiguous');
  }
  return fail('invalid');
}

/** PHP WDP_Utils::format_min_placeholder / JS formatMinPlaceholder ile aynı. */
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
 * type=text / yok → binlik yok, ondalık mağaza ayırıcısı. Sabit "10" yok.
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
