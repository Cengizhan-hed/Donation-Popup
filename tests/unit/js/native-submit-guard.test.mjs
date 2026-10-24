/**
 * NATIVE-SUBMIT-RELOAD sınıflandırma + kaynak iddiaları.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  classifyNativeSubmitReload,
  isProductDocumentPath,
  NATIVE_SUBMIT_RELOAD_CODE,
  pageNavKey,
} from '../../e2e/helpers/native-submit-guard.mjs';

const formSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/form.js'), 'utf8');
const emSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/bootstrap/event-manager.js'), 'utf8');
const wooSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/cart/woo.js'), 'utf8');
const ajaxSrc = fs.readFileSync(path.join(ROOT, 'assets/js/src/form/ajax.js'), 'utf8');
const phpSrc = fs.readFileSync(
  path.join(ROOT, 'includes/traits/trait-wdp-assets-registry.php'),
  'utf8'
);
const matrixSrc = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/matrix-scenarios.mjs'), 'utf8');
const captureSrc = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/capture.mjs'), 'utf8');
const flowSrc = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/donation-flow.mjs'), 'utf8');

describe('native-submit-guard sınıflandırma', () => {
  it('ürün path + görülmüş jeton + armed document → NATIVE-SUBMIT-RELOAD', () => {
    const key = pageNavKey('https://shop.test/product/wdp-e2e-custom/?wdp_e2e=728-15');
    const r = classifyNativeSubmitReload({
      armed: true,
      resourceType: 'document',
      requestKey: key,
      seenProductKeys: [key],
      isProduct: true,
    });
    assert.equal(r.hit, true);
    assert.equal(r.code, NATIVE_SUBMIT_RELOAD_CODE);
  });

  it('ilk yükleme (seen boş) → geç', () => {
    const key = pageNavKey('/product/wdp-e2e-custom/?wdp_e2e=794-18');
    const r = classifyNativeSubmitReload({
      armed: true,
      resourceType: 'document',
      requestKey: key,
      seenProductKeys: [],
      isProduct: true,
    });
    assert.equal(r.hit, false);
  });

  it('armed değil veya xhr → geç', () => {
    const key = pageNavKey('/product/wdp-e2e-custom/');
    assert.equal(
      classifyNativeSubmitReload({
        armed: false,
        resourceType: 'document',
        requestKey: key,
        seenProductKeys: [key],
        isProduct: true,
      }).hit,
      false
    );
    assert.equal(
      classifyNativeSubmitReload({
        armed: true,
        resourceType: 'xhr',
        requestKey: key,
        seenProductKeys: [key],
        isProduct: true,
      }).hit,
      false
    );
  });

  it('ürün path tanır', () => {
    assert.equal(isProductDocumentPath('/product/wdp-e2e-custom/'), true);
    assert.equal(isProductDocumentPath('/urun/ornek/'), true);
    assert.equal(isProductDocumentPath('/cart/'), false);
  });
});

describe('native-submit kaynak', () => {
  it('submit her zaman önce preventDefault; Enter yerel göndermez', () => {
    assert.match(formSrc, /function onWdpFormSubmit\(e\) \{\s*if \(e && typeof e\.preventDefault/);
    assert.match(formSrc, /function bindSmartKeyboard/);
    assert.match(formSrc, /invokeEnterSubmit/);
    assert.match(formSrc, /e\.preventDefault\(\);\s*if \(el\.tagName === 'BUTTON'/);
    assert.equal(formSrc.includes('son alanda native submit'), false);
  });

  it('event-manager handler varken de preventDefault', () => {
    const pdBeforeReturn = /e\.preventDefault\(\);\s*\}?\s*if \(formElement\._wdpSubmitHandler\)/;
    assert.match(emSrc, pdBeforeReturn);
    assert.equal(emSrc.includes('requestSubmit'), false);
  });

  it('sepete ekleme sonrası reload yalnız bayrakla', () => {
    assert.match(wooSrc, /reload_after_add_to_cart/);
    assert.match(phpSrc, /wdp_reload_after_add_to_cart/);
    assert.match(phpSrc, /'reload_after_add_to_cart'\s*=>/);
    const fallback = wooSrc.match(/function fallbackCartUpdate\(\) \{[\s\S]*?\n  \}/);
    assert.ok(fallback, 'fallbackCartUpdate yok');
    assert.match(fallback[0], /flags\.reload_after_add_to_cart/);
    assert.match(fallback[0], /window\.location\.reload/);
  });

  it('directFormSubmit yerel form.submit çağırmaz', () => {
    const block = ajaxSrc.match(/function directFormSubmit\([\s\S]*?return true;\s*\}/);
    assert.ok(block, 'directFormSubmit yok');
    assert.equal(block[0].includes('form.submit()'), false);
    assert.match(block[0], /submitFormData/);
  });

  it('matris + capture + checkout-flow NATIVE-SUBMIT-RELOAD kullanır', () => {
    assert.match(matrixSrc, /NATIVE_SUBMIT_RELOAD_CODE/);
    assert.match(matrixSrc, /attachNativeSubmitReloadGuard/);
    assert.match(captureSrc, /NATIVE_SUBMIT_RELOAD_CODE/);
    assert.match(flowSrc, /attachNativeSubmitReloadGuard/);
  });
});
