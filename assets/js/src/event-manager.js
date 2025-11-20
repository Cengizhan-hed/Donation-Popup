/**
 * Event Manager - Event listener yönetimi
 * initializeEventListeners
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
  
  // Module loader helper
  function getModule(name) {
    return WDPApp[name] || {};
  }

  // Olay dinleyicilerini başlat
  function initializeEventListeners() {
    // State modülünü kontrol et (henüz yüklenmemişse oluştur)
    const currentState = getModule('state');
    if (!currentState || typeof currentState.listenersInitialized === 'undefined') {
      // State yüklenene kadar geçici bir flag kullan
      if (!window.WDPApp._tempState) {
        window.WDPApp._tempState = { listenersInitialized: false };
      }
    }

    // Tüm formların orijinal içeriğini sakla (dinamik eklenenler için tekrar çalışabilir)
    const currentDom = getModule('dom');
    if (currentDom && typeof currentDom.saveOriginalForms === 'function') {
      currentDom.saveOriginalForms();
    }

    // State'i güncelle (henüz yüklenmemişse geçici state kullan)
    const currentListenersInitialized = (currentState && typeof currentState.listenersInitialized !== 'undefined') 
      ? currentState.listenersInitialized 
      : (window.WDPApp._tempState ? window.WDPApp._tempState.listenersInitialized : false);

    if (!currentListenersInitialized) {
      // Modal açma/ kapama event'leri
      document.addEventListener("click", function(e) {
        if (e.target.classList.contains("wdp-donate-button") || 
            e.target.classList.contains("wdp-open-modal") ||
            e.target.closest(".wdp-donate-button") ||
            e.target.closest(".wdp-open-modal")) {
          
          e.preventDefault();
          e.stopPropagation();
          
          const button = e.target.classList.contains("wdp-donate-button") || e.target.classList.contains("wdp-open-modal") 
            ? e.target 
            : e.target.closest(".wdp-donate-button") || e.target.closest(".wdp-open-modal");
          
          if (button) {
            const productId = button.getAttribute("data-product-id");
            
            if (productId) {
              // Update module functions before use - INSTANT execution
              const currentModal = getModule('modal');
              if (currentModal && typeof currentModal.open === 'function') {
                currentModal.open(productId);
              } else {
                // INSTANT retry (no delay) - use requestAnimationFrame for next tick
                requestAnimationFrame(function() {
                  const retryModal = getModule('modal');
                  if (retryModal && typeof retryModal.open === 'function') {
                    retryModal.open(productId);
                  }
                });
              }
            }
          }
        }
        
        // Close button click
        if (e.target.classList.contains("wdp-modal-close") || 
            e.target.closest(".wdp-modal-close")) {
          
          e.preventDefault();
          e.stopPropagation();
          
          const closeButton = e.target.classList.contains("wdp-modal-close") 
            ? e.target 
            : e.target.closest(".wdp-modal-close");
          
          if (closeButton) {
            const currentModal = getModule('modal');
            if (currentModal && typeof currentModal.close === 'function') {
              const modal = closeButton.closest(".wdp-modal");
              if (modal) {
                currentModal.close(modal);
              }
            }
          }
        }
      });

      // Form submit event
      document.addEventListener("submit", function(e) {
        if (e.target.closest(".wdp-modal") || e.target.closest(".wdp-donation-form")) {
          e.preventDefault();
          e.stopPropagation();
          
          const formElement = e.target;
          if (formElement) {
            const currentForm = getModule('form');
            if (currentForm && typeof currentForm.setup === 'function') {
              currentForm.setup(formElement);
            } else {
              // INSTANT retry (no delay) - use requestAnimationFrame for next tick
              requestAnimationFrame(function() {
                const retryForm = getModule('form');
                if (retryForm && typeof retryForm.setup === 'function') {
                  retryForm.setup(formElement);
                }
              });
            }
          }
        }
      });

      // Keyboard events
      document.addEventListener("keydown", function(e) {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("wdp-modal-close")) {
          e.preventDefault();
          
          const currentModal = getModule('modal');
          if (currentModal && typeof currentModal.close === 'function') {
            const modal = e.target.closest(".wdp-modal");
            if (modal) {
              currentModal.close(modal);
            }
          }
        }
      });

      // State'i güncelle
      if (currentState && typeof currentState.listenersInitialized !== 'undefined') {
        currentState.listenersInitialized = true;
      } else {
        // Geçici state kullan
        if (!window.WDPApp._tempState) {
          window.WDPApp._tempState = {};
        }
        window.WDPApp._tempState.listenersInitialized = true;
      }
    }
  }

  // Export
  WDPApp.eventManager = {
    init: initializeEventListeners,
  };

})(window);

