/**
 * Init - Plugin başlatma ve event listener'ları
 * handleDomReady, initializeEventListeners, initializeInlineForms, initializeDirectForms
 */

(function(window) {
  'use strict';

  // HEMEN LOG (script yüklendiğini görmek için)
  if (typeof console !== 'undefined' && console.log) {
    console.log('🚀 WDP: init.js loaded at:', new Date().toISOString());
  }

  // Önce WDPApp namespace'ini güvenli bir şekilde oluştur
  if (!window.WDPApp) {
    window.WDPApp = {};
    if (typeof console !== 'undefined' && console.log) {
      console.log('✅ WDP: WDPApp namespace created');
    }
  }
  const WDPApp = window.WDPApp;
  
  // Hemen WDPApp durumunu logla
  if (typeof console !== 'undefined' && console.log) {
    console.log('📦 WDP: WDPApp initial state:', {
      hasUtils: !!WDPApp.utils,
      hasState: !!WDPApp.state,
      hasModal: !!WDPApp.modal,
      hasForm: !!WDPApp.form,
      hasDom: !!WDPApp.dom,
      hasShareholder: !!WDPApp.shareholder,
      keys: Object.keys(WDPApp)
    });
  }
  
  // Güvenli log fonksiyonu (modüller yüklenmeden önce de çalışabilmeli)
  function safeLog(...args) {
    if (typeof console !== 'undefined' && console.log) {
      console.log.apply(console, args);
    }
  }
  
  // Modülleri güvenli bir şekilde al (henüz yüklenmemişse boş obje)
  function getModule(name) {
    return WDPApp[name] || {};
  }
  
  const utils = getModule('utils');
  const state = getModule('state');
  const dom = getModule('dom');
  const modal = getModule('modal');
  const form = getModule('form');
  const shareholder = getModule('shareholder');
  const cart = getModule('cart');
  
  // Utility fonksiyonları (güvenli fallback'lerle)
  const safeLogUtils = utils.safeLog || safeLog;
  const ensureLiveRegion = utils.ensureLiveRegion || function() {};
  
  // DOM fonksiyonları
  const saveOriginalForms = dom.saveOriginalForms || function() {};
  const removeInlineStylesFromTitles = dom.removeInlineStylesFromTitles || function() {};
  const observeDOMChanges = dom.observeDOMChanges || function() {};
  
  // Modal fonksiyonları (let ile tanımla, sonra güncellenebilsin)
  let openModal = modal.open || function() {
    const log = (typeof console !== 'undefined' && console.log) || function() {};
    log('ERROR: openModal not available yet');
  };
  let closeModal = modal.close || function() {
    const log = (typeof console !== 'undefined' && console.log) || function() {};
    log('ERROR: closeModal not available yet');
  };
  
  // Form fonksiyonları (let ile tanımla, sonra güncellenebilsin)
  let setupFormSubmission = form.setup || function() {
    const log = (typeof console !== 'undefined' && console.log) || function() {};
    log('ERROR: setupFormSubmission not available yet');
  };
  
  // Shareholder fonksiyonları (let ile tanımla, sonra güncellenebilsin)
  let setupShareholderForms = shareholder.setup || function() {
    const log = (typeof console !== 'undefined' && console.log) || function() {};
    log('ERROR: setupShareholderForms not available yet');
  };
  
  // Cart fonksiyonları
  const saveSideCartElements = cart.saveSideCartElements || function() {};

  // Doğrudan (embedded) formları başlatan yardımcı
  function initializeDirectForms(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.wdp-donation-form').forEach((formContainer) => {
      if (formContainer.dataset.wdpInitialized === '1') return;
      const formElement = formContainer.querySelector('form');
      if (!formElement) return;
      
      // setupFormSubmission fonksiyonunu güncelle (eğer henüz yüklenmişse)
      updateModuleFunctions();
      
      const currentForm = getModule('form');
      if (currentForm && typeof currentForm.setup === 'function') {
        setupFormSubmission = currentForm.setup;
      }
      
      if (typeof setupFormSubmission === 'function') {
        setupFormSubmission(formElement);
      } else {
        safeLog("WDP: setupFormSubmission not available yet for form:", formContainer);
        // Modül henüz yüklenmemişse, biraz bekle ve tekrar dene
        setTimeout(function() {
          updateModuleFunctions();
          const retryForm = getModule('form');
          if (retryForm && typeof retryForm.setup === 'function') {
            retryForm.setup(formElement);
          }
        }, 100);
      }
      // Hisseli form mu kontrol et
      const shareCountInput = formElement.querySelector('input[name="share_count"]');
      if (shareCountInput) {
        // setupShareholderForms fonksiyonunu güncelle (eğer henüz yüklenmişse)
        updateModuleFunctions();
        
        const currentShareholder = getModule('shareholder');
        if (currentShareholder && typeof currentShareholder.setup === 'function') {
          setupShareholderForms = currentShareholder.setup;
        }
        
        if (typeof setupShareholderForms === 'function') {
          const productId = formContainer.getAttribute('data-product-id');
          if (productId) {
            setupShareholderForms(formContainer, productId);
          }
        } else {
          safeLog("ERROR: setupShareholderForms is not a function for product:", formContainer.getAttribute('data-product-id'));
          // Modül henüz yüklenmemişse, biraz bekle ve tekrar dene
          setTimeout(function() {
            updateModuleFunctions();
            const retryShareholder = getModule('shareholder');
            if (retryShareholder && typeof retryShareholder.setup === 'function') {
              const productId = formContainer.getAttribute('data-product-id');
              if (productId) {
                retryShareholder.setup(formContainer, productId);
              }
            }
          }, 100);
        }
      }
      formContainer.dataset.wdpInitialized = '1';
    });
  }

  // Olay dinleyicilerini başlat
  function initializeEventListeners() {
    safeLog("=== INITIALIZE EVENT LISTENERS DEBUG START ===");
    safeLog("Initializing event listeners for donation buttons");
    
    // State modülünü kontrol et (henüz yüklenmemişse oluştur)
    const currentState = getModule('state');
    if (!currentState || typeof currentState.listenersInitialized === 'undefined') {
      safeLog("WARNING: state module not loaded yet, creating temporary state");
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
      safeLog("Attaching global event listeners");

      document.addEventListener("click", function(e) {
        safeLog("Click event detected on:", e.target);
        safeLog("Target classes:", e.target.className);
        safeLog("Target tag:", e.target.tagName);
        
        if (e.target.classList.contains("wdp-donate-button") || 
            e.target.classList.contains("wdp-open-modal") ||
            e.target.closest(".wdp-donate-button") ||
            e.target.closest(".wdp-open-modal")) {
          
          safeLog("=== BUTTON CLICK DETECTED ===");
          safeLog("Button element:", e.target);
          safeLog("Button classes:", e.target.className);
          
          e.preventDefault();
          e.stopPropagation();
          
          const button = e.target.classList.contains("wdp-donate-button") || e.target.classList.contains("wdp-open-modal") 
            ? e.target 
            : e.target.closest(".wdp-donate-button") || e.target.closest(".wdp-open-modal");
          
          safeLog("Resolved button element:", button);
          
          if (button) {
            const productId = button.getAttribute("data-product-id");
            safeLog("Product ID from button:", productId);
            
            if (productId) {
              safeLog("Opening modal for product ID:", productId);
              
              // openModal fonksiyonunu güncelle (eğer henüz yüklenmişse)
              updateModuleFunctions();
              
              // Tekrar kontrol et
              const currentModal = getModule('modal');
              if (currentModal && typeof currentModal.open === 'function') {
                openModal = currentModal.open;
              }
              
              if (typeof openModal === 'function') {
                safeLog("Opening modal for product ID:", productId);
                openModal(productId);
              } else {
                safeLog("ERROR: openModal is not a function. Available:", typeof openModal);
                safeLog("WDPApp.modal:", WDPApp.modal);
                safeLog("Attempting to retry in 100ms...");
                // Modül henüz yüklenmemişse, biraz bekle ve tekrar dene
                setTimeout(function() {
                  updateModuleFunctions();
                  const retryModal = getModule('modal');
                  if (retryModal && typeof retryModal.open === 'function') {
                    retryModal.open(productId);
                  } else {
                    safeLog("ERROR: openModal still not available after retry");
                  }
                }, 100);
              }
            } else {
              safeLog("ERROR: Product ID not found in button:", button);
              safeLog("Button attributes:", {
                'data-product-id': button.getAttribute("data-product-id"),
                'id': button.id,
                'class': button.className,
                'text': button.textContent
              });
            }
          } else {
            safeLog("ERROR: Could not resolve button element");
          }
        }
        
        if (e.target.classList.contains("wdp-modal-close") || 
            e.target.closest(".wdp-modal-close")) {
          
          safeLog("=== CLOSE BUTTON CLICK DETECTED ===");
          e.preventDefault();
          e.stopPropagation();
          
          const closeButton = e.target.classList.contains("wdp-modal-close") 
            ? e.target 
            : e.target.closest(".wdp-modal-close");
          
          if (closeButton) {
            // closeModal fonksiyonunu güncelle (eğer henüz yüklenmişse)
            updateModuleFunctions();
            
            const currentModal = getModule('modal');
            if (currentModal && typeof currentModal.close === 'function') {
              closeModal = currentModal.close;
            }
            
            if (typeof closeModal === 'function') {
              const modal = closeButton.closest(".wdp-modal");
              if (modal) {
                closeModal(modal);
              }
            } else {
              safeLog("ERROR: closeModal is not a function");
            }
          }
        }
      });

      document.addEventListener("submit", function(e) {
        safeLog("Submit event detected on:", e.target);
        
        if (e.target.closest(".wdp-modal") || e.target.closest(".wdp-donation-form")) {
          safeLog("=== FORM SUBMIT DETECTED ===");
          e.preventDefault();
          e.stopPropagation();
          
          const formElement = e.target;
          if (formElement) {
            // setupFormSubmission fonksiyonunu güncelle (eğer henüz yüklenmişse)
            updateModuleFunctions();
            
            const currentForm = getModule('form');
            if (currentForm && typeof currentForm.setup === 'function') {
              setupFormSubmission = currentForm.setup;
            }
            
            if (typeof setupFormSubmission === 'function') {
              setupFormSubmission(formElement);
            } else {
              safeLog("ERROR: setupFormSubmission is not a function. WDPApp.form:", WDPApp.form);
              // Modül henüz yüklenmemişse, biraz bekle ve tekrar dene
              setTimeout(function() {
                updateModuleFunctions();
                const retryForm = getModule('form');
                if (retryForm && typeof retryForm.setup === 'function') {
                  retryForm.setup(formElement);
                } else {
                  safeLog("ERROR: setupFormSubmission still not available after retry");
                }
              }, 100);
            }
          }
        }
      });

      document.addEventListener("keydown", function(e) {
        if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("wdp-modal-close")) {
          e.preventDefault();
          
          // closeModal fonksiyonunu güncelle (eğer henüz yüklenmişse)
          updateModuleFunctions();
          
          const currentModal = getModule('modal');
          if (currentModal && typeof currentModal.close === 'function') {
            closeModal = currentModal.close;
          }
          
          const modal = e.target.closest(".wdp-modal");
          if (modal && typeof closeModal === 'function') {
            closeModal(modal);
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
    } else {
      safeLog("Global event listeners already initialized");
    }

    safeLog("Event listeners initialized successfully");
    safeLog("=== INITIALIZE EVENT LISTENERS DEBUG END ===");
  }

  // Inline formları başlat
  function initializeInlineForms() {
    initializeDirectForms(document);
  }

  // DOM ready handler
  function handleDomReady() {
    safeLog("WDP Donation Modal JS v10.0 Loading - DOMContentLoaded");
    
    // Modülleri güncelle (tekrar)
    updateModuleFunctions();

    // Ensure live region (accessibility)
    const currentUtils = getModule('utils');
    if (currentUtils && typeof currentUtils.ensureLiveRegion === 'function') {
      currentUtils.ensureLiveRegion('polite');
      currentUtils.ensureLiveRegion('assertive');
    }

    // Inline style'ları kaldır (tema/eklenti kaynaklı stil çakışmalarını önle)
    const currentDom = getModule('dom');
    if (currentDom && typeof currentDom.removeInlineStylesFromTitles === 'function') {
      currentDom.removeInlineStylesFromTitles();
    }

    // Butonları kontrol et
    const buttons = document.querySelectorAll(".wdp-donate-button, .wdp-open-modal");
    safeLog("WDP: Bulunan buton sayısı:", buttons.length);
    
    buttons.forEach((button, index) => {
      const productId = button.getAttribute("data-product-id");
      safeLog(`WDP: Buton ${index + 1}:`, { 
        element: button, 
        productId: productId,
        classes: button.className,
        text: button.textContent 
      });
    });

    // Side cart elementlerini kaydet
    const currentCart = getModule('cart');
    if (currentCart && typeof currentCart.saveSideCartElements === 'function') {
      currentCart.saveSideCartElements();
    }

    // Olay dinleyicilerini başlat
    initializeEventListeners();

    // Sayfa yüklendikten sonra da bir kez daha kontrol et (bazı temalar için)
    setTimeout(() => {
      safeLog("WDP: setTimeout içinde tekrar kontrol");
      
      // Modülleri tekrar güncelle
      updateModuleFunctions();
      
      initializeEventListeners();
      
      if (currentCart && typeof currentCart.saveSideCartElements === 'function') {
        currentCart.saveSideCartElements();
      }
      
      // Inline style'ları tekrar kaldır (tema/eklenti dinamik olarak ekleyebilir)
      if (currentDom && typeof currentDom.removeInlineStylesFromTitles === 'function') {
        currentDom.removeInlineStylesFromTitles();
      }
      
      // Butonları tekrar kontrol et
      const buttonsAfter = document.querySelectorAll(".wdp-donate-button, .wdp-open-modal");
      safeLog("WDP: setTimeout sonrası bulunan buton sayısı:", buttonsAfter.length);
    }, 1000);

    // Doğrudan formları bul ve başlat
    initializeInlineForms();
  }

  // Modülleri güncelle (dinamik olarak)
  function updateModuleFunctions() {
    safeLog('WDP: updateModuleFunctions called');
    
    const currentModal = getModule('modal');
    const currentForm = getModule('form');
    const currentShareholder = getModule('shareholder');
    
    safeLog('WDP: Module objects:', {
      modal: currentModal,
      form: currentForm,
      shareholder: currentShareholder,
      modalOpen: currentModal && typeof currentModal.open,
      formSetup: currentForm && typeof currentForm.setup,
      shareholderSetup: currentShareholder && typeof currentShareholder.setup
    });
    
    if (currentModal && typeof currentModal.open === 'function') {
      openModal = currentModal.open;
      safeLog('WDP: ✅ openModal updated');
    } else {
      safeLog('WDP: ❌ openModal not available yet');
    }
    
    if (currentModal && typeof currentModal.close === 'function') {
      closeModal = currentModal.close;
      safeLog('WDP: ✅ closeModal updated');
    } else {
      safeLog('WDP: ❌ closeModal not available yet');
    }
    
    if (currentForm && typeof currentForm.setup === 'function') {
      setupFormSubmission = currentForm.setup;
      safeLog('WDP: ✅ setupFormSubmission updated');
    } else {
      safeLog('WDP: ❌ setupFormSubmission not available yet');
    }
    
    if (currentShareholder && typeof currentShareholder.setup === 'function') {
      setupShareholderForms = currentShareholder.setup;
      safeLog('WDP: ✅ setupShareholderForms updated');
    } else {
      safeLog('WDP: ❌ setupShareholderForms not available yet');
    }
  }

  // Modüllerin yüklenmesini bekle ve sonra başlat
  function waitForModulesAndInit() {
    safeLog('WDP: waitForModulesAndInit called');
    safeLog('WDP: WDPApp object:', WDPApp);
    safeLog('WDP: WDPApp keys:', Object.keys(WDPApp || {}));
    
    // İlk kontrol - modüller yüklenmiş mi?
    const utilsReady = !!WDPApp.utils;
    const stateReady = !!WDPApp.state;
    const modalReady = !!WDPApp.modal;
    const formReady = !!WDPApp.form;
    const domReady = !!WDPApp.dom;
    const shareholderReady = !!WDPApp.shareholder;
    
    safeLog('WDP: Module status:', {
      utils: utilsReady,
      state: stateReady,
      dom: domReady,
      modal: modalReady,
      form: formReady,
      shareholder: shareholderReady,
      allModules: utilsReady && stateReady && modalReady && formReady
    });
    
    // Eğer tüm kritik modüller yüklendiyse, hemen başlat
    if (utilsReady && stateReady && modalReady && formReady) {
      safeLog('WDP: ✅ All critical modules ready, initializing immediately');
      updateModuleFunctions();
      handleDomReady();
      return;
    }
    
    // Modüller henüz yüklenmemişse bekle (max 5 saniye - daha uzun süre)
    let attempts = 0;
    const maxAttempts = 50; // 50 x 100ms = 5 saniye
    
    function checkModules() {
      attempts++;
      
      const utilsReadyNow = !!WDPApp.utils;
      const stateReadyNow = !!WDPApp.state;
      const domReadyNow = !!WDPApp.dom;
      const modalReadyNow = !!WDPApp.modal;
      const formReadyNow = !!WDPApp.form;
      const shareholderReadyNow = !!WDPApp.shareholder;
      
      const modulesReady = utilsReadyNow && stateReadyNow && modalReadyNow && formReadyNow;
      
      if (attempts % 10 === 0) {
        safeLog('WDP: Still waiting for modules... attempt ' + attempts + '/' + maxAttempts);
        safeLog('WDP: Module status:', {
          utils: utilsReadyNow,
          state: stateReadyNow,
          dom: domReadyNow,
          modal: modalReadyNow,
          form: formReadyNow,
          shareholder: shareholderReadyNow
        });
      }
      
      if (modulesReady || attempts >= maxAttempts) {
        if (modulesReady) {
          safeLog('WDP: ✅ All modules loaded after waiting, initializing...');
        } else {
          safeLog('WDP: ⚠️ WARNING - Some modules not loaded after timeout, initializing anyway...');
          safeLog('WDP: Final module status:', {
            utils: utilsReadyNow,
            state: stateReadyNow,
            dom: domReadyNow,
            modal: modalReadyNow,
            form: formReadyNow,
            shareholder: shareholderReadyNow,
            WDPApp: WDPApp,
            WDPAppKeys: Object.keys(WDPApp || {})
          });
        }
        
        updateModuleFunctions();
        handleDomReady();
      } else {
        // 100ms sonra tekrar dene
        setTimeout(checkModules, 100);
      }
    }
    
    // İlk denemeyi biraz geciktir (script'ler yükleniyor olabilir)
    setTimeout(checkModules, 200);
  }

  // Script'ler footer'da yükleniyor, bu yüzden hemen çalışmayabilir
  // ÜÇ strateji: 1) Hemen dene, 2) DOMContentLoaded'da dene, 3) Window load'da kesinlikle çalıştır
  
  // Strateji 1: Hemen dene (script'ler yüklenmiş olabilir - init.js en sonda yükleniyor)
  safeLog('🚀 WDP: init.js loaded, starting initialization process');
  safeLog('📋 WDP: Document readyState:', document.readyState);
  safeLog('📋 WDP: Window loaded:', window.addEventListener ? 'Yes' : 'No');
  
  // İlk deneme - script'ler yüklenmiş olabilir (init.js en sonda yükleniyor)
  setTimeout(function() {
    safeLog('⏰ WDP: First check after 200ms');
    waitForModulesAndInit();
  }, 200);
  
  // Strateji 2: DOMContentLoaded'da dene
  if (document.readyState === 'loading') {
    safeLog('⏳ WDP: DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener("DOMContentLoaded", function() {
      safeLog('✅ WDP: DOMContentLoaded event fired');
      waitForModulesAndInit();
    });
  } else {
    safeLog('✅ WDP: DOM already ready, will try immediately');
    // DOM zaten yüklü, biraz bekle ve çalıştır
    setTimeout(function() {
      safeLog('⏰ WDP: DOM ready - executing after delay');
      waitForModulesAndInit();
    }, 300);
  }
  
  // Strateji 3: Window load'da kesinlikle çalıştır (script'ler kesinlikle yüklenmiş olur)
  window.addEventListener("load", function() {
    safeLog('WDP: Window load event - FORCE initialization');
    
    // Modülleri güncelle
    updateModuleFunctions();
    
    // Modüller yüklendiyse kesinlikle başlat
    if (WDPApp.utils && WDPApp.state && WDPApp.modal && WDPApp.form) {
      safeLog('WDP: All modules confirmed loaded at window load');
      updateModuleFunctions();
      handleDomReady();
    } else {
      safeLog('WDP: WARNING - Some modules still not loaded at window load!');
      safeLog('WDP: Module status:', {
        utils: !!WDPApp.utils,
        state: !!WDPApp.state,
        modal: !!WDPApp.modal,
        form: !!WDPApp.form,
        dom: !!WDPApp.dom,
        shareholder: !!WDPApp.shareholder
      });
      // Yine de başlat (fallback)
      handleDomReady();
    }
    
    // Inline style'ları kaldır (tema/eklenti kaynaklı stil çakışmalarını önle)
    const currentDom = getModule('dom');
    if (currentDom && typeof currentDom.removeInlineStylesFromTitles === 'function') {
      currentDom.removeInlineStylesFromTitles();
    }
    
    // Event listener'ları tekrar başlat (ekstra güvenlik için)
    initializeEventListeners();

    // DOM değişikliklerini izle
    if (currentDom && typeof currentDom.observeDOMChanges === 'function') {
      currentDom.observeDOMChanges();
    }
    
    // Dinamik eklenen formlar için de kontrol et
    initializeDirectForms(document);
    
    // Final buton kontrolü
    const finalButtons = document.querySelectorAll(".wdp-donate-button, .wdp-open-modal");
    safeLog("WDP: Final buton kontrolü - bulunan buton sayısı:", finalButtons.length);
    
    // Butonları kontrol et ve logla
    finalButtons.forEach(function(btn, idx) {
      safeLog("WDP: Button " + (idx + 1) + ":", {
        element: btn,
        productId: btn.getAttribute('data-product-id'),
        classes: btn.className,
        visible: btn.offsetParent !== null
      });
    });
  });

  // Export
  WDPApp.init = {
    run: handleDomReady,
    inlineForms: initializeInlineForms,
    directForms: initializeDirectForms,
    eventListeners: initializeEventListeners,
    observe: observeDOMChanges,
  };

})(window);

