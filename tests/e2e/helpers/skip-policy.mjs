/**
 * E2E atlama politikası: yalnız sabit kod + WP verisi / politika kanıtı.
 * Ekran gözlemi (DOM) atlama gerekçesi olamaz.
 */

/** @typedef {'no-list-page'|'no-shop-page'|'no-popup-source'|'no-published-product'|'no-published-shares'|'private-fixture'|'setting-off'|'no-wc-product-id'|'no-related-products'|'no-remote-orders'|'local-only'|'no-product-path'|'theme-hides-related'|'coming-soon-checkout'} SkipReasonCode */
/** @typedef {'wp-data'|'policy'|'css-source'} SkipEvidence */

export const PLUGIN_STYLE_PATH = '/wp-content/plugins/woo-donation-popup/';

export const SKIP_REASONS = Object.freeze({
  NO_LIST_PAGE: 'no-list-page',
  NO_SHOP_PAGE: 'no-shop-page',
  NO_POPUP_SOURCE: 'no-popup-source',
  NO_PUBLISHED_PRODUCT: 'no-published-product',
  NO_PUBLISHED_SHARES: 'no-published-shares',
  PRIVATE_FIXTURE: 'private-fixture',
  SETTING_OFF: 'setting-off',
  NO_WC_PRODUCT_ID: 'no-wc-product-id',
  NO_RELATED_PRODUCTS: 'no-related-products',
  NO_REMOTE_ORDERS: 'no-remote-orders',
  LOCAL_ONLY: 'local-only',
  NO_PRODUCT_PATH: 'no-product-path',
  THEME_HIDES_RELATED: 'theme-hides-related',
  COMING_SOON_CHECKOUT: 'coming-soon-checkout',
});

export const ALLOWED_SKIP_REASONS = Object.freeze(Object.values(SKIP_REASONS));

export const SKIP_EVIDENCE = Object.freeze({
  WP_DATA: 'wp-data',
  POLICY: 'policy',
  CSS_SOURCE: 'css-source',
});

export const ALLOWED_SKIP_EVIDENCE = Object.freeze(Object.values(SKIP_EVIDENCE));

export const SKIP_LABELS = Object.freeze({
  [SKIP_REASONS.NO_LIST_PAGE]:
    'Bağış listesi sayfası WP içeriğinde eklenti kısa kodu/bloğu bulunamadı',
  [SKIP_REASONS.NO_SHOP_PAGE]: 'Mağaza sayfası WooCommerce wc_get_page_permalink(shop) boş',
  [SKIP_REASONS.NO_POPUP_SOURCE]: 'Liste sayfası ve mağaza döngüsü kaynağı yok',
  [SKIP_REASONS.NO_PUBLISHED_PRODUCT]: 'Yayımlanmış katalog ürünü yok',
  [SKIP_REASONS.NO_PUBLISHED_SHARES]: 'Yayımlanmış hisseli ürün yok',
  [SKIP_REASONS.PRIVATE_FIXTURE]: 'Private fixture listede/mağazada görünmez',
  [SKIP_REASONS.SETTING_OFF]: 'Ayar kapalı',
  [SKIP_REASONS.NO_WC_PRODUCT_ID]: 'Ürün ID boş ve genel varsayılan yok',
  [SKIP_REASONS.NO_RELATED_PRODUCTS]: 'WooCommerce related/upsell ID boş',
  [SKIP_REASONS.NO_REMOTE_ORDERS]: 'Uzaktan sipariş yok (checkout-view-only)',
  [SKIP_REASONS.LOCAL_ONLY]: 'yalnız yerel',
  [SKIP_REASONS.NO_PRODUCT_PATH]: 'Katalogda ürün yolu yok',
  [SKIP_REASONS.THEME_HIDES_RELATED]: 'Tema/başka eklenti CSS ilgili ürünler bölümünü gizliyor',
  [SKIP_REASONS.COMING_SOON_CHECKOUT]:
    'WooCommerce coming soon açık (profil/keşif: coming_soon=yes); ödeme sayfası ziyaretçiye coming soon içeriği veriyor — yayın öncesi site',
});

/**
 * @param {string} reason
 */
export function isAllowedSkipReason(reason) {
  return ALLOWED_SKIP_REASONS.includes(String(reason || ''));
}

/**
 * @param {string} evidence
 */
export function isAllowedSkipEvidence(evidence) {
  return ALLOWED_SKIP_EVIDENCE.includes(String(evidence || ''));
}

/**
 * @param {{ reason?: string, detail?: string }} rec
 */
export function formatSkipDescription(rec = {}) {
  const reason = String(rec.reason || '').trim();
  const detail = String(rec.detail || '').trim();
  const label = SKIP_LABELS[reason] || '';
  if (label && detail) return `${label} (${detail})`;
  if (label) return label;
  return detail || reason || '';
}

/**
 * @param {{ check?: string, reason?: string, evidence?: string, detail?: string }} opts
 */
export function makeSkip(opts = {}) {
  const rec = {
    check: String(opts.check || 'skip'),
    reason: String(opts.reason || ''),
    evidence: String(opts.evidence || ''),
  };
  if (opts.detail) rec.detail = String(opts.detail);
  if (opts.source) rec.source = String(opts.source);
  rec.description = formatSkipDescription(rec);
  return rec;
}

/**
 * css-source yalnız eklenti dışı stil dosya yolu ile geçerli.
 * @param {string} source
 */
export function isAllowedCssSource(source) {
  const s = String(source || '').trim();
  if (!s || s === 'inline') return false;
  if (s.includes(PLUGIN_STYLE_PATH)) return false;
  return s.includes('/') || /\.css(\b|$)/i.test(s);
}

/**
 * Yapılandırılmış atlama: reason enum + evidence wp-data|policy.
 * Serbest metin veya evidence=dom → hata.
 *
 * @param {unknown} record
 * @returns {'skip'|'fail'}
 */
export function classifySkip(record) {
  if (!record || typeof record !== 'object') return 'fail';
  const reason = String(record.reason || '').trim();
  const evidence = String(record.evidence || '').trim();
  if (!isAllowedSkipReason(reason)) return 'fail';
  if (evidence === 'dom') return 'fail';
  if (!isAllowedSkipEvidence(evidence)) return 'fail';
  if (evidence === SKIP_EVIDENCE.CSS_SOURCE) {
    if (reason !== SKIP_REASONS.THEME_HIDES_RELATED) return 'fail';
    if (!isAllowedCssSource(record.source)) return 'fail';
    return 'skip';
  }
  if (reason === SKIP_REASONS.THEME_HIDES_RELATED) return 'fail';
  return 'skip';
}

/**
 * Eski imza: metin her zaman hata; nesne classifySkip.
 * @param {unknown} descriptionOrRecord
 * @returns {'skip'|'fail'}
 */
export function classifySkipReason(descriptionOrRecord) {
  if (descriptionOrRecord && typeof descriptionOrRecord === 'object') {
    return classifySkip(descriptionOrRecord);
  }
  return 'fail';
}

/**
 * @param {object} opts
 * @param {Array<{check?:string,reason?:string,evidence?:string,description?:string,detail?:string}>} opts.skips
 * @param {object[]} opts.failures
 * @param {{ skipped?: number, failed?: number }} [opts.stats]
 * @param {(row: object) => object} opts.makeFailure
 * @returns {number} hata olarak yükselen atlama sayısı
 */
export function promoteIllegalSkips({ skips, failures, stats, makeFailure }) {
  if (!Array.isArray(skips) || !Array.isArray(failures) || typeof makeFailure !== 'function') {
    return 0;
  }
  const kept = [];
  let promoted = 0;
  for (const s of skips) {
    if (classifySkip(s) === 'fail') {
      const desc = String(s?.reason || s?.description || s?.detail || '');
      failures.push(
        makeFailure({
          check: s.check || 'skip',
          description: `Altyapı atlaması hata: ${desc}`,
          detail: s.detail || desc,
        })
      );
      promoted += 1;
      if (stats) {
        stats.skipped = Math.max(0, (Number(stats.skipped) || 1) - 1);
        stats.failed = (Number(stats.failed) || 0) + 1;
      }
    } else {
      kept.push(s);
    }
  }
  skips.length = 0;
  skips.push(...kept);
  return promoted;
}
