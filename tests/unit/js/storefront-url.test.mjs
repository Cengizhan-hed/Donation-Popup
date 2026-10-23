/**
 * Ödeme/sepet URL: yalnız WooCommerce (wdp_ajax / AJAX yanıtı). Sabit slug yok.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function loadUtils(ajaxExtra) {
  const code = fs.readFileSync(path.join(root, 'assets/js/src/core/utils.js'), 'utf8');
  const documentElement = { classList: { add() {}, remove() {} } };
  const document = {
    readyState: 'complete',
    documentElement,
    addEventListener() {},
    createElement() {
      return { innerHTML: '', get value() { return this.innerHTML; } };
    },
    body: { appendChild() {} },
  };
  const win = {
    wdp_ajax: Object.assign({ currency: {}, nonces: {}, cart_url: '', checkout_url: '' }, ajaxExtra || {}),
    document,
    addEventListener() {},
    location: { origin: 'https://example.test', href: 'https://example.test/' },
    WDPApp: {},
  };
  win.window = win;
  vm.runInNewContext(code, { window: win, document, console, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn() });
  return { utils: win.WDPApp.utils, win };
}

test('checkout_url yokken sabit slug dönmez', () => {
  const { utils, win } = loadUtils();
  assert.equal(utils.resolveStorefrontUrl('checkout'), '');
  assert.equal(utils.resolveStorefrontUrl('checkout', {}), '');
  assert.equal(utils.resolveStorefrontUrl('checkout', { checkout_url: '' }), '');
  assert.equal(utils.resolveStorefrontUrl('cart'), '');
  const dest = utils.resolveStorefrontUrl('checkout', { checkout_url: null }) || win.wdp_ajax.checkout_url || '';
  assert.equal(dest, '');
  assert.doesNotMatch(dest, /odeme-sayfasi|\/sepet\/|\/checkout\/|\/cart\//);
});

test('yalnız WooCommerce checkout_url kullanılır', () => {
  const { utils } = loadUtils({ checkout_url: 'https://shop.test/odeme/' });
  assert.equal(utils.resolveStorefrontUrl('checkout'), 'https://shop.test/odeme/');
  assert.equal(
    utils.resolveStorefrontUrl('checkout', { checkout_url: 'https://shop.test/checkout/' }),
    'https://shop.test/checkout/'
  );
});

test('isValidProductId 0 / boş reddeder', () => {
  const { utils } = loadUtils();
  assert.equal(utils.isValidProductId(0), false);
  assert.equal(utils.isValidProductId('0'), false);
  assert.equal(utils.isValidProductId(''), false);
  assert.equal(utils.isValidProductId(null), false);
  assert.equal(utils.isValidProductId(12), true);
});

test('eklenti kaynaklarında sabit sayfa slug yok', () => {
  const dirs = [
    path.join(root, 'assets/js/src'),
    path.join(root, 'includes'),
    path.join(root, 'templates'),
  ];
  const slugRe = /["'`]\/(?:odeme-sayfasi|sepet|odeme|bagis|checkout|cart)\/["'`]/;
  const hits = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|php)$/.test(ent.name)) continue;
      const src = fs.readFileSync(full, 'utf8');
      if (slugRe.test(src)) {
        hits.push(path.relative(root, full));
      }
    }
  }
  dirs.forEach(walk);
  assert.deepEqual(hits, []);
});
