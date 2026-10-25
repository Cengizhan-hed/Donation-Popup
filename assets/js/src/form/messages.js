/**
 * @file messages.js
 * Form hata/bilgi metinleri ve telefon doğrulama mesajları.
 * Dış API: WDPApp.formMessages
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const wdp_ajax = window.wdp_ajax || {};

  /** Bağışçı ad-soyad zorunluluk mesajı (çeviri veya varsayılan). */
  function getDonorNameRequiredMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.donor_name_required === 'string' && s.donor_name_required.trim()) {
      return s.donor_name_required.trim();
    }
    return WDPApp.i18n.__('Full name is required.', 'woo-donation-popup');
  }

  /** Hissedar adı zorunluluk mesajı. */
  function getShareholderNameRequiredMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.shareholder_name_required === 'string' && s.shareholder_name_required.trim()) {
      return s.shareholder_name_required.trim();
    }
    return WDPApp.i18n.__('Shareholder name is required.', 'woo-donation-popup');
  }

  /** Zorunlu alan mesajı; alan adına göre özelleştirilebilir. */
  function getRequiredFieldMessage(field) {
    const s = wdp_ajax && wdp_ajax.strings;
    const generic =
      s && typeof s.required_field === 'string' && s.required_field.trim()
        ? s.required_field.trim()
        : WDPApp.i18n.__('This field is required', 'woo-donation-popup');
    if (!field || !field.name) {
      return generic;
    }
    if (field.name === 'donation_full_name') {
      return getDonorNameRequiredMessage();
    }
    return generic;
  }

  function getPhoneRequiredMessage() {
    return getPhoneIncompleteMessage();
  }

  /** Eksik telefon mesajı. */
  function getPhoneIncompleteMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.phone_incomplete === 'string' && s.phone_incomplete.trim()) {
      return s.phone_incomplete.trim();
    }
    return WDPApp.i18n.__('Please enter your complete phone number.', 'woo-donation-popup');
  }

  /**
   * Telefon alanı doğrulama durumu.
   * @returns {{ok: boolean, message: string}}
   */
  function getPhoneValidationState(input, options) {
    if (!input || input.disabled || input.readOnly) {
      return { ok: true, message: '' };
    }
    const isRequired =
      options && typeof options.required === 'boolean'
        ? options.required
        : input.required || input.hasAttribute('required');
    if (!WDPApp.phoneInput || typeof WDPApp.phoneInput.validatePhoneField !== 'function') {
      if (isRequired && !String(input.value || '').trim()) {
        return { ok: false, message: getPhoneRequiredMessage() };
      }
      return { ok: true, message: '' };
    }
    const result = WDPApp.phoneInput.validatePhoneField(input);
    if (result.empty) {
      if (!isRequired) {
        return { ok: true, message: '' };
      }
      return { ok: false, message: getPhoneRequiredMessage() };
    }
    if (!result.ok) {
      return { ok: false, message: getPhoneIncompleteMessage() };
    }
    return { ok: true, message: '' };
  }

  /** Hissedar özet satırı için eksik alan etiketi. */
  function getShareholderIssueSummaryLabel(type) {
    const s = wdp_ajax && wdp_ajax.strings;
    if (type === 'name') {
      if (s && typeof s.shareholder_issue_name === 'string' && s.shareholder_issue_name.trim()) {
        return s.shareholder_issue_name.trim();
      }
      return WDPApp.i18n.__('full name is missing', 'woo-donation-popup');
    }
    if (type === 'phone') {
      if (s && typeof s.shareholder_issue_phone === 'string' && s.shareholder_issue_phone.trim()) {
        return s.shareholder_issue_phone.trim();
      }
      return WDPApp.i18n.__('phone number is missing or invalid', 'woo-donation-popup');
    }
    return WDPApp.i18n.__('field is missing', 'woo-donation-popup');
  }

  function getAddonInvalidMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.sadaka_invalid === 'string' && s.sadaka_invalid.trim()) {
      return s.sadaka_invalid.trim();
    }
    return WDPApp.i18n.__('Please enter a valid additional donation amount.', 'woo-donation-popup');
  }

  /** Geçersiz e-posta (dolu ama hatalı). */
  function getInvalidEmailMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.invalid_email === 'string' && s.invalid_email.trim()) {
      return s.invalid_email.trim();
    }
    return WDPApp.i18n.__('Please enter a valid email address.', 'woo-donation-popup');
  }

  /** Minimum alt bağış tutarı hata metni. */
  function getAddonMinErrorMessage(minValue) {
    const formatCurrency = WDPApp.utils && typeof WDPApp.utils.formatCurrency === 'function'
      ? WDPApp.utils.formatCurrency
      : function(value) { return String(value); };
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.sadaka_min_error === 'string' && s.sadaka_min_error.trim()) {
      return s.sadaka_min_error.trim() + formatCurrency(minValue);
    }
    return WDPApp.i18n.sprintf(
      WDPApp.i18n.__('Please enter at least %s.', 'woo-donation-popup'),
      formatCurrency(minValue)
    );
  }

  WDPApp.formMessages = {
    getDonorNameRequiredMessage: getDonorNameRequiredMessage,
    getShareholderNameRequiredMessage: getShareholderNameRequiredMessage,
    getRequiredFieldMessage: getRequiredFieldMessage,
    getPhoneRequiredMessage: getPhoneRequiredMessage,
    getPhoneIncompleteMessage: getPhoneIncompleteMessage,
    getPhoneValidationState: getPhoneValidationState,
    getShareholderIssueSummaryLabel: getShareholderIssueSummaryLabel,
    getAddonInvalidMessage: getAddonInvalidMessage,
    getAddonMinErrorMessage: getAddonMinErrorMessage,
    getInvalidEmailMessage: getInvalidEmailMessage,
  };
})(window);
