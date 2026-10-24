/**
 * checkout/panel teşhis sanitizer (sorgu/gövde yok).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  urlPathnameAndVer,
  sanitizeConsoleLine,
  summarizeNetworkHit,
  buildCheckoutFlowDiagExtras,
  writePanelOpenDebug,
} from '../../../tests/e2e/helpers/flow-diag.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env.mjs';

describe('urlPathnameAndVer', () => {
  it('yalnız pathname + ver', () => {
    const r = urlPathnameAndVer(
      'https://shop.test/wp-content/plugins/woo-donation-popup/assets/js/build/app.js?ver=10.34.12&cache=x'
    );
    assert.equal(r.pathname, '/wp-content/plugins/woo-donation-popup/assets/js/build/app.js');
    assert.equal(r.ver, '10.34.12');
  });
});

describe('sanitizeConsoleLine', () => {
  it('URL sorgu düşer, metin kısalır', () => {
    const s = sanitizeConsoleLine('TypeError at https://shop.test/a.js?sid=9#x extra');
    assert.match(s, /\/a\.js/);
    assert.doesNotMatch(s, /sid=9/);
  });
});

describe('summarizeNetworkHit', () => {
  it('wc-ajax + action, sorgu yok', () => {
    const h = summarizeNetworkHit({
      method: 'POST',
      url: 'https://shop.test/?wc-ajax=add_to_cart&foo=1',
      action: 'wdp_ajax_add_to_cart',
      status: 200,
    });
    assert.equal(h.method, 'POST');
    assert.equal(h.pathname, '/');
    assert.equal(h.wc_ajax, 'add_to_cart');
    assert.equal(h.action, 'wdp_ajax_add_to_cart');
    assert.doesNotMatch(JSON.stringify(h), /foo=1/);
  });
});

describe('buildCheckoutFlowDiagExtras', () => {
  it('cta_ready null kalabilir; alanlar güvenli', () => {
    const x = buildCheckoutFlowDiagExtras({});
    assert.equal(x.cta_ready, null);
    assert.equal(x.plugin.has_wdp_app, false);
    assert.deepEqual(x.network_after_click, []);
  });
});

describe('writePanelOpenDebug', () => {
  it('JSON yalnız yol/sınıf; sorgu yok', () => {
    const prev = process.env.WDP_E2E_PROFILE_ID;
    process.env.WDP_E2E_PROFILE_ID = 'local';
    const rel = writePanelOpenDebug('desktop', 'shares', {
      class: 'panel-acilamadi',
      detail: 'selector=sidePanel',
      plugin: {
        has_wdp_app: false,
        scripts: [{ id: 'wdp-donation-modal-js', src: 'https://x.test/app.js?ver=1&tok=z' }],
      },
      shell: { open_count: 0, side_panel: false },
      console_errors: ['https://x.test/err.js?q=1 failed'],
      png: '/tmp/panel-shares-open-desktop.png',
    });
    const abs = path.join(ROOT, rel);
    const json = fs.readFileSync(abs, 'utf8');
    assert.match(json, /panel-acilamadi/);
    assert.doesNotMatch(json, /tok=z|\?q=1/);
    fs.unlinkSync(abs);
    if (prev === undefined) delete process.env.WDP_E2E_PROFILE_ID;
    else process.env.WDP_E2E_PROFILE_ID = prev;
  });
});
