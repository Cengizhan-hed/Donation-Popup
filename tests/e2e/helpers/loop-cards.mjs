/**
 * Ürün sayfası ilgili ürünler / mağaza döngüsü kart görünürlüğü.
 * Woo çekirdek: klasik `.related.products li.product` + blok
 * `.wp-block-woocommerce-product-collection li.wc-block-product`. Tema seçicisi yok.
 */
import { parseLocalEvalJson, runLocalEvalFile } from './local-wp-eval.mjs';
import { SKIP_EVIDENCE } from './skip-policy.mjs';

/** @type {Map<number, { ok: boolean, ids: number[], evidence: string }>} */
const relatedIdsCache = new Map();

/**
 * WooCommerce related + upsell ID (WP eval). Kanıt yoksa atlama yok.
 * @param {number} productId
 * @param {{ relatedIds?: number[], upsellIds?: number[] }} [fromCatalog]
 * @returns {{ ok: boolean, ids: number[], evidence: string }}
 */
export function readRelatedProductIds(productId, fromCatalog = {}) {
  const id = Number(productId) || 0;
  if (id <= 0) return { ok: false, ids: [], evidence: '' };
  const catalogRelated = [
    ...(Array.isArray(fromCatalog.relatedIds) ? fromCatalog.relatedIds : []),
    ...(Array.isArray(fromCatalog.upsellIds) ? fromCatalog.upsellIds : []),
  ]
    .map((n) => Number(n) || 0)
    .filter((n) => n > 0 && n !== id);
  if (Array.isArray(fromCatalog.relatedIds) || Array.isArray(fromCatalog.upsellIds)) {
    return { ok: true, ids: [...new Set(catalogRelated)], evidence: SKIP_EVIDENCE.WP_DATA };
  }
  if (relatedIdsCache.has(id)) return relatedIdsCache.get(id);
  if (!String(process.env.WDP_LOCAL_WP_DIR || '').trim()) {
    return { ok: false, ids: [], evidence: '' };
  }
  try {
    const data = parseLocalEvalJson(
      runLocalEvalFile('tests/local-wp/product-meta.php', ['related-ids', String(id)])
    );
    const related = Array.isArray(data.related) ? data.related : [];
    const upsell = Array.isArray(data.upsell) ? data.upsell : [];
    const ids = [...new Set([...related, ...upsell].map((n) => Number(n) || 0).filter((n) => n > 0 && n !== id))];
    const result = { ok: !!data.ok, ids, evidence: SKIP_EVIDENCE.WP_DATA };
    relatedIdsCache.set(id, result);
    return result;
  } catch (e) {
    console.error(`[e2e:catch-fail] related-ids #${id}: ${e && e.message ? e.message : e}`);
    return { ok: false, ids: [], evidence: '' };
  }
}

export const RELATED_ROOT_SEL =
  '.related.products, .upsells.products, section.related, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection';

export const RELATED_CARD_SEL = 'li.product, li.wc-block-product, .wc-block-product-template > li';

export const RELATED_TITLE_SEL =
  '.woocommerce-loop-product__title, .product-title, .wp-block-post-title, .fusion-title, h2, h3';

/** Mağaza [products] / klasik döngü / Woo blok kartı. */
export const SHOP_CARD_SEL =
  '.wdp-e2e-shop-products li.product, ul.products li.product, li.wc-block-product';

/**
 * Playwright `.first()` gizli şablon kartına denk gelirse timeout yutulmamalı.
 * @param {number} attachedCount
 * @param {string} errMsg
 */
export function shopCardsHiddenFailure(attachedCount, errMsg) {
  return {
    check: 'loop-cards-shop',
    description: 'Mağaza döngüsünde görünür ürün kartı yok (Playwright hidden)',
    detail: `attached=${Number(attachedCount) || 0} ${String(errMsg || '')}`.trim(),
  };
}

/**
 * @param {{ display?: string, visibility?: string, opacity?: string, w?: number, h?: number }} m
 */
export function isLoopNodeVisible(m) {
  if (!m) return false;
  const opacity = Number.parseFloat(m.opacity == null ? '1' : String(m.opacity));
  return (
    m.display !== 'none' &&
    m.visibility !== 'hidden' &&
    (Number.isFinite(opacity) ? opacity > 0.05 : true) &&
    Number(m.w) > 4 &&
    Number(m.h) > 4
  );
}

/**
 * @param {Array<{ cardVisible?: boolean, titleVisible?: boolean, btnVisible?: boolean, titleText?: string, btnText?: string, i?: number }>} rows
 * @param {{ requireVisible?: boolean }} [opts]
 * @returns {{ status: 'ok'|'skip'|'fail', reason: string, bad: object[] }}
 */
export function classifyLoopCardsResult(rows, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const requireVisible = !!opts.requireVisible;
  if (!list.length) {
    return {
      status: requireVisible ? 'fail' : 'skip',
      reason: 'no-cards',
      bad: [],
    };
  }
  const visuallyPresent = list.filter((r) => r && r.cardVisible);
  if (!visuallyPresent.length) {
    return {
      status: requireVisible ? 'fail' : 'skip',
      reason: 'hidden-section',
      bad: list.slice(0, 6),
    };
  }
  const bad = visuallyPresent.filter((r) => !r.titleVisible || !r.btnVisible);
  if (bad.length) {
    return { status: 'fail', reason: 'incomplete-card', bad };
  }
  return { status: 'ok', reason: '', bad: [] };
}

/**
 * @param {object} row
 */
export function formatLoopCardFail(row) {
  const r = row || {};
  return `#${r.i ?? 0} titleVis=${!!r.titleVisible} "${r.titleText || ''}" btnVis=${!!r.btnVisible} "${r.btnText || ''}" cardVis=${!!r.cardVisible}`;
}
