/**
 * ============================================================================
 * FORM.JS - FORM İŞLEMLERİ MODÜLÜ
 * ============================================================================
 * 
 * DOSYA: form.js
 * KONUM: /assets/js/src/form.js
 * 
 * AMAÇ:
 * Bağış formlarının tüm işlemlerini yönetir.
 * Form validation, submission, error handling.
 * 
 * ANA İŞLEVLER:
 * 1. setupFormSubmission - Form submit event'lerini bağlama
 * 2. validateForm - Form validasyonu
 * 3. submitFormData - AJAX ile form gönderme
 * 4. handleAjaxResponse - AJAX response işleme
 * 5. handleAjaxError - AJAX hata işleme
 * 6. directFormSubmit - Doğrudan form gönderme (non-AJAX)
 * 7. showInputError - Input hata mesajı gösterme
 * 8. showFormError - Form hata mesajı gösterme
 * 
 * VALIDATION:
 * - Hissedar formları kontrolü (ad, telefon)
 * - Minimum fiyat kontrolü
 * - Maksimum hisse kontrolü
 * - Zorunlu alan kontrolü
 * - Sayısal değer kontrolü
 * 
 * PERFORMANS:
 * - Debounce ile input validation (300ms)
 * - Optimize edilmiş event handlers
 * - Cache'lenmiş form referansları
 * 
 * GÜVENLİK:
 * - Nonce doğrulaması
 * - Input sanitization
 * - XSS önleme
 * 
 * ACCESSIBILITY:
 * - ARIA live regions
 * - Error mesajları screen reader için
 * - Focus management
 * 
 * DEPENDENCIES:
 * - utils.js (formatCurrency, getAjaxNonce, announceStatus, debounce)
 * - state.js (form state management)
 * - alerts.js (error/success mesajları)
 * - cart.js (sepet güncelleme)
 * 
 * EXPORT:
 * WDPApp.form = { setup, submit, validate, showInputError, ... }
 * 
 * ============================================================================
 * 
 * Form - Form işlemleri
 * setupFormSubmission, validateForm, submitFormData, handleAjaxResponse,
 * handleAjaxError, directFormSubmit, showInputError, showFormError
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'getAjaxNonce', 'announceStatus', 'safeLog', 'escapeHtml', 'mergeWdpAjaxNonces', 'refreshWdpAjaxNonces'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const alertsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('alerts', ['clear', 'show'])
    : { module: WDPApp.alerts || {}, isValid: false, missingMethods: [] };
  
  const cartCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('cart', ['fetchContents', 'updateCountElements', 'createItemsHTML', 'setupContinueShoppingButton', 'updateWooCommerce', 'saveSideCartElements', 'showSideCarts'])
    : { module: WDPApp.cart || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const alerts = alertsCheck.module;
  const cart = cartCheck.module;
  const { formatCurrency, getAjaxNonce, announceStatus, safeLog, escapeHtml, debounce, throttle, mergeWdpAjaxNonces, refreshWdpAjaxNonces } = utils;
  const { clear: clearAlerts, show: showAlert } = alerts;
  const { fetchContents: fetchCartContents, updateCountElements: updateCartCountElements, createItemsHTML: createCartItemsHTML, setupContinueShoppingButton, setupRemoveCartItemButtons, updateWooCommerce: updateWooCommerceCart, saveSideCartElements, showSideCarts } = cart;
  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;
  
  // Debounced validation function for input events
  const debouncedValidateInput = debounce ? debounce((input) => {
    if (input.classList.contains('wdp-error')) {
      input.classList.remove('wdp-error');
      const errorDiv = input.parentNode.querySelector('.wdp-input-error');
      if (errorDiv) errorDiv.remove();
    }
  }, 300) : null;

  function isFormProcessing(form) {
    return form && form.dataset && form.dataset.wdpProcessing === "1";
  }

  function setFormProcessing(form, processing) {
    if (!form || !form.dataset) {
      return;
    }
    form.dataset.wdpProcessing = processing ? "1" : "0";
  }

  function showInputError(input, message) {
    input.classList.add('wdp-error');
    // Remove previous error
    let errorDiv = input.parentNode.querySelector('.wdp-input-error');
    if (errorDiv) errorDiv.remove();
    // Add new error
    errorDiv = document.createElement('div');
    errorDiv.className = 'wdp-input-error';
    errorDiv.setAttribute('role', 'alert');
    const errorId = input.name + '-error';
    errorDiv.id = errorId;
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
    // Remove error on focus/input - optimized with debounce
    function clearError() {
      input.classList.remove('wdp-error');
      if (errorDiv) errorDiv.remove();
      input.removeEventListener('focus', clearError);
      input.removeEventListener('input', clearErrorInput);
    }
    
    // Debounced input handler for better performance
    const clearErrorInput = debouncedValidateInput ? debouncedValidateInput.bind(null, input) : function() {
      input.classList.remove('wdp-error');
      if (errorDiv) errorDiv.remove();
    };
    
    input.addEventListener('focus', clearError);
    input.addEventListener('input', clearErrorInput);

    announceStatus(message, 'assertive');
  }

  function showFormError(form, message) {
    let formError = form.querySelector('.wdp-form-error');
    if (!formError) {
      formError = document.createElement('div');
      formError.className = 'wdp-form-error';
      form.insertBefore(formError, form.firstChild);
    }
    formError.setAttribute('role', 'alert');
    formError.textContent = message;
    // Remove on any input focus
    form.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('focus', function clearFormError() {
        if (formError) formError.remove();
        input.removeEventListener('focus', clearFormError);
      });
    });

    announceStatus(message, 'assertive');
  }

  function validateForm(form) {
    safeLog("validateForm called");
    let isValid = true;
    let errorMessages = [];

    // Önce tüm eski hata mesajlarını temizle
    form.querySelectorAll('.wdp-error').forEach(input => {
      input.classList.remove('wdp-error');
    });
    form.querySelectorAll('.wdp-form-error').forEach(error => error.remove());
    
    // Popup hata mesajlarını temizle
    clearAlerts();

    // Hisse adedi kontrolü
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
      safeLog("Checking shareholder forms for count:", shareCount);
      
      for (let i = 1; i <= shareCount; i++) {
        const nameField = form.querySelector(`input[name="shareholder_name_${i}"]`);
        const phoneField = form.querySelector(`input[name="shareholder_phone_${i}"]`);
        const shareholderForm = nameField?.closest('.wdp-shareholder-form') || phoneField?.closest('.wdp-shareholder-form');
        
        safeLog(`Checking form ${i}:`, {
          nameField: !!nameField,
          nameValue: nameField?.value,
          phoneField: !!phoneField,
          phoneValue: phoneField?.value
        });
        
        // Eğer form kapalıysa aç (kullanıcı görebilsin)
        if (shareholderForm && shareholderForm.classList.contains('collapsed')) {
          shareholderForm.classList.remove('collapsed');
          const content = shareholderForm.querySelector('.wdp-shareholder-content');
          if (content) {
            content.style.display = 'flex';
          }
          // Scroll yap
          requestAnimationFrame(() => {
            shareholderForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
        
        // Ad alanı kontrolü
        if (nameField && !nameField.value.trim()) {
          safeLog(`Name field ${i} is empty`);
          showInputError(nameField, `${i}. Hissedar Adı zorunludur`);
          errorMessages.push(`${i}. Hissedar Adı`);
          isValid = false;
        }
        
        // Telefon alanı kontrolü
        if (phoneField && !phoneField.value.trim()) {
          safeLog(`Phone field ${i} is empty`);
          showInputError(phoneField, `${i}. Hissedar Telefonu zorunludur`);
          errorMessages.push(`${i}. Hissedar Telefonu`);
          isValid = false;
        }
      }
    }

    // Diğer zorunlu alanlar (fiyat, vb.)
    form.querySelectorAll('input[required], textarea[required]').forEach(field => {
      // Hissedar formları dışındaki alanları kontrol et
      if (!field.name.includes('shareholder_')) {
        if (!field.value.trim()) {
          showInputError(field, 'Bu alan zorunludur');
          errorMessages.push(field.placeholder || 'Zorunlu alan');
          isValid = false;
        }
      }
    });

    // Minimum bağış tutarı ve sayısal doğrulama
    const customPriceInput = form.querySelector('input[name="custom_price"]');
    if (customPriceInput) {
      const rawValue = customPriceInput.value ? customPriceInput.value.toString().trim() : '';
      const normalizedValue = rawValue.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
      const numericValue = rawValue === '' ? NaN : Number.parseFloat(normalizedValue);
      const minAttr = customPriceInput.getAttribute('min');
      const normalizedMin = (minAttr || '0').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
      const minValueFromAttr = Number.parseFloat(normalizedMin);
      const baseMinData = customPriceInput.dataset.baseMin;
      const shareCountValue = shareCountInput ? Number.parseInt(shareCountInput.value, 10) || 1 : 1;
      const perShareMin = Number.parseFloat((baseMinData || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
      const effectiveMinCandidates = [];

      if (Number.isFinite(minValueFromAttr) && minValueFromAttr > 0) {
        effectiveMinCandidates.push(minValueFromAttr);
      }

      if (Number.isFinite(perShareMin) && perShareMin > 0) {
        effectiveMinCandidates.push(perShareMin * shareCountValue);
      }

      const effectiveMin = effectiveMinCandidates.length > 0 ? Math.max.apply(null, effectiveMinCandidates) : 0;

      const focusInput = () => {
          if (isValid) {
            try {
              customPriceInput.focus({ preventScroll: false });
            } catch (e) {
              customPriceInput.focus();
            }
          }
      };

      if (rawValue === '') {
        const emptyMessage = 'Lütfen bağış tutarını giriniz.';
        showInputError(customPriceInput, emptyMessage);
        if (!errorMessages.includes(emptyMessage)) {
          errorMessages.push(emptyMessage);
        }
        focusInput();
          isValid = false;
      } else if (!Number.isFinite(numericValue) || numericValue <= 0) {
        const invalidMessage = 'Lütfen geçerli bir bağış tutarı giriniz.';
        showInputError(customPriceInput, invalidMessage);
        if (!errorMessages.includes(invalidMessage)) {
          errorMessages.push(invalidMessage);
        }
        focusInput();
        isValid = false;
      } else if (effectiveMin > 0 && numericValue + 0.0001 < effectiveMin) {
        const minMessage = `Lütfen ${formatCurrency(effectiveMin)} ve üstü değerler girin.`;
          showInputError(customPriceInput, minMessage);
          if (!errorMessages.includes(minMessage)) {
            errorMessages.push(minMessage);
          }
        focusInput();
          isValid = false;
      }
    }

    errorMessages = Array.from(new Set(errorMessages));
    safeLog("Form validation result:", { isValid, errorMessages });

    // Form geçersizse popup göster
    if (!isValid) {
      safeLog("Form is invalid, showing popup error");
      showAlert(errorMessages, {
        type: 'error',
        title: 'Lütfen aşağıdaki alanları kontrol edin'
      });
    }
    
    return isValid;
  }

  function handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn) {
    safeLog("Handling AJAX response:", data);

    // Başarı durumunda
    if (data.success) {
      clearAlerts();
      // Sepet sayısını güncelle
      if (data.cart_count) {
        updateCartCountElements(data.cart_count);
      }

      // Hata mesajını gizle (başarılı işlemde hata mesajı gösterme)
      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      }

      // Başarı mesajını göster
      if (isCheckout) {
        // Ödeme sayfasına yönlendir
        safeLog("Redirecting to checkout:", data.checkout_url);
        announceStatus('Ödeme adımına yönlendiriliyorsunuz.', 'assertive');
        window.location.href = data.checkout_url || wdp_ajax.checkout_url || "/odeme-sayfasi/";
      } else {
        // Sepete Ekle için başarı mesajını göster
        safeLog("Showing success message", data);
        announceStatus('Bağışınız sepete eklendi.', 'polite');

        // Form içeriğini sakla (tamamen silmek yerine)
        const formContent = form.innerHTML;
        form.setAttribute("data-original-content", formContent);

        // Form içeriğini temizle
        form.innerHTML = "";

        // Modal header'ı gizle (popup için)
        const modal = form.closest('.wdp-modal');
        if (modal) {
          const modalHeader = modal.querySelector('.wdp-modal-header');
          if (modalHeader) {
            modalHeader.classList.add('wdp-hidden-on-success');
          }
        }

        // Sayfa içi form için progress bar ve başlıkları gizle
        const inPageForm = form.closest('.wdp-donation-form');
        if (inPageForm) {
          const progressBar = inPageForm.querySelector('.wdp-progress-bar-container');
          if (progressBar) {
            progressBar.classList.add('wdp-hidden-on-success');
          }
          const formTitle = inPageForm.querySelector('.wdp-form-title-wrapper');
          if (formTitle) {
            formTitle.classList.add('wdp-hidden-on-success');
          }
        }

        // Başarı ekranı oluştur
        const successScreen = document.createElement("div");
        successScreen.className = "wdp-success-screen";
        form.appendChild(successScreen);

        // Başarı mesajı
        let successContent = `
<div class="wdp-success-message">Bağışınız sepete eklendi!</div>
`;

        // Sepet içeriğini al ve göster
        if (data.items && Array.isArray(data.items)) {
          successContent += createCartItemsHTML(data.items);
        } else {
          // Geçici içerik göster
          successContent += `
<div class="wdp-mini-cart">
  <div class="wdp-mini-cart-header">
    <h4>Sepetiniz</h4>
  </div>
  <div class="wdp-mini-cart-items">
    <div style="padding: 15px; text-align: center;">Sepet içeriği yükleniyor...</div>
  </div>
</div>
<div class="wdp-success-buttons">
  <a href="${wdp_ajax.cart_url || "/sepet/"}" class="wdp-success-button wdp-view-cart">${(wdp_ajax && wdp_ajax.button_texts && wdp_ajax.button_texts.success_view_cart) ? escapeHtml(wdp_ajax.button_texts.success_view_cart) : "Sepeti Görüntüle"}</a>
  <a href="${wdp_ajax.checkout_url || "/odeme-sayfasi/"}" class="wdp-success-button wdp-checkout">${(wdp_ajax && wdp_ajax.button_texts && wdp_ajax.button_texts.success_go_checkout) ? escapeHtml(wdp_ajax.button_texts.success_go_checkout) : "Ödemeye Git"}</a>
  <a href="#" class="wdp-success-button wdp-continue-shopping wdp-new-donation">${(wdp_ajax && wdp_ajax.button_texts && wdp_ajax.button_texts.success_new_donation) ? escapeHtml(wdp_ajax.button_texts.success_new_donation) : "Yeni Bağış Ekle"}</a>
</div>
`;

          // Sepet içeriğini AJAX ile al
          fetchCartContents()
            .then((cartItems) => {
              successScreen.innerHTML = `
<div class="wdp-success-message">Bağışınız sepete eklendi!</div>
${createCartItemsHTML(cartItems)}
`;
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successScreen);
            })
            .catch((error) => {
              safeLog("Error fetching cart contents:", error);
              successScreen.innerHTML = `
<div class="wdp-success-message">Bağışınız sepete eklendi!</div>
${createCartItemsHTML([])}
`;
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successScreen);
            });
        }

        // Eğer data.items varsa, HTML'i hemen ayarla
        if (data.items && Array.isArray(data.items)) {
          successScreen.innerHTML = successContent;
          setupContinueShoppingButton(form);
          setupRemoveCartItemButtons(successScreen);
        }
      }

      // Progress bar'ı güncelle (eğer varsa)
      if (data.total_donation !== undefined && data.product_id) {
        const progressBarModule = WDPApp.progressBar;
        if (progressBarModule && typeof progressBarModule.updateReal === 'function') {
          const container = form.closest('.wdp-modal, .wdp-donation-form');
          if (container) {
            const progressContainer = container.querySelector('.wdp-progress-bar-container');
            if (progressContainer) {
              const limit = parseFloat(progressContainer.getAttribute('data-limit')) || 100000;
              progressBarModule.updateReal(progressContainer, data.total_donation, limit);
            }
          }
        }
      }

      // WooCommerce sepet fragmentlerini güncelle
      updateWooCommerceCart();
    } else {
      const fallbackMessage = data.message || "Bir hata oluştu. Lütfen tekrar deneyin.";

      showAlert([fallbackMessage], {
        type: 'error',
        title: 'İşlem tamamlanamadı'
      });

      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        errorMsg.textContent = fallbackMessage;
        errorMsg.style.display = "block";
        errorMsg.setAttribute('data-wdp-protected', 'true');
      }

      if (addToCartBtn) {
        addToCartBtn.disabled = false;
        addToCartBtn.classList.remove("wdp-loading");
      }
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove("wdp-loading");
      }

      announceStatus(fallbackMessage, 'assertive');
    }
  }

  function handleAjaxError(error, form, addToCartBtn, checkoutBtn) {
    safeLog("AJAX error:", error);

    clearAlerts();
    showAlert(['Bağlantı hatası oluştu. Lütfen tekrar deneyin.'], {
      type: 'warning',
      title: 'Bağlantı sorunu'
    });

    const errorMsg = form.querySelector(".wdp-form-error");
    if (errorMsg) {
      errorMsg.textContent = "Bağlantı hatası oluştu. Lütfen tekrar deneyin.";
      errorMsg.style.display = "block";
      errorMsg.setAttribute('data-wdp-protected', 'true');
    }

    announceStatus('Bağlantı hatası oluştu. Lütfen tekrar deneyin.', 'assertive');

    // Butonları tekrar aktif et
    if (addToCartBtn) {
      addToCartBtn.disabled = false;
      addToCartBtn.classList.remove("wdp-loading");
    }
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove("wdp-loading");
    }

    // Yalnızca ilgili formun kilidini kaldır
    setFormProcessing(form, false);
  }

  /**
   * PHP uyarısı / BOM / HTML öncesi JSON gibi bozuk gövdelerde gerçek WDP yanıtını ayıklar.
   */
  function parseWdpAjaxResponseText(raw) {
    if (!raw || typeof raw !== "string") {
      return null;
    }
    const trimmed = raw.replace(/^\uFEFF/, "").trim();
    let candidate = trimmed;
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      candidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.success === "boolean") {
        return parsed;
      }
    } catch (parseErr) {
      safeLog("Loose JSON parse failed:", parseErr);
    }
    return null;
  }

  function shouldAttemptCartRecoveryFromJqXHR(jqXHR, textStatus) {
    if (textStatus === "parsererror") {
      return true;
    }
    const status = jqXHR && typeof jqXHR.status === "number" ? jqXHR.status : 0;
    if (status === 0) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    return false;
  }

  function shouldAttemptCartRecoveryFromFetchError(error) {
    if (error && error.wdpRecoverCart) {
      return true;
    }
    const status = error && typeof error.status === "number" ? error.status : null;
    if (status === null || Number.isNaN(status)) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    if (status === 0) {
      return true;
    }
    return false;
  }

  /**
   * Sunucu isteği tamamlayıp yanıt düşmeden bağlantı koptuysa (veya nonce eskiyse) sepeti doğrular;
   * ürün zaten eklenmişse başarı akışına geçer — gereksiz "bağlantı hatası" engellenir.
   */
  function tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, onFailure) {
    if (typeof jQuery === "undefined") {
      onFailure();
      return;
    }
    const uniqueInput = form.querySelector('input[name="unique_submission_key"]');
    const uniqueKey = uniqueInput && uniqueInput.value;
    if (!uniqueKey) {
      onFailure();
      return;
    }

    const runVerify = () => {
      jQuery.ajax({
        url: wdp_ajax.ajax_url,
        type: "POST",
        data: {
          action: "wdp_verify_submission_in_cart",
          security: getAjaxNonce("ajax_add_to_cart"),
          unique_submission_key: uniqueKey,
        },
        dataType: "json",
        success: (verifyData) => {
          if (verifyData && verifyData.success && verifyData.in_cart) {
            handleAjaxResponse(
              {
                success: true,
                message: verifyData.message,
                cart_count: verifyData.cart_count,
                items: verifyData.items,
                checkout_url: verifyData.checkout_url,
              },
              form,
              isCheckout,
              addToCartBtn,
              checkoutBtn
            );
          } else {
            onFailure();
          }
        },
        error: () => {
          onFailure();
        },
      });
    };

    if (refreshWdpAjaxNonces && typeof refreshWdpAjaxNonces === "function") {
      refreshWdpAjaxNonces({ force: true })
        .then(() => runVerify())
        .catch(() => runVerify());
    } else {
      runVerify();
    }
  }

  function submitFormData(form, isCheckout) {
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $form = (sel) => form.querySelector(sel);
    
    safeLog("Submitting form data...", isCheckout ? "Ödemeye Git" : "Sepete Ekle");
    clearAlerts();
    
    // CRITICAL: Hissedar formlarında quantity'yi shareCount'a göre güncelle (FormData oluşturulmadan önce)
    const shareCountInput = $form('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
      const quantityInput = $form('input[name="quantity"]');
      if (quantityInput && shareCount > 0) {
        // Quantity değerini hisse adedi ile güncelle - hissedar sayısına göre otomatik ayarla
        quantityInput.value = shareCount;
        safeLog("Quantity güncellendi - ShareCount:", shareCount, "-> Quantity:", quantityInput.value);
      }
    }
    
    const formData = new FormData(form);
    
    // CRITICAL: Hissedar formlarında fiyatı hisse sayısına göre güncelle
    if (shareCountInput) {
      const shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
      const priceInput = $form('input[name="custom_price"]');
      
      if (priceInput) {
        // Base price'ı al (dataset'ten veya mevcut fiyattan)
        const baseMinValue = Number.parseFloat((priceInput.dataset.baseMin || '').toString().trim());
        const currentPriceValue = Number.parseFloat((priceInput.value || '').toString().trim());
        
        let basePrice = baseMinValue;
        
        // Eğer baseMin yoksa, mevcut fiyatı hisse sayısına böl
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          if (Number.isFinite(currentPriceValue) && currentPriceValue > 0 && shareCount > 0) {
            basePrice = currentPriceValue / shareCount;
          }
        }
        
        // CRITICAL: Hissedar formlarında base price'ı gönder (quantity ile çarpılacak)
        // Form'da gösterilen fiyat toplam fiyat olabilir ama sepete base price gönderilmeli
        // Dinamik: Kaç hissedar bilgisi doldurulduysa (shareCount), o kadar adet ürün sepete eklenecek
        // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
        if (Number.isFinite(basePrice) && basePrice > 0) {
          // Form'da gösterilen toplam fiyatı güncelle (kullanıcı görsün)
          // Dinamik hesaplama: basePrice × shareCount (hissedar sayısı)
          const totalPrice = basePrice * shareCount;
          const roundedTotalPrice = Number.isInteger(totalPrice) ? totalPrice.toFixed(0) : totalPrice.toFixed(2);
          priceInput.value = roundedTotalPrice;
          
          // Ama sepete BASE PRICE gönder (quantity ile çarpılacak)
          // PHP tarafında: subtotal = custom_price × quantity (quantity = shareCount)
          const roundedBasePrice = Number.isInteger(basePrice) ? basePrice.toFixed(0) : basePrice.toFixed(2);
          formData.set('custom_price', roundedBasePrice);
          safeLog("Fiyat hesaplandı - Base:", basePrice, "x Quantity (ShareCount):", shareCount, "= Total:", totalPrice, "-> Sepete base price gönderiliyor:", roundedBasePrice);
        } else if (shareCount > 1) {
          // Base price bulunamadıysa ve hisse sayısı > 1 ise uyarı ver
          safeLog("WARNING: Base price not found for share count:", shareCount);
        }
      }
      
      // CRITICAL: Quantity'yi shareCount olarak ayarla (sepette doğru miktar gösterilsin)
      // Dinamik: Kaç hissedar bilgisi doldurulduysa, o kadar adet ürün sepete eklenecek
      // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
      formData.set('quantity', shareCount);
      safeLog("FormData'ya quantity eklendi (ShareCount):", shareCount, "- Bu, sepette", shareCount, "adet ürün anlamına gelir");
      
      // Hissedar bilgilerini ekle
      for (let i = 1; i <= shareCount; i++) {
        const name = $form(`[name='shareholder_name_${i}']`);
        const phone = $form(`[name='shareholder_phone_${i}']`);
        const note = $form(`[name='shareholder_note_${i}']`);
        if (name) formData.set(`shareholder_name_${i}`, name.value);
        if (phone) formData.set(`shareholder_phone_${i}`, phone.value);
        if (note) formData.set(`shareholder_note_${i}`, note.value);
      }
    }

    // "Ödemeye Git" butonu için bayrak ekle
    if (isCheckout) {
      formData.append("donation_go_checkout", "1");
    }

    // AJAX ile sepete ekleme işlemi
    formData.append("action", "wdp_ajax_add_to_cart");
    formData.append("security", getAjaxNonce("ajax_add_to_cart"));
    formData.append("timestamp", Date.now());

    // Butonları bul
    const addToCartBtn = $form('button[name="donation_add_to_cart"]');
    const checkoutBtn = $form('button[name="donation_go_checkout"]');

    // Form verilerini URL kodlamasına dönüştür
    const formDataUrlEncoded = new URLSearchParams();
    const debugPayload = wdp_ajax && (wdp_ajax.debug === true || wdp_ajax.debug === 1 || wdp_ajax.debug === "1");
    const sensitiveField = (name) => {
      const n = String(name).toLowerCase();
      if (n.indexOf("shareholder_") === 0) {
        return true;
      }
      return n === "donation_full_name" || n === "donation_phone" || n === "donation_note";
    };
    for (const pair of formData.entries()) {
      if (debugPayload) {
        safeLog(
          "Form data: " + pair[0] + ": " + (sensitiveField(pair[0]) ? "[gizlendi]" : pair[1])
        );
      }
      formDataUrlEncoded.append(pair[0], pair[1]);
    }

    // Mevcut side cart elementlerini kaydet
    saveSideCartElements();

    safeLog("AJAX isteği gönderiliyor:", wdp_ajax.ajax_url);

    // Hata mesajı alanını bul ve gizle - Başlangıçta hata mesajını gizle (fonksiyon scope içindeki $form helper kullan)
    const errorMsg = $form(".wdp-form-error");
    if (errorMsg) {
      errorMsg.style.display = "none";
      errorMsg.textContent = "";
    }

    // Alternatif olarak jQuery AJAX kullan (daha güvenilir olabilir)
    if (typeof jQuery !== "undefined") {
      safeLog("Using jQuery AJAX");
      jQuery.ajax({
        url: wdp_ajax.ajax_url,
        type: "POST",
        data: formDataUrlEncoded.toString(),
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        beforeSend: () => {
          safeLog("jQuery AJAX request starting...");
        },
        success: (data) => {
          safeLog("jQuery AJAX success:", data);
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        },
        error: (jqXHR, textStatus, errorThrown) => {
          safeLog("jQuery AJAX error:", { textStatus, errorThrown, status: jqXHR.status });

          const rescued = parseWdpAjaxResponseText(jqXHR.responseText);
          if (rescued) {
            handleAjaxResponse(rescued, form, isCheckout, addToCartBtn, checkoutBtn);
            return;
          }

          const finishWithTransportError = () => {
            safeLog("AJAX taşıma / yanıt hatası — kurtarma sonrası veya kurtarma atlandı", jqXHR.status, textStatus);
            // Gerçek hata: sunucu mesajı (success:false) zaten success callback'te gösterilir.
            // Burada yanıt okunamadı veya ağ kopması var — kullanıcıya mutlaka bildir (sessiz kalma).
            handleAjaxError(errorThrown || new Error(textStatus || "error"), form, addToCartBtn, checkoutBtn);
          };

          if (shouldAttemptCartRecoveryFromJqXHR(jqXHR, textStatus)) {
            tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, finishWithTransportError);
          } else {
            finishWithTransportError();
          }
        },
        complete: () => {
          safeLog("jQuery AJAX request completed");
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          setFormProcessing(form, false);

          // Butonları tekrar aktif et (her ihtimale karşı)
          setTimeout(() => {
            if (addToCartBtn) {
              addToCartBtn.disabled = false;
              addToCartBtn.classList.remove("wdp-loading");
            }
            if (checkoutBtn) {
              checkoutBtn.disabled = false;
              checkoutBtn.classList.remove("wdp-loading");
            }
          }, 2000);

          // Side cart elementlerini geri yükle
          setTimeout(() => {
            showSideCarts();
          }, 500);
        },
      });
    } else {
      // Fetch API ile AJAX isteği gönder
      safeLog("Using Fetch API");
      fetch(wdp_ajax.ajax_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: formDataUrlEncoded.toString(),
        credentials: "same-origin",
        cache: "no-cache",
      })
        .then((response) => {
          safeLog("Fetch response received:", { status: response.status, ok: response.ok });
          if (!response.ok && response.status !== 200) {
            const httpErr = new Error(`HTTP error! Status: ${response.status}`);
            httpErr.status = response.status;
            throw httpErr;
          }
          return response.text().then((text) => {
            safeLog("Response text:", text.substring(0, 200)); // İlk 200 karakter
            const loose = parseWdpAjaxResponseText(text);
            if (loose) {
              return loose;
            }
            try {
              return JSON.parse(text);
            } catch (e) {
              safeLog("JSON parse error:", e);
              const parseErr = new Error("INVALID_JSON_RESPONSE");
              parseErr.status = response.status;
              parseErr.wdpRecoverCart = true;
              throw parseErr;
            }
          });
        })
        .then((data) => {
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        })
        .catch((error) => {
          safeLog("Fetch error:", error);
          const afterRecoverOrShowError = () => {
            handleAjaxError(error, form, addToCartBtn, checkoutBtn);
          };

          if (shouldAttemptCartRecoveryFromFetchError(error) && typeof jQuery !== "undefined") {
            tryRecoverCartAfterAjaxFailure(form, isCheckout, addToCartBtn, checkoutBtn, afterRecoverOrShowError);
          } else {
            afterRecoverOrShowError();
          }
        })
        .finally(() => {
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          setFormProcessing(form, false);

          // Butonları tekrar aktif et (her ihtimale karşı)
          setTimeout(() => {
            if (addToCartBtn) {
              addToCartBtn.disabled = false;
              addToCartBtn.classList.remove("wdp-loading");
            }
            if (checkoutBtn) {
              checkoutBtn.disabled = false;
              checkoutBtn.classList.remove("wdp-loading");
            }
          }, 2000);

          // Side cart elementlerini geri yükle
          setTimeout(() => {
            showSideCarts();
          }, 500);
        });
    }
  }

  function directFormSubmit(form, isCheckout) {
    safeLog("Direct form submit:", isCheckout ? "Checkout" : "Add to Cart");

    // Form doğrulama
    if (!validateForm(form)) {
      safeLog("Form validation failed");
      return false;
    }

    // Hisse adedi varsa, quantity değerini kontrol et ve güncelle
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
      const quantityInput = form.querySelector('input[name="quantity"]');

      if (quantityInput && shareCount > 0) {
        // Quantity değerini hisse adedi ile güncelle - hissedar sayısına göre otomatik ayarla
        quantityInput.value = shareCount;
      }
    }

    // "Ödemeye Git" butonu için bayrak ekle
    if (isCheckout) {
      const checkoutInput = document.createElement("input");
      checkoutInput.type = "hidden";
      checkoutInput.name = "donation_go_checkout";
      checkoutInput.value = "1";
      form.appendChild(checkoutInput);
    }

    // Form action ve method ayarla
    form.action = wdp_ajax.ajax_url;
    form.method = "post";

    // AJAX ile sepete ekleme işlemi için gerekli alanları ekle
    const actionInput = document.createElement("input");
    actionInput.type = "hidden";
    actionInput.name = "action";
    actionInput.value = "wdp_ajax_add_to_cart";
    form.appendChild(actionInput);

    const securityInput = document.createElement("input");
    securityInput.type = "hidden";
    securityInput.name = "security";
    securityInput.value = getAjaxNonce("ajax_add_to_cart");
    form.appendChild(securityInput);

    const timestampInput = document.createElement("input");
    timestampInput.type = "hidden";
    timestampInput.name = "timestamp";
    timestampInput.value = Date.now();
    form.appendChild(timestampInput);

    // Formu gönder
    safeLog("Submitting form directly");
    form.submit();

    return true;
  }

  function setupFormSubmission(form) {
    safeLog("Form submission setup for:", form);

    // Önceki dinleyiciyi kaldır (event-manager veya tekrar setup çağrıları çift AJAX üretmesin)
    if (form._wdpSubmitHandler) {
      form.removeEventListener("submit", form._wdpSubmitHandler);
      form._wdpSubmitHandler = null;
    }

    function onWdpFormSubmit(e) {
      e.preventDefault();
      safeLog("Form submitted");

      // Önce tüm hata mesajlarını gizle
      if (typeof window.WDP !== "undefined" && typeof window.WDP.hideErrorMessages === "function") {
        window.WDP.hideErrorMessages();
      }

      // Hata mesajı alanını hemen temizle
      const errorDiv = form.querySelector(".wdp-form-error");
      if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.innerHTML = "";
      }

      // WooCommerce hata mesajlarını da gizle
      const wooMessages = document.querySelectorAll(".woocommerce-error, .woocommerce-message, .woocommerce-info");
      wooMessages.forEach((msg) => {
        msg.style.display = "none";
      });

      // Hangi butonun tıklandığını belirle
      const isCheckout = e.submitter && e.submitter.name === "donation_go_checkout";
      safeLog("Is checkout:", isCheckout);

      // Form doğrulama
      if (!validateForm(form)) {
        safeLog("Form validation failed");
        return false;
      }

      // Eğer işlem zaten devam ediyorsa, yeni bir istek gönderme
      if (isFormProcessing(form)) {
        safeLog("Processing already in progress");
        return false;
      }

      // İşlem başladığını işaretle
      setFormProcessing(form, true);

      // Butonları bul
      const addToCartBtn = form.querySelector('button[name="donation_add_to_cart"]');
      const checkoutBtn = form.querySelector('button[name="donation_go_checkout"]');

      // Tüm butonları devre dışı bırak
      if (addToCartBtn) addToCartBtn.disabled = true;
      if (checkoutBtn) checkoutBtn.disabled = true;

      // Sadece tıklanan butona yükleniyor durumu ekle
      if (isCheckout && checkoutBtn) {
        checkoutBtn.classList.add("wdp-loading");
        // Diğer butona loading sınıfı eklenmediğinden emin ol
        if (addToCartBtn) addToCartBtn.classList.remove("wdp-loading");
      } else if (addToCartBtn) {
        addToCartBtn.classList.add("wdp-loading");
        // Diğer butona loading sınıfı eklenmediğinden emin ol
        if (checkoutBtn) checkoutBtn.classList.remove("wdp-loading");
      }

      // Benzersiz bir anahtar oluştur
      const uniqueKey = Date.now() + "-" + Math.random().toString(36).substr(2, 9);

      // Form verilerine benzersiz anahtarı ekle
      let uniqueKeyInput = form.querySelector('input[name="unique_submission_key"]');
      if (!uniqueKeyInput) {
        uniqueKeyInput = document.createElement("input");
        uniqueKeyInput.type = "hidden";
        uniqueKeyInput.name = "unique_submission_key";
        form.appendChild(uniqueKeyInput);
      }
      uniqueKeyInput.value = uniqueKey;

      const proceedAjax = () => {
        submitFormData(form, isCheckout);
      };

      // Sayfa uzun süre açık kaldığında (özellikle .wdp-donation-form) nonce / oturum güncelle, sonra gönder
      if (refreshWdpAjaxNonces && typeof refreshWdpAjaxNonces === "function") {
        refreshWdpAjaxNonces()
          .then(() => proceedAjax())
          .catch(() => proceedAjax());
      } else {
        proceedAjax();
      }
    }

    form._wdpSubmitHandler = onWdpFormSubmit;
    form.addEventListener("submit", form._wdpSubmitHandler);

    // Input alanlarına olay dinleyicileri ekle
    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]').forEach((input) => {
      input.addEventListener("focus", function () {
        this.classList.remove("wdp-error");
        // Eğer tüm zorunlu alanlar doluysa hata mesajını gizle
        const errorMsg = form.querySelector(".wdp-form-error");
        if (errorMsg) {
          errorMsg.style.display = "none";
        }
        // Eğer fiyat uyarısı varsa onu da gizle
        if (this.name === "custom_price") {
          const priceField = this.closest(".wdp-price-field");
          if (priceField) {
            const minWarn = priceField.querySelector(".wdp-price-warning");
            if (minWarn) minWarn.style.display = "none";
          }
        }
      });

      // Özel fiyat alanı için minimum değer kontrolü - optimized with debounce
      if (input.name === "custom_price") {
        // Focus handler - immediate
        input.addEventListener("focus", function () {
          this.classList.remove("wdp-error");
          const errorMsg = form.querySelector(".wdp-form-error");
          if (errorMsg) {
            errorMsg.style.display = "none";
          }
          // Input-error mesajlarını temizle
          const inputError = this.parentNode.querySelector('.wdp-input-error');
          if (inputError) {
            inputError.remove();
          }
        });
        
        // Blur handler - debounced for better performance
        const debouncedBlurHandler = debounce ? debounce(function() {
          const minPrice = Number.parseFloat(this.getAttribute("min") || 0);
          const currentValue = Number.parseFloat(this.value || 0);
          if (this.value !== "" && minPrice > 0 && currentValue < minPrice) {
            // Input alanının üzerinde küçük popup uyarısı göster
            this.classList.add("wdp-error");
            
            // Mevcut input-error'u kaldır
            const existingError = this.parentNode.querySelector('.wdp-input-error');
            if (existingError) {
              existingError.remove();
            }
            
            // Yeni input-error elementi oluştur
            const inputError = document.createElement('div');
            inputError.className = 'wdp-input-error';
            inputError.textContent = `Lütfen ${minPrice} TL ve üstü değerler girin.`;
            
            // Input'un parent'ına ekle (position: relative olmalı)
            const parentField = this.closest('.wdp-price-field') || this.parentNode;
            if (parentField) {
              // Parent'ın position'ını kontrol et ve gerekirse relative yap
              const computedStyle = window.getComputedStyle(parentField);
              if (computedStyle.position === 'static') {
                parentField.style.position = 'relative';
              }
              parentField.appendChild(inputError);
            }
          } else {
            this.classList.remove("wdp-error");
            const inputError = this.parentNode.querySelector('.wdp-input-error');
            if (inputError) {
              inputError.remove();
            }
          }
        }, 300) : function() {
          const minPrice = Number.parseFloat(this.getAttribute("min") || 0);
          const currentValue = Number.parseFloat(this.value || 0);
          if (this.value !== "" && minPrice > 0 && currentValue < minPrice) {
            // Input alanının üzerinde küçük popup uyarısı göster
            this.classList.add("wdp-error");
            
            // Mevcut input-error'u kaldır
            const existingError = this.parentNode.querySelector('.wdp-input-error');
            if (existingError) {
              existingError.remove();
            }
            
            // Yeni input-error elementi oluştur
            const inputError = document.createElement('div');
            inputError.className = 'wdp-input-error';
            inputError.textContent = `Lütfen ${minPrice} TL ve üstü değerler girin.`;
            
            // Input'un parent'ına ekle (position: relative olmalı)
            const parentField = this.closest('.wdp-price-field') || this.parentNode;
            if (parentField) {
              // Parent'ın position'ını kontrol et ve gerekirse relative yap
              const computedStyle = window.getComputedStyle(parentField);
              if (computedStyle.position === 'static') {
                parentField.style.position = 'relative';
              }
              parentField.appendChild(inputError);
            }
          } else {
            this.classList.remove("wdp-error");
            const inputError = this.parentNode.querySelector('.wdp-input-error');
            if (inputError) {
              inputError.remove();
            }
          }
        };
        
        input.addEventListener("blur", debouncedBlurHandler);
        input.value = "";
        const minPrice = Number.parseFloat(input.getAttribute("min") || 0);
        input.placeholder = "Min: " + minPrice + " TL";
      }
    });

    // Ürün adedi artırma/azaltma butonları için olay dinleyicileri
    // Adet artırma/azaltma butonları için olay dinleyicileri
    const quantityInput = form.querySelector('input[name="quantity"]');
    const decreaseBtn = form.querySelector(".wdp-product-quantity-decrease");
    const increaseBtn = form.querySelector(".wdp-product-quantity-increase");

    // Hisseli form kontrolü - hissedar sayısına göre otomatik ayarlanıyorsa kontrolleri etkinleştirme
    const shareCountInput = form.querySelector('input[name="share_count"]');
    const isShareForm = !!shareCountInput;

    if (quantityInput && decreaseBtn && increaseBtn && !isShareForm) {
      // Önceki event listener'ları temizle
      const newDecreaseBtn = decreaseBtn.cloneNode(true);
      if (decreaseBtn.parentNode) {
        decreaseBtn.parentNode.replaceChild(newDecreaseBtn, decreaseBtn);
      }

      const newIncreaseBtn = increaseBtn.cloneNode(true);
      if (increaseBtn.parentNode) {
        increaseBtn.parentNode.replaceChild(newIncreaseBtn, increaseBtn);
      }

      // Sadece normal form için ürün adedi butonlarını etkinleştir
      newDecreaseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentValue = Number.parseInt(quantityInput.value, 10) || 1;
        if (currentValue > 1) {
          quantityInput.value = currentValue - 1;
        }
      });

      newIncreaseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentValue = Number.parseInt(quantityInput.value, 10) || 1;
        quantityInput.value = currentValue + 1;
      });

      // Başlangıç değerini ayarla
      quantityInput.value = "1";
    }

    // Hisseli form için quantity alanını devre dışı bırak - hissedar sayısına göre otomatik ayarlanacak
    if (isShareForm && quantityInput) {
      quantityInput.readOnly = true;

      // Adet kontrolü bölümünü gizle
      const quantityRow = form.querySelector(".wdp-product-quantity");
      if (quantityRow) {
        quantityRow.style.display = "none";
      }
    }
  }

  // Export
  WDPApp.form = {
    setup: setupFormSubmission,
    submit: submitFormData,
    validate: validateForm,
    showInputError,
    showFormError,
    handleAjaxResponse,
    handleAjaxError,
    directSubmit: directFormSubmit,
  };

  // Export form module

})(window);

