import test from 'node:test';
import assert from 'node:assert/strict';
import { progressAssetUrls } from '../../../assets/src/ui2-shared/live-loader-url.mjs';

const ORIGIN = 'https://site.test';
const SELF = `${ORIGIN}/wp-content/plugins/woo-donation-popup/assets/build/experiences/index.js?ver=abc`;

test('adres yükleyicinin kendi paket yolundan türetilir (aynı köken, assets/build/progress/)', () => {
  assert.deepEqual(progressAssetUrls(SELF, '1b5e7ad1', ORIGIN), {
    js: `${ORIGIN}/wp-content/plugins/woo-donation-popup/assets/build/progress/index.js?ver=1b5e7ad1`,
    css: `${ORIGIN}/wp-content/plugins/woo-donation-popup/assets/build/progress/index.css?ver=1b5e7ad1`,
  });
  assert.equal(progressAssetUrls(SELF, '', ORIGIN).js.endsWith('/assets/build/progress/index.js'), true);
});

test('kötü amaçlı sürüm belirteci (adres, javascript:, yol, sorgu enjeksiyonu) → betik yok', () => {
  for (const bad of ['https://evil.test/x.js', 'javascript:alert(1)', '../../evil', 'a&src=//evil.test', 'x"onload=1', 'a b', `${'a'.repeat(65)}`]) {
    assert.equal(progressAssetUrls(SELF, bad, ORIGIN), null, bad);
  }
});

test('yükleyici adresi başka köken / beklenmeyen yol / şema ise → betik yok', () => {
  assert.equal(progressAssetUrls('https://evil.test/wp-content/plugins/x/assets/build/experiences/index.js', '1', ORIGIN), null);
  assert.equal(progressAssetUrls(`${ORIGIN}/wp-content/uploads/evil/index.js`, '1', ORIGIN), null);
  assert.equal(progressAssetUrls(`${ORIGIN}/assets/build/experiences/other.js`, '1', ORIGIN), null);
  assert.equal(progressAssetUrls('javascript:alert(1)', '1', ORIGIN), null);
  assert.equal(progressAssetUrls('data:text/javascript,alert(1)', '1', ORIGIN), null);
  assert.equal(progressAssetUrls('', '1', ORIGIN), null);
  assert.equal(progressAssetUrls('not a url', '1', ORIGIN), null);
});
