/**
 * @file shareholder.js
 * Hisseli bağış orkestrasyonu; alt modülleri WDPApp.shareholder altında birleştirir.
 * Dış API: WDPApp.shareholder
 *
 * Resolve WDPApp.* at call time for modules loaded later in the stack.
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  const SHAREHOLDER_SCROLL_CONFIG = {
    min: 260,
    max: 440,
    ratio: 0.6,
  };

  /**
   * Live module bag — never freeze empty objects at load time.
   *
   * @returns {{
   *   layout: object,
   *   list: object,
   *   scroll: object,
   *   guidance: object,
   *   render: object,
   *   quantity: object,
   *   formsSync: object,
   *   setup: object
   * }}
   */
  function createShareholderRuntime() {
    return {
      layout: WDPApp.shareholderLayout || {},
      list: WDPApp.shareholderList || {},
      scroll: WDPApp.shareholderScroll || {},
      guidance: WDPApp.shareholderGuidance || {},
      render: WDPApp.shareholderRender || {},
      quantity: WDPApp.shareholderQuantity || {},
      formsSync: WDPApp.shareholderFormsSync || {},
      setup: WDPApp.shareholderSetup || {},
    };
  }

  function callModule(group, method, args) {
    const rt = createShareholderRuntime();
    const mod = rt[group] || {};
    if (typeof mod[method] === 'function') {
      return mod[method].apply(mod, args || []);
    }
    return undefined;
  }

  function getShareholderNoteTextarea(form) {
    return form ? form.querySelector('textarea[name^="shareholder_note_"]') : null;
  }

  function syncShareholderUnitPrices(modal, unitNumeric) {
    callModule('quantity', 'syncShareholderUnitPrices', [modal, unitNumeric]);
  }

  function resolveShareUnitPrice(modal) {
    const v = callModule('quantity', 'resolveShareUnitPrice', [modal]);
    return typeof v === 'number' ? v : 0;
  }

  function updateSharesTotalBar(modal) {
    callModule('quantity', 'updateSharesTotalBar', [modal]);
  }

  function syncShareholderUnitPricesFromModal(modal) {
    callModule('quantity', 'syncShareholderUnitPricesFromModal', [modal]);
  }

  function createShareholderForm(index) {
    const form = callModule('render', 'createShareholderForm', [index]);
    return form || null;
  }

  function toggleShareholderForm(form) {
    callModule('render', 'toggleShareholderForm', [form]);
  }

  function setupShareholderHeaderClick(form) {
    callModule('render', 'setupShareholderHeaderClick', [form]);
  }

  function setupCopyFormButton(form) {
    callModule('render', 'setupCopyFormButton', [form]);
  }

  function duplicateShareholderForm(originalForm, nameValue, phoneValue, noteValue) {
    callModule('render', 'duplicateShareholderForm', [originalForm, nameValue, phoneValue, noteValue]);
  }

  function isFormFilled(form) {
    const v = callModule('render', 'isFormFilled', [form]);
    return !!v;
  }

  function setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput) {
    callModule('quantity', 'setupShareQuantityButtons', [modal, shareCountInput, baseProductPrice, priceInput]);
  }

  function setupWdpPhoneFields(root) {
    const phone = WDPApp.phoneInput;
    if (root && phone && typeof phone.setupInRoot === 'function') {
      phone.setupInRoot(root);
    }
  }

  function ensureVisible(element, preferredDisplay) {
    const handled = callModule('layout', 'ensureVisible', [element, preferredDisplay]);
    if (handled !== undefined || !element) {
      return;
    }
  }

  function isSidePanelModal(modal) {
    const rt = createShareholderRuntime();
    if (typeof rt.layout.isSidePanelModal === 'function') {
      return rt.layout.isSidePanelModal(modal);
    }
    return !!(modal && modal.classList && modal.classList.contains('wdp-side-panel'));
  }

  function clearSidePanelShareholderScrollLayout(modal) {
    callModule('layout', 'clearSidePanelShareholderScrollLayout', [modal]);
  }

  function applyShareholdersAreaVisibility(area) {
    callModule('layout', 'applyShareholdersAreaVisibility', [area]);
  }

  function applyShareholdersContainerVisibility(container) {
    callModule('layout', 'applyShareholdersContainerVisibility', [container]);
  }

  function ensureReadableInput(element) {
    callModule('list', 'ensureReadableInput', [element]);
  }

  function ensureShareholderList(container) {
    const list = callModule('list', 'ensureShareholderList', [container]);
    return list || null;
  }

  function cacheShareholdersBaseHeight(container) {
    callModule('scroll', 'cacheShareholdersBaseHeight', [container]);
  }

  function applyShareholderScrollStyles(container, enableScroll) {
    callModule('scroll', 'applyShareholderScrollStyles', [container, enableScroll]);
  }

  function bindShareholderResizeListener() {
    callModule('scroll', 'bindShareholderResizeListener', []);
  }

  function scheduleShareholdersScrollableUpdate(root) {
    callModule('scroll', 'scheduleShareholdersScrollableUpdate', [root]);
  }

  function updateShareholdersScrollable(modal) {
    callModule('scroll', 'updateShareholdersScrollable', [modal]);
  }

  function updateCollapsedFormsCount(modal) {
    callModule('scroll', 'updateCollapsedFormsCount', [modal]);
  }

  function calculateShareholderMaxHeight() {
    const v = callModule('scroll', 'calculateShareholderMaxHeight', []);
    return typeof v === 'number' ? v : SHAREHOLDER_SCROLL_CONFIG.max;
  }

  function refreshShareholderGuidance(root) {
    callModule('guidance', 'refreshShareholderGuidance', [root]);
  }

  function queueShareholderGuidanceRefresh(root) {
    const rt = createShareholderRuntime();
    if (typeof rt.guidance.queueShareholderGuidanceRefresh === 'function') {
      rt.guidance.queueShareholderGuidanceRefresh(root);
      return;
    }
    refreshShareholderGuidance(root);
  }

  function setShareValidationArmed(root, armed, targetIndex) {
    callModule('guidance', 'setShareValidationArmed', [root, armed, targetIndex]);
  }

  function resetShareholderValidationUI(scope) {
    callModule('guidance', 'resetShareholderValidationUI', [scope]);
  }

  function showShareholdersSubmitSummary(root, lines, options) {
    callModule('guidance', 'showShareholdersSubmitSummary', [root, lines, options]);
  }

  function clearShareholdersSubmitSummary(root) {
    callModule('guidance', 'clearShareholdersSubmitSummary', [root]);
  }

  function attachGuidanceListeners(form) {
    callModule('guidance', 'attachGuidanceListeners', [form]);
  }

  function checkShareholderFormWarning(form) {
    callModule('guidance', 'checkShareholderFormWarning', [form]);
  }

  function removeShareholderOverview(root) {
    callModule('guidance', 'removeShareholderOverview', [root]);
  }

  function updateShareholderFormsInternal(modal) {
    callModule('formsSync', 'updateShareholderFormsInternal', [modal]);
  }

  function updateShareholderForms(container, productData) {
    callModule('formsSync', 'updateShareholderForms', [container, productData]);
  }

  function setupShareholderForms(modal, productId) {
    return callModule('setup', 'setupShareholderForms', [modal, productId]);
  }

  function setupDirectShareholderForms(formContainer, productId, productData) {
    setupShareholderForms(formContainer, productId);
  }

  function wireShareholderHooks() {
    const rt = createShareholderRuntime();

    if (typeof rt.setup.registerHooks === 'function') {
      rt.setup.registerHooks({
        ensureVisible: ensureVisible,
        applyShareholdersAreaVisibility: applyShareholdersAreaVisibility,
        ensureReadableInput: ensureReadableInput,
        removeShareholderOverview: removeShareholderOverview,
        applyShareholdersContainerVisibility: applyShareholdersContainerVisibility,
        ensureShareholderList: ensureShareholderList,
        createShareholderForm: createShareholderForm,
        setupCopyFormButton: setupCopyFormButton,
        setupShareholderHeaderClick: setupShareholderHeaderClick,
        checkShareholderFormWarning: checkShareholderFormWarning,
        setupWdpPhoneFields: setupWdpPhoneFields,
        syncShareholderUnitPricesFromModal: syncShareholderUnitPricesFromModal,
        updateSharesTotalBar: updateSharesTotalBar,
        scheduleShareholdersScrollableUpdate: scheduleShareholdersScrollableUpdate,
        refreshShareholderGuidance: refreshShareholderGuidance,
        cacheShareholdersBaseHeight: cacheShareholdersBaseHeight,
        setupShareQuantityButtons: setupShareQuantityButtons,
      });
    }

    if (typeof rt.render.registerHooks === 'function') {
      rt.render.registerHooks({ setupWdpPhoneFields: setupWdpPhoneFields });
    }

    if (typeof rt.formsSync.registerHooks === 'function') {
      rt.formsSync.registerHooks({
        isSidePanelModal: isSidePanelModal,
        applyShareholdersAreaVisibility: applyShareholdersAreaVisibility,
        applyShareholdersContainerVisibility: applyShareholdersContainerVisibility,
        ensureShareholderList: ensureShareholderList,
        setupWdpPhoneFields: setupWdpPhoneFields,
        createShareholderForm: createShareholderForm,
        setupCopyFormButton: setupCopyFormButton,
        setupShareholderHeaderClick: setupShareholderHeaderClick,
        isFormFilled: isFormFilled,
        checkShareholderFormWarning: checkShareholderFormWarning,
        scheduleShareholdersScrollableUpdate: scheduleShareholdersScrollableUpdate,
        updateCollapsedFormsCount: updateCollapsedFormsCount,
        syncShareholderUnitPricesFromModal: syncShareholderUnitPricesFromModal,
        refreshShareholderGuidance: refreshShareholderGuidance,
      });
    }

    if (typeof rt.quantity.registerHooks === 'function') {
      rt.quantity.registerHooks({
        updateShareholderFormsInternal: updateShareholderFormsInternal,
      });
    }
  }

  wireShareholderHooks();

  WDPApp.shareholder = {
    createRuntime: createShareholderRuntime,
    ensureList: ensureShareholderList,
    syncUnitPrices: syncShareholderUnitPricesFromModal,
    setup: setupShareholderForms,
    setupQuantityButtons: setupShareQuantityButtons,
    createForm: createShareholderForm,
    setupCopyButton: setupCopyFormButton,
    duplicateForm: duplicateShareholderForm,
    updateScrollable: updateShareholdersScrollable,
    updateCollapsedCount: updateCollapsedFormsCount,
    applyScrollStyles: applyShareholderScrollStyles,
    cacheBaseHeight: cacheShareholdersBaseHeight,
    bindResizeListener: bindShareholderResizeListener,
    calculateMaxHeight: calculateShareholderMaxHeight,
    setupDirect: setupDirectShareholderForms,
    updateForms: updateShareholderForms,
    refreshGuidance: refreshShareholderGuidance,
    setValidationArmed: setShareValidationArmed,
    resetValidationUI: resetShareholderValidationUI,
    showSubmitSummary: showShareholdersSubmitSummary,
    clearSubmitSummary: clearShareholdersSubmitSummary,
    updateSharesTotalBar: updateSharesTotalBar,
    relayout: function(root) {
      try {
        updateShareholdersScrollable(root);
        applyShareholderScrollStyles(root);
        updateCollapsedFormsCount(root);
      } catch (e) {
        /* ignore */
      }
    },
  };

})(window);
