import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQuantity, nextFocusIndex, shouldDismissOnDrag, readNonce, toCount, trustedDrawerUrl } from '../../../assets/src/side-cart/logic.mjs';

test('trustedDrawerUrl: yalnız aynı köken + eklentinin çekmece paketi, sorgu yalnız ver', () => {
  const page = 'https://site.test/urun/x/';
  const ok = 'https://site.test/wp-content/plugins/woo-donation-popup/assets/build/side-cart-drawer/index.js?ver=ab12';
  assert.equal(trustedDrawerUrl(ok, page), ok);
  assert.equal(trustedDrawerUrl('/alt/wp-content/plugins/x/assets/build/side-cart-drawer/index.js', page), 'https://site.test/alt/wp-content/plugins/x/assets/build/side-cart-drawer/index.js');
  for (const bad of [
    'https://evil.test/wp-content/plugins/woo-donation-popup/assets/build/side-cart-drawer/index.js',
    'https://site.test/wp-content/plugins/woo-donation-popup/assets/build/side-cart/index.js',
    'https://site.test/assets/build/side-cart-drawer/index.js?ver=1&x=2',
    'https://site.test/assets/build/side-cart-drawer/index.js#a',
    'https://u:p@site.test/assets/build/side-cart-drawer/index.js',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ]) {
    assert.equal(trustedDrawerUrl(bad, page), '', String(bad));
  }
});

test('nextQuantity en az 1', () => {
  assert.equal(nextQuantity(1, -1), 1);
  assert.equal(nextQuantity('2', '1'), 3);
  assert.equal(nextQuantity('x', 1), 2);
  assert.equal(nextQuantity(5, -2), 3);
});

test('nextFocusIndex döner', () => {
  assert.equal(nextFocusIndex(0, -1, false), -1);
  assert.equal(nextFocusIndex(3, -1, false), 0);
  assert.equal(nextFocusIndex(3, -1, true), 2);
  assert.equal(nextFocusIndex(3, 2, false), 0);
  assert.equal(nextFocusIndex(3, 0, true), 2);
  assert.equal(nextFocusIndex(3, 1, false), 2);
});

test('shouldDismissOnDrag eşik 110', () => {
  assert.equal(shouldDismissOnDrag(110), false);
  assert.equal(shouldDismissOnDrag(111), true);
});

test('readNonce başlık okur', () => {
  const h = new Map([['Nonce', 'abc']]);
  assert.equal(readNonce(h), 'abc');
  assert.equal(readNonce(null), '');
  assert.equal(readNonce(new Map()), '');
});

test('toCount güvenli', () => {
  assert.equal(toCount('3'), 3);
  assert.equal(toCount(-2), 0);
  assert.equal(toCount(undefined), 0);
});
