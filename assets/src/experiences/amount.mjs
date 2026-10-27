/**
 * Bağışçının yazdığı tutarı Woo ondalık sayısı ve ayırıcı ayarlarına göre ayrıştırır.
 *
 * PHP `Support\Price::parse_donor_amount` ile BİREBİR aynı kural; ortak vektörler:
 * tests/fixtures/amount-parse-vectors.json (iki tarafta aynı beklenen sonuç).
 * Saf işlev: DOM yok.
 */

/**
 * @param {string} intPart Ayırıcılı tam sayı bölümü.
 * @param {string} sep     Binlik ayırıcı adayı.
 * @return {boolean} Geçerli binlik gruplama mı.
 */
function isValidThousandGrouping(intPart, sep) {
  if (!sep || String(intPart).indexOf(sep) === -1) return false;
  const parts = String(intPart).split(sep);
  if (parts.length < 2 || !/^\d{1,3}$/.test(parts[0])) return false;
  return parts.slice(1).every((p) => /^\d{3}$/.test(p));
}

/**
 * @param {string|number} raw      Ham girdi.
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} [currency] Woo ayarları.
 * @return {{ok:boolean,amount:number,status:string}} status: ok | ambiguous | invalid.
 */
export function parseAmountDetailed(raw, currency) {
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
  const fail = (status) => ({ ok: false, amount: NaN, status });
  const ok = (n) => (Number.isFinite(n) ? { ok: true, amount: n, status: 'ok' } : fail('invalid'));
  const applyDec = (intPart, frac) => {
    if (!intPart || !frac || !/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) return fail('invalid');
    if (decimals <= 0) {
      if (/^0+$/.test(frac)) return ok(Number.parseFloat(intPart));
      return fail('ambiguous');
    }
    if (frac.length > decimals) return fail('ambiguous');
    return ok(Number.parseFloat(`${intPart}.${frac}`));
  };
  const seps = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s.charAt(i) === '.' || s.charAt(i) === ',') seps.push({ i, ch: s.charAt(i) });
  }
  if (!seps.length) {
    if (/^\d+$/.test(s)) return ok(Number.parseFloat(s));
    return fail('invalid');
  }
  const last = seps[seps.length - 1];
  const beforeLast = s.slice(0, last.i);
  const afterLast = s.slice(last.i + 1);
  const chars = [...new Set(seps.map((row) => row.ch))];
  if (chars.length === 1) {
    const ch = chars[0];
    if (isValidThousandGrouping(s, ch)) {
      // 3 ondalıklı para birimleri (KWD/BHD): tek ayırıcı + 3 basamak mağaza ayarına göre yorumlanır.
      if (decimals >= 3 && seps.length === 1) {
        if (ch === decimal && ch !== thousand) return applyDec(beforeLast, afterLast);
        if (ch !== thousand) return fail('ambiguous');
      }
      return ok(Number.parseFloat(s.split(ch).join('')));
    }
    if (seps.length === 1) return applyDec(beforeLast, afterLast);
    if (isValidThousandGrouping(beforeLast, ch)) return applyDec(beforeLast.split(ch).join(''), afterLast);
    return fail('ambiguous');
  }
  if (seps.filter((row) => row.ch === last.ch).length !== 1) return fail('invalid');
  const other = chars[0] === last.ch ? chars[1] : chars[0];
  if (beforeLast.includes(other)) {
    if (!isValidThousandGrouping(beforeLast, other)) return fail('ambiguous');
    return applyDec(beforeLast.split(other).join(''), afterLast);
  }
  return applyDec(beforeLast, afterLast);
}
