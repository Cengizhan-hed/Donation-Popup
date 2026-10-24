/**
 * @file addon-rules.js
 * Alt bağış tutarı için saf doğrulama kuralları (DOM yok).
 * Dış API: WDPApp.addonRules
 */
(function (window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  /**
   * Yerel biçimli tutarı sayıya çevirir (5.566 / 5,566 / 5566).
   * @param {unknown} raw
   * @returns {number}
   */
  function parseAmount(raw) {
    if (window.WDPApp && WDPApp.utils && typeof WDPApp.utils.parseMoney === 'function') {
      return WDPApp.utils.parseMoney(raw);
    }
    if (raw === null || raw === undefined) {
      return NaN;
    }
    let s = String(raw).trim().replace(/\s+/g, '');
    if (s === '') {
      return NaN;
    }
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      const parts = s.split(',');
      if (parts.length > 2) {
        s = parts.join('');
      } else if (
        parts.length === 2 &&
        parts[1].length === 3 &&
        /^\d+$/.test(parts[1]) &&
        /^-?\d+$/.test(parts[0])
      ) {
        s = parts[0] + parts[1];
      } else {
        s = parts[0] + '.' + (parts[1] || '');
      }
    } else {
      const parts = s.split('.');
      if (parts.length > 2) {
        s = parts.join('');
      } else if (
        parts.length === 2 &&
        parts[1].length === 3 &&
        /^\d+$/.test(parts[1]) &&
        /^-?\d+$/.test(parts[0])
      ) {
        s = parts[0] + parts[1];
      }
    }
    return Number.parseFloat(s);
  }

  /**
   * @param {object} opts
   * @param {boolean} opts.panelOpen
   * @param {number} [opts.fixedAmount]
   * @param {string} [opts.raw]
   * @param {number} [opts.min]
   * @returns {{ok:boolean, empty?:boolean, value?:number, reason?:string}}
   */
  function validateAmount(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    if (!options.panelOpen) {
      return { ok: true, reason: 'panel_closed' };
    }
    const fixed = Number(options.fixedAmount);
    if (Number.isFinite(fixed) && fixed > 0) {
      return { ok: true, value: fixed, reason: 'fixed' };
    }
    const raw = String(options.raw == null ? '' : options.raw).trim();
    if (raw === '') {
      return { ok: false, empty: true, reason: 'empty' };
    }
    const value = parseAmount(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, empty: false, reason: 'invalid', value: value };
    }
    const min = Number(options.min);
    if (Number.isFinite(min) && min > 0 && value + 0.0001 < min) {
      return { ok: false, empty: false, reason: 'below_min', value: value, min: min };
    }
    return { ok: true, empty: false, value: value, reason: 'valid' };
  }

  WDPApp.addonRules = {
    parseAmount: parseAmount,
    validateAmount: validateAmount,
  };
})(window);
