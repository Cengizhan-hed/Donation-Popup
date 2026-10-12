/**
 * @file constants.js
 * Sabitler: AJAX eylem adları, CSS sınıfları ve yapılandırma anahtarları.
 * Dış API: WDPApp.constants
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  // Timing constants (milliseconds) - Optimized for instant performance
  const TIMING = {
    MODULE_LOAD_TIMEOUT: 5000,        // Max wait time for modules (5 seconds)
    RETRY_DELAY: 50,                  // Delay between retries (reduced from 100ms)
    DOM_CHECK_DELAY: 0,               // Delay for DOM checks (removed - instant)
    INITIAL_CHECK_DELAY: 0,           // Initial check delay (removed - instant)
    DOM_READY_DELAY: 0,               // DOM ready execution delay (removed - instant)
    FALLBACK_CHECK_DELAY: 100,       // Fallback check delay (reduced from 1000ms)
    /** Sepete eklemeden önce nonce yenileme isteğini en fazla bu kadar sıklıkla yap (ms) */
    NONCE_REFRESH_TTL_MS: 180000,    // 3 dakika — gereksiz round-trip azaltır
    /** Sepet fragment AJAX yeniden deneme gecikmesi (ms) */
    CART_FRAGMENT_RETRY_DELAY: 800,
    LIVE_REGION_DELAY: 0,            // Live region announcement delay (removed - instant)
    SHAREHOLDER_RETRY_DELAY: 0,       // Shareholder form setup retry delay (removed - instant)
    MODAL_OPEN_DELAY: 0,              // Modal open delay (removed - instant open)
  };

  // Module loading constants
  const MODULE_LOAD = {
    MAX_ATTEMPTS: 50,                 // Max retry attempts (50 x 100ms = 5 seconds)
    CHECK_INTERVAL: 100,              // Check interval (100ms)
    LOG_INTERVAL: 10,                 // Log every N attempts
  };

  // CSS Selectors - frequently used selectors
  const SELECTORS = {
    DONATE_BUTTON: '.wdp-donate-button, .wdp-open-modal, .wdp-open-side-panel',
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

