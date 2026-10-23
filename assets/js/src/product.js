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
    ? WDPApp.utils.ensureModule('utils', ['safeLog', 'getAjaxNonce', 'formatCurrency', 'formatPrice', 'formatMinPlaceholder', 'applyCurrencyShellPosition', 'announceStatus', 'isValidProductId', 'productInfoErrorMessage', 'showToast', 'refreshWdpAjaxNonces', 'classifyAjaxFailure'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };
  
  const stateCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('state', [])
    : { module: WDPApp.state || {}, isValid: false, missingMethods: [] };
  
  const utils = utilsCheck.module;
  const state = stateCheck.module;
  const { safeLog, getAjaxNonce, formatCurrency, formatPrice, formatMinPlaceholder, applyCurrencyShellPosition, announceStatus, showToast } = utils;
  const refreshWdpAjaxNonces = typeof utils.refreshWdpAjaxNonces === 'function' ? utils.refreshWdpAjaxNonces : null;
  const classifyAjaxFailure = typeof utils.classifyAjaxFailure === 'function' ? utils.classifyAjaxFailure : function () { return ''; };
  const isValidProductId = typeof utils.isValidProductId === 'function'
    ? utils.isValidProductId
    : function (value) {
        const n = Number.parseInt(value, 10);
        return Number.isFinite(n) && n > 0;
      };
  const productInfoErrorMessage = typeof utils.productInfoErrorMessage === 'function'
    ? utils.productInfoErrorMessage
    : function (data) {
        if (data && typeof data.message === 'string' && data.message.trim()) {
          return data.message.trim();
        }
        if (data && data.data && typeof data.data.message === 'string') {
          return data.data.message.trim();
        }
        return '';
      };
  const { productPrices, productDataCache, productInfoRequests } = state;
  const wdp_ajax = window.wdp_ajax || {};

  const PRODUCT_INFO_TIMEOUT_MS = 10000;

  function getProductInfoData(productId) {
    const id = Number.parseInt(productId, 10);
    if (!isValidProductId(id)) {
      return Promise.resolve(null);
    }

    if (productDataCache.has(id)) {
      safeLog("Using cached product info", { productId: id });
      return Promise.resolve(productDataCache.get(id));
    }

    if (productInfoRequests.has(id)) {
      return productInfoRequests.get(id);
    }

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

    function sendProductInfo(allowNonceRetry) {
      const formData = new FormData();
      formData.append("action", "wdp_get_product_info");
      formData.append("product_id", id);
      formData.append("security", getAjaxNonce("get_product_info"));
      const fetchOpts = {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      };
      if (controller) {
        fetchOpts.signal = controller.signal;
      }
      return fetch(wdp_ajax.ajax_url, fetchOpts).then((response) => {
        return response.text().then((text) => {
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch (e) {
            safeLog("Error parsing JSON response:", e);
            parsed = null;
          }
          const kind = classifyAjaxFailure(response.status, parsed);
          if (kind === "nonce" && allowNonceRetry && refreshWdpAjaxNonces) {
            return refreshWdpAjaxNonces({ force: true }).then(function () {
              return sendProductInfo(false);
            });
          }
          if (!response.ok) {
            const msg = productInfoErrorMessage(parsed);
            if (kind === "rate" || kind === "id" || (msg && /geçersiz ürün|ürün bulunamadı|çok fazla istek/i.test(msg))) {
              return parsed || { success: false, message: msg, code: kind || "error" };
            }
            const err = new Error(msg || ("HTTP error! Status: " + response.status));
            err.status = response.status;
            throw err;
          }
          return parsed;
        });
      });
    }

    const request = sendProductInfo(true)
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
      return;
    }
    if (typeof showToast === "function") {
      showToast({
        type: "error",
        title: (wdp_ajax.strings && wdp_ajax.strings.error) || "Bir hata oluştu",
        message: fallbackMessage,
        duration: 6000,
      });
      return;
    }
    announceStatus(fallbackMessage, "assertive");
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
			const priceShell = priceField.querySelector('.wdp-custom-price-shell');
			if (priceShell && typeof applyCurrencyShellPosition === 'function') {
			  applyCurrencyShellPosition(priceShell);
			}

			const parseAmt = (WDPApp.utils && typeof WDPApp.utils.parseMoney === 'function')
				? WDPApp.utils.parseMoney
				: function (v) { return Number.parseFloat(v); };
			const minPriceNumeric = parseAmt(data.min_price || '');
			const progressMinNumeric = parseAmt(data.progress_min_price || '');
			const isShareForm = !!form.querySelector('input[name="share_count"]');
			const isProgressForm =
			  !!form.classList.contains('wdp-has-progress-bar') ||
			  !!root.querySelector('.wdp-progress-bar-container') ||
			  !!data.enable_progress_bar;
			const basePriceNumeric = parseAmt(data.price || data.regular_price || '');
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
			const fromServer = typeof data.custom_price_placeholder === 'string'
			  ? String(data.custom_price_placeholder).trim()
			  : '';
			if (fromServer && /^min:\s/i.test(fromServer)) {
			  nextPlaceholder = fromServer;
			} else if (Number.isFinite(resolvedMin) && resolvedMin > 0) {
			  nextPlaceholder = typeof formatMinPlaceholder === 'function'
			    ? formatMinPlaceholder(resolvedMin)
			    : `min: ${formatPrice(resolvedMin)}`;
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
        // Satırlar zaten varsa setup soft-sync yapar (wipe yok). Yoksa ilk kurulum.
        // force:true yalnız adet/ürün yapısı gerçekten değişince — capture→restore.
        if (WDPApp.shareholder && typeof WDPApp.shareholder.setup === "function") {
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
          const serverMsg = productInfoErrorMessage(data);
          displayProductInfoError(
            productId,
            serverMsg && /geçersiz ürün|ürün bulunamadı|alınamadı|yenileyip|çok fazla istek/i.test(serverMsg)
              ? serverMsg
              : undefined
          );
        }
      })
      .catch((error) => {
        safeLog("Error fetching product info:", error);
        if (!isStaleProductInfoRequest(modal, openToken)) {
          displayProductInfoError(
            productId,
            (error && error.message) || productInfoErrorMessage(error && error.payload)
          );
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

