/**
 * @file validate.js
 * Bağış formu doğrulama: hissedar, telefon, tutar ve odak yönetimi.
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const formMessages = WDPApp.formMessages || {};
  const formPricing = WDPApp.formPricing || {};
  const formFeedback = WDPApp.formFeedback || {};
  const formSadaka = WDPApp.formSadaka || {};

  const formatCurrency = typeof utils.formatCurrency === 'function' ? utils.formatCurrency.bind(utils) : function(n) { return String(n); };
  const safeLog = typeof utils.safeLog === 'function' ? utils.safeLog.bind(utils) : function() {};
  const announceStatus = typeof utils.announceStatus === 'function' ? utils.announceStatus.bind(utils) : function() {};
  const clearAlerts = typeof utils.clearAlerts === 'function' ? utils.clearAlerts.bind(utils) : function() {};

  function showInputError(input, message) {
    if (typeof formFeedback.showInputError === 'function') {
      formFeedback.showInputError(input, message);
    }
  }

  function showShareholderValidationFeedback(form, summaryLines, fallbackMessage) {
    if (typeof formFeedback.showShareholderValidationFeedback === 'function') {
      formFeedback.showShareholderValidationFeedback(form, summaryLines, fallbackMessage);
    }
  }

  function isCompactShareholderViewport() {
    if (typeof formFeedback.isCompactShareholderViewport === 'function') {
      return formFeedback.isCompactShareholderViewport();
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(max-width: 768px)').matches;
    }
    return false;
  }

  function parseNormalizedAmount(raw) {
    return typeof formPricing.parseNormalizedAmount === 'function'
      ? formPricing.parseNormalizedAmount(raw)
      : NaN;
  }

  function customPriceRowHasQtyCounter(row) {
    return typeof formPricing.customPriceRowHasQtyCounter === 'function'
      ? formPricing.customPriceRowHasQtyCounter(row)
      : false;
  }

  function validateSadakaDonation(form) {
    return typeof formSadaka.validateSadakaDonation === 'function'
      ? formSadaka.validateSadakaDonation(form)
      : true;
  }

  function getDonorNameRequiredMessage() {
    if (typeof formMessages.getDonorNameRequiredMessage === 'function') {
      return formMessages.getDonorNameRequiredMessage();
    }
    return 'Ad Soyad zorunludur.';
  }

  function getShareholderNameRequiredMessage() {
    if (typeof formMessages.getShareholderNameRequiredMessage === 'function') {
      return formMessages.getShareholderNameRequiredMessage();
    }
    return 'Hissedar adı zorunludur.';
  }

  function getRequiredFieldMessage(field) {
    if (typeof formMessages.getRequiredFieldMessage === 'function') {
      return formMessages.getRequiredFieldMessage(field);
    }
    return 'Bu alan zorunludur';
  }

  function getPhoneRequiredMessage() {
    if (typeof formMessages.getPhoneRequiredMessage === 'function') {
      return formMessages.getPhoneRequiredMessage();
    }
    return getPhoneIncompleteMessage();
  }

  function getPhoneIncompleteMessage() {
    if (typeof formMessages.getPhoneIncompleteMessage === 'function') {
      return formMessages.getPhoneIncompleteMessage();
    }
    return 'Telefon numaranızı eksiksiz giriniz.';
  }

  function getPhoneValidationState(input, options) {
    if (typeof formMessages.getPhoneValidationState === 'function') {
      return formMessages.getPhoneValidationState(input, options);
    }
    return { ok: true, message: '' };
  }

  /** Tek telefon alanını doğrular; hata varsa satır içi mesaj gösterir. */
  function validatePhoneInputInForm(form, input, options) {
    const state = getPhoneValidationState(input, options);
    if (!state.ok && !(options && options.silent)) {
      showInputError(input, state.message);
    }
    return state.ok;
  }

  /** Formdaki tüm telefon alanlarını (bağışçı + hissedar) sırayla doğrular. */
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
    if (typeof formMessages.getShareholderIssueSummaryLabel === 'function') {
      return formMessages.getShareholderIssueSummaryLabel(type);
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

  /** Tek hissedar kartındaki ad ve telefon alanlarını doğrular. */
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


  

  /** Render edilen kart sayısı ile share_count input değerinden geçerli hisse adedini hesaplar. */
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

  /** Doğrulama öncesi eksik hissedar kartlarını shareholder modülü ile oluşturur. */
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

  /** Hatalı hissedar kartını açar, scroll eder ve ilgili alana odaklanır. */
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
      if (typeof utils.scrollIntoViewSafe === "function") {
        utils.scrollIntoViewSafe(row, { behavior: "smooth", block: "center", inline: "nearest" });
      } else {
        row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
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
    if (typeof utils.scrollIntoViewSafe === "function") {
      utils.scrollIntoViewSafe(section, { behavior: "smooth", block: "nearest" });
    } else {
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /**
   * Tüm zorunlu alanları, telefonu, fiyatı ve hissedar satırlarını doğrular.
   * @returns {boolean} Geçerliyse true.
   */
  function validateForm(form) {
    safeLog("validateForm called");
    let isValid = true;
    let errorMessages = [];
    ensureShareholderRowsReady(form);

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.ensureNationalDisplayInForm === 'function') {
      WDPApp.phoneInput.ensureNationalDisplayInForm(form);
    }

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
      const phoneMsg = getPhoneIncompleteMessage();
      if (!errorMessages.includes(phoneMsg)) {
        errorMessages.push(phoneMsg);
      }
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
        } else {
          const badDonorPhone = form.querySelector(
            'input[name="donation_phone"].wdp-error, input[type="tel"].wdp-error'
          );
          if (badDonorPhone && !errorMessages.includes(phoneMsg)) {
            errorMessages.push(phoneMsg);
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
      const sadakaErr = form.querySelector('[data-wdp-sadaka-donation] .wdp-input-error');
      const sadakaMsg =
        sadakaErr && sadakaErr.textContent
          ? sadakaErr.textContent.trim()
          : (typeof formMessages.getSadakaInvalidMessage === 'function'
              ? formMessages.getSadakaInvalidMessage()
              : 'Lütfen sadaka tutarını kontrol edin.');
      if (sadakaMsg && !errorMessages.includes(sadakaMsg)) {
        errorMessages.push(sadakaMsg);
      }
    }

    errorMessages = Array.from(new Set(errorMessages));
    if (!isValid && !errorMessages.length) {
      const collected =
        typeof formFeedback.collectVisibleFieldErrorMessages === 'function'
          ? formFeedback.collectVisibleFieldErrorMessages(form)
          : [];
      if (collected && collected.length) {
        errorMessages = collected.slice();
      } else {
        errorMessages.push(getPhoneIncompleteMessage());
      }
    }
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
      // Always expand/focus the first invalid shareholder row — including collapsed cards.
      const focusIssue = firstOpenShareholderIssue || firstShareholderIssue;
      const shareholderFocused = focusIssue ? focusShareholderIssue(focusIssue) : false;
      if (!shareholderFocused) {
        if (incompleteShareholderCount > 0) {
          focusShareholderSection(form);
        }
        focusFirstInvalidField(form);
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

  /** İlk .wdp-error alanına odaklanır ve görünür alana kaydırır. */
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
        if (typeof utils.scrollIntoViewSafe === "function") {
          utils.scrollIntoViewSafe(anchor, { behavior: "smooth", block: "nearest" });
        } else {
          anchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    });
  }


  WDPApp.formValidate = {
    validateForm: validateForm,
    getEffectiveShareCount: getEffectiveShareCount,
    focusFirstInvalidField: focusFirstInvalidField,
    validateAllPhoneFields: validateAllPhoneFields,
    validatePhoneInputInForm: validatePhoneInputInForm,
    validateShareholderRow: validateShareholderRow,
    focusShareholderIssue: focusShareholderIssue,
    getOrderedShareholderRows: getOrderedShareholderRows,
    ensureShareholderRowsReady: ensureShareholderRowsReady,
    getDonorNameRequiredMessage: getDonorNameRequiredMessage,
    getShareholderNameRequiredMessage: getShareholderNameRequiredMessage,
    getRequiredFieldMessage: getRequiredFieldMessage,
    getPhoneValidationState: getPhoneValidationState,
  };
})(window);
