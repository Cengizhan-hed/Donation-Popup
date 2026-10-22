/**
 * Ürün sayfası ilgili ürünler / mağaza döngüsü kart görünürlüğü.
 * Woo çekirdek: klasik `.related.products li.product` + blok
 * `.wp-block-woocommerce-product-collection li.wc-block-product`. Tema seçicisi yok.
 */

export const RELATED_ROOT_SEL =
  '.related.products, .upsells.products, section.related, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection';

export const RELATED_CARD_SEL = 'li.product, li.wc-block-product, .wc-block-product-template > li';

export const RELATED_TITLE_SEL =
  '.woocommerce-loop-product__title, .product-title, .wp-block-post-title, .fusion-title, h2, h3';

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
