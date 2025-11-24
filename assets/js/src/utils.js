/**
 * Utils - Yardımcı fonksiyonlar
 * Format, log, ajax, accessibility yardımcıları
 */

(function(window) {
  'use strict';

  // Global namespace initialization
  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const jQuery = window.jQuery || null;

  // WooCommerce parametreleri için güvenli kontrol
  if (typeof wc_add_to_cart_params === 'undefined') {
    var wc_add_to_cart_params = window.wc_add_to_cart_params || {
      ajax_url: '',
      wc_ajax_url: '/?wc-ajax=%%endpoint%%',
      i18n_view_cart: 'Sepeti görüntüle',
      cart_url: '/sepet/',
      is_cart: false,
      is_single_product: true,
      cart_redirect_after_add: false,
    };
  }

  // Plugin parametreleri için güvenli kontrol (tek tanım)
  let wdp_ajax;
  if (typeof window.wdp_ajax !== 'undefined') {
    wdp_ajax = window.wdp_ajax;
  } else {
    wdp_ajax = {
      ajax_url: window.location.origin + '/wp-admin/admin-ajax.php',
      nonce: '',
      version: '10.0',
      cart_url: '/sepet/',
      checkout_url: '/odeme-sayfasi/',
      theme: '',
      theme_slug: '',
      debug: false,
      nonces: {},
      strings: {},
    };
    // Global'e de kaydet (diğer modüller için)
    window.wdp_ajax = wdp_ajax;
  }

  if (!wdp_ajax.nonces) {
    wdp_ajax.nonces = {};
  }

  WDPApp.config = { ajax: wdp_ajax };
  window.WDP = window.WDP || {};
  window.WDP.app = WDPApp;

  // Burada export yok, export dosyanın sonunda yapılacak
  // console.log burada çok erken, dosyanın sonunda log yapılacak

  // Fiyat formatı için yardımcı fonksiyon
  function formatPrice(price) {
    // Null, undefined veya boş string kontrolü
    if (price === null || price === undefined || price === '') {
      return '0,00'
    }
    
    // String ise temizle (boşluk, nokta, virgül vb.)
    let numericPrice;
    if (typeof price === 'string') {
      // Boşlukları, noktaları ve virgülleri temizle
      const cleaned = price.toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
      numericPrice = Number.parseFloat(cleaned);
    } else if (typeof price === 'number') {
      numericPrice = price;
    } else {
      return '0,00'
    }
    
    // NaN kontrolü
    if (!Number.isFinite(numericPrice) || isNaN(numericPrice)) {
      return '0,00'
    }
    
    // Negatif fiyat kontrolü (genellikle fiyat pozitif olmalı)
    if (numericPrice < 0) {
      numericPrice = 0;
    }
    
    return numericPrice.toFixed(2).replace(".", ",")
  }

  // Modern para formatı
  function formatCurrency(amount, options = {}) {
    const numericValue = Number((typeof amount === 'string' ? amount.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.') : amount))

    if (!Number.isFinite(numericValue)) {
      // Para birimi bilgisini al (Currency eklentisi desteği için)
      const currencySymbol = (wdp_ajax && wdp_ajax.currency && wdp_ajax.currency.symbol) ? wdp_ajax.currency.symbol : '₺'
      return currencySymbol + '0,00'
    }

    // Para birimi bilgisini al (Currency eklentisi desteği için)
    const currencyCode = (wdp_ajax && wdp_ajax.currency && wdp_ajax.currency.code) ? wdp_ajax.currency.code : 'TRY'
    const currencySymbol = (wdp_ajax && wdp_ajax.currency && wdp_ajax.currency.symbol) ? wdp_ajax.currency.symbol : '₺'
    
    // Locale belirle (para birimine göre)
    let locale = 'tr-TR'
    if (currencyCode === 'USD') {
      locale = 'en-US'
    } else if (currencyCode === 'EUR') {
      locale = 'de-DE'
    }

    try {
      return new Intl.NumberFormat(locale, Object.assign({
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }, options)).format(numericValue)
    } catch (error) {
      // Intl desteklemezse basit formata geri dön
      return `${formatPrice(numericValue)} ${currencySymbol}`
    }
  }

  // Güvenli HTML çıktısı için yardımcı fonksiyon
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return ''
    }

    const str = typeof value === 'string' ? value : String(value)

    return str.replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }

      return entities[char] || char
    })
  }

  // Güvenli console.log fonksiyonu
  function safeLog(message, data = null) {
    // Sadece debug modu açıksa logla (production'da kapalı)
    if (wdp_ajax && wdp_ajax.debug) {
      if (data) {
        console.log('WDP:', message, data)
      } else {
        console.log('WDP:', message)
      }
    }
  }

  // AJAX nonce'larını güvenli şekilde almak için yardımcı fonksiyon
  function getAjaxNonce(actionKey) {
    if (wdp_ajax && wdp_ajax.nonces && wdp_ajax.nonces[actionKey]) {
      return wdp_ajax.nonces[actionKey]
    }

    if (wdp_ajax && typeof wdp_ajax.nonce !== "undefined") {
      return wdp_ajax.nonce
    }

    return ""
  }

  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',')

  function getFocusableElements(container) {
    if (!container) {
      return []
    }

    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) => {
      return (
        element.offsetParent !== null &&
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true'
      )
    })
  }

  function focusFirstElement(container) {
    const focusable = getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[0].focus({ preventScroll: true })
      return
    }

    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }
    container.focus({ preventScroll: true })
  }

  function activateFocusTrap(modal) {
    function handleKeyDown(event) {
      if (event.key !== 'Tab') {
        return
      }

      const focusable = getFocusableElements(modal)
      if (!focusable.length) {
        event.preventDefault()
        modal.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    modal.addEventListener('keydown', handleKeyDown)

    return () => {
      modal.removeEventListener('keydown', handleKeyDown)
    }
  }

  WDPApp.liveRegions = WDPApp.liveRegions || {}
  WDPApp.liveRegionTimers = WDPApp.liveRegionTimers || {}

  function ensureLiveRegion(politiness = 'polite') {
    const type = politiness === 'assertive' ? 'assertive' : 'polite'
    if (WDPApp.liveRegions[type]) {
      return WDPApp.liveRegions[type]
    }

    if (!document.body) {
      return null
    }

    const region = document.createElement('div')
    region.id = type === 'assertive' ? 'wdp-live-region-assertive' : 'wdp-live-region'
    region.setAttribute('role', type === 'assertive' ? 'alert' : 'status')
    region.setAttribute('aria-live', type)
    region.setAttribute('aria-atomic', 'true')
    region.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);clip-path:inset(100%);overflow:hidden;white-space:nowrap;'
    document.body.appendChild(region)
    WDPApp.liveRegions[type] = region
    return region
  }

  function announceStatus(message, politiness = 'polite') {
    const type = politiness === 'assertive' ? 'assertive' : 'polite'
    const region = ensureLiveRegion(type)
    if (!region) {
      return
    }

    region.textContent = ''
    if (WDPApp.liveRegionTimers[type]) {
      clearTimeout(WDPApp.liveRegionTimers[type])
    }

    const constants = WDPApp.constants || {};
    const timing = constants.TIMING || {};
    const liveRegionDelay = timing.LIVE_REGION_DELAY || 30;
    WDPApp.liveRegionTimers[type] = window.setTimeout(() => {
      region.textContent = message
    }, liveRegionDelay)
  }

  // Debounce function - delays function execution until after wait time
  function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }

  // Throttle function - limits function execution to once per wait time
  function throttle(func, wait = 100) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, wait);
      }
    };
  }

  // Request Animation Frame throttle - for scroll/resize events
  function rafThrottle(func) {
    let rafId = null;
    return function executedFunction(...args) {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          func.apply(this, args);
          rafId = null;
        });
      }
    };
  }

  // Module dependency helper - centralized module loading
  function ensureModule(moduleName, requiredMethods = [], fallbacks = {}) {
    const module = WDPApp[moduleName] || {};
    let isValid = true;
    const missingMethods = [];

    // Check if module exists
    if (!WDPApp[moduleName]) {
      isValid = false;
    }

    // Check required methods
    requiredMethods.forEach((methodName) => {
      if (!module[methodName] || typeof module[methodName] !== 'function') {
        isValid = false;
        missingMethods.push(methodName);
      }
    });

    // If module is not valid, use fallbacks
    if (!isValid && Object.keys(fallbacks).length > 0) {
      requiredMethods.forEach((methodName) => {
        if (missingMethods.includes(methodName) && fallbacks[methodName]) {
          module[methodName] = fallbacks[methodName];
        }
      });
    }

    return {
      module,
      isValid,
      missingMethods,
    };
  }

  // Export utils module
  const utils = {
    formatPrice,
    formatCurrency,
    escapeHtml,
    safeLog,
    getAjaxNonce,
    getFocusableElements,
    focusFirstElement,
    activateFocusTrap,
    announceStatus,
    debounce, // Performance optimization
    throttle, // Performance optimization
    rafThrottle, // Performance optimization for scroll/resize
    ensureModule, // Export module helper
  }

  WDPApp.utils = utils;

})(window);
