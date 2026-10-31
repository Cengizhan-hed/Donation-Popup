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
  if (raw == null || raw === '') return fail('invalid');
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? { ok: true, amount: raw, status: 'ok' } : fail('invalid');
  }
  const cfg = normalizeCurrency(currency);
  let s = String(raw).trim().replace(/[\s\u00A0\u202F\u2009\u2007\u2060]+/g, '');
  s = s.replace(/[^\d.,-]/g, '');
  if (!s || s.includes('-') || [',', '.', cfg.thousand, cfg.decimal].includes(s)) return fail('invalid');
  const seps = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s.charAt(i) === '.' || s.charAt(i) === ',') seps.push({ i, ch: s.charAt(i) });
  }
  if (!seps.length) return /^\d+$/.test(s) ? ok(Number.parseFloat(s)) : fail('invalid');
  const last = seps[seps.length - 1];
  const parts = { s, seps, last, beforeLast: s.slice(0, last.i), afterLast: s.slice(last.i + 1) };
  const chars = [...new Set(seps.map((row) => row.ch))];
  return chars.length === 1 ? parseSingleSeparator(parts, chars[0], cfg) : parseMixedSeparators(parts, chars, cfg);
}

/**
 * @param {string} status Durum.
 * @return {{ok:boolean,amount:number,status:string}} Başarısız sonuç.
 */
function fail(status) {
  return { ok: false, amount: NaN, status };
}

/**
 * @param {number} n Sayı.
 * @return {{ok:boolean,amount:number,status:string}} Sonuç.
 */
function ok(n) {
  return Number.isFinite(n) ? { ok: true, amount: n, status: 'ok' } : fail('invalid');
}

/**
 * @param {object} [currency] Woo ayarları.
 * @return {{decimals:number,thousand:string,decimal:string}} Normalize edilmiş ayarlar.
 */
function normalizeCurrency(currency) {
  const c = currency || {};
  return {
    decimals: Number.isFinite(Number(c.decimals)) ? Math.max(0, Number(c.decimals)) : 2,
    thousand: c.thousandSeparator != null ? String(c.thousandSeparator) : ',',
    decimal: c.decimalSeparator != null ? String(c.decimalSeparator) : '.',
  };
}

/**
 * @param {string} intPart  Tam bölüm.
 * @param {string} frac     Ondalık bölüm.
 * @param {number} decimals Woo ondalık sayısı.
 * @return {{ok:boolean,amount:number,status:string}} Sonuç.
 */
function applyDec(intPart, frac, decimals) {
  if (!intPart || !frac || !/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) return fail('invalid');
  if (decimals <= 0) {
    if (/^0+$/.test(frac)) return ok(Number.parseFloat(intPart));
    return fail('ambiguous');
  }
  if (frac.length > decimals) return fail('ambiguous');
  return ok(Number.parseFloat(`${intPart}.${frac}`));
}

/**
 * Tek tür ayırıcı (yalnız nokta ya da yalnız virgül) içeren girdi.
 *
 * @param {{s:string,seps:Array,beforeLast:string,afterLast:string}} parts Parçalar.
 * @param {string} ch  Ayırıcı.
 * @param {{decimals:number,thousand:string,decimal:string}} cfg Ayarlar.
 * @return {{ok:boolean,amount:number,status:string}} Sonuç.
 */
function parseSingleSeparator(parts, ch, cfg) {
  const { s, seps, beforeLast, afterLast } = parts;
  if (isValidThousandGrouping(s, ch)) {
    // 3 ondalıklı para birimleri (KWD/BHD): tek ayırıcı + 3 basamak mağaza ayarına göre yorumlanır.
    if (cfg.decimals >= 3 && seps.length === 1) {
      if (ch === cfg.decimal && ch !== cfg.thousand) return applyDec(beforeLast, afterLast, cfg.decimals);
      if (ch !== cfg.thousand) return fail('ambiguous');
    }
    return ok(Number.parseFloat(s.split(ch).join('')));
  }
  if (seps.length === 1) return applyDec(beforeLast, afterLast, cfg.decimals);
  if (isValidThousandGrouping(beforeLast, ch)) return applyDec(beforeLast.split(ch).join(''), afterLast, cfg.decimals);
  return fail('ambiguous');
}

/**
 * İki tür ayırıcı içeren girdi (sonuncusu ondalık, diğeri binlik).
 *
 * @param {{seps:Array,last:{ch:string},beforeLast:string,afterLast:string}} parts Parçalar.
 * @param {string[]} chars Ayırıcı türleri.
 * @param {{decimals:number}} cfg Ayarlar.
 * @return {{ok:boolean,amount:number,status:string}} Sonuç.
 */
function parseMixedSeparators(parts, chars, cfg) {
  const { seps, last, beforeLast, afterLast } = parts;
  if (seps.filter((row) => row.ch === last.ch).length !== 1) return fail('invalid');
  const other = chars[0] === last.ch ? chars[1] : chars[0];
  if (beforeLast.includes(other)) {
    if (!isValidThousandGrouping(beforeLast, other)) return fail('ambiguous');
    return applyDec(beforeLast.split(other).join(''), afterLast, cfg.decimals);
  }
  return applyDec(beforeLast, afterLast, cfg.decimals);
}
