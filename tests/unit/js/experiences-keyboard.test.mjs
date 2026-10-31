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

test('ekran klavyesi gelmeyen dokunmatik cihaz: bölüm görünür; gerçek klavye her zaman gizler', () => {
  const base = { fieldFocused: true, keyboard: 0, coarse: true, dismissed: false };
  assert.equal(shouldHideActionBar({ ...base, noKeyboard: true }), false);
  assert.equal(shouldHideActionBar({ ...base, noKeyboard: false }), true);
  // Klavye sonradan gerçekten açılırsa (ölçüldü) bayraktan bağımsız gizlenir.
  assert.equal(shouldHideActionBar({ ...base, keyboard: KEYBOARD_MIN_PX, noKeyboard: true }), true);
});

test('keyboardPresence: klavye ölçüldüyse var; görünüm yakında yeniden boyutlandıysa bekle; sakinse yok', async () => {
  const { keyboardPresence, NO_KEYBOARD_MS, VIEWPORT_STABLE_MS } = await import('../../../assets/src/experiences/keyboard.mjs');
  assert.equal(keyboardPresence({ keyboardUp: true, sinceResize: Infinity }), 'present');
  assert.equal(keyboardPresence({ keyboardUp: false, sinceResize: Infinity }), 'absent');
  assert.equal(keyboardPresence({ keyboardUp: false, sinceResize: VIEWPORT_STABLE_MS - 1 }), 'wait');
  assert.equal(keyboardPresence({ keyboardUp: false, sinceResize: VIEWPORT_STABLE_MS }), 'absent');
  // Yavaş klavye koruması: gerçek emülatörde en yavaş soğuk açılış 3,0 sn ölçüldü; yedek bekleme bunun üstünde, 4 sn.
  assert.ok(NO_KEYBOARD_MS >= 3500 && NO_KEYBOARD_MS <= 4000);
});

test('typedWithoutKeyboard: görünüm küçülmeden yazma = fiziksel klavye; küçüldüyse ya da API sanal klavye bildirirse değil', async () => {
  const { typedWithoutKeyboard, KEYBOARD_GONE_PX } = await import('../../../assets/src/experiences/keyboard.mjs');
  assert.equal(typedWithoutKeyboard({ shrink: 0 }), true);
  assert.equal(typedWithoutKeyboard({ shrink: KEYBOARD_GONE_PX - 1 }), true); // iPad kısayol çubuğu gibi küçük şerit
  assert.equal(typedWithoutKeyboard({ shrink: KEYBOARD_GONE_PX }), false);
  assert.equal(typedWithoutKeyboard({ shrink: 300 }), false);
  assert.equal(typedWithoutKeyboard({ shrink: 0, vkHeight: 280 }), false);
});

test('keyboardDismissed yalnız açıktan kapanışta true', () => {
  assert.equal(keyboardDismissed(true, 0), true);
  assert.equal(keyboardDismissed(false, 0), false);
  assert.equal(keyboardDismissed(true, 300), false);
});

test('klavye algısı histerezisli ve offsetTop\'tan bağımsız', async () => {
  const { keyboardShrink, nextKeyboardUp, KEYBOARD_GONE_PX } = await import('../../../assets/src/experiences/keyboard.mjs');
  assert.equal(keyboardShrink(844, 508), 336);
  assert.equal(keyboardShrink(844, 900), 0);
  assert.equal(nextKeyboardUp(false, KEYBOARD_MIN_PX - 1), false);
  assert.equal(nextKeyboardUp(false, KEYBOARD_MIN_PX), true);
  assert.equal(nextKeyboardUp(true, KEYBOARD_GONE_PX + 1), true);
  assert.equal(nextKeyboardUp(true, KEYBOARD_GONE_PX - 1), false);
  assert.ok(KEYBOARD_MIN_PX > KEYBOARD_GONE_PX);
});

test('itemsInCart Woo sepet çerezini okur', () => {
  assert.equal(itemsInCart(''), 0);
  assert.equal(itemsInCart('a=1; woocommerce_items_in_cart=1; b=2'), 1);
  assert.equal(itemsInCart('woocommerce_items_in_cart=0'), 0);
  assert.equal(itemsInCart('woocommerce_items_in_cart=3'), 3);
  assert.equal(itemsInCart('x_woocommerce_items_in_cart=1'), 0);
});
