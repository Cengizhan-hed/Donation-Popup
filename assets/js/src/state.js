/**
 * State - Durum yönetimi
 * Global state ve getter/setter'lar
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  // Private state variables
  let isProcessing = false;
  let activeModal = null;
  let originalForms = new Map();
  const productPrices = {};
  const productDataCache = new Map();
  const productInfoRequests = new Map();
  let listenersInitialized = false;
  let lastFocusedElement = null;
  let focusTrapCleanup = null;
  let shareholdersResizeBound = false;
  var sideCartElements = [];

  // Public state object with getters/setters
  const state = {
    get isProcessing() {
      return isProcessing
    },
    set isProcessing(value) {
      isProcessing = Boolean(value)
    },
    get activeModal() {
      return activeModal
    },
    set activeModal(value) {
      activeModal = value
    },
    get originalForms() {
      return originalForms
    },
    get productPrices() {
      return productPrices
    },
    get productDataCache() {
      return productDataCache
    },
    get productInfoRequests() {
      return productInfoRequests
    },
    get sideCartElements() {
      return sideCartElements
    },
    set sideCartElements(value) {
      sideCartElements = Array.isArray(value) ? value : []
    },
    get listenersInitialized() {
      return listenersInitialized
    },
    set listenersInitialized(value) {
      listenersInitialized = Boolean(value)
    },
    get lastFocusedElement() {
      return lastFocusedElement
    },
    set lastFocusedElement(value) {
      lastFocusedElement = value || null
    },
    get focusTrapCleanup() {
      return focusTrapCleanup
    },
    set focusTrapCleanup(fn) {
      focusTrapCleanup = typeof fn === 'function' ? fn : null
    },
    get shareholdersResizeBound() {
      return shareholdersResizeBound
    },
    set shareholdersResizeBound(value) {
      shareholdersResizeBound = Boolean(value)
    },
  }

  WDPApp.state = state

  console.log('✅ WDP: state.js loaded');
  console.log('📦 WDP: WDPApp.state exported:', !!WDPApp.state);

})(window);
