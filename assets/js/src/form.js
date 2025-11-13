/**
 * Form - Form işlemleri
 * setupFormSubmission, validateForm, submitFormData, handleAjaxResponse,
 * handleAjaxError, directFormSubmit, showInputError, showFormError
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Utils, state, alerts ve cart'i güvenli bir şekilde al (henüz yüklenmemişse boş obje)
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const alerts = WDPApp.alerts || {};
  const cart = WDPApp.cart || {};
  const { formatCurrency, getAjaxNonce, announceStatus, safeLog } = utils;
  const { clear: clearAlerts, show: showAlert } = alerts;
  const { fetchContents: fetchCartContents, updateCountElements: updateCartCountElements, createItemsHTML: createCartItemsHTML, setupContinueShoppingButton, updateWooCommerce: updateWooCommerceCart, saveSideCartElements, showSideCarts } = cart;
  
  // Utils henüz yüklenmemişse hata ver
  if (!WDPApp.utils || typeof utils.formatCurrency !== 'function') {
    console.error('WDP ERROR: utils.js must be loaded before form.js!');
    console.error('WDP: WDPApp.utils:', WDPApp.utils);
  }
  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;

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
    // Remove error on focus/input
    function clearError() {
      input.classList.remove('wdp-error');
      if (errorDiv) errorDiv.remove();
      input.removeEventListener('focus', clearError);
      input.removeEventListener('input', clearError);
    }
    input.addEventListener('focus', clearError);
    input.addEventListener('input', clearError);

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
    console.log("validateForm called");
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
      console.log("Checking shareholder forms for count:", shareCount);
      
      for (let i = 1; i <= shareCount; i++) {
        const nameField = form.querySelector(`input[name="shareholder_name_${i}"]`);
        const phoneField = form.querySelector(`input[name="shareholder_phone_${i}"]`);
        
        console.log(`Checking form ${i}:`, {
          nameField: !!nameField,
          nameValue: nameField?.value,
          phoneField: !!phoneField,
          phoneValue: phoneField?.value
        });
        
        // Ad alanı kontrolü
        if (nameField && !nameField.value.trim()) {
          console.log(`Name field ${i} is empty`);
          showInputError(nameField, `${i}. Hissedar Adı zorunludur`);
          errorMessages.push(`${i}. Hissedar Adı`);
          isValid = false;
        }
        
        // Telefon alanı kontrolü
        if (phoneField && !phoneField.value.trim()) {
          console.log(`Phone field ${i} is empty`);
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
    console.log("Form validation result:", { isValid, errorMessages });

    // Form geçersizse popup göster
    if (!isValid) {
      console.log("Form is invalid, showing popup error");
      showAlert(errorMessages, {
        type: 'error',
        title: 'Lütfen aşağıdaki alanları kontrol edin'
      });
    }
    
    return isValid;
  }

  function handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn) {
    console.log("Handling AJAX response:", data);

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
        console.log("Redirecting to checkout:", data.checkout_url);
        announceStatus('Ödeme adımına yönlendiriliyorsunuz.', 'assertive');
        window.location.href = data.checkout_url || wdp_ajax.checkout_url || "/odeme-sayfasi/";
      } else {
        // Sepete Ekle için başarı mesajını göster
        console.log("Showing success message", data);
        announceStatus('Bağışınız sepete eklendi.', 'polite');

        // Form içeriğini sakla (tamamen silmek yerine)
        const formContent = form.innerHTML;
        form.setAttribute("data-original-content", formContent);

        // Form içeriğini temizle
        form.innerHTML = "";

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
  <a href="${wdp_ajax.cart_url || "/sepet/"}" class="wdp-success-button wdp-view-cart">Sepeti Görüntüle</a>
  <a href="${wdp_ajax.checkout_url || "/odeme-sayfasi/"}" class="wdp-success-button wdp-checkout">Ödemeye Git</a>
  <a href="#" class="wdp-success-button wdp-continue-shopping wdp-new-donation">Yeni Bağış Ekle</a>
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
            })
            .catch((error) => {
              console.error("Error fetching cart contents:", error);
              successScreen.innerHTML = `
<div class="wdp-success-message">Bağışınız sepete eklendi!</div>
${createCartItemsHTML([])}
`;
              setupContinueShoppingButton(form);
            });
        }

        // Eğer data.items varsa, HTML'i hemen ayarla
        if (data.items && Array.isArray(data.items)) {
          successScreen.innerHTML = successContent;
          setupContinueShoppingButton(form);
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
    console.error("AJAX error:", error);

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

    // İşlem bayrağını sıfırla
    state.isProcessing = false;
  }

  function submitFormData(form, isCheckout) {
    console.log("Submitting form data...", isCheckout ? "Ödemeye Git" : "Sepete Ekle");
    clearAlerts();
    const formData = new FormData(form);
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = Number.parseInt(shareCountInput.value, 10) || 1;
      for (let i = 1; i <= shareCount; i++) {
        const name = form.querySelector(`[name='shareholder_name_${i}']`);
        const phone = form.querySelector(`[name='shareholder_phone_${i}']`);
        const note = form.querySelector(`[name='shareholder_note_${i}']`);
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
    const addToCartBtn = form.querySelector('button[name="donation_add_to_cart"]');
    const checkoutBtn = form.querySelector('button[name="donation_go_checkout"]');

    // Form verilerini URL kodlamasına dönüştür
    const formDataUrlEncoded = new URLSearchParams();
    for (const pair of formData.entries()) {
      console.log(pair[0] + ": " + pair[1]); // Debug için form verilerini logla
      formDataUrlEncoded.append(pair[0], pair[1]);
    }

    // Mevcut side cart elementlerini kaydet
    saveSideCartElements();

    console.log("AJAX isteği gönderiliyor:", wdp_ajax.ajax_url);

    // Hata mesajı alanını bul ve gizle - Başlangıçta hata mesajını gizle
    const errorMsg = form.querySelector(".wdp-form-error");
    if (errorMsg) {
      errorMsg.style.display = "none";
      errorMsg.textContent = "";
    }

    // Alternatif olarak jQuery AJAX kullan (daha güvenilir olabilir)
    if (typeof jQuery !== "undefined") {
      console.log("Using jQuery AJAX");
      jQuery.ajax({
        url: wdp_ajax.ajax_url,
        type: "POST",
        data: formDataUrlEncoded.toString(),
        contentType: "application/x-www-form-urlencoded",
        dataType: "json",
        beforeSend: () => {
          console.log("jQuery AJAX request starting...");
        },
        success: (data) => {
          console.log("jQuery AJAX success:", data);
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        },
        error: (jqXHR, textStatus, errorThrown) => {
          console.error("jQuery AJAX error:", textStatus, errorThrown);

          // Gerçek bir hata olup olmadığını kontrol et
          if (jqXHR.status !== 200) {
            handleAjaxError(errorThrown, form, addToCartBtn, checkoutBtn);
          } else {
            // HTTP 200 yanıtı ama JSON parse hatası olabilir
            // Bu durumda işlemi başarılı kabul et ve hata mesajını gösterme
            console.log("Ignoring non-critical error, continuing with checkout");
            if (isCheckout) {
              window.location.href = wdp_ajax.checkout_url || "/odeme-sayfasi/";
            } else {
              // Butonları tekrar aktif et
              if (addToCartBtn) {
                addToCartBtn.disabled = false;
                addToCartBtn.classList.remove("wdp-loading");
              }
              if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.classList.remove("wdp-loading");
              }
            }
          }
        },
        complete: () => {
          console.log("jQuery AJAX request completed");
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          state.isProcessing = false;

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
      console.log("Using Fetch API");
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
          console.log("Fetch response received:", response);
          if (!response.ok && response.status !== 200) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text().then((text) => {
            console.log("Response text:", text);
            try {
              return JSON.parse(text);
            } catch (e) {
              console.error("JSON parse error:", e);
              // JSON parse hatası olsa bile işlemi başarılı kabul et
              return {
                success: true,
                message: "Ürün sepete eklendi",
                checkout_url: wdp_ajax.checkout_url || "/odeme-sayfasi/",
                items: [],
              };
            }
          });
        })
        .then((data) => {
          handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn);
        })
        .catch((error) => {
          console.error("Fetch error:", error);
          // Gerçek bir ağ hatası olduğunda hata mesajını göster
          if (error.name !== "SyntaxError") {
            handleAjaxError(error, form, addToCartBtn, checkoutBtn);
          } else {
            // JSON parse hatası - işlemi başarılı kabul et
            console.log("Ignoring JSON parse error, continuing with checkout");
            if (isCheckout) {
              window.location.href = wdp_ajax.checkout_url || "/odeme-sayfasi/";
            }
          }
        })
        .finally(() => {
          // İşlem her durumda tamamlandıktan sonra bayrağı sıfırla
          state.isProcessing = false;

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
    console.log("Direct form submit:", isCheckout ? "Checkout" : "Add to Cart");

    // Form doğrulama
    if (!validateForm(form)) {
      console.log("Form validation failed");
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
    console.log("Submitting form directly");
    form.submit();

    return true;
  }

  function setupFormSubmission(form) {
    console.log("Form submission setup for:", form);

    // Form submit olayını doğrudan ele al
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      console.log("Form submitted");

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
      console.log("Is checkout:", isCheckout);

      // Form doğrulama
      if (!validateForm(form)) {
        console.log("Form validation failed");
        return false;
      }

      // Eğer işlem zaten devam ediyorsa, yeni bir istek gönderme
      if (state.isProcessing) {
        console.log("Processing already in progress");
        return false;
      }

      // İşlem başladığını işaretle
      state.isProcessing = true;

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

      // Form verilerini gönder
      submitFormData(form, isCheckout);
    });

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

      // Özel fiyat alanı için minimum değer kontrolü
      if (input.name === "custom_price") {
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
        input.addEventListener("blur", function () {
          const minPrice = Number.parseFloat(this.getAttribute("min") || 0);
          const currentValue = Number.parseFloat(this.value || 0);
          if (this.value !== "" && minPrice > 0 && currentValue < minPrice) {
            // Değeri otomatik düzeltme - sadece popup uyarısı göster
            this.classList.add("wdp-error");
            showAlert([`Lütfen ${minPrice} TL ve üstü değerler girin.`], {
              type: 'warning',
              title: 'Minimum tutar hatası',
              autoClose: false, // Otomatik kapanma kapalı
              nonClosable: false, // Kapatılabilir (çarpı, overlay, ESC ile)
              persistent: false // Normal şekilde kapatılabilir
            });
          } else {
            this.classList.remove("wdp-error");
            const inputError = this.parentNode.querySelector('.wdp-input-error');
            if (inputError) {
              inputError.remove();
            }
          }
        });
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

  console.log('✅ WDP: form.js loaded');
  console.log('📦 WDP: WDPApp.form exported:', !!WDPApp.form);
  console.log('🔧 WDP: setupFormSubmission function:', typeof WDPApp.form.setup);

})(window);

