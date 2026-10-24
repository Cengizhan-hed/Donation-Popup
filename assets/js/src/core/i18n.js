/**
 * @file i18n.js
 * Sunucu sözlüğü (wdp_ajax.i18n_dict) ile gettext yardımcısı.
 * Dış API: WDPApp.i18n
 */

(function (window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const CTX_SEP = '\u0004';

  function getDict() {
    const ajax = window.wdp_ajax;
    if (!ajax || !ajax.i18n_dict || typeof ajax.i18n_dict !== 'object') {
      return {};
    }
    return ajax.i18n_dict;
  }

  function lookup(key, fallback) {
    const dict = getDict();
    if (Object.prototype.hasOwnProperty.call(dict, key) && dict[key] != null) {
      return String(dict[key]);
    }
    return fallback;
  }

  /**
   * @param {string} msg Source msgid (English after conversion).
   * @param {string} [_domain]
   * @returns {string}
   */
  function __(msg, _domain) {
    const source = msg == null ? '' : String(msg);
    return lookup(source, source);
  }

  /**
   * @param {string} msg
   * @param {string} ctx
   * @param {string} [_domain]
   * @returns {string}
   */
  function _x(msg, ctx, _domain) {
    const source = msg == null ? '' : String(msg);
    const context = ctx == null ? '' : String(ctx);
    return lookup(context + CTX_SEP + source, source);
  }

  /**
   * Minimal sprintf: %s %d %1$s %2$s %%.
   *
   * @param {string} fmt
   * @param {...*} args
   * @returns {string}
   */
  function sprintf(fmt, ...args) {
    let auto = 0;
    return String(fmt).replace(/%(?:%|(?:(\d+)\$)?([sd]))/g, (whole, pos, type) => {
      if (whole === '%%') {
        return '%';
      }
      const idx = pos ? Number(pos) - 1 : auto++;
      const val = args[idx];
      if (type === 'd') {
        const n = parseInt(val, 10);
        return String(Number.isFinite(n) ? n : 0);
      }
      return val == null ? '' : String(val);
    });
  }

  WDPApp.i18n = {
    __,
    _x,
    sprintf,
  };
})(typeof window !== 'undefined' ? window : globalThis);
