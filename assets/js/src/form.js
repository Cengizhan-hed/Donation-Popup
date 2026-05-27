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
 * - utils.js (clearAlerts — legacy overlay cleanup)
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
  
  const cartCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('cart', ['fetchContents', 'updateCountElements', 'createItemsHTML', 'renderItemsInto', 'setupContinueShoppingButton', 'updateWooCommerce', 'saveSideCartElements', 'showSideCarts'])
    : { module: WDPApp.cart || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const cart = cartCheck.module;
  const { productPrices, originalForms } = state;
  const { formatCurrency, getAjaxNonce, announceStatus, safeLog, escapeHtml, debounce, mergeWdpAjaxNonces, refreshWdpAjaxNonces, clearAlerts } = utils;
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

  function resolveSubmitSubmitter(form, event) {
    if (event && event.submitter) {
      return event.submitter;
    }
    if (form && form._wdpLastClickSubmitter) {
      return form._wdpLastClickSubmitter;
    }
    return null;
  }

  function showShareholderValidationFeedback(form, summaryLines, fallbackMessage) {
    const lines = Array.isArray(summaryLines)
      ? summaryLines.filter((line) => typeof line === 'string' && line.trim())
      : [];
    const primary =
      lines.length > 0
        ? lines[0]
        : (typeof fallbackMessage === 'string' && fallbackMessage.trim()
            ? fallbackMessage.trim()
            : 'Lütfen işaretlenen alanları kontrol edin.');
    ensureVisibleValidationFeedback(form, lines.length ? lines : [primary]);
  }

  function isCompactShareholderViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function scrollShareholderValidationIntoView(input) {
    if (!input || typeof input.closest !== 'function') {
      return;
    }
    const shareholderForm = input.closest('.wdp-shareholder-form');
    if (!shareholderForm) {
      return;
    }
    const scrollRoot =
      shareholderForm.closest('.wdp-shareholders-scroll') ||
      shareholderForm.closest('.wdp-shareholders-area');
    const anchor =
      getInputErrorAnchor(input) ||
      input.closest('.wdp-field-stack__row') ||
      input;
    if (!scrollRoot || !anchor) {
      return;
    }
    window.requestAnimationFrame(() => {
      try {
        anchor.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } catch (eScroll1) {
        try {
          anchor.scrollIntoView(false);
        } catch (eScroll2) {
          /* ignore */
        }
      }
      if (isCompactShareholderViewport()) {
        const footerZone = (shareholderForm.closest('form') || document).querySelector(
          '.wdp-side-panel-footer-zone, .wdp-button-group'
        );
        if (footerZone && typeof footerZone.scrollIntoView === 'function') {
          window.setTimeout(() => {
            try {
              footerZone.scrollIntoView({ block: 'end', behavior: 'smooth' });
            } catch (eFooter) {
              /* ignore */
            }
          }, 160);
        }
      }
    });
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
    return getPhoneIncompleteMessage();
  }

  function getPhoneIncompleteMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.phone_incomplete === 'string' && s.phone_incomplete.trim()) {
      return s.phone_incomplete.trim();
    }
    return 'Telefon numaranızı eksiksiz giriniz.';
  }

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

  function validatePhoneInputInForm(form, input, options) {
    const state = getPhoneValidationState(input, options);
    if (!state.ok && !(options && options.silent)) {
      showInputError(input, state.message);
    }
    return state.ok;
  }

  function validateAllPhoneFields(form, options) {
    const includeShareholders = !(options && options.shareholders === false);
    const selector = includeShareholders
      ? 'input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]'
      : 'input[type="tel"][name="donation_phone"]';
    let allOk = true;
    form.querySelectorAll(selector).forEach((input) => {
      const required =
        input.name === 'donation_phone' ||
        (input.name && input.name.indexOf('shareholder_phone_') === 0);
      if (!validatePhoneInputInForm(form, input, { required: required })) {
        allOk = false;
      }
    });
    return allOk;
  }

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

  function clearShareholderHeaderStatusMarks(form) {
    if (!form) {
      return;
    }
    form.querySelectorAll('.wdp-shareholder-header').forEach((header) => {
      header.classList.remove('wdp-header-status-valid', 'wdp-header-status-invalid');
    });
  }

  function validateShareholderRow(shareholderForm) {
    const rowIndex = Number.parseInt(shareholderForm.getAttribute('data-index') || '0', 10) || 0;
    const nameField = shareholderForm.querySelector('input[name^="shareholder_name_"]');
    const phoneField = shareholderForm.querySelector('input[name^="shareholder_phone_"]');
    const isCollapsed = shareholderForm.classList.contains('collapsed');
    const issues = [];

    if (nameField && !nameField.value.trim()) {
      issues.push({
        type: 'name',
        field: nameField,
        message: `${rowIndex}. ${getShareholderNameRequiredMessage()}`,
      });
    }
    if (phoneField) {
      const phoneState = getPhoneValidationState(phoneField, { required: true });
      if (!phoneState.ok) {
        issues.push({
          type: 'phone',
          field: phoneField,
          message: phoneState.message,
        });
      }
    }

    issues.forEach((issue) => {
      showInputError(issue.field, issue.message);
    });

    return {
      rowIndex: rowIndex > 0 ? rowIndex : 1,
      row: shareholderForm,
      isCollapsed,
      issues,
    };
  }

  function getSadakaInvalidMessage() {
    const s = wdp_ajax && wdp_ajax.strings;
    if (s && typeof s.sadaka_invalid === 'string' && s.sadaka_invalid.trim()) {
      return s.sadaka_invalid.trim();
    }
    return 'Geçerli bir alt bağış tutarı giriniz.';
  }

  function getSadakaMinErrorMessage(minValue) {
    const s = wdp_ajax && wdp_ajax.strings;
    const prefix =
      s && typeof s.sadaka_min_error === 'string' && s.sadaka_min_error.trim()
        ? s.sadaka_min_error.trim()
        : 'Alt bağış için minimum tutar: ';
    return prefix + formatCurrency(minValue);
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
    // Sabit fiyatlı ürünlerde sadaka alanı ana custom_price POST anahtarına karışmasın.
    if (!hasMainCustomPrice) {
      formData.delete('custom_price');
    }
  }

  let sadakaDonationDelegationBound = false;

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
      if (input) {
        input.value = '';
        clearSadakaInputErrors(input);
      }
    }
  }

  function ensureSadakaDonationDelegation() {
    if (sadakaDonationDelegationBound) {
      return;
    }
    sadakaDonationDelegationBound = true;

    document.addEventListener('click', function (e) {
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

    document.addEventListener('input', function (e) {
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

  function getCustomPriceRow(form) {
    if (!form) {
      return null;
    }
    return (
      form.querySelector(".wdp-custom-price-row") ||
      form.querySelector(".wdp-custom-price-with-qty-row")
    );
  }

  function customPriceRowHasQtyCounter(row) {
    return !!(row && row.querySelector('.wdp-quantity-counter input[name="quantity"]'));
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
    const row = getCustomPriceRow(form);
    if (!row || !customPriceRowHasQtyCounter(row)) return;
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
      const customRow = getCustomPriceRow(form);
      if (customRow && customPriceRowHasQtyCounter(customRow) && customRow.contains(quantityInput)) {
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
    const row = getCustomPriceRow(form);
    if (!row) return;
    const priceInput = row.querySelector('input[name="custom_price"]');
    if (!priceInput) return;
    if (!customPriceRowHasQtyCounter(row)) {
      formData.set('quantity', '1');
      return;
    }
    const qEl = row.querySelector('input[name="quantity"]');
    if (!qEl) return;
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
    if (input.closest('.wdp-shareholder-form')) {
      scrollShareholderValidationIntoView(input);
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
    form.classList.remove('wdp-shareholders-validation-active');
    clearShareholderHeaderStatusMarks(form);
    if (WDPApp.shareholder && typeof WDPApp.shareholder.clearSubmitSummary === 'function') {
      WDPApp.shareholder.clearSubmitSummary(form);
    }

    // Önceki merkezi alert overlay (artık doğrulama için kullanılmıyor)
    clearAlerts();

    // Hisse adedi kontrolü
    const shareCountInput = form.querySelector('input[name="share_count"]');
    const shareholderRows = getOrderedShareholderRows(form);
    let firstShareholderIssue = null;
    let firstOpenShareholderIssue = null;
    let incompleteShareholderCount = 0;
    const collapsedShareholderSummaryLines = [];
    const shareholderSubmitSummaryLines = [];
    const compactViewport = isCompactShareholderViewport();
    const hasShareholderRows = shareholderRows && shareholderRows.length > 0;
    if (shareCountInput || hasShareholderRows) {
      getEffectiveShareCount(form);
      safeLog("Checking shareholder forms for count:", shareholderRows.length);

      shareholderRows.forEach((shareholderForm) => {
        const rowResult = validateShareholderRow(shareholderForm);
        if (!rowResult.issues.length) {
          return;
        }
        incompleteShareholderCount += 1;
        isValid = false;
        rowResult.issues.forEach((issue) => {
          if (!errorMessages.includes(issue.message)) {
            errorMessages.push(issue.message);
          }
        });
        if (!firstShareholderIssue) {
          firstShareholderIssue = {
            row: shareholderForm,
            field: rowResult.issues[0].field,
          };
        }
        if (!rowResult.isCollapsed && !firstOpenShareholderIssue) {
          firstOpenShareholderIssue = {
            row: shareholderForm,
            field: rowResult.issues[0].field,
          };
        }
        rowResult.issues.forEach((issue) => {
          const line = `${rowResult.rowIndex}. hisse ${getShareholderIssueSummaryLabel(issue.type)}`;
          if (rowResult.isCollapsed) {
            collapsedShareholderSummaryLines.push(line);
          }
          if (compactViewport) {
            shareholderSubmitSummaryLines.push(line);
          }
        });
      });
    }
    if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      const focusIssue = firstOpenShareholderIssue || firstShareholderIssue;
      const targetIndex =
        focusIssue && focusIssue.row
          ? Number.parseInt(focusIssue.row.getAttribute("data-index") || "0", 10) || 0
          : 0;
      WDPApp.shareholder.setValidationArmed(form, incompleteShareholderCount > 0, targetIndex);
    } else if (WDPApp.shareholder && typeof WDPApp.shareholder.refreshGuidance === "function") {
      WDPApp.shareholder.refreshGuidance(form);
    }
    if (incompleteShareholderCount > 1) {
      errorMessages.push(`${incompleteShareholderCount} hissedar formu eksik.`);
    }

    // Telefon: ülkeye göre rakam sayısı (TR: 10, vb.) — hissedar satırları yukarıda doğrulandı
    if (!validateAllPhoneFields(form, { shareholders: !hasShareholderRows })) {
      isValid = false;
      if (!firstShareholderIssue) {
        const badSharePhone = form.querySelector(
          '.wdp-shareholder-form input[name^="shareholder_phone_"].wdp-error'
        );
        if (badSharePhone) {
          firstShareholderIssue = {
            row: badSharePhone.closest('.wdp-shareholder-form'),
            field: badSharePhone,
          };
          if (
            firstShareholderIssue.row &&
            !firstShareholderIssue.row.classList.contains('collapsed') &&
            !firstOpenShareholderIssue
          ) {
            firstOpenShareholderIssue = firstShareholderIssue;
          }
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
      const customPriceQtyRow = customPriceInput.closest('.wdp-custom-price-row, .wdp-custom-price-with-qty-row');

      let effectiveMin = 0;
      if (customPriceQtyRow && customPriceRowHasQtyCounter(customPriceQtyRow)) {
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

    if (!validateSadakaDonation(form)) {
      isValid = false;
    }

    errorMessages = Array.from(new Set(errorMessages));
    safeLog("Form validation result:", { isValid, errorMessages });

    if (!isValid) {
      safeLog("Form is invalid; showing field-anchored errors only");
      if (firstShareholderIssue && firstShareholderIssue.row && incompleteShareholderCount > 0) {
        const firstRowIndex =
          Number.parseInt(firstShareholderIssue.row.getAttribute("data-index") || "0", 10) || 0;
        const summaryMsg = incompleteShareholderCount > 1
          ? `${incompleteShareholderCount} hissedar formu eksik.`
          : (firstRowIndex > 0 ? `${firstRowIndex}. hissedar formu eksik.` : "1 hissedar formu eksik.");
        if (!errorMessages.includes(summaryMsg)) {
          errorMessages.push(summaryMsg);
        }
      }
      const summaryLines = compactViewport
        ? Array.from(new Set(shareholderSubmitSummaryLines))
        : collapsedShareholderSummaryLines;
      if (
        summaryLines.length > 0 &&
        WDPApp.shareholder &&
        typeof WDPApp.shareholder.showSubmitSummary === 'function'
      ) {
        WDPApp.shareholder.showSubmitSummary(form, summaryLines, { compact: compactViewport });
      }
      if (hasShareholderRows) {
        form.classList.add('wdp-shareholders-validation-active');
      }
      const focusIssue = firstOpenShareholderIssue || (collapsedShareholderSummaryLines.length ? null : firstShareholderIssue);
      const shareholderFocused = focusIssue ? focusShareholderIssue(focusIssue) : false;
      if (!shareholderFocused) {
        if (incompleteShareholderCount > 0) {
          focusShareholderSection(form);
        }
        if (!collapsedShareholderSummaryLines.length) {
          focusFirstInvalidField(form);
        }
      }
      showShareholderValidationFeedback(
        form,
        summaryLines,
        errorMessages.length ? errorMessages[0] : 'Lütfen işaretlenen alanları kontrol edin.'
      );
      announceStatus(
        summaryLines.length
          ? summaryLines[0]
          : (errorMessages.length ? errorMessages[0] : "Lütfen işaretlenen alanları kontrol edin."),
        "assertive"
      );
    } else if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      WDPApp.shareholder.setValidationArmed(form, false, 0);
      if (typeof WDPApp.shareholder.clearSubmitSummary === 'function') {
        WDPApp.shareholder.clearSubmitSummary(form);
      }
      clearShareholderHeaderStatusMarks(form);
      form.classList.remove('wdp-shareholders-validation-active');
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
    patchSadakaFormData(form, formData);

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

    const simpleCustomRow = getCustomPriceRow(form);
    if (simpleCustomRow && !shareCountInput) {
      const priceInput = simpleCustomRow.querySelector('input[name="custom_price"]');
      if (priceInput && customPriceRowHasQtyCounter(simpleCustomRow)) {
        const qEl = simpleCustomRow.querySelector('input[name="quantity"]');
        if (qEl) {
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

    prepareDonationFormValidation(form);
    bindProductQuantityDelegation(form);
    bindSadakaDonation(form);

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
        showShareholderValidationFeedback(form, [], 'Lütfen işaretlenen alanları kontrol edin.');
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

  ensureSadakaDonationDelegation();

  // Export
  WDPApp.form = {
    setup: setupFormSubmission,
    submit: submitFormData,
    validate: validateForm,
    getPhoneValidationState,
    showInputError,
    showFormError,
    handleAjaxResponse,
    handleAjaxError,
    directSubmit: directFormSubmit,
    updateLineTotals,
  };

  // Export form module

})(window);

