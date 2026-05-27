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
    const m = /^wdp-(?:modal|side-panel)-(\d+)$/.exec(idAttr);
    if (m) {
      return m[1];
    }
    const pidInput = container.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
    return pidInput && pidInput.value ? String(pidInput.value) : null;
  }

  function setupInlineMetaViewContent(container, productId, formElement) {
    if (!container || !productId || !formElement || container.dataset.wdpMetaInlineBound === '1') {
      return;
    }
    if (container.closest('.wdp-modal')) {
      return;
    }
    const runVc = () => {
      if (container.dataset.wdpMetaInlineVcDone === '1') {
        return;
      }
      container.dataset.wdpMetaInlineVcDone = '1';
      if (!window.WDPMetaTracking || typeof window.WDPMetaTracking.trackViewContentDonation !== 'function') {
        return;
      }
      const qtyEl = formElement.querySelector('input[name="quantity"]');
      const qty = qtyEl ? parseInt(qtyEl.value, 10) || 1 : 1;
      let unit = 0;
      if (container.dataset && container.dataset.wdpUnitPrice !== undefined && container.dataset.wdpUnitPrice !== '') {
        unit = parseFloat(container.dataset.wdpUnitPrice);
      }
      if (!Number.isFinite(unit)) {
        unit = 0;
      }
      const titleEl = container.querySelector('.wdp-form-title, .wdp-modal-title');
      const cname = titleEl ? titleEl.textContent.trim() : '';
      window.WDPMetaTracking.trackViewContentDonation({
        productId: productId,
        contentName: cname,
        quantity: qty,
        itemPrice: unit,
        value: unit > 0 ? unit * qty : undefined,
        formType: 'inline',
      });
    };
    const onFirstInteract = () => {
      runVc();
    };
    container.addEventListener('focusin', onFirstInteract, { once: true, passive: true });
    container.addEventListener('pointerdown', onFirstInteract, { once: true, passive: true });
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio > 0) {
            io.disconnect();
            runVc();
          }
        });
      }, { threshold: 0.01 });
      io.observe(container);
    }
    container.dataset.wdpMetaInlineBound = '1';
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

    const phone = WDPApp.phoneInput;
    if (phone && typeof phone.refreshInRoot === 'function') {
      phone.refreshInRoot(hostForShareholder || formElement);
    } else if (phone && typeof phone.setupInRoot === 'function') {
      phone.setupInRoot(hostForShareholder || formElement);
    }
    const pidInline = resolveProductIdForContainer(hostForShareholder);
    if (pidInline && hostForShareholder && !hostForShareholder.closest('.wdp-modal')) {
      setupInlineMetaViewContent(hostForShareholder, pidInline, formElement);
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

