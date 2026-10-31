/**
 * E2E seçicileri — yeni nesil form (src/Modules/Experiences, templates/donation-panel/experiences/*.php,
 * assets/src/experiences/*.mjs). Eski modal (`wdp-modal`, `hdf-*`) seçicileri kaldırıldı.
 * Liste/kart/döngü düğmeleri (`wdp-card__cta`, `wdp-loop-donate`) eklentinin kendi sınıflarıdır.
 */

export const SEL = {
  // Tüm giriş noktaları: kök içindeki açma düğmesi + liste kartı + döngü düğmesi
  donateTrigger: '[data-dp-exp] [data-dp-open], .wdp-card__cta, .wdp-loop-donate',

  // Ortada açılan popup / alttan panel kökünün açma düğmesi
  centeredPopupTrigger: '[data-dp-exp]:is([data-dp-kind="popup"], [data-dp-kind="bottom_sheet"]) [data-dp-open]',

  // Sağ panel kökünün açma düğmesi
  sidePanelTrigger: '[data-dp-exp][data-dp-kind="side_panel"] [data-dp-open]',

  // Katman kabuğu (overlay) ve açık hali
  modalShell: '[data-dp-overlay]',
  openModalShell: '[data-dp-overlay].is-open',
  openCenteredPopup:
    '[data-dp-exp]:is([data-dp-kind="popup"], [data-dp-kind="bottom_sheet"]) [data-dp-overlay].is-open',
  openSidePanel: '[data-dp-exp][data-dp-kind="side_panel"] [data-dp-overlay].is-open',

  // Kabuk ekran görüntüsü kutusu
  modalContent: '[data-dp-surface]',
  sidePanelContent: '[data-dp-surface]',

  modalClose: '[data-dp-close]',
  donationForm: '[data-dp-form]',

  // Form düzeyi uyarı (role=alert) ve satır içi hata metinleri
  formError: '[data-dp-summary]',
  toastError: '[data-dp-summary]',
  fieldError: '[data-dp-field].has-error [data-dp-error]',

  donorName: 'input[name="donation_full_name"]',
  donorPhone: 'input[type="tel"][name="donation_phone"], input[name="donation_phone"]',
  donorEmail: 'input[name="donation_email"]',
  donorNote: 'textarea[name="donation_note"]',

  // Özel tutar kutusu (önerilen tutar gizli girdisi `input[type=hidden][name=amount]` ayrıdır)
  customPrice: 'input.donation-panel-custom__in[name="amount"]',

  lineTotal: '[data-dp-total]',
  qtyIncrease: '[data-dp-qty="1"]',
  shareIncrease: '[data-dp-qty="1"]',

  // Tek ana düğme: devam / bağış / ödemeye geç
  addToCart: '[data-dp-submit]',
  goCheckout: '[data-dp-submit]',
  // Son adımda görünen ikincil düğme: sepete ekler, ödemeye yönlendirmez, katmanı kapatır
  addOnly: '[data-dp-addcart]',

  // Ek bağış
  addonWrap: '[data-dp-addon]',
  addonToggle: 'input[name="addon_active"]',
  addonPanel: '[data-dp-addon-box]',
  addonPrice: 'input[name="addon_amount"]',
  addonOpen: '[data-dp-addon-box]:not([hidden])',

  // Gömülü (satır içi) form
  inlineDonationForm: '[data-dp-exp][data-dp-kind="inline"] [data-dp-form]',
  inlineRoot: '[data-dp-exp][data-dp-kind="inline"]',

  // Admin sekmeleri
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

/**
 * Yeni nesil form (src/Modules/Experiences, templates/donation-panel/experiences/*.php,
 * assets/src/experiences/*.mjs) seçicileri. Tema/oluşturucu adı yok; yalnız eklentinin kendi öznitelikleri.
 */
export const DP_SEL = {
  root: '[data-dp-exp]',
  form: '[data-dp-form]',
  open: '[data-dp-open]',
  overlay: '[data-dp-overlay]',
  surface: '[data-dp-surface]',
  close: '[data-dp-close]',
  submit: '[data-dp-submit]',
  amount: 'input.donation-panel-custom__in[name="amount"]',
  preset: 'button.donation-panel-amount',
  detailsStep: '[data-dp-step="details"]',
  dediToggle: '[data-dp-dedi-toggle]',
  inlineRoot: '[data-dp-exp][data-dp-kind="inline"]',
  panelOpen: '[data-dp-exp][data-dp-kind="side_panel"] [data-dp-open]',
  popupOpen: '[data-dp-exp]:is([data-dp-kind="popup"], [data-dp-kind="bottom_sheet"]) [data-dp-open]',
  error: (name) => `[data-dp-error="${name}"]`,
};
