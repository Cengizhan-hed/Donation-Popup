import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYBOARD_MIN_PX, keyboardDismissed, keyboardHeight, shouldHideActionBar } from '../../../assets/src/experiences/keyboard.mjs';
import { itemsInCart } from '../../../assets/src/side-cart/logic.mjs';

test('keyboardHeight görsel görünümün küçülmesinden hesaplanır', () => {
  assert.equal(keyboardHeight(800, 800, 0), 0);
  assert.equal(keyboardHeight(800, 500, 0), 300);
  assert.equal(keyboardHeight(800, 500, 20), 280);
  assert.equal(keyboardHeight(800, 900, 0), 0);
  assert.equal(keyboardHeight(NaN, 500, 0), 0);
});

test('alt bölüm yalnız yazı alanı odakta ve klavye açıkken gizlenir', () => {
  const base = { fieldFocused: true, keyboard: 0, coarse: false, dismissed: false };
  assert.equal(shouldHideActionBar({ ...base, fieldFocused: false, keyboard: 400 }), false);
  assert.equal(shouldHideActionBar({ ...base, keyboard: KEYBOARD_MIN_PX }), true);
  assert.equal(shouldHideActionBar({ ...base, keyboard: KEYBOARD_MIN_PX - 1 }), false);
  // Dokunmatik ekranda klavye henüz ölçülmediyse de alan odağı yeter.
  assert.equal(shouldHideActionBar({ ...base, coarse: true }), true);
  // Klavye açılıp kapandı (alan odakta kaldı): bölüm geri döner.
  assert.equal(shouldHideActionBar({ ...base, coarse: true, dismissed: true }), false);
});

test('keyboardDismissed yalnız açıktan kapanışta true', () => {
  assert.equal(keyboardDismissed(true, 0), true);
  assert.equal(keyboardDismissed(false, 0), false);
  assert.equal(keyboardDismissed(true, 300), false);
});

test('itemsInCart Woo sepet çerezini okur', () => {
  assert.equal(itemsInCart(''), 0);
  assert.equal(itemsInCart('a=1; woocommerce_items_in_cart=1; b=2'), 1);
  assert.equal(itemsInCart('woocommerce_items_in_cart=0'), 0);
  assert.equal(itemsInCart('woocommerce_items_in_cart=3'), 3);
  assert.equal(itemsInCart('x_woocommerce_items_in_cart=1'), 0);
});
