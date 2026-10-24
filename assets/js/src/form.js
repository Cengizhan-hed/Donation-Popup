/**
 * @file form.js
 * Bağış formu orkestrasyonu: doğrulama, alan yönetimi ve gönderim akışı.
 * Dış API: WDPApp.form
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  if (!WDPApp.i18n || typeof WDPApp.i18n.__ !== 'function') {
    WDPApp.i18n = {
      __: function (msg) { return msg == null ? '' : String(msg); },
      _x: function (msg) { return msg == null ? '' : String(msg); },
      sprintf: function (fmt) { return String(fmt == null ? '' : fmt); },
    };
  }

  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'safeLog', 'refreshWdpAjaxNonces'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const { formatCurrency, safeLog, debounce, refreshWdpAjaxNonces } = utils;
  // Shared copy/validation helper module for integrations and maintainability.
  const formMessages = WDPApp.formMessages || {};

  const formPricing = WDPApp.formPricing || {};
  const formFeedback = WDPApp.formFeedback || {};
  const formSadaka = WDPApp.formSadaka || {};
  const formAjax = WDPApp.formAjax || {};

  const WDP_FORM_SUBMIT_CAPTURE = true;

  function showShareholderValidationFeedback(form, summaryLines, fallbackMessage) {
    if (typeof formFeedback.showShareholderValidationFeedback === 'function') {
      formFeedback.showShareholderValidationFeedback(form, summaryLines, fallbackMessage);
    }
  }

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

  function validateSadakaDonation(form) {
    return typeof formSadaka.validateSadakaDonation === 'function'
      ? formSadaka.validateSadakaDonation(form)
      : true;
  }

  function patchSadakaFormData(form, formData) {
    if (typeof formSadaka.patchSadakaFormData === 'function') {
      formSadaka.patchSadakaFormData(form, formData);
    }
  }

  function bindSadakaDonation(form) {
    if (typeof formSadaka.bindSadakaDonation === 'function') {
      formSadaka.bindSadakaDonation(form);
    }
  }

  function parseNormalizedAmount(raw) {
    return typeof formPricing.parseNormalizedAmount === 'function'
      ? formPricing.parseNormalizedAmount(raw)
      : NaN;
  }

  function roundMoney(n) {
    return typeof formPricing.roundMoney === 'function' ? formPricing.roundMoney(n) : n;
  }

  function formatPriceInputValue(n) {
    return typeof formPricing.formatPriceInputValue === 'function'
      ? formPricing.formatPriceInputValue(n)
      : '';
  }

  function formatSubmitUnitPrice(unit) {
    return typeof formPricing.formatSubmitUnitPrice === 'function'
      ? formPricing.formatSubmitUnitPrice(unit)
      : '';
  }

  function getCustomPriceRow(form) {
    return typeof formPricing.getCustomPriceRow === 'function' ? formPricing.getCustomPriceRow(form) : null;
  }

  function customPriceRowHasQtyCounter(row) {
    return typeof formPricing.customPriceRowHasQtyCounter === 'function'
      ? formPricing.customPriceRowHasQtyCounter(row)
      : false;
  }

  function ensureCustomUnitFromDisplayed(customIn, qty) {
    return typeof formPricing.ensureCustomUnitFromDisplayed === 'function'
      ? formPricing.ensureCustomUnitFromDisplayed(customIn, qty)
      : NaN;
  }

  function updateLineTotals(form) {
    if (typeof formPricing.updateLineTotals === 'function') {
      formPricing.updateLineTotals(form);
    }
  }

  function bindProductQuantityDelegation(form) {
    if (typeof formPricing.bindProductQuantityDelegation === 'function') {
      formPricing.bindProductQuantityDelegation(form);
    }
  }

  function bindAmountPresets(form) {
    if (typeof formPricing.bindAmountPresets === 'function') {
      formPricing.bindAmountPresets(form);
    }
  }

  function bindCoverFeeTotal(form) {
    if (typeof formPricing.bindCoverFeeTotal === 'function') {
      formPricing.bindCoverFeeTotal(form);
    }
  }

  function clearAmountSelection(form) {
    if (typeof formPricing.clearAmountSelection === 'function') {
      formPricing.clearAmountSelection(form);
    }
  }

  function bindDonationSummary(form) {
    if (typeof formPricing.bindDonationSummary === 'function') {
      formPricing.bindDonationSummary(form);
    }
  }

  /**
   * Enter / iOS «Git»: sonraki alan, sihirbaz adımı veya eklenti gönderimi.
   * Yerel form gönderimi yok — preventDefault her zaman (textarea hariç).
   */
  function invokeEnterSubmit(form, submitter) {
    const cta = WDPApp.formCtaReady;
    if (cta && typeof cta.invokePluginSubmit === 'function') {
      cta.invokePluginSubmit(form, submitter || null);
      return;
    }
    if (typeof form._wdpSubmitHandler === 'function') {
      if (submitter) {
        form._wdpLastClickSubmitter = submitter;
      }
      form._wdpSubmitHandler({
        type: 'submit',
        target: form,
        currentTarget: form,
        submitter: submitter || form._wdpLastClickSubmitter || null,
        defaultPrevented: true,
        preventDefault: function preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation: function stopPropagation() {},
        stopImmediatePropagation: function stopImmediatePropagation() {},
      });
    }
  }

  function bindSmartKeyboard(form) {
    if (!form || form.dataset.wdpSmartKeyboard === '1') {
      return;
    }
    form.dataset.wdpSmartKeyboard = '1';
    form.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      const el = e.target;
      if (!el || !form.contains(el)) return;
      if (el.tagName === 'TEXTAREA') return;
      if (el.closest && el.closest('.wdp-phone-country-panel')) return;
      e.preventDefault();
      if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button'))) {
        if (el.name === 'donation_add_to_cart' || el.name === 'donation_go_checkout') {
          invokeEnterSubmit(form, el);
        }
        return;
      }
      const fields = Array.prototype.slice.call(
        form.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')
      ).filter(function(node) {
        if (node.closest && node.closest('[hidden]')) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      const idx = fields.indexOf(el);
      if (idx > -1 && idx < fields.length - 1) {
        fields[idx + 1].focus();
        return;
      }
      const wizard = form._wdpWizard;
      if (wizard && wizard.index < wizard.steps.length - 1 && wizard.nextBtn && !wizard.nextBtn.hidden) {
        wizard.nextBtn.click();
        return;
      }
      const primary = form.querySelector('button[name="donation_go_checkout"], button[name="donation_add_to_cart"]');
      invokeEnterSubmit(form, primary);
    });
  }

  function patchSimpleCustomPriceQtyRowFormData(form, formData) {
    if (typeof formPricing.patchSimpleCustomPriceQtyRowFormData === 'function') {
      formPricing.patchSimpleCustomPriceQtyRowFormData(form, formData);
    }
  }

  function isFormProcessing(form) {
    return typeof formFeedback.isFormProcessing === 'function'
      ? formFeedback.isFormProcessing(form)
      : false;
  }

  function setFormProcessing(form, processing) {
    if (typeof formFeedback.setFormProcessing === 'function') {
      formFeedback.setFormProcessing(form, processing);
    }
  }

  function showInputError(input, message) {
    if (typeof formFeedback.showInputError === 'function') {
      formFeedback.showInputError(input, message);
    }
  }

  function showFormError(form, message) {
    if (typeof formFeedback.showFormError === 'function') {
      formFeedback.showFormError(form, message);
    }
  }

  function ensureVisibleValidationFeedback(form, errorMessages) {
    if (typeof formFeedback.ensureVisibleValidationFeedback === 'function') {
      formFeedback.ensureVisibleValidationFeedback(form, errorMessages);
    }
  }

  function submitFormData(form, isCheckout) {
    if (typeof formAjax.submitFormData === 'function') {
      formAjax.submitFormData(form, isCheckout);
    }
  }

  function handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn) {
    if (typeof formAjax.handleAjaxResponse === 'function') {
      formAjax.handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
    }
  }

  function handleAjaxError(error, form, addToCartBtn, checkoutBtn) {
    if (typeof formAjax.handleAjaxError === 'function') {
      formAjax.handleAjaxError(error, form, addToCartBtn, checkoutBtn);
    }
  }

  function directFormSubmit(form, isCheckout) {
    return typeof formAjax.directFormSubmit === 'function'
      ? formAjax.directFormSubmit(form, isCheckout)
      : false;
  }



  /** Tarayıcı native doğrulamasını kapatır; kapalı hissedar alanlarını geçici olarak zorunlu olmaktan çıkarır. */
  function prepareDonationFormValidation(form) {
    if (!form) {
      return;
    }
    form.setAttribute('novalidate', 'novalidate');
    form.noValidate = true;
    form.querySelectorAll('.wdp-shareholder-form.collapsed input, .wdp-shareholder-form.collapsed textarea, .wdp-shareholder-form.collapsed select').forEach((field) => {
      if (field.dataset.wdpCollapsedNativeOff === '1') {
        return;
      }
      field.dataset.wdpCollapsedNativeOff = '1';
      if (field.required) {
        field.dataset.wdpHadRequired = '1';
        field.required = false;
      }
    });
  }

  /** Gönderim sonrası kapalı hissedar alanlarındaki required bayraklarını geri yükler. */
  function restoreDonationFormValidation(form) {
    if (!form) {
      return;
    }
    form.querySelectorAll('.wdp-shareholder-form.collapsed [data-wdp-collapsed-native-off="1"]').forEach((field) => {
      if (field.dataset.wdpHadRequired === '1') {
        field.required = true;
        delete field.dataset.wdpHadRequired;
      }
      delete field.dataset.wdpCollapsedNativeOff;
    });
  }

  /** Hangi submit butonuna basıldığını (Sepete Ekle / Ödemeye Git) çözer. */
  function resolveSubmitSubmitter(form, event) {
    if (event && event.submitter) {
      return event.submitter;
    }
    if (form && form._wdpLastClickSubmitter) {
      return form._wdpLastClickSubmitter;
    }
    return null;
  }


  const formValidate = WDPApp.formValidate || {};

  function getDonorNameRequiredMessage() {
    return typeof formValidate.getDonorNameRequiredMessage === 'function'
      ? formValidate.getDonorNameRequiredMessage()
      : (typeof formMessages.getDonorNameRequiredMessage === 'function'
        ? formMessages.getDonorNameRequiredMessage()
        : WDPApp.i18n.__('Full name is required.', 'woo-donation-popup'));
  }

  function getShareholderNameRequiredMessage() {
    return typeof formValidate.getShareholderNameRequiredMessage === 'function'
      ? formValidate.getShareholderNameRequiredMessage()
      : (typeof formMessages.getShareholderNameRequiredMessage === 'function'
        ? formMessages.getShareholderNameRequiredMessage()
        : WDPApp.i18n.__('Shareholder name is required.', 'woo-donation-popup'));
  }

  function getRequiredFieldMessage(field) {
    return typeof formValidate.getRequiredFieldMessage === 'function'
      ? formValidate.getRequiredFieldMessage(field)
      : (typeof formMessages.getRequiredFieldMessage === 'function'
        ? formMessages.getRequiredFieldMessage(field)
        : WDPApp.i18n.__('This field is required', 'woo-donation-popup'));
  }

  function getPhoneValidationState(input, options) {
    return typeof formValidate.getPhoneValidationState === 'function'
      ? formValidate.getPhoneValidationState(input, options)
      : (typeof formMessages.getPhoneValidationState === 'function'
        ? formMessages.getPhoneValidationState(input, options)
        : { ok: true, message: '' });
  }

  function validateAllPhoneFields(form, options) {
    return typeof formValidate.validateAllPhoneFields === 'function'
      ? formValidate.validateAllPhoneFields(form, options)
      : true;
  }

  function getEffectiveShareCount(form) {
    return typeof formValidate.getEffectiveShareCount === 'function'
      ? formValidate.getEffectiveShareCount(form)
      : 1;
  }

  function ensureShareholderRowsReady(form) {
    return typeof formValidate.ensureShareholderRowsReady === 'function'
      ? formValidate.ensureShareholderRowsReady(form)
      : undefined;
  }

  function validateForm(form) {
    return typeof formValidate.validateForm === 'function'
      ? formValidate.validateForm(form)
      : true;
  }

  function focusFirstInvalidField(form) {
    if (typeof formValidate.focusFirstInvalidField === 'function') {
      formValidate.focusFirstInvalidField(form);
    }
  }

  function clearInlineInputError(input) {
    if (!input) return;
    input.classList.remove("wdp-error");
    const inputError = input.parentNode ? input.parentNode.querySelector(".wdp-input-error") : null;
    if (inputError) {
      inputError.remove();
    }
  }

  function applyMinPriceError(input, minPrice, messageBuilder) {
    if (!input) return;
    const currentValue = Number.parseFloat(input.value || 0);
    if (input.value !== "" && minPrice > 0 && currentValue < minPrice) {
      input.classList.add("wdp-error");
      const existingError = input.parentNode ? input.parentNode.querySelector(".wdp-input-error") : null;
      if (existingError) {
        existingError.remove();
      }
      const inputError = document.createElement("div");
      inputError.className = "wdp-input-error";
      inputError.textContent = messageBuilder(minPrice);
      const parentField = input.closest(".wdp-price-field") || input.parentNode;
      if (parentField) {
        const computedStyle = window.getComputedStyle(parentField);
        if (computedStyle.position === "static") {
          parentField.style.position = "relative";
        }
        parentField.appendChild(inputError);
      }
      return;
    }
    clearInlineInputError(input);
  }

  function createMinPriceBlurHandler(messageBuilder) {
    return function() {
      const minPrice = Number.parseFloat(this.getAttribute("min") || 0);
      applyMinPriceError(this, minPrice, messageBuilder);
    };
  }

  /**
   * Sunucu validation_error yanıtındaki alan anahtarlarını (ör. donation_phone) satır içi hataya çevirir.
   */
  function applyAjaxValidationFieldErrors(form, data, fallbackMessage) {
    const keys = data && Array.isArray(data.errors) ? data.errors : [];
    if (!keys.length) {
      return false;
    }
    let count = 0;
    let firstShareholderRowIndex = 0;
    const fb = typeof fallbackMessage === "string" && fallbackMessage.trim() ? fallbackMessage.trim() : "";

    keys.forEach((key) => {
      if (typeof key !== "string" || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        return;
      }
      let el = null;
      try {
        if (typeof CSS !== "undefined" && CSS.escape) {
          el = form.querySelector('[name="' + CSS.escape(key) + '"]');
        }
      } catch (eCss) {
        el = null;
      }
      if (!el) {
        el = form.querySelector('input[name="' + key + '"], textarea[name="' + key + '"]');
      }
      if (!el) {
        return;
      }

      let msg = fb;
      if (key === "donation_phone" || /^shareholder_phone_\d+$/.test(key)) {
        if (!firstShareholderRowIndex) {
          const m = /^shareholder_phone_(\d+)$/.exec(key);
          firstShareholderRowIndex = m ? Number.parseInt(m[1], 10) || 0 : firstShareholderRowIndex;
        }
        msg =
          (typeof formMessages.getPhoneIncompleteMessage === "function"
            ? formMessages.getPhoneIncompleteMessage()
            : null) ||
          (typeof fb === "string" && fb.trim() ? fb.trim() : null) ||
          WDPApp.i18n.__('Please enter your complete phone number.', 'woo-donation-popup');
        showInputError(el, msg);
        count += 1;
        return;
      } else if (key === "donation_full_name") {
        msg = getDonorNameRequiredMessage();
      } else if (/^shareholder_name_\d+$/.test(key)) {
        const m = /^shareholder_name_(\d+)$/.exec(key);
        if (!firstShareholderRowIndex) {
          firstShareholderRowIndex = m ? Number.parseInt(m[1], 10) || 0 : firstShareholderRowIndex;
        }
        msg = m ? m[1] + ". " + getShareholderNameRequiredMessage() : getShareholderNameRequiredMessage();
      } else if (key === "custom_price") {
        msg = WDPApp.i18n.__('Please enter a donation amount.', 'woo-donation-popup');
      } else if (key === "sadaka_custom_price") {
        // Sunucu mesajını koru; genel "Bu alan zorunludur" ile ezme.
        msg =
          fb ||
          (typeof formMessages.getSadakaInvalidMessage === "function"
            ? formMessages.getSadakaInvalidMessage()
            : null) ||
          WDPApp.i18n.__('Please enter a valid additional donation amount.', 'woo-donation-popup');
      } else {
        msg = fb || getRequiredFieldMessage(el) || WDPApp.i18n.__('This field is required.', 'woo-donation-popup');
      }

      showInputError(el, msg);
      count += 1;
    });

    if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      WDPApp.shareholder.setValidationArmed(form, firstShareholderRowIndex > 0, firstShareholderRowIndex);
    } else if (count > 0 && WDPApp.shareholder && typeof WDPApp.shareholder.refreshGuidance === "function") {
      WDPApp.shareholder.refreshGuidance(form);
    }
    return count > 0;
  }


  /**
   * Form gönderim dinleyicisini, doğrulama ve AJAX akışını bağlar.
   */
  function setupFormSubmission(form) {
    safeLog("Form submission setup for:", form);

    prepareDonationFormValidation(form);
    bindProductQuantityDelegation(form);
    bindAmountPresets(form);
    bindCoverFeeTotal(form);
    bindDonationSummary(form);
    bindSadakaDonation(form);
    bindSmartKeyboard(form);
    if (WDPApp.formWizard && typeof WDPApp.formWizard.setup === 'function') {
      WDPApp.formWizard.setup(form);
    }

    // Önceki dinleyiciyi kaldır (event-manager veya tekrar setup çağrıları çift AJAX üretmesin)
    if (form._wdpSubmitHandler) {
      form.removeEventListener("submit", form._wdpSubmitHandler, WDP_FORM_SUBMIT_CAPTURE);
      form._wdpSubmitHandler = null;
    }

    function onWdpFormSubmit(e) {
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
      if (e && typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      try {
      safeLog("Form submitted");

      prepareDonationFormValidation(form);

      const submitter = resolveSubmitSubmitter(form, e);
      const isCheckout = submitter && submitter.name === "donation_go_checkout";
      safeLog("Is checkout:", isCheckout);

      let validationPassed = false;
      try {
        // Rendered shareholder rows are source-of-truth; sync share_count before validation.
        ensureShareholderRowsReady(form);
        getEffectiveShareCount(form);
        validationPassed = validateForm(form);
      } catch (validationError) {
        safeLog("validateForm threw:", validationError);
        validationPassed = false;
        let fallback = WDPApp.i18n.__('Please check the highlighted fields.', 'woo-donation-popup');
        if (WDPApp.formFeedback && typeof WDPApp.formFeedback.collectVisibleFieldErrorMessages === 'function') {
          const collected = WDPApp.formFeedback.collectVisibleFieldErrorMessages(form);
          if (collected && collected.length) {
            fallback = collected[0];
          }
        }
        // Never surface raw ReferenceError / TypeError text to donors.
        const rawMsg =
          validationError && typeof validationError.message === 'string'
            ? validationError.message.trim()
            : '';
        const isTechnical =
          !rawMsg ||
          /is not defined|is not a function|Cannot read|undefined/i.test(rawMsg) ||
          (validationError &&
            (validationError.name === 'ReferenceError' || validationError.name === 'TypeError'));
        if (!isTechnical && rawMsg && fallback === WDPApp.i18n.__('Please check the highlighted fields.', 'woo-donation-popup')) {
          fallback = rawMsg;
        }
        showShareholderValidationFeedback(form, [], fallback);
        if (WDPApp.form) {
          WDPApp.form.lastValidation = {
            ok: false,
            failures: [{ field: '', rule: 'exception', value: isTechnical ? 'technical' : rawMsg }],
          };
        }
      } finally {
        restoreDonationFormValidation(form);
      }

      if (!validationPassed) {
        safeLog("Form validation failed");
        return false;
      }

      // Eğer işlem zaten devam ediyorsa, yeni bir istek gönderme
      if (isFormProcessing(form)) {
        safeLog("Processing already in progress");
        return false;
      }

      // İşlem başladığını işaretle
      setFormProcessing(form, true);

      // Butonları bul
      const addToCartBtn = form.querySelector('button[name="donation_add_to_cart"]');
      const checkoutBtn = form.querySelector('button[name="donation_go_checkout"]');

      // Tüm butonları devre dışı bırak
      if (addToCartBtn) addToCartBtn.disabled = true;
      if (checkoutBtn) checkoutBtn.disabled = true;

      // Sadece tıklanan butona yükleniyor durumu ekle
      if (isCheckout && checkoutBtn) {
        checkoutBtn.classList.add("wdp-loading", "is-cta-press");
        // Diğer butona loading sınıfı eklenmediğinden emin ol
        if (addToCartBtn) addToCartBtn.classList.remove("wdp-loading");
      } else if (addToCartBtn) {
        addToCartBtn.classList.add("wdp-loading", "is-cta-press");
        // Diğer butona loading sınıfı eklenmediğinden emin ol
        if (checkoutBtn) checkoutBtn.classList.remove("wdp-loading");
      }

      // Benzersiz bir anahtar oluştur
      const uniqueKey = Date.now() + "-" + Math.random().toString(36).substr(2, 9);

      // Form verilerine benzersiz anahtarı ekle
      let uniqueKeyInput = form.querySelector('input[name="unique_submission_key"]');
      if (!uniqueKeyInput) {
        uniqueKeyInput = document.createElement("input");
        uniqueKeyInput.type = "hidden";
        uniqueKeyInput.name = "unique_submission_key";
        form.appendChild(uniqueKeyInput);
      }
      uniqueKeyInput.value = uniqueKey;

      const proceedAjax = () => {
        submitFormData(form, isCheckout);
      };

      // Sayfa uzun süre açık kaldığında (özellikle .wdp-donation-form) nonce / oturum güncelle, sonra gönder
      if (refreshWdpAjaxNonces && typeof refreshWdpAjaxNonces === "function") {
        refreshWdpAjaxNonces()
          .then(() => proceedAjax())
          .catch(() => proceedAjax());
      } else {
        proceedAjax();
      }
      } catch (submitError) {
        safeLog("Form submit handler threw:", submitError);
        setFormProcessing(form, false);
        const addToCartBtn = form.querySelector('button[name="donation_add_to_cart"]');
        const checkoutBtn = form.querySelector('button[name="donation_go_checkout"]');
        if (addToCartBtn) {
          addToCartBtn.disabled = false;
          addToCartBtn.classList.remove("wdp-loading");
        }
        if (checkoutBtn) {
          checkoutBtn.disabled = false;
          checkoutBtn.classList.remove("wdp-loading");
        }
        showFormError(form, WDPApp.i18n.__('The action could not be completed. Please try again.', 'woo-donation-popup'));
        return false;
      }
    }

    form._wdpSubmitHandler = onWdpFormSubmit;
    form.addEventListener("submit", form._wdpSubmitHandler, WDP_FORM_SUBMIT_CAPTURE);

    if (WDPApp.formCtaReady && typeof WDPApp.formCtaReady.markFormReady === "function") {
      WDPApp.formCtaReady.markFormReady(form);
      if (typeof WDPApp.formCtaReady.flushQueuedCta === "function") {
        WDPApp.formCtaReady.flushQueuedCta(form);
      }
    }

    form.querySelectorAll('button[name="donation_add_to_cart"], button[name="donation_go_checkout"]').forEach((btn) => {
      if (btn.dataset.wdpActionClickBound === '1') {
        return;
      }
      btn.dataset.wdpActionClickBound = '1';
      btn.addEventListener(
        'click',
        function trackSubmitButtonClick() {
          form._wdpLastClickSubmitter = btn;
        },
        true
      );
    });

    // Input alanlarına olay dinleyicileri ekle
    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"], input[inputmode="decimal"]').forEach((input) => {
      if (input.dataset.wdpBaseInputBound !== '1') {
        input.dataset.wdpBaseInputBound = '1';
        input.addEventListener("focus", function () {
          this.classList.remove("wdp-error");
          // Eğer tüm zorunlu alanlar doluysa hata mesajını gizle
          const errorMsg = form.querySelector(".wdp-form-error");
          if (errorMsg) {
            errorMsg.style.display = "none";
          }
          // Eğer fiyat uyarısı varsa onu da gizle
          if (this.name === "custom_price") {
            const priceField = this.closest(".wdp-price-field");
            if (priceField) {
              const minWarn = priceField.querySelector(".wdp-price-warning");
              if (minWarn) minWarn.style.display = "none";
            }
          }
        });
      }

      if ((input.name === "custom_price" || input.name === "sadaka_custom_price") && input.dataset.wdpAmountPasteBound !== '1') {
        input.dataset.wdpAmountPasteBound = '1';
        input.addEventListener("paste", function onAmountPaste(event) {
          const clip = event.clipboardData || window.clipboardData;
          if (!clip) {
            return;
          }
          const text = clip.getData("text");
          if (text == null || String(text).trim() === "") {
            return;
          }
          const u = window.WDPApp && WDPApp.utils ? WDPApp.utils : {};
          if (typeof u.normalizeAmountInput !== "function") {
            return;
          }
          event.preventDefault();
          const normalized = u.normalizeAmountInput(text);
          this.value = normalized;
          this.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }

      // Özel fiyat alanı için minimum değer kontrolü - optimized with debounce
      if (input.name === "custom_price") {
        const customQtyRow = input.closest(".wdp-custom-price-row, .wdp-custom-price-with-qty-row");
        if (customQtyRow && customPriceRowHasQtyCounter(customQtyRow)) {
          if (input.dataset.wdpCustomQtyBound !== '1') {
            input.dataset.wdpCustomQtyBound = '1';
            input.addEventListener("focus", function () {
              this.classList.remove("wdp-error");
              const errorMsg = form.querySelector(".wdp-form-error");
              if (errorMsg) {
                errorMsg.style.display = "none";
              }
              const inputError = this.parentNode.querySelector(".wdp-input-error");
              if (inputError) {
                inputError.remove();
              }
            });
            input.addEventListener("input", function () {
              const row = this.closest(".wdp-custom-price-row, .wdp-custom-price-with-qty-row");
              const qEl = row && row.querySelector('input[name="quantity"]');
              const qty = qEl ? Number.parseInt(qEl.value, 10) || 1 : 1;
              ensureCustomUnitFromDisplayed(this, qty);
            });
          }
          function runCustomQtyRowBlur() {
            const row = this.closest(".wdp-custom-price-row, .wdp-custom-price-with-qty-row");
            const qEl = row && row.querySelector('input[name="quantity"]');
            const qty = qEl ? Number.parseInt(qEl.value, 10) || 1 : 1;
            ensureCustomUnitFromDisplayed(this, qty);
            const minAttr = Number.parseFloat(this.getAttribute("min") || 0);
            const baseMin = Number.parseFloat((this.dataset.baseMin || "").toString().trim());
            const perUnitCandidates = [];
            if (Number.isFinite(minAttr) && minAttr > 0) perUnitCandidates.push(minAttr);
            if (Number.isFinite(baseMin) && baseMin > 0) perUnitCandidates.push(baseMin);
            const perUnitMin = perUnitCandidates.length > 0 ? Math.max.apply(null, perUnitCandidates) : 0;
            const minTotal = perUnitMin > 0 ? perUnitMin * qty : 0;
            const total = parseNormalizedAmount(this.value);
            if (this.value !== "" && minTotal > 0 && Number.isFinite(total) && total + 0.0001 < minTotal) {
              this.classList.add("wdp-error");
              const existingError = this.parentNode.querySelector(".wdp-input-error");
              if (existingError) existingError.remove();
              const inputError = document.createElement("div");
              inputError.className = "wdp-input-error";
              inputError.textContent = WDPApp.i18n.sprintf(
                WDPApp.i18n.__('Please enter at least %s.', 'woo-donation-popup'),
                formatCurrency(minTotal)
              );
              const parentField = this.closest(".wdp-price-field") || this.parentNode;
              if (parentField) {
                const computedStyle = window.getComputedStyle(parentField);
                if (computedStyle.position === "static") {
                  parentField.style.position = "relative";
                }
                parentField.appendChild(inputError);
              }
            } else {
              this.classList.remove("wdp-error");
              const inputError = this.parentNode.querySelector(".wdp-input-error");
              if (inputError) inputError.remove();
            }
          }
          const debouncedBlurQtyRow = debounce ? debounce(runCustomQtyRowBlur, 300) : runCustomQtyRowBlur;
          if (input.dataset.wdpCustomQtyBlurBound !== '1') {
            input.dataset.wdpCustomQtyBlurBound = '1';
            input.addEventListener("blur", debouncedBlurQtyRow);
          }
          return;
        }

        // Progress / diğer tek sütun özel fiyat alanları
        if (input.dataset.wdpCustomPriceFocusBound !== '1') {
          input.dataset.wdpCustomPriceFocusBound = '1';
          input.addEventListener("focus", function () {
            this.classList.remove("wdp-error");
            const errorMsg = form.querySelector(".wdp-form-error");
            if (errorMsg) {
              errorMsg.style.display = "none";
            }
            const inputError = this.parentNode.querySelector('.wdp-input-error');
            if (inputError) {
              inputError.remove();
            }
          });
        }
        
        const blurHandler = createMinPriceBlurHandler((minPrice) => WDPApp.i18n.sprintf(
          WDPApp.i18n.__('Please enter at least %s.', 'woo-donation-popup'),
          formatCurrency(minPrice)
        ));
        const debouncedBlurHandler = debounce ? debounce(blurHandler, 300) : blurHandler;
        
        if (input.dataset.wdpCustomPriceBlurBound !== '1') {
          input.dataset.wdpCustomPriceBlurBound = '1';
          input.addEventListener("blur", debouncedBlurHandler);
        }
      }
    });

    const quantityInput = form.querySelector('input[name="quantity"]');
    const shareCountInput = form.querySelector('input[name="share_count"]');
    const isShareForm = !!shareCountInput;

    if (!isShareForm && quantityInput) {
      updateLineTotals(form);
    }

    // Hisseli form için quantity alanını devre dışı bırak - hissedar sayısına göre otomatik ayarlanacak
    if (isShareForm && quantityInput) {
      quantityInput.readOnly = true;

      // Adet kontrolü bölümünü gizle
      const quantityRow = form.querySelector(".wdp-product-quantity");
      if (quantityRow) {
        quantityRow.style.display = "none";
      }
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.refreshInRoot === 'function') {
      const phoneRoot = form.closest('.wdp-modal, .wdp-donation-form') || form;
      WDPApp.phoneInput.refreshInRoot(phoneRoot);
    } else if (WDPApp.phoneInput && typeof WDPApp.phoneInput.setupInRoot === 'function') {
      WDPApp.phoneInput.setupInRoot(form);
    }
  }


  if (typeof formAjax.registerHooks === 'function') {
    formAjax.registerHooks({
      validateForm: validateForm,
      getEffectiveShareCount: getEffectiveShareCount,
      applyAjaxValidationFieldErrors: applyAjaxValidationFieldErrors,
      focusFirstInvalidField: focusFirstInvalidField,
    });
  }


  // Export — lastValidation validate.js tarafından yazılır; üzerine yazma
  const prevLastValidation =
    WDPApp.form && WDPApp.form.lastValidation ? WDPApp.form.lastValidation : null;
  WDPApp.form = {
    setup: setupFormSubmission,
    submit: submitFormData,
    validate: validateForm,
    validateForm: validateForm,
    getPhoneValidationState,
    showInputError,
    showFormError,
    handleAjaxResponse,
    handleAjaxError,
    directSubmit: directFormSubmit,
    updateLineTotals,
    clearAmountSelection,
    lastValidation: prevLastValidation,
  };

  // Export form module

})(window);

