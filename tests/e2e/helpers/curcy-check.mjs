/**
 * Çoklu para birimi (profil currencySwitch) tutar ölçümü — yalnız ölçer, sipariş yok.
 * Saf mantık (sınıflandırma, biçimleme) burada; tarayıcı akışı run-curcy-check.mjs'te.
 * Eklentiye/Curcy'ye özel kod yok: yalnız profil `currencySwitch.param` ve WooCommerce Store API.
 */
import { parseMoney } from './currency.mjs';

export const CURCY_TYPED_AMOUNT = 100;

/** Sepet öğesi meta adı bu desene uyuyorsa değeri de rapora girer (kişisel veri olmayan tutar/para alanları). */
const SAFE_META_NAME = /amount|tutar|currency|para|price|fiyat|base|taban|kur\b|rate|total|toplam/i;
/** Kişisel veri olabilecek adlar: değer asla yazılmaz. */
const PERSONAL_META_NAME = /name|isim|ad[ıi]|phone|tel|mail|dedic|ithaf|kim\b|note|not\b|adres|address/i;

/**
 * @param {string[]} argv
 * @returns {{ envId: string, codes: string[]|null, amount: number }}
 */
export function parseCurcyCheckArgs(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envId = 'local';
  let codes = null;
  let amount = CURCY_TYPED_AMOUNT;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    if (x === '--env' || x === '--profile') envId = String(a[++i] || envId);
    else if (x.startsWith('--env=')) envId = x.slice('--env='.length);
    else if (x === '--codes') codes = splitCodes(a[++i]);
    else if (x.startsWith('--codes=')) codes = splitCodes(x.slice('--codes='.length));
    else if (x === '--amount') amount = Number(a[++i]);
    else if (x.startsWith('--amount=')) amount = Number(x.slice('--amount='.length));
  }
  if (!Number.isFinite(amount) || amount <= 0) amount = CURCY_TYPED_AMOUNT;
  return { envId, codes, amount };
}

function splitCodes(raw) {
  return String(raw || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Ölçülecek kodlar: önce ana birim, sonra profil geçiş kodları (tekrarsız).
 * @param {object} profile
 * @param {string[]|null} [override]
 * @returns {string[]}
 */
export function codesToCheck(profile, override = null) {
  if (override && override.length) return [...new Set(override)];
  const base = String(profile?.currency?.code || '').toUpperCase();
  const sw = Array.isArray(profile?.currencySwitch?.codes) ? profile.currencySwitch.codes : [];
  return [...new Set([base, ...sw.map((c) => String(c || '').toUpperCase())].filter(Boolean))];
}

/**
 * Store API tutar alanı (küçük birim, metin) → ondalıklı sayı.
 * @param {string|number|null|undefined} minor
 * @param {number} minorUnit
 */
export function minorToAmount(minor, minorUnit) {
  if (minor === null || minor === undefined || minor === '') return NaN;
  const n = Number(minor);
  const u = Number(minorUnit);
  if (!Number.isFinite(n) || !Number.isFinite(u) || u < 0) return NaN;
  return n / Math.pow(10, u);
}

/**
 * Ham Store API sepetinden ölçüm özeti (kişisel veri yok).
 * @param {object|null} data
 */
export function summarizeStoreCart(data) {
  if (!data || typeof data !== 'object') return null;
  const totals = data.totals || {};
  const cartUnit = totals.currency_minor_unit;
  const item = Array.isArray(data.items) && data.items.length ? data.items[0] : null;
  const itemTotals = item?.totals || {};
  const unit = itemTotals.currency_minor_unit != null ? itemTotals.currency_minor_unit : cartUnit;
  return {
    itemsCount: Array.isArray(data.items) ? data.items.length : 0,
    currencyCode: String(totals.currency_code || ''),
    currencySymbol: String(totals.currency_symbol || ''),
    minorUnit: Number.isFinite(Number(cartUnit)) ? Number(cartUnit) : null,
    decimalSeparator: totals.currency_decimal_separator != null ? String(totals.currency_decimal_separator) : '',
    thousandSeparator: totals.currency_thousand_separator != null ? String(totals.currency_thousand_separator) : '',
    itemName: item ? String(item.name || '') : '',
    quantity: item ? Number(item.quantity) || 0 : 0,
    linePriceStore: minorToAmount(item?.prices?.price, item?.prices?.currency_minor_unit ?? unit),
    lineSubtotal: minorToAmount(itemTotals.line_subtotal, unit),
    lineTotal: minorToAmount(itemTotals.line_total, unit),
    cartSubtotal: minorToAmount(totals.total_items, cartUnit),
    cartTotal: minorToAmount(totals.total_price, cartUnit),
    itemMeta: item ? safeItemMeta(item) : [],
  };
}

/**
 * Eklentinin sepet öğesi meta alanları: adlar hep; değer yalnız tutar/para benzeri adlarda.
 * @param {object} item
 * @returns {{ name: string, value: string|null }[]}
 */
export function safeItemMeta(item) {
  const rows = [];
  const list = Array.isArray(item?.item_data) ? item.item_data : [];
  for (const row of list) {
    const name = String(row?.name || row?.key || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const show = SAFE_META_NAME.test(name) && !PERSONAL_META_NAME.test(name);
    rows.push({ name: name.slice(0, 60), value: show ? stripTags(row?.value ?? row?.display).slice(0, 80) : null });
  }
  return rows;
}

function stripTags(v) {
  return String(v ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sayfa metinlerinden (sepet/ödeme DOM) tutarlar; ayırıcılar Store API'den.
 * @param {string[]} texts
 * @param {{ decimalSeparator?: string, thousandSeparator?: string, minorUnit?: number|null }} sep
 * @returns {number[]}
 */
export function parseDomAmounts(texts, sep = {}) {
  const currency = {
    decimals: Number.isFinite(Number(sep.minorUnit)) ? Number(sep.minorUnit) : 2,
    decimalSeparator: sep.decimalSeparator || '.',
    thousandSeparator: sep.thousandSeparator != null ? sep.thousandSeparator : ',',
  };
  return (texts || []).map((t) => parseMoney(String(t || ''), currency)).filter((n) => Number.isFinite(n));
}

function near(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.009;
}

/**
 * Sınıflandırma (tahmin yok):
 *  - doğru: sepet para birimi kodu = seçilen kod, satır tutarı = yazılan, ve ölçülebilen her DOM değeri (sepet/ödeme) yazılanı içeriyor.
 *  - yanlış: sepet kodu farklı, satır tutarı farklı ya da DOM'da yazılandan farklı tek bir tutar var.
 *  - belirsiz: sepet boş/okunamadı/kod yok ya da sayfa DOM'undan hiç tutar okunamadı (yalnız Store API var).
 *
 * @param {{ code: string, typed: number, cart: ReturnType<typeof summarizeStoreCart>|null, cartDom?: number[], checkoutDom?: number[], note?: string }} m
 * @returns {{ verdict: 'doğru'|'yanlış'|'belirsiz', reasons: string[] }}
 */
export function classifyMeasurement(m) {
  const reasons = [];
  const cart = m.cart;
  if (!cart || !cart.itemsCount) {
    return { verdict: 'belirsiz', reasons: [m.note || 'sepet boş / okunamadı'] };
  }
  if (!cart.currencyCode) {
    return { verdict: 'belirsiz', reasons: ['Store API para birimi kodu yok'] };
  }
  const line = Number.isFinite(cart.lineSubtotal) ? cart.lineSubtotal : cart.lineTotal;
  if (!Number.isFinite(line)) {
    return { verdict: 'belirsiz', reasons: ['Store API satır tutarı okunamadı'] };
  }
  let wrong = false;
  if (cart.currencyCode.toUpperCase() !== String(m.code).toUpperCase()) {
    wrong = true;
    reasons.push(`sepet para birimi ${cart.currencyCode} ≠ seçilen ${m.code}`);
  }
  if (!near(line, m.typed)) {
    wrong = true;
    reasons.push(`satır ${line} ≠ yazılan ${m.typed}`);
  }
  for (const [label, list] of [
    ['sepet sayfası', m.cartDom],
    ['ödeme sayfası', m.checkoutDom],
  ]) {
    if (!list || !list.length) continue;
    if (!list.some((n) => near(n, m.typed))) {
      wrong = true;
      reasons.push(`${label}nda yazılan ${m.typed} yok (görünen: ${[...new Set(list)].join(' | ')})`);
    }
  }
  if (wrong) return { verdict: 'yanlış', reasons };
  const domSeen = (m.cartDom && m.cartDom.length) || (m.checkoutDom && m.checkoutDom.length);
  if (!domSeen) reasons.push('sayfa DOM tutarı okunamadı; yalnız Store API doğruladı');
  return { verdict: domSeen ? 'doğru' : 'belirsiz', reasons };
}

/**
 * @param {{ env: string, startedAt: string, baseUrl: string, productRole: string, typed: number, rows: object[], skipped?: string }} r
 */
export function formatCurcyMarkdown(r) {
  const lines = [];
  lines.push(`# Curcy tutar ölçümü — ${r.env}`);
  lines.push('');
  lines.push(`Tarih: ${r.startedAt} · Site: ${r.baseUrl} · Ürün rolü: ${r.productRole || '—'} · Yazılan: ${r.typed}`);
  lines.push('Sipariş verilmedi; ödeme formu doldurulmadı/gönderilmedi.');
  lines.push('');
  if (r.skipped) {
    lines.push(`Atlandı: ${r.skipped}`);
    return `${lines.join('\n')}\n`;
  }
  lines.push('| kod | yazılan | sepette satır | toplam | sembol | beklenen mi? |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of r.rows) {
    const c = row.cart;
    lines.push(
      `| ${row.code} | ${row.typed} | ${fmt(c && (Number.isFinite(c.lineSubtotal) ? c.lineSubtotal : c.lineTotal))}${c && c.currencyCode ? ` ${c.currencyCode}` : ''} | ${fmt(c && c.cartTotal)} | ${c && c.currencySymbol ? c.currencySymbol : '—'} | ${row.verdict}${row.reasons.length ? ` (${row.reasons.join('; ')})` : ''} |`
    );
  }
  lines.push('');
  lines.push('Sayfada görünen tutarlar (DOM):');
  for (const row of r.rows) {
    lines.push(
      `- ${row.code}: sepet sayfası [${(row.cartDom || []).join(', ')}] · ödeme sayfası [${(row.checkoutDom || []).join(', ')}]`
    );
  }
  lines.push('');
  lines.push('Sepet öğesi meta alanları (ad: değer; kişisel alanların değeri yazılmaz):');
  for (const row of r.rows) {
    const meta = row.cart?.itemMeta || [];
    lines.push(`- ${row.code}: ${meta.length ? meta.map((m) => (m.value != null ? `${m.name}=${m.value}` : m.name)).join(', ') : '—'}`);
  }
  return `${lines.join('\n')}\n`;
}

function fmt(n) {
  return Number.isFinite(n) ? String(n) : '—';
}
