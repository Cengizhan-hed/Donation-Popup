/**
 * Ürün sayfası birincil WDP UI (döngü/ilgili kartlar hariç) + görünüm modu.
 * Eklenti: WDP_Product_Page_Integration::resolve_product_page_display.
 *
 * Genel kural: sayfada görünür tam olarak BİR eklenti giriş noktası
 * (gömülü form veya eklenti düğmesi — eklenti sınıf/data öznitelikleri;
 * tema düğmesi sayılmaz). Çözümleyici farklıysa UYARI, HATA değil.
 */

export const DISPLAY_MODES = Object.freeze(['inline', 'button_popup', 'button_panel']);

/** Woo çekirdek: ilgili / upsell / mağaza döngüsü — tema seçicisi yok. */
export const LOOP_EXCLUDE_SEL =
  '.related, .upsells, ul.products, .wdp-list, .wdp-donations, .fusion-post-cards, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection, .wdp-loop-donate';

/**
 * @param {unknown} raw
 * @returns {''|'inline'|'button_popup'|'button_panel'}
 */
export function normalizeDisplay(raw) {
  const v = String(raw || '').trim();
  return DISPLAY_MODES.includes(v) ? v : '';
}

/**
 * @param {string} display
 * @returns {''|'form'|'popup'|'panel'}
 */
export function expectedPrimaryKind(display) {
  const d = normalizeDisplay(display);
  if (d === 'inline') return 'form';
  if (d === 'button_popup') return 'popup';
  if (d === 'button_panel') return 'panel';
  return '';
}

/**
 * @param {{ display?: string, displayAttr?: string }} src
 * @returns {''|'inline'|'button_popup'|'button_panel'}
 */
export function resolveDisplayFromSources(src) {
  return normalizeDisplay(src?.display) || normalizeDisplay(src?.displayAttr);
}

/**
 * Görünür eklenti girişleri: gömülü form + panel düğmesi + popup düğmesi.
 * Tema düğmesi (wdp sınıfı yok) sayıya girmez.
 *
 * @param {{ kind?: string, inlineVisible?: number, panelVisible?: number, popupVisible?: number }} ui
 * @returns {{ ok: boolean, kind: ''|'form'|'panel'|'popup', total: number, reason: string }}
 */
export function classifyVisiblePluginEntry(ui) {
  const inlineN = Number(ui?.inlineVisible) || 0;
  const panelN = Number(ui?.panelVisible) || 0;
  const popupN = Number(ui?.popupVisible) || 0;
  const total = inlineN + panelN + popupN;
  if (total === 0) {
    return {
      ok: false,
      kind: '',
      total,
      reason: 'görünür eklenti girişi yok (bağış alınamaz; tema düğmesi sayılmaz)',
    };
  }
  if (total > 1) {
    return {
      ok: false,
      kind: '',
      total,
      reason: `görünür eklenti girişi ${total} (>1) inline=${inlineN} panel=${panelN} popup=${popupN}`,
    };
  }
  if (inlineN === 1) return { ok: true, kind: 'form', total, reason: '' };
  if (panelN === 1) return { ok: true, kind: 'panel', total, reason: '' };
  if (popupN === 1) return { ok: true, kind: 'popup', total, reason: '' };
  return { ok: false, kind: '', total, reason: 'sınıflanamadı' };
}

/**
 * resolve_product_page_display ≠ sayfadaki giriş → UYARI (HATA değil).
 *
 * @param {string} resolvedDisplay
 * @param {string} actualKind form|panel|popup
 * @returns {string} boş = uyarı yok
 */
export function displayMismatchWarning(resolvedDisplay, actualKind) {
  const expected = expectedPrimaryKind(resolvedDisplay);
  const actual = String(actualKind || '');
  if (!actual || expected === actual) return '';
  if (expected === 'form' && (actual === 'panel' || actual === 'popup')) {
    return 'ayar inline, sayfa düğme gösteriyor — tema/oluşturucu şablonu';
  }
  const setting = normalizeDisplay(resolvedDisplay) || '(boş)';
  const page =
    actual === 'form' ? 'form' : actual === 'panel' ? 'düğme (panel)' : actual === 'popup' ? 'düğme (popup)' : actual;
  return `ayar ${setting}, sayfa ${page} gösteriyor — tema/oluşturucu şablonu`;
}

/**
 * Eski eşleyici — classifyVisiblePluginEntry + beklenen kind.
 * Yeni senaryo beklenen kind'ı HATA için kullanmaz; uyarı için displayMismatchWarning.
 *
 * @param {{ kind: string, inlineVisible: number, panelVisible: number, popupVisible: number }} ui
 * @returns {{ ok: boolean, reason: string }}
 */
export function matchPrimaryUi(ui) {
  const classified = classifyVisiblePluginEntry(ui);
  const kind = String(ui?.kind || '');
  if (!kind) {
    if (classified.total === 0) return { ok: true, reason: 'skip' };
    return { ok: false, reason: classified.reason };
  }
  if (!classified.ok) return { ok: false, reason: classified.reason };
  if (classified.kind !== kind) {
    return {
      ok: false,
      reason: `${kind === 'form' ? 'gömülü form' : kind === 'panel' ? 'panel düğmesi' : 'popup düğmesi'} beklenirdi (görünür giriş=${classified.kind})`,
    };
  }
  return { ok: true, reason: '' };
}
