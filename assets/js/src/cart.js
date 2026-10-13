/**
 * @file cart.js
 * Sepet modülü köprüsü; alt modülleri WDPApp.cart altında birleştirir.
 * Dış API: WDPApp.cart
 * Resolve WDPApp.* at call time for modules loaded later in the stack.
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  WDPApp.cart = {
    fetchContents: function fetchCartContents() {
      const cartActions = WDPApp.cartActions || {};
      return typeof cartActions.fetchContents === 'function'
        ? cartActions.fetchContents()
        : Promise.reject(new Error('cartActions unavailable'));
    },
    showSideCarts: function showSideCarts() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.showSideCarts === 'function') {
        cartWoo.showSideCarts();
      }
    },
    updateCountElements: function updateCartCountElements(cartCount) {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.updateCountElements === 'function') {
        cartWoo.updateCountElements(cartCount);
      }
    },
    saveSideCartElements: function saveSideCartElements() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.saveSideCartElements === 'function') {
        cartWoo.saveSideCartElements();
      }
    },
    // Thin legacy stub: HTML string fallback for ensureModule / form ajax callers.
    createItemsHTML: function createCartItemsHTML(cartItems) {
      const cartUi = WDPApp.cartUi || {};
      return typeof cartUi.createItemsHTML === 'function' ? cartUi.createItemsHTML(cartItems) : '';
    },
    buildCartUiRoot: function buildCartUiRoot(cartItems) {
      const cartUi = WDPApp.cartUi || {};
      return typeof cartUi.buildCartUiRoot === 'function' ? cartUi.buildCartUiRoot(cartItems) : null;
    },
    renderItemsInto: function renderCartItemsInto(container, cartItems) {
      const cartUi = WDPApp.cartUi || {};
      if (typeof cartUi.renderItemsInto === 'function') {
        cartUi.renderItemsInto(container, cartItems);
      }
    },
    setupContinueShoppingButton: function setupContinueShoppingButton(form) {
      const cartActions = WDPApp.cartActions || {};
      if (typeof cartActions.setupContinueShoppingButton === 'function') {
        cartActions.setupContinueShoppingButton(form);
      }
    },
    setupRemoveCartItemButtons: function setupRemoveCartItemButtons(successView) {
      const cartActions = WDPApp.cartActions || {};
      if (typeof cartActions.setupRemoveCartItemButtons === 'function') {
        cartActions.setupRemoveCartItemButtons(successView);
      }
    },
    updateWooCommerce: function updateWooCommerceCart() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.updateWooCommerce === 'function') {
        cartWoo.updateWooCommerce();
      }
    },
    fallbackUpdate: function fallbackCartUpdate() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.fallbackUpdate === 'function') {
        cartWoo.fallbackUpdate();
      }
    },
    triggerUpdates: function triggerSideCartUpdates() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.triggerUpdates === 'function') {
        cartWoo.triggerUpdates();
      }
    },
    fixItemStyles: function fixCartItemStyles() {
      const cartWoo = WDPApp.cartWoo || {};
      if (typeof cartWoo.fixItemStyles === 'function') {
        cartWoo.fixItemStyles();
      }
    },
  };
})(window);
