import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQuantity, nextFocusIndex, shouldDismissOnDrag, readNonce, toCount } from '../../../assets/src/side-cart/logic.mjs';

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
