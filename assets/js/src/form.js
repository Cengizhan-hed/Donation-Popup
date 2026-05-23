/**
 * ============================================================================
 * FORM.JS - FORM İŞLEMLERİ MODÜLÜ
 * ============================================================================
 * 
 * DOSYA: form.js
 * KONUM: /assets/js/src/form.js
 * 
 * AMAÇ:
 * Bağış formlarının tüm işlemlerini yönetir.
 * Form validation, submission, error handling.
 * 
 * ANA İŞLEVLER:
 * 1. setupFormSubmission - Form submit event'lerini bağlama
 * 2. validateForm - Form validasyonu
 * 3. submitFormData - AJAX ile form gönderme
 * 4. handleAjaxResponse - AJAX response işleme
 * 5. handleAjaxError - AJAX hata işleme
 * 6. directFormSubmit - Doğrudan form gönderme (non-AJAX)
 * 7. showInputError - Input hata mesajı gösterme
 * 8. showFormError - Form hata mesajı gösterme
 * 
 * VALIDATION:
 * - Hissedar formları kontrolü (ad, telefon)
 * - Minimum fiyat kontrolü
 * - Maksimum hisse kontrolü
 * - Zorunlu alan kontrolü
 * - Sayısal değer kontrolü
 * 
 * PERFORMANS:
 * - Debounce ile input validation (300ms)
 * - Optimize edilmiş event handlers
 * - Cache'lenmiş form referansları
 * 
 * GÜVENLİK:
 * - Nonce doğrulaması
 * - Input sanitization
 * - XSS önleme
 * 
 * ACCESSIBILITY:
 * - ARIA live regions
 * - Error mesajları screen reader için
 * - Focus management
 * 
 * DEPENDENCIES:
 * - utils.js (formatCurrency, getAjaxNonce, announceStatus, debounce)
 * - state.js (form state management)
 * - alerts.js (error/success mesajları)
 * - cart.js (sepet güncelleme)
 * 
 * EXPORT:
 * WDPApp.form = { setup, submit, validate, showInputError, ... }
 * 
 * ============================================================================
 * 
 * Form - Form işlemleri
 * setupFormSubmission, validateForm, submitFormData, handleAjaxResponse,
 * handleAjaxError, directFormSubmit, showInputError, showFormError
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'getAjaxNonce', 'announceStatus', 'safeLog', 'escapeHtml', 'mergeWdpAjaxNonces', 'refreshWdpAjaxNonces'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const alertsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('alerts', ['clear', 'show'])
    : { module: WDPApp.alerts || {}, isValid: false, missingMethods: [] };
  
  const cartCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('cart', ['fetchContents', 'updateCountElements', 'createItemsHTML', 'renderItemsInto', 'setupContinueShoppingButton', 'updateWooCommerce', 'saveSideCartElements', 'showSideCarts'])
    : { module: WDPApp.cart || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const alerts = alertsCheck.module;
  const cart = cartCheck.module;
  const { productPrices, originalForms } = state;
  const { formatCurrency, getAjaxNonce, announceStatus, safeLog, escapeHtml, debounce, mergeWdpAjaxNonces, refreshWdpAjaxNonces } = utils;
  const { clear: clearAlerts } = alerts;
  const { fetchContents: fetchCartContents, updateCountElements: updateCartCountElements, createItemsHTML: createCartItemsHTML, renderItemsInto: renderCartItemsInto, buildCartUiRoot, setupContinueShoppingButton, setupRemoveCartItemButtons, updateWooCommerce: updateWooCommerceCart, saveSideCartElements, showSideCarts } = cart;
  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;

  function getInputErrorAnchor(input) {
    if (!input) {
      return null;
    }
    const row = input.closest('.wdp-field-stack__row');
    if (row) {
      return row;
    }
    return input.parentNode;
  }

  function getDonorNameRequiredMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.donor_name_required === 'string' && s.donor_name_required.trim()) {
      return s.donor_name_required.trim();
    }
    return 'Ad Soyad zorunludur.';
  }

  function getShareholderNameRequiredMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.shareholder_name_required === 'string' && s.shareholder_name_required.trim()) {
      return s.shareholder_name_required.trim();
    }
    return 'Hissedar adı zorunludur.';
  }

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
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.phone_required === 'string' && s.phone_required.trim()) {
      return s.phone_required.trim();
    }
    return 'Telefon numarası eksik.';
  }

  function getPhoneIncompleteMessage(result) {
    const s = wdp_ajax && wdp_ajax.strings;
    const base =
      s && typeof s.phone_incomplete === 'string' && s.phone_incomplete.trim()
        ? s.phone_incomplete.trim()
        : 'Telefon numarasını eksiksiz giriniz.';
    if (result && result.min === result.max && Number.isFinite(result.min)) {
      return base + ' (' + result.min + ' rakam)';
    }
    if (result && Number.isFinite(result.min) && Number.isFinite(result.max)) {
      return base + ' (' + result.min + '–' + result.max + ' rakam)';
    }
    return base;
  }

  function getPhoneInvalidMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.phone_invalid === 'string' && s.phone_invalid.trim()) {
      return s.phone_invalid.trim();
    }
    return 'Geçerli bir telefon numarası giriniz.';
  }

  function validatePhoneInputInForm(form, input, options) {
    if (!input || input.disabled || input.readOnly) {
      return true;
    }
    const isRequired =
      options && typeof options.required === 'boolean'
        ? options.required
        : input.required || input.hasAttribute('required');
    if (!WDPApp.phoneInput || typeof WDPApp.phoneInput.validatePhoneField !== 'function') {
      if (isRequired && !String(input.value || '').trim()) {
        showInputError(input, getPhoneRequiredMessage());
        return false;
      }
      return true;
    }
    const result = WDPApp.phoneInput.validatePhoneField(input);
    if (result.empty) {
      if (!isRequired) {
        return true;
      }
      showInputError(input, getPhoneRequiredMessage());
      return false;
    }
    if (!result.ok) {
      const msg =
        result.reason === 'too_long' ? getPhoneInvalidMessage() : getPhoneIncompleteMessage(result);
      showInputError(input, msg);
      return false;
    }
    return true;
  }

  function validateAllPhoneFields(form) {
    let allOk = true;
    form
      .querySelectorAll(
        'input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]'
      )
      .forEach((input) => {
        const required =
          input.name === 'donation_phone' ||
          (input.name && input.name.indexOf('shareholder_phone_') === 0);
        if (!validatePhoneInputInForm(form, input, { required: required })) {
          allOk = false;
        }
      });
    return allOk;
  }

  let wdpFieldErrorIdSeq = 0;
  function nextFieldErrorId() {
    wdpFieldErrorIdSeq += 1;
    return 'wdp-field-err-' + wdpFieldErrorIdSeq;
  }

  /** WooCommerce çekirdek/tema scriptleri `name="add-to-cart"` alanını yakalayıp paralel sepete ekleme yapabiliyor; önce wdp_product_id kullanılır. */
  const WDP_PRODUCT_ID_INPUT_SELECTOR = 'input[name="wdp_product_id"], input[name="add-to-cart"]';

  const WDP_FORM_SUBMIT_CAPTURE = true;

  function getWdpFormRoot(form) {
    if (!form) return null;
    return form.closest(".wdp-modal") || form.closest(".wdp-donation-form");
  }

  function getWdpMetaFormType(form) {
    return form && form.closest(".wdp-modal") ? "popup" : "inline";
  }

  function trackMetaPixelAfterAddToCartSuccess(data, form) {
    if (!window.WDPMetaTracking || typeof window.WDPMetaTracking.trackAddToCartDonation !== "function") {
      return;
    }
    try {
      const line = data && data.meta_cart_line ? data.meta_cart_line : null;
      const uniqueInput = form.querySelector('input[name="unique_submission_key"]');
      const usk = uniqueInput && uniqueInput.value ? String(uniqueInput.value) : "";
      if (form) {
        form._wdpLastMetaCartLine = line || null;
      }
      window.WDPMetaTracking.trackAddToCartDonation({
        metaCartLine: line,
        cartItemKey: data && data.cart_item_key ? String(data.cart_item_key) : "",
        uniqueSubmissionKey: usk,
        productId: data && data.product_id,
        formType: getWdpMetaFormType(form),
      });
    } catch (e) {
      safeLog("Meta AddToCart:", e);
    }
  }

  function trackMetaPixelInitiateCheckoutIfEnabled(form, data) {
    if (!window.WDPMetaTracking || typeof window.WDPMetaTracking.trackInitiateCheckoutDonation !== "function") {
      return;
    }
    const metaCfg = wdp_ajax && wdp_ajax.meta ? wdp_ajax.meta : {};
    if (!metaCfg.enabled || !metaCfg.initiateCheckout) {
      return;
    }
    const line = (data && data.meta_cart_line) || (form && form._wdpLastMetaCartLine) || null;
    if (!line || !line.product_id) {
      return;
    }
    try {
      const pid = String(line.product_id);
      const qty = parseInt(line.quantity, 10) || 1;
      const icParams = {
        content_ids: [pid],
        content_name: String(line.product_name || "").slice(0, 500),
        content_type: "product",
        contents: [{ id: pid, quantity: qty, item_price: parseFloat(line.item_price) || 0 }],
        value: parseFloat(line.line_total) || 0,
        currency: line.currency || (wdp_ajax.currency && wdp_ajax.currency.code) || "TRY",
        num_items: qty,
      };
      const uniqueInput = form.querySelector('input[name="unique_submission_key"]');
      const usk = uniqueInput && uniqueInput.value ? String(uniqueInput.value) : "";
      const dedupeKey = "wdp_meta_ic_" + pid + "_" + (usk || "nokey");
      const eventID = "wdp_ic_" + pid + "_" + String(Date.now());
      window.WDPMetaTracking.trackInitiateCheckoutDonation({
        params: icParams,
        eventID: eventID,
        dedupeKey: dedupeKey,
      });
    } catch (e) {
      safeLog("Meta InitiateCheckout:", e);
    }
  }

  function getWdpUnitPriceForForm(form) {
    const root = getWdpFormRoot(form);
    const idInput = form.querySelector(WDP_PRODUCT_ID_INPUT_SELECTOR);
    const pid = idInput ? Number.parseInt(idInput.value, 10) : 0;
    if (pid && productPrices && Number.isFinite(Number(productPrices[pid]))) {
      return Number(productPrices[pid]);
    }
    if (root && root.dataset && root.dataset.wdpUnitPrice !== undefined && root.dataset.wdpUnitPrice !== "") {
      const v = Number.parseFloat(root.dataset.wdpUnitPrice);
      if (Number.isFinite(v)) return v;
    }
    return 0;
  }

  function updateFixedPriceLineDisplay(form) {
    const row = form.querySelector(".wdp-fixed-price-counter-row");
    if (!row) return;
    const qtyEl = row.querySelector('input[name="quantity"]');
    const out = row.querySelector(".wdp-line-total-value");
    if (!out || !qtyEl) return;
    const qty = Number.parseInt(qtyEl.value, 10) || 1;
    const unit = getWdpUnitPriceForForm(form);
    if (unit > 0) {
      out.textContent = formatCurrency(unit * qty);
    }
  }

  function parseNormalizedAmount(raw) {
    if (raw === null || raw === undefined) return NaN;
    let s = String(raw).trim().replace(/\s+/g, "");
    if (s === "") return NaN;
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      const parts = s.split(".");
      if (parts.length > 2) {
        s = parts.join("");
      } else if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
        s = parts[0] + parts[1];
      }
    }
    return Number.parseFloat(s);
  }

  function roundMoney(n) {
    return Math.round(n * 100) / 100;
  }

  function formatPriceInputValue(n) {
    if (!Number.isFinite(n) || n <= 0) return "";
    const r = roundMoney(n);
    if (Math.abs(r - Math.round(r)) < 0.0001) return String(Math.round(r));
    return String(r);
  }

  function formatSubmitUnitPrice(unit) {
    if (!Number.isFinite(unit) || unit <= 0) return "";
    const r = roundMoney(unit);
    return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2);
  }

  function getCustomPriceQtyRow(form) {
    return form ? form.querySelector(".wdp-custom-price-with-qty-row") : null;
  }

  function ensureCustomUnitFromDisplayed(customIn, qty) {
    if (!customIn) return NaN;
    const q = Number.parseInt(String(qty), 10) || 1;
    const total = parseNormalizedAmount(customIn.value);
    if (Number.isFinite(total) && total > 0 && q > 0) {
      const u = roundMoney(total / q);
      customIn.dataset.wdpCustomUnit = String(u);
      return u;
    }
    delete customIn.dataset.wdpCustomUnit;
    return NaN;
  }

  function syncCustomPriceQtyRowDisplay(form) {
    const row = getCustomPriceQtyRow(form);
    if (!row) return;
    const customIn = row.querySelector('input[name="custom_price"]');
    const qtyEl = row.querySelector('input[name="quantity"]');
    if (!customIn || !qtyEl) return;
    const qty = Number.parseInt(qtyEl.value, 10) || 1;
    const unit = Number.parseFloat(customIn.dataset.wdpCustomUnit);
    if (Number.isFinite(unit) && unit > 0) {
      customIn.value = formatPriceInputValue(unit * qty);
    }
  }

  function updateLineTotals(form) {
    updateFixedPriceLineDisplay(form);
    syncCustomPriceQtyRowDisplay(form);
  }

  function bindProductQuantityDelegation(form) {
    if (!form || form.dataset.wdpQtyDelegationBound === '1') {
      return;
    }
    form.dataset.wdpQtyDelegationBound = '1';
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('.wdp-product-quantity-decrease, .wdp-product-quantity-increase');
      if (!btn || !form.contains(btn)) {
        return;
      }
      if (form.querySelector('input[name="share_count"]')) {
        return;
      }
      const counter = btn.closest('.wdp-quantity-counter');
      if (!counter) {
        return;
      }
      const quantityInput = counter.querySelector('input[name="quantity"]');
      if (!quantityInput) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const currentValue = Number.parseInt(quantityInput.value, 10) || 1;
      const isDecrease = btn.classList.contains('wdp-product-quantity-decrease');
      const customRow = form.querySelector('.wdp-custom-price-with-qty-row');
      if (customRow && customRow.contains(quantityInput)) {
        const customIn = customRow.querySelector('input[name="custom_price"]');
        if (customIn) {
          ensureCustomUnitFromDisplayed(customIn, currentValue);
        }
      }
      if (isDecrease) {
        if (currentValue > 1) {
          quantityInput.value = String(currentValue - 1);
          updateLineTotals(form);
        }
        return;
      }
      const maxAttr = Number.parseInt(quantityInput.getAttribute('max') || '99', 10);
      const maxAllowed = Number.isFinite(maxAttr) && maxAttr > 0 ? maxAttr : 99;
      quantityInput.value = String(Math.min(maxAllowed, currentValue + 1));
      updateLineTotals(form);
    });
  }

  function patchSimpleCustomPriceQtyRowFormData(form, formData) {
    if (!form || !formData) return;
    if (form.querySelector('input[name="share_count"]')) return;
    const row = getCustomPriceQtyRow(form);
    if (!row) return;
    const priceInput = row.querySelector('input[name="custom_price"]');
    const qEl = row.querySelector('input[name="quantity"]');
    if (!priceInput || !qEl) return;
    const q = Number.parseInt(qEl.value, 10) || 1;
    let unit = Number.parseFloat(priceInput.dataset.wdpCustomUnit);
    if (!Number.isFinite(unit) || unit <= 0) {
      const total = parseNormalizedAmount(priceInput.value);
      if (Number.isFinite(total) && total > 0 && q > 0) {
        unit = roundMoney(total / q);
        priceInput.dataset.wdpCustomUnit = String(unit);
      }
    }
    if (Number.isFinite(unit) && unit > 0) {
      formData.set("custom_price", formatSubmitUnitPrice(unit));
      formData.set("quantity", String(q));
    }
  }
  
  // Debounced validation function for input events
  const debouncedValidateInput = debounce ? debounce((input) => {
    if (input.classList.contains('wdp-error')) {
      input.classList.remove('wdp-error');
      const anchor = getInputErrorAnchor(input);
      const errorDiv = anchor && anchor.querySelector('.wdp-input-error');
      if (errorDiv) {
        const rid = errorDiv.id;
        errorDiv.remove();
        try {
          input.removeAttribute('aria-invalid');
          if (rid && input.getAttribute('aria-describedby') === rid) {
            input.removeAttribute('aria-describedby');
          }
        } catch (eAriaDeb) {
          /* ignore */
        }
      }
      if (typeof input.setCustomValidity === 'function') {
        try {
          input.setCustomValidity('');
        } catch (eCvDeb) {
          /* ignore */
        }
      }
    }
  }, 300) : null;

  function isFormProcessing(form) {
    return form && form.dataset && form.dataset.wdpProcessing === "1";
  }

  function setFormProcessing(form, processing) {
    if (!form || !form.dataset) {
      return;
    }
    form.dataset.wdpProcessing = processing ? "1" : "0";
  }

  function showInputError(input, message) {
    input.classList.add('wdp-error');
    const anchor = getInputErrorAnchor(input) || input.parentNode;
    // Remove previous error
    let errorDiv = anchor.querySelector('.wdp-input-error');
    if (errorDiv) errorDiv.remove();
    // Add new error
    errorDiv = document.createElement('div');
    errorDiv.className = 'wdp-input-error';
    errorDiv.setAttribute('role', 'alert');
    const errorId = nextFieldErrorId();
    errorDiv.id = errorId;
    errorDiv.textContent = message;
    anchor.appendChild(errorDiv);
    try {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } catch (eAria) {
      /* ignore */
    }
    // Remove error on focus/input - optimized with debounce
    function clearError() {
      input.classList.remove('wdp-error');
      if (errorDiv) errorDiv.remove();
      try {
        input.removeAttribute('aria-invalid');
        if (input.getAttribute('aria-describedby') === errorId) {
          input.removeAttribute('aria-describedby');
        }
      } catch (eAria2) {
        /* ignore */
      }
      if (typeof input.setCustomValidity === 'function') {
        try {
          input.setCustomValidity('');
        } catch (eCvFocus) {
          /* ignore */
        }
      }
      input.removeEventListener('input', clearErrorInput);
    }
    
    // Debounced input handler for better performance
    const clearErrorInput = debouncedValidateInput
      ? debouncedValidateInput.bind(null, input)
      : function () {
          input.classList.remove('wdp-error');
          if (errorDiv) {
            const rid = errorDiv.id;
            errorDiv.remove();
            try {
              input.removeAttribute('aria-invalid');
              if (rid && input.getAttribute('aria-describedby') === rid) {
                input.removeAttribute('aria-describedby');
              }
            } catch (eAriaIn) {
              /* ignore */
            }
          }
          if (typeof input.setCustomValidity === 'function') {
            try {
              input.setCustomValidity('');
            } catch (eCvIn) {
              /* ignore */
            }
          }
        };
    
    input.addEventListener('input', clearErrorInput);

    announceStatus(message, 'assertive');
  }

  function showFormError(form, message) {
    let formError = form.querySelector('.wdp-form-error');
    if (!formError) {
      formError = document.createElement('div');
      formError.className = 'wdp-form-error';
      form.insertBefore(formError, form.firstChild);
    }
    formError.setAttribute('role', 'alert');
    formError.setAttribute('data-wdp-protected', 'true');
    formError.textContent = message;
    formError.style.display = 'block';
    // Remove on any input focus
    form.querySelectorAll('input, textarea').forEach(input => {
      if (input.dataset.wdpFormErrorFocusBound === '1') {
        return;
      }
      input.dataset.wdpFormErrorFocusBound = '1';
      input.addEventListener('focus', function clearFormError() {
        if (formError) formError.remove();
        input.removeEventListener('focus', clearFormError);
        input.dataset.wdpFormErrorFocusBound = '0';
      });
    });

    announceStatus(message, 'assertive');
  }

  /**
   * Safety net: never leave CTA clicks without visible feedback.
   * If field-level nodes fail to render for any reason, keep a compact form-level hint.
   */
  function ensureVisibleValidationFeedback(form, errorMessages) {
    if (!form) {
      return;
    }
    if (form.querySelector('.wdp-error')) {
      return;
    }
    const fieldErrors = Array.prototype.slice.call(form.querySelectorAll('.wdp-input-error'));
    const hasVisibleFieldErrors = fieldErrors.some((el) => {
      if (!el) {
        return false;
      }
      // offsetParent null olabilir (position:fixed vb.); getClientRects daha güvenilir.
      if (el.getClientRects && el.getClientRects().length > 0) {
        return true;
      }
      return false;
    });
    if (hasVisibleFieldErrors) {
      return;
    }
    const msg = Array.isArray(errorMessages) && errorMessages.length
      ? errorMessages[0]
      : 'Lütfen işaretlenen alanları kontrol edin.';
    showFormError(form, msg);
  }

  function getEffectiveShareCount(form) {
    if (!form) {
      return 1;
    }
    const renderedRows = form.querySelectorAll(".wdp-shareholder-form");
    const renderedCount = renderedRows && renderedRows.length ? renderedRows.length : 0;
    const shareCountInput = form.querySelector('input[name="share_count"]');
    const inputCount = shareCountInput ? Number.parseInt(shareCountInput.value, 10) || 1 : 1;
    const effective = Math.max(1, inputCount, renderedCount);
    if (shareCountInput && renderedCount > inputCount && String(shareCountInput.value) !== String(effective)) {
      shareCountInput.value = String(effective);
    }
    return Math.max(1, effective);
  }

  function ensureShareholderRowsReady(form) {
    if (!form) {
      return;
    }
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (!shareCountInput) {
      return;
    }
    const desired = Number.parseInt(shareCountInput.value, 10) || 1;
    const existing = form.querySelectorAll(".wdp-shareholder-form").length;
    if (desired <= existing) {
      return;
    }
    const host = form.closest(".wdp-modal") || form.closest(".wdp-donation-form");
    if (
      host &&
      WDPApp.shareholder &&
      typeof WDPApp.shareholder.updateForms === "function"
    ) {
      try {
        WDPApp.shareholder.updateForms(host, null);
      } catch (eEnsureRows) {
        safeLog("ensureShareholderRowsReady failed:", eEnsureRows);
      }
    }
  }

  function getOrderedShareholderRows(form) {
    if (!form) {
      return [];
    }
    const rows = Array.from(form.querySelectorAll(".wdp-shareholder-form"));
    rows.sort((a, b) => {
      const ai = Number.parseInt(a.getAttribute("data-index") || "0", 10) || 0;
      const bi = Number.parseInt(b.getAttribute("data-index") || "0", 10) || 0;
      return ai - bi;
    });
    return rows;
  }

  function focusShareholderIssue(issue) {
    if (!issue || !issue.row) {
      return false;
    }
    const row = issue.row;
    const targetField = issue.field || null;
    const content = row.querySelector(".wdp-shareholder-content");
    const list = row.closest(".wdp-shareholders-scroll");
    if (row.classList.contains("collapsed")) {
      if (list) {
        list.querySelectorAll(".wdp-shareholder-form").forEach((other) => {
          if (other !== row) {
            other.classList.add("collapsed");
            const otherContent = other.querySelector(".wdp-shareholder-content");
            if (otherContent) {
              otherContent.style.display = "none";
            }
          }
        });
      }
      row.classList.remove("collapsed");
      if (content) {
        content.style.display = "flex";
      }
      if (WDPApp.shareholder && typeof WDPApp.shareholder.updateCollapsedCount === "function") {
        const host = row.closest(".wdp-modal") || row.closest(".wdp-donation-form");
        if (host) {
          WDPApp.shareholder.updateCollapsedCount(host);
        }
      }
    }
    window.requestAnimationFrame(() => {
      const scrollParent = row.closest(".wdp-shareholders-scroll");
      if (scrollParent) {
        const rowBox = row.getBoundingClientRect();
        const parentBox = scrollParent.getBoundingClientRect();
        const delta = rowBox.top - parentBox.top - Math.max(8, parentBox.height * 0.2);
        scrollParent.scrollTo({
          top: Math.max(0, scrollParent.scrollTop + delta),
          behavior: "smooth",
        });
      }
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      if (targetField && typeof targetField.focus === "function") {
        try {
          targetField.focus({ preventScroll: true });
        } catch (e) {
          targetField.focus();
        }
      }
    });
    return true;
  }

  function focusShareholderSection(form) {
    if (!form) return;
    const section = form.querySelector(".wdp-shares-section");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function validateForm(form) {
    safeLog("validateForm called");
    let isValid = true;
    let errorMessages = [];
    ensureShareholderRowsReady(form);

    // Önce tüm eski hata mesajlarını temizle
    form.querySelectorAll('.wdp-error').forEach((input) => {
      input.classList.remove('wdp-error');
    });
    form.querySelectorAll('input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]').forEach((tel) => {
      if (typeof tel.setCustomValidity === 'function') {
        try {
          tel.setCustomValidity('');
        } catch (eCvReset) {
          /* ignore */
        }
      }
    });
    form.querySelectorAll('.wdp-input-error').forEach((el) => el.remove());
    form.querySelectorAll('input[aria-describedby], textarea[aria-describedby]').forEach((inp) => {
      const id = inp.getAttribute('aria-describedby');
      if (id && !document.getElementById(id)) {
        inp.removeAttribute('aria-describedby');
        inp.removeAttribute('aria-invalid');
      }
    });
    form.querySelectorAll('.wdp-form-error').forEach((error) => error.remove());

    // Önceki merkezi alert overlay (artık doğrulama için kullanılmıyor)
    clearAlerts();

    // Hisse adedi kontrolü
    const shareCountInput = form.querySelector('input[name="share_count"]');
    const shareholderRows = getOrderedShareholderRows(form);
    let firstShareholderIssue = null;
    let incompleteShareholderCount = 0;
    if (shareCountInput || (shareholderRows && shareholderRows.length > 0)) {
      getEffectiveShareCount(form);
      safeLog("Checking shareholder forms for count:", shareholderRows.length);

      shareholderRows.forEach((shareholderForm, idx) => {
        const rowIndex = Number.parseInt(shareholderForm.getAttribute("data-index") || "0", 10) || idx + 1;
        const nameField = shareholderForm.querySelector('input[name^="shareholder_name_"]');
        const phoneField = shareholderForm.querySelector('input[name^="shareholder_phone_"]');
        
        safeLog(`Checking form ${rowIndex}:`, {
          nameField: !!nameField,
          nameValue: nameField?.value,
          phoneField: !!phoneField,
          phoneValue: phoneField?.value
        });
        
        // Ad alanı kontrolü
        let rowHasMissing = false;
        let rowFirstField = null;
        if (nameField && !nameField.value.trim()) {
          safeLog(`Name field ${rowIndex} is empty`);
          showInputError(nameField, `${rowIndex}. ${getShareholderNameRequiredMessage()}`);
          errorMessages.push(`${rowIndex}. ${getShareholderNameRequiredMessage()}`);
          isValid = false;
          rowHasMissing = true;
          rowFirstField = rowFirstField || nameField;
        }
        
        if (rowHasMissing) {
          incompleteShareholderCount += 1;
          if (!firstShareholderIssue) {
            firstShareholderIssue = {
              row: shareholderForm,
              field: rowFirstField,
            };
          }
        }
      });
    }
    if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      const targetIndex =
        firstShareholderIssue && firstShareholderIssue.row
          ? Number.parseInt(firstShareholderIssue.row.getAttribute("data-index") || "0", 10) || 0
          : 0;
      WDPApp.shareholder.setValidationArmed(form, incompleteShareholderCount > 0, targetIndex);
    } else if (WDPApp.shareholder && typeof WDPApp.shareholder.refreshGuidance === "function") {
      WDPApp.shareholder.refreshGuidance(form);
    }
    if (incompleteShareholderCount > 1) {
      errorMessages.push(`${incompleteShareholderCount} hissedar formu eksik.`);
    }

    // Telefon: ülkeye göre rakam sayısı (TR: 10, vb.)
    if (!validateAllPhoneFields(form)) {
      isValid = false;
      if (!firstShareholderIssue) {
        const badSharePhone = form.querySelector(
          '.wdp-shareholder-row input[name^="shareholder_phone_"].wdp-error'
        );
        if (badSharePhone) {
          firstShareholderIssue = {
            row: badSharePhone.closest('.wdp-shareholder-row'),
            field: badSharePhone,
          };
        }
      }
    }

    // Diğer zorunlu alanlar (fiyat, vb.)
    form.querySelectorAll('input[required], textarea[required]').forEach((field) => {
      // Hissedar formları dışındaki alanları kontrol et
      if (!field.name.includes('shareholder_')) {
        if (field.name === 'donation_phone' || field.type === 'tel') {
          return;
        }
        if (!field.value.trim()) {
          const msg = getRequiredFieldMessage(field);
          showInputError(field, msg);
          errorMessages.push(field.placeholder || msg);
          isValid = false;
        }
      }
    });

    // Minimum bağış tutarı ve sayısal doğrulama
    const customPriceInput = form.querySelector('input[name="custom_price"]');
    if (customPriceInput) {
      const rawValue = customPriceInput.value ? customPriceInput.value.toString().trim() : '';
      const numericValue = rawValue === '' ? NaN : parseNormalizedAmount(rawValue);
      const minAttr = customPriceInput.getAttribute('min');
      const minValueFromAttr = minAttr !== null && minAttr !== '' ? parseNormalizedAmount(minAttr) : NaN;
      const baseMinData = customPriceInput.dataset.baseMin;
      const shareCountValue = shareCountInput ? getEffectiveShareCount(form) : 1;
      const perShareMin = baseMinData !== undefined && baseMinData !== '' ? parseNormalizedAmount(baseMinData) : NaN;
      const customPriceQtyRow = customPriceInput.closest('.wdp-custom-price-with-qty-row');

      let effectiveMin = 0;
      if (customPriceQtyRow) {
        const qEl = customPriceQtyRow.querySelector('input[name="quantity"]');
        const qtyForMin = qEl ? Number.parseInt(qEl.value, 10) || 1 : 1;
        const perUnitCandidates = [];
        if (Number.isFinite(minValueFromAttr) && minValueFromAttr > 0) {
          perUnitCandidates.push(minValueFromAttr);
        }
        if (Number.isFinite(perShareMin) && perShareMin > 0) {
          perUnitCandidates.push(perShareMin);
        }
        const perUnitMin = perUnitCandidates.length > 0 ? Math.max.apply(null, perUnitCandidates) : 0;
        effectiveMin = perUnitMin > 0 ? perUnitMin * qtyForMin : 0;
      } else {
        const effectiveMinCandidates = [];
        if (Number.isFinite(minValueFromAttr) && minValueFromAttr > 0) {
          effectiveMinCandidates.push(minValueFromAttr);
        }
        if (Number.isFinite(perShareMin) && perShareMin > 0) {
          effectiveMinCandidates.push(perShareMin * shareCountValue);
        }
        effectiveMin = effectiveMinCandidates.length > 0 ? Math.max.apply(null, effectiveMinCandidates) : 0;
      }

      const focusInput = () => {
          if (isValid) {
            try {
              customPriceInput.focus({ preventScroll: false });
            } catch (e) {
              customPriceInput.focus();
            }
          }
      };

      if (rawValue === '') {
        const emptyMessage = 'Lütfen bağış tutarını giriniz.';
        showInputError(customPriceInput, emptyMessage);
        if (!errorMessages.includes(emptyMessage)) {
          errorMessages.push(emptyMessage);
        }
        focusInput();
          isValid = false;
      } else if (!Number.isFinite(numericValue) || numericValue <= 0) {
        const invalidMessage = 'Lütfen geçerli bir bağış tutarı giriniz.';
        showInputError(customPriceInput, invalidMessage);
        if (!errorMessages.includes(invalidMessage)) {
          errorMessages.push(invalidMessage);
        }
        focusInput();
        isValid = false;
      } else if (effectiveMin > 0 && numericValue + 0.0001 < effectiveMin) {
        const minMessage = customPriceQtyRow
          ? `Lütfen ${formatCurrency(effectiveMin)} ve üstü toplam tutar girin.`
          : `Lütfen ${formatCurrency(effectiveMin)} ve üstü değerler girin.`;
          showInputError(customPriceInput, minMessage);
          if (!errorMessages.includes(minMessage)) {
            errorMessages.push(minMessage);
          }
        focusInput();
          isValid = false;
      }
    }

    errorMessages = Array.from(new Set(errorMessages));
    safeLog("Form validation result:", { isValid, errorMessages });

    if (!isValid) {
      safeLog("Form is invalid; showing field-anchored errors only");
      if (firstShareholderIssue && incompleteShareholderCount > 0) {
        const firstRowIndex =
          Number.parseInt(firstShareholderIssue.row.getAttribute("data-index") || "0", 10) || 0;
        const summaryMsg = incompleteShareholderCount > 1
          ? `${incompleteShareholderCount} hissedar formu eksik.`
          : (firstRowIndex > 0 ? `${firstRowIndex}. hissedar formu eksik.` : "1 hissedar formu eksik.");
        if (!errorMessages.includes(summaryMsg)) {
          errorMessages.push(summaryMsg);
        }
      }
      const shareholderFocused = focusShareholderIssue(firstShareholderIssue);
      if (!shareholderFocused) {
        if (incompleteShareholderCount > 0) {
          focusShareholderSection(form);
        }
        focusFirstInvalidField(form);
      }
      announceStatus(
        errorMessages.length ? errorMessages[0] : "Lütfen işaretlenen alanları kontrol edin.",
        "assertive"
      );
    } else if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      WDPApp.shareholder.setValidationArmed(form, false, 0);
    }

    return isValid;
  }

  function focusFirstInvalidField(form) {
    if (!form) {
      return;
    }
    const firstBad = form.querySelector(".wdp-error");
    if (!firstBad || typeof firstBad.focus !== "function") {
      return;
    }
    window.requestAnimationFrame(() => {
      try {
        firstBad.focus({ preventScroll: false });
      } catch (e1) {
        try {
          firstBad.focus();
        } catch (e2) {
          /* ignore */
        }
      }
      const anchor =
        firstBad.closest(".wdp-field-stack__row") ||
        firstBad.closest(".wdp-shareholder-form") ||
        firstBad.closest(".wdp-modal-content") ||
        form;
      if (anchor && typeof anchor.scrollIntoView === "function") {
        anchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
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
        el.classList.add("wdp-error");
        if (!firstShareholderRowIndex) {
          const m = /^shareholder_phone_(\d+)$/.exec(key);
          firstShareholderRowIndex = m ? Number.parseInt(m[1], 10) || 0 : firstShareholderRowIndex;
        }
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
        msg = "Lütfen bağış tutarını giriniz.";
      } else {
        msg = getRequiredFieldMessage(el) || fb || "Bu alan zorunludur.";
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

  function getSuccessAddedToCartText() {
    const strings = wdp_ajax && wdp_ajax.strings ? wdp_ajax.strings : {};
    const text = strings && typeof strings.added_to_cart === 'string' ? strings.added_to_cart.trim() : '';
    return text || 'Bağışınız sepete eklendi';
  }

  function buildSuccessTopRow() {
    const bar = document.createElement('div');
    bar.className = 'wdp-success-top-bar';
    const msg = document.createElement('p');
    msg.className = 'wdp-success-top-bar__message';
    msg.textContent = getSuccessAddedToCartText();
    bar.appendChild(msg);
    return bar;
  }

  function renderSuccessScreen(successScreen, cartItems) {
    if (!successScreen) {
      return;
    }
    successScreen.innerHTML = '';
    successScreen.appendChild(buildSuccessTopRow());
    const cartStack = document.createElement('div');
    cartStack.className = 'wdp-success-cart-stack';
    successScreen.appendChild(cartStack);
    if (typeof renderCartItemsInto === 'function') {
      renderCartItemsInto(cartStack, Array.isArray(cartItems) ? cartItems : []);
    } else if (typeof buildCartUiRoot === 'function') {
      cartStack.appendChild(buildCartUiRoot(Array.isArray(cartItems) ? cartItems : []));
    } else {
      const fallback = document.createElement('div');
      fallback.innerHTML = createCartItemsHTML(Array.isArray(cartItems) ? cartItems : []);
      while (fallback.firstChild) {
        cartStack.appendChild(fallback.firstChild);
      }
    }
  }

  function handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn) {
    safeLog("Handling AJAX response:", data);

    // Başarı durumunda
    if (data.success) {
      trackMetaPixelAfterAddToCartSuccess(data, form);
      clearAlerts();
      // Sepet sayısını güncelle
      if (data.cart_count !== undefined) {
        updateCartCountElements(data.cart_count);
      }

      // Hata mesajını gizle (başarılı işlemde hata mesajı gösterme)
      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      }

      // Başarı mesajını göster
      if (isCheckout) {
        // Ödeme sayfasına yönlendir
        safeLog("Redirecting to checkout:", data.checkout_url);
        announceStatus('Ödeme adımına yönlendiriliyorsunuz.', 'assertive');
        trackMetaPixelInitiateCheckoutIfEnabled(form, data);
        window.location.href = data.checkout_url || wdp_ajax.checkout_url || "/odeme-sayfasi/";
      } else {
        // Sepete Ekle için başarı mesajını göster
        safeLog("Showing success message", data);
        announceStatus('Bağışınız sepete eklendi.', 'polite');

        // "Yeni Bağış Ekle" geri dönüşü için formun ilk halini bu anda da garanti altına al.
        // Bazı WordPress dinamik enjeksiyon senaryolarında saveOriginalForms ilk turu kaçırabiliyor.
        const snapshotContainer = form.closest('.wdp-donation-form, .wdp-modal');
        if (snapshotContainer && originalForms && typeof originalForms.set === 'function') {
          const snapshotKey =
            snapshotContainer.id ||
            snapshotContainer.getAttribute('data-product-id') ||
            null;
          if (snapshotKey && !originalForms.has(snapshotKey)) {
            originalForms.set(snapshotKey, form.innerHTML);
          }
        }

        // Form içeriğini temizle
        form.innerHTML = "";

        // Modal header'ı gizle (popup için)
        const modal = form.closest('.wdp-modal');
        if (modal) {
          const modalHeader = modal.querySelector('.wdp-modal-header');
          if (modalHeader) {
            modalHeader.classList.add('wdp-hidden-on-success');
          }
        }

        // Sayfa içi form için progress bar ve başlıkları gizle
        const inPageForm = form.closest('.wdp-donation-form');
        if (inPageForm) {
          const progressBar = inPageForm.querySelector('.wdp-progress-bar-container');
          if (progressBar) {
            progressBar.classList.add('wdp-hidden-on-success');
          }
          const formTitle = inPageForm.querySelector('.wdp-form-title-wrapper');
          if (formTitle) {
            formTitle.classList.add('wdp-hidden-on-success');
          }
        }

        // Başarı ekranı oluştur
        const successScreen = document.createElement("div");
        successScreen.className = "wdp-success-screen";
        form.appendChild(successScreen);

        // Sepet içeriğini göster (ilk yanıtta yoksa AJAX ile tamamla)
        if (data.items && Array.isArray(data.items)) {
          renderSuccessScreen(successScreen, data.items);
          setupContinueShoppingButton(form);
          setupRemoveCartItemButtons(successScreen);
        } else {
          successScreen.innerHTML = '';
          successScreen.appendChild(buildSuccessTopRow());
          const cartStack = document.createElement('div');
          cartStack.className = 'wdp-success-cart-stack';
          const loadingMessage = document.createElement('div');
          loadingMessage.className = 'wdp-mini-cart-loading';
          loadingMessage.textContent = 'Sepet içeriği yükleniyor...';
          cartStack.appendChild(loadingMessage);
          successScreen.appendChild(cartStack);

          fetchCartContents()
            .then((cartItems) => {
              renderSuccessScreen(successScreen, cartItems);
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successScreen);
            })
            .catch((error) => {
              safeLog("Error fetching cart contents:", error);
              renderSuccessScreen(successScreen, []);
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successScreen);
            });
        }
      }

      // Progress bar'ı güncelle (eğer varsa)
      if (data.total_donation !== undefined && data.product_id) {
        const progressBarModule = WDPApp.progressBar;
        if (progressBarModule && typeof progressBarModule.updateReal === 'function') {
          const container = form.closest('.wdp-modal, .wdp-donation-form');
          if (container) {
            const progressContainer = container.querySelector('.wdp-progress-bar-container');
            if (progressContainer) {
              const limit = parseFloat(progressContainer.getAttribute('data-limit')) || 100000;
              progressBarModule.updateReal(progressContainer, data.total_donation, limit);
            }
          }
        }
      }

      // WooCommerce sepet fragmentlerini güncelle
      updateWooCommerceCart();
    } else {
      const rawMessage = data && data.message ? String(data.message) : "";
      const normalizedMessage = rawMessage.toLowerCase();
      const responseCode = data && data.code ? String(data.code) : "";
      const isValidationError =
        responseCode === "validation_error" ||
        (data && Array.isArray(data.errors) && data.errors.length > 0);
      const isTechnicalNoiseError =
        responseCode === "security_error" ||
        responseCode === "unknown_error" ||
        normalizedMessage.includes("güvenlik") ||
        normalizedMessage.includes("geçersiz istek") ||
        normalizedMessage.includes("beklenmeyen bir hata") ||
        normalizedMessage.includes("sepet nesnesi");

      const fallbackMessage = rawMessage || "İşlem şu anda tamamlanamadı. Lütfen tekrar deneyin.";

      const shouldTryFieldAnchors = isValidationError && !isTechnicalNoiseError;
      const validationAnchored =
        shouldTryFieldAnchors && applyAjaxValidationFieldErrors(form, data, fallbackMessage);

      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        if (shouldTryFieldAnchors && validationAnchored) {
          errorMsg.textContent = "";
          errorMsg.style.display = "none";
        } else {
          errorMsg.textContent = fallbackMessage;
          errorMsg.style.display = "block";
          errorMsg.setAttribute("data-wdp-protected", "true");
        }
      }

      if (validationAnchored) {
        focusFirstInvalidField(form);
      }

      if (addToCartBtn) {
        addToCartBtn.disabled = false;
        addToCartBtn.classList.remove("wdp-loading");
      }
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove("wdp-loading");
      }

      announceStatus(fallbackMessage, 'assertive');
    }
  }

  function handleAjaxError(error, form, addToCartBtn, checkoutBtn) {
    safeLog("AJAX error:", error);

    clearAlerts();

    const errorMsg = form.querySelector(".wdp-form-error");
    if (errorMsg) {
      errorMsg.textContent = "Bağlantı hatası oluştu. Lütfen tekrar deneyin.";
      errorMsg.style.display = "block";
      errorMsg.setAttribute('data-wdp-protected', 'true');
    }

    announceStatus('Bağlantı hatası oluştu. Lütfen tekrar deneyin.', 'assertive');

    // Butonları tekrar aktif et
    if (addToCartBtn) {
      addToCartBtn.disabled = false;
      addToCartBtn.classList.remove("wdp-loading");
    }
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove("wdp-loading");
    }

    // Yalnızca ilgili formun kilidini kaldır
    setFormProcessing(form, false);
  }

  /**
   * PHP uyarısı / BOM / HTML öncesi JSON gibi bozuk gövdelerde gerçek WDP yanıtını ayıklar.
   */
  function parseWdpAjaxResponseText(raw) {
    if (!raw || typeof raw !== "string") {
      return null;
    }
    const trimmed = raw.replace(/^\uFEFF/, "").trim();
    let candidate = trimmed;
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      candidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.success === "boolean") {
        return parsed;
      }
    } catch (parseErr) {
      safeLog("Loose JSON parse failed:", parseErr);
    }
    return null;
  }

  function shouldAttemptCartRecoveryFromJqXHR(jqXHR, textStatus) {
    if (textStatus === "parsererror") {
      return true;
    }
    const status = jqXHR && typeof jqXHR.status === "number" ? jqXHR.status : 0;
    if (status === 0) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    return false;
  }

  function shouldAttemptCartRecoveryFromFetchError(error) {
    if (error && error.wdpRecoverCart) {
      return true;
    }
    const status = error && typeof error.status === "number" ? error.status : null;
    if (status === null || Number.isNaN(status)) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    if (status === 0) {
      return true;
    }
    return false;
  }

  /**
   * Sunucu isteği tamamlayıp yanıt düşmeden bağlantı koptuysa (veya nonce eskiyse) sepeti doğrular;
   * ürün zaten eklenmişse başarı akışına geçer — gereksiz "bağlantı hatası" engellenir.
   */
  function tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, onFailure) {
    if (typeof jQuery === "undefined") {
      onFailure();
      return;
    }
    const uniqueInput = form.querySelector('input[name="unique_submission_key"]');
    const uniqueKey = uniqueInput && uniqueInput.value;
    if (!uniqueKey) {
      onFailure();
      return;
    }

    const runVerify = () => {
      jQuery.ajax({
        url: wdp_ajax.ajax_url,
        type: "POST",
        data: {
          action: "wdp_verify_submission_in_cart",
          security: getAjaxNonce("ajax_add_to_cart"),
          unique_submission_key: uniqueKey,
        },
        dataType: "json",
        success: (verifyData) => {
          if (verifyData && verifyData.success && verifyData.in_cart) {
            handleAjaxResponse(
              {
                success: true,
                message: verifyData.message,
                cart_count: verifyData.cart_count,
                items: verifyData.items,
                checkout_url: verifyData.checkout_url,
                cart_item_key: verifyData.cart_item_key,
                product_id: verifyData.product_id,
                meta_cart_line: verifyData.meta_cart_line,
              },
              form,
              isCheckout,
              addToCartBtn,
              checkoutBtn
            );
          } else {
            onFailure();
          }
        },
        error: () => {
          onFailure();
        },
      });
    };

    if (refreshWdpAjaxNonces && typeof refreshWdpAjaxNonces === "function") {
      refreshWdpAjaxNonces({ force: true })
        .then(() => runVerify())
        .catch(() => runVerify());
    } else {
      runVerify();
    }
  }

  function submitFormData(form, isCheckout) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $form = (sel) => form.querySelector(sel);
    
    safeLog("Submitting form data...", isCheckout ? "Ödemeye Git" : "Sepete Ekle");
    clearAlerts();

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.syncE164FieldsInForm === 'function') {
      WDPApp.phoneInput.syncE164FieldsInForm(form);
    }
    
    // CRITICAL: Hissedar formlarında quantity'yi shareCount'a göre güncelle (FormData oluşturulmadan önce)
    const shareCountInput = $form('input[name="share_count"]');
    const effectiveShareCount = shareCountInput ? getEffectiveShareCount(form) : 1;
    if (shareCountInput) {
      const shareCount = effectiveShareCount;
      const quantityInput = $form('input[name="quantity"]');
      if (quantityInput && shareCount > 0) {
        // Quantity değerini hisse adedi ile güncelle - hissedar sayısına göre otomatik ayarla
        quantityInput.value = shareCount;
        safeLog("Quantity güncellendi - ShareCount:", shareCount, "-> Quantity:", quantityInput.value);
      }
    }
    
    const formData = new FormData(form);
    patchSimpleCustomPriceQtyRowFormData(form, formData);

    // CRITICAL: Hissedar formlarında fiyatı hisse sayısına göre güncelle
    if (shareCountInput) {
      const shareCount = effectiveShareCount;
      const priceInput = $form('input[name="custom_price"]');
      
      if (priceInput) {
        // Base price'ı al (dataset'ten veya mevcut fiyattan)
        const baseMinValue = Number.parseFloat((priceInput.dataset.baseMin || '').toString().trim());
        const currentPriceValue = Number.parseFloat((priceInput.value || '').toString().trim());
        
        let basePrice = baseMinValue;
        
        // Eğer baseMin yoksa, mevcut fiyatı hisse sayısına böl
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          if (Number.isFinite(currentPriceValue) && currentPriceValue > 0 && shareCount > 0) {
            basePrice = currentPriceValue / shareCount;
          }
        }
        
        // CRITICAL: Hissedar formlarında base price'ı gönder (quantity ile çarpılacak)
        // Form'da gösterilen fiyat toplam fiyat olabilir ama sepete base price gönderilmeli
        // Dinamik: Kaç hissedar bilgisi doldurulduysa (shareCount), o kadar adet ürün sepete eklenecek
        // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
        if (Number.isFinite(basePrice) && basePrice > 0) {
          // Form'da gösterilen toplam fiyatı güncelle (kullanıcı görsün)
          // Dinamik hesaplama: basePrice × shareCount (hissedar sayısı)
          const totalPrice = basePrice * shareCount;
          const roundedTotalPrice = Number.isInteger(totalPrice) ? totalPrice.toFixed(0) : totalPrice.toFixed(2);
          priceInput.value = roundedTotalPrice;
          
          // Ama sepete BASE PRICE gönder (quantity ile çarpılacak)
          // PHP tarafında: subtotal = custom_price × quantity (quantity = shareCount)
          const roundedBasePrice = Number.isInteger(basePrice) ? basePrice.toFixed(0) : basePrice.toFixed(2);
          formData.set('custom_price', roundedBasePrice);
          safeLog("Fiyat hesaplandı - Base:", basePrice, "x Quantity (ShareCount):", shareCount, "= Total:", totalPrice, "-> Sepete base price gönderiliyor:", roundedBasePrice);
        } else if (shareCount > 1) {
          // Base price bulunamadıysa ve hisse sayısı > 1 ise uyarı ver
          safeLog("WARNING: Base price not found for share count:", shareCount);
        }
      }
      
      // CRITICAL: Quantity'yi shareCount olarak ayarla (sepette doğru miktar gösterilsin)
      // Dinamik: Kaç hissedar bilgisi doldurulduysa, o kadar adet ürün sepete eklenecek
      // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
      formData.set('quantity', shareCount);
      safeLog("FormData'ya quantity eklendi (ShareCount):", shareCount, "- Bu, sepette", shareCount, "adet ürün anlamına gelir");
      
      // Hissedar bilgilerini ekle
      for (let i = 1; i <= shareCount; i++) {
        const name = $form(`[name='shareholder_name_${i}']`);
        const phone = $form(`[name='shareholder_phone_${i}']`);
        const email = $form(`[name='shareholder_email_${i}']`);
        const note = $form(`[name='shareholder_note_${i}']`);
        if (name) formData.set(`shareholder_name_${i}`, name.value);
        if (phone) formData.set(`shareholder_phone_${i}`, phone.value);
        if (email) formData.set(`shareholder_email_${i}`, email.value);
        if (note) formData.set(`shareholder_note_${i}`, note.value);
      }
    }

    // "Ödemeye Git" butonu için bayrak ekle
    if (isCheckout) {
      formData.append("donation_go_checkout", "1");
    }

    // AJAX ile sepete ekleme işlemi
    formData.append("action", "wdp_ajax_add_to_cart");
    formData.append("security", getAjaxNonce("ajax_add_to_cart"));
    formData.append("wdp_ajax_flow", "1");
    formData.append("timestamp", Date.now());

    // Butonları bul
    const addToCartBtn = $form('button[name="donation_add_to_cart"]');
    const checkoutBtn = $form('button[name="donation_go_checkout"]');

    // Form verilerini URL kodlamasına dönüştür
    const formDataUrlEncoded = new URLSearchParams();
    const debugPayload = wdp_ajax && (wdp_ajax.debug === true || wdp_ajax.debug === 1 || wdp_ajax.debug === "1");
    const sensitiveField = (name) => {
      const n = String(name).toLowerCase();
      if (n.indexOf("shareholder_") === 0) {
        return true;
      }
      return n === "donation_full_name" || n === "donation_phone" || n === "donation_note";
    };
    for (const pair of formData.entries()) {
      if (debugPayload) {
        safeLog(
          "Form data: " + pair[0] + ": " + (sensitiveField(pair[0]) ? "[gizlendi]" : pair[1])
        );
      }
      formDataUrlEncoded.append(pair[0], pair[1]);
    }

    // Mevcut side cart elementlerini kaydet
    saveSideCartElements();

    safeLog("AJAX isteği gönderiliyor:", wdp_ajax.ajax_url);

    // Hata mesajı alanını bul ve gizle - Başlangıçta hata mesajını gizle (fonksiyon scope içindeki $form helper kullan)
    const errorMsg = $form(".wdp-form-error");
    if (errorMsg) {
      errorMsg.style.display = "none";
      errorMsg.textContent = "";
    }

    // Alternatif olarak jQuery AJAX kullan (daha güvenilir olabilir)
    if (typeof jQuery !== "undefined") {
      safeLog("Using jQuery AJAX");
      jQuery.ajax({
        url: wdp_ajax.ajax_url,
        type: "POST",
        data: formDataUrlEncoded.toString(),
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        beforeSend: () => {
          safeLog("jQuery AJAX request starting...");
        },
        success: (data) => {
          safeLog("jQuery AJAX success:", data);
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        },
        error: (jqXHR, textStatus, errorThrown) => {
          safeLog("jQuery AJAX error:", { textStatus, errorThrown, status: jqXHR.status });

          const rescued = parseWdpAjaxResponseText(jqXHR.responseText);
          if (rescued) {
            handleAjaxResponse(rescued, form, isCheckout, addToCartBtn, checkoutBtn);
            return;
          }

          const finishWithTransportError = () => {
            safeLog("AJAX taşıma / yanıt hatası — kurtarma sonrası veya kurtarma atlandı", jqXHR.status, textStatus);
            // Gerçek hata: sunucu mesajı (success:false) zaten success callback'te gösterilir.
            // Burada yanıt okunamadı veya ağ kopması var — kullanıcıya mutlaka bildir (sessiz kalma).
            handleAjaxError(errorThrown || new Error(textStatus || "error"), form, addToCartBtn, checkoutBtn);
          };

          if (shouldAttemptCartRecoveryFromJqXHR(jqXHR, textStatus)) {
            tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, finishWithTransportError);
          } else {
            finishWithTransportError();
          }
        },
        complete: () => {
          safeLog("jQuery AJAX request completed");
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          setFormProcessing(form, false);

          // Butonları tekrar aktif et (her ihtimale karşı)
          setTimeout(() => {
            if (addToCartBtn) {
              addToCartBtn.disabled = false;
              addToCartBtn.classList.remove("wdp-loading");
            }
            if (checkoutBtn) {
              checkoutBtn.disabled = false;
              checkoutBtn.classList.remove("wdp-loading");
            }
          }, 2000);

          // Side cart: gecikme yok — bir sonraki frame'de görünürlük (AJAX tamamı anında)
          requestAnimationFrame(() => {
            showSideCarts();
          });
        },
      });
    } else {
      // Fetch API ile AJAX isteği gönder
      safeLog("Using Fetch API");
      fetch(wdp_ajax.ajax_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: formDataUrlEncoded.toString(),
        credentials: "same-origin",
        cache: "no-cache",
      })
        .then((response) => {
          safeLog("Fetch response received:", { status: response.status, ok: response.ok });
          if (!response.ok && response.status !== 200) {
            const httpErr = new Error(`HTTP error! Status: ${response.status}`);
            httpErr.status = response.status;
            throw httpErr;
          }
          return response.text().then((text) => {
            safeLog("Response text:", text.substring(0, 200)); // İlk 200 karakter
            const loose = parseWdpAjaxResponseText(text);
            if (loose) {
              return loose;
            }
            try {
              return JSON.parse(text);
            } catch (e) {
              safeLog("JSON parse error:", e);
              const parseErr = new Error("INVALID_JSON_RESPONSE");
              parseErr.status = response.status;
              parseErr.wdpRecoverCart = true;
              throw parseErr;
            }
          });
        })
        .then((data) => {
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        })
        .catch((error) => {
          safeLog("Fetch error:", error);
          const afterRecoverOrShowError = () => {
            handleAjaxError(error, form, addToCartBtn, checkoutBtn);
          };

          if (shouldAttemptCartRecoveryFromFetchError(error) && typeof jQuery !== "undefined") {
            tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, afterRecoverOrShowError);
          } else {
            afterRecoverOrShowError();
          }
        })
        .finally(() => {
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          setFormProcessing(form, false);

          // Butonları tekrar aktif et (her ihtimale karşı)
          setTimeout(() => {
            if (addToCartBtn) {
              addToCartBtn.disabled = false;
              addToCartBtn.classList.remove("wdp-loading");
            }
            if (checkoutBtn) {
              checkoutBtn.disabled = false;
              checkoutBtn.classList.remove("wdp-loading");
            }
          }, 2000);

          // Side cart: gecikme yok — bir sonraki frame'de görünürlük (AJAX tamamı anında)
          requestAnimationFrame(() => {
            showSideCarts();
          });
        });
    }
  }

  function directFormSubmit(form, isCheckout) {
    safeLog("Direct form submit:", isCheckout ? "Checkout" : "Add to Cart");

    // Form doğrulama
    if (!validateForm(form)) {
      safeLog("Form validation failed");
      return false;
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.syncE164FieldsInForm === 'function') {
      WDPApp.phoneInput.syncE164FieldsInForm(form);
    }

    // Hisse adedi varsa, quantity değerini kontrol et ve güncelle
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = getEffectiveShareCount(form);
      const quantityInput = form.querySelector('input[name="quantity"]');

      if (quantityInput && shareCount > 0) {
        // Quantity değerini hisse adedi ile güncelle - hissedar sayısına göre otomatik ayarla
        quantityInput.value = shareCount;
      }
    }

    const simpleCustomQtyRow = form.querySelector(".wdp-custom-price-with-qty-row");
    if (simpleCustomQtyRow && !shareCountInput) {
      const priceInput = simpleCustomQtyRow.querySelector('input[name="custom_price"]');
      const qEl = simpleCustomQtyRow.querySelector('input[name="quantity"]');
      if (priceInput && qEl) {
        const q = Number.parseInt(qEl.value, 10) || 1;
        let unit = Number.parseFloat(priceInput.dataset.wdpCustomUnit);
        if (!Number.isFinite(unit) || unit <= 0) {
          const total = parseNormalizedAmount(priceInput.value);
          if (Number.isFinite(total) && total > 0 && q > 0) {
            unit = roundMoney(total / q);
          }
        }
        if (Number.isFinite(unit) && unit > 0) {
          priceInput.value = formatSubmitUnitPrice(unit);
        }
      }
    }

    // "Ödemeye Git" butonu için bayrak ekle
    if (isCheckout) {
      const checkoutInput = document.createElement("input");
      checkoutInput.type = "hidden";
      checkoutInput.name = "donation_go_checkout";
      checkoutInput.value = "1";
      form.appendChild(checkoutInput);
    }

    // Form action ve method ayarla
    form.action = wdp_ajax.ajax_url;
    form.method = "post";

    // AJAX ile sepete ekleme işlemi için gerekli alanları ekle
    const actionInput = document.createElement("input");
    actionInput.type = "hidden";
    actionInput.name = "action";
    actionInput.value = "wdp_ajax_add_to_cart";
    form.appendChild(actionInput);

    const securityInput = document.createElement("input");
    securityInput.type = "hidden";
    securityInput.name = "security";
    securityInput.value = getAjaxNonce("ajax_add_to_cart");
    form.appendChild(securityInput);

    const timestampInput = document.createElement("input");
    timestampInput.type = "hidden";
    timestampInput.name = "timestamp";
    timestampInput.value = Date.now();
    form.appendChild(timestampInput);

    // Formu gönder
    safeLog("Submitting form directly");
    form.submit();

    return true;
  }

  function setupFormSubmission(form) {
    safeLog("Form submission setup for:", form);

    bindProductQuantityDelegation(form);

    // Önceki dinleyiciyi kaldır (event-manager veya tekrar setup çağrıları çift AJAX üretmesin)
    if (form._wdpSubmitHandler) {
      form.removeEventListener("submit", form._wdpSubmitHandler, WDP_FORM_SUBMIT_CAPTURE);
      form._wdpSubmitHandler = null;
    }

    function onWdpFormSubmit(e) {
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      safeLog("Form submitted");

      // Önce tüm hata mesajlarını gizle
      if (typeof window.WDP !== "undefined" && typeof window.WDP.hideErrorMessages === "function") {
        window.WDP.hideErrorMessages();
      }

      // Hata mesajı alanını hemen temizle
      const errorDiv = form.querySelector(".wdp-form-error");
      if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.textContent = "";
      }

      // WooCommerce hata mesajlarını da gizle
      const wooMessages = document.querySelectorAll(".woocommerce-error, .woocommerce-message, .woocommerce-info");
      wooMessages.forEach((msg) => {
        msg.style.display = "none";
      });

      // Hangi butonun tıklandığını belirle
      const isCheckout = e.submitter && e.submitter.name === "donation_go_checkout";
      safeLog("Is checkout:", isCheckout);

      // Rendered shareholder rows are source-of-truth; sync share_count before validation.
      ensureShareholderRowsReady(form);
      getEffectiveShareCount(form);

      // Form doğrulama
      if (!validateForm(form)) {
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
        checkoutBtn.classList.add("wdp-loading");
        // Diğer butona loading sınıfı eklenmediğinden emin ol
        if (addToCartBtn) addToCartBtn.classList.remove("wdp-loading");
      } else if (addToCartBtn) {
        addToCartBtn.classList.add("wdp-loading");
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
    }

    form._wdpSubmitHandler = onWdpFormSubmit;
    form.addEventListener("submit", form._wdpSubmitHandler, WDP_FORM_SUBMIT_CAPTURE);

    // Input alanlarına olay dinleyicileri ekle
    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]').forEach((input) => {
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

      // Özel fiyat alanı için minimum değer kontrolü - optimized with debounce
      if (input.name === "custom_price") {
        const customQtyRow = input.closest(".wdp-custom-price-with-qty-row");
        if (customQtyRow) {
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
              const row = this.closest(".wdp-custom-price-with-qty-row");
              const qEl = row && row.querySelector('input[name="quantity"]');
              const qty = qEl ? Number.parseInt(qEl.value, 10) || 1 : 1;
              ensureCustomUnitFromDisplayed(this, qty);
            });
          }
          function runCustomQtyRowBlur() {
            const row = this.closest(".wdp-custom-price-with-qty-row");
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
              inputError.textContent = `Lütfen ${formatCurrency(minTotal)} ve üstü toplam tutar girin.`;
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
        
        const blurHandler = createMinPriceBlurHandler((minPrice) => `Lütfen ${minPrice} TL ve üstü değerler girin.`);
        const debouncedBlurHandler = debounce ? debounce(blurHandler, 300) : blurHandler;
        
        if (input.dataset.wdpCustomPriceBlurBound !== '1') {
          input.dataset.wdpCustomPriceBlurBound = '1';
          input.addEventListener("blur", debouncedBlurHandler);
        }
        if (String(input.value || "").trim() === "") {
          const minPrice = Number.parseFloat(input.getAttribute("min") || 0);
          if (Number.isFinite(minPrice) && minPrice > 0) {
            input.placeholder = "Min: " + minPrice + " TL";
          }
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

  // Export
  WDPApp.form = {
    setup: setupFormSubmission,
    submit: submitFormData,
    validate: validateForm,
    showInputError,
    showFormError,
    handleAjaxResponse,
    handleAjaxError,
    directSubmit: directFormSubmit,
    updateLineTotals,
  };

  // Export form module

})(window);

