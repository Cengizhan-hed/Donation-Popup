/**
 * CTA hazır kuyruk: erken dokunuş sessiz yutulmaz.
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
  const form = {
    _wdpSubmitHandler: null,
    _wdpQueuedSubmitter: null,
    dataset: {},
    submitted: 0,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    requestSubmit() {
      this.submitted += 1;
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
      return fn();
    },
    Date,
  };
  ctx.window.WDPApp = {};
  vm.runInNewContext(ctaSrc, ctx);
  return { api: ctx.window.WDPApp.formCtaReady, form, listeners };
}

describe('cta-ready kaynak', () => {
  it('PHP kaplama + JS kuyruk; event-manager sessiz dönüş yok', () => {
    assert.match(phpSrc, /wdp-cta-gate__hit/);
    assert.match(phpSrc, /data-wdp-await-js/);
    assert.match(ctaSrc, /queueCta/);
    assert.match(ctaSrc, /showSetupFailed/);
    assert.match(ctaSrc, /wdp-cta-gate__hit/);
    assert.match(emSrc, /waitForFormReady/);
    assert.match(emSrc, /showSetupFailed/);
    assert.equal(/return;\s*\n\s*\}\);\s*\n\s*\/\/ Form submit/.test(emSrc), false);
    assert.match(modalSrc, /wdpSkeletonLock = 'await'/);
    assert.match(assetsSrc, /register_cta_ready_script/);
  });
});

describe('cta-ready kuyruk', () => {
  it('hazır değilken kuyruğa alır; mark+flush requestSubmit', () => {
    const { api, form, listeners } = loadApi();
    assert.ok(api);
    assert.equal(api.isFormReady(form), false);
    const btn = { classList: { add() {}, remove() {} }, form, click() {} };
    api.queueCta(form, btn);
    assert.equal(form._wdpQueuedSubmitter, btn);
    form._wdpSubmitHandler = function () {};
    api.markFormReady(form);
    assert.equal(form.dataset.wdpFormReady, '1');
    assert.equal(api.flushQueuedCta(form), true);
    assert.equal(form.submitted, 1);
    assert.ok(listeners.some((l) => l.type === 'click' && l.cap === true));
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
