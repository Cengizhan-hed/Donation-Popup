/**
 * Event Manager - Event listener yönetimi
 * initializeEventListeners
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Module loader helper
  function getModule(name) {
    return WDPApp[name] || {};
  }
  let delegatedEventsBound = false;

  // Olay dinleyicilerini başlat
  function initializeEventListeners() {
    if (delegatedEventsBound) {
      return;
    }
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
      // PERFORMANCE: Use event delegation and passive listeners where possible
      // Modal açma/ kapama event'leri - Event delegation for better performance
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

      // Form submit: yalnızca henüz bağlanmamış formlar için yedek (form.js zaten dinliyorsa dokunma —
      // aksi halde her gönderimde setup tekrarlanır, çoklu dinleyici ve sahte "bağlantı hatası" oluşur)
      document.addEventListener("submit", function(e) {
        const formElement = e.target;
        if (!formElement || formElement.tagName !== "FORM") {
          return;
        }
        if (!formElement.closest(".wdp-modal") && !formElement.closest(".wdp-donation-form")) {
          return;
        }
        if (formElement._wdpSubmitHandler) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        const submitter = e.submitter || null;

        function retrySubmitAfterSetup() {
          // Avoid accidental loops; only retry once per missing-handler submit.
          if (formElement.dataset && formElement.dataset.wdpRetryingSubmit === "1") {
            return;
          }
          if (!formElement._wdpSubmitHandler) {
            return;
          }
          if (formElement.dataset) {
            formElement.dataset.wdpRetryingSubmit = "1";
          }
          requestAnimationFrame(function() {
            try {
              if (typeof formElement.requestSubmit === "function") {
                if (submitter && submitter.form === formElement) {
                  formElement.requestSubmit(submitter);
                } else {
                  formElement.requestSubmit();
                }
              } else {
                // Legacy-safe fallback: trigger a real submit event path (do not bypass handlers).
                const fallbackSubmit = document.createElement("button");
                fallbackSubmit.type = "submit";
                fallbackSubmit.hidden = true;
                formElement.appendChild(fallbackSubmit);
                fallbackSubmit.click();
                fallbackSubmit.remove();
              }
            } finally {
              if (formElement.dataset) {
                delete formElement.dataset.wdpRetryingSubmit;
              }
            }
          });
        }

        const currentForm = getModule('form');
        if (currentForm && typeof currentForm.setup === 'function') {
          currentForm.setup(formElement);
          retrySubmitAfterSetup();
        } else {
          requestAnimationFrame(function() {
            const retryForm = getModule('form');
            if (retryForm && typeof retryForm.setup === 'function') {
              retryForm.setup(formElement);
              retrySubmitAfterSetup();
            }
          });
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

      delegatedEventsBound = true;
    }
  }

  // Export
  WDPApp.eventManager = {
    init: initializeEventListeners,
  };

})(window);

