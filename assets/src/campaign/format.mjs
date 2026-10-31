/**
 * Kampanya paketi: saf yardımcılar (DOM yok; birim testle doğrulanır).
 */

/**
 * Yazılan tutarı sayıya çevirir ("1.250,50", "1,250.50", "40" hepsi okunur). Geçersiz: null.
 *
 * @param {string} raw Ham metin.
 * @return {number|null} Tutar.
 */
export function parseAmount(raw) {
  const text = String(raw ?? '').replace(/\s/g, '');
  if (text === '' || !/^[0-9.,]+$/.test(text)) {
    return null;
  }
  const value = Number(normalizeSeparators(text));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Binlik/ondalık ayırıcıları sezgiyle ayırıp ondalığı noktaya çevirir.
 *
 * @param {string} text Boşluksuz, yalnız rakam/nokta/virgül içeren metin.
 * @return {string} Sayıya çevrilebilir metin.
 */
function normalizeSeparators(text) {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousand = decimal === '.' ? ',' : '.';
    return text.split(thousand).join('').replace(decimal, '.');
  }
  if (lastComma > -1) {
    return /,\d{1,2}$/.test(text) && text.indexOf(',') === lastComma ? text.replace(',', '.') : text.split(',').join('');
  }
  if (lastDot > -1 && !(/\.\d{1,2}$/.test(text) && text.indexOf('.') === lastDot)) {
    return text.split('.').join('');
  }
  return text;
}

/**
 * Tutarı simge + yerel sayı biçimiyle yazar (ondalık yalnız gerekiyorsa).
 *
 * @param {number} amount   Tutar.
 * @param {string} symbol   Para simgesi.
 * @param {number} decimals Woo ondalık sayısı.
 * @param {string} locale   Tarayıcı dili.
 * @return {string} Biçimli metin.
 */
export function formatMoney(amount, symbol, decimals, locale) {
  const value = Number.isFinite(amount) ? amount : 0;
  const whole = Number.isInteger(value);
  const max = Math.max(0, Math.min(Number(decimals) || 0, 2));
  let text;
  try {
    text = new Intl.NumberFormat(locale || undefined, {
      minimumFractionDigits: whole ? 0 : max,
      maximumFractionDigits: max,
    }).format(value);
  } catch {
    text = String(value);
  }
  return `${symbol || ''}${text}`;
}

/**
 * Tutara uyan etki ifadesi (en yakın alt kademe; adet = tam bölüm). Karşılığı yoksa boş metin.
 *
 * @param {number} amount Tutar.
 * @param {Array<{unit:number, one:string, other:string}>} tiers Kademeler (artan).
 * @param {string} locale Tarayıcı dili.
 * @return {string} İfade.
 */
export function describeImpact(amount, tiers, locale) {
  let chosen = null;
  for (const tier of tiers || []) {
    if (amount + 0.00001 >= Number(tier.unit)) {
      chosen = tier;
    }
  }
  if (!chosen) {
    return '';
  }
  const count = Math.max(1, Math.floor((amount + 0.00001) / Number(chosen.unit)));
  let num;
  try {
    num = new Intl.NumberFormat(locale || undefined).format(count);
  } catch {
    num = String(count);
  }
  return (count === 1 ? chosen.one : chosen.other).split('{count}').join(num);
}

/**
 * Yüzdeyi 0-100 arasına sıkıştırır.
 *
 * @param {number} value Değer.
 * @return {number} Sıkışmış yüzde.
 */
export function clampPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * REST taban adresinden tam adres üretir (`/wp-json/` ya da `?rest_route=` biçimi).
 *
 * @param {string} base  `link[rel="https://api.w.org/"]` adresi.
 * @param {string} route `donation-panel/v1/...` yolu.
 * @param {Object<string,string|number>} query Sorgu parametreleri.
 * @return {string} Tam adres.
 */
export function buildRestUrl(base, route, query = {}) {
  const params = Object.entries(query)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  const clean = String(route).replace(/^\/+/, '');
  if (base.includes('rest_route=')) {
    const root = base.replace(/\/+$/, '');
    return `${root}/${clean}${params.length ? `&${params.join('&')}` : ''}`;
  }
  return `${base.replace(/\/+$/, '')}/${clean}${params.length ? `?${params.join('&')}` : ''}`;
}
