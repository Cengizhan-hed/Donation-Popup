import test from 'node:test';
import assert from 'node:assert/strict';
import { cartAmounts, clamp, donorsText, easeOut, formatPercent, formatWooMoney, noteText, percentOf, projection } from '../../../assets/src/ui2-shared/live-progress-logic.mjs';

const NBSP = String.fromCharCode(160);
const gbp = { s: '£', d: 2, ds: '.', ts: ',', pos: 'left' };
const tr = { s: '₺', d: 2, ds: ',', ts: '.', pos: 'right_space' };

test('formatWooMoney: Woo ayırıcıları ve simge konumu; tam sayıda ".00" yok', () => {
  assert.equal(formatWooMoney(1250, gbp), '£1,250');
  assert.equal(formatWooMoney(12.5, gbp), '£12.50');
  assert.equal(formatWooMoney(1250.5, tr), `1.250,50${NBSP}₺`);
  assert.equal(formatWooMoney(3000, { ...gbp, pos: 'right' }), '3,000£');
  assert.equal(formatWooMoney(3000, { ...gbp, pos: 'left_space' }), `£${NBSP}3,000`);
  assert.equal(formatWooMoney(1999.999, gbp), '£2,000');
  assert.equal(formatWooMoney(5, { s: '¥', d: 0, ds: '.', ts: ',' }), '¥5');
  assert.equal(formatWooMoney(Number.NaN, gbp), '£0');
});

test('formatPercent: aşağı yuvarlar (hedefe ulaşmadan 100 yok), çevrilmiş kalıp, ondalık ayırıcı', () => {
  assert.equal(formatPercent(41.67, '{n}%', '.', 0), '41%');
  assert.equal(formatPercent(41.67, '{n}%', '.', 1), '41.6%');
  assert.equal(formatPercent(41.67, '%{n}', ',', 1), '%41,6');
  assert.equal(formatPercent(99.99, '{n}%', '.', 0), '99%');
  assert.equal(formatPercent(100, '{n}%', '.', 1), '100%');
  assert.equal(formatPercent(150, '{n}%'), '100%');
  assert.equal(formatPercent(-3, '{n}%'), '0%');
});

test('percentOf / clamp', () => {
  assert.equal(percentOf(1500, 3000), 50);
  assert.equal(percentOf(4000, 3000), 100);
  assert.equal(percentOf(10, 0), 0);
  assert.equal(clamp('x'), 0);
});

test('cartAmounts: Store API satırları ürün başına toplanır (küçük birim + vergi)', () => {
  const cart = {
    items: [
      { id: 12, quantity: 1, totals: { line_total: '2500', line_total_tax: '0', currency_minor_unit: 2 } },
      { id: 12, quantity: 2, totals: { line_total: '1000', line_total_tax: '200', currency_minor_unit: 2 } },
      { id: 30, quantity: 1, totals: { line_total: '500', line_total_tax: '0', currency_minor_unit: 0 } },
      { id: 0, totals: { line_total: '999' } },
      { id: 31, totals: { line_total: '0' } },
    ],
  };
  const map = cartAmounts(cart);
  assert.equal(map.get(12), 37);
  assert.equal(map.get(30), 500);
  assert.equal(map.has(0), false);
  assert.equal(map.has(31), false);
  assert.equal(cartAmounts(null).size, 0);
  assert.equal(cartAmounts({}).size, 0);
});

test('projection: seçilen + sepetteki tutar, yalnız önizleme; gerçek değişmez', () => {
  const view = projection({ raised: 1500, goal: 3000, cart: 100, pending: 50 });
  assert.equal(view.real, 50);
  assert.equal(view.personal, 150);
  assert.equal(view.total, 1650);
  assert.ok(Math.abs(view.projected - 55) < 1e-9);
  assert.equal(view.inCartOnly, false);
  assert.equal(view.completes, false);
  assert.equal(projection({ raised: 1500, goal: 3000, cart: 100 }).inCartOnly, true);
  assert.equal(projection({ raised: 2900, goal: 3000, pending: 100 }).completes, true);
  assert.equal(projection({ raised: 3000, goal: 3000, pending: 100 }).completes, false);
  assert.equal(projection({ raised: 0, goal: 3000, pending: -5 }).personal, 0);
});

test('noteText: seçilen / sepette / hedefi tamamlar; kişisel tutar yoksa boş', () => {
  const texts = { with: 'With your %1$s it reaches %2$s', cart: '%1$s in your cart · reaches %2$s', goal: 'Your %1$s completes the goal!' };
  const money = (n) => formatWooMoney(n, gbp);
  assert.equal(noteText(projection({ raised: 1500, goal: 3000, pending: 25 }), texts, money), 'With your £25 it reaches £1,525');
  assert.equal(noteText(projection({ raised: 1500, goal: 3000, cart: 40 }), texts, money), '£40 in your cart · reaches £1,540');
  assert.equal(noteText(projection({ raised: 1500, goal: 3000, cart: 40, pending: 10 }), texts, money), 'With your £50 it reaches £1,550');
  assert.equal(noteText(projection({ raised: 2950, goal: 3000, pending: 50 }), texts, money), 'Your £50 completes the goal!');
  assert.equal(noteText(projection({ raised: 1500, goal: 3000 }), texts, money), '');
});

test('donorsText ve easeOut', () => {
  assert.equal(donorsText(0, '%s supporter', '%s supporters'), '');
  assert.equal(donorsText(1, '%s supporter', '%s supporters'), '1 supporter');
  assert.equal(donorsText(1250, '%s supporter', '%s supporters', '.'), '1.250 supporters');
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.ok(easeOut(0.5) > 0.5);
});
