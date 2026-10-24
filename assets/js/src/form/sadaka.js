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
  const sadakaRules = WDPApp.sadakaRules || {};
  const formatCurrency = typeof utils.formatCurrency === 'function' ? utils.formatCurrency : function(v) { return String(v); };
  const parseNormalizedAmount = typeof sadakaRules.parseAmount === 'function'
    ? sadakaRules.parseAmount
    : (typeof formPricing.parseNormalizedAmount === 'function'
      ? formPricing.parseNormalizedAmount
      : function() { return NaN; });
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
    return WDPApp.i18n.__('Please enter a valid additional donation amount.', 'woo-donation-popup');
  }

  function getSadakaMinErrorMessage(minValue) {
    if (typeof formMessages.getSadakaMinErrorMessage === 'function') {
      return formMessages.getSadakaMinErrorMessage(minValue);
    }
    return WDPApp.i18n.sprintf(
      WDPApp.i18n.__('Please enter at least %s.', 'woo-donation-popup'),
      formatCurrency(minValue)
    );
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

  function getSadakaInput(wrap) {
    return wrap ? wrap.querySelector('input[name="sadaka_custom_price"]') : null;
  }

  function syncSadakaInputRequired(wrap) {
    const input = getSadakaInput(wrap);
    if (!input) {
      return;
    }
    // HTML5 required kullanma — yalnızca sadaka doğrulayıcısı geçerli.
    input.required = false;
    input.removeAttribute('required');
  }

  function clearSadakaInputErrors(input) {
    if (!input) {
      return;
    }
    if (typeof formFeedback.clearInputError === 'function') {
      formFeedback.clearInputError(input);
      return;
    }
    input.classList.remove('wdp-error');
    input.removeAttribute('aria-invalid');
    const described = input.getAttribute('aria-describedby');
    if (described && described.indexOf('wdp-field-err-') === 0) {
      input.removeAttribute('aria-describedby');
    }
    const anchor = getInputErrorAnchor(input) || input.parentNode;
    const err = anchor && anchor.querySelector('.wdp-input-error');
    if (err) {
      err.remove();
    }
  }

  function resetSadakaPanel(wrap) {
    if (!wrap) {
      return;
    }
    const input = getSadakaInput(wrap);
    syncSadakaInputRequired(wrap);
    if (input && !input.readOnly) {
      input.value = '';
    }
    if (input) {
      clearSadakaInputErrors(input);
    }
  }

  /** Açık sadaka panelinde tutar geçerliliğini kontrol eder. */
  function validateSadakaDonation(form) {
    const wrap = form ? form.querySelector('[data-wdp-sadaka-donation]') : null;
    if (!wrap || !wrap.classList.contains('is-open')) {
      return true;
    }
    syncSadakaInputRequired(wrap);
    const input = getSadakaInput(wrap);
    const fixedAmount = getSadakaFixedAmount(wrap);
    const minAttr = input ? input.getAttribute('min') : '';
    const minValue = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : 0;
    const raw = input ? String(input.value || '').trim() : '';

    const result = typeof sadakaRules.validateAmount === 'function'
      ? sadakaRules.validateAmount({
          panelOpen: true,
          fixedAmount: fixedAmount,
          raw: raw,
          min: minValue,
        })
      : null;

    if (result) {
      if (result.ok) {
        if (input) {
          clearSadakaInputErrors(input);
        }
        return true;
      }
      if (!input || input.readOnly) {
        return result.reason !== 'empty';
      }
      if (result.reason === 'below_min' && Number.isFinite(result.min)) {
        showInputError(input, getSadakaMinErrorMessage(result.min));
      } else {
        showInputError(input, getSadakaInvalidMessage());
      }
      return false;
    }

    // Fallback (rules henüz yoksa)
    if (Number.isFinite(fixedAmount)) {
      if (input) clearSadakaInputErrors(input);
      return true;
    }
    if (!input) {
      return true;
    }
    if (raw === '') {
      if (input.readOnly) {
        return true;
      }
      showInputError(input, getSadakaInvalidMessage());
      return false;
    }
    const numericValue = parseNormalizedAmount(raw);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      showInputError(input, getSadakaInvalidMessage());
      return false;
    }
    if (Number.isFinite(minValue) && minValue > 0 && numericValue + 0.0001 < minValue) {
      showInputError(input, getSadakaMinErrorMessage(minValue));
      return false;
    }
    clearSadakaInputErrors(input);
    return true;
  }

  /** Sadaka alanlarını FormData'ya yazar; kapalıysa anahtarları temizler. */
  function patchSadakaFormData(form, formData) {
    if (!form || !formData) {
      return;
    }
    const wrap = form.querySelector('[data-wdp-sadaka-donation]');
    const hasMainCustomPrice = !!form.querySelector(
      '.wdp-custom-price-row:not(.wdp-sadaka-donation__amount) input[name="custom_price"], input[name="custom_price"]:not(.wdp-sadaka-custom-price-input)'
    );
    if (wrap && wrap.classList.contains('is-open')) {
      const fixedAmount = getSadakaFixedAmount(wrap);
      const sadakaInput = getSadakaInput(wrap);
      const sadakaRaw = sadakaInput ? String(sadakaInput.value || '').trim() : '';
      if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
        formData.set('sadaka_donation_active', '1');
        formData.set('sadaka_custom_price', String(fixedAmount));
      } else if (sadakaRaw !== '') {
        const parsed = parseNormalizedAmount(sadakaRaw);
        formData.set('sadaka_donation_active', '1');
        formData.set(
          'sadaka_custom_price',
          Number.isFinite(parsed) && parsed > 0 ? String(parsed) : sadakaRaw
        );
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

  function toggleSadakaDonationPanel(wrap) {
    if (!wrap) {
      return;
    }
    const toggle = wrap.querySelector('.wdp-sadaka-donation__toggle');
    const panel = wrap.querySelector('.wdp-sadaka-donation__panel');
    const input = getSadakaInput(wrap);
    if (!toggle || !panel) {
      return;
    }

    const open = wrap.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    syncSadakaInputRequired(wrap);
    if (open) {
      panel.removeAttribute('hidden');
      if (input) {
        const fixedAmount = getSadakaFixedAmount(wrap);
        if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
          input.value = String(fixedAmount);
        }
        clearSadakaInputErrors(input);
      }
    } else {
      panel.setAttribute('hidden', '');
      resetSadakaPanel(wrap);
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

    function onSadakaEdit(e) {
      const input = e.target;
      if (!input || !input.matches || !input.matches('input[name="sadaka_custom_price"]')) {
        return;
      }
      clearSadakaInputErrors(input);
      const wrap = input.closest('[data-wdp-sadaka-donation]');
      if (!wrap || !wrap.classList.contains('is-open')) {
        return;
      }
      // Geçerli tutarda hata kalmasın; geçersizken yazarken mesaj basma.
      const minAttr = input.getAttribute('min');
      const minValue = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : 0;
      const result = typeof sadakaRules.validateAmount === 'function'
        ? sadakaRules.validateAmount({
            panelOpen: true,
            fixedAmount: getSadakaFixedAmount(wrap),
            raw: String(input.value || '').trim(),
            min: minValue,
          })
        : null;
      if (result && result.ok) {
        clearSadakaInputErrors(input);
      }
    }

    document.addEventListener('input', onSadakaEdit);
    document.addEventListener('change', onSadakaEdit);
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
    syncSadakaInputRequired(wrap);
    if (panel && !wrap.classList.contains('is-open')) {
      panel.setAttribute('hidden', '');
      resetSadakaPanel(wrap);
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', wrap.classList.contains('is-open') ? 'true' : 'false');
    }
    const fixedInput = getSadakaInput(wrap);
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
    clearSadakaInputErrors: clearSadakaInputErrors,
    resetSadakaPanel: resetSadakaPanel,
  };
})(window);
