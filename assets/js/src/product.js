/**
 * Product - Ürün bilgileri yönetimi
 * getProductInfoData, fetchProductInfo, applyProductInfo, displayProductInfoError
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'getAjaxNonce', 'formatCurrency', 'formatPrice', 'announceStatus'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog, getAjaxNonce, formatCurrency, formatPrice, announceStatus } = utils;
  const { productPrices, productDataCache, productInfoRequests } = state;
  const wdp_ajax = window.wdp_ajax || {};

  function getProductInfoData(productId) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id)) {
      return Promise.resolve(null);
    }

    if (productDataCache.has(id)) {
      safeLog("Using cached product info", { productId: id });
      return Promise.resolve(productDataCache.get(id));
    }

    if (productInfoRequests.has(id)) {
      return productInfoRequests.get(id);
    }

    const formData = new FormData();
    formData.append("action", "wdp_get_product_info");
    formData.append("product_id", id);
    formData.append("security", getAjaxNonce("get_product_info"));

    const request = fetch(wdp_ajax.ajax_url, {
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
          return null;
        }
      })
      .then((data) => {
        if (data && data.success) {
          productDataCache.set(id, data);
        }
        return data;
      })
      .catch((error) => {
        safeLog("Error in AJAX request for product info:", error);
        return null;
      })
      .finally(() => {
        productInfoRequests.delete(id);
      });

    productInfoRequests.set(id, request);
    return request;
  }

  function displayProductInfoError(productId, message) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id)) {
      return;
    }

    const modal = document.getElementById("wdp-modal-" + id);
    if (!modal) {
      return;
    }

    const errorMsg = modal.querySelector(".wdp-form-error");
    if (errorMsg) {
      const fallbackMessage = message || "Ürün bilgileri alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
      errorMsg.textContent = fallbackMessage;
      errorMsg.style.display = "block";
      announceStatus(fallbackMessage, 'assertive');
    }
  }

  function getWdpProductRoots(productId) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id)) {
      return [];
    }
    const roots = [];
    const modal = document.getElementById("wdp-modal-" + id);
    if (modal) {
      roots.push(modal);
    }
    const direct = document.getElementById("wdp-modal-" + id + "-direct");
    if (direct) {
      roots.push(direct);
    }
    return roots;
  }

  function applyProductInfo(productId, data) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id) || !data || !data.success) {
      return;
    }

    const unitNumeric = Number.parseFloat(data.price);
    productPrices[id] = Number.isFinite(unitNumeric) ? unitNumeric : 0;

    const roots = getWdpProductRoots(id);
    if (!roots.length) {
      return;
    }

    roots.forEach((root) => {
      if (data.price !== undefined && data.price !== null && String(data.price) !== '') {
        root.setAttribute("data-wdp-unit-price", String(data.price));
      }

      const form = root.querySelector("form.wdp-donation-form-fields");
      if (!form) {
        return;
      }

      const priceField = form.querySelector(".wdp-price-field.wdp-custom-price-field") || form.querySelector(".wdp-price-field");
      if (priceField) {
        safeLog("Özel fiyat durumu:", data.is_custom_price);
        if (data.is_custom_price) {
          priceField.style.display = "flex";

          const priceInput = priceField.querySelector('input[name="custom_price"]');
          if (priceInput) {
            const currencyEl = priceField.querySelector(".wdp-custom-price-currency");
            if (currencyEl && wdp_ajax.currency && wdp_ajax.currency.symbol) {
              currencyEl.textContent = wdp_ajax.currency.symbol;
            }

            const minPriceNumeric = Number.parseFloat((data.min_price || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
            const basePriceNumeric = Number.parseFloat((data.price || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
            const resolvedMin = Number.isFinite(minPriceNumeric) && minPriceNumeric > 0 ? minPriceNumeric : basePriceNumeric;

            if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
              priceInput.setAttribute("min", resolvedMin.toString());
              priceInput.dataset.baseMin = resolvedMin.toString();
            } else {
              priceInput.dataset.baseMin = '';
              priceInput.removeAttribute("min");
            }

            priceInput.setAttribute("step", "0.01");
            priceInput.required = true;
            priceInput.value = "";
            delete priceInput.dataset.wdpCustomUnit;
            const emptyPlaceholder = (wdp_ajax.strings && wdp_ajax.strings.custom_price_placeholder_empty) ? wdp_ajax.strings.custom_price_placeholder_empty : "Bağış tutarı *";
            if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
              priceInput.placeholder = `min: ${formatPrice(resolvedMin)}`;
            } else if (data.min_price) {
              priceInput.placeholder = `min: ${data.min_price}`;
            } else {
              priceInput.placeholder = emptyPlaceholder;
            }
          }
        } else if (priceField) {
          priceField.style.display = "none";
        }
      }

      if (data.is_multiple_shares) {
        const quantityRow = form.querySelector(".wdp-product-quantity");
        if (quantityRow) {
          quantityRow.style.display = "none";
        }
        if (WDPApp.shareholder && WDPApp.shareholder.setup) {
          WDPApp.shareholder.setup(root, id);
        }
      } else {
        const quantityRow = form.querySelector(".wdp-product-quantity");
        if (quantityRow) {
          quantityRow.style.display = "flex";
        }
      }

      if (WDPApp.form && typeof WDPApp.form.updateLineTotals === "function") {
        WDPApp.form.updateLineTotals(form);
      }
    });
  }

  function fetchProductInfo(productId) {
    return getProductInfoData(productId)
      .then((data) => {
        if (!data) {
          displayProductInfoError(productId);
          return;
        }

        if (data.success) {
          applyProductInfo(productId, data);
        } else {
          displayProductInfoError(productId, data.message);
        }
      })
      .catch((error) => {
        safeLog("Error fetching product info:", error);
        displayProductInfoError(productId);
      });
  }

  // Export
  WDPApp.product = {
    getData: getProductInfoData,
    fetch: fetchProductInfo,
    apply: applyProductInfo,
    displayError: displayProductInfoError,
  };

})(window);

