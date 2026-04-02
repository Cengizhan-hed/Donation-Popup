/**
 * Module Loader - Modül yükleme ve güncelleme
 * updateModuleFunctions, waitForModulesAndInit
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Module loader helper
  function getModule(name) {
    return WDPApp[name] || {};
  }

  // Modülleri güncelle (dinamik olarak)
  function updateModuleFunctions() {
    const currentModal = getModule('modal');
    const currentForm = getModule('form');
    const currentShareholder = getModule('shareholder');
    
    return {
      modal: {
        open: currentModal && typeof currentModal.open === 'function' ? currentModal.open : null,
        close: currentModal && typeof currentModal.close === 'function' ? currentModal.close : null,
      },
      form: {
        setup: currentForm && typeof currentForm.setup === 'function' ? currentForm.setup : null,
      },
      shareholder: {
        setup: currentShareholder && typeof currentShareholder.setup === 'function' ? currentShareholder.setup : null,
      },
    };
  }

  // Modüllerin yüklenmesini bekle ve callback çağır
  function waitForModulesAndInit(callback) {
    if (!callback || typeof callback !== 'function') {
      return;
    }
    
    // İlk kontrol - modüller yüklenmiş mi?
    const utilsReady = !!WDPApp.utils;
    const stateReady = !!WDPApp.state;
    const modalReady = !!WDPApp.modal;
    const formReady = !!WDPApp.form;
    
    // Eğer tüm kritik modüller yüklendiyse, hemen callback çağır
    if (utilsReady && stateReady && modalReady && formReady) {
      updateModuleFunctions();
      callback();
      return;
    }
    
    // Modüller henüz yüklenmemişse bekle (max 5 saniye)
    const constants = WDPApp.constants || {};
    const timing = constants.TIMING || {};
    const moduleLoad = constants.MODULE_LOAD || {};
    
    let attempts = 0;
    const maxAttempts = moduleLoad.MAX_ATTEMPTS || 50;
    const checkInterval = moduleLoad.CHECK_INTERVAL || 100;
    const initialDelay = timing.INITIAL_CHECK_DELAY || 200;
    
    function checkModules() {
      attempts++;
      
      const utilsReadyNow = !!WDPApp.utils;
      const stateReadyNow = !!WDPApp.state;
      const modalReadyNow = !!WDPApp.modal;
      const formReadyNow = !!WDPApp.form;
      
      const modulesReady = utilsReadyNow && stateReadyNow && modalReadyNow && formReadyNow;
      
      if (modulesReady || attempts >= maxAttempts) {
        updateModuleFunctions();
        callback();
      } else {
        // Check interval sonra tekrar dene
        setTimeout(checkModules, checkInterval);
      }
    }
    
    // İlk denemeyi biraz geciktir (script'ler yükleniyor olabilir)
    setTimeout(checkModules, initialDelay);
  }

  // Modüllerin yüklenip yüklenmediğini kontrol et
  function areModulesReady() {
    return !!(
      WDPApp.utils && 
      WDPApp.state && 
      WDPApp.modal && 
      WDPApp.form
    );
  }

  // Export
  WDPApp.moduleLoader = {
    update: updateModuleFunctions,
    wait: waitForModulesAndInit,
    ready: areModulesReady,
  };

})(window);

