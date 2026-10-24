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
  const clearAlerts = typeof utils.clearAlerts === 'function' ? utils.clearAlerts.bind(utils) : function() {};

  const GENERAL_VALIDATION_MESSAGE = WDPApp.i18n.__('Please check the highlighted fields.', 'woo-donation-popup');

  function showInputError(input, message) {
    // Canlı lookup: modül yükleme sırası / yeniden atama altında stale {} kalmasın
    const fb = WDPApp.formFeedback || formFeedback;
    if (fb && typeof fb.showInputError === 'function') {
      fb.showInputError(input, message);
    }
  }

  function showShareholderValidationFeedback(form, summaryLines, fallbackMessage) {
    const fb = WDPApp.formFeedback || formFeedback;
    if (fb && typeof fb.showShareholderValidationFeedback === 'function') {
      fb.showShareholderValidationFeedback(form, summaryLines, fallbackMessage);
    }
  }

  function showFormErrorBanner(form, message) {
    const fb = WDPApp.formFeedback || formFeedback;
    if (fb && typeof fb.showFormError === 'function') {
      fb.showFormError(form, message || GENERAL_VALIDATION_MESSAGE);
    }
  }

  function ensureVisibleValidationFeedback(form, errorMessages) {
    const fb = WDPApp.formFeedback || formFeedback;
    if (fb && typeof fb.ensureVisibleValidationFeedback === 'function') {
      fb.ensureVisibleValidationFeedback(form, errorMessages);
      return;
    }
    showFormErrorBanner(
      form,
      (errorMessages && errorMessages[0]) || GENERAL_VALIDATION_MESSAGE
    );
  }

  function fieldValueSnapshot(field) {
    if (!field) {
      return '';
    }
    try {
      return String(field.value == null ? '' : field.value).slice(0, 80);
    } catch (e) {
      return '';
    }
  }

  function storeLastValidation(result) {
    if (!WDPApp.formValidate) {
      WDPApp.formValidate = {};
    }
    WDPApp.formValidate.lastValidation = result;
    if (!WDPApp.form) {
      WDPApp.form = {};
    }
    WDPApp.form.lastValidation = result;
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
    return WDPApp.i18n.__('Full name is required.', 'woo-donation-popup');
  }

  function getShareholderNameRequiredMessage() {
    if (typeof formMessages.getShareholderNameRequiredMessage === 'function') {
      return formMessages.getShareholderNameRequiredMessage();
    }
    return WDPApp.i18n.__('Shareholder name is required.', 'woo-donation-popup');
  }

  function getRequiredFieldMessage(field) {
    if (typeof formMessages.getRequiredFieldMessage === 'function') {
      return formMessages.getRequiredFieldMessage(field);
    }
    return WDPApp.i18n.__('This field is required', 'woo-donation-popup');
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
    return WDPApp.i18n.__('Please enter your complete phone number.', 'woo-donation-popup');
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
      showInputError(input, state.message || getPhoneIncompleteMessage());
    }
    return state.ok;
  }

  /**
   * Formdaki tüm telefon alanlarını (bağışçı + hissedar) sırayla doğrular.
   * @returns {{ ok: boolean, failures: Array<{field:string,rule:string,value:string}> }}
   */
  function validateAllPhoneFields(form, options) {
    const includeShareholders = !(options && options.shareholders === false);
    const selector = includeShareholders
      ? 'input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]'
      : 'input[type="tel"][name="donation_phone"]';
    const failures = [];
    let allOk = true;
    form.querySelectorAll(selector).forEach((input) => {
      const required =
        input.name === 'donation_phone' ||
        (input.name && input.name.indexOf('shareholder_phone_') === 0);
      const state = getPhoneValidationState(input, { required: required });
      if (!state.ok) {
        allOk = false;
        const rule = state.message === getPhoneRequiredMessage() || !String(input.value || '').trim()
          ? 'phone_required'
          : 'phone_incomplete';
        failures.push({
          field: input.name || 'donation_phone',
          rule: rule,
          value: fieldValueSnapshot(input),
        });
        if (!(options && options.silent)) {
          showInputError(input, state.message || getPhoneIncompleteMessage());
        }
      }
    });
    if (options && options.collectFailures && Array.isArray(options.collectFailures)) {
      failures.forEach((f) => options.collectFailures.push(f));
    }
    return allOk;
  }

  function getShareholderIssueSummaryLabel(type) {
    if (typeof formMessages.getShareholderIssueSummaryLabel === 'function') {
      return formMessages.getShareholderIssueSummaryLabel(type);
    }
    return WDPApp.i18n.__('field is missing', 'woo-donation-popup');
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

  /** Hatalı alanı gizleyen hissedar kartı / sihirbaz adımını açar. */
  function revealInvalidFieldContainers(form) {
    if (!form) {
      return;
    }
    const invalids = Array.prototype.slice.call(form.querySelectorAll('.wdp-error, [aria-invalid="true"]'));
    const rows = new Set();
    invalids.forEach((el) => {
      const row = el.closest && el.closest('.wdp-shareholder-form');
      if (row) {
        rows.add(row);
      }
      let node = el;
      while (node && node !== form) {
        const isStep =
          node.classList &&
          (node.classList.contains('wdp-wizard-section') ||
            (node.getAttribute && node.getAttribute('data-wdp-step')));
        const isShareContent = node.classList && node.classList.contains('wdp-shareholder-content');
        if (
          (isStep || isShareContent) &&
          (node.hidden || (node.hasAttribute && node.hasAttribute('hidden')))
        ) {
          node.hidden = false;
          if (typeof node.removeAttribute === 'function') {
            node.removeAttribute('hidden');
          }
          if (typeof node.setAttribute === 'function') {
            node.setAttribute('aria-hidden', 'false');
          }
          if (node.classList) {
            node.classList.add('is-wdp-step-active');
          }
          if (isShareContent) {
            node.style.display = 'flex';
          }
        }
        node = node.parentNode;
      }
    });
    rows.forEach((row) => {
      row.classList.remove('collapsed');
      row.classList.add('is-active');
      const content = row.querySelector('.wdp-shareholder-content');
      if (content) {
        content.style.display = 'flex';
        content.hidden = false;
        if (typeof content.removeAttribute === 'function') {
          content.removeAttribute('hidden');
        }
      }
    });
    if (WDPApp.formWizard && typeof WDPApp.formWizard.revealInvalidSteps === 'function') {
      WDPApp.formWizard.revealInvalidSteps(form);
    }
    if (rows.size && WDPApp.shareholder && typeof WDPApp.shareholder.updateCollapsedCount === 'function') {
      const host = form.closest('.wdp-modal') || form.closest('.wdp-donation-form') || form;
      WDPApp.shareholder.updateCollapsedCount(host);
    }
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
    if (targetField && typeof targetField.focus === "function") {
      try {
        targetField.focus({ preventScroll: true });
      } catch (eSync) {
        try {
          targetField.focus();
        } catch (eSync2) {
          /* ignore */
        }
      }
    }
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
   * Dışa boolean döner (uyumluluk). Ayrıntı: WDPApp.form.lastValidation
   * @returns {boolean} Geçerliyse true.
   */
  function validateForm(form) {
    safeLog("validateForm called");
    // Ayrılmış/eski node yerine açık kabuktaki güncel form
    if (WDPApp.dom && typeof WDPApp.dom.getLiveDonationForm === 'function') {
      const live = WDPApp.dom.getLiveDonationForm(form);
      if (live) {
        form = live;
      }
    }
    const fbBatch = WDPApp.formFeedback || formFeedback;
    if (fbBatch && typeof fbBatch.beginErrorBatch === 'function') {
      fbBatch.beginErrorBatch();
    }
    try {
    let isValid = true;
    let errorMessages = [];
    /** @type {Array<{field:string,rule:string,value:string}>} */
    const failures = [];
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
          failures.push({
            field: (issue.field && issue.field.name) || ('shareholder_' + issue.type),
            rule: issue.type === 'phone' ? 'shareholder_phone' : 'shareholder_name_required',
            value: fieldValueSnapshot(issue.field),
          });
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
          const line = WDPApp.i18n.sprintf(
            WDPApp.i18n.__('%1$d. share %2$s', 'woo-donation-popup'),
            rowResult.rowIndex,
            getShareholderIssueSummaryLabel(issue.type)
          );
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
      errorMessages.push(
        WDPApp.i18n.sprintf(
          WDPApp.i18n.__('Incomplete shareholder forms: %d.', 'woo-donation-popup'),
          incompleteShareholderCount
        )
      );
    }

    // Telefon: ülkeye göre rakam sayısı (TR: 10, vb.) — hissedar satırları yukarıda doğrulandı
    const phoneFailures = [];
    if (!validateAllPhoneFields(form, { shareholders: !hasShareholderRows, collectFailures: phoneFailures })) {
      isValid = false;
      phoneFailures.forEach((f) => failures.push(f));
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
        }
      }
    }

    // Diğer zorunlu alanlar (fiyat, vb.) — alt bağış (sadaka) bu döngüde yok; validateSadakaDonation ayrı.
    form.querySelectorAll('input[required], textarea[required]').forEach((field) => {
      if (field.name && field.name.includes('shareholder_')) {
        return;
      }
      if (field.name === 'donation_phone' || field.type === 'tel') {
        return;
      }
      if (field.name === 'sadaka_custom_price' || (field.closest && field.closest('[data-wdp-sadaka-donation]'))) {
        return;
      }
      // type=number geçersiz değerde .value "" döner; yine de trim ile boşluk kontrolü yeterli.
      const rawVal = field.value == null ? '' : String(field.value);
      if (!rawVal.trim()) {
        const msg = getRequiredFieldMessage(field);
        showInputError(field, msg);
        errorMessages.push(field.placeholder || msg);
        failures.push({
          field: field.name || 'required',
          rule: field.name === 'donation_full_name' ? 'donor_name_required' : 'required',
          value: '',
        });
        isValid = false;
      }
    });

    // E-posta: boş serbest; doluysa biçim kontrolü + görünür alan hatası
    const emailInput = form.querySelector('input[name="donation_email"]');
    if (emailInput && !emailInput.disabled && !(emailInput.closest && emailInput.closest('[hidden]'))) {
      const emailRaw = emailInput.value == null ? '' : String(emailInput.value).trim();
      if (emailRaw !== '') {
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
        if (!emailOk) {
          const msg =
            (WDPApp.formMessages && typeof WDPApp.formMessages.getInvalidEmailMessage === 'function'
              ? WDPApp.formMessages.getInvalidEmailMessage()
              : null) || WDPApp.i18n.__('Please enter a valid email address.', 'woo-donation-popup');
          showInputError(emailInput, msg);
          errorMessages.push(msg);
          failures.push({ field: 'donation_email', rule: 'email_invalid', value: emailRaw });
          isValid = false;
        }
      }
    }

    // Minimum bağış tutarı ve sayısal doğrulama
    const customPriceInput = form.querySelector('input[name="custom_price"]');
    if (customPriceInput) {
      const rawValue = customPriceInput.value ? customPriceInput.value.toString().trim() : '';
      const detailed = rawValue !== '' && utils && typeof utils.parseMoneyDetailed === 'function'
        ? utils.parseMoneyDetailed(rawValue)
        : null;
      const numericValue = rawValue === ''
        ? NaN
        : (detailed && detailed.status === 'ok'
          ? detailed.amount
          : parseNormalizedAmount(rawValue));
      const minAttr = customPriceInput.getAttribute('min') || customPriceInput.getAttribute('data-wdp-min-price');
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

      const maxDonation = 999999;
      if (rawValue === '') {
        const emptyMessage = WDPApp.i18n.__('Please enter a donation amount.', 'woo-donation-popup');
        showInputError(customPriceInput, emptyMessage);
        if (!errorMessages.includes(emptyMessage)) {
          errorMessages.push(emptyMessage);
        }
        failures.push({ field: 'custom_price', rule: 'price_empty', value: '' });
        isValid = false;
      } else if (detailed && detailed.status === 'ambiguous') {
        const ambMessage = (detailed.error && String(detailed.error).trim())
          ? detailed.error
          : ((utils && typeof utils.getAmbiguousAmountMessage === 'function')
            ? utils.getAmbiguousAmountMessage()
            : WDPApp.i18n.__('Fractional amounts are not allowed on this site, e.g. 10', 'woo-donation-popup'));
        showInputError(customPriceInput, ambMessage);
        if (!errorMessages.includes(ambMessage)) {
          errorMessages.push(ambMessage);
        }
        failures.push({ field: 'custom_price', rule: 'price_ambiguous', value: rawValue });
        isValid = false;
      } else if (!Number.isFinite(numericValue) || numericValue <= 0) {
        const invalidMessage = WDPApp.i18n.__('Please enter a valid donation amount.', 'woo-donation-popup');
        showInputError(customPriceInput, invalidMessage);
        if (!errorMessages.includes(invalidMessage)) {
          errorMessages.push(invalidMessage);
        }
        failures.push({ field: 'custom_price', rule: 'price_invalid', value: rawValue });
        isValid = false;
      } else if (numericValue > maxDonation) {
        const maxMessage = WDPApp.i18n.sprintf(
          WDPApp.i18n.__('Maximum amount: %s', 'woo-donation-popup'),
          formatCurrency(maxDonation)
        );
        showInputError(customPriceInput, maxMessage);
        if (!errorMessages.includes(maxMessage)) {
          errorMessages.push(maxMessage);
        }
        failures.push({ field: 'custom_price', rule: 'price_above_max', value: rawValue });
        isValid = false;
      } else if (effectiveMin > 0 && numericValue + 0.0001 < effectiveMin) {
        const minMessage = customPriceQtyRow
          ? WDPApp.i18n.sprintf(
              WDPApp.i18n.__('Please enter a total of %s or more.', 'woo-donation-popup'),
              formatCurrency(effectiveMin)
            )
          : WDPApp.i18n.sprintf(
              WDPApp.i18n.__('Please enter %s or more.', 'woo-donation-popup'),
              formatCurrency(effectiveMin)
            );
        showInputError(customPriceInput, minMessage);
        if (!errorMessages.includes(minMessage)) {
          errorMessages.push(minMessage);
        }
        failures.push({
          field: 'custom_price',
          rule: 'price_below_min',
          value: rawValue,
        });
        isValid = false;
      }
    }

    if (!validateSadakaDonation(form)) {
      isValid = false;
      const sadakaErr = form.querySelector('[data-wdp-sadaka-donation] .wdp-input-error');
      const sadakaInput = form.querySelector(
        '[data-wdp-sadaka-donation] input[name="sadaka_custom_price"], [data-wdp-sadaka-donation] input'
      );
      const sadakaMsg =
        sadakaErr && sadakaErr.textContent
          ? sadakaErr.textContent.trim()
          : (typeof formMessages.getSadakaInvalidMessage === 'function'
              ? formMessages.getSadakaInvalidMessage()
              : WDPApp.i18n.__('Please check the additional donation amount.', 'woo-donation-popup'));
      if (sadakaMsg && !errorMessages.includes(sadakaMsg)) {
        errorMessages.push(sadakaMsg);
      }
      failures.push({
        field: (sadakaInput && sadakaInput.name) || 'sadaka_custom_price',
        rule: 'sadaka_invalid',
        value: fieldValueSnapshot(sadakaInput),
      });
      // Sadaka modülü mesaj basmadıysa yine görünür hata
      if (!sadakaErr && sadakaInput) {
        showInputError(sadakaInput, sadakaMsg);
      } else if (!sadakaErr) {
        showFormErrorBanner(form, sadakaMsg);
      }
    }

    errorMessages = Array.from(new Set(errorMessages));
    const fbLive = WDPApp.formFeedback || formFeedback;
    if (!isValid && !errorMessages.length) {
      const collected =
        fbLive && typeof fbLive.collectVisibleFieldErrorMessages === 'function'
          ? fbLive.collectVisibleFieldErrorMessages(form)
          : [];
      if (collected && collected.length) {
        errorMessages = collected.slice();
      } else if (failures.length) {
        errorMessages.push(GENERAL_VALIDATION_MESSAGE);
      } else {
        // Alanı belirlenemeyen genel false — sessiz kalmasın
        errorMessages.push(GENERAL_VALIDATION_MESSAGE);
        failures.push({ field: '', rule: 'general', value: '' });
      }
    }
    safeLog("Form validation result:", { isValid, errorMessages, failures });

    const lastValidation = { ok: isValid, failures: failures.slice() };
    storeLastValidation(lastValidation);

    if (!isValid) {
      safeLog("Form is invalid; showing field-anchored errors + banner fallback");
      revealInvalidFieldContainers(form);
      if (firstShareholderIssue && firstShareholderIssue.row && incompleteShareholderCount > 0) {
        const firstRowIndex =
          Number.parseInt(firstShareholderIssue.row.getAttribute("data-index") || "0", 10) || 0;
        const summaryMsg = incompleteShareholderCount > 1
          ? WDPApp.i18n.sprintf(
              WDPApp.i18n.__('Incomplete shareholder forms: %d.', 'woo-donation-popup'),
              incompleteShareholderCount
            )
          : (firstRowIndex > 0
            ? WDPApp.i18n.sprintf(
                WDPApp.i18n.__('Shareholder form %d is incomplete.', 'woo-donation-popup'),
                firstRowIndex
              )
            : WDPApp.i18n.__('1 shareholder form is incomplete.', 'woo-donation-popup'));
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
      const fallbackMsg = errorMessages.length ? errorMessages[0] : GENERAL_VALIDATION_MESSAGE;
      showShareholderValidationFeedback(form, summaryLines, fallbackMsg);
      // Yedek: hiçbir görünür metin yoksa genel banner (sessiz false yok)
      ensureVisibleValidationFeedback(form, errorMessages.length ? errorMessages : [GENERAL_VALIDATION_MESSAGE]);
      if (!form.querySelector('.wdp-input-error, .wdp-form-error')) {
        showFormErrorBanner(form, GENERAL_VALIDATION_MESSAGE);
      }
      if (!form.querySelector('.wdp-error') && !shareholderFocused) {
        focusFirstInvalidField(form);
      }
    } else if (WDPApp.shareholder && typeof WDPApp.shareholder.setValidationArmed === "function") {
      WDPApp.shareholder.setValidationArmed(form, false, 0);
      if (typeof WDPApp.shareholder.clearSubmitSummary === 'function') {
        WDPApp.shareholder.clearSubmitSummary(form);
      }
      clearShareholderHeaderStatusMarks(form);
      form.classList.remove('wdp-shareholders-validation-active');
    }

    return isValid;
    } finally {
      if (fbBatch && typeof fbBatch.endErrorBatch === 'function') {
        fbBatch.endErrorBatch();
      }
    }
  }

  function isFocusableInvalidField(el) {
    if (!el || typeof el.focus !== 'function') {
      return false;
    }
    if (el.disabled || el.readOnly) {
      return false;
    }
    if (el.closest && (el.closest('.wdp-shareholder-form.collapsed') || el.closest('[hidden]'))) {
      return false;
    }
    if (el.getClientRects && el.getClientRects().length === 0) {
      return false;
    }
    return true;
  }

  /** İlk görünür .wdp-error alanına odaklanır ve görünür alana kaydırır. */
  function focusFirstInvalidField(form) {
    if (!form) {
      return;
    }
    const candidates = form.querySelectorAll(".wdp-error");
    let firstBad = null;
    for (let i = 0; i < candidates.length; i += 1) {
      if (isFocusableInvalidField(candidates[i])) {
        firstBad = candidates[i];
        break;
      }
    }
    if (!firstBad) {
      return;
    }
    try {
      firstBad.focus({ preventScroll: true });
    } catch (e0) {
      try {
        firstBad.focus();
      } catch (e00) {
        /* ignore */
      }
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
    revealInvalidFieldContainers: revealInvalidFieldContainers,
    getOrderedShareholderRows: getOrderedShareholderRows,
    ensureShareholderRowsReady: ensureShareholderRowsReady,
    getDonorNameRequiredMessage: getDonorNameRequiredMessage,
    getShareholderNameRequiredMessage: getShareholderNameRequiredMessage,
    getRequiredFieldMessage: getRequiredFieldMessage,
    getPhoneValidationState: getPhoneValidationState,
  };
})(window);
