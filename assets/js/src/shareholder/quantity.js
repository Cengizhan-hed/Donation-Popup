/**
 * @file quantity.js
 * Hisse adedi artır/azalt ve birim fiyat güncelleme.
 * Dış API: WDPApp.shareholderQuantity
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const { safeLog, formatCurrency } = utils;
  const { productPrices } = state;
  const shareholderRender = WDPApp.shareholderRender || {};
  const wdpAjax = window.wdp_ajax || {};

  const hooks = {};
  function registerHooks(next) {
    if (next && typeof next === 'object') Object.assign(hooks, next);
  }
  function callHook(name) {
    const fn = hooks[name];
    if (typeof fn === 'function') return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }

  function setupCopyFormButton(form) {
    if (typeof shareholderRender.setupCopyFormButton === 'function') {
      shareholderRender.setupCopyFormButton(form);
    }
  }

  function syncShareholderUnitPrices(modal, unitNumeric) {
    if (!modal) return;
    const nodes = modal.querySelectorAll('.wdp-shareholder-unit-price');
    if (!nodes.length) return;
    const labelBase = (wdpAjax.strings && wdpAjax.strings.unit_price_label) ? String(wdpAjax.strings.unit_price_label) : 'Birim fiyat';
    let text = '';
    if (Number.isFinite(unitNumeric) && unitNumeric > 0) {
      text = formatCurrency(unitNumeric);
    }
    nodes.forEach((el) => {
      el.textContent = text;
      if (text) {
        el.removeAttribute('aria-hidden');
        el.setAttribute('aria-label', `${labelBase} ${text}`);
      } else {
        el.setAttribute('aria-hidden', 'true');
        el.removeAttribute('aria-label');
      }
    });
  }

  function resolveShareUnitPrice(modal) {
    if (!modal) {
      return 0;
    }
    const ds = modal.getAttribute('data-wdp-unit-price');
    let unit = ds ? Number.parseFloat(ds) : 0;
    if (!Number.isFinite(unit) || unit <= 0) {
      const productId = modal.getAttribute('data-product-id')
        || (modal.querySelector('input[name="wdp_product_id"]') && modal.querySelector('input[name="wdp_product_id"]').value);
      if (productId && productPrices && productPrices[productId]) {
        unit = Number.parseFloat(productPrices[productId]);
      }
    }
    return Number.isFinite(unit) && unit > 0 ? unit : 0;
  }

  function updateSharesTotalBar(modal) {
    if (!modal) {
      return;
    }
    const form = modal.querySelector('form.wdp-has-shareholders');
    if (!form) {
      return;
    }
    const bar = form.querySelector('.wdp-shares-total-bar');
    if (!bar) {
      return;
    }
    const countInput = form.querySelector('input[name="share_count"]');
    const count = countInput ? Math.max(1, Number.parseInt(countInput.value, 10) || 1) : 1;
    const valueEl = bar.querySelector('.wdp-shares-total-bar__value');
    if (!valueEl) {
      return;
    }
    const unit = resolveShareUnitPrice(modal);
    bar.hidden = false;
    bar.removeAttribute('hidden');
    if (!unit) {
      valueEl.textContent = '—';
      const detailEmpty = form.querySelector('.wdp-shares-total-bar__detail, .wdp-footer-total__detail');
      if (detailEmpty) {
        detailEmpty.hidden = true;
        detailEmpty.textContent = '';
      }
      return;
    }
    valueEl.textContent = formatCurrency(unit * count);
    const detail = form.querySelector('.wdp-shares-total-bar__detail, .wdp-footer-total__detail');
    if (detail) {
      detail.hidden = false;
      detail.textContent = count + ' hisse × ' + formatCurrency(unit);
    }
  }

  function syncShareholderUnitPricesFromModal(modal) {
    if (!modal) return;
    const idInput = modal.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
    const id = idInput ? Number.parseInt(idInput.value, 10) : 0;
    let unit = 0;
    if (id && productPrices && Number.isFinite(Number(productPrices[id]))) {
      unit = Number(productPrices[id]);
    }
    if (!Number.isFinite(unit) || unit <= 0) {
      const ds = modal.getAttribute('data-wdp-unit-price');
      unit = ds ? Number.parseFloat(ds) : 0;
    }
    syncShareholderUnitPrices(modal, unit);
    updateSharesTotalBar(modal);
  }

  function setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $modal = (sel) => modal.querySelector(sel);
    
    safeLog("Setting up share quantity buttons for modal:", modal.id);
    
    // Hisse adedi artırma/azaltma butonlarını bul
    const decreaseBtn = $modal(".wdp-share-btn.wdp-share-btn-decrease");
    const increaseBtn = $modal(".wdp-share-btn.wdp-share-btn-increase");

    // Quantity input'unu bul
    const quantityInput = $modal('input[name="quantity"]');
    
    safeLog("Found buttons:", {
      decreaseBtn: !!decreaseBtn,
      increaseBtn: !!increaseBtn,
      quantityInput: !!quantityInput
    });

    // Input değişikliğini dinle
    let activeShareCountInput =
      shareCountInput && shareCountInput.parentNode
        ? shareCountInput
        : $modal('input[name="share_count"]');
    if (!activeShareCountInput) {
      safeLog("Share count input not found for setupShareQuantityButtons");
      return;
    }

    const updatedShareCountInput = activeShareCountInput;
    const handlerBag = modal._wdpShareHandlers || (modal._wdpShareHandlers = {});
    
    // Hisse adedini güncelleme fonksiyonu
    function updateShareCount(newValue) {
      safeLog("Updating share count to:", newValue);
      
      // Input değerini güncelle
      if (updatedShareCountInput) {
        updatedShareCountInput.value = newValue;
        // Event'leri tetikle
        updatedShareCountInput.dispatchEvent(new Event('input', { bubbles: true }));
        updatedShareCountInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Quantity değerini güncelle
      if (quantityInput) {
        quantityInput.value = newValue;
        safeLog("Quantity updated to:", newValue);
      }
      
      // Formları güncelle
      callHook('updateShareholderFormsInternal', modal);
      updatePriceBasedOnShareCount();
      updateSharesTotalBar(modal);
    }
    
    // Decrease butonu event listener'ı
    if (decreaseBtn) {
      if (handlerBag.decreaseMousedown) {
        decreaseBtn.removeEventListener("mousedown", handlerBag.decreaseMousedown);
      }
      handlerBag.decreaseMousedown = () => {
        const sharesSection = modal.querySelector('.wdp-shares-section');
        if (sharesSection) {
          sharesSection.classList.add('wdp-quantity-active');
          setTimeout(() => {
            sharesSection.classList.remove('wdp-quantity-active');
          }, 200);
        }
      };
      decreaseBtn.addEventListener("mousedown", handlerBag.decreaseMousedown);

      if (handlerBag.decreaseClick) {
        decreaseBtn.removeEventListener("click", handlerBag.decreaseClick);
      }
      handlerBag.decreaseClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Decrease button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue > 1) {
          const newValue = currentValue - 1;
          updateShareCount(newValue);
        }
      };
      decreaseBtn.addEventListener("click", handlerBag.decreaseClick);
    }

    // Increase butonu event listener'ı
    if (increaseBtn) {
      if (handlerBag.increaseMousedown) {
        increaseBtn.removeEventListener("mousedown", handlerBag.increaseMousedown);
      }
      handlerBag.increaseMousedown = () => {
        const sharesSection = modal.querySelector('.wdp-shares-section');
        if (sharesSection) {
          sharesSection.classList.add('wdp-quantity-active');
          setTimeout(() => {
            sharesSection.classList.remove('wdp-quantity-active');
          }, 200);
        }
      };
      increaseBtn.addEventListener("mousedown", handlerBag.increaseMousedown);

      if (handlerBag.increaseClick) {
        increaseBtn.removeEventListener("click", handlerBag.increaseClick);
      }
      handlerBag.increaseClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeLog("Increase button clicked");
        const currentValue = Number.parseInt(updatedShareCountInput.value, 10) || 1;
        if (currentValue < 7) {
          const newValue = currentValue + 1;
          updateShareCount(newValue);
        }
      };
      increaseBtn.addEventListener("click", handlerBag.increaseClick);
    }
    
    // Input değişikliği event listener'ı
    if (updatedShareCountInput) {
      if (handlerBag.shareInput) {
        updatedShareCountInput.removeEventListener("input", handlerBag.shareInput);
      }
      handlerBag.shareInput = function () {
        let currentValue = Number.parseInt(this.value, 10) || 1;
        
        // Sınırları kontrol et
        if (currentValue > 7) {
          currentValue = 7;
          this.value = currentValue;
        } else if (currentValue < 1) {
          currentValue = 1;
          this.value = currentValue;
        }

        // Quantity değerini de güncelle
        if (quantityInput) {
          quantityInput.value = currentValue;
          safeLog("Quantity updated to:", currentValue);
        }

        // Değişiklikleri güvenli bir şekilde uygula
        callHook('updateShareholderFormsInternal', modal);
        updatePriceBasedOnShareCount();
      };
      updatedShareCountInput.addEventListener("input", handlerBag.shareInput);
    }

    // Copy button event listener'larını ekle (aktif modal/root ile sınırlı)
    const allFormsForCopy = modal.querySelectorAll(".wdp-shareholder-form");
    allFormsForCopy.forEach((form) => {
      setupCopyFormButton(form);
    });

    // Hisse adedine göre fiyatı güncelle
    function updatePriceBasedOnShareCount() {
      if (!priceInput) return;

      // Güncel hisse adedini al (fonksiyon scope içindeki $modal helper kullan)
      const currentShareCountInput = $modal('input[name="share_count"]');
      if (!currentShareCountInput) return;
      const shareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;

      // Base price'ı al - önce dataset'ten, sonra baseProductPrice'tan, sonra mevcut fiyattan
      const baseMinValue = Number.parseFloat((priceInput.dataset.baseMin || '').toString().trim());
      let currentBasePrice = baseProductPrice;
      
      // Eğer baseProductPrice 0 veya geçersizse, dataset'ten veya mevcut fiyattan al
      if (!Number.isFinite(currentBasePrice) || currentBasePrice <= 0) {
        if (Number.isFinite(baseMinValue) && baseMinValue > 0) {
          currentBasePrice = baseMinValue;
        } else {
          // Mevcut fiyatı hisse sayısına bölerek base price'ı hesapla
          const currentPriceValue = Number.parseFloat((priceInput.value || '').toString().trim());
          if (Number.isFinite(currentPriceValue) && currentPriceValue > 0 && shareCount > 0) {
            currentBasePrice = currentPriceValue / shareCount;
          } else {
            currentBasePrice = 0;
          }
        }
      }

      const perShareFallback = Number.isFinite(currentBasePrice) && currentBasePrice > 0
        ? currentBasePrice
        : (Number.isFinite(baseMinValue) && baseMinValue > 0 ? baseMinValue : 0);

      const effectiveMin = Number.isFinite(perShareFallback) && perShareFallback > 0
        ? perShareFallback * shareCount
        : 0;

      let totalPrice = Number.parseFloat((currentBasePrice || 0).toString()) * shareCount;

      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        totalPrice = effectiveMin;
      }

      if (effectiveMin > 0 && (!Number.isFinite(totalPrice) || totalPrice < effectiveMin)) {
        totalPrice = effectiveMin;
      }

      safeLog("Fiyat güncelleniyor:", currentBasePrice, "x", shareCount, "=", totalPrice, "(min:", effectiveMin, ", baseProductPrice:", baseProductPrice, ")");

      if (effectiveMin > 0) {
        priceInput.setAttribute('min', effectiveMin.toFixed(2));
        priceInput.dataset.minTotal = effectiveMin.toString();
        if (!priceInput.placeholder || priceInput.placeholder.toLowerCase().startsWith('min')) {
          priceInput.placeholder = `Min: ${formatCurrency(effectiveMin)}`;
        }
      }

      if (Number.isFinite(totalPrice) && totalPrice > 0) {
        const roundedValue = Number.parseFloat(totalPrice.toFixed(2));
        priceInput.value = Number.isInteger(roundedValue)
          ? roundedValue.toFixed(0)
          : roundedValue.toFixed(2);
      }

      // Quantity input'unu da hisse sayısına göre güncelle
      if (quantityInput) {
        quantityInput.value = shareCount;
        safeLog("Final quantity update:", shareCount);
      }
    }

    // Başlangıç değerlerini ayarla (fonksiyon scope içindeki $modal helper kullan)
    const currentShareCountInput = $modal('input[name="share_count"]');
    if (!currentShareCountInput) return;
    const initialShareCount = Number.parseInt(currentShareCountInput.value, 10) || 1;
    if (quantityInput) {
      quantityInput.value = initialShareCount;
      safeLog("Initial quantity set to:", initialShareCount);
    }
    
    // Başlangıç fiyatını ayarla
    updatePriceBasedOnShareCount();

    modal._wdpUpdateSharePrice = updatePriceBasedOnShareCount;

    // Global fonksiyon olarak kaydet - kopyalama fonksiyonu için
    window.updateShareCountForModal = updateShareCount;
  }
  WDPApp.shareholderQuantity = {
    registerHooks: registerHooks,
    syncShareholderUnitPrices: syncShareholderUnitPrices,
    resolveShareUnitPrice: resolveShareUnitPrice,
    updateSharesTotalBar: updateSharesTotalBar,
    syncShareholderUnitPricesFromModal: syncShareholderUnitPricesFromModal,
    setupShareQuantityButtons: setupShareQuantityButtons,
  };
})(window);
