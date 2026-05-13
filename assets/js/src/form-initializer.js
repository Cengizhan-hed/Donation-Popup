/**
 * Form Initializer - Form başlatma işlemleri
 * initializeDirectForms, initializeInlineForms
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
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

  function resolveProductIdForContainer(container) {
    if (!container) {
      return null;
    }
    let productId = container.getAttribute('data-product-id');
    if (productId) {
      return productId;
    }
    const idAttr = container.id || '';
    const m = /^wdp-modal-(\d+)$/.exec(idAttr);
    if (m) {
      return m[1];
    }
    const pidInput = container.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
    return pidInput && pidInput.value ? String(pidInput.value) : null;
  }

  function bindOneDonationForm(formElement, hostForShareholder, hostForProgress) {
    if (!formElement || formElement.dataset.wdpFormInitialized === '1') {
      return;
    }
    const { setupFormSubmission, setupShareholderForms } = updateModuleFunctions();

    if (setupFormSubmission && typeof setupFormSubmission === 'function') {
      setupFormSubmission(formElement);
    } else {
      requestAnimationFrame(function() {
        const retry = updateModuleFunctions();
        if (retry.setupFormSubmission && typeof retry.setupFormSubmission === 'function') {
          retry.setupFormSubmission(formElement);
        }
      });
    }

    const $form = (sel) => formElement.querySelector(sel);
    const shareCountInput = $form('input[name="share_count"]');
    if (shareCountInput) {
      const productId = resolveProductIdForContainer(hostForShareholder);
      if (productId) {
        if (setupShareholderForms && typeof setupShareholderForms === 'function') {
          setupShareholderForms(hostForShareholder, productId);
        } else {
          requestAnimationFrame(function() {
            const retry = updateModuleFunctions();
            if (retry.setupShareholderForms && typeof retry.setupShareholderForms === 'function') {
              retry.setupShareholderForms(hostForShareholder, productId);
            }
          });
        }
      }
    }

    const progressHost = hostForProgress || hostForShareholder;
    const progressBarContainer = progressHost && progressHost.querySelector('.wdp-progress-bar-container');
    if (progressBarContainer) {
      const progressBar = getModule('progressBar');
      if (progressBar && typeof progressBar.setup === 'function') {
        progressBar.setup(progressBarContainer);
      } else {
        requestAnimationFrame(function() {
          const retryProgressBar = getModule('progressBar');
          if (retryProgressBar && typeof retryProgressBar.setup === 'function') {
            retryProgressBar.setup(progressBarContainer);
          }
        });
      }
    }

    formElement.dataset.wdpFormInitialized = '1';
    if (hostForShareholder && hostForShareholder.dataset) {
      hostForShareholder.dataset.wdpInitialized = '1';
    }
  }

  function initializeModalForms(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const roots = root && root.matches && root.matches('.wdp-modal') ? [root] : null;
    const modals = roots || scope.querySelectorAll('.wdp-modal');
    Array.prototype.forEach.call(modals, function(modal) {
      const formElement = modal.querySelector('form');
      if (!formElement) {
        return;
      }
      bindOneDonationForm(formElement, modal, modal);
    });
  }

  // Doğrudan (embedded) formları başlatan yardımcı
  function initializeDirectForms(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const roots = root && root.matches && root.matches('.wdp-donation-form') ? [root] : null;
    const containers = roots || scope.querySelectorAll('.wdp-donation-form');
    Array.prototype.forEach.call(containers, function(formContainer) {
      const formElement = formContainer.querySelector('form');
      if (!formElement) {
        return;
      }
      bindOneDonationForm(formElement, formContainer, formContainer);
    });
    initializeModalForms(root);
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

