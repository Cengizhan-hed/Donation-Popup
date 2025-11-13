/**
 * DOM - DOM manipülasyonları
 * Inline style temizleme, DOM observation
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Utils ve state'i güvenli bir şekilde al (henüz yüklenmemişse boş obje)
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const { safeLog } = utils;
  
  // Utils henüz yüklenmemişse hata ver
  if (!WDPApp.utils || typeof utils.safeLog !== 'function') {
    console.error('WDP ERROR: utils.js must be loaded before dom.js!');
    console.error('WDP: WDPApp.utils:', WDPApp.utils);
    // Fallback: basit bir safeLog fonksiyonu
    if (typeof safeLog === 'undefined') {
      utils.safeLog = function(...args) {
        if (typeof console !== 'undefined' && console.log) {
          console.log.apply(console, args);
        }
      };
    }
  }

  // Inline style'ları kaldırarak tema/eklenti kaynaklı stil çakışmalarını önle
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
        // Font-size ve line-height gibi stil çakışmalarına neden olan inline style'ları kaldır
        if (element.style.fontSize) {
          element.style.removeProperty('font-size')
        }
        if (element.style.lineHeight) {
          element.style.removeProperty('line-height')
        }
        if (element.style.fontWeight) {
          element.style.removeProperty('font-weight')
        }
        if (element.style.color) {
          element.style.removeProperty('color')
        }
        if (element.style.margin) {
          element.style.removeProperty('margin')
        }
        if (element.style.marginBottom) {
          element.style.removeProperty('margin-bottom')
        }
        if (element.style.paddingBottom) {
          element.style.removeProperty('padding-bottom')
        }
        // CSS custom property'leri de kontrol et
        if (element.style.getPropertyValue('--fontSize')) {
          element.style.removeProperty('--fontSize')
        }
        // CRITICAL: Check if element is in popup modal header - if so, allow block display for full-width underline
        // Otherwise, force inline-block for in-page forms to prevent full-width border
        const isPopupModalTitle = element.closest('.wdp-modal') && element.closest('.wdp-modal-header');
        
        if (!isPopupModalTitle) {
          // For in-page forms, aggressively force inline-block to prevent full-width border
          // Remove display: block and width: 100% if theme added them
          if (element.style.display) {
            element.style.removeProperty('display');
          }
          if (element.style.width) {
            element.style.removeProperty('width');
          }
          if (element.style.maxWidth) {
            element.style.removeProperty('max-width');
          }
          // Force inline-block immediately and verify
          requestAnimationFrame(() => {
            const computedStyle = window.getComputedStyle(element);
            // Always force inline-block, width: auto, max-width: 100% for title elements in in-page forms
            if (computedStyle.display !== 'inline-block') {
              element.style.setProperty('display', 'inline-block', '');
            }
            if (computedStyle.width === '100%' || computedStyle.width === element.parentElement?.offsetWidth + 'px') {
              element.style.setProperty('width', 'auto', '');
            }
            if (!element.style.maxWidth || element.style.maxWidth !== '100%') {
              element.style.setProperty('max-width', '100%', '');
            }
            // Verify after a frame
            requestAnimationFrame(() => {
              const finalStyle = window.getComputedStyle(element);
              if (finalStyle.display !== 'inline-block') {
                element.style.setProperty('display', 'inline-block', '');
              }
              if (finalStyle.width === '100%') {
                element.style.setProperty('width', 'auto', '');
              }
            });
          });
        } else {
          // For popup modal titles, allow block display for full-width underline
          // Remove any inline styles that might interfere with CSS
          if (element.style.display && element.style.display !== 'block') {
            element.style.removeProperty('display');
          }
          if (element.style.width && element.style.width !== '100%') {
            element.style.removeProperty('width');
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

  console.log('✅ WDP: dom.js loaded');
  console.log('📦 WDP: WDPApp.dom exported:', !!WDPApp.dom);

})(window);
