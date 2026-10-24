/**
 * @file addon.js
 * Addon alt bağış satırı ekleme, seçim ve fiyat senkronu.
 * Dış API: WDPApp.formAddon
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const formMessages = WDPApp.formMessages || {};
  const formPricing = WDPApp.formPricing || {};
  const formFeedback = WDPApp.formFeedback || {};
  const addonRules = WDPApp.addonRules || {};
  const formatCurrency = typeof utils.formatCurrency === 'function' ? utils.formatCurrency : function(v) { return String(v); };
  const parseNormalizedAmount = typeof addonRules.parseAmount === 'function'
    ? addonRules.parseAmount
    : (typeof formPricing.parseNormalizedAmount === 'function'
      ? formPricing.parseNormalizedAmount
      : function() { return NaN; });
  const showInputError = typeof formFeedback.showInputError === 'function'
    ? formFeedback.showInputError
    : function() {};
  const getInputErrorAnchor = typeof formFeedback.getInputErrorAnchor === 'function'
    ? formFeedback.getInputErrorAnchor
    : function(input) { return input && input.parentNode; };

  let addonDonationDelegationBound = false;

  function getAddonInvalidMessage() {
    if (typeof formMessages.getAddonInvalidMessage === 'function') {
      return formMessages.getAddonInvalidMessage();
    }
    return WDPApp.i18n.__('Please enter a valid additional donation amount.', 'woo-donation-popup');
  }

  function getAddonMinErrorMessage(minValue) {
    if (typeof formMessages.getAddonMinErrorMessage === 'function') {
      return formMessages.getAddonMinErrorMessage(minValue);
    }
    return WDPApp.i18n.sprintf(
      WDPApp.i18n.__('Please enter at least %s.', 'woo-donation-popup'),
      formatCurrency(minValue)
    );
  }

  function getAddonFixedAmount(wrap) {
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

  function getAddonInput(wrap) {
    return wrap ? wrap.querySelector('input[name="sadaka_custom_price"]') : null;
  }

  function syncAddonInputRequired(wrap) {
    const input = getAddonInput(wrap);
    if (!input) {
      return;
    }
    // HTML5 required kullanma — yalnızca addon doğrulayıcısı geçerli.
    input.required = false;
    input.removeAttribute('required');
  }

  function clearAddonInputErrors(input) {
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

  function resetAddonPanel(wrap) {
    if (!wrap) {
      return;
    }
    const input = getAddonInput(wrap);
    syncAddonInputRequired(wrap);
    if (input && !input.readOnly) {
      input.value = '';
    }
    if (input) {
      clearAddonInputErrors(input);
    }
  }

  /** Açık addon panelinde tutar geçerliliğini kontrol eder. */
  function validateAddonDonation(form) {
    const wrap = form ? form.querySelector('[data-wdp-sadaka-donation]') : null;
    if (!wrap || !wrap.classList.contains('is-open')) {
      return true;
    }
    syncAddonInputRequired(wrap);
    const input = getAddonInput(wrap);
    const fixedAmount = getAddonFixedAmount(wrap);
    const minAttr = input ? input.getAttribute('min') : '';
    const minValue = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : 0;
    const raw = input ? String(input.value || '').trim() : '';

    const result = typeof addonRules.validateAmount === 'function'
      ? addonRules.validateAmount({
          panelOpen: true,
          fixedAmount: fixedAmount,
          raw: raw,
          min: minValue,
        })
      : null;

    if (result) {
      if (result.ok) {
        if (input) {
          clearAddonInputErrors(input);
        }
        return true;
      }
      if (!input || input.readOnly) {
        return result.reason !== 'empty';
      }
      if (result.reason === 'below_min' && Number.isFinite(result.min)) {
        showInputError(input, getAddonMinErrorMessage(result.min));
      } else {
        showInputError(input, getAddonInvalidMessage());
      }
      return false;
    }

    // Fallback (rules henüz yoksa)
    if (Number.isFinite(fixedAmount)) {
      if (input) clearAddonInputErrors(input);
      return true;
    }
    if (!input) {
      return true;
    }
    if (raw === '') {
      if (input.readOnly) {
        return true;
      }
      showInputError(input, getAddonInvalidMessage());
      return false;
    }
    const numericValue = parseNormalizedAmount(raw);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      showInputError(input, getAddonInvalidMessage());
      return false;
    }
    if (Number.isFinite(minValue) && minValue > 0 && numericValue + 0.0001 < minValue) {
      showInputError(input, getAddonMinErrorMessage(minValue));
      return false;
    }
    clearAddonInputErrors(input);
    return true;
  }

  /** Addon alanlarını FormData'ya yazar; kapalıysa anahtarları temizler. */
  function patchAddonFormData(form, formData) {
    if (!form || !formData) {
      return;
    }
    const wrap = form.querySelector('[data-wdp-sadaka-donation]');
    const hasMainCustomPrice = !!form.querySelector(
      '.wdp-custom-price-row:not(.wdp-sadaka-donation__amount) input[name="custom_price"], input[name="custom_price"]:not(.wdp-addon-custom-price-input)'
    );
    if (wrap && wrap.classList.contains('is-open')) {
      const fixedAmount = getAddonFixedAmount(wrap);
      const addonInput = getAddonInput(wrap);
      const addonRaw = addonInput ? String(addonInput.value || '').trim() : '';
      if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
        formData.set('sadaka_donation_active', '1');
        formData.set('sadaka_custom_price', String(fixedAmount));
      } else if (addonRaw !== '') {
        const parsed = parseNormalizedAmount(addonRaw);
        formData.set('sadaka_donation_active', '1');
        formData.set(
          'sadaka_custom_price',
          Number.isFinite(parsed) && parsed > 0 ? String(parsed) : addonRaw
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

  function toggleAddonDonationPanel(wrap) {
    if (!wrap) {
      return;
    }
    const toggle = wrap.querySelector('.wdp-sadaka-donation__toggle');
    const panel = wrap.querySelector('.wdp-sadaka-donation__panel');
    const input = getAddonInput(wrap);
    if (!toggle || !panel) {
      return;
    }

    const open = wrap.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    syncAddonInputRequired(wrap);
    if (open) {
      panel.removeAttribute('hidden');
      if (input) {
        const fixedAmount = getAddonFixedAmount(wrap);
        if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
          input.value = String(fixedAmount);
        }
        clearAddonInputErrors(input);
      }
    } else {
      panel.setAttribute('hidden', '');
      resetAddonPanel(wrap);
    }
  }

  function ensureAddonDonationDelegation() {
    if (addonDonationDelegationBound) {
      return;
    }
    addonDonationDelegationBound = true;

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
      toggleAddonDonationPanel(wrap);
    });

    function onAddonEdit(e) {
      const input = e.target;
      if (!input || !input.matches || !input.matches('input[name="sadaka_custom_price"]')) {
        return;
      }
      clearAddonInputErrors(input);
      const wrap = input.closest('[data-wdp-sadaka-donation]');
      if (!wrap || !wrap.classList.contains('is-open')) {
        return;
      }
      // Geçerli tutarda hata kalmasın; geçersizken yazarken mesaj basma.
      const minAttr = input.getAttribute('min');
      const minValue = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : 0;
      const result = typeof addonRules.validateAmount === 'function'
        ? addonRules.validateAmount({
            panelOpen: true,
            fixedAmount: getAddonFixedAmount(wrap),
            raw: String(input.value || '').trim(),
            min: minValue,
          })
        : null;
      if (result && result.ok) {
        clearAddonInputErrors(input);
      }
    }

    document.addEventListener('input', onAddonEdit);
    document.addEventListener('change', onAddonEdit);
  }

  function bindAddonDonation(form) {
    ensureAddonDonationDelegation();
    if (!form) {
      return;
    }
    const wrap = form.querySelector('[data-wdp-sadaka-donation]');
    if (!wrap) {
      return;
    }
    const panel = wrap.querySelector('.wdp-sadaka-donation__panel');
    const toggle = wrap.querySelector('.wdp-sadaka-donation__toggle');
    syncAddonInputRequired(wrap);
    if (panel && !wrap.classList.contains('is-open')) {
      panel.setAttribute('hidden', '');
      resetAddonPanel(wrap);
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', wrap.classList.contains('is-open') ? 'true' : 'false');
    }
    const fixedInput = getAddonInput(wrap);
    const fixedAmount = getAddonFixedAmount(wrap);
    if (fixedInput && Number.isFinite(fixedAmount) && fixedAmount > 0) {
      fixedInput.value = String(fixedAmount);
    }
  }

  ensureAddonDonationDelegation();

  WDPApp.formAddon = {
    validateAddonDonation: validateAddonDonation,
    patchAddonFormData: patchAddonFormData,
    bindAddonDonation: bindAddonDonation,
    ensureAddonDonationDelegation: ensureAddonDonationDelegation,
    clearAddonInputErrors: clearAddonInputErrors,
    resetAddonPanel: resetAddonPanel,
  };
})(window);
