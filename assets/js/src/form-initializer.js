/**
 * Form Initializer - Form başlatma işlemleri
 * initializeDirectForms, initializeInlineForms
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const { safeLog } = utils;
  
  // Module loader helper (from init.js)
  function getModule(name) {
    return WDPApp[name] || {};
  }
  
  function updateModuleFunctions() {
    const currentForm = getModule('form');
    const currentShareholder = getModule('shareholder');
    
    let setupFormSubmission = currentForm && typeof currentForm.setup === 'function' ? currentForm.setup : null;
    let setupShareholderForms = currentShareholder && typeof currentShareholder.setup === 'function' ? currentShareholder.setup : null;
    
    return { setupFormSubmission, setupShareholderForms };
  }

  // Doğrudan (embedded) formları başlatan yardımcı
  function initializeDirectForms(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.wdp-donation-form').forEach((formContainer) => {
      if (formContainer.dataset.wdpInitialized === '1') return;
      const formElement = formContainer.querySelector('form');
      if (!formElement) return;
      
      // Setup form submission
      const { setupFormSubmission, setupShareholderForms } = updateModuleFunctions();
      
      if (setupFormSubmission && typeof setupFormSubmission === 'function') {
        setupFormSubmission(formElement);
      } else {
        // INSTANT retry (no delay) - use requestAnimationFrame for next tick
        requestAnimationFrame(function() {
          const retry = updateModuleFunctions();
          if (retry.setupFormSubmission && typeof retry.setupFormSubmission === 'function') {
            retry.setupFormSubmission(formElement);
          }
        });
      }
      
      // Hisseli form mu kontrol et - DOM query caching
      const $form = (sel) => formElement.querySelector(sel);
      const shareCountInput = $form('input[name="share_count"]');
      if (shareCountInput) {
        if (setupShareholderForms && typeof setupShareholderForms === 'function') {
          const productId = formContainer.getAttribute('data-product-id');
          if (productId) {
            setupShareholderForms(formContainer, productId);
          }
        } else {
          // INSTANT retry (no delay) - use requestAnimationFrame for next tick
          requestAnimationFrame(function() {
            const retry = updateModuleFunctions();
            if (retry.setupShareholderForms && typeof retry.setupShareholderForms === 'function') {
              const productId = formContainer.getAttribute('data-product-id');
              if (productId) {
                retry.setupShareholderForms(formContainer, productId);
              }
            }
          });
        }
      }
      formContainer.dataset.wdpInitialized = '1';
    });
  }

  // Inline formları başlat
  function initializeInlineForms() {
    initializeDirectForms(document);
  }

  // Export
  WDPApp.formInitializer = {
    direct: initializeDirectForms,
    inline: initializeInlineForms,
  };

})(window);

