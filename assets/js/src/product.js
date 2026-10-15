/**
 * @file product.js
 * Ürün bilgisi AJAX yükleme ve forma normalize veri aktarımı.
 * Dış API: WDPApp.product
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

  const PRODUCT_INFO_TIMEOUT_MS = 10000;

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

    let abortTimer = null;
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    if (controller) {
      abortTimer = window.setTimeout(function () {
        try {
          controller.abort();
        } catch (eAbort) {
          /* ignore */
        }
      }, PRODUCT_INFO_TIMEOUT_MS);
    }

    const fetchOpts = {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    };
    if (controller) {
      fetchOpts.signal = controller.signal;
    }

    const request = fetch(wdp_ajax.ajax_url, fetchOpts)
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
        if (abortTimer) {
          window.clearTimeout(abortTimer);
        }
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

    const fallbackMessage =
      message || "Ürün bilgileri alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
    const roots = getWdpProductRoots(id);
    if (!roots.length) {
      const fallback =
        document.getElementById("wdp-modal-" + id) ||
        document.getElementById("wdp-side-panel-" + id);
      if (fallback) {
        roots.push(fallback);
      }
    }

    let wrote = false;
    roots.forEach(function (root) {
      if (!root) {
        return;
      }
      const isOpen =
        root.classList.contains("show") || root.getAttribute("aria-hidden") === "false";
      if (!isOpen) {
        return;
      }
      const form = root.querySelector("form");
      if (form && WDPApp.formFeedback && typeof WDPApp.formFeedback.showFormError === "function") {
        WDPApp.formFeedback.showFormError(form, fallbackMessage);
        wrote = true;
        return;
      }
      const errorMsg = root.querySelector(".wdp-form-error");
      if (errorMsg) {
        errorMsg.textContent = fallbackMessage;
        errorMsg.style.display = "block";
        errorMsg.setAttribute("role", "alert");
        wrote = true;
      }
    });
    if (wrote) {
      announceStatus(fallbackMessage, "assertive");
    }
  }

  function isStaleProductInfoRequest(modal, openToken) {
    if (openToken == null || !modal) {
      return false;
    }
    const current = Number.parseInt(modal.dataset.wdpOpenToken || "0", 10) || 0;
    return current !== Number(openToken);
  }

  function getWdpProductRoots(productId) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id)) {
      return [];
    }
    const roots = [];
    const seen = new Set();
    const addRoot = (el) => {
      if (el && !seen.has(el)) {
        seen.add(el);
        roots.push(el);
      }
    };

    addRoot(document.getElementById("wdp-modal-" + id));
    addRoot(document.getElementById("wdp-side-panel-" + id));
    addRoot(document.getElementById("wdp-modal-" + id + "-direct"));

    return roots;
  }

  function refreshFormSnapshot(root) {
    if (!root || !state || !state.originalForms) {
      return;
    }
    const containerId = root.id || root.getAttribute("data-product-id");
    const form = root.querySelector("form");
    if (containerId && form) {
      state.originalForms.set(containerId, form.innerHTML);
    }
  }

  function mountSadakaDonationBlock(form, html) {
    if (!form || !html || typeof html !== "string") {
      return null;
    }
    const existing = form.querySelector("[data-wdp-sadaka-donation]");
    if (existing) {
      return existing;
    }

    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    const block = temp.querySelector("[data-wdp-sadaka-donation]");
    if (!block) {
      return null;
    }

    const main = form.querySelector(".wdp-side-panel-main");
    const footer = form.querySelector(".wdp-side-panel-footer-zone");
    if (main) {
      main.appendChild(block);
    } else if (footer) {
      form.insertBefore(block, footer);
    } else {
      const buttons = form.querySelector(".wdp-button-group");
      if (buttons) {
        form.insertBefore(block, buttons);
      } else {
        form.appendChild(block);
      }
    }

    return block;
  }

  function applySadakaDonation(root, form, data) {
    const enabled = !!(data && data.enable_sadaka_donation);
    const existing = form.querySelector("[data-wdp-sadaka-donation]");

    if (!enabled) {
      if (existing) {
        existing.remove();
      }
      if (root) {
        root.setAttribute("data-wdp-enable-sadaka", "0");
      }
      refreshFormSnapshot(root);
      return;
    }

    if (root) {
      root.setAttribute("data-wdp-enable-sadaka", "1");
    }

    let block = existing;
    if (!block && data.sadaka_block_html) {
      block = mountSadakaDonationBlock(form, data.sadaka_block_html);
    }

    if (block) {
      refreshFormSnapshot(root);
      if (WDPApp.form && typeof WDPApp.form.setup === "function") {
        WDPApp.form.setup(form);
      }
    }
  }

  function applyProductInfo(productId, data, options) {
    const id = Number.parseInt(productId, 10);
    if (!Number.isFinite(id) || !data || !data.success) {
      return;
    }

    const openToken = options && options.openToken;
    const modalHint = options && options.modal;

    const unitNumeric = Number.parseFloat(data.price);
    productPrices[id] = Number.isFinite(unitNumeric) ? unitNumeric : 0;

    const roots = getWdpProductRoots(id);
    if (!roots.length) {
      return;
    }

    roots.forEach((root) => {
      if (isStaleProductInfoRequest(modalHint || root, openToken)) {
        safeLog("Ignoring stale product info apply", { productId: id, openToken: openToken });
        return;
      }
      if (data.price !== undefined && data.price !== null && String(data.price) !== '') {
        root.setAttribute("data-wdp-unit-price", String(data.price));
      }

      const form = root.querySelector("form.wdp-donation-form-fields");
      if (!form) {
        return;
      }

      const customPriceRow = form.querySelector(
        ".wdp-custom-price-row:not(.wdp-sadaka-donation__amount), .wdp-custom-price-with-qty-row:not(.wdp-sadaka-donation__amount)"
      );
      const priceField =
        customPriceRow ||
        form.querySelector(".wdp-price-field.wdp-custom-price-field:not(.wdp-sadaka-donation__amount .wdp-price-field)") ||
        null;
      const showCustomPrice = !!(data.is_custom_price || customPriceRow);
      if (priceField) {
        safeLog("Özel fiyat durumu:", data.is_custom_price);
        if (showCustomPrice) {
          if (customPriceRow) {
            customPriceRow.style.display = "";
          } else {
            priceField.style.display = "flex";
          }

          const priceInput = (customPriceRow || priceField).querySelector('input[name="custom_price"]');
          if (priceInput) {
            const currencyEl = priceField.querySelector(".wdp-custom-price-currency");
            if (currencyEl && WDPApp.utils && typeof WDPApp.utils.getCurrencySymbol === "function") {
              currencyEl.textContent = WDPApp.utils.getCurrencySymbol();
            } else if (currencyEl && wdp_ajax.currency && wdp_ajax.currency.symbol) {
              currencyEl.textContent = wdp_ajax.currency.symbol;
            }

			const minPriceNumeric = Number.parseFloat((data.min_price || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
			const progressMinNumeric = Number.parseFloat((data.progress_min_price || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
			const isShareForm = !!form.querySelector('input[name="share_count"]');
			const isProgressForm =
			  !!form.classList.contains('wdp-has-progress-bar') ||
			  !!root.querySelector('.wdp-progress-bar-container') ||
			  !!data.enable_progress_bar;
			const basePriceNumeric = Number.parseFloat((data.price || data.regular_price || '').toString().trim().replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'));
			let resolvedMin = 0;
			if (Number.isFinite(minPriceNumeric) && minPriceNumeric > 0) {
			  resolvedMin = minPriceNumeric;
			} else if (isProgressForm && Number.isFinite(progressMinNumeric) && progressMinNumeric > 0) {
			  resolvedMin = progressMinNumeric;
			} else if ((isShareForm || isProgressForm) && Number.isFinite(basePriceNumeric) && basePriceNumeric > 0) {
			  resolvedMin = basePriceNumeric;
			}

			if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
			  priceInput.setAttribute("min", resolvedMin.toString());
			  priceInput.dataset.baseMin = resolvedMin.toString();
			} else {
			  priceInput.dataset.baseMin = '';
			  priceInput.removeAttribute("min");
			}

			priceInput.setAttribute("step", "0.01");
			priceInput.required = true;
			const userHasValue = String(priceInput.value || '').trim() !== '';
			const userIsTyping = document.activeElement === priceInput;
			// Progress form: tutarı otomatik doldurma — sadece min placeholder.
			if (!userHasValue && !userIsTyping) {
			  priceInput.value = "";
			  delete priceInput.dataset.wdpCustomUnit;
			  delete priceInput.dataset.wdpDefaultPrice;
			}
			const emptyPlaceholder = "";
			let nextPlaceholder = emptyPlaceholder;
			if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
			  nextPlaceholder = `min: ${formatPrice(resolvedMin)}`;
			}
			const currentPlaceholder = String(priceInput.placeholder || '').trim();
			if (currentPlaceholder !== nextPlaceholder) {
			  priceInput.placeholder = nextPlaceholder;
			}

			if (isProgressForm && priceInput && userHasValue) {
			  try {
				priceInput.dispatchEvent(new Event('input', { bubbles: true }));
			  } catch (_) { /* noop */ }
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

      applySadakaDonation(root, form, data);

      if (WDPApp.form && typeof WDPApp.form.updateLineTotals === "function") {
        WDPApp.form.updateLineTotals(form);
      }
    });
  }

  function fetchProductInfo(productId, options) {
    const opts = options || {};
    const openToken = opts.openToken;
    const modal = opts.modal || null;
    return getProductInfoData(productId)
      .then((data) => {
        if (isStaleProductInfoRequest(modal, openToken)) {
          safeLog("Ignoring stale product info response", { productId: productId, openToken: openToken });
          return;
        }
        if (!data) {
          displayProductInfoError(productId);
          return;
        }

        if (data.success) {
          applyProductInfo(productId, data, { openToken: openToken, modal: modal });
        } else {
          displayProductInfoError(productId, data.message);
        }
      })
      .catch((error) => {
        safeLog("Error fetching product info:", error);
        if (!isStaleProductInfoRequest(modal, openToken)) {
          displayProductInfoError(productId);
        }
      });
  }

  // Export
  WDPApp.product = {
    getData: getProductInfoData,
    fetch: fetchProductInfo,
    fetchProductInfo: fetchProductInfo,
    apply: applyProductInfo,
    displayError: displayProductInfoError,
  };

})(window);

