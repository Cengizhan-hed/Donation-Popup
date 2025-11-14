/**
 * Product - Ürün bilgileri yönetimi
 * getProductInfoData, fetchProductInfo, applyProductInfo, displayProductInfoError
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  
  // Use centralized module dependency helper
  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'getAjaxNonce', 'formatCurrency', 'announceStatus'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog, getAjaxNonce, formatCurrency, announceStatus } = utils;
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

  function applyProductInfo(productId, data) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id) || !data || !data.success) {
      return;
    }

    productPrices[id] = Number.parseFloat(data.price);

    const modal = document.getElementById("wdp-modal-" + id);
    if (!modal) {
      return;
    }

    const priceField = modal.querySelector(".wdp-price-field");
    if (priceField) {
      safeLog("Özel fiyat durumu:", data.is_custom_price);
      if (data.is_custom_price) {
        priceField.style.display = "flex";

        const priceInput = priceField.querySelector('input[name="custom_price"]');
        if (priceInput) {
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
          if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
            priceInput.placeholder = `Min: ${formatCurrency(resolvedMin)}`;
          } else if (data.min_price) {
            priceInput.placeholder = `Min: ${data.min_price}`;
          } else {
            priceInput.placeholder = "Bağış tutarı";
          }
        }
      } else {
        priceField.style.display = "none";
      }
    }

    if (data.is_multiple_shares) {
      const quantityRow = modal.querySelector(".wdp-product-quantity");
      if (quantityRow) {
        quantityRow.style.display = "none";
      }
      if (WDPApp.shareholder && WDPApp.shareholder.setup) {
        WDPApp.shareholder.setup(modal, id);
      }
    } else {
      const quantityRow = modal.querySelector(".wdp-product-quantity");
      if (quantityRow) {
        quantityRow.style.display = "flex";
      }
    }
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

