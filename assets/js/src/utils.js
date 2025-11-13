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
      return '₺0,00'
    }

    try {
      return new Intl.NumberFormat('tr-TR', Object.assign({
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }, options)).format(numericValue)
    } catch (error) {
      // Intl desteklemezse basit formata geri dön
      return `${formatPrice(numericValue)} TL`
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
    if (wdp_ajax.debug || true) { // Debug'ı her zaman açık tut
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

    WDPApp.liveRegionTimers[type] = window.setTimeout(() => {
      region.textContent = message
    }, 30)
  }

  // Export
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
  }

  // Hemen export et (modüller bekliyor)
  WDPApp.utils = utils;
  
  // Export'un başarılı olduğunu logla
  console.log('✅ WDP: utils.js loaded - Version 10.0');
  console.log('📦 WDP: WDPApp.utils exported:', !!WDPApp.utils);
  console.log('🔧 WDP: utils object keys:', Object.keys(utils));
  console.log('🔧 WDP: utils functions:', {
    formatPrice: typeof formatPrice,
    formatCurrency: typeof formatCurrency,
    escapeHtml: typeof escapeHtml,
    safeLog: typeof safeLog,
    getAjaxNonce: typeof getAjaxNonce,
  });

})(window);
