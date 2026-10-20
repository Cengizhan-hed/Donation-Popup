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
    return 'Ad Soyad zorunludur.';
  }

  /** Hissedar adı zorunluluk mesajı. */
  function getShareholderNameRequiredMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.shareholder_name_required === 'string' && s.shareholder_name_required.trim()) {
      return s.shareholder_name_required.trim();
    }
    return 'Hissedar adı zorunludur.';
  }

  /** Zorunlu alan mesajı; alan adına göre özelleştirilebilir. */
  function getRequiredFieldMessage(field) {
    const s = wdp_ajax && wdp_ajax.strings;
    const generic =
      s && typeof s.required_field === 'string' && s.required_field.trim()
        ? s.required_field.trim()
        : 'Bu alan zorunludur';
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
    return 'Telefon numaranızı eksiksiz giriniz.';
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
      return 'ad soyad alanı eksik';
    }
    if (type === 'phone') {
      if (s && typeof s.shareholder_issue_phone === 'string' && s.shareholder_issue_phone.trim()) {
        return s.shareholder_issue_phone.trim();
      }
      return 'telefon alanı eksik veya hatalı';
    }
    return 'alan eksik';
  }

  function getSadakaInvalidMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.sadaka_invalid === 'string' && s.sadaka_invalid.trim()) {
      return s.sadaka_invalid.trim();
    }
    return 'Geçerli bir alt bağış tutarı giriniz.';
  }

  /** Geçersiz e-posta (dolu ama hatalı). */
  function getInvalidEmailMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.invalid_email === 'string' && s.invalid_email.trim()) {
      return s.invalid_email.trim();
    }
    return 'Lütfen geçerli bir e-posta adresi giriniz.';
  }

  /** Minimum alt bağış tutarı hata metni. */
  function getSadakaMinErrorMessage(minValue) {
    const formatCurrency = WDPApp.utils && typeof WDPApp.utils.formatCurrency === 'function'
      ? WDPApp.utils.formatCurrency
      : function(value) { return String(value); };
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.sadaka_min_error === 'string' && s.sadaka_min_error.trim()) {
      return s.sadaka_min_error.trim() + formatCurrency(minValue);
    }
    return 'En az ' + formatCurrency(minValue) + ' bağış giriniz.';
  }

  WDPApp.formMessages = {
    getDonorNameRequiredMessage: getDonorNameRequiredMessage,
    getShareholderNameRequiredMessage: getShareholderNameRequiredMessage,
    getRequiredFieldMessage: getRequiredFieldMessage,
    getPhoneRequiredMessage: getPhoneRequiredMessage,
    getPhoneIncompleteMessage: getPhoneIncompleteMessage,
    getPhoneValidationState: getPhoneValidationState,
    getShareholderIssueSummaryLabel: getShareholderIssueSummaryLabel,
    getSadakaInvalidMessage: getSadakaInvalidMessage,
    getSadakaMinErrorMessage: getSadakaMinErrorMessage,
    getInvalidEmailMessage: getInvalidEmailMessage,
  };
})(window);
