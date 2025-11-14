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
        console.error("jQuery error:", jQueryError);
        // jQuery hatası durumunda fallback yöntemini kullan
        fallbackCartUpdate();
      }
    } else {
      // jQuery yoksa fallback yöntemini kullan
      fallbackCartUpdate();
    }
  }

  function fallbackCartUpdate() {
    console.log("Fallback cart update triggered");
    // Refresh the page as a last resort
    window.location.reload();
  }

  function showSideCarts() {
    console.log("Showing side carts");

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
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          elements.forEach((element) => {
            // Display none ise görünür yap
            if (window.getComputedStyle(element).display === "none") {
              console.log(`Making visible: ${selector}`);
              element.style.display = "";
            }

            // Opacity 0 ise görünür yap
            if (window.getComputedStyle(element).opacity === "0") {
              console.log(`Setting opacity: ${selector}`);
              element.style.opacity = "1";
            }

            // Visibility hidden ise görünür yap
            if (window.getComputedStyle(element).visibility === "hidden") {
              console.log(`Setting visibility: ${selector}`);
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
        console.error(`Error with selector ${selector}:`, e);
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
      console.error("Error checking theme-specific cart icons:", e);
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
      cartItems.forEach((item) => {
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
          quantity: item.quantity,
          parsedQuantity: itemQuantity,
          totalPrice: totalPrice,
          formattedPrice: formatPrice(totalPrice)
        });

        // Temiz HTML yapısı - CSS class'ları kullanıyor
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
            <div class="wdp-cart-item-price">${formatPrice(totalPrice)} TL</div>
          </td>
        </tr>
      </table>
      `;
      });
    } else {
      html += `<div class="wdp-cart-empty">Sepetinizde ürün bulunmuyor.</div>`;
    }

    html += `</div></div>
 <div class="wdp-success-buttons">
   <a href="${wdp_ajax.cart_url || "/sepet/"}" class="wdp-success-button wdp-view-cart">Sepeti Görüntüle</a>
   <a href="${wdp_ajax.checkout_url || "/odeme-sayfasi/"}" class="wdp-success-button wdp-checkout">Ödemeye Git</a>
   <a href="#" class="wdp-success-button wdp-continue-shopping wdp-new-donation">Yeni Bağış Ekle</a>
 </div>`;

    return html;
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
            console.error("Error parsing JSON response:", e);
            throw new Error("Invalid JSON response from server");
          }
        })
        .then((data) => {
          if (data.success) {
            resolve(data.items);
          } else {
            console.error("Error fetching cart contents:", data.message);
            reject(data.message);
          }
        })
        .catch((error) => {
          console.error("Error in AJAX request for cart contents:", error);
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

    console.log("Cart item styles fixed:", cartItems.length);
  }

  // Export
  WDPApp.cart = {
    fetchContents: fetchCartContents,
    showSideCarts,
    updateCountElements: updateCartCountElements,
    saveSideCartElements,
    createItemsHTML: createCartItemsHTML,
    setupContinueShoppingButton,
    updateWooCommerce: updateWooCommerceCart,
    fallbackUpdate: fallbackCartUpdate,
    triggerUpdates: triggerSideCartUpdates,
    fixItemStyles: fixCartItemStyles,
  };

})(window);

