/**
 * Bağış formu: Enter / reddedilen doğrulama / istisna → yerel gönderim 0.
 * jsdom yok; vm + en az DOM (aynı sözleşme).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const formSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/form.js'), 'utf8');
const ctaSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/form/cta-ready.js'), 'utf8');
const emSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/bootstrap/event-manager.js'), 'utf8');

function el(over = {}) {
  return {
    tagName: 'INPUT',
    type: 'text',
    name: 'custom_price',
    disabled: false,
    hidden: false,
    classList: { add() {}, remove() {}, contains() { return false; } },
    dataset: {},
    style: {},
    focus() {},
    closest() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getAttribute() { return ''; },
    setAttribute() {},
    addEventListener() {},
    ...over,
  };
}

function loadHarness(opts = {}) {
  const validateImpl =
    typeof opts.validate === 'function'
      ? opts.validate
      : () => (opts.validateOk !== false);
  const ajaxCalls = { n: 0 };
  const addBtn = el({
    tagName: 'BUTTON',
    type: 'submit',
    name: 'donation_add_to_cart',
    disabled: false,
  });
  const price = el({ name: 'custom_price' });
  const errorBox = { textContent: '', style: { display: 'none' }, setAttribute() {} };
  const listeners = { submit: [], keydown: [] };
  const form = {
    dataset: {},
    nativeSubmit: 0,
    tagName: 'FORM',
    className: 'wdp-donation-form-fields',
    noValidate: false,
    _wdpSubmitHandler: null,
    _wdpLastClickSubmitter: addBtn,
    closest(sel) {
      if (sel === '.wdp-donation-form' || sel === '.wdp-modal') {
        return { classList: { contains: () => true } };
      }
      return null;
    },
    contains() {
      return true;
    },
    setAttribute() {},
    appendChild() {},
    querySelector(sel) {
      const s = String(sel);
      if (s.includes('donation_add_to_cart')) return addBtn;
      if (s.includes('donation_go_checkout')) return null;
      if (s.includes('wdp-form-error')) return errorBox;
      if (s.includes('unique_submission_key')) return null;
      return null;
    },
    querySelectorAll(sel) {
      const s = String(sel);
      if (s.includes('donation_add_to_cart')) return [addBtn];
      if (s.includes('input:not([type="hidden"])')) return [price];
      return [];
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    submit() {
      form.nativeSubmit += 1;
    },
  };

  const docListeners = [];
  const ctx = {
    window: {
      WDPApp: {
        i18n: { __: (m) => m, _x: (m) => m, sprintf: (f) => f },
        utils: {
          safeLog() {},
          formatCurrency(n) { return String(n); },
        },
        formValidate: {
          validateForm: validateImpl,
          ensureShareholderRowsReady() {},
          getEffectiveShareCount() { return 1; },
        },
        formFeedback: {
          isFormProcessing() { return false; },
          setFormProcessing() {},
          showFormError() {},
          showShareholderValidationFeedback() {},
        },
        formAjax: {
          submitFormData() {
            ajaxCalls.n += 1;
          },
          registerHooks() {},
        },
        formPricing: {},
        formAddon: {},
        formMessages: {},
      },
    },
    document: {
      addEventListener(type, fn, cap) {
        docListeners.push({ type, fn, cap });
      },
      createElement(tag) {
        return el({ tagName: String(tag).toUpperCase() });
      },
    },
    getComputedStyle() {
      return { display: 'block', visibility: 'visible' };
    },
    setTimeout(fn) {
      return fn();
    },
    Date,
    Math,
  };
  ctx.window.WDPApp.utils.ensureModule = () => ({
    module: ctx.window.WDPApp.utils,
    isValid: true,
    missingMethods: [],
  });
  ctx.window.document = ctx.document;
  ctx.window.getComputedStyle = ctx.getComputedStyle;
  ctx.window.setTimeout = ctx.setTimeout;

  vm.runInNewContext(ctaSrc, ctx);
  vm.runInNewContext(formSrc, ctx);
  vm.runInNewContext(emSrc, { ...ctx, window: ctx.window, document: ctx.document });
  if (ctx.window.WDPApp.eventManager && typeof ctx.window.WDPApp.eventManager.init === 'function') {
    ctx.window.WDPApp.eventManager.init();
  } else if (ctx.window.WDPApp.eventManager && typeof ctx.window.WDPApp.eventManager.setup === 'function') {
    ctx.window.WDPApp.eventManager.setup();
  }

  ctx.window.WDPApp.form.setup(form);

  function fireSubmit(over = {}) {
    const e = {
      type: 'submit',
      target: form,
      currentTarget: form,
      defaultPrevented: false,
      submitter: addBtn,
      preventDefault() {
        e.defaultPrevented = true;
      },
      stopPropagation() {},
      stopImmediatePropagation() {},
      ...over,
    };
    for (const fn of listeners.submit) {
      fn.call(form, e);
    }
    for (const l of docListeners) {
      if (l.type === 'submit') {
        l.fn(e);
      }
    }
    if (!e.defaultPrevented) {
      form.submit();
    }
    return e;
  }

  function fireEnter(target) {
    const e = {
      key: 'Enter',
      target: target || price,
      defaultPrevented: false,
      preventDefault() {
        e.defaultPrevented = true;
      },
    };
    for (const fn of listeners.keydown) {
      fn.call(form, e);
    }
    if (!e.defaultPrevented) {
      fireSubmit();
    }
    return e;
  }

  return { form, fireSubmit, fireEnter, ajaxCalls, price, addBtn, errorBox, listeners };
}

describe('form native submit (vm/jsdom sözleşmesi)', () => {
  it('Enter (son alan) → eklenti yolu, yerel gönderim 0', () => {
    const h = loadHarness({ validateOk: true });
    const e = h.fireEnter(h.price);
    assert.equal(e.defaultPrevented, true);
    assert.equal(h.form.nativeSubmit, 0);
    assert.equal(h.ajaxCalls.n, 1);
  });

  it('reddedilen doğrulama → yerel gönderim 0, AJAX 0', () => {
    const h = loadHarness({ validateOk: false });
    const e = h.fireSubmit();
    assert.equal(e.defaultPrevented, true);
    assert.equal(h.form.nativeSubmit, 0);
    assert.equal(h.ajaxCalls.n, 0);
  });

  it('doğrulama istisnası → yerel gönderim 0', () => {
    const h = loadHarness({
      validate() {
        throw new TypeError('boom is not a function');
      },
    });
    const e = h.fireSubmit();
    assert.equal(e.defaultPrevented, true);
    assert.equal(h.form.nativeSubmit, 0);
    assert.equal(h.ajaxCalls.n, 0);
  });

  it('handler hazır değilken event-manager preventDefault (örtük submit)', () => {
    const h = loadHarness({ validateOk: true });
    h.form._wdpSubmitHandler = null;
    h.listeners.submit.length = 0;
    const e = h.fireSubmit();
    assert.equal(e.defaultPrevented, true);
    assert.equal(h.form.nativeSubmit, 0);
  });
});
