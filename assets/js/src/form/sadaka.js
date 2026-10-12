/**
 * @file sadaka.js
 * Sadaka alt bağış satırı ekleme, seçim ve fiyat senkronu.
 * Dış API: WDPApp.formSadaka
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const formMessages = WDPApp.formMessages || {};
  const formPricing = WDPApp.formPricing || {};
  const formFeedback = WDPApp.formFeedback || {};
  const formatCurrency = typeof utils.formatCurrency === 'function' ? utils.formatCurrency : function(v) { return String(v); };
  const parseNormalizedAmount = typeof formPricing.parseNormalizedAmount === 'function'
    ? formPricing.parseNormalizedAmount
    : function() { return NaN; };
  const showInputError = typeof formFeedback.showInputError === 'function'
    ? formFeedback.showInputError
    : function() {};
  const getInputErrorAnchor = typeof formFeedback.getInputErrorAnchor === 'function'
    ? formFeedback.getInputErrorAnchor
    : function(input) { return input && input.parentNode; };

  let sadakaDonationDelegationBound = false;

  function getSadakaInvalidMessage() {
    if (typeof formMessages.getSadakaInvalidMessage === 'function') {
      return formMessages.getSadakaInvalidMessage();
    }
    return 'Geçerli bir alt bağış tutarı giriniz.';
  }

  function getSadakaMinErrorMessage(minValue) {
    if (typeof formMessages.getSadakaMinErrorMessage === 'function') {
      return formMessages.getSadakaMinErrorMessage(minValue);
    }
    return `En az ${formatCurrency(minValue)} bağış giriniz.`;
  }

  function getSadakaFixedAmount(wrap) {
    if (!wrap) {
      return NaN;
    }
    const raw = wrap.getAttribute('data-wdp-alt-fixed-price');
    if (raw === null || raw === '') {
      return NaN;
    }
    const value = parseNormalizedAmount(String(raw).trim());
    return Number.isFinite(value) && value > 0 ? value : NaN;
  }

  /** Açık sadaka panelinde tutar geçerliliğini kontrol eder. */
  function validateSadakaDonation(form) {
    const wrap = form ? form.querySelector('[data-wdp-sadaka-donation]') : null;
    if (!wrap || !wrap.classList.contains('is-open')) {
      return true;
    }
    if (Number.isFinite(getSadakaFixedAmount(wrap))) {
      return true;
    }
    const input = wrap.querySelector('input[name="sadaka_custom_price"]');
    if (!input) {
      return true;
    }
    const raw = String(input.value || '').trim();
    if (raw === '') {
      if (input.readOnly) {
        return true;
      }
      showInputError(input, getSadakaInvalidMessage());
      return false;
    }
    const numericValue = parseNormalizedAmount(raw);
    const minAttr = input.getAttribute('min');
    const minValue = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : 0;
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      showInputError(input, getSadakaInvalidMessage());
      return false;
    }
    if (Number.isFinite(minValue) && minValue > 0 && numericValue + 0.0001 < minValue) {
      showInputError(input, getSadakaMinErrorMessage(minValue));
      return false;
    }
    return true;
  }

  /** Sadaka alanlarını FormData'ya yazar; kapalıysa anahtarları temizler. */
  function patchSadakaFormData(form, formData) {
    if (!form || !formData) {
      return;
    }
    const wrap = form.querySelector('[data-wdp-sadaka-donation]');
    const hasMainCustomPrice = !!form.querySelector('input[name="custom_price"]');
    if (wrap && wrap.classList.contains('is-open')) {
      const fixedAmount = getSadakaFixedAmount(wrap);
      const sadakaInput = wrap.querySelector('input[name="sadaka_custom_price"]');
      const sadakaRaw = sadakaInput ? String(sadakaInput.value || '').trim() : '';
      if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
        formData.set('sadaka_donation_active', '1');
        formData.set('sadaka_custom_price', String(fixedAmount));
      } else if (sadakaRaw !== '') {
        formData.set('sadaka_donation_active', '1');
        formData.set('sadaka_custom_price', sadakaRaw);
      } else {
        formData.delete('sadaka_custom_price');
        formData.delete('sadaka_donation_active');
      }
    } else {
      formData.delete('sadaka_custom_price');
      formData.delete('sadaka_donation_active');
    }
    if (!hasMainCustomPrice) {
      formData.delete('custom_price');
    }
  }

  function clearSadakaInputErrors(input) {
    if (!input) {
      return;
    }
    input.classList.remove('wdp-error');
    const anchor = getInputErrorAnchor(input) || input.parentNode;
    const err = anchor && anchor.querySelector('.wdp-input-error');
    if (err) {
      err.remove();
    }
  }

  function toggleSadakaDonationPanel(wrap) {
    if (!wrap) {
      return;
    }
    const toggle = wrap.querySelector('.wdp-sadaka-donation__toggle');
    const panel = wrap.querySelector('.wdp-sadaka-donation__panel');
    const input = wrap.querySelector('input[name="sadaka_custom_price"]');
    if (!toggle || !panel) {
      return;
    }

    const open = wrap.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
      if (input && !input.readOnly) {
        input.value = '';
        clearSadakaInputErrors(input);
      }
    }

    if (open && input) {
      const fixedAmount = getSadakaFixedAmount(wrap);
      if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
        input.value = String(fixedAmount);
      }
    }
  }

  function ensureSadakaDonationDelegation() {
    if (sadakaDonationDelegationBound) {
      return;
    }
    sadakaDonationDelegationBound = true;

    document.addEventListener('click', function(e) {
      const toggle = e.target.closest('.wdp-sadaka-donation__toggle');
      if (!toggle) {
        return;
      }
      const wrap = toggle.closest('[data-wdp-sadaka-donation]');
      const form = toggle.closest('form');
      if (!wrap || !form) {
        return;
      }
      if (!form.closest('.wdp-modal') && !form.closest('.wdp-donation-form')) {
        return;
      }

      e.preventDefault();
      if (typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      toggleSadakaDonationPanel(wrap);
    });

    document.addEventListener('input', function(e) {
      const input = e.target;
      if (!input || !input.matches || !input.matches('input[name="sadaka_custom_price"]')) {
        return;
      }
      if (input.classList.contains('wdp-error')) {
        clearSadakaInputErrors(input);
      }
    });
  }

  function bindSadakaDonation(form) {
    ensureSadakaDonationDelegation();
    if (!form) {
      return;
    }
    const wrap = form.querySelector('[data-wdp-sadaka-donation]');
    if (!wrap) {
      return;
    }
    const panel = wrap.querySelector('.wdp-sadaka-donation__panel');
    const toggle = wrap.querySelector('.wdp-sadaka-donation__toggle');
    if (panel && !wrap.classList.contains('is-open')) {
      panel.setAttribute('hidden', '');
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', wrap.classList.contains('is-open') ? 'true' : 'false');
    }
    const fixedInput = wrap.querySelector('input[name="sadaka_custom_price"]');
    const fixedAmount = getSadakaFixedAmount(wrap);
    if (fixedInput && Number.isFinite(fixedAmount) && fixedAmount > 0) {
      fixedInput.value = String(fixedAmount);
    }
  }

  ensureSadakaDonationDelegation();

  WDPApp.formSadaka = {
    validateSadakaDonation: validateSadakaDonation,
    patchSadakaFormData: patchSadakaFormData,
    bindSadakaDonation: bindSadakaDonation,
    ensureSadakaDonationDelegation: ensureSadakaDonationDelegation,
  };
})(window);
