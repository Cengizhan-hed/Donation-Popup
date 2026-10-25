/**
 * @file actions.js
 * Sepete ekleme sonrası yönlendirme, panel kapatma ve kullanıcı aksiyonları.
 * Dış API: WDPApp.cartActions
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const cartUi = WDPApp.cartUi || {};
  const cartWoo = WDPApp.cartWoo || {};
  const { safeLog, getAjaxNonce } = utils;
  const { originalForms } = state;
  const wdp_ajax = window.wdp_ajax || {};

  const patchSuccessViewCartUi = cartUi.patchSuccessViewCartUi || function() {};
  const updateWooCommerceCart = cartWoo.updateWooCommerce || function() {};
  const updateCartCountElements = cartWoo.updateCountElements || function() {};

  function setupRemoveCartItemButtons(successView) {
    if (!successView) {
      safeLog("setupRemoveCartItemButtons: successView is null");
      return;
    }

    // Event delegation kullan - daha güvenilir ve dinamik butonlar için
    // Önce mevcut listener'ı kaldır (varsa)
    const existingHandler = successView._removeCartItemHandler;
    if (existingHandler) {
      successView.removeEventListener("click", existingHandler);
      delete successView._removeCartItemHandler;
    }

    // Yeni handler oluştur
    const handler = async (e) => {
      // Buton veya içindeki span'a tıklanabilir
      let button = null;
      const target = e.target;
      
      // Önce butonun kendisine tıklanmış mı kontrol et
      if (target.classList && target.classList.contains("wdp-remove-cart-item")) {
        button = target;
      }
      // Sonra closest ile kontrol et
      else if (target.closest) {
        button = target.closest(".wdp-remove-cart-item");
      }
      
      // Eğer span'a tıklandıysa, parent butonunu bul
      if (!button && target.tagName === "SPAN" && target.parentElement) {
        const parent = target.parentElement;
        if (parent.classList && parent.classList.contains("wdp-remove-cart-item")) {
          button = parent;
        }
      }
      
      // Buton kontrolü
      if (!button || !button.classList || !button.classList.contains("wdp-remove-cart-item") || button.disabled) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      
      const cartItemKey = button.getAttribute("data-cart-item-key");
      if (!cartItemKey) {
        safeLog("No cart item key found for remove button", button);
        return;
      }

      safeLog("Remove cart item clicked:", cartItemKey);

      // Disable button during removal
      button.disabled = true;
      button.style.opacity = "0.5";
      button.style.cursor = "wait";

      const sendRemoveCartItemRequest = async () => {
        const nonce = getAjaxNonce("remove_cart_item");
        safeLog("Remove cart item - cart_item_key:", cartItemKey, "nonce available:", !!nonce);

        const formData = new FormData();
        formData.append("action", "wdp_remove_cart_item");
        formData.append("cart_item_key", cartItemKey);
        if (nonce) {
          formData.append("security", nonce);
        }

        const ajaxUrl = wdp_ajax.ajax_url;
        const response = await fetch(ajaxUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const text = await response.text();
        safeLog("Remove cart item response:", text);

        try {
          return JSON.parse(text);
        } catch (parseError) {
          safeLog("Error parsing remove cart item response:", parseError, text);
          throw new Error("Invalid JSON response");
        }
      };

      try {
        let data = await sendRemoveCartItemRequest();
        safeLog("Remove cart item response data:", data);

        const responseCode = data && data.code ? String(data.code) : "";
        const responseMessage = data && data.message ? String(data.message).toLowerCase() : "";
        const isSecurityError = responseCode === "security_error" || responseMessage.includes(WDPApp.i18n._x('security', 'server error keyword', 'woo-donation-popup').toLowerCase());

        // Nonce timeout / mismatch olursa kullanıcıya hata göstermeden nonce yenileyip bir kez daha dene.
        if (!data.success && isSecurityError && WDPApp.utils && typeof WDPApp.utils.refreshWdpAjaxNonces === "function") {
          await WDPApp.utils.refreshWdpAjaxNonces({ force: true });
          data = await sendRemoveCartItemRequest();
          safeLog("Remove cart item response after nonce refresh:", data);
        }

        if (data.success) {
          // Update cart display
          const cartItems = data.items || [];
          safeLog("Cart items after removal:", cartItems);
          
          patchSuccessViewCartUi(successView, cartItems);
          const hostForm = successView.closest('form');
          if (hostForm) {
            setupContinueShoppingButton(hostForm);
          }
          // Event delegation'ı yeni buton referansları için yeniden bağla
          setupRemoveCartItemButtons(successView);
          safeLog("Cart updated, new items count:", cartItems.length);

          // Update WooCommerce cart
          updateWooCommerceCart();
          
          // Update cart count
          if (data.cart_count !== undefined) {
            updateCartCountElements(data.cart_count);
          }
          
          // Progress: sepetten silince pending'i cart items'tan yeniden hesapla
          if (WDPApp.progressBar && typeof WDPApp.progressBar.syncFromCartItems === 'function') {
            WDPApp.progressBar.syncFromCartItems(cartItems);
          } else {
            document.querySelectorAll('.wdp-progress-bar-container').forEach((container) => {
              const currentValue = parseFloat(container.getAttribute('data-current')) || 0;
              const limit = parseFloat(container.getAttribute('data-limit')) || 100000;
              if (WDPApp.progressBar && WDPApp.progressBar.updateLayers) {
                WDPApp.progressBar.updateLayers(container, {
                  current: currentValue,
                  limit: limit,
                  pending: 0,
                  draft: 0,
                });
              }
            });
          }
          // Success ekranındayken custom_price yok; yeni bağışta setup tekrar bağlar
          safeLog('Progress bars synced after cart item removal');
        } else {
          safeLog("Error removing cart item:", data.message || "Unknown error", data);
          button.disabled = false;
          button.style.opacity = "1";
          button.style.cursor = "pointer";
        }
      } catch (error) {
        safeLog("Error in remove cart item request:", error);
        button.disabled = false;
        button.style.opacity = "1";
        button.style.cursor = "pointer";
      }
    };

    // Handler'ı successView'e bağla ve kaydet
    successView.addEventListener("click", handler);
    successView._removeCartItemHandler = handler;
    
    // Debug: Kaç buton bulundu
    const removeButtons = successView.querySelectorAll(".wdp-remove-cart-item");
    safeLog("setupRemoveCartItemButtons: Found", removeButtons.length, "remove buttons");
  }

  function setupContinueShoppingButton(form) {
    if (!form) {
      return;
    }
    const continueShoppingButtons = form.querySelectorAll(".wdp-continue-shopping");
    continueShoppingButtons.forEach((continueShoppingBtn) => {
      if (continueShoppingBtn.dataset.wdpContinueBound === '1') {
        return;
      }
      continueShoppingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        // Aktif modal'ı bul ve kapat
        const currentModal = form.closest(".wdp-modal");
        if (currentModal) {
          if (WDPApp.modal && WDPApp.modal.close) {
            WDPApp.modal.close(currentModal);
          }
        } else {
          // Doğrudan form için - başarı ekranını kaldır ve formu sıfırla
          if (continueShoppingBtn.classList.contains("wdp-new-donation")) {
            // Modal header'ı tekrar göster (popup için)
            const modal = form.closest('.wdp-modal');
            if (modal) {
              const modalHeader = modal.querySelector('.wdp-modal-header');
              if (modalHeader) {
                modalHeader.classList.remove('wdp-hidden-on-success');
              }
              const modalProgress = modal.querySelector('.wdp-progress-bar-container');
              if (modalProgress) {
                modalProgress.classList.remove('wdp-hidden-on-success');
              }
            }
            
            // Sayfa içi form için progress bar ve başlıkları tekrar göster
            const inPageForm = form.closest('.wdp-donation-form');
            if (inPageForm) {
              const progressBar = inPageForm.querySelector('.wdp-progress-bar-container');
              if (progressBar) {
                progressBar.classList.remove('wdp-hidden-on-success');
              }
              const formTitle = inPageForm.querySelector('.wdp-form-title-wrapper');
              if (formTitle) {
                formTitle.classList.remove('wdp-hidden-on-success');
              }
            }
            
            // Form içeriğini geri yükle
            const formContainer = form.closest(".wdp-donation-form");
            const containerId = formContainer ? (formContainer.id || formContainer.getAttribute("data-product-id") || Math.random().toString(36).substr(2, 9)) : null;
            const originalContent = containerId && originalForms.has(containerId) ? originalForms.get(containerId) : null;
            if (originalContent) {
              if (WDPApp.formWizard && typeof WDPApp.formWizard.destroy === 'function') {
                WDPApp.formWizard.destroy(form);
              }
              form.innerHTML = originalContent;
              if (WDPApp.form && WDPApp.form.setup) {
                WDPApp.form.setup(form);
              }
              // K1: sepete ekleme sonrası aynı ürün formu tutarsız seçimle açılmasın.
              if (WDPApp.form && typeof WDPApp.form.clearAmountSelection === 'function') {
                WDPApp.form.clearAmountSelection(form);
              } else if (WDPApp.formPricing && typeof WDPApp.formPricing.clearAmountSelection === 'function') {
                WDPApp.formPricing.clearAmountSelection(form);
              }
              // Eğer hisseli form ise, tekrar başlat
              const shareCountInput = form.querySelector('input[name="share_count"]');
              if (shareCountInput && WDPApp.shareholder && WDPApp.shareholder.setup && formContainer) {
                const productId = formContainer.getAttribute("data-product-id");
                WDPApp.shareholder.setup(formContainer, productId);
              }
              // CRITICAL: Progress bar'ı tekrar başlat (form reset edildiğinde event listener'lar yeniden bağlanmalı)
              const progressBarContainer = (formContainer || form.closest('.wdp-modal'))?.querySelector('.wdp-progress-bar-container');
              if (progressBarContainer && WDPApp.progressBar && WDPApp.progressBar.setup) {
                progressBarContainer.removeAttribute('data-wdp-progress-setup');
                requestAnimationFrame(() => {
                  WDPApp.progressBar.setup(progressBarContainer);
                  fetchCartContents()
                    .then((items) => {
                      if (WDPApp.progressBar && typeof WDPApp.progressBar.syncFromCartItems === 'function') {
                        WDPApp.progressBar.syncFromCartItems(items);
                      }
                    })
                    .catch(() => {});
                  safeLog("Progress bar reinitialized after form reset");
                });
              }
              // Butonların durumunu hemen sıfırla
              const addToCartBtn = form.querySelector('button[name="donation_add_to_cart"]');
              const checkoutBtn = form.querySelector('button[name="donation_go_checkout"]');
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
        }
        return false;
      });
      continueShoppingBtn.dataset.wdpContinueBound = '1';
    });
  }

  let cartFetchGeneration = 0;

  function fetchCartContents() {
    const generation = ++cartFetchGeneration;
    return new Promise((resolve, reject) => {
      // AJAX isteği için form verisi oluştur
      const formData = new FormData();
      formData.append("action", "wdp_get_cart_contents");
      formData.append("security", getAjaxNonce("get_cart_contents"));

      // AJAX isteği gönder
      fetch(wdp_ajax.ajax_url, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          try {
            return JSON.parse(text);
          } catch (e) {
            safeLog("Error parsing JSON response:", e);
            throw new Error("Invalid JSON response from server");
          }
        })
        .then((data) => {
          if (generation !== cartFetchGeneration) {
            resolve(data && data.success ? (data.items || []) : []);
            return;
          }
          if (data.success) {
            const items = data.items || [];
            if (WDPApp.progressBar && typeof WDPApp.progressBar.syncFromCartItems === 'function') {
              WDPApp.progressBar.syncFromCartItems(items);
            }
            resolve(items);
          } else {
            safeLog("Error fetching cart contents:", data.message);
            reject(data.message);
          }
        })
        .catch((error) => {
          if (generation !== cartFetchGeneration) {
            resolve([]);
            return;
          }
          safeLog("Error in AJAX request for cart contents:", error);
          reject(error);
        });
    });
  }
  WDPApp.cartActions = {
    setupRemoveCartItemButtons: setupRemoveCartItemButtons,
    setupContinueShoppingButton: setupContinueShoppingButton,
    fetchContents: fetchCartContents,
  };
})(window);
