/**
 * @file woo.js
 * WooCommerce sepet fragment yenileme ve cart olay entegrasyonu.
 * Dış API: WDPApp.cartWoo
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const state = WDPApp.state || {};
  const { safeLog } = utils;
  const wdp_ajax = window.wdp_ajax || {};
  const jQuery = window.jQuery || null;

  function getCartFragmentRetryDelayMs() {
    const t = WDPApp.constants && WDPApp.constants.TIMING;
    return t && typeof t.CART_FRAGMENT_RETRY_DELAY === "number" && t.CART_FRAGMENT_RETRY_DELAY >= 0
      ? t.CART_FRAGMENT_RETRY_DELAY
      : 800;
  }

  function updateWooCommerceCart() {
    // jQuery varsa WooCommerce'in kendi AJAX işlemini çağır
    if (typeof jQuery !== "undefined") {
      try {
        // WooCommerce'in kendi AJAX işlemini çağır
        jQuery(document.body).trigger("wc_fragment_refresh");

        // WooCommerce sepet fragmentlerini manuel olarak yenile (bir kez yeniden dene, sonra sayfa yenileme)
        if (typeof wc_add_to_cart_params !== "undefined") {
          const maxFragmentAttempts = 2;
          function requestRefreshedFragments(attempt) {
            jQuery.ajax({
              url: wc_add_to_cart_params.wc_ajax_url.toString().replace("%%endpoint%%", "get_refreshed_fragments"),
              type: "POST",
              data: {
                action: "woocommerce_get_refreshed_fragments",
              },
              success: (response) => {
                if (response && response.fragments) {
                  jQuery.each(response.fragments, (key, value) => {
                    jQuery(key).replaceWith(value);
                  });

                  if (typeof sessionStorage !== "undefined") {
                    sessionStorage.setItem("wc_fragments", JSON.stringify(response.fragments));
                    sessionStorage.setItem("wc_cart_hash", response.cart_hash);
                  }

                  jQuery(document.body).trigger("wc_fragments_refreshed");
                }

                setTimeout(() => {
                  showSideCarts();
                }, 300);
              },
              error: () => {
                if (attempt + 1 < maxFragmentAttempts) {
                  setTimeout(() => requestRefreshedFragments(attempt + 1), getCartFragmentRetryDelayMs());
                } else {
                  fallbackCartUpdate();
                }
              },
            });
          }
          requestRefreshedFragments(0);
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
    const flags = (wdp_ajax && wdp_ajax.flags) ? wdp_ajax.flags : {};
    // Varsayılan kapalı: sepete ekleme sonrası sayfa yenileme yok.
    // Açmak için filtre: wdp_reload_after_add_to_cart.
    if (flags.reload_after_add_to_cart) {
      window.location.reload();
      return;
    }
    showSideCarts();
  }

  function showSideCarts() {
    const flags = (wdp_ajax && wdp_ajax.flags) ? wdp_ajax.flags : {};
    if (!flags.side_cart_recovery) {
      return;
    }

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

    // Tema/eklenti stil çatışmalarını azaltmak için global !important CSS enjekte etmiyoruz.
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
  WDPApp.cartWoo = {
    updateWooCommerce: updateWooCommerceCart,
    showSideCarts: showSideCarts,
    fallbackUpdate: fallbackCartUpdate,
    triggerUpdates: triggerSideCartUpdates,
    updateCountElements: updateCartCountElements,
    saveSideCartElements: saveSideCartElements,
    fixItemStyles: fixCartItemStyles,
  };
})(window);
