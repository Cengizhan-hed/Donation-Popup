/**
 * @file init.js
 * DOM hazır olduğunda WDPApp ön yüzünü başlatır.
 * Dış API: WDPApp.init
 */

(function(window) {
  'use strict';

  // Önce WDPApp namespace'ini güvenli bir şekilde oluştur
  if (!window.WDPApp) {
    window.WDPApp = {};
  }
  const WDPApp = window.WDPApp;
  
  // Modülleri güvenli bir şekilde al
  function getModule(name) {
    return WDPApp[name] || {};
  }

  // ✅ GÜVENLİ: Event listener'lar için flag kontrolü (gereksiz tekrarları önler)
  let listenersInitialized = false;
  let fallbackScheduled = false;

  function runCoreSetup() {
    const utils = getModule('utils');
    if (utils && typeof utils.ensureLiveRegion === 'function') {
      utils.ensureLiveRegion('polite');
      utils.ensureLiveRegion('assertive');
    }

    const ctaViewport = getModule('ctaViewport');
    if (ctaViewport && typeof ctaViewport.init === 'function') {
      ctaViewport.init();
    }

    const dom = getModule('dom');
    if (dom && typeof dom.removeInlineStylesFromTitles === 'function') {
      dom.removeInlineStylesFromTitles();
    }

    const cart = getModule('cart');
    if (cart && typeof cart.saveSideCartElements === 'function') {
      cart.saveSideCartElements();
    }

    const formInitializer = getModule('formInitializer');
    if (formInitializer && typeof formInitializer.inline === 'function') {
      formInitializer.inline();
    }

    if (!listenersInitialized) {
      const eventManager = getModule('eventManager');
      if (eventManager && typeof eventManager.init === 'function') {
        eventManager.init();
        listenersInitialized = true;
      }
    }
  }

  // DOM ready handler - main initialization
  function handleDomReady() {
    runCoreSetup();

    // Sayfa yüklendikten sonra da bir kez daha kontrol et (bazı temalar için) - Optimized delay
    if (fallbackScheduled) {
      return;
    }
    fallbackScheduled = true;
    const fallbackDelay = (WDPApp.constants && WDPApp.constants.TIMING && WDPApp.constants.TIMING.FALLBACK_CHECK_DELAY) || 100;
    if (fallbackDelay > 0) {
      setTimeout(() => {
        // Modülleri tekrar güncelle
        const moduleLoader = getModule('moduleLoader');
        if (moduleLoader && typeof moduleLoader.update === 'function') {
          moduleLoader.update();
        }
        runCoreSetup();
      }, fallbackDelay);
    }
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

  // Initialization strategy - simplified single approach - INSTANT execution
  function startInitialization() {
    // Check if DOM is ready
    if (document.readyState === 'loading') {
      // Wait for DOMContentLoaded
      document.addEventListener("DOMContentLoaded", initialize);
    } else {
      // DOM already ready, initialize immediately (no delay)
      initialize();
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
