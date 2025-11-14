/**
 * DOM - DOM manipülasyonları
 * Inline style temizleme, DOM observation
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog'], {
        safeLog: function(...args) {
          if (typeof console !== 'undefined' && console.log) {
            console.log.apply(console, args);
          }
        },
      })
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog } = utils;

  // Inline style'ları kaldırarak tema/eklenti kaynaklı stil çakışmalarını önle
  // FONT-SIZE İLE İLGİLİ KOD KALDIRILDI - Inline CSS yeterli, gereksiz JS kodu flash yapıyor
  function removeInlineStylesFromTitles() {
    const titleSelectors = [
      '.wdp-form-title',
      '.wdp-modal-title',
      '.wdp-modal .wdp-modal-content h2',
      '.wdp-donation-form .wdp-modal-content h2',
      '.wdp-modal .wdp-modal-content .wdp-form-title',
      '.wdp-donation-form .wdp-modal-content .wdp-form-title',
      '.wdp-modal .wdp-modal-content h2.wdp-form-title',
      '.wdp-donation-form .wdp-modal-content h2.wdp-form-title',
      '.wdp-modal .wdp-modal-content form .wdp-form-title',
      '.wdp-donation-form .wdp-modal-content form .wdp-form-title',
      '.wdp-modal .wdp-modal-content form h2',
      '.wdp-donation-form .wdp-modal-content form h2',
      '.wdp-modal .wdp-modal-content form h2.wdp-form-title',
      '.wdp-donation-form .wdp-modal-content form h2.wdp-form-title'
    ]
    
    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => {
        // Sadece display ve width - font-size inline CSS'te handle ediliyor
        const isPopupModalTitle = element.closest('.wdp-modal') && element.closest('.wdp-modal-header');
        
        if (!isPopupModalTitle) {
          // In-page forms: inline-block için sadece display
          if (element.style.display === 'block') {
            element.style.removeProperty('display');
          }
          if (element.style.width === '100%') {
            element.style.removeProperty('width');
          }
        } else {
          // Popup modal titles: block display için
          if (element.style.display && element.style.display !== 'block') {
            element.style.removeProperty('display');
          }
        }
      })
    })
  }

  // Tüm formların orijinal içeriğini sakla (modal.js'den taşındı)
  function saveOriginalForms() {
    if (!state || !state.originalForms) {
      return;
    }
    const { originalForms } = state;
    // Hem popup hem ürün içi form için çalıştır
    document.querySelectorAll(".wdp-modal, .wdp-donation-form").forEach((container) => {
      const containerId = container.id || container.getAttribute("data-product-id") || Math.random().toString(36).substr(2, 9);
      const form = container.querySelector("form");
      if (form) {
        originalForms.set(containerId, form.innerHTML);
      }
    });
  }

  // DOM değişikliklerini izle
  function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReinitialize = false
      let shouldRemoveInlineStyles = false

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.querySelector) {
              const buttons = node.querySelectorAll(".wdp-donate-button, .wdp-open-modal")
              if (buttons.length > 0) {
                shouldReinitialize = true
              }
              // Yeni eklenen doğrudan formlar varsa hemen başlat
              const forms = node.matches && node.matches('.wdp-donation-form') ? [node] : node.querySelectorAll && node.querySelectorAll('.wdp-donation-form')
              if (forms && forms.length) {
                if (WDPApp.init && WDPApp.init.directForms) {
                  WDPApp.init.directForms(node)
                }
                shouldRemoveInlineStyles = true
              }
              // Yeni eklenen title elementleri varsa inline style'ları kaldır
              if (node.matches && (node.matches('.wdp-form-title') || node.matches('.wdp-modal-title') || node.matches('.wdp-modal-content h2') || node.matches('.wdp-donation-form .wdp-modal-content h2'))) {
                shouldRemoveInlineStyles = true
              }
              if (node.querySelectorAll) {
                const titles = node.querySelectorAll('.wdp-form-title, .wdp-modal-title, .wdp-modal-content h2, .wdp-donation-form .wdp-modal-content h2')
                if (titles && titles.length > 0) {
                  shouldRemoveInlineStyles = true
                }
              }
            }
          })
        }
        // Attributes değişikliklerini de izle (inline style değişiklikleri için)
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const target = mutation.target
          if (target.matches && (target.matches('.wdp-form-title') || target.matches('.wdp-modal-title') || target.matches('h2'))) {
            shouldRemoveInlineStyles = true
          }
        }
      })

      if (shouldReinitialize) {
        safeLog("Donation buttons added to DOM - reinitializing event listeners")
        if (WDPApp.init && WDPApp.init.eventListeners) {
          WDPApp.init.eventListeners()
        }
      }
      
      if (shouldRemoveInlineStyles) {
        // Biraz gecikmeyle inline style'ları kaldır (tema/eklenti style'ları eklemiş olabilir)
        setTimeout(() => {
          removeInlineStylesFromTitles()
        }, 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    })
  }

  // Export
  // Not: initializeDirectForms init.js içinde tanımlı, burada export etmiyoruz
  WDPApp.dom = {
    removeInlineStylesFromTitles,
    observeDOMChanges,
    saveOriginalForms,
    // initializeDirectForms init.js'de tanımlı
  }

  // Export dom module

})(window);
