/**
 * E2C: bağış türleri, adımlar, toplam ve işlem ücreti (saf işlevler; sunucudaki Cart_Data::with_fee ile aynı vektörler).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampQty, computeTotals, firstErrorStep, initialState, reducer, roundTo, stepLabel, withFee } from '../../../assets/src/experiences/store.mjs';

const base = { kind: 'custom', amount: null, unit: 0, qty: 1, feePercent: 0, fee: false, addon: false, addonAmount: null, decimals: 2 };

test('withFee/roundTo: PHP round ile aynı (yarım değer yukarı)', () => {
  assert.equal(withFee(100, 5, 2), 105);
  assert.equal(withFee(40, 5, 2), 42);
  assert.equal(withFee(33.33, 2.5, 2), 34.16);
  assert.equal(withFee(10, 2.5, 0), 11);
  assert.equal(withFee(0, 5, 2), 0);
  assert.equal(withFee(100, 0, 2), 100);
  assert.equal(roundTo(1.005, 2), 1.01);
  assert.equal(roundTo(2.5, 0), 3);
});

test('computeTotals: serbest tutar + ücret + ek bağış', () => {
  assert.deepEqual(computeTotals({ ...base, amount: 100, fee: true, feePercent: 5, addon: true, addonAmount: 20 }), { donation: 100, fee: 5, addon: 20, total: 125 });
  assert.deepEqual(computeTotals({ ...base, amount: null }), { donation: 0, fee: 0, addon: 0, total: 0 });
  assert.equal(computeTotals({ ...base, amount: 50, addon: false, addonAmount: 20 }).total, 50);
});

test('computeTotals: sabit/hisseli birim x adet; ücret birim üzerinden', () => {
  assert.deepEqual(computeTotals({ ...base, kind: 'shares', unit: 1400, qty: 3 }), { donation: 4200, fee: 0, addon: 0, total: 4200 });
  assert.deepEqual(computeTotals({ ...base, kind: 'fixed', unit: 40, qty: 2, fee: true, feePercent: 5 }), { donation: 80, fee: 4, addon: 0, total: 84 });
});

test('clampQty sınırlar içinde kalır', () => {
  assert.equal(clampQty(0, 7), 1);
  assert.equal(clampQty(99, 7), 7);
  assert.equal(clampQty('3', 7), 3);
  assert.equal(clampQty('x', 7), 1);
});

test('stepLabel + firstErrorStep', () => {
  assert.equal(stepLabel('Step %1$d of %2$d', 0, 2, 'Amount'), 'Step 1 of 2 · Amount');
  assert.equal(stepLabel('', 1, 3, ''), '2/3');
  assert.equal(firstErrorStep(['donation_phone', 'amount'], { donation_phone: 1, amount: 0 }), 0);
  assert.equal(firstErrorStep(['donation_phone'], { donation_phone: 1 }), 1);
  assert.equal(firstErrorStep(['bilinmeyen'], {}), -1);
});

test('reducer: adım, adet, ücret, ek bağış; hata temizleme', () => {
  let state = initialState({ presets: [50, 100] });
  state = reducer(state, { type: 'setErrors', errors: { quantity: 'x', addon_amount: 'y' } });
  state = reducer(state, { type: 'setQty', value: 3 });
  assert.equal(state.qty, 3);
  assert.equal('quantity' in state.errors, false);
  state = reducer(state, { type: 'setAddon', value: false });
  assert.equal('addon_amount' in state.errors, false);
  state = reducer(state, { type: 'goStep', value: 1 });
  assert.equal(state.step, 1);
  assert.equal(reducer(state, { type: 'goStep', value: -4 }).step, 0);
  assert.equal(reducer(state, { type: 'setFee', value: 1 }).fee, true);
  assert.equal(reducer(state, { type: 'setAddonAmount', value: '25' }).addonAmount, '25');
});
