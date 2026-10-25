/**
 * @file ajax.js
 * AJAX sepete ekleme, nonce yenileme ve sunucu yanıt işleme.
 * Dış API: WDPApp.formAjax
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'getAjaxNonce', 'announceStatus', 'safeLog', 'refreshWdpAjaxNonces', 'clearAlerts', 'classifyAjaxFailure'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  const cartCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('cart', ['fetchContents', 'updateCountElements', 'createItemsHTML', 'renderItemsInto', 'setupContinueShoppingButton', 'updateWooCommerce', 'saveSideCartElements', 'showSideCarts', 'buildCartUiRoot', 'setupRemoveCartItemButtons'])
    : { module: WDPApp.cart || {}, isValid: false, missingMethods: [] };

  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const cart = cartCheck.module;
  const { originalForms } = state;
  const { formatCurrency, getAjaxNonce, announceStatus, safeLog, refreshWdpAjaxNonces, clearAlerts } = utils;
  const classifyAjaxFailure = typeof utils.classifyAjaxFailure === 'function'
    ? utils.classifyAjaxFailure
    : function () { return ''; };
  const RATE_LIMIT_MESSAGE = WDPApp.i18n.__('Too many requests. Please wait a moment and try again.', 'woo-donation-popup');
  const {
    fetchContents: fetchCartContents,
    updateCountElements: updateCartCountElements,
    createItemsHTML: createCartItemsHTML,
    renderItemsInto: renderCartItemsInto,
    buildCartUiRoot,
    setupContinueShoppingButton,
    setupRemoveCartItemButtons,
    updateWooCommerce: updateWooCommerceCart,
    saveSideCartElements,
    showSideCarts,
  } = cart;

  const formPricing = WDPApp.formPricing || {};
  const formAddon = WDPApp.formAddon || {};
  const formFeedback = WDPApp.formFeedback || {};

  const parseNormalizedAmount = formPricing.parseNormalizedAmount || function() { return NaN; };
  const roundMoney = formPricing.roundMoney || function(n) { return Math.round(n * 100) / 100; };
  const formatSubmitUnitPrice = formPricing.formatSubmitUnitPrice || function(u) { return String(u); };
  const getCustomPriceRow = formPricing.getCustomPriceRow || function() { return null; };
  const customPriceRowHasQtyCounter = formPricing.customPriceRowHasQtyCounter || function() { return false; };
  const patchSimpleCustomPriceQtyRowFormData = formPricing.patchSimpleCustomPriceQtyRowFormData || function() {};
  const patchAddonFormData = formAddon.patchAddonFormData || function() {};
  const setFormProcessing = formFeedback.setFormProcessing || function() {};
  const isFormProcessing = formFeedback.isFormProcessing || function() { return false; };

  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;

  const { registerHooks, callHook } = WDPApp.utils.createHookRegistry();

  function getWdpFormRoot(form) {
    if (!form) return null;
    return form.closest(".wdp-modal") || form.closest(".wdp-donation-form");
  }

  function getSuccessAddedToCartText() {
    const strings = wdp_ajax && wdp_ajax.strings ? wdp_ajax.strings : {};
    const text = strings && typeof strings.added_to_cart === 'string' ? strings.added_to_cart.trim() : '';
    return text || WDPApp.i18n.__('Your donation has been added to the cart', 'woo-donation-popup');
  }

  function buildSuccessTopRow() {
    const bar = document.createElement('div');
    bar.className = 'wdp-success-top-bar';
    const msg = document.createElement('p');
    msg.className = 'wdp-success-top-bar__message';
    msg.textContent = getSuccessAddedToCartText();
    bar.appendChild(msg);
    return bar;
  }

  function syncModalSuccessUi(scope) {
    const modal = scope && typeof scope.closest === 'function' ? scope.closest('.wdp-modal') : null;
    if (!modal) {
      return;
    }

    if (WDPApp.modal && typeof WDPApp.modal.syncStateClasses === 'function') {
      WDPApp.modal.syncStateClasses(modal);
      return;
    }

    // Backward-safe fallback if modal module is not ready yet.
    const panelContent = modal.querySelector('.wdp-modal-content');
    if (panelContent) {
      panelContent.classList.toggle('wdp-has-success', !!modal.querySelector('.wdp-success-screen'));
      panelContent.classList.toggle('wdp-has-shareholders', !!modal.querySelector('form.wdp-has-shareholders'));
    }
  }

  function renderSuccessView(successView, cartItems) {
    if (!successView) {
      return;
    }
    successView.innerHTML = '';
    successView.appendChild(buildSuccessTopRow());
    const cartStack = document.createElement('div');
    cartStack.className = 'wdp-success-cart-stack';
    successView.appendChild(cartStack);
    if (typeof renderCartItemsInto === 'function') {
      renderCartItemsInto(cartStack, Array.isArray(cartItems) ? cartItems : []);
    } else if (typeof buildCartUiRoot === 'function') {
      cartStack.appendChild(buildCartUiRoot(Array.isArray(cartItems) ? cartItems : []));
    } else {
      const fallback = document.createElement('div');
      fallback.innerHTML = createCartItemsHTML(Array.isArray(cartItems) ? cartItems : []);
      while (fallback.firstChild) {
        cartStack.appendChild(fallback.firstChild);
      }
    }
    const modal = successView.closest('.wdp-modal');
    if (modal) {
      syncModalSuccessUi(successView);
    }
  }

  function handleAjaxResponse(data, form, isCheckout, addToCartBtn, checkoutBtn) {
    safeLog("Handling AJAX response:", data);

    // Başarı durumunda
    if (data.success) {
      form._wdpNonceRetried = false;
      clearAlerts();
      // Sepet sayısını güncelle
      if (data.cart_count !== undefined) {
        updateCartCountElements(data.cart_count);
      }

      // Hata mesajını gizle (başarılı işlemde hata mesajı gösterme)
      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      }

      // Başarı mesajını göster
      const resolveStorefrontUrl =
        (WDPApp.utils && typeof WDPApp.utils.resolveStorefrontUrl === 'function')
          ? WDPApp.utils.resolveStorefrontUrl
          : function (kind, payload) {
              const key = kind === 'cart' ? 'cart_url' : 'checkout_url';
              const pick = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : '');
              return pick(payload && payload[key]) || pick(wdp_ajax[key]);
            };
      const checkoutDest = isCheckout ? resolveStorefrontUrl('checkout', data) : '';
      if (isCheckout && checkoutDest) {
        // Ödeme adresi yalnız WooCommerce (wdp_ajax / AJAX yanıtı). Sabit slug yok.
        safeLog("Redirecting to checkout:", checkoutDest);
        announceStatus(WDPApp.i18n.__('Redirecting you to checkout.', 'woo-donation-popup'), 'assertive');
        window.location.href = checkoutDest;
      } else {
        // Sepete Ekle için başarı mesajını göster
        safeLog("Showing success message", data);
        announceStatus(WDPApp.i18n.__('Your donation has been added to the cart.', 'woo-donation-popup'), 'polite');

        // "Yeni Bağış Ekle" geri dönüşü için formun ilk halini bu anda da garanti altına al.
        // Bazı WordPress dinamik enjeksiyon senaryolarında saveOriginalForms ilk turu kaçırabiliyor.
        const snapshotContainer = form.closest('.wdp-donation-form, .wdp-modal');
        if (snapshotContainer && originalForms && typeof originalForms.set === 'function') {
          const snapshotKey =
            snapshotContainer.id ||
            snapshotContainer.getAttribute('data-product-id') ||
            null;
          if (snapshotKey && !originalForms.has(snapshotKey)) {
            originalForms.set(snapshotKey, form.innerHTML);
          }
        }

        // Form içeriğini temizle
        form.innerHTML = "";

        // Modal header + progress gizle (popup)
        const modal = form.closest('.wdp-modal');
        if (modal) {
          const modalHeader = modal.querySelector('.wdp-modal-header');
          if (modalHeader) {
            modalHeader.classList.add('wdp-hidden-on-success');
          }
          const modalProgress = modal.querySelector('.wdp-progress-bar-container');
          if (modalProgress) {
            modalProgress.classList.add('wdp-hidden-on-success');
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
        const successView = document.createElement("div");
        successView.className = "wdp-success-screen";
        form.classList.add('wdp-has-success');
        form.appendChild(successView);
        syncModalSuccessUi(form);

        // Sepet içeriğini göster (ilk yanıtta yoksa AJAX ile tamamla)
        if (data.items && Array.isArray(data.items)) {
          renderSuccessView(successView, data.items);
          setupContinueShoppingButton(form);
          setupRemoveCartItemButtons(successView);
        } else {
          successView.innerHTML = '';
          successView.appendChild(buildSuccessTopRow());
          const cartStack = document.createElement('div');
          cartStack.className = 'wdp-success-cart-stack';
          const loadingMessage = document.createElement('div');
          loadingMessage.className = 'wdp-mini-cart-loading';
          loadingMessage.textContent = WDPApp.i18n.__('Loading cart contents...', 'woo-donation-popup');
          cartStack.appendChild(loadingMessage);
          successView.appendChild(cartStack);

          fetchCartContents()
            .then((cartItems) => {
              renderSuccessView(successView, cartItems);
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successView);
            })
            .catch((error) => {
              safeLog("Error fetching cart contents:", error);
              renderSuccessView(successView, []);
              setupContinueShoppingButton(form);
              setupRemoveCartItemButtons(successView);
            });
        }
      }

      // Progress: committed total + pending from cart (do not wipe pending via updateReal alone)
      const progressBarModule = WDPApp.progressBar;
      if (progressBarModule) {
        if (data.total_donation !== undefined && data.product_id) {
          const container = form.closest('.wdp-modal, .wdp-donation-form');
          if (container) {
            const progressContainer = container.querySelector('.wdp-progress-bar-container');
            if (progressContainer && typeof progressBarModule.updateLayers === 'function') {
              const limit = parseFloat(progressContainer.getAttribute('data-limit')) || 100000;
              const pending =
                data.pending_in_cart !== undefined
                  ? parseFloat(data.pending_in_cart) || 0
                  : (typeof progressBarModule.sumPendingForProduct === 'function'
                      ? progressBarModule.sumPendingForProduct(data.items, data.product_id)
                      : parseFloat(progressContainer.getAttribute('data-pending')) || 0);
              progressBarModule.updateLayers(progressContainer, {
                current: parseFloat(data.total_donation) || 0,
                limit: limit,
                pending: pending,
                draft: 0,
              });
            } else if (progressContainer && typeof progressBarModule.updateReal === 'function') {
              const limit = parseFloat(progressContainer.getAttribute('data-limit')) || 100000;
              progressBarModule.updateReal(progressContainer, data.total_donation, limit);
            }
          }
        }
        if (data.items && Array.isArray(data.items) && typeof progressBarModule.syncFromCartItems === 'function') {
          progressBarModule.syncFromCartItems(data.items);
        }
      }

      // WooCommerce sepet fragmentlerini güncelle
      updateWooCommerceCart();
    } else {
      const rawMessage = data && data.message ? String(data.message) : "";
      const normalizedMessage = rawMessage.toLowerCase();
      const responseCode = data && data.code ? String(data.code) : "";
      const isValidationError =
        responseCode === "validation_error" ||
        (data && Array.isArray(data.errors) && data.errors.length > 0);
      const isTechnicalNoiseError =
        responseCode === "security_error" ||
        responseCode === "unknown_error" ||
        normalizedMessage.includes(WDPApp.i18n._x('security', 'server error keyword', 'woo-donation-popup').toLowerCase()) ||
        normalizedMessage.includes(WDPApp.i18n._x('invalid request', 'server error keyword', 'woo-donation-popup').toLowerCase()) ||
        normalizedMessage.includes(WDPApp.i18n._x('unexpected error', 'server error keyword', 'woo-donation-popup').toLowerCase()) ||
        normalizedMessage.includes(WDPApp.i18n._x('cart object', 'server error keyword', 'woo-donation-popup').toLowerCase());

      const fallbackMessage = rawMessage || WDPApp.i18n._x('The action could not be completed. Please try again.', 'frontend script', 'woo-donation-popup');

      const shouldTryFieldAnchors = isValidationError && !isTechnicalNoiseError;
      const validationAnchored =
        shouldTryFieldAnchors && callHook("applyAjaxValidationFieldErrors", form, data, fallbackMessage);

      const errorMsg = form.querySelector(".wdp-form-error");
      if (errorMsg) {
        if (shouldTryFieldAnchors && validationAnchored) {
          errorMsg.textContent = "";
          errorMsg.style.display = "none";
        } else {
          errorMsg.textContent = fallbackMessage;
          errorMsg.style.display = "block";
          errorMsg.setAttribute("data-wdp-protected", "true");
        }
      }

      if (validationAnchored) {
        callHook("focusFirstInvalidField", form);
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

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const msg = offline
      ? WDPApp.i18n.__('You appear to be offline. Please try again when you are back online.', 'woo-donation-popup')
      : WDPApp.i18n.__('A connection error occurred. Please try again.', 'woo-donation-popup');

    const errorMsg = form.querySelector(".wdp-form-error");
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.style.display = "block";
      errorMsg.setAttribute('data-wdp-protected', 'true');
      const wrap = document.createElement('div');
      wrap.className = 'wdp-form-error__retry-wrap';
      const text = document.createElement('span');
      text.textContent = msg;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'wdp-form-error__retry';
      retry.textContent = WDPApp.i18n.__('Try again', 'woo-donation-popup');
      wrap.appendChild(text);
      wrap.appendChild(retry);
      errorMsg.appendChild(wrap);
      retry.addEventListener('click', function() {
        const last = form._wdpLastSubmit;
        if (last && typeof last.resubmit === 'function') {
          last.resubmit();
          return;
        }
        const btn = form.querySelector('button[name="donation_add_to_cart"], button[name="donation_go_checkout"]');
        if (btn) btn.click();
      });
    }

    announceStatus(msg, 'assertive');
    if (typeof showToast === 'function' || (WDPApp.utils && WDPApp.utils.showToast)) {
      const toastFn = typeof showToast === 'function' ? showToast : WDPApp.utils.showToast;
      toastFn({ type: 'error', title: WDPApp.i18n.__('Could not submit', 'woo-donation-popup'), message: msg, duration: 5200, announce: false });
    }
    if (WDPApp.utils && typeof WDPApp.utils.emitWdpEvent === 'function') {
      WDPApp.utils.emitWdpEvent('wdp:ajax:error', { form: form, offline: offline });
    }

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
                cart_item_key: verifyData.cart_item_key,
                product_id: verifyData.product_id,
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
    form._wdpLastSubmit = {
      isCheckout: !!isCheckout,
      resubmit: function() {
        if (isFormProcessing(form)) return;
        submitFormData(form, isCheckout);
      },
    };
    if (WDPApp.utils && typeof WDPApp.utils.emitWdpEvent === 'function') {
      WDPApp.utils.emitWdpEvent('wdp:form:submit', { form: form, isCheckout: !!isCheckout });
    }
    // ✅ GÜVENLİ: Fonksiyon scope içinde helper (fonksiyon bitince otomatik temizlenir)
    const $form = (sel) => form.querySelector(sel);
    
    safeLog("Submitting form data...", isCheckout ? "Go to checkout" : "Add to cart");
    clearAlerts();

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.ensureNationalDisplayInForm === 'function') {
      WDPApp.phoneInput.ensureNationalDisplayInForm(form);
    }

    // CRITICAL: Hissedar formlarında quantity'yi shareCount'a göre güncelle (FormData oluşturulmadan önce)
    const shareCountInput = $form('input[name="share_count"]');
    const effectiveShareCount = shareCountInput ? callHook("getEffectiveShareCount", form) : 1;
    if (shareCountInput) {
      const shareCount = effectiveShareCount;
      const quantityInput = $form('input[name="quantity"]');
      if (quantityInput && shareCount > 0) {
        quantityInput.value = shareCount;
        safeLog("Quantity updated - ShareCount:", shareCount, "-> Quantity:", quantityInput.value);
      }
    }

    const formData = new FormData(form);
    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.applyNormalizedPhonesToFormData === 'function') {
      WDPApp.phoneInput.applyNormalizedPhonesToFormData(form, formData);
    }
    patchSimpleCustomPriceQtyRowFormData(form, formData);
    patchAddonFormData(form, formData);

    const coverFee = form.querySelector('input[name="donation_cover_fee"]');
    if (coverFee && coverFee.checked) {
      formData.set('donation_cover_fee', '1');
      // 10.29.0: yüzdeyi istemci göndermez; sunucu ürün meta'sından okur.
      formData.delete('donation_cover_fee_percent');
      // Sunucu ücreti uygular — taban tutarı gönder (çift uygulama yok).
      const priceInput = form.querySelector('input[name="custom_price"]');
      if (priceInput && formData.has('custom_price')) {
        const parseAmt = (window.WDPApp && WDPApp.utils && typeof WDPApp.utils.parseMoney === 'function')
          ? WDPApp.utils.parseMoney
          : Number.parseFloat;
        const base = parseAmt(formData.get('custom_price') || '');
        if (Number.isFinite(base) && base > 0) {
          const formatted = (window.WDPApp && WDPApp.utils && typeof WDPApp.utils.formatAmountForSubmit === 'function')
            ? WDPApp.utils.formatAmountForSubmit(base)
            : String(base);
          formData.set('custom_price', formatted || String(base));
        }
      }
    } else {
      formData.delete('donation_cover_fee');
      formData.delete('donation_cover_fee_percent');
    }

    // CRITICAL: Hissedar formlarında fiyatı hisse sayısına göre güncelle
    if (shareCountInput) {
      const shareCount = effectiveShareCount;
      const priceInput = $form('input[name="custom_price"]');
      
      if (priceInput) {
        // Base price'ı al (dataset'ten veya mevcut fiyattan)
        const parseAmtShare = (window.WDPApp && WDPApp.utils && typeof WDPApp.utils.parseMoney === 'function')
          ? WDPApp.utils.parseMoney
          : Number.parseFloat;
        const baseMinValue = parseAmtShare(priceInput.dataset.baseMin || '');
        const currentPriceValue = parseAmtShare(priceInput.value || '');
        
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
          const roundedBasePrice = (window.WDPApp && WDPApp.utils && typeof WDPApp.utils.formatAmountForSubmit === 'function')
            ? WDPApp.utils.formatAmountForSubmit(basePrice)
            : (Number.isInteger(basePrice) ? basePrice.toFixed(0) : basePrice.toFixed(2));
          formData.set('custom_price', roundedBasePrice);
          safeLog("Price calculated - Base:", basePrice, "x Quantity (ShareCount):", shareCount, "= Total:", totalPrice, "-> sending base price to cart:", roundedBasePrice);
        } else if (shareCount > 1) {
          // Base price bulunamadıysa ve hisse sayısı > 1 ise uyarı ver
          safeLog("WARNING: Base price not found for share count:", shareCount);
        }
      }
      
      // CRITICAL: Quantity'yi shareCount olarak ayarla (sepette doğru miktar gösterilsin)
      // Dinamik: Kaç hissedar bilgisi doldurulduysa, o kadar adet ürün sepete eklenecek
      // Örnek: 7 hissedar = 7 adet ürün, fiyat = base_price × 7
      formData.set('quantity', shareCount);
      safeLog("FormData quantity set (ShareCount):", shareCount, "- this means", shareCount, "items in the cart");
      
      // Hissedar bilgilerini ekle
      for (let i = 1; i <= shareCount; i++) {
        const name = $form(`[name='shareholder_name_${i}']`);
        const phone = $form(`[name='shareholder_phone_${i}']`);
        const email = $form(`[name='shareholder_email_${i}']`);
        const note = $form(`[name='shareholder_note_${i}']`);
        if (name) formData.set(`shareholder_name_${i}`, name.value);
        if (phone) formData.set(`shareholder_phone_${i}`, phone.value);
        if (email) formData.set(`shareholder_email_${i}`, email.value);
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
    formData.append("wdp_ajax_flow", "1");
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
      return (
        n === "donation_full_name" ||
        n === "donation_phone" ||
        n === "donation_note" ||
        n === "donation_email" ||
        n === "donation_dedication"
      );
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

    safeLog("Sending AJAX request:", wdp_ajax.ajax_url);

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

          const rescued = parseWdpAjaxResponseText(jqXHR.responseText) || jqXHR.responseJSON || null;
          const kind = classifyAjaxFailure(jqXHR.status, rescued);
          if (kind === 'nonce' && !form._wdpNonceRetried && refreshWdpAjaxNonces) {
            form._wdpNonceRetried = true;
            refreshWdpAjaxNonces({ force: true }).then(function () {
              if (form._wdpLastSubmit && typeof form._wdpLastSubmit.resubmit === 'function') {
                form._wdpLastSubmit.resubmit();
              }
            }).catch(function () {
              handleAjaxResponse(
                rescued || { success: false, message: errorThrown || textStatus, code: 'nonce' },
                form,
                isCheckout,
                addToCartBtn,
                checkoutBtn
              );
            });
            return;
          }
          if (kind === 'rate') {
            handleAjaxResponse(
              rescued || { success: false, message: RATE_LIMIT_MESSAGE, code: 'rate_limit' },
              form,
              isCheckout,
              addToCartBtn,
              checkoutBtn
            );
            return;
          }
          if (rescued) {
            handleAjaxResponse(rescued, form, isCheckout, addToCartBtn, checkoutBtn);
            return;
          }

          const finishWithTransportError = () => {
            safeLog("AJAX transport / response error — after recovery or recovery skipped", jqXHR.status, textStatus);
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
          finishAjaxRequest(form, addToCartBtn, checkoutBtn);
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
          return response.text().then((text) => {
            safeLog("Response text:", text.substring(0, 200));
            let data = parseWdpAjaxResponseText(text);
            if (!data && text) {
              try {
                data = JSON.parse(text);
              } catch (e) {
                if (!response.ok) {
                  const parseErr = new Error("INVALID_JSON_RESPONSE");
                  parseErr.status = response.status;
                  parseErr.wdpRecoverCart = true;
                  throw parseErr;
                }
                safeLog("JSON parse error:", e);
                const parseErr = new Error("INVALID_JSON_RESPONSE");
                parseErr.status = response.status;
                parseErr.wdpRecoverCart = true;
                throw parseErr;
              }
            }
            return { status: response.status, ok: response.ok, data: data };
          });
        })
        .then((pack) => {
          const kind = classifyAjaxFailure(pack.status, pack.data);
          if (kind === 'nonce' && !form._wdpNonceRetried && refreshWdpAjaxNonces) {
            form._wdpNonceRetried = true;
            return refreshWdpAjaxNonces({ force: true }).then(function () {
              if (form._wdpLastSubmit && typeof form._wdpLastSubmit.resubmit === 'function') {
                form._wdpLastSubmit.resubmit();
              }
            });
          }
          if (kind === 'rate') {
            handleAjaxResponse(
              pack.data || { success: false, message: RATE_LIMIT_MESSAGE, code: 'rate_limit' },
              form,
              isCheckout,
              addToCartBtn,
              checkoutBtn
            );
            return;
          }
          if (!pack.ok && pack.status !== 200) {
            const httpErr = new Error(`HTTP error! Status: ${pack.status}`);
            httpErr.status = pack.status;
            throw httpErr;
          }
          handleAjaxResponse(pack.data, form, isCheckout, addToCartBtn, checkoutBtn);
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
          finishAjaxRequest(form, addToCartBtn, checkoutBtn);
        });
    }
  }

  /** AJAX bitiminde ortak temizlik: işlem bayrağı, düğmeler, yan sepet görünürlüğü. */
  function finishAjaxRequest(form, addToCartBtn, checkoutBtn) {
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

    // Side cart: gecikme yok — bir sonraki frame'de görünürlük (AJAX tamamı anında)
    requestAnimationFrame(() => {
      showSideCarts();
    });
  }

  function directFormSubmit(form, isCheckout) {
    safeLog("Direct form submit:", isCheckout ? "Checkout" : "Add to Cart");

    // Form doğrulama
    if (!callHook("validateForm", form)) {
      safeLog("Form validation failed");
      return false;
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.ensureNationalDisplayInForm === 'function') {
      WDPApp.phoneInput.ensureNationalDisplayInForm(form);
    }

    // Hisse adedi varsa, quantity değerini kontrol et ve güncelle
    const shareCountInput = form.querySelector('input[name="share_count"]');
    if (shareCountInput) {
      const shareCount = callHook("getEffectiveShareCount", form);
      const quantityInput = form.querySelector('input[name="quantity"]');

      if (quantityInput && shareCount > 0) {
        // Quantity değerini hisse adedi ile güncelle - hissedar sayısına göre otomatik ayarla
        quantityInput.value = shareCount;
      }
    }

    if (WDPApp.phoneInput && typeof WDPApp.phoneInput.syncE164FieldsInForm === 'function') {
      WDPApp.phoneInput.syncE164FieldsInForm(form);
    }

    const simpleCustomRow = getCustomPriceRow(form);
    if (simpleCustomRow && !shareCountInput) {
      const priceInput = simpleCustomRow.querySelector('input[name="custom_price"]');
      if (priceInput && customPriceRowHasQtyCounter(simpleCustomRow)) {
        const qEl = simpleCustomRow.querySelector('input[name="quantity"]');
        if (qEl) {
          const q = Number.parseInt(qEl.value, 10) || 1;
          let unit = Number.parseFloat(priceInput.dataset.wdpCustomUnit);
          if (!Number.isFinite(unit) || unit <= 0) {
            const total = parseNormalizedAmount(priceInput.value);
            if (Number.isFinite(total) && total > 0 && q > 0) {
              unit = roundMoney(total / q);
            }
          }
          if (Number.isFinite(unit) && unit > 0) {
            priceInput.value = formatSubmitUnitPrice(unit);
          }
        }
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

    // Yerel belge gönderimi yok — aynı AJAX yolu.
    safeLog("Submitting form via AJAX (no native document POST)");
    submitFormData(form, isCheckout);

    return true;
  }
  WDPApp.formAjax = {
    registerHooks: registerHooks,
    syncModalSuccessUi: syncModalSuccessUi,
    renderSuccessView: renderSuccessView,
    handleAjaxResponse: handleAjaxResponse,
    handleAjaxError: handleAjaxError,
    parseWdpAjaxResponseText: parseWdpAjaxResponseText,
    tryRecoverCartAfterAjaxFailure: tryRecoverCartAfterAjaxFailure,
    submitFormData: submitFormData,
    directFormSubmit: directFormSubmit,
  };
})(window);
