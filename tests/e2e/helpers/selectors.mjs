/**
 * E2E seçicileri — eklenti şablon / JS kaynaklarından.
 * Tahmini seçici kullanma; kaynak dosya yolu her girdinin yanında.
 */

export const SEL = {
  // includes/class-shortcodes.php — .wdp-donate-button.wdp-open-modal
  // includes/class-product-page-integration.php — .wdp-loop-donate.wdp-open-modal
  // Not: panel butonları da .wdp-open-modal taşır; ortadaki popup için centeredPopupTrigger kullan.
  donateTrigger: '.wdp-donate-button, .wdp-loop-donate, .wdp-open-modal',

  // Ortada açılan gerçek popup tetikleyici (side-panel sınıfı yok)
  // includes/class-shortcodes.php wdp_donation_button; class-donations-list.php button=popup
  centeredPopupTrigger: '.wdp-open-modal:not(.wdp-open-side-panel)',

  // includes/class-product-page-integration.php / class-shortcodes.php — side panel
  sidePanelTrigger: '.wdp-open-side-panel, .wdp-donate-button.wdp-open-side-panel',

  // includes/templates/class-modal-shell-renderer.php — modal kabuğu
  modalShell: '.hdf-donation-modal-wrapper.wdp-modal',

  // assets/js/src/modal.js — açıkken .show (+ aria-hidden="false")
  // Kapanma kontrolünde .show yokluğunu kullan (locator kaybolmasın diye shell için modalShell+.show).
  openModalShell: '.hdf-donation-modal-wrapper.wdp-modal.show',

  // Ortada açılan gerçek popup kabuğu (sağ panel değil)
  openCenteredPopup: '.hdf-donation-modal-wrapper.wdp-modal.show:not(.wdp-side-panel)',

  // includes/templates/class-modal-shell-renderer.php — side panel sınıfı
  openSidePanel: '.hdf-donation-modal-wrapper.wdp-modal.wdp-side-panel.show',

  // includes/templates/class-modal-shell-renderer.php — .wdp-modal-content
  // Kabuk ekran görüntüsü: wrapper (tam viewport + backdrop) değil, bu kutu.
  modalContent: '.wdp-modal-content',
  // Side panel içerik kutusu (aynı düğüm + sınıf)
  sidePanelContent: '.wdp-modal-content.wdp-side-panel-content, .wdp-side-panel.show .wdp-modal-content',

  // includes/templates/class-modal-shell-renderer.php — button.wdp-modal-close
  modalClose: 'button.wdp-modal-close',

  // includes/templates/class-modal-shell-renderer.php — form.wdp-donation-form-fields
  donationForm: 'form.wdp-donation-form-fields',

  // includes/templates/class-modal-shell-renderer.php — .wdp-form-error
  // assets/js/src/form/feedback.js showFormError; product.js displayProductInfoError
  formError: '.wdp-form-error',
  // assets/js/src/core/utils.js showToast type=error
  toastError: '.wdp-toast--error, #wdp-toast-host .wdp-toast--error',

  // assets/js/src/form/feedback.js — .wdp-input-error / .wdp-error
  fieldError: '.wdp-input-error, .wdp-error',

  // includes/templates/class-form-fields-renderer.php — name="donation_full_name"
  donorName: 'input[name="donation_full_name"]',

  // includes/class-phone-field.php — name="donation_phone" + .wdp-phone-field__number
  // assets/js/src/phone-input.js — TR: +90 seçiliyken ulusal 10 hane (örn. 5551234567)
  donorPhone: 'input[type="tel"][name="donation_phone"]',

  // includes/templates/class-form-fields-renderer.php — name="donation_email" (isteğe bağlı)
  donorEmail: 'input[name="donation_email"]',

  // includes/templates/class-form-fields-renderer.php — name="donation_note"
  donorNote: 'textarea[name="donation_note"]',

  // includes/templates/class-form-fields-renderer.php — name="custom_price"
  customPrice: 'input[name="custom_price"].wdp-custom-price-input, input[name="custom_price"]',

  // includes/templates/class-form-fields-renderer.php — .wdp-line-total-value
  lineTotal: '.wdp-line-total-value',

  // includes/templates/class-form-fields-renderer.php — .wdp-product-quantity-increase
  qtyIncrease: 'button.wdp-product-quantity-increase',

  // includes/templates/class-form-fields-renderer.php — .wdp-share-btn-increase
  shareIncrease: 'button.wdp-share-btn-increase',

  // includes/templates/class-modal-shell-renderer.php — button[name="donation_add_to_cart"]
  addToCart: 'button[name="donation_add_to_cart"]',

  // includes/templates/class-modal-shell-renderer.php — button[name="donation_go_checkout"]
  goCheckout: 'button[name="donation_go_checkout"]',

  // includes/templates/class-form-fields-renderer.php — alt bağış
  addonWrap: '[data-wdp-sadaka-donation]',
  addonToggle: '.wdp-sadaka-donation__toggle',
  addonPanel: '.wdp-sadaka-donation__panel',
  addonPrice: 'input[name="sadaka_custom_price"]',
  addonOpen: '[data-wdp-sadaka-donation].is-open',
  // includes/templates/class-form-fields-renderer.php — data-wdp-alt-wc-product-id
  addonAltWcProductId: '[data-wdp-alt-wc-product-id]',

  // includes/templates/class-modal-shell-renderer.php — gömülü form
  inlineDonationForm: '.hdf-donation-modal-wrapper.wdp-donation-form',

  // Admin sekmeleri (mevcut admin UI)
  adminTab: '.wdp-nav-tab-wrapper a.nav-tab[data-tab]',
  productDonationTab: '.wdp_donation_tab a, a[href="#wdp_donation_data"], li.wdp_donation_options a',
};

/**
 * Sabit yüzen / üçüncü parti gürültü — ekran görüntüsünde maskelenir.
 * E2E_MASK_SELECTORS ile virgülle ek seçici eklenebilir (.env.e2e.example).
 */
export const DEFAULT_MASK_SELECTORS = [
  // Yaygın WhatsApp / iletişim yüzen butonları (tema / eklenti)
  '.whatsapp-float',
  '.whatsapp-button',
  '#whatsapp',
  '.wa-float',
  'a[href*="wa.me"]',
  'a[href*="api.whatsapp.com"]',
  '.float-contact',
  '.floating-contact',
  '.phone-float',
  '.call-float',
  '#ht-ctc-chat',
  '.ht-ctc',
  '.joinchat',
  '.wsp-container',
  '.elementor-widget-whatsapp',
  // Cookie / chat widget’ları
  '#cookie-notice',
  '.cookie-notice',
  '#tidio-chat',
  'iframe[src*="tidio"]',
];

/**
 * @param {string} [extraCsv] E2E_MASK_SELECTORS
 * @returns {string[]}
 */
export function maskSelectors(extraCsv = '') {
  const extra = String(extraCsv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_MASK_SELECTORS, ...extra])];
}

/** Ekran görüntüsü öncesi animasyon / caret gürültüsünü keser. */
export const FREEZE_MOTION_CSS = `
*, *::before, *::after {
  animation: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition: none !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}
`;
