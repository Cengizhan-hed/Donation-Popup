/**
 * @file ui.js
 * Mini sepet sayacı ve sepet özet DOM güncellemeleri.
 * Dış API: WDPApp.cartUi
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const { formatPrice, formatCurrency, escapeHtml } = utils;
  const wdp_ajax = window.wdp_ajax || {};

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

  function appendCartSubtotal(container, cartItems, className) {
    if (!container) {
      return;
    }
    const base = className || 'wdp-mini-cart-subtotal';
    const row = document.createElement('div');
    row.className = base;
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    const label = document.createElement('span');
    label.className = base + '__label';
    label.textContent = 'Toplam';
    const value = document.createElement('span');
    value.className = base + '__value';
    value.textContent = formatSidePanelSubtotalAmount(cartItems);
    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  }

  function appendSidePanelSubtotal(container, cartItems) {
    appendCartSubtotal(container, cartItems, 'wdp-side-panel-subtotal');
  }

  function buildCartUiNode(cartItems, options = {}) {
    const root = document.createElement('div');
    if (options.inSidePanel) {
      root.className = 'wdp-side-panel-cart-layout';
    }

    const list = Array.isArray(cartItems) ? cartItems : [];
    const itemCount = list.length;

    const miniCart = document.createElement('div');
    miniCart.className = 'wdp-mini-cart';
    const header = document.createElement('div');
    header.className = 'wdp-mini-cart-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'wdp-mini-cart-header__title';
    const h4 = document.createElement('h4');
    h4.textContent = 'Bağış Sepetiniz';
    titleWrap.appendChild(h4);
    if (itemCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'wdp-mini-cart-count';
      badge.textContent = String(itemCount);
      badge.setAttribute('aria-label', itemCount + ' ürün');
      titleWrap.appendChild(badge);
    }
    header.appendChild(titleWrap);
    miniCart.appendChild(header);

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'wdp-mini-cart-items';

    if (itemCount > 0) {
      const reversedItems = [...list].reverse();
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

        const isSadakaLine = !!(item.is_sadaka_donation || item.line_kind === 'sadaka');
        const card = document.createElement('article');
        card.className = isSadakaLine ? 'wdp-cart-item wdp-cart-item--sadaka' : 'wdp-cart-item';

        const infoCell = document.createElement('div');
        infoCell.className = 'wdp-cart-item-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = isSadakaLine ? 'wdp-cart-item-name wdp-cart-item-name--sadaka' : 'wdp-cart-item-name';
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

        const detailsCell = document.createElement('div');
        detailsCell.className = 'wdp-cart-item-details';
        const priceDiv = document.createElement('div');
        priceDiv.className = isSadakaLine ? 'wdp-cart-item-price wdp-cart-item-price--sadaka' : 'wdp-cart-item-price';
        priceDiv.textContent = priceDisplay;
        const qtyDiv = document.createElement('div');
        qtyDiv.className = 'wdp-cart-item-quantity';
        qtyDiv.textContent = `${itemQuantity} adet`;
        detailsCell.appendChild(priceDiv);
        detailsCell.appendChild(qtyDiv);

        const removeCell = document.createElement('div');
        removeCell.className = 'wdp-cart-item-remove';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wdp-remove-cart-item';
        removeBtn.setAttribute('aria-label', 'Sepetten Kaldır');
        removeBtn.setAttribute('data-cart-item-key', String(item.key || ''));
        const removeIconHost = document.createElement('span');
        removeIconHost.className = 'wdp-remove-cart-item__icon';
        removeIconHost.setAttribute('aria-hidden', 'true');
        removeIconHost.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">'
          + '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"/>'
          + '</svg>';
        removeBtn.appendChild(removeIconHost);
        removeCell.appendChild(removeBtn);

        card.appendChild(infoCell);
        card.appendChild(detailsCell);
        card.appendChild(removeCell);
        itemsWrap.appendChild(card);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'wdp-cart-empty';
      const emptyTitle = document.createElement('span');
      emptyTitle.className = 'wdp-cart-empty__title';
      emptyTitle.textContent = 'Sepetiniz boş';
      const emptyHint = document.createElement('span');
      emptyHint.className = 'wdp-cart-empty__hint';
      emptyHint.textContent = 'Bağış ekleyerek buradan ödeme adımına geçebilirsiniz.';
      empty.appendChild(emptyTitle);
      empty.appendChild(emptyHint);
      itemsWrap.appendChild(empty);
    }

    miniCart.appendChild(itemsWrap);
    if (!options.inSidePanel && itemCount > 0) {
      appendCartSubtotal(miniCart, list, 'wdp-mini-cart-subtotal');
    }
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
      btnWrap.appendChild(checkout);
      btnWrap.appendChild(viewCart);
      btnWrap.appendChild(newDonation);
    }

    if (options.inSidePanel) {
      const footer = document.createElement('div');
      footer.className = 'wdp-side-panel-cart-footer';
      appendSidePanelSubtotal(footer, list);
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

  // Thin legacy stub: HTML string for ensureModule / form ajax fallbacks only.
  function createCartItemsHTML(cartItems) {
    const wrapper = document.createElement('div');
    wrapper.appendChild(buildCartUiRoot(cartItems));
    return wrapper.innerHTML;
  }
  WDPApp.cartUi = {
    buildCartUiNode: buildCartUiNode,
    buildCartUiRoot: buildCartUiRoot,
    renderItemsInto: renderCartItemsInto,
    patchSuccessScreenCartUi: patchSuccessScreenCartUi,
    createItemsHTML: createCartItemsHTML,
    computeCartSubtotal: computeCartSubtotal,
    formatSidePanelSubtotalAmount: formatSidePanelSubtotalAmount,
  };
})(window);
