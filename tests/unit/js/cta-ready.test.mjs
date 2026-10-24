/**
 * CTA hazır kuyruk: yerel form gönderimi yok; tıklama başına 1 handler.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const ctaSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/form/cta-ready.js'), 'utf8');
const emSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/bootstrap/event-manager.js'), 'utf8');
const phpSrc = fs.readFileSync(
  path.join(ROOT, 'includes/templates/class-modal-shell-renderer.php'),
  'utf8'
);
const modalSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/modal.js'), 'utf8');
const assetsSrc = fs.readFileSync(
  path.join(ROOT, 'includes/traits/trait-wdp-assets-registry.php'),
  'utf8'
);

function loadApi() {
  const listeners = [];
  const timers = [];
  const form = {
    _wdpSubmitHandler: null,
    _wdpQueuedSubmitter: null,
    _wdpCtaInFlight: false,
    dataset: {},
    submitted: 0,
    nativeSubmit: 0,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    requestSubmit() {
      this.nativeSubmit += 1;
    },
  };
  const ctx = {
    window: { WDPApp: {} },
    document: {
      addEventListener(type, fn, cap) {
        listeners.push({ type, fn, cap });
      },
    },
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    Date,
  };
  ctx.window.WDPApp = {};
  vm.runInNewContext(ctaSrc, ctx);
  function bindHandler() {
    form._wdpSubmitHandler = function onSubmit(e) {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      form.submitted += 1;
      form.dataset.wdpProcessing = '1';
    };
  }
  function fireGate(btn) {
    const hit = {
      closest(sel) {
        if (sel === '.wdp-cta-gate__hit') return hit;
        if (sel === 'form') return form;
        if (sel === '.wdp-cta-gate') {
          return {
            querySelector() {
              return btn;
            },
          };
        }
        return null;
      },
    };
    const e = {
      target: hit,
      prevented: false,
      preventDefault() {
        e.prevented = true;
      },
      stopPropagation() {},
    };
    for (const l of listeners) {
      if (l.type === 'click') {
        l.fn(e);
      }
    }
    return e;
  }
  function flushTimers() {
    const q = timers.splice(0);
    for (const fn of q) {
      fn();
    }
  }
  return { api: ctx.window.WDPApp.formCtaReady, form, listeners, bindHandler, fireGate, flushTimers };
}

describe('cta-ready kaynak', () => {
  it('PHP kaplama + JS kuyruk; event-manager sessiz dönüş yok; requestSubmit yok', () => {
    assert.match(phpSrc, /wdp-cta-gate__hit/);
    assert.match(phpSrc, /data-wdp-await-js/);
    assert.match(ctaSrc, /queueCta/);
    assert.match(ctaSrc, /invokePluginSubmit/);
    assert.match(ctaSrc, /showSetupFailed/);
    assert.match(ctaSrc, /wdp-cta-gate__hit/);
    assert.match(emSrc, /waitForFormReady/);
    assert.match(emSrc, /showSetupFailed/);
    assert.equal(/return;\s*\n\s*\}\);\s*\n\s*\/\/ Form submit/.test(emSrc), false);
    assert.match(modalSrc, /wdpSkeletonLock = 'await'/);
    assert.match(assetsSrc, /register_cta_ready_script/);
    assert.equal(ctaSrc.includes('requestSubmit'), false);
    assert.equal(emSrc.includes('requestSubmit'), false);
  });
});

describe('cta-ready kuyruk', () => {
  it('hazır değilken kuyruğa alır; mark+flush handler’ı 1 kez çağırır, requestSubmit yok', () => {
    const { api, form, listeners, bindHandler } = loadApi();
    assert.ok(api);
    assert.equal(api.isFormReady(form), false);
    const btn = { classList: { add() {}, remove() {} }, form, click() {} };
    api.queueCta(form, btn);
    assert.equal(form._wdpQueuedSubmitter, btn);
    bindHandler();
    api.markFormReady(form);
    assert.equal(form.dataset.wdpFormReady, '1');
    assert.equal(api.flushQueuedCta(form), true);
    assert.equal(form.submitted, 1);
    assert.equal(form.nativeSubmit, 0);
    assert.ok(listeners.some((l) => l.type === 'click' && l.cap === true));
  });

  it('çift tıklama (hazır) → 1 istek; yerel gezinme yok', () => {
    const { api, form, bindHandler, fireGate } = loadApi();
    bindHandler();
    const btn = { classList: { add() {}, remove() {} }, form, dataset: {}, name: 'donation_add_to_cart' };
    fireGate(btn);
    fireGate(btn);
    assert.equal(form.submitted, 1);
    assert.equal(form.nativeSubmit, 0);
    assert.equal(api.invokePluginSubmit(form, btn), false);
  });

  it('erken tıklama + geç hazır → 1 istek; ikinci kuyruk yok', () => {
    const { api, form, bindHandler, fireGate, flushTimers } = loadApi();
    const btn = { classList: { add() {}, remove() {} }, form, dataset: {}, name: 'donation_add_to_cart' };
    fireGate(btn);
    fireGate(btn);
    assert.equal(form._wdpQueuedSubmitter, btn);
    bindHandler();
    flushTimers();
    assert.equal(form.submitted, 1);
    assert.equal(form.nativeSubmit, 0);
    assert.equal(form._wdpQueuedSubmitter, null);
    assert.equal(api.flushQueuedCta(form), false);
  });

  it('hazırken tıklama → 1 istek; handler bağlıyken kuyruk devre dışı', () => {
    const { api, form, bindHandler, fireGate } = loadApi();
    bindHandler();
    const btn = { classList: { add() {}, remove() {} }, form, dataset: {}, name: 'donation_go_checkout' };
    api.queueCta(form, btn);
    assert.equal(form._wdpQueuedSubmitter, null);
    fireGate(btn);
    assert.equal(form.submitted, 1);
    assert.equal(form.nativeSubmit, 0);
  });

  it('ikinci yükleme API’yi ezmez', () => {
    const ctx = {
      window: { WDPApp: {} },
      document: { addEventListener() {} },
      setTimeout(fn) {
        return fn();
      },
      Date,
    };
    vm.runInNewContext(ctaSrc, ctx);
    ctx.window.WDPApp.formCtaReady.marker = 1;
    vm.runInNewContext(ctaSrc, ctx);
    assert.equal(ctx.window.WDPApp.formCtaReady.marker, 1);
  });
});
