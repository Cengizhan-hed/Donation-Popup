/**
 * Ürün sayfası birincil WDP UI (döngü/ilgili kartlar hariç) + görünüm modu.
 * Eklenti: \DonationPanel\Modules\EntryPoints\Auto_Placement::resolve_product_page_display.
 *
 * Genel kural: sayfada görünür tam olarak BİR eklenti giriş noktası
 * (gömülü form veya eklenti düğmesi — eklenti sınıf/data öznitelikleri;
 * tema düğmesi sayılmaz). Çözümleyici farklıysa UYARI, HATA değil.
 */
import { SEL } from './selectors.mjs';

export const DISPLAY_MODES = Object.freeze(['inline', 'button_popup', 'button_panel']);

/** Woo çekirdek: ilgili / upsell / mağaza döngüsü — tema seçicisi yok. */
export const LOOP_EXCLUDE_SEL =
  '.related, .upsells, ul.products, .wdp-list, .wdp-donations, .fusion-post-cards, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection, .wdp-loop-donate';

/** Yerel Woo sepete ekle (eklenti formu değil). */
export const NATIVE_CART_FORM_SEL = 'form.cart:not(.wdp-form):not(.wdp-donation-form-fields)';
export const NATIVE_ATC_BTN_SEL =
  '.single_add_to_cart_button:not(.wdp-donate-button):not(.wdp-open-modal):not(.wdp-loop-donate)';
export const STICKY_ATC_SEL = '[class*="sticky-add-to-cart"], [class*="sticky"][class*="add-to-cart"]';

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
 * Yerel sepete ekle görünür mü (döngü kartları hariç).
 *
 * @param {{ nativeFormsVisible?: number, nativeButtonsVisible?: number, stickyVisible?: number, probe?: string }} info
 * @returns {{ ok: boolean, reason: string }}
 */
export function classifyNativeCartVisibility(info) {
  const forms = Number(info?.nativeFormsVisible || 0);
  const btns = Number(info?.nativeButtonsVisible || 0);
  const sticky = Number(info?.stickyVisible || 0);
  if (forms > 0 || btns > 0 || sticky > 0) {
    const extra = info?.probe ? ` ${info.probe}` : '';
    return { ok: false, reason: `yerel sepete ekle görünür form=${forms} düğme=${btns} sticky=${sticky}${extra}` };
  }
  return { ok: true, reason: '' };
}

/**
 * Tarayıcıda çalışır (page.evaluate). Döngü hariç yerel form/düğme/sticky + ebeveyn zinciri.
 *
 * @param {{ excludeSel: string, formSel: string, btnSel: string, stickySel: string }} args
 * @returns {{ nativeFormsVisible: number, nativeButtonsVisible: number, stickyVisible: number, probe: string, forms: Array<object> }}
 */
export function nativeCartProbeBrowser(args) {
  const excludeSel = args.excludeSel;
  const formSel = args.formSel;
  const btnSel = args.btnSel;
  const stickySel = args.stickySel;
  const excluded = (el) => !!(el && el.closest && el.closest(excludeSel));
  const vis = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      st.display !== 'none' &&
      st.visibility !== 'hidden' &&
      Number.parseFloat(st.opacity || '1') > 0.05 &&
      r.width > 4 &&
      r.height > 4
    );
  };
  const chain = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; i < 8 && n && n !== document.body; i += 1) {
      const id = n.id ? `#${n.id}` : '';
      const raw = n.className && typeof n.className === 'string' ? n.className.trim() : '';
      const cls = raw
        ? `.${raw
            .split(/\s+/)
            .slice(0, 5)
            .join('.')}`
        : '';
      parts.push(`${(n.tagName || '').toLowerCase()}${id}${cls}`);
      n = n.parentElement;
    }
    return parts.join(' < ');
  };
  const forms = Array.from(document.querySelectorAll(formSel)).filter((el) => !excluded(el));
  const btns = Array.from(document.querySelectorAll(btnSel)).filter((el) => !excluded(el));
  const sticky = Array.from(document.querySelectorAll(stickySel)).filter((el) => !excluded(el));
  const visForms = forms.filter(vis);
  const visBtns = btns.filter(vis);
  const visSticky = sticky.filter(vis);
  const sample = visForms[0] || visBtns[0] || visSticky[0] || forms[0] || null;
  const st = sample ? getComputedStyle(sample) : null;
  const probe = sample
    ? `tag=${sample.tagName} chain=${chain(sample)} display=${st && st.display} vis=${st && st.visibility} pos=${st && st.position}`
    : 'yerel form yok';
  return {
    nativeFormsVisible: visForms.length,
    nativeButtonsVisible: visBtns.length,
    stickyVisible: visSticky.length,
    nativeCart: visForms.length,
    probe,
    forms: visForms.slice(0, 3).map((el) => ({ chain: chain(el), display: getComputedStyle(el).display })),
  };
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

/**
 * Döngü kartları hariç görünür eklenti girişi (form / panel / popup).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ inlineVisible: number, panelVisible: number, popupVisible: number, displayAttr: string }>}
 */
export async function collectVisiblePluginEntry(page) {
  return page.evaluate(
    ({ excludeSel, inlineSel, panelSel, popupSel }) => {
      const excluded = (el) => !!(el && el.closest(excludeSel));
      const vis = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          st.display !== 'none' &&
          st.visibility !== 'hidden' &&
          Number.parseFloat(st.opacity || '1') > 0.05 &&
          r.width > 4 &&
          r.height > 4
        );
      };
      const pick = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => !excluded(el));
      const inline = pick(inlineSel);
      const panel = pick(panelSel);
      const popup = pick(popupSel);
      const displayAttr =
        [...panel, ...popup, ...inline].map((el) => el.getAttribute('data-wdp-display')).find(Boolean) || '';
      return {
        inlineVisible: inline.filter(vis).length,
        panelVisible: panel.filter(vis).length,
        popupVisible: popup.filter(vis).length,
        displayAttr,
      };
    },
    {
      excludeSel: LOOP_EXCLUDE_SEL,
      inlineSel: SEL.inlineDonationForm,
      panelSel: SEL.sidePanelTrigger,
      popupSel: SEL.centeredPopupTrigger,
    }
  );
}
