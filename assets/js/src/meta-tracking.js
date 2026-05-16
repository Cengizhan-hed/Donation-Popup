/**
 * Meta Pixel companion for WDP — uses existing window.fbq only (no duplicate PageView/init by default).
 *
 * @package WooCommerce\Donation_Popup
 */
(function (window) {
  'use strict';

  var queue = [];
  var pollTimer = null;
  var pollStart = 0;
  var MAX_WAIT_MS = 5000;
  var POLL_MS = 50;
  var onceMemory = Object.create(null);
  /** Synchronous ViewContent dedupe (survives when sessionStorage is unavailable or sessionSet fails). */
  var viewContentSentMemory = Object.create(null);

  function getAjax() {
    return window.wdp_ajax || {};
  }

  function getMetaCfg() {
    var ajax = getAjax();
    return ajax.meta || {};
  }

  function isDebug() {
    return !!getMetaCfg().debug;
  }

  function debugLog() {
    if (!isDebug()) {
      return;
    }
    try {
      var args = ['[WDP Meta]'].concat(Array.prototype.slice.call(arguments));
      window.console.log.apply(window.console, args);
    } catch (e) {}
  }

  function hasFbq() {
    return typeof window.fbq === 'function';
  }

  function flushQueue() {
    if (!hasFbq()) {
      return;
    }
    while (queue.length) {
      var job = queue.shift();
      try {
        window.fbq.apply(window, job);
      } catch (err) {}
    }
  }

  function stopPoll() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function ensurePoll() {
    if (pollTimer !== null || hasFbq()) {
      return;
    }
    pollStart = Date.now();
    pollTimer = window.setInterval(function () {
      if (hasFbq()) {
        stopPoll();
        flushQueue();
      } else if (Date.now() - pollStart > MAX_WAIT_MS) {
        stopPoll();
        queue.length = 0;
      }
    }, POLL_MS);
  }

  function enqueueFbqCall(argsArray) {
    try {
      if (hasFbq()) {
        window.fbq.apply(window, argsArray);
      } else {
        queue.push(argsArray);
        ensurePoll();
      }
    } catch (e) {}
  }

  window.addEventListener('load', function () {
    flushQueue();
  });

  function track(eventName, params, options) {
    if (!eventName || typeof eventName !== 'string') {
      return;
    }
    var args = ['track', eventName, params && typeof params === 'object' ? params : {}];
    if (options && typeof options === 'object' && Object.keys(options).length) {
      args.push(options);
    }
    enqueueFbqCall(args);
  }

  function trackCustom(eventName, params, options) {
    if (!eventName || typeof eventName !== 'string') {
      return;
    }
    var args = ['trackCustom', eventName, params && typeof params === 'object' ? params : {}];
    if (options && typeof options === 'object' && Object.keys(options).length) {
      args.push(options);
    }
    enqueueFbqCall(args);
  }

  /**
   * Run callback at most once per page session for a string key.
   *
   * @param {string} key Dedupe key.
   * @param {function(): void} callback Callback.
   * @returns {boolean} True if callback ran.
   */
  function once(key, callback) {
    if (!key || typeof key !== 'string') {
      return false;
    }
    if (onceMemory[key]) {
      return false;
    }
    onceMemory[key] = 1;
    try {
      if (typeof callback === 'function') {
        callback();
      }
    } catch (e) {}
    return true;
  }

  function sessionGet(key) {
    try {
      return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function sessionSet(key, val) {
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(key, val);
      }
    } catch (e) {}
  }

  function localGet(key) {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function localSet(key, val) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {}
  }

  function roundMoney(n) {
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.round(n * 100) / 100;
  }

  function buildViewContentParams(opts) {
    var pid = String(opts.productId || '');
    var qty = parseInt(opts.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      qty = 1;
    }
    var unit = roundMoney(parseFloat(opts.itemPrice));
    var value = roundMoney(typeof opts.value === 'number' ? opts.value : unit * qty);
    var currency = (opts.currency || getAjax().currency || {}).code || 'TRY';
    return {
      content_ids: [pid],
      content_name: String(opts.contentName || '').slice(0, 500),
      content_type: 'product',
      currency: currency,
      value: value,
      contents: [{ id: pid, quantity: qty, item_price: unit > 0 ? unit : roundMoney(value / Math.max(1, qty)) }],
      source: 'wdp_donation_plugin',
      form_type: opts.formType === 'inline' ? 'inline' : 'popup',
    };
  }

  /**
   * Stable session + memory key: one ViewContent per product per form type per page session.
   *
   * @param {string|number} productId Product ID.
   * @param {string} formType popup|inline
   * @returns {string} Empty if invalid product id.
   */
  function viewContentDedupeKey(productId, formType) {
    var n = parseInt(String(productId), 10);
    if (!Number.isFinite(n) || n < 1) {
      return '';
    }
    var ft = formType === 'inline' ? 'inline' : 'popup';
    return 'wdp_meta_view_content_sent_' + String(n) + '_' + ft;
  }

  /**
   * ViewContent for donation modal or inline form (deduped per tab session per product + form type).
   *
   * @param {object} opts Options.
   */
  function trackViewContentDonation(opts) {
    var cfg = getMetaCfg();
    if (!cfg.enabled || !cfg.viewContent) {
      return;
    }
    var productId = opts && opts.productId;
    if (!productId) {
      return;
    }
    var formType = opts.formType === 'inline' ? 'inline' : 'popup';
    var sk = viewContentDedupeKey(productId, formType);
    if (!sk) {
      return;
    }
    if (viewContentSentMemory[sk]) {
      debugLog('ViewContent skip (page memory)', sk);
      return;
    }
    if (sessionGet(sk) === '1') {
      viewContentSentMemory[sk] = 1;
      debugLog('ViewContent skip (sessionStorage)', sk);
      return;
    }
    viewContentSentMemory[sk] = 1;
    var params = buildViewContentParams(opts);
    var eventId = 'wdp_vc_' + String(parseInt(String(productId), 10) || 0) + '_' + formType + '_' + String(Date.now());
    debugLog('ViewContent', params, eventId);
    track('ViewContent', params, { eventID: eventId });
    sessionSet(sk, '1');
    if (cfg.customDebug) {
      var dbgId = 'wdp_dbg_form_open_' + String(parseInt(String(productId), 10) || 0) + '_' + String(Date.now());
      debugLog('DonationFormOpen (custom)', params, dbgId);
      trackCustom('DonationFormOpen', params, { eventID: dbgId });
    }
  }

  function addToCartDedupeKey(cartItemKey, uniqueSubmissionKey, productId) {
    if (cartItemKey && String(cartItemKey).length) {
      return 'wdp_meta_atc_' + String(cartItemKey);
    }
    if (uniqueSubmissionKey && productId) {
      return 'wdp_meta_atc_usk_' + String(productId) + '_' + String(uniqueSubmissionKey);
    }
    return '';
  }

  /**
   * AddToCart after successful WDP AJAX add (deduped).
   *
   * @param {object} opts Options.
   */
  function trackAddToCartDonation(opts) {
    var cfg = getMetaCfg();
    if (!cfg.enabled || !cfg.addToCart) {
      return;
    }
    var line = opts.metaCartLine || {};
    var productId = line.product_id || opts.productId;
    if (!productId) {
      return;
    }
    var qty = parseInt(line.quantity != null ? line.quantity : opts.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      qty = 1;
    }
    var lineTotal = roundMoney(parseFloat(line.line_total != null ? line.line_total : opts.lineTotal));
    var unit = roundMoney(parseFloat(line.item_price != null ? line.item_price : lineTotal / Math.max(1, qty)));
    var currency = line.currency || (getAjax().currency || {}).code || 'TRY';
    var dkey = addToCartDedupeKey(opts.cartItemKey, opts.uniqueSubmissionKey, productId);
    if (dkey && sessionGet(dkey) === '1') {
      debugLog('AddToCart skip dedupe', dkey);
      return;
    }
    var pidStr = String(productId);
    var params = {
      content_ids: [pidStr],
      content_name: String(line.product_name || opts.contentName || '').slice(0, 500),
      content_type: 'product',
      contents: [{ id: pidStr, quantity: qty, item_price: unit }],
      value: lineTotal,
      currency: currency,
      num_items: qty,
      source: 'wdp_donation_plugin',
      form_type: opts.formType === 'inline' ? 'inline' : 'popup',
    };
    if (opts.donationType && typeof opts.donationType === 'string' && opts.donationType.length < 120) {
      params.donation_type = opts.donationType;
    }
    if (opts.animalType && typeof opts.animalType === 'string' && opts.animalType.length < 120) {
      params.animal_type = opts.animalType;
    }
    var ts = String(Date.now());
    var eventId =
      'wdp_add_to_cart_' +
      pidStr +
      '_' +
      String(qty) +
      '_' +
      (opts.cartItemKey ? String(opts.cartItemKey) : ts);
    debugLog('AddToCart', { value: params.value, order: productId }, eventId);
    track('AddToCart', params, { eventID: eventId });
    if (dkey) {
      sessionSet(dkey, '1');
    }
  }

  /**
   * Optional InitiateCheckout from plugin (default off in settings).
   *
   * @param {object} opts Standard Meta fields + eventID.
   */
  function trackInitiateCheckoutDonation(opts) {
    var cfg = getMetaCfg();
    if (!cfg.enabled || !cfg.initiateCheckout) {
      return;
    }
    var dedupe = opts && opts.dedupeKey ? String(opts.dedupeKey) : '';
    if (dedupe && sessionGet(dedupe) === '1') {
      debugLog('InitiateCheckout skip dedupe', dedupe);
      return;
    }
    var params = opts && typeof opts.params === 'object' ? opts.params : {};
    var eventId = opts && opts.eventID ? String(opts.eventID) : 'wdp_ic_' + String(Date.now());
    debugLog('InitiateCheckout', params, eventId);
    track('InitiateCheckout', params, { eventID: eventId });
    if (dedupe) {
      sessionSet(dedupe, '1');
    }
  }

  function tryAutoPurchase() {
    var cfg = window.wdpMetaPurchase;
    if (!cfg || !cfg.params || !cfg.eventID) {
      return;
    }
    var oid = cfg.orderId != null ? String(cfg.orderId) : '';
    if (!oid) {
      return;
    }
    var key = 'wdp_meta_purchase_sent_' + oid;
    if (localGet(key) === '1') {
      if (isDebug() || cfg.debug) {
        debugLog('Purchase skip localStorage', key);
      }
      return;
    }
    if (cfg.runPurchase === false) {
      return;
    }
    if (isDebug() || cfg.debug) {
      try {
        window.console.log('[WDP Meta]', 'Purchase', { order_id: oid, eventID: cfg.eventID });
      } catch (eLog) {}
    }
    track('Purchase', cfg.params, { eventID: cfg.eventID });
    localSet(key, '1');
  }

  window.WDPMetaTracking = {
    track: track,
    trackCustom: trackCustom,
    once: once,
    flushQueue: flushQueue,
    trackViewContentDonation: trackViewContentDonation,
    trackAddToCartDonation: trackAddToCartDonation,
    trackInitiateCheckoutDonation: trackInitiateCheckoutDonation,
    tryAutoPurchase: tryAutoPurchase,
    _buildViewContentParams: buildViewContentParams,
  };

  function onReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      window.setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  onReady(function () {
    tryAutoPurchase();
  });
})(window);
