/**
 * Ürün sayfası birincil WDP UI (döngü/ilgili kartlar hariç) + görünüm modu.
 * Eklenti: WDP_Product_Page_Integration::resolve_product_page_display.
 */

export const DISPLAY_MODES = Object.freeze(['inline', 'button_popup', 'button_panel']);

/** Woo çekirdek: ilgili / upsell / mağaza döngüsü — tema seçicisi yok. */
export const LOOP_EXCLUDE_SEL = '.related, .upsells, ul.products, .wdp-list, .wdp-donations, .fusion-post-cards';

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
 * @param {{ kind: string, inlineVisible: number, panelVisible: number, popupVisible: number }} ui
 * @returns {{ ok: boolean, reason: string }}
 */
export function matchPrimaryUi(ui) {
  const kind = String(ui?.kind || '');
  const inlineN = Number(ui?.inlineVisible) || 0;
  const panelN = Number(ui?.panelVisible) || 0;
  const popupN = Number(ui?.popupVisible) || 0;
  if (kind === 'form') {
    if (inlineN === 1) return { ok: true, reason: '' };
    return { ok: false, reason: `gömülü form beklenirdi (görünür=${inlineN})` };
  }
  if (kind === 'panel') {
    if (panelN >= 1) return { ok: true, reason: '' };
    return { ok: false, reason: `panel düğmesi beklenirdi (görünür=${panelN})` };
  }
  if (kind === 'popup') {
    if (popupN >= 1) return { ok: true, reason: '' };
    return { ok: false, reason: `popup düğmesi beklenirdi (görünür=${popupN})` };
  }
  if (inlineN + panelN + popupN === 0) {
    return { ok: true, reason: 'skip' };
  }
  return { ok: false, reason: `görünüm boş ama birincil UI var inline=${inlineN} panel=${panelN} popup=${popupN}` };
}
