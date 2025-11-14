/**
 * Constants - Sabitler ve yapılandırma değerleri
 * Magic numbers ve timing constants
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  // Timing constants (milliseconds)
  const TIMING = {
    MODULE_LOAD_TIMEOUT: 5000,        // Max wait time for modules (5 seconds)
    RETRY_DELAY: 100,                 // Delay between retries
    DOM_CHECK_DELAY: 50,              // Delay for DOM checks
    INITIAL_CHECK_DELAY: 200,         // Initial check delay
    DOM_READY_DELAY: 300,             // DOM ready execution delay
    FALLBACK_CHECK_DELAY: 1000,       // Fallback check delay (for themes)
    LIVE_REGION_DELAY: 30,            // Live region announcement delay
    SHAREHOLDER_RETRY_DELAY: 200,     // Shareholder form setup retry delay
    MODAL_OPEN_DELAY: 50,             // Modal open delay
  };

  // Module loading constants
  const MODULE_LOAD = {
    MAX_ATTEMPTS: 50,                 // Max retry attempts (50 x 100ms = 5 seconds)
    CHECK_INTERVAL: 100,              // Check interval (100ms)
    LOG_INTERVAL: 10,                 // Log every N attempts
  };

  // CSS Selectors - frequently used selectors
  const SELECTORS = {
    DONATE_BUTTON: '.wdp-donate-button, .wdp-open-modal',
    MODAL: '.wdp-modal',
    MODAL_CLOSE: '.wdp-modal-close',
    DONATION_FORM: '.wdp-donation-form',
    FORM: 'form',
    SHARE_COUNT_INPUT: 'input[name="share_count"]',
    SHAREHOLDERS_CONTAINER: '.wdp-shareholders-container',
    SHARES_SECTION: '.wdp-shares-section',
    PRODUCT_QUANTITY: '.wdp-product-quantity',
    MODAL_TITLE: '.wdp-modal-title',
    FORM_TITLE: '.wdp-form-title',
    FORM_ERROR: '.wdp-form-error',
  };

  // Shareholder form constants
  const SHAREHOLDER = {
    MAX_SHARES: 7,                    // Default max shares
    MIN_SHARES: 1,                    // Minimum shares
    SCROLL_CONFIG: {
      min: 260,                       // Minimum scroll height
      max: 440,                       // Maximum scroll height
      ratio: 0.6,                     // Scroll ratio
    },
  };

  // Alert constants
  const ALERT = {
    AUTO_DISMISS: 7000,               // Auto dismiss delay (7 seconds)
  };

  // Export constants
  WDPApp.constants = {
    TIMING,
    MODULE_LOAD,
    SELECTORS,
    SHAREHOLDER,
    ALERT,
  };

})(window);

