import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENTOR_MARKERS,
  ScenarioSkip,
  SCENARIOS,
  bothPanelsOpen,
  compatPaths,
  decideMode,
  isPluginSourcedError,
  missingTemplateMessage,
  parseElementorCompatArgs,
} from '../../../tests/e2e/helpers/elementor-compat.mjs';

describe('elementor-compat (yalnız test yardımcıları)', () => {
  it('varsayılan ortam local: atla; uzak yalnız açık ikram-aid; diğerleri reddedilir', () => {
    assert.equal(decideMode(parseElementorCompatArgs([])), 'skip');
    assert.equal(decideMode(parseElementorCompatArgs(['--sim'])), 'sim');
    assert.equal(decideMode(parseElementorCompatArgs(['--env', 'ikram-aid'])), 'remote');
    assert.equal(decideMode(parseElementorCompatArgs(['--env=staging-hedef'])), 'reject');
    assert.equal(decideMode(parseElementorCompatArgs(['--env', 'hedef'])), 'reject');
  });

  it('atlama mesajı ve ScenarioSkip', () => {
    assert.equal(missingTemplateMessage('ürün'), 'Theme Builder ürün şablonu yok: kullanıcı oluşturunca koşar');
    assert.ok(new ScenarioSkip('x') instanceof Error);
  });

  it('yalnız eklenti kaynaklı hatalar sayılır', () => {
    assert.equal(isPluginSourcedError('TypeError at /wp-content/plugins/woo-donation-popup/assets/build/main.js:1'), true);
    assert.equal(isPluginSourcedError('wdp_ajax is not defined'), true);
    assert.equal(isPluginSourcedError('elementor-frontend.min.js error'), false);
  });

  it('iki panel birlikte açık kuralı', () => {
    assert.equal(bothPanelsOpen({ plugin: true, elementor: true }), true);
    assert.equal(bothPanelsOpen({ plugin: true, elementor: false }), false);
  });

  it('senaryolar tam ve işaret seçicileri tanımlı', () => {
    assert.equal(SCENARIOS.length, 6);
    for (const k of ['product', 'cart', 'checkout', 'account', 'menuCart']) assert.ok(ELEMENTOR_MARKERS[k]);
    assert.equal(compatPaths({}, '/p/').cart, '/cart/');
  });
});
