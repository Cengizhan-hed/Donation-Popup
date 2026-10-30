/**
 * Canlı kampanya çubuğu: saf yardımcılar (DOM yok; birim testle doğrulanır).
 */

/**
 * Tutarı WooCommerce biçim ayarlarıyla yazar (ayırıcılar, simge konumu); tam sayıda ondalık yazılmaz.
 *
 * @param {number} amount Tutar.
 * @param {{s?:string,d?:number,ds?:string,ts?:string,pos?:string}} cur Para birimi: simge, ondalık, ayırıcılar, konum.
 * @return {string} Biçimli metin (ör. "£1,250", "1.250,50 ₺").
 */
export function formatWooMoney(amount, cur = {}) {
  const value = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const decimals = Math.max(0, Math.min(Number(cur.d ?? 2) || 0, 4));
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const digits = Number.isInteger(rounded) ? 0 : decimals;
  const [int, frac] = rounded.toFixed(digits).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, cur.ts ?? ',');
  const num = frac ? `${grouped}${cur.ds ?? '.'}${frac}` : grouped;
  const symbol = cur.s || '';
  const nbsp = String.fromCharCode(160);
  switch (cur.pos) {
    case 'right':
      return `${num}${symbol}`;
    case 'right_space':
      return `${num}${nbsp}${symbol}`;
    case 'left_space':
      return `${symbol}${nbsp}${num}`;
    default:
      return `${symbol}${num}`;
  }
}

/**
 * Yüzde metni (aşağı yuvarlanır: hedefe ulaşılmadan 100 yazmaz): tam sayıysa ondalıksız, değilse en çok `digits`
 * ondalık (Woo ondalık ayırıcısıyla); kalıp çevrilmiş "%d%%".
 *
 * @param {number} percent Yüzde.
 * @param {string} pattern `{n}` yer tutuculu kalıp (ör. "{n}%", "%{n}").
 * @param {string} ds      Ondalık ayırıcı.
 * @param {number} digits  En çok ondalık (0 ya da 1).
 * @return {string} Metin.
 */
export function formatPercent(percent, pattern = '{n}%', ds = '.', digits = 1) {
  const value = clamp(percent);
  const scale = digits > 0 ? 10 : 1;
  const shown = Math.floor(value * scale + 1e-9) / scale;
  const text = Number.isInteger(shown) ? String(shown) : shown.toFixed(1).replace('.', ds || '.');
  return String(pattern || '{n}%').split('{n}').join(text);
}

/**
 * 0–100 arasına sıkıştırır.
 *
 * @param {number} value Değer.
 * @return {number} Yüzde.
 */
export function clamp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * Hedefe göre yüzde.
 *
 * @param {number} amount Tutar.
 * @param {number} goal   Hedef.
 * @return {number} Yüzde (0–100).
 */
export function percentOf(amount, goal) {
  return goal > 0 ? clamp((amount / goal) * 100) : 0;
}

/**
 * Store API sepet yanıtından ürün başına sepetteki tutar (satır toplamı + satır vergisi; mağaza küçük birimden çevrilir).
 *
 * @param {object|null} cart `wc/store/v1/cart` yanıtı.
 * @return {Map<number, number>} Ürün kimliği → tutar.
 */
export function cartAmounts(cart) {
  const out = new Map();
  const items = cart && Array.isArray(cart.items) ? cart.items : [];
  items.forEach((item) => {
    const id = Number(item && item.id);
    const totals = (item && item.totals) || {};
    const minor = Number(totals.currency_minor_unit ?? 2) || 0;
    const raw = Number(totals.line_total || 0) + Number(totals.line_total_tax || 0);
    if (id > 0 && Number.isFinite(raw) && raw > 0) {
      out.set(id, (out.get(id) || 0) + raw / 10 ** minor);
    }
  });
  return out;
}

/**
 * Çubuğun gösterilecek durumu.
 *
 * @param {{raised:number, goal:number, cart?:number, pending?:number}} input Gerçek toplam, hedef, sepetteki ve seçilen tutar.
 * @return {{real:number, projected:number, personal:number, total:number, inCartOnly:boolean, completes:boolean}} Durum.
 */
export function projection({ raised, goal, cart = 0, pending = 0 }) {
  const safe = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0);
  const base = safe(raised);
  const personal = safe(cart) + safe(pending);
  const total = base + personal;
  return {
    real: percentOf(base, goal),
    projected: percentOf(total, goal),
    personal,
    total,
    inCartOnly: safe(cart) > 0 && safe(pending) === 0,
    completes: goal > 0 && base < goal && total >= goal,
  };
}

/**
 * Kişisel önizleme satırı (boş: önizleme yok).
 *
 * @param {ReturnType<typeof projection>} view Durum.
 * @param {{with?:string, cart?:string, goal?:string}} texts `%1$s` (kişisel tutar), `%2$s` (yeni toplam) kalıpları.
 * @param {(n:number)=>string} money Biçimleyici.
 * @return {string} Metin.
 */
export function noteText(view, texts, money) {
  if (!(view.personal > 0)) {
    return '';
  }
  let pattern = texts.with || '';
  if (view.completes && texts.goal) {
    pattern = texts.goal;
  } else if (view.inCartOnly && texts.cart) {
    pattern = texts.cart;
  }
  return pattern.split('%1$s').join(money(view.personal)).split('%2$s').join(money(view.total));
}

/**
 * Bağışçı sayısı metni (tekil/çoğul kalıbı `%s`); 0 ise boş.
 *
 * @param {number} count Sayı.
 * @param {string} one   Tekil kalıp.
 * @param {string} many  Çoğul kalıp.
 * @param {string} ts    Binlik ayırıcı.
 * @return {string} Metin.
 */
export function donorsText(count, one, many, ts = ',') {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) {
    return '';
  }
  const num = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ts);
  return (n === 1 ? one : many).split('%s').join(num);
}

/**
 * Yumuşak geçiş eğrisi (ease-out cubic).
 *
 * @param {number} t 0–1.
 * @return {number} 0–1.
 */
export function easeOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}
