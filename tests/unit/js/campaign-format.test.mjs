import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRestUrl, clampPercent, describeImpact, formatMoney, parseAmount } from '../../../assets/src/campaign/format.mjs';

test('parseAmount: yerel biçimler', () => {
  assert.equal(parseAmount('40'), 40);
  assert.equal(parseAmount('1.250,50'), 1250.5);
  assert.equal(parseAmount('1,250.50'), 1250.5);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('1,250'), 1250);
  assert.equal(parseAmount('1.250'), 1250);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});

test('formatMoney: tam sayıda ondalık yok', () => {
  assert.equal(formatMoney(40, '£', 2, 'en'), '£40');
  assert.equal(formatMoney(40.5, '£', 2, 'en'), '£40.50');
  assert.equal(formatMoney(1250, '₺', 0, 'tr'), '₺1.250');
});

test('describeImpact: kademe, adet ve çoğul', () => {
  const tiers = [
    { unit: 40, one: '{count} food parcel', other: '{count} food parcels' },
    { unit: 250, one: '{count} well', other: '{count} wells' },
  ];
  assert.equal(describeImpact(39, tiers, 'en'), '');
  assert.equal(describeImpact(40, tiers, 'en'), '1 food parcel');
  assert.equal(describeImpact(125, tiers, 'en'), '3 food parcels');
  assert.equal(describeImpact(500, tiers, 'en'), '2 wells');
  assert.equal(describeImpact(10, [], 'en'), '');
});

test('clampPercent', () => {
  assert.equal(clampPercent(120), 100);
  assert.equal(clampPercent(-3), 0);
  assert.equal(clampPercent('x'), 0);
});

test('buildRestUrl: pretty ve düz bağlantı', () => {
  assert.equal(buildRestUrl('https://x.test/wp-json/', 'donation-panel/v1/progress/5'), 'https://x.test/wp-json/donation-panel/v1/progress/5');
  assert.equal(
    buildRestUrl('https://x.test/wp-json/', 'donation-panel/v1/donations', { page: 2, product_id: '' }),
    'https://x.test/wp-json/donation-panel/v1/donations?page=2'
  );
  assert.equal(
    buildRestUrl('https://x.test/?rest_route=/', 'donation-panel/v1/donations', { page: 2 }),
    'https://x.test/?rest_route=/donation-panel/v1/donations&page=2'
  );
});
