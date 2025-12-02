/**
 * ============================================================================
 * PROGRESS-BAR.JS - PROGRESS BAR YÖNETİMİ MODÜLÜ
 * ============================================================================
 * 
 * DOSYA: progress-bar.js
 * KONUM: /assets/js/src/progress-bar.js
 * 
 * AMAÇ:
 * Progress bar'ı dinamik olarak yönetir.
 * Özel fiyat yazıldığında preview gösterir, bağış yapıldığında gerçek değeri günceller.
 * 
 * ANA İŞLEVLER:
 * 1. setupProgressBar - Progress bar'ı başlatma
 * 2. updateProgressBar - Progress bar'ı güncelleme
 * 3. updatePreview - Preview (özel fiyat) güncelleme
 * 4. updateRealProgress - Gerçek bağış miktarını güncelleme
 * 
 * ============================================================================
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const { formatCurrency, safeLog } = utils;

  /**
   * Progress bar'ı başlat
   * @param {HTMLElement} container - Progress bar container elementi
   */
  function setupProgressBar(container) {
    if (!container) return;

    const productId = container.getAttribute('data-product-id');
    const limit = parseFloat(container.getAttribute('data-limit')) || 100000;
    const current = parseFloat(container.getAttribute('data-current')) || 0;

    // Progress bar elementlerini bul
    const fillBar = container.querySelector('.wdp-progress-bar-fill');
    const previewBar = container.querySelector('.wdp-progress-bar-preview');
    const amountElement = container.querySelector('.wdp-progress-bar-amount');
    const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');

    if (!fillBar || !previewBar || !amountElement || !percentageElement) {
      return;
    }

    // Form içindeki özel fiyat input'unu bul
    const form = container.closest('.wdp-modal, .wdp-donation-form')?.querySelector('form');
    if (!form) return;

    const customPriceInput = form.querySelector('input[name="custom_price"]');
    if (!customPriceInput) return;

    // Progress bar formunda step'i 1 yap (virgül/küsürat yok)
    if (customPriceInput.classList.contains('wdp-custom-price-input')) {
      customPriceInput.setAttribute('step', '1');
    }

    // Özel fiyat değiştiğinde preview'ı güncelle
    customPriceInput.addEventListener('input', function() {
      // Virgül ve küsürat kısmını temizle - sadece tam sayı kabul et
      let rawValue = this.value.toString().trim();
      
      // Sadece rakamları al (virgül, nokta, boşluk vb. temizle)
      let numericOnly = rawValue.replace(/[^\d]/g, '');
      
      // Eğer kullanıcı virgül/nokta girmişse, sadece tam sayı kısmını göster
      if (numericOnly !== rawValue && numericOnly !== '') {
        this.value = parseInt(numericOnly, 10) || '';
      }
      
      // Her input değişikliğinde güncel current değerini al
      const currentValue = parseFloat(container.getAttribute('data-current')) || 0;
      const finalValue = this.value === '' ? '' : this.value.toString().replace(/[^\d]/g, '');
      const inputValue = finalValue === '' ? 0 : parseInt(finalValue, 10) || 0;
      updatePreview(container, currentValue, limit, inputValue);
    });

    // Özel fiyat temizlendiğinde preview'ı sıfırla
    customPriceInput.addEventListener('blur', function() {
      if (!this.value || parseFloat(this.value) === 0) {
        const currentValue = parseFloat(container.getAttribute('data-current')) || 0;
        updatePreview(container, currentValue, limit, 0);
      }
    });

    // İlk renk kontrolünü yap
    const initialPercentage = Math.min(100, (current / Math.max(1, limit)) * 100);
    updatePercentageColor(percentageElement, initialPercentage);
    
    safeLog('Progress bar initialized for product:', productId);
  }

  /**
   * Preview (özel fiyat) güncelle
   * @param {HTMLElement} container - Progress bar container
   * @param {number} current - Mevcut toplam bağış
   * @param {number} limit - Üst limit
   * @param {number} previewAmount - Preview için özel fiyat
   */
  function updatePreview(container, current, limit, previewAmount) {
    const fillBar = container.querySelector('.wdp-progress-bar-fill');
    const previewBar = container.querySelector('.wdp-progress-bar-preview');
    const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');

    if (!fillBar || !previewBar || !percentageElement) return;

    const totalWithPreview = current + previewAmount;
    const currentPercentage = Math.min(100, (current / Math.max(1, limit)) * 100);
    const totalPercentageRaw = (totalWithPreview / Math.max(1, limit)) * 100;
    const totalPercentage = Math.min(100, totalPercentageRaw);
    
    // Preview yüzdesini hesapla - fill bar'ın sonundan başlamalı
    let previewPercentage = 0;
    
    if (previewAmount > 0) {
      if (totalPercentageRaw >= 100) {
        // Limit aşıldıysa, preview bar'ı tam sona kadar göster
        previewPercentage = 100 - currentPercentage;
      } else {
        // Normal durumda, preview yüzdesini hesapla
        previewPercentage = totalPercentage - currentPercentage;
      }
    }

    // Gerçek bağış yüzdesini güncelle
    fillBar.style.width = currentPercentage + '%';

    // Preview bar'ı fill bar'ın sonundan başlat ve genişliğini ayarla
    if (previewPercentage > 0) {
      previewBar.style.left = currentPercentage + '%';
      previewBar.style.width = previewPercentage + '%';
      previewBar.style.display = 'block';
    } else {
      previewBar.style.left = '0%';
      previewBar.style.width = '0%';
      previewBar.style.display = 'none';
    }

    // Toplam yüzdeyi göster (limit aşıldıysa 100% göster)
    percentageElement.textContent = totalPercentage.toFixed(1) + '%';
    
    // Yüzde değerinin renk değişimini kontrol et (fill %50'den fazlaysa beyaz)
    updatePercentageColor(percentageElement, currentPercentage);
  }
  
  /**
   * Yüzde değerinin renk değişimini güncelle
   * Progress bar'ın ortası %50, eğer fill %50'den fazlaysa yüzde değeri fill üzerinde
   * @param {HTMLElement} percentageElement - Yüzde değeri elementi
   * @param {number} fillPercentage - Fill yüzdesi
   */
  function updatePercentageColor(percentageElement, fillPercentage) {
    if (!percentageElement) return;
    
    // Yüzde değeri progress bar'ın ortasında, eğer fill %50'den fazlaysa beyaz renk
    if (fillPercentage >= 50) {
      percentageElement.classList.add('on-fill');
    } else {
      percentageElement.classList.remove('on-fill');
    }
  }

  /**
   * Gerçek bağış miktarını güncelle
   * @param {HTMLElement} container - Progress bar container
   * @param {number} newAmount - Yeni toplam bağış miktarı
   * @param {number} limit - Üst limit
   */
  function updateRealProgress(container, newAmount, limit) {
    const fillBar = container.querySelector('.wdp-progress-bar-fill');
    const amountElement = container.querySelector('.wdp-progress-bar-amount');
    const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');
    const previewBar = container.querySelector('.wdp-progress-bar-preview');

    if (!fillBar || !amountElement || !percentageElement) return;

    const percentage = Math.min(100, (newAmount / Math.max(1, limit)) * 100);

    // Animasyonlu güncelleme
    fillBar.style.transition = 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    fillBar.style.width = percentage + '%';

    // Miktarı güncelle
    amountElement.textContent = formatCurrency(newAmount);

    // Yüzdeyi güncelle
    percentageElement.textContent = percentage.toFixed(1) + '%';
    
    // Yüzde değerinin renk değişimini kontrol et
    updatePercentageColor(percentageElement, percentage);

    // Preview'ı temizle
    if (previewBar) {
      previewBar.style.width = '0%';
      previewBar.style.display = 'none';
    }

    // Container'ın data-current değerini güncelle
    container.setAttribute('data-current', newAmount.toString());
  }

  /**
   * Tüm progress bar'ları başlat
   */
  function initAllProgressBars() {
    const containers = document.querySelectorAll('.wdp-progress-bar-container');
    containers.forEach(container => {
      setupProgressBar(container);
    });
  }

  // DOMContentLoaded'da başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllProgressBars);
  } else {
    initAllProgressBars();
  }

  // Export
  WDPApp.progressBar = {
    setup: setupProgressBar,
    updatePreview: updatePreview,
    updateReal: updateRealProgress,
    initAll: initAllProgressBars,
  };

})(window);

