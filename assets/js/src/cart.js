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
    ? WDPApp.utils.ensureModule('utils', ['formatPrice', 'formatCurrency', 'escapeHtml', 'getAjaxNonce', 'safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { formatPrice, formatCurrency, escapeHtml, getAjaxNonce, safeLog } = utils;
  const { originalForms, sideCartElements } = state;
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
              complete: () => {
                setTimeout(() => {
                  showSideCarts();
                }, 300);
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
    // Refresh the page as a last resort
    window.location.reload();
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

  function decodeHtmlEntities(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const raw = String(value);
    if (raw.indexOf('&') === -1) {
      return raw;
    }
    const textarea = document.createElement('textarea');
    textarea.innerHTML = raw;
    return textarea.value;
  }

  function parseAmount(value) {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'number') return value;
    const cleaned = String(value).trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
    return Number.parseFloat(cleaned);
  }

  function getButtonTexts() {
    const buttonTexts = (wdp_ajax && wdp_ajax.button_texts) ? wdp_ajax.button_texts : {};
    return {
      viewCartText: buttonTexts.success_view_cart || "Sepete Git",
      goCheckoutText: buttonTexts.success_go_checkout || "Bağışı Tamamla",
      newDonationText: buttonTexts.success_new_donation || "Bağış eklemeye devam edin",
    };
  }

  function getButtonIcons() {
    const icons = (wdp_ajax && wdp_ajax.button_icons) ? wdp_ajax.button_icons : {};
    return {
      cart: icons.cart || "",
      checkout: icons.checkout || "",
      continue: icons.continue || "",
    };
  }

  function fillSuccessButtonWithIcon(linkEl, iconHtml, label) {
    if (!linkEl) {
      return;
    }
    linkEl.textContent = "";
    const inner = document.createElement("span");
    inner.className = "wdp-btn__inner";
    if (iconHtml) {
      const iconHost = document.createElement("span");
      iconHost.className = "wdp-btn__icon-host";
      iconHost.innerHTML = iconHtml;
      inner.appendChild(iconHost);
    }
    const labelEl = document.createElement("span");
    labelEl.className = "wdp-btn__label";
    labelEl.textContent = label;
    inner.appendChild(labelEl);
    linkEl.appendChild(inner);
  }

  function computeCartSubtotal(cartItems) {
    let total = 0;
    if (!Array.isArray(cartItems)) {
      return total;
    }
    cartItems.forEach((item) => {
      const parsedTotal = parseAmount(item.line_total);
      if (Number.isFinite(parsedTotal)) {
        total += parsedTotal;
        return;
      }
      const parsedPrice = parseAmount(item.price);
      const itemPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
      const parsedQty = Number.parseInt(item.quantity, 10);
      const itemQuantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
      total += itemPrice * itemQuantity;
    });
    return total;
  }

  function getCurrencySymbolDecoded() {
    const raw = (wdp_ajax && wdp_ajax.currency && wdp_ajax.currency.symbol)
      ? wdp_ajax.currency.symbol
      : '₺';
    return decodeHtmlEntities(raw);
  }

  function formatSidePanelSubtotalAmount(cartItems) {
    const total = computeCartSubtotal(cartItems);
    if (typeof formatCurrency === 'function') {
      try {
        return formatCurrency(total, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      } catch (e) {
        /* fall through */
      }
    }
    return formatPrice(total) + ' ' + getCurrencySymbolDecoded();
  }

  function appendSidePanelSubtotal(container, cartItems) {
    if (!container) {
      return;
    }
    const row = document.createElement('div');
    row.className = 'wdp-side-panel-subtotal';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    const label = document.createElement('span');
    label.className = 'wdp-side-panel-subtotal__label';
    label.textContent = 'Ara toplam:';
    const value = document.createElement('span');
    value.className = 'wdp-side-panel-subtotal__value';
    value.textContent = formatSidePanelSubtotalAmount(cartItems);
    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  }

  function buildCartUiNode(cartItems, options = {}) {
    const root = document.createElement('div');
    if (options.inSidePanel) {
      root.className = 'wdp-side-panel-cart-layout';
    }

    const miniCart = document.createElement('div');
    miniCart.className = 'wdp-mini-cart';
    const header = document.createElement('div');
    header.className = 'wdp-mini-cart-header';
    const h4 = document.createElement('h4');
    h4.textContent = 'Bağış Sepetiniz';
    header.appendChild(h4);
    miniCart.appendChild(header);

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'wdp-mini-cart-items';

    if (cartItems && cartItems.length > 0) {
      const reversedItems = [...cartItems].reverse();
      reversedItems.forEach((item) => {
        const parsedPrice = parseAmount(item.price);
        const itemPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
        const parsedQty = Number.parseInt(item.quantity, 10);
        const itemQuantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
        const parsedTotal = parseAmount(item.line_total);
        const totalPrice = Number.isFinite(parsedTotal) ? parsedTotal : (itemPrice * itemQuantity);
        const priceDisplay = (item.price_plain && String(item.price_plain).trim() !== '')
          ? decodeHtmlEntities(item.price_plain)
          : (formatPrice(totalPrice) + ' ' + getCurrencySymbolDecoded());

        const table = document.createElement('table');
        table.className = 'wdp-cart-item-table';
        const row = document.createElement('tr');
        const infoCell = document.createElement('td');
        infoCell.className = 'wdp-cart-item-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'wdp-cart-item-name';
        nameDiv.textContent = item.product_name || item.name || 'Ürün';
        infoCell.appendChild(nameDiv);

        if (item.meta && item.meta.length > 0) {
          const metaWrap = document.createElement('div');
          metaWrap.className = 'wdp-cart-item-meta';
          item.meta.forEach((meta) => {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'wdp-cart-item-meta-item';
            metaDiv.textContent = `${meta.key || ''}: ${meta.value || ''}`;
            metaWrap.appendChild(metaDiv);
          });
          infoCell.appendChild(metaWrap);
        }

        const detailsCell = document.createElement('td');
        detailsCell.className = 'wdp-cart-item-details';
        const qtyDiv = document.createElement('div');
        qtyDiv.className = 'wdp-cart-item-quantity';
        qtyDiv.textContent = `${itemQuantity} adet`;
        const priceDiv = document.createElement('div');
        priceDiv.className = 'wdp-cart-item-price';
        priceDiv.textContent = priceDisplay;
        detailsCell.appendChild(qtyDiv);
        detailsCell.appendChild(priceDiv);

        const removeCell = document.createElement('td');
        removeCell.className = 'wdp-cart-item-remove';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wdp-remove-cart-item';
        removeBtn.setAttribute('aria-label', 'Sepetten Kaldır');
        removeBtn.setAttribute('data-cart-item-key', String(item.key || ''));
        const removeSpan = document.createElement('span');
        removeSpan.setAttribute('aria-hidden', 'true');
        removeSpan.textContent = '×';
        removeBtn.appendChild(removeSpan);
        removeCell.appendChild(removeBtn);

        row.appendChild(infoCell);
        row.appendChild(detailsCell);
        row.appendChild(removeCell);
        table.appendChild(row);
        itemsWrap.appendChild(table);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'wdp-cart-empty';
      empty.textContent = 'Sepetinizde ürün bulunmuyor.';
      itemsWrap.appendChild(empty);
    }

    miniCart.appendChild(itemsWrap);
    root.appendChild(miniCart);

    const { viewCartText, goCheckoutText, newDonationText } = getButtonTexts();
    const { cart: iconCart, checkout: iconCheckout, continue: iconContinue } = getButtonIcons();
    const btnWrap = document.createElement('div');
    btnWrap.className = 'wdp-success-buttons';

    const checkout = document.createElement('a');
    checkout.className = 'wdp-success-button wdp-checkout wdp-success-button--primary';
    checkout.href = wdp_ajax.checkout_url || "/odeme-sayfasi/";
    fillSuccessButtonWithIcon(checkout, iconCheckout, goCheckoutText);

    const viewCart = document.createElement('a');
    viewCart.className = 'wdp-success-button wdp-view-cart wdp-success-button--outline';
    viewCart.href = wdp_ajax.cart_url || "/sepet/";
    fillSuccessButtonWithIcon(viewCart, iconCart, viewCartText);

    const newDonation = document.createElement('a');
    newDonation.className = 'wdp-success-button wdp-continue-shopping wdp-new-donation wdp-success-button--ghost';
    newDonation.href = '#';
    fillSuccessButtonWithIcon(newDonation, iconContinue, newDonationText);

    if (options.inSidePanel) {
      btnWrap.appendChild(checkout);
      btnWrap.appendChild(viewCart);
      btnWrap.appendChild(newDonation);
    } else {
      btnWrap.appendChild(viewCart);
      btnWrap.appendChild(checkout);
      btnWrap.appendChild(newDonation);
    }

    if (options.inSidePanel) {
      const footer = document.createElement('div');
      footer.className = 'wdp-side-panel-cart-footer';
      appendSidePanelSubtotal(footer, cartItems);
      footer.appendChild(btnWrap);
      root.appendChild(footer);
    } else {
      root.appendChild(btnWrap);
    }
    return root;
  }

  function renderCartItemsInto(container, cartItems) {
    if (!container) return;
    const inSidePanel = !!(container.closest && container.closest('.wdp-side-panel'));
    container.innerHTML = '';
    container.appendChild(buildCartUiNode(Array.isArray(cartItems) ? cartItems : [], { inSidePanel }));
  }

  function patchSuccessScreenCartUi(successScreen, cartItems) {
    if (!successScreen) return;
    const inSidePanel = !!(successScreen.closest && successScreen.closest('.wdp-side-panel'));
    const freshUi = buildCartUiNode(Array.isArray(cartItems) ? cartItems : [], { inSidePanel });
    const cartStack = successScreen.querySelector('.wdp-success-cart-stack');
    const newLayout = freshUi.querySelector('.wdp-side-panel-cart-layout');
    const oldLayout = successScreen.querySelector('.wdp-side-panel-cart-layout');
    if (inSidePanel && cartStack && newLayout) {
      if (oldLayout) {
        oldLayout.replaceWith(newLayout);
      } else {
        cartStack.innerHTML = '';
        cartStack.appendChild(newLayout);
      }
      return;
    }
    const newMini = freshUi.querySelector('.wdp-mini-cart');
    const newFooter = freshUi.querySelector('.wdp-side-panel-cart-footer');
    const newButtons = freshUi.querySelector('.wdp-success-buttons');
    const oldMini = successScreen.querySelector('.wdp-mini-cart');
    const oldFooter = successScreen.querySelector('.wdp-side-panel-cart-footer');
    const oldButtons = successScreen.querySelector('.wdp-success-buttons');
    if (oldMini && newMini) {
      oldMini.replaceWith(newMini);
    }
    if (inSidePanel && oldFooter && newFooter) {
      oldFooter.replaceWith(newFooter);
    } else if (oldButtons && newButtons) {
      oldButtons.replaceWith(newButtons);
    }
  }

  /**
   * Güvenli DOM kökü: innerHTML/string serileştirme olmadan sepet UI (XSS yüzeyini daraltır).
   *
   * @param {Array} cartItems Sepet öğeleri.
   * @returns {HTMLElement}
   */
  function buildCartUiRoot(cartItems) {
    return buildCartUiNode(Array.isArray(cartItems) ? cartItems : []);
  }

  // Backward-compatible API: returns HTML for legacy call sites.
  function createCartItemsHTML(cartItems) {
    const wrapper = document.createElement('div');
    wrapper.appendChild(buildCartUiRoot(cartItems));
    return wrapper.innerHTML;
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
        const isSecurityError = responseCode === "security_error" || responseMessage.includes("güvenlik");

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
          
          patchSuccessScreenCartUi(successScreen, cartItems);
          const hostForm = successScreen.closest('form');
          if (hostForm) {
            setupContinueShoppingButton(hostForm);
          }
          // Event delegation'ı yeni buton referansları için yeniden bağla
          setupRemoveCartItemButtons(successScreen);
          safeLog("Cart updated, new items count:", cartItems.length);

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
      continueShoppingBtn.dataset.wdpContinueBound = '1';
    });
    setupCheckoutMetaLink(form);
  }

  /**
   * Optional Meta InitiateCheckout when user clicks success ".wdp-checkout" (setting default off).
   *
   * @param {HTMLFormElement|null} form Host form (holds _wdpLastMetaCartLine after add).
   * @returns {void}
   */
  function setupCheckoutMetaLink(form) {
    if (!form) {
      return;
    }
    const checkout = form.querySelector('a.wdp-checkout');
    if (!checkout || checkout.dataset.wdpMetaIcBound === '1') {
      return;
    }
    checkout.addEventListener('click', (ev) => {
      const metaCfg = wdp_ajax && wdp_ajax.meta ? wdp_ajax.meta : {};
      if (!metaCfg.enabled || !metaCfg.initiateCheckout || !window.WDPMetaTracking || typeof window.WDPMetaTracking.trackInitiateCheckoutDonation !== 'function') {
        return;
      }
      const line = form._wdpLastMetaCartLine;
      if (!line || !line.product_id) {
        return;
      }
      try {
        ev.preventDefault();
        const pid = String(line.product_id);
        const qty = parseInt(line.quantity, 10) || 1;
        const icParams = {
          content_ids: [pid],
          content_name: String(line.product_name || '').slice(0, 500),
          content_type: 'product',
          contents: [{ id: pid, quantity: qty, item_price: parseFloat(line.item_price) || 0 }],
          value: parseFloat(line.line_total) || 0,
          currency: line.currency || (wdp_ajax.currency && wdp_ajax.currency.code) || 'TRY',
          num_items: qty,
        };
        const uniqueInput = form.querySelector('input[name="unique_submission_key"]');
        const usk = uniqueInput && uniqueInput.value ? String(uniqueInput.value) : '';
        const dedupeKey = 'wdp_meta_ic_link_' + pid + '_' + (usk || 'nokey');
        const eventID = 'wdp_ic_link_' + pid + '_' + String(Date.now());
        window.WDPMetaTracking.trackInitiateCheckoutDonation({
          params: icParams,
          eventID: eventID,
          dedupeKey: dedupeKey,
        });
      } catch (err) {
        safeLog('Meta checkout link:', err);
      }
      window.location.href = checkout.href || (wdp_ajax.checkout_url || '/');
    });
    checkout.dataset.wdpMetaIcBound = '1';
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
    buildCartUiRoot,
    renderItemsInto: renderCartItemsInto,
    setupContinueShoppingButton,
    setupRemoveCartItemButtons,
    updateWooCommerce: updateWooCommerceCart,
    fallbackUpdate: fallbackCartUpdate,
    triggerUpdates: triggerSideCartUpdates,
    fixItemStyles: fixCartItemStyles,
  };

})(window);

