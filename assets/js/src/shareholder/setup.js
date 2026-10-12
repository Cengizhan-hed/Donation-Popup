/**
 * @file setup.js
 * Hisse modülü ilk kurulum, veri yükleme ve hook kaydı.
 * Dış API: WDPApp.shareholderSetup
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const product = WDPApp.product || {};
  const { safeLog } = utils;
  const { productPrices } = state;
  const getProductInfoData = typeof product.getData === 'function' ? product.getData : null;

  const hooks = {};
  function registerHooks(next) {
    if (next && typeof next === 'object') Object.assign(hooks, next);
  }
  function callHook(name) {
    const fn = hooks[name];
    if (typeof fn === 'function') return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }

  function ensureVisible(el, display) { callHook('ensureVisible', el, display); }
  function applyShareholdersAreaVisibility(area) { callHook('applyShareholdersAreaVisibility', area); }
  function ensureReadableInput(el) { callHook('ensureReadableInput', el); }
  function removeShareholderOverview(root) { callHook('removeShareholderOverview', root); }
  function applyShareholdersContainerVisibility(c) { callHook('applyShareholdersContainerVisibility', c); }
  function ensureShareholderList(c) { return callHook('ensureShareholderList', c); }
  function createShareholderForm(i) { return callHook('createShareholderForm', i); }
  function setupCopyFormButton(f) { callHook('setupCopyFormButton', f); }
  function setupShareholderHeaderClick(f) { callHook('setupShareholderHeaderClick', f); }
  function checkShareholderFormWarning(f) { callHook('checkShareholderFormWarning', f); }
  function setupWdpPhoneFields(r) { callHook('setupWdpPhoneFields', r); }
  function syncShareholderUnitPricesFromModal(m) { callHook('syncShareholderUnitPricesFromModal', m); }
  function updateSharesTotalBar(m) { callHook('updateSharesTotalBar', m); }
  function scheduleShareholdersScrollableUpdate(r) { callHook('scheduleShareholdersScrollableUpdate', r); }
  function refreshShareholderGuidance(r) { callHook('refreshShareholderGuidance', r); }
  function cacheShareholdersBaseHeight(c) { callHook('cacheShareholdersBaseHeight', c); }
  function setupShareQuantityButtons(m, input, price, el) {
    callHook('setupShareQuantityButtons', m, input, price, el);
  }

  async function setupShareholderForms(modal, productId) {
    try {
      safeLog("setupShareholderForms called with modal:", modal?.id || modal?.className, "productId:", productId);
      
      // Setup shareholder forms
      
      // Ürün ID'sini integer'a çevir
      productId = Number.parseInt(productId, 10);

      // Hisse adedi input'unu bul - DOM query caching kullan
      const $modal = (sel) => modal.querySelector(sel);
      const shareCountInput = $modal('input[name="share_count"]');
      if (!shareCountInput) {
        safeLog("ERROR: Share count input not found in modal:", modal.id || modal.className);
        return;
      }
      safeLog("Share count input found:", shareCountInput);

      const hostForm =
        typeof modal.matches === 'function' && modal.matches('form')
          ? modal
          : modal.querySelector('form');
      if (hostForm) {
        hostForm.classList.add('wdp-has-shareholders');
      }
      const modalContent = modal.querySelector('.wdp-modal-content');
      if (modalContent) {
        modalContent.classList.add('wdp-has-shareholders');
      }

      // Hissedar formları konteynerini bul - Eğer bulunamazsa bir kez daha dene
      // DOM query caching kullan (üstte tanımlı $modal)
      let shareholdersContainer = $modal(".wdp-shareholders-container");
      if (!shareholdersContainer) {
        // Biraz bekle ve tekrar dene (DOM henüz hazır olmayabilir)
        const constants = WDPApp.constants || {};
        const timing = constants.TIMING || {};
        const domCheckDelay = timing.DOM_CHECK_DELAY || 50;
        await new Promise(resolve => setTimeout(resolve, domCheckDelay));
        shareholdersContainer = $modal(".wdp-shareholders-container");
        if (!shareholdersContainer) {
          safeLog("ERROR: Shareholders container not found in modal/form after retry:", modal.id || modal.className);
          return;
        }
      }
      
      // CRITICAL: Tüm container'ları görünür yap - önce en üst seviyeden başla
      const sharesSection = shareholdersContainer.closest('.wdp-shares-section');
      if (sharesSection) {
        ensureVisible(sharesSection, 'flex');
        sharesSection.style.flexDirection = 'column';
        safeLog("Shares section made visible with flex display");
      }
      
      const sharesHeader = $modal('.wdp-shares-header');
      if (sharesHeader) {
        ensureVisible(sharesHeader, 'grid');
        safeLog("Shares header made visible with grid display");
      }
      
      // CRITICAL: Share counter input'unu görünür yap ve değeri göster
      const shareCounter = $modal('.wdp-share-counter');
      if (shareCounter) {
        ensureVisible(shareCounter, 'flex');
        const shareCountInputInCounter = shareCounter.querySelector('input[name="share_count"]');
        if (shareCountInputInCounter) {
          // CRITICAL: Input değerinin görünür olmasını garanti et
          ensureReadableInput(shareCountInputInCounter);
          safeLog("Share counter input made visible");
        }
      }
      
      // Hissedar alanını da görünür yap
      const shareholdersArea = shareholdersContainer.closest('.wdp-shareholders-area');
      if (shareholdersArea) {
        applyShareholdersAreaVisibility(shareholdersArea);
        safeLog("Shareholders area made visible");
      }
      
      removeShareholderOverview(modal);
      applyShareholdersContainerVisibility(shareholdersContainer);
      safeLog("Shareholders container made visible");
      
      // Hissedar listesini oluştur veya bul
      const shareholdersList = ensureShareholderList(shareholdersContainer);
      if (!shareholdersList) {
        safeLog("ERROR: Could not ensure shareholder list in container");
        return;
      }
      
      // CRITICAL: Shareholders list'i görünür yap
      ensureVisible(shareholdersList, 'flex');
      shareholdersList.style.flexDirection = 'column';
      safeLog("Shareholders list made visible");

      // Başlangıç değerini 1 olarak ayarla ve event'leri tetikle
      shareCountInput.value = "1";
      // CRITICAL: Input görünürlüğünü garanti et
      ensureReadableInput(shareCountInput);
      shareCountInput.dispatchEvent(new Event('input', { bubbles: true }));
      shareCountInput.dispatchEvent(new Event('change', { bubbles: true }));
      safeLog("Initial share count set to 1");

      // Mevcut içeriği temizle
      shareholdersList.innerHTML = "";

      // İlk hissedar formunu hemen oluştur
      const firstForm = createShareholderForm(1);
      if (firstForm) {
        shareholdersList.appendChild(firstForm);
        safeLog("First shareholder form created and appended to DOM");
        
        // Form görünürlüğünü garanti et
        ensureVisible(firstForm);
        firstForm.style.position = 'relative';
        safeLog("First form visibility set");
        
        // Form header'ı görünür yap
        const header = firstForm.querySelector('.wdp-shareholder-header');
        if (header) {
          ensureVisible(header);
          safeLog("First form header made visible");
        }
        
        const content = firstForm.querySelector('.wdp-shareholder-content');
        if (content) {
          ensureVisible(content, 'flex');
          safeLog("First form content made visible with flex display");
          
          // Input'ları da görünür yap
          const inputs = content.querySelectorAll('input, textarea, button');
          inputs.forEach((input, idx) => {
            ensureVisible(input);
            safeLog(`Input ${idx + 1} made visible:`, input.name || input.type);
          });
        } else {
          safeLog("ERROR: First form content not found");
        }
      } else {
        safeLog("ERROR: Failed to create first shareholder form");
        return;
      }
      
      cacheShareholdersBaseHeight(shareholdersContainer);

      // Hemen copy button ve header click event listener'larını ekle
      setupCopyFormButton(firstForm);
      setupShareholderHeaderClick(firstForm);
      
      // İlk form için uyarı kontrolü (kapalı değilse uyarı göstermez)
      checkShareholderFormWarning(firstForm);

      setupWdpPhoneFields(shareholdersList);

      syncShareholderUnitPricesFromModal(modal);
      updateSharesTotalBar(modal);
      
      // Scrollable class'ını güncelle
      scheduleShareholdersScrollableUpdate(modal);
      refreshShareholderGuidance(modal);

      // Fiyat alanını bul
      const priceInput = modal.querySelector('input[name="custom_price"]');

      // Ürün ID'sini al
      const productIdInput = modal.querySelector('input[name="wdp_product_id"], input[name="add-to-cart"]');
      if (!productIdInput) {
        safeLog("Product ID input not found in modal:", modal.id);
        return;
      }

      // Ürün fiyatını saklamak için değişken
      let baseProductPrice = 0;

      // Sayaç butonlarını hemen aktif hale getir (fiyat daha sonra güncellenecek)
      setupShareQuantityButtons(modal, shareCountInput, baseProductPrice, priceInput);

      // Doğrudan form için ürün bilgilerini kontrol et
      const productDataInput = modal.querySelector('input[name="product_data"]');
      if (productDataInput) {
        try {
          const productData = JSON.parse(productDataInput.value);
          if (productData) {
            // Ürün fiyatını al ve sakla
            baseProductPrice = Number.parseFloat(productData.price) || 0;
            safeLog("Product price from data attribute:", baseProductPrice);

            if (priceInput && baseProductPrice > 0) {
              if (!priceInput.dataset.baseMin || Number.parseFloat(priceInput.dataset.baseMin) <= 0) {
                priceInput.dataset.baseMin = baseProductPrice.toString();
              }

              if (!priceInput.value) {
                priceInput.value = baseProductPrice.toFixed(0);
              }
            }

            setupShareQuantityButtons(modal, modal.querySelector('input[name="share_count"]'), baseProductPrice, priceInput);
            syncShareholderUnitPricesFromModal(modal);
            updateSharesTotalBar(modal);
            setupWdpPhoneFields(modal);
            refreshShareholderGuidance(modal);
            return;
          }
        } catch (e) {
          safeLog("Error parsing product data:", e);
        }
      }

      const directProductId = Number.parseInt(productIdInput.value, 10);
      if (!Number.isFinite(directProductId)) {
        safeLog("Invalid product ID for direct form:", productIdInput.value);
        return;
      }

      if (getProductInfoData) {
        getProductInfoData(directProductId)
          .then((data) => {
            if (!data || !data.success) {
              safeLog("Ürün fiyatı alınamadı (cached/fetch):", data);
              return;
            }

            baseProductPrice = Number.parseFloat(data.price) || 0;
            if (productPrices) {
              productPrices[directProductId] = baseProductPrice;
            }
            safeLog("Product price from data cache/fetch:", baseProductPrice);

            if (priceInput && baseProductPrice > 0) {
              if (!priceInput.dataset.baseMin || Number.parseFloat(priceInput.dataset.baseMin) <= 0) {
                priceInput.dataset.baseMin = baseProductPrice.toString();
              }

              if (!priceInput.value) {
                priceInput.value = baseProductPrice.toFixed(0);
              }
            }

            setupShareQuantityButtons(modal, modal.querySelector('input[name="share_count"]'), baseProductPrice, priceInput);
            syncShareholderUnitPricesFromModal(modal);
            updateSharesTotalBar(modal);
            setupWdpPhoneFields(modal);
            refreshShareholderGuidance(modal);
          })
          .catch((error) => {
            safeLog("Error fetching product price:", error);
          });
      }

      setupWdpPhoneFields(modal);
      refreshShareholderGuidance(modal);

    } catch (error) {
      safeLog("Error in setupShareholderForms:", error);
    }
  }
  /** Sayfa içi / popup hissedar alanını sıfırdan hazırlar. */
  WDPApp.shareholderSetup = {
    registerHooks: registerHooks,
    setupShareholderForms: setupShareholderForms,
  };
})(window);
