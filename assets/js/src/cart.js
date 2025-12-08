/**
 * Cart - Sepet işlemleri
 * fetchCartContents, showSideCarts, updateCartCountElements, saveSideCartElements,
 * createCartItemsHTML, setupContinueShoppingButton, updateWooCommerceCart,
 * fallbackCartUpdate, triggerSideCartUpdates, fixCartItemStyles
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatPrice', 'escapeHtml', 'getAjaxNonce', 'safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { formatPrice, escapeHtml, getAjaxNonce, safeLog } = utils;
  const { originalForms, sideCartElements } = state;
  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;

  function updateWooCommerceCart() {
    // jQuery varsa WooCommerce'in kendi AJAX işlemini çağır
    if (typeof jQuery !== "undefined") {
      try {
        // WooCommerce'in kendi AJAX işlemini çağır
        jQuery(document.body).trigger("wc_fragment_refresh");

        // WooCommerce sepet fragmentlerini manuel olarak yenile
        if (typeof wc_add_to_cart_params !== "undefined") {
          jQuery.ajax({
            url: wc_add_to_cart_params.wc_ajax_url.toString().replace("%%endpoint%%", "get_refreshed_fragments"),
            type: "POST",
            data: {
              action: "woocommerce_get_refreshed_fragments",
            },
            success: (response) => {
              if (response && response.fragments) {
                // Fragment'leri güncelle
                jQuery.each(response.fragments, (key, value) => {
                  jQuery(key).replaceWith(value);
                });

                if (typeof sessionStorage !== "undefined") {
                  sessionStorage.setItem("wc_fragments", JSON.stringify(response.fragments));
                  sessionStorage.setItem("wc_cart_hash", response.cart_hash);
                }

                jQuery(document.body).trigger("wc_fragments_refreshed");
              }

              // Side cart elementlerini geri yükle
              setTimeout(() => {
                showSideCarts();
              }, 300);
            },
            error: () => {
              // Hata durumunda fallback yöntemini kullan
              fallbackCartUpdate();
            },
            complete: () => {
              // İşlem tamamlandıktan sonra side cart'ı yeniden göster
              setTimeout(() => {
                showSideCarts();
              }, 300);
            },
          });
        }
      } catch (jQueryError) {
        safeLog("jQuery error:", jQueryError);
        // jQuery hatası durumunda fallback yöntemini kullan
        fallbackCartUpdate();
      }
    } else {
      // jQuery yoksa fallback yöntemini kullan
      fallbackCartUpdate();
    }
  }

  function fallbackCartUpdate() {
    safeLog("Fallback cart update triggered");
    // Refresh the page as a last resort
    window.location.reload();
  }

  function showSideCarts() {
    safeLog("Showing side carts");

    // Yaygın side cart sınıf ve ID'lerini kontrol et
    const sideCartSelectors = [
      ".xoo-wsc-container", // XOO Side Cart
      ".site-cart-sidebar", // WooCommerce Side Cart
      ".widget_shopping_cart_content", // WooCommerce Mini Cart
      ".cart-sidebar", // Genel side cart
      ".side-cart", // Genel side cart
      ".cart-drawer", // Genel side cart drawer
      "#side-cart", // ID ile side cart
      '[class*="side-cart"]', // "side-cart" içeren sınıflar
      '[class*="sidecart"]', // "sidecart" içeren sınıflar
      '[class*="cart-sidebar"]', // "cart-sidebar" içeren sınıflar
      '[class*="cart-drawer"]', // "cart-drawer" içeren sınıflar
      '[class*="mini-cart"]', // "mini-cart" içeren sınıflar
      ".cart-contents", // WooCommerce cart icon
      ".cart-icon", // Genel sepet ikonu
      ".cart-link", // Genel sepet linki
      "#cart-icon", // ID ile sepet ikonu
      '[class*="cart-icon"]', // "cart-icon" içeren sınıflar
      '[class*="cart-button"]', // "cart-button" içeren sınıflar
      ".fusion-icon-shopping-cart", // Avada teması için
      ".fusion-widget-cart", // Avada teması için
      ".fusion-main-menu-cart", // Avada teması için
      ".fusion-custom-menu-item-contents", // Avada teması için
      ".fusion-menu-cart", // Avada teması için
      ".fusion-menu-cart-items", // Avada teması için
    ];

    // Tüm olası side cart elementlerini bul ve görünür yap
    sideCartSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          safeLog(`Found ${elements.length} elements with selector: ${selector}`);
          elements.forEach((element) => {
            // Display none ise görünür yap
            if (window.getComputedStyle(element).display === "none") {
              safeLog(`Making visible: ${selector}`);
              element.style.display = "";
            }

            // Opacity 0 ise görünür yap
            if (window.getComputedStyle(element).opacity === "0") {
              safeLog(`Setting opacity: ${selector}`);
              element.style.opacity = "1";
            }

            // Visibility hidden ise görünür yap
            if (window.getComputedStyle(element).visibility === "hidden") {
              safeLog(`Setting visibility: ${selector}`);
              element.style.visibility = "visible";
            }

            // Eğer element içinde başka gizli elementler varsa onları da göster
            const hiddenChildren = element.querySelectorAll(
              '[style*="display: none"], [style*="opacity: 0"], [style*="visibility: hidden"]',
            );
            hiddenChildren.forEach((child) => {
              child.style.display = "";
              child.style.opacity = "1";
              child.style.visibility = "visible";
            });
          });
        }
      } catch (e) {
        safeLog(`Error with selector ${selector}:`, e);
      }
    });

    // Tema özel sepet ikonlarını kontrol et
    try {
      // Avada teması için
      if (typeof jQuery !== "undefined") {
        // Avada teması için
        if (jQuery(".fusion-icon-shopping-cart").length > 0) {
          jQuery(".fusion-icon-shopping-cart").parent().show();
        }

        // Avada teması için sepet menüsü
        if (jQuery(".fusion-main-menu-cart").length > 0) {
          jQuery(".fusion-main-menu-cart").show();
        }

        // Avada teması için sepet widget'ı
        if (jQuery(".fusion-widget-cart").length > 0) {
          jQuery(".fusion-widget-cart").show();
        }

        // Avada teması için özel menü öğesi
        if (jQuery(".fusion-custom-menu-item-contents").length > 0) {
          jQuery(".fusion-custom-menu-item-contents").show();
        }
      }
    } catch (e) {
      safeLog("Error checking theme-specific cart icons:", e);
    }

    // Sayfadaki tüm sepet ikonlarını ve side cart'ları görünür yapmak için
    // CSS ekleyelim (son çare olarak)
    const styleElement = document.createElement("style");
    styleElement.textContent = `
      .cart-contents, .cart-icon, .cart-link, #cart-icon, 
      [class*="cart-icon"], [class*="cart-button"],
      .xoo-wsc-container, .site-cart-sidebar, .widget_shopping_cart_content,
      .cart-sidebar, .side-cart, .cart-drawer, #side-cart,
      [class*="side-cart"], [class*="sidecart"], [class*="cart-sidebar"],
      [class*="cart-drawer"], [class*="mini-cart"],
      .fusion-icon-shopping-cart, .fusion-widget-cart, .fusion-main-menu-cart,
      .fusion-custom-menu-item-contents, .fusion-menu-cart, .fusion-menu-cart-items {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
    `;
    document.head.appendChild(styleElement);

    // 5 saniye sonra stil elementini kaldır
    setTimeout(() => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    }, 5000);
  }

  function createCartItemsHTML(cartItems) {
    let html = `<div class="wdp-mini-cart">
  <div class="wdp-mini-cart-header">
    <h4>Sepetiniz</h4>
  </div>
  <div class="wdp-mini-cart-items">`;

    if (cartItems && cartItems.length > 0) {
      // En son eklenen ürün en başta görünsün (reverse order)
      const reversedItems = [...cartItems].reverse();
      reversedItems.forEach((item) => {
        // Fiyat ve miktarı güvenli bir şekilde al
        let itemPrice = 0;
        let itemQuantity = 1;
        
        // Fiyatı parse et (string veya number olabilir)
        if (item.price !== null && item.price !== undefined && item.price !== '') {
          if (typeof item.price === 'string') {
            // String ise temizle (boşluk, nokta, virgül vb.)
            const cleanedPrice = item.price.toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
            itemPrice = Number.parseFloat(cleanedPrice);
          } else if (typeof item.price === 'number') {
            itemPrice = item.price;
          }
        }
        
        // Quantity'yi parse et
        if (item.quantity !== null && item.quantity !== undefined && item.quantity !== '') {
          itemQuantity = Number.parseInt(item.quantity, 10);
        }
        
        // NaN kontrolü
        if (!Number.isFinite(itemPrice) || isNaN(itemPrice)) {
          itemPrice = 0;
        }
        if (!Number.isFinite(itemQuantity) || isNaN(itemQuantity) || itemQuantity < 1) {
          itemQuantity = 1;
        }
        
        // Toplam fiyatı hesapla - Eğer line_total varsa onu kullan, yoksa hesapla
        let totalPrice = itemPrice * itemQuantity;
        if (item.line_total !== null && item.line_total !== undefined && item.line_total !== '') {
          if (typeof item.line_total === 'string') {
            const cleanedLineTotal = item.line_total.toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
            const parsedLineTotal = Number.parseFloat(cleanedLineTotal);
            if (Number.isFinite(parsedLineTotal) && !isNaN(parsedLineTotal)) {
              totalPrice = parsedLineTotal;
            }
          } else if (typeof item.line_total === 'number') {
            totalPrice = item.line_total;
          }
        }
        
        // Fiyat gösterimi: Eğer price_html varsa onu kullan (Currency eklentisi desteği için)
        // Aksi halde formatPrice kullan ama para birimi sembolü ekleme (price_html zaten içeriyor)
        let priceDisplay = '';
        if (item.price_html && typeof item.price_html === 'string' && item.price_html.trim() !== '') {
          // price_html zaten formatlanmış HTML içeriyor (Currency eklentisi desteği ile)
          priceDisplay = item.price_html;
        } else {
          // Fallback: Eğer price_html yoksa, formatPrice kullan ve para birimi sembolü ekle
          const currencySymbol = (wdp_ajax && wdp_ajax.currency && wdp_ajax.currency.symbol) ? wdp_ajax.currency.symbol : '₺';
          priceDisplay = formatPrice(totalPrice) + ' ' + currencySymbol;
        }
        
        // Ürün adını al (product_name veya name)
        const productName = item.product_name || item.name || 'Ürün';
        
        // Ürün adında HTML varsa (ikon vb.) onu koru, yoksa escape et
        let productNameHtml = productName;
        // Eğer product_name içinde HTML tag'leri varsa (örn: <i class="icon-...">) olduğu gibi bırak
        if (productName.includes('<') && productName.includes('>')) {
          // HTML içeriyor, escape etme (zaten güvenli olmalı, WordPress'ten geliyor)
          productNameHtml = productName;
        } else {
          // HTML içermiyor, güvenlik için escape et
          productNameHtml = escapeHtml(productName);
        }
        
        safeLog("Cart item:", {
          name: productName,
          product_name: item.product_name,
          name_field: item.name,
          hasHtml: productName.includes('<'),
          price: item.price,
          parsedPrice: itemPrice,
          line_total: item.line_total,
          price_html: item.price_html,
          quantity: item.quantity,
          parsedQuantity: itemQuantity,
          totalPrice: totalPrice,
          priceDisplay: priceDisplay
        });

        // Cart item key for remove functionality
        const cartItemKey = item.key || '';
        
        // Temiz HTML yapısı - CSS class'ları kullanıyor
        // Çarpı butonu en sağda, ürün başlığı ile aynı hizada
        html += `
      <table class="wdp-cart-item-table">
        <tr>
          <td class="wdp-cart-item-info">
            <div class="wdp-cart-item-name">${productNameHtml}</div>
              ${
                item.meta && item.meta.length > 0
                ? `<div class="wdp-cart-item-meta">
                    ${item.meta
                      .map((meta) => `<div class="wdp-cart-item-meta-item">${escapeHtml(meta.key)}: ${escapeHtml(meta.value)}</div>`)
                      .join("")}
                  </div>`
                : ""
            }
          </td>
          <td class="wdp-cart-item-details">
            <div class="wdp-cart-item-quantity">${itemQuantity} adet</div>
            <div class="wdp-cart-item-price">${priceDisplay}</div>
          </td>
          <td class="wdp-cart-item-remove">
            <button type="button" class="wdp-remove-cart-item" data-cart-item-key="${escapeHtml(cartItemKey)}" aria-label="Sepetten Kaldır">
              <span aria-hidden="true">&times;</span>
            </button>
          </td>
        </tr>
      </table>
      `;
      });
    } else {
      html += `<div class="wdp-cart-empty">Sepetinizde ürün bulunmuyor.</div>`;
    }

    // Başarı ekranı buton metinlerini ayarlardan al
    const buttonTexts = (wdp_ajax && wdp_ajax.button_texts) ? wdp_ajax.button_texts : {};
    const viewCartText = buttonTexts.success_view_cart || "Sepeti Görüntüle";
    const goCheckoutText = buttonTexts.success_go_checkout || "Ödemeye Git";
    const newDonationText = buttonTexts.success_new_donation || "Yeni Bağış Ekle";

    html += `</div></div>
 <div class="wdp-success-buttons">
   <a href="${wdp_ajax.cart_url || "/sepet/"}" class="wdp-success-button wdp-view-cart">${escapeHtml(viewCartText)}</a>
   <a href="${wdp_ajax.checkout_url || "/odeme-sayfasi/"}" class="wdp-success-button wdp-checkout">${escapeHtml(goCheckoutText)}</a>
   <a href="#" class="wdp-success-button wdp-continue-shopping wdp-new-donation">${escapeHtml(newDonationText)}</a>
 </div>`;

    return html;
  }

  function setupRemoveCartItemButtons(successScreen) {
    if (!successScreen) {
      safeLog("setupRemoveCartItemButtons: successScreen is null");
      return;
    }

    // Event delegation kullan - daha güvenilir ve dinamik butonlar için
    // Önce mevcut listener'ı kaldır (varsa)
    const existingHandler = successScreen._removeCartItemHandler;
    if (existingHandler) {
      successScreen.removeEventListener("click", existingHandler);
      delete successScreen._removeCartItemHandler;
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

      try {
        // Remove item via AJAX
        // WooCommerce AJAX kullan (daha güvenilir)
        const wcRemoveUrl = (typeof wc_add_to_cart_params !== 'undefined' && wc_add_to_cart_params.wc_ajax_url) 
          ? wc_add_to_cart_params.wc_ajax_url.toString().replace("%%endpoint%%", "remove_from_cart")
          : null;
        
        // Custom endpoint fallback
        const nonce = getAjaxNonce("remove_cart_item");
        safeLog("Remove cart item - cart_item_key:", cartItemKey, "nonce available:", !!nonce);
        
        const formData = new FormData();
        formData.append("action", "wdp_remove_cart_item");
        formData.append("cart_item_key", cartItemKey);
        
        // Nonce varsa ekle, yoksa referer kontrolü yeterli
        if (nonce) {
          formData.append("security", nonce);
        }
        
        const ajaxUrl = wdp_ajax.ajax_url;

        const response = await fetch(ajaxUrl, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const text = await response.text();
        safeLog("Remove cart item response:", text);
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          safeLog("Error parsing remove cart item response:", parseError, text);
          throw new Error("Invalid JSON response");
        }

        safeLog("Remove cart item response data:", data);

        if (data.success) {
          // Update cart display
          const cartItems = data.items || [];
          safeLog("Cart items after removal:", cartItems);
          
          // Get the mini cart container
          const miniCartContainer = successScreen.querySelector(".wdp-mini-cart");
          if (miniCartContainer) {
            // Extract only the mini cart HTML from the full HTML
            const fullHTML = createCartItemsHTML(cartItems);
            safeLog("Generated cart HTML:", fullHTML);
            
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = fullHTML;
            const newMiniCart = tempDiv.querySelector(".wdp-mini-cart");
            
            if (newMiniCart) {
              // Mini cart items kısmını güncelle
              const oldItems = miniCartContainer.querySelector(".wdp-mini-cart-items");
              const newItems = newMiniCart.querySelector(".wdp-mini-cart-items");
              
              if (oldItems && newItems) {
                oldItems.innerHTML = newItems.innerHTML;
                safeLog("Cart items HTML updated successfully");
              } else {
                // Fallback: tüm mini cart'ı güncelle
                miniCartContainer.innerHTML = newMiniCart.innerHTML;
                safeLog("Cart container updated (full replace)");
              }
              
              // Event delegation sayesinde yeni butonlar otomatik çalışacak
              // Ama yine de setup'ı çağıralım (güvenlik için)
              setupRemoveCartItemButtons(successScreen);
              
              safeLog("Cart updated, new items count:", cartItems.length);
            } else {
              safeLog("New mini cart element not found in generated HTML");
            }
          } else {
            safeLog("Mini cart container not found in success screen");
          }

          // Update WooCommerce cart
          updateWooCommerceCart();
          
          // Update cart count
          if (data.cart_count !== undefined) {
            updateCartCountElements(data.cart_count);
          }
          
          // CRITICAL: Progress bar preview'ı sıfırla ve yüzde değerini güncelle (mini cart'tan item silindiğinde)
          // Tüm progress bar container'larını bul ve preview'ı sıfırla
          const progressBarContainers = document.querySelectorAll('.wdp-progress-bar-container');
          progressBarContainers.forEach(container => {
            const previewBar = container.querySelector('.wdp-progress-bar-preview');
            const fillBar = container.querySelector('.wdp-progress-bar-fill');
            const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');
            const amountElement = container.querySelector('.wdp-progress-bar-amount');
            
            // Preview bar'ı sıfırla
            if (previewBar) {
              previewBar.style.width = '0%';
              previewBar.style.left = '0%';
              previewBar.style.display = 'none';
            }
            
            // Güncel toplam bağış miktarını al (data-current'dan)
            const currentValue = parseFloat(container.getAttribute('data-current')) || 0;
            const limit = parseFloat(container.getAttribute('data-limit')) || 100000;
            
            // Yüzde değerini hesapla (sadece gerçek bağış miktarına göre, preview olmadan)
            const currentPercentage = Math.min(100, (currentValue / Math.max(1, limit)) * 100);
            
            // Fill bar'ı güncelle
            if (fillBar) {
              fillBar.style.width = currentPercentage + '%';
            }
            
            // Yüzde değerini güncelle (preview olmadan, sadece gerçek bağış miktarına göre)
            if (percentageElement) {
              percentageElement.textContent = currentPercentage.toFixed(1) + '%';
              // Yüzde değerinin renk değişimini kontrol et (%50'den fazlaysa beyaz)
              if (currentPercentage >= 50) {
                percentageElement.classList.add('on-fill');
              } else {
                percentageElement.classList.remove('on-fill');
              }
            }
            
            // Miktarı güncelle
            if (amountElement && WDPApp.utils && WDPApp.utils.formatCurrency) {
              amountElement.textContent = WDPApp.utils.formatCurrency(currentValue);
            }
            
            // Custom price input'unu da temizle (eğer varsa)
            const form = container.closest('.wdp-modal, .wdp-donation-form')?.querySelector('form');
            if (form) {
              const customPriceInput = form.querySelector('input[name="custom_price"]');
              if (customPriceInput) {
                customPriceInput.value = '';
                // Preview'ı sıfırlamak için progress bar modülünü çağır (yüzde değerini de günceller)
                if (WDPApp.progressBar && WDPApp.progressBar.updatePreview) {
                  WDPApp.progressBar.updatePreview(container, currentValue, limit, 0);
                }
              }
            }
            
            safeLog("Progress bar reset after cart item removal - percentage:", currentPercentage.toFixed(1) + '%');
          });
        } else {
          safeLog("Error removing cart item:", data.message || "Unknown error", data);
          button.disabled = false;
          button.style.opacity = "1";
          button.style.cursor = "pointer";
          
          // Show error message to user
          if (WDPApp.alerts && WDPApp.alerts.show) {
            WDPApp.alerts.show([data.message || "Ürün sepetten kaldırılamadı"], {
              type: 'error',
              title: 'Hata'
            });
          }
        }
      } catch (error) {
        safeLog("Error in remove cart item request:", error);
        button.disabled = false;
        button.style.opacity = "1";
        button.style.cursor = "pointer";
      }
    };

    // Handler'ı successScreen'e bağla ve kaydet
    successScreen.addEventListener("click", handler);
    successScreen._removeCartItemHandler = handler;
    
    // Debug: Kaç buton bulundu
    const removeButtons = successScreen.querySelectorAll(".wdp-remove-cart-item");
    safeLog("setupRemoveCartItemButtons: Found", removeButtons.length, "remove buttons");
  }

  function setupContinueShoppingButton(form) {
    const continueShoppingBtn = form.querySelector(".wdp-continue-shopping");
    if (continueShoppingBtn) {
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
              form.innerHTML = originalContent;
              if (WDPApp.form && WDPApp.form.setup) {
                WDPApp.form.setup(form);
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
                // Form reset edildikten sonra progress bar'ı başlat
                requestAnimationFrame(() => {
                  WDPApp.progressBar.setup(progressBarContainer);
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
    }
  }

  function triggerSideCartUpdates() {
    // Bu fonksiyon, side cart eklentilerinin kendi güncelleme olaylarını tetiklemek için kullanılır.
    // Örneğin: jQuery(document.body).trigger('xoo_wsc_cart_updated');
    // Farklı side cart eklentileri için farklı tetikleme olayları gerekebilir.
  }

  function updateCartCountElements(cartCount) {
    // Sepet sayısını gösteren tüm elementleri bul
    const cartCountElements = document.querySelectorAll(".wdp-cart-count");

    // Her bir elementi güncelle
    cartCountElements.forEach((element) => {
      element.textContent = cartCount;
    });
  }

  function saveSideCartElements() {
    state.sideCartElements = [];
  }

  function fetchCartContents() {
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
          if (data.success) {
            resolve(data.items);
          } else {
            safeLog("Error fetching cart contents:", data.message);
            reject(data.message);
          }
        })
        .catch((error) => {
          safeLog("Error in AJAX request for cart contents:", error);
          reject(error);
        });
    });
  }

  function fixCartItemStyles() {
    // Tüm sepet öğelerini bul
    const cartItems = document.querySelectorAll(".wdp-mini-cart-item");

    cartItems.forEach((item) => {
      // Ana container için stiller
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "flex-start";
      item.style.width = "100%";
      item.style.boxSizing = "border-box";
      item.style.padding = "12px 16px";
      item.style.borderBottom = "1px solid #eee";

      // Sol taraf için stiller
      const infoElement = item.querySelector(".wdp-mini-cart-item-info");
      if (infoElement) {
        infoElement.style.flex = "1";
        infoElement.style.textAlign = "left";
        infoElement.style.paddingRight = "10px";
        infoElement.style.minWidth = "0";
        infoElement.style.maxWidth = "70%";
        infoElement.style.boxSizing = "border-box";
        infoElement.style.display = "block";
      }

      // Sağ taraf için stiller
      const detailsElement = item.querySelector(".wdp-mini-cart-item-details");
      if (detailsElement) {
        detailsElement.style.textAlign = "right";
        detailsElement.style.whiteSpace = "nowrap";
        detailsElement.style.fontWeight = "600";
        detailsElement.style.color = "#333";
        detailsElement.style.minWidth = "30%";
        detailsElement.style.boxSizing = "border-box";
        detailsElement.style.margin = "0";
        detailsElement.style.padding = "0";
        detailsElement.style.display = "flex";
        detailsElement.style.flexDirection = "column";
        detailsElement.style.alignItems = "flex-end";
        detailsElement.style.justifyContent = "flex-start";
      }
    });

    safeLog("Cart item styles fixed:", cartItems.length);
  }

  // Export
  WDPApp.cart = {
    fetchContents: fetchCartContents,
    showSideCarts,
    updateCountElements: updateCartCountElements,
    saveSideCartElements,
    createItemsHTML: createCartItemsHTML,
    setupContinueShoppingButton,
    setupRemoveCartItemButtons,
    updateWooCommerce: updateWooCommerceCart,
    fallbackUpdate: fallbackCartUpdate,
    triggerUpdates: triggerSideCartUpdates,
    fixItemStyles: fixCartItemStyles,
  };

})(window);

