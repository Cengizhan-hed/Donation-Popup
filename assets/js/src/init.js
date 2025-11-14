/**
 * Init - Plugin başlatma orkestratörü
 * Main initialization orchestrator using modular components
 */

(function(window) {
  'use strict';

  // Önce WDPApp namespace'ini güvenli bir şekilde oluştur
  if (!window.WDPApp) {
    window.WDPApp = {};
  }
  const WDPApp = window.WDPApp;
  
  // Güvenli log fonksiyonu (modüller yüklenmeden önce de çalışabilmeli)
  function safeLog(...args) {
    if (typeof console !== 'undefined' && console.log) {
      console.log.apply(console, args);
    }
  }
  
  // Modülleri güvenli bir şekilde al
  function getModule(name) {
    return WDPApp[name] || {};
  }

  // DOM ready handler - main initialization
  function handleDomReady() {
    // Ensure live region (accessibility)
    const utils = getModule('utils');
    if (utils && typeof utils.ensureLiveRegion === 'function') {
      utils.ensureLiveRegion('polite');
      utils.ensureLiveRegion('assertive');
    }

    // Inline style'ları kaldır (tema/eklenti kaynaklı stil çakışmalarını önle)
    const dom = getModule('dom');
    if (dom && typeof dom.removeInlineStylesFromTitles === 'function') {
      dom.removeInlineStylesFromTitles();
    }

    // Side cart elementlerini kaydet
    const cart = getModule('cart');
    if (cart && typeof cart.saveSideCartElements === 'function') {
      cart.saveSideCartElements();
    }

    // Olay dinleyicilerini başlat
    const eventManager = getModule('eventManager');
    if (eventManager && typeof eventManager.init === 'function') {
      eventManager.init();
    }

    // Doğrudan formları bul ve başlat
    const formInitializer = getModule('formInitializer');
    if (formInitializer && typeof formInitializer.inline === 'function') {
      formInitializer.inline();
    }

    // Sayfa yüklendikten sonra da bir kez daha kontrol et (bazı temalar için)
    setTimeout(() => {
      // Modülleri tekrar güncelle
      const moduleLoader = getModule('moduleLoader');
      if (moduleLoader && typeof moduleLoader.update === 'function') {
        moduleLoader.update();
      }
      
      // Event listener'ları tekrar başlat
      if (eventManager && typeof eventManager.init === 'function') {
        eventManager.init();
      }
      
      // Side cart elementlerini tekrar kaydet
      if (cart && typeof cart.saveSideCartElements === 'function') {
        cart.saveSideCartElements();
      }
      
      // Inline style'ları tekrar kaldır (tema/eklenti dinamik olarak ekleyebilir)
      if (dom && typeof dom.removeInlineStylesFromTitles === 'function') {
        dom.removeInlineStylesFromTitles();
      }
      
      // Formları tekrar başlat
      if (formInitializer && typeof formInitializer.inline === 'function') {
        formInitializer.inline();
      }
    }, (WDPApp.constants && WDPApp.constants.TIMING && WDPApp.constants.TIMING.FALLBACK_CHECK_DELAY) || 1000);
  }

  // Modüllerin yüklenmesini bekle ve başlat
  function initialize() {
    const moduleLoader = getModule('moduleLoader');
    
    if (moduleLoader && typeof moduleLoader.wait === 'function') {
      // Use module loader to wait for dependencies
      moduleLoader.wait(handleDomReady);
    } else {
      // Fallback: immediate initialization if module loader not available
      handleDomReady();
    }
  }

  // Initialization strategy - simplified single approach
  function startInitialization() {
    // Check if DOM is ready
    if (document.readyState === 'loading') {
      // Wait for DOMContentLoaded
      document.addEventListener("DOMContentLoaded", initialize);
    } else {
      // DOM already ready, initialize immediately
      setTimeout(initialize, 100);
    }
    
    // Fallback: Window load event (ensures all scripts are loaded)
    window.addEventListener("load", function() {
      // Update module functions before final initialization
      const moduleLoader = getModule('moduleLoader');
      if (moduleLoader && typeof moduleLoader.update === 'function') {
        moduleLoader.update();
      }
      
      // Final initialization
      handleDomReady();
      
      // DOM değişikliklerini izle
      const dom = getModule('dom');
      if (dom && typeof dom.observeDOMChanges === 'function') {
        dom.observeDOMChanges();
      }
      
      // Dinamik eklenen formlar için de kontrol et
      const formInitializer = getModule('formInitializer');
      if (formInitializer && typeof formInitializer.direct === 'function') {
        formInitializer.direct(document);
      }
    });
  }

  // Start initialization
  startInitialization();

  // Export
  WDPApp.init = {
    run: handleDomReady,
    inlineForms: function() {
      const formInitializer = getModule('formInitializer');
      if (formInitializer && typeof formInitializer.inline === 'function') {
        formInitializer.inline();
      }
    },
    directForms: function(root) {
      const formInitializer = getModule('formInitializer');
      if (formInitializer && typeof formInitializer.direct === 'function') {
        formInitializer.direct(root);
      }
    },
    eventListeners: function() {
      const eventManager = getModule('eventManager');
      if (eventManager && typeof eventManager.init === 'function') {
        eventManager.init();
      }
    },
    observe: function() {
      const dom = getModule('dom');
      if (dom && typeof dom.observeDOMChanges === 'function') {
        dom.observeDOMChanges();
      }
    },
  };

})(window);
