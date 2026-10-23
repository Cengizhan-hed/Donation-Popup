/**
 * @file event-manager.js
 * Delegated tıklama, submit ve klavye olaylarını merkezi yönetir.
 * Dış API: WDPApp.eventManager
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Module loader helper
  function getModule(name) {
    return WDPApp[name] || {};
  }
  let delegatedEventsBound = false;

  function getClosestTriggerButton(target) {
    if (!target || typeof target.closest !== 'function') {
      return null;
    }
    if (
      target.classList.contains("wdp-donate-button") ||
      target.classList.contains("wdp-open-modal") ||
      target.classList.contains("wdp-open-side-panel")
    ) {
      return target;
    }
    return (
      target.closest(".wdp-donate-button") ||
      target.closest(".wdp-open-modal") ||
      target.closest(".wdp-open-side-panel")
    );
  }

  function invokeModuleMethod(moduleName, methodName, args) {
    const currentModule = getModule(moduleName);
    if (currentModule && typeof currentModule[methodName] === 'function') {
      currentModule[methodName].apply(currentModule, args || []);
      return;
    }
    requestAnimationFrame(function() {
      const retryModule = getModule(moduleName);
      if (retryModule && typeof retryModule[methodName] === 'function') {
        retryModule[methodName].apply(retryModule, args || []);
      }
    });
  }

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
      function prefetchLazyButton(button) {
        if (button && button.getAttribute("data-wdp-lazy") && WDPApp.lazyModal && typeof WDPApp.lazyModal.prefetch === "function") {
          WDPApp.lazyModal.prefetch(button);
        }
      }
      // pointerenter bubble etmez → pointerover + relatedTarget ile enter benzeri (niyet)
      document.addEventListener("pointerover", function (e) {
        const button = getClosestTriggerButton(e.target);
        if (!button) return;
        const from = e.relatedTarget;
        if (from && typeof button.contains === "function" && button.contains(from)) return;
        prefetchLazyButton(button);
      });
      document.addEventListener("focusin", function (e) {
        prefetchLazyButton(getClosestTriggerButton(e.target));
      });
      document.addEventListener(
        "touchstart",
        function (e) {
          prefetchLazyButton(getClosestTriggerButton(e.target));
        },
        { passive: true, capture: true }
      );
      // PERFORMANCE: Use event delegation and passive listeners where possible
      // Modal açma/ kapama event'leri - Event delegation for better performance
      document.addEventListener("click", function(e) {
        const button = getClosestTriggerButton(e.target);
        if (button) {
          
          e.preventDefault();
          e.stopPropagation();

          if (button.getAttribute("data-wdp-lazy") && WDPApp.lazyModal && typeof WDPApp.lazyModal.ensureAndOpen === "function") {
            WDPApp.lazyModal.ensureAndOpen(button);
            return;
          }

          const productId = button.getAttribute("data-product-id");
          const parsedId = Number.parseInt(productId, 10);
          const idOk =
            WDPApp.utils && typeof WDPApp.utils.isValidProductId === "function"
              ? WDPApp.utils.isValidProductId(parsedId)
              : Number.isFinite(parsedId) && parsedId > 0;
          if (idOk) {
            try {
              const ajax = window.wdp_ajax || {};
              const meta = ajax.meta || {};
              if (meta.enabled && meta.customDebug && window.WDPMetaTracking && typeof window.WDPMetaTracking.trackCustom === "function") {
                window.WDPMetaTracking.trackCustom(
                  "DonationButtonClick",
                  { source: "wdp_donation_plugin", product_id: String(productId) },
                  { eventID: "wdp_dbg_btn_" + String(productId) + "_" + String(Date.now()) }
                );
              }
            } catch (dbc) {}

            let modalId = button.getAttribute("data-wdp-modal-id");
            if (!modalId && button.classList.contains("wdp-open-side-panel")) {
              modalId = "wdp-side-panel-" + productId;
            }
            const openOptions = modalId ? { modalId: modalId } : undefined;
            invokeModuleMethod('modal', 'open', [productId, openOptions]);
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
            const modal = closeButton.closest(".wdp-modal");
            if (modal) {
              invokeModuleMethod('modal', 'close', [modal]);
            }
          }
        }
      });

      // Keyboard events
      document.addEventListener("keydown", function(e) {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("wdp-modal-close")) {
          e.preventDefault();
          const modal = e.target.closest(".wdp-modal");
          if (modal) {
            invokeModuleMethod('modal', 'close', [modal]);
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

        invokeModuleMethod('form', 'setup', [formElement]);
        requestAnimationFrame(retrySubmitAfterSetup);
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

