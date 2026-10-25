/**
 * @file utils.js
 * Ortak yardımcılar: fiyat formatlama, HTML escape, nonce, odak ve güvenli log.
 * Dış API: WDPApp.utils
 */

(function(window) {
  'use strict';

  // Global namespace initialization
  const WDPApp = window.WDPApp || (window.WDPApp = {});
  if (!WDPApp.i18n || typeof WDPApp.i18n.__ !== 'function') {
    WDPApp.i18n = {
      __: function (msg) { return msg == null ? '' : String(msg); },
      _x: function (msg) { return msg == null ? '' : String(msg); },
      sprintf: function (fmt) { return String(fmt == null ? '' : fmt); },
    };
  }
  const jQuery = window.jQuery || null;

  // WooCommerce parametreleri için güvenli kontrol
  if (typeof wc_add_to_cart_params === 'undefined') {
    var wc_add_to_cart_params = window.wc_add_to_cart_params || {
      ajax_url: '',
      wc_ajax_url: '/?wc-ajax=%%endpoint%%',
      i18n_view_cart: 'View cart',
      cart_url: '',
      is_cart: false,
      is_single_product: true,
      cart_redirect_after_add: false,
    };
  }

  // Plugin parametreleri için güvenli kontrol (tek tanım)
  let wdp_ajax;
  if (typeof window.wdp_ajax !== 'undefined') {
    wdp_ajax = window.wdp_ajax;
  } else {
    wdp_ajax = {
      ajax_url: window.location.origin + '/wp-admin/admin-ajax.php',
      nonce: '',
      version: '10.0',
      cart_url: '',
      checkout_url: '',
      debug: false,
      nonces: {},
      strings: {},
    };
    // Global'e de kaydet (diğer modüller için)
    window.wdp_ajax = wdp_ajax;
  }

  if (!wdp_ajax.nonces) {
    wdp_ajax.nonces = {};
  }

  WDPApp.config = { ajax: wdp_ajax };
  window.WDP = window.WDP || {};
  window.WDP.app = WDPApp;

  // Burada export yok, export dosyanın sonunda yapılacak
  // console.log burada çok erken, dosyanın sonunda log yapılacak

  /**
   * WooCommerce sepet/ödeme adresi (wdp_ajax veya AJAX yanıtı). Sabit slug yok.
   *
   * @param {'checkout'|'cart'} kind
   * @param {object} [data]
   * @returns {string}
   */
  function resolveStorefrontUrl(kind, data) {
    const key = kind === 'cart' ? 'cart_url' : 'checkout_url'
    const pick = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : '')
    const fromData = data && typeof data === 'object' ? pick(data[key]) : ''
    const ajax = (typeof window !== 'undefined' && window.wdp_ajax) ? window.wdp_ajax : (wdp_ajax || {})
    return fromData || pick(ajax[key])
  }

  /**
   * Woo ürün ID: yalnız pozitif tam sayı. 0 / NaN / boş geçersizdir.
   *
   * @param {*} value
   * @returns {boolean}
   */
  function isValidProductId(value) {
    const id = Number.parseInt(value, 10)
    return Number.isFinite(id) && id > 0
  }

  /**
   * AJAX güvenlik/ürün hata türü (kişisel veri yok).
   * @param {number} status HTTP
   * @param {*} data JSON gövde
   * @returns {'nonce'|'rate'|'capability'|'origin'|'id'|''}
   */
  function classifyAjaxFailure(status, data) {
    const st = Number(status) || 0;
    const inner = data && typeof data === 'object' ? (data.data && typeof data.data === 'object' ? data.data : data) : null;
    const code = inner && inner.code !== undefined ? inner.code : (data && data.code);
    const msg = String((inner && inner.message) || (data && data.message) || '').toLowerCase();
    if (st === 429 || code === 'rate_limit' || /çok fazla istek/.test(msg)) {
      return 'rate';
    }
    if (code === 'capability' || /yetkiniz/.test(msg)) {
      return 'capability';
    }
    if (code === 'origin' || /istek kaynağı/.test(msg)) {
      return 'origin';
    }
    if (/geçersiz ürün|ürün bulunamadı/.test(msg)) {
      return 'id';
    }
    if (st === 403 || code === 'nonce' || /güvenlik|nonce/.test(msg)) {
      return 'nonce';
    }
    return '';
  }

  /**
   * get_product_info hata gövdesi (düz message veya wp_send_json_error data.message).
   *
   * @param {*} data
   * @returns {string}
   */
  function productInfoErrorMessage(data) {
    if (!data || typeof data !== 'object') {
      return ''
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim()
    }
    const inner = data.data
    if (inner && typeof inner === 'object' && typeof inner.message === 'string' && inner.message.trim()) {
      return inner.message.trim()
    }
    if (typeof inner === 'string' && inner.trim()) {
      return inner.trim()
    }
    return ''
  }

  function decodeHtmlEntities(value) {
    if (value === null || value === undefined) {
      return ''
    }
    const str = String(value)
    if (str.indexOf('&') === -1) {
      return str
    }
    const textarea = document.createElement('textarea')
    textarea.innerHTML = str
    return textarea.value
  }

  /**
   * WooCommerce sayı ayarları (wdp_ajax.currency). Sabit locale/TRY yok.
   */
  function getCurrencyConfig() {
    const c = (wdp_ajax && wdp_ajax.currency) ? wdp_ajax.currency : {}
    const decimals = Number.isFinite(Number(c.decimals)) ? Number(c.decimals) : 2
    return {
      code: c.code || '',
      symbol: decodeHtmlEntities(c.symbol || ''),
      decimals: decimals,
      thousandSeparator: (c.thousandSeparator !== undefined && c.thousandSeparator !== null) ? String(c.thousandSeparator) : ',',
      decimalSeparator: (c.decimalSeparator !== undefined && c.decimalSeparator !== null) ? String(c.decimalSeparator) : '.',
      symbolPosition: c.symbolPosition || 'left',
    }
  }

  function getCurrencySymbol() {
    return getCurrencyConfig().symbol
  }

  function resolveCurrencyConfig(override) {
    const base = getCurrencyConfig()
    if (!override || typeof override !== 'object') {
      return base
    }
    const decimals = Number.isFinite(Number(override.decimals)) ? Number(override.decimals) : base.decimals
    return {
      code: override.code != null ? String(override.code) : base.code,
      symbol: override.symbol != null ? decodeHtmlEntities(String(override.symbol)) : base.symbol,
      decimals: decimals < 0 ? 0 : decimals,
      thousandSeparator: override.thousandSeparator != null ? String(override.thousandSeparator) : base.thousandSeparator,
      decimalSeparator: override.decimalSeparator != null ? String(override.decimalSeparator) : base.decimalSeparator,
      symbolPosition: override.symbolPosition != null ? String(override.symbolPosition) : base.symbolPosition,
    }
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Yapıştırma / serbest giriş: sembol, harf ve boşlukları at (₺1.250, 1 250).
   *
   * @param {string} raw
   * @param {object} [cfg]
   * @returns {string}
   */
  function normalizeAmountInput(raw, cfg) {
    const c = resolveCurrencyConfig(cfg)
    let s = String(raw == null ? '' : raw).trim()
    if (s === '') {
      return ''
    }
    s = s.replace(/[\s\u00A0\u202F\u2009\u2007\u2060]+/g, '')
    const keep = [c.thousandSeparator, c.decimalSeparator, '.', ',']
      .filter((ch) => ch)
      .map(escapeRegExp)
      .join('')
    return s.replace(new RegExp(`[^\\d${keep}\\-]`, 'g'), '')
  }

  function isValidThousandGrouping(intPart, sep) {
    if (!sep || String(intPart).indexOf(sep) === -1) {
      return false
    }
    const parts = String(intPart).split(sep)
    if (parts.length < 2) {
      return false
    }
    if (!/^\d{1,3}$/.test(parts[0])) {
      return false
    }
    for (let i = 1; i < parts.length; i += 1) {
      if (!/^\d{3}$/.test(parts[i])) {
        return false
      }
    }
    return true
  }

  function getNoFractionAmountMessage(cfg) {
    const c = resolveCurrencyConfig(cfg)
    const example = formatMoney(10, Object.assign({}, c, { symbol: '' })) || '10'
    const strings = (wdp_ajax && wdp_ajax.strings) ? wdp_ajax.strings : {}
    const tpl = strings.amount_no_fraction || WDPApp.i18n.__('Fractional amounts are not allowed on this site, e.g. %s', 'woo-donation-popup')
    return tpl.replace('%s', example)
  }

  function getAmbiguousAmountMessage(cfg) {
    const c = resolveCurrencyConfig(cfg)
    const example = formatMoney(10, Object.assign({}, c, { symbol: '' })) || '10'
    const strings = (wdp_ajax && wdp_ajax.strings) ? wdp_ajax.strings : {}
    if (c.decimals <= 0) {
      return getNoFractionAmountMessage(c)
    }
    const tpl = strings.amount_ambiguous_format || WDPApp.i18n.__('Please enter the amount in this format, e.g. %s', 'woo-donation-popup')
    return tpl.replace('%s', example)
  }

  function donorAmountResult(ok, amount, status, error, cfg) {
    let msg = error || ''
    if (!ok && !msg) {
      msg = status === 'ambiguous'
        ? getAmbiguousAmountMessage(cfg)
        : ((wdp_ajax && wdp_ajax.strings && wdp_ajax.strings.invalid_price) || WDPApp.i18n.__('Invalid price value.', 'woo-donation-popup'))
    }
    return { ok: !!ok, amount: ok ? amount : NaN, status: status, error: msg }
  }

  function applyDecimalPart(intPart, frac, decimals, cfg) {
    if (!intPart || !frac || !/^\d+$/.test(intPart) || !/^\d+$/.test(frac)) {
      return donorAmountResult(false, NaN, 'invalid', '', cfg)
    }
    if (decimals <= 0) {
      if (/^0+$/.test(frac)) {
        const n = Number.parseFloat(intPart)
        return Number.isFinite(n) ? donorAmountResult(true, n, 'ok', '', cfg) : donorAmountResult(false, NaN, 'invalid', '', cfg)
      }
      return donorAmountResult(false, NaN, 'ambiguous', getNoFractionAmountMessage(cfg), cfg)
    }
    if (frac.length > decimals) {
      return donorAmountResult(false, NaN, 'ambiguous', '', cfg)
    }
    const n = Number.parseFloat(intPart + '.' + frac)
    return Number.isFinite(n) ? donorAmountResult(true, n, 'ok', '', cfg) : donorAmountResult(false, NaN, 'invalid', '', cfg)
  }

  function parseGroupedAmount(s, decimals, cfg) {
    const seps = []
    for (let i = 0; i < s.length; i += 1) {
      if (s.charAt(i) === '.' || s.charAt(i) === ',') {
        seps.push({ i: i, ch: s.charAt(i) })
      }
    }
    if (!seps.length) {
      if (/^\d+$/.test(s)) {
        const n = Number.parseFloat(s)
        return Number.isFinite(n) ? donorAmountResult(true, n, 'ok', '', cfg) : donorAmountResult(false, NaN, 'invalid', '', cfg)
      }
      return donorAmountResult(false, NaN, 'invalid', '', cfg)
    }
    const last = seps[seps.length - 1]
    const beforeLast = s.slice(0, last.i)
    const afterLast = s.slice(last.i + 1)
    const chars = []
    for (let k = 0; k < seps.length; k += 1) {
      if (chars.indexOf(seps[k].ch) === -1) {
        chars.push(seps[k].ch)
      }
    }
    if (chars.length === 1) {
      const ch = chars[0]
      if (isValidThousandGrouping(s, ch)) {
        const n = Number.parseFloat(s.split(ch).join(''))
        return Number.isFinite(n) ? donorAmountResult(true, n, 'ok', '', cfg) : donorAmountResult(false, NaN, 'invalid', '', cfg)
      }
      if (seps.length === 1) {
        return applyDecimalPart(beforeLast, afterLast, decimals, cfg)
      }
      if (isValidThousandGrouping(beforeLast, ch)) {
        return applyDecimalPart(beforeLast.split(ch).join(''), afterLast, decimals, cfg)
      }
      return donorAmountResult(false, NaN, 'ambiguous', '', cfg)
    }
    let lastCount = 0
    for (let k = 0; k < seps.length; k += 1) {
      if (seps[k].ch === last.ch) {
        lastCount += 1
      }
    }
    if (lastCount !== 1) {
      return donorAmountResult(false, NaN, 'invalid', '', cfg)
    }
    const other = chars[0] === last.ch ? chars[1] : chars[0]
    if (beforeLast.indexOf(other) !== -1) {
      if (!isValidThousandGrouping(beforeLast, other)) {
        return donorAmountResult(false, NaN, 'ambiguous', '', cfg)
      }
      return applyDecimalPart(beforeLast.split(other).join(''), afterLast, decimals, cfg)
    }
    return applyDecimalPart(beforeLast, afterLast, decimals, cfg)
  }

  /**
   * Bağışçı tutarı (PHP WDP_Utils::parse_donor_amount ile aynı kural).
   * Geçerli binlik gruplama (1–3 + her grup 3) → binlik; gruplamayan son
   * ayırıcı → ondalık adayı. 0 dp: kesir tümü sıfırsa tam sayı, değilse uyarı
   * (yuvarlama/100× yok). N>0: kesir ≤ N kabul, > N uyarı.
   *
   * @param {string|number} raw
   * @param {object} [cfg]
   * @returns {{ok:boolean,amount:number,status:string,error:string}}
   */
  function parseMoneyDetailed(raw, cfg) {
    if (raw === null || raw === undefined || raw === '') {
      return donorAmountResult(false, NaN, 'invalid', '', cfg)
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || raw < 0) {
        return donorAmountResult(false, NaN, 'invalid', '', cfg)
      }
      return donorAmountResult(true, raw, 'ok', '', cfg)
    }
    const c = resolveCurrencyConfig(cfg)
    let s = normalizeAmountInput(raw, c)
    if (s === '' || s === '-' || s === '.' || s === ',' || s === c.thousandSeparator || s === c.decimalSeparator) {
      return donorAmountResult(false, NaN, 'invalid', '', c)
    }
    if (s.charAt(0) === '-' || s.indexOf('-') !== -1) {
      return donorAmountResult(false, NaN, 'invalid', '', c)
    }
    return parseGroupedAmount(s, c.decimals, c)
  }

  /**
   * Kullanıcı girişini Woo ondalık/binlik ayırıcısına göre ham sayıya çevirir.
   * Belirsiz/uyumsuz → NaN (sessiz 100× yok). İkinci argüman test için mağaza ayarı.
   */
  function parseMoney(raw, cfg) {
    const r = parseMoneyDetailed(raw, cfg)
    return r.status === 'ok' && Number.isFinite(r.amount) ? r.amount : NaN
  }

  /** Sunucuya giden tutar: binlik yok, mağaza ondalık ayırıcısı (aynı kural). */
  function formatAmountForSubmit(amount, cfg) {
    const c = resolveCurrencyConfig(cfg)
    const n = typeof amount === 'number' ? amount : parseMoney(amount, c)
    if (!Number.isFinite(n) || n <= 0) {
      return ''
    }
    const decimals = Math.max(0, Number(c.decimals) || 0)
    if (decimals <= 0) {
      return String(Math.round(n))
    }
    const fixed = Math.abs(n).toFixed(decimals)
    const parts = fixed.split('.')
    const dec = c.decimalSeparator == null ? '.' : String(c.decimalSeparator)
    return (n < 0 ? '-' : '') + parts[0] + dec + (parts[1] || '')
  }

  /**
   * Ham sayıyı Woo ayarlarıyla biçimler (Intl yok).
   */
  function formatMoney(amount, options) {
    const cfg = Object.assign({}, getCurrencyConfig(), options || {})
    const n = typeof amount === 'number' ? amount : parseMoney(amount)
    if (!Number.isFinite(n)) {
      return formatMoney(0, cfg)
    }
    const neg = n < 0
    const abs = Math.abs(n)
    const decimals = Number.isFinite(Number(cfg.decimals)) ? Math.max(0, Number(cfg.decimals)) : 2
    const fixed = abs.toFixed(decimals)
    const parts = fixed.split('.')
    const intRaw = parts[0]
    const frac = parts[1] || ''
    const thousand = cfg.thousandSeparator == null ? ',' : String(cfg.thousandSeparator)
    const decimal = cfg.decimalSeparator == null ? '.' : String(cfg.decimalSeparator)
    const intFmt = thousand ? intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, thousand) : intRaw
    const num = decimals > 0 ? `${intFmt}${decimal}${frac}` : intFmt
    const signed = neg ? `-${num}` : num
    const symbol = decodeHtmlEntities(cfg.symbol || '')
    const pos = String(cfg.symbolPosition || 'left')
    if (!symbol) {
      return signed
    }
    if (pos === 'left') {
      return `${symbol}${signed}`
    }
    if (pos === 'left_space') {
      return `${symbol} ${signed}`
    }
    if (pos === 'right') {
      return `${signed}${symbol}`
    }
    return `${signed} ${symbol}`
  }

  function formatPrice(price) {
    if (price === null || price === undefined || price === '') {
      return '0'
    }
    const n = typeof price === 'number' ? price : parseMoney(price)
    if (!Number.isFinite(n)) {
      return '0'
    }
    const safe = n < 0 ? 0 : n
    const formatted = formatMoney(safe, { symbol: '' })
    return formatted || '0'
  }

  /** PHP WDP_Utils::format_min_placeholder ile aynı metin (sembol yok, ondalık kırpılmaz). */
  function formatMinPlaceholder(amount) {
    const n = typeof amount === 'number' ? amount : parseMoney(amount)
    if (!Number.isFinite(n) || n <= 0) {
      return ''
    }
    const formatted = formatPrice(n)
    return formatted ? ('min: ' + formatted) : ''
  }

  function applyCurrencyShellPosition(shell) {
    if (!shell || !shell.classList) {
      return
    }
    const cfg = getCurrencyConfig()
    const allowed = ['left', 'left_space', 'right', 'right_space']
    const pos = allowed.indexOf(String(cfg.symbolPosition || '')) >= 0
      ? String(cfg.symbolPosition)
      : 'left'
    allowed.forEach((p) => {
      shell.classList.remove('wdp-currency-pos-' + p)
    })
    shell.classList.add('wdp-currency-pos-' + pos)
  }

  function formatCurrency(amount, options) {
    const n = typeof amount === 'number' ? amount : parseMoney(amount)
    if (!Number.isFinite(n)) {
      return formatMoney(0, options)
    }
    return formatMoney(n, options)
  }

  // Güvenli HTML çıktısı için yardımcı fonksiyon
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return ''
    }

    const str = typeof value === 'string' ? value : String(value)

    return str.replace(/[&<>"']/g, (char) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }

      return entities[char] || char
    })
  }

  // Güvenli console.log fonksiyonu
  function safeLog(message, data = null) {
    // Sadece debug modu açıksa logla (production'da kapalı)
    if (wdp_ajax && wdp_ajax.debug) {
      if (data) {
        console.log('WDP:', message, data)
      } else {
        console.log('WDP:', message)
      }
    }
  }

  // AJAX nonce'larını güvenli şekilde almak için yardımcı fonksiyon
  function getAjaxNonce(actionKey) {
    if (wdp_ajax && wdp_ajax.nonces && wdp_ajax.nonces[actionKey]) {
      return wdp_ajax.nonces[actionKey]
    }

    if (wdp_ajax && typeof wdp_ajax.nonce !== "undefined") {
      return wdp_ajax.nonce
    }

    return ""
  }

  /**
   * Sunucudan gelen nonce haritasını window.wdp_ajax ile birleştirir (sayfa uzun süre açık kaldığında gerekli).
   */
  function mergeWdpAjaxNonces(nonces) {
    if (!nonces || typeof window.wdp_ajax === "undefined") {
      return;
    }
    window.wdp_ajax.nonces = Object.assign({}, window.wdp_ajax.nonces || {}, nonces);
  }

  const WDP_NONCE_STORAGE_KEY = "wdp_nonces_refreshed_at";

  function getNonceRefreshTtlMs() {
    const timing = window.WDPApp && window.WDPApp.constants && window.WDPApp.constants.TIMING;
    return (timing && typeof timing.NONCE_REFRESH_TTL_MS === "number" && timing.NONCE_REFRESH_TTL_MS > 0)
      ? timing.NONCE_REFRESH_TTL_MS
      : 180000;
  }

  function markNoncesRefreshedNow() {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(WDP_NONCE_STORAGE_KEY, String(Date.now()));
      }
    } catch (e) {
      /* private / disabled storage */
    }
  }

  function shouldSkipNonceNetworkRequest(force) {
    if (force) {
      return false;
    }
    try {
      if (typeof sessionStorage === "undefined") {
        return false;
      }
      const raw = sessionStorage.getItem(WDP_NONCE_STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const last = parseInt(raw, 10);
      if (Number.isNaN(last)) {
        return false;
      }
      return Date.now() - last < getNonceRefreshTtlMs();
    } catch (e) {
      return false;
    }
  }

  /**
   * Oturum için taze AJAX nonce'larını admin-ajax üzerinden alır (önceki nonce gerekmez).
   * @param {{ force?: boolean }} options — force: TTL yok say (sekme görünür olunca / kurtarma)
   */
  function refreshWdpAjaxNonces(options) {
    const force = options && options.force === true;
    const ajaxUrl = window.wdp_ajax && window.wdp_ajax.ajax_url;
    if (!ajaxUrl) {
      return Promise.resolve(false);
    }

    if (shouldSkipNonceNetworkRequest(force)) {
      return Promise.resolve(true);
    }

    if (typeof window.jQuery !== "undefined" && window.jQuery.ajax) {
      return new Promise((resolve) => {
        window.jQuery.ajax({
          url: ajaxUrl,
          type: "POST",
          data: { action: "wdp_get_fresh_nonces" },
          dataType: "json",
          complete: function() {
            resolve(true);
          },
          success: function(data) {
            if (data && data.success && data.nonces) {
              mergeWdpAjaxNonces(data.nonces);
              markNoncesRefreshedNow();
            }
          },
        });
      });
    }

    const body = new URLSearchParams();
    body.set("action", "wdp_get_fresh_nonces");

    return fetch(ajaxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success && data.nonces) {
          mergeWdpAjaxNonces(data.nonces);
          markNoncesRefreshedNow();
        }
        return true;
      })
      .catch(() => false);
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", function wdpNonceRefreshOnVisible() {
      if (document.visibilityState === "visible") {
        refreshWdpAjaxNonces({ force: true }).catch(function() {});
      }
    });
  }

  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',')

  function getFocusableElements(container) {
    if (!container) {
      return []
    }

    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter((element) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false
      }
      // offsetParent misses position:fixed / sticky; also check geometry
      if (element.offsetParent !== null) {
        return true
      }
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false
      }
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
  }

  function focusFirstElement(container) {
    const focusable = getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[0].focus({ preventScroll: true })
      return
    }

    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }
    container.focus({ preventScroll: true })
  }

  function activateFocusTrap(modal) {
    function handleKeyDown(event) {
      if (event.key !== 'Tab') {
        return
      }

      const focusable = getFocusableElements(modal)
      if (!focusable.length) {
        event.preventDefault()
        modal.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    modal.addEventListener('keydown', handleKeyDown)

    return () => {
      modal.removeEventListener('keydown', handleKeyDown)
    }
  }

  WDPApp.liveRegions = WDPApp.liveRegions || {}
  WDPApp.liveRegionTimers = WDPApp.liveRegionTimers || {}

  function ensureLiveRegion(politiness = 'polite') {
    const type = politiness === 'assertive' ? 'assertive' : 'polite'
    if (WDPApp.liveRegions[type]) {
      return WDPApp.liveRegions[type]
    }

    if (!document.body) {
      return null
    }

    const region = document.createElement('div')
    region.id = type === 'assertive' ? 'wdp-live-region-assertive' : 'wdp-live-region'
    region.setAttribute('role', type === 'assertive' ? 'alert' : 'status')
    region.setAttribute('aria-live', type)
    region.setAttribute('aria-atomic', 'true')
    region.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);clip-path:inset(100%);overflow:hidden;white-space:nowrap;'
    document.body.appendChild(region)
    WDPApp.liveRegions[type] = region
    return region
  }

  function announceStatus(message, politiness = 'polite') {
    const type = politiness === 'assertive' ? 'assertive' : 'polite'
    const region = ensureLiveRegion(type)
    if (!region) {
      return
    }

    region.textContent = ''
    if (WDPApp.liveRegionTimers[type]) {
      clearTimeout(WDPApp.liveRegionTimers[type])
    }

    const constants = WDPApp.constants || {};
    const timing = constants.TIMING || {};
    const liveRegionDelay = timing.LIVE_REGION_DELAY || 30;
    WDPApp.liveRegionTimers[type] = window.setTimeout(() => {
      region.textContent = message
    }, liveRegionDelay)
  }

  /** Custom event bus for analytics / integrations. */
  function emitWdpEvent(name, detail) {
    try {
      const ev = new CustomEvent(name, { detail: detail || {}, bubbles: true });
      document.dispatchEvent(ev);
    } catch (e) {
      safeLog('emitWdpEvent', e);
    }
  }

  /** Visual toast — pairs with announceStatus for a11y. */
  function showToast(opts) {
    opts = opts || {};
    const type = opts.type || 'info';
    const title = opts.title || '';
    const message = opts.message || '';
    const duration = Number.isFinite(opts.duration) ? opts.duration : 4200;
    const doAnnounce = opts.announce !== false;

    let host = document.getElementById('wdp-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'wdp-toast-host';
      host.className = 'wdp-toast-host';
      host.setAttribute('aria-live', 'off');
      document.body.appendChild(host);
    }

    const toast = document.createElement('div');
    toast.className = 'wdp-toast wdp-toast--' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML =
      '<div class="wdp-toast__body">' +
      (title ? '<div class="wdp-toast__title"></div>' : '') +
      (message ? '<div class="wdp-toast__message"></div>' : '') +
      '</div>' +
      '<button type="button" class="wdp-toast-close" aria-label="Kapat">&times;</button>';
    if (title) toast.querySelector('.wdp-toast__title').textContent = title;
    if (message) toast.querySelector('.wdp-toast__message').textContent = message;
    host.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    const close = function() {
      toast.classList.remove('show');
      toast.classList.add('hide');
      window.setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 280);
    };
    const closeBtn = toast.querySelector('.wdp-toast-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (duration > 0) window.setTimeout(close, duration);
    if (doAnnounce && (title || message)) {
      announceStatus([title, message].filter(Boolean).join('. '), type === 'error' ? 'assertive' : 'polite');
    }
    return { close: close, el: toast };
  }

  function bindOnlineStatus() {
    if (bindOnlineStatus._bound) return;
    bindOnlineStatus._bound = true;
    window.addEventListener('offline', function() {
      document.documentElement.classList.add('wdp-is-offline');
      showToast({
        type: 'warning',
        title: WDPApp.i18n.__('Offline', 'woo-donation-popup'),
        message: WDPApp.i18n.__('No connection. Actions can be retried when you are back online.', 'woo-donation-popup'),
        duration: 5000,
      });
      emitWdpEvent('wdp:network:offline', {});
    });
    window.addEventListener('online', function() {
      document.documentElement.classList.remove('wdp-is-offline');
      showToast({
        type: 'success',
        title: WDPApp.i18n.__('Online', 'woo-donation-popup'),
        message: WDPApp.i18n.__('Connection restored.', 'woo-donation-popup'),
        duration: 2800,
      });
      emitWdpEvent('wdp:network:online', {});
    });
  }

  // Debounce function - delays function execution until after wait time
  function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }

  // Throttle function - limits function execution to once per wait time
  function throttle(func, wait = 100) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, wait);
      }
    };
  }

  // Request Animation Frame throttle - for scroll/resize events
  function rafThrottle(func) {
    let rafId = null;
    return function executedFunction(...args) {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          func.apply(this, args);
          rafId = null;
        });
      }
    };
  }

  // Module dependency helper - centralized module loading
  function ensureModule(moduleName, requiredMethods = [], fallbacks = {}) {
    const module = WDPApp[moduleName] || {};
    let isValid = true;
    const missingMethods = [];

    // Check if module exists
    if (!WDPApp[moduleName]) {
      isValid = false;
    }

    // Check required methods
    requiredMethods.forEach((methodName) => {
      if (!module[methodName] || typeof module[methodName] !== 'function') {
        isValid = false;
        missingMethods.push(methodName);
      }
    });

    // If module is not valid, use fallbacks
    if (!isValid && Object.keys(fallbacks).length > 0) {
      requiredMethods.forEach((methodName) => {
        if (missingMethods.includes(methodName) && fallbacks[methodName]) {
          module[methodName] = fallbacks[methodName];
        }
      });
    }

    return {
      module,
      isValid,
      missingMethods,
    };
  }

  let wdpActiveAlertTimer = null;

  /**
   * Whether the user prefers reduced motion.
   *
   * @returns {boolean}
   */
  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  /**
   * scrollIntoView that respects prefers-reduced-motion.
   *
   * @param {Element} el Target element.
   * @param {ScrollIntoViewOptions|boolean} [options] Native options (or legacy boolean).
   */
  function scrollIntoViewSafe(el, options) {
    if (!el || typeof el.scrollIntoView !== 'function') {
      return;
    }
    if (typeof options === 'boolean') {
      try {
        el.scrollIntoView(options);
      } catch (eBool) {
        /* ignore */
      }
      return;
    }
    const opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
    if (prefersReducedMotion()) {
      opts.behavior = 'auto';
    } else if (!opts.behavior) {
      opts.behavior = 'smooth';
    }
    try {
      el.scrollIntoView(opts);
    } catch (eOpts) {
      try {
        el.scrollIntoView(false);
      } catch (eFallback) {
        /* ignore */
      }
    }
  }

  /**
   * Remove any legacy alert overlay nodes (validation no longer uses center popup).
   */
  function clearAlerts() {
    if (wdpActiveAlertTimer) {
      clearTimeout(wdpActiveAlertTimer);
      wdpActiveAlertTimer = null;
    }

    document.querySelectorAll('.wdp-alert-overlay').forEach((overlay) => {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 180);
    });
  }

  // Export utils module
  const utils = {
    formatPrice,
    formatMinPlaceholder,
    applyCurrencyShellPosition,
    formatCurrency,
    formatMoney,
    formatAmountForSubmit,
    parseMoney,
    parseMoneyDetailed,
    normalizeAmountInput,
    getAmbiguousAmountMessage,
    getNoFractionAmountMessage,
    getCurrencyConfig,
    decodeHtmlEntities,
    getCurrencySymbol,
    escapeHtml,
    safeLog,
    getAjaxNonce,
    mergeWdpAjaxNonces,
    refreshWdpAjaxNonces,
    getFocusableElements,
    focusFirstElement,
    activateFocusTrap,
    announceStatus,
    emitWdpEvent,
    showToast,
    bindOnlineStatus,
    debounce, // Performance optimization
    throttle, // Performance optimization
    rafThrottle, // Performance optimization for scroll/resize
    ensureModule, // Export module helper
    clearAlerts,
    prefersReducedMotion,
    scrollIntoViewSafe,
    resolveStorefrontUrl,
    isValidProductId,
    productInfoErrorMessage,
    classifyAjaxFailure,
  };

  // Backward compatibility for themes/snippets that called WDPApp.alerts.clear().
  WDPApp.alerts = WDPApp.alerts || {};
  WDPApp.alerts.clear = clearAlerts;

  WDPApp.utils = utils;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindOnlineStatus);
    } else {
      bindOnlineStatus();
    }
  }

})(window);
