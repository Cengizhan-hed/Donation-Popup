/**
 * E2A: Experiences durum makinesi (saf işlevler) + boyut bütçesi.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  formatTotal,
  initialState,
  nextPresetIndex,
  parseAmount,
  presentedAs,
  reducer,
  shouldDismissOnDrag,
} from '../../../assets/src/experiences/store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('parseAmount: PHP ile aynı vektörler', () => {
  const vectors = [
    ['100', 100],
    ['1.000', 1000],
    ['1,000', 1000],
    ['12,50', 12.5],
    ['12.5', 12.5],
    ['₺ 250', 250],
    ['1.234,56', 1234.56],
    ['', null],
    ['abc', null],
  ];
  for (const [raw, expected] of vectors) {
    assert.equal(parseAmount(raw), expected, `parseAmount(${JSON.stringify(raw)})`);
  }
});

test('presentedAs: mobilde popup ve yan panel alttan panel olur', () => {
  assert.equal(presentedAs('popup', false), 'modal');
  assert.equal(presentedAs('popup', true), 'sheet');
  assert.equal(presentedAs('side_panel', false), 'panel');
  assert.equal(presentedAs('side_panel', true), 'sheet');
  assert.equal(presentedAs('bottom_sheet', false), 'sheet');
  assert.equal(presentedAs('inline', true), 'inline');
});

test('durum: önerilen tutar seçili başlar, çip -> özel tutar geçişi', () => {
  let s = initialState({ presets: [50, 100, 250], recommended: 100 });
  assert.equal(s.amount, 100);
  assert.equal(s.preset, 100);
  s = reducer(s, { type: 'setCustom', value: '75,5' });
  assert.equal(s.amount, 75.5);
  assert.equal(s.preset, null);
  s = reducer(s, { type: 'selectPreset', value: 250 });
  assert.equal(s.amount, 250);
  assert.equal(s.custom, '');
});

test('durum: önerilen yoksa tutar boş başlar (önceden işaretli ücret/baskı yok)', () => {
  const s = initialState({ presets: [50, 100], recommended: null });
  assert.equal(s.amount, null);
  assert.equal(s.preset, null);
  assert.equal(s.focusPreset, 50);
});

test('durum: hata ve gönderim yaşam döngüsü', () => {
  let s = initialState({ presets: [50] });
  s = reducer(s, { type: 'setErrors', errors: { amount: 'x', donation_email: 'y' } });
  assert.equal(s.status, 'invalid');
  s = reducer(s, { type: 'clearError', name: 'donation_email' });
  assert.deepEqual(Object.keys(s.errors), ['amount']);
  s = reducer(s, { type: 'selectPreset', value: 50 });
  assert.deepEqual(s.errors, {});
  s = reducer(s, { type: 'submitStart' });
  assert.equal(s.status, 'submitting');
  s = reducer(s, { type: 'close' });
  assert.equal(s.status, 'submitting', 'gönderilirken kapanmak durumu bozmaz');
  s = reducer(s, { type: 'submitFail' });
  assert.equal(s.status, 'failed');
});

test('durum: reducer girdiyi değiştirmez', () => {
  const s = initialState({ presets: [50] });
  const frozen = Object.freeze({ ...s, errors: Object.freeze({}) });
  assert.doesNotThrow(() => reducer(frozen, { type: 'setCustom', value: '10' }));
});

test('nextPresetIndex: ok tuşları ve RTL', () => {
  assert.equal(nextPresetIndex(0, 4, 'ArrowRight', false), 1);
  assert.equal(nextPresetIndex(0, 4, 'ArrowLeft', false), 3);
  assert.equal(nextPresetIndex(0, 4, 'ArrowRight', true), 3);
  assert.equal(nextPresetIndex(1, 4, 'ArrowLeft', true), 2);
  assert.equal(nextPresetIndex(2, 4, 'Home', false), 0);
  assert.equal(nextPresetIndex(1, 4, 'End', false), 3);
  assert.equal(nextPresetIndex(1, 4, 'a', false), 1);
});

test('shouldDismissOnDrag: eşik 110 px', () => {
  assert.equal(shouldDismissOnDrag(110), false);
  assert.equal(shouldDismissOnDrag(111), true);
});

test('formatTotal: tam sayıda ondalık yok, simge öne', () => {
  assert.equal(formatTotal(100, '₺', 0, 'tr-TR'), '₺100');
  assert.equal(formatTotal(null, '£', 2, 'en-GB'), '£0');
  assert.equal(formatTotal(12.5, '£', 2, 'en-GB'), '£12.50');
});

test('boyut bütçesi: modül JS <= 25 KB gz, kritik CSS <= 8 KB gz', () => {
  const dir = path.join(ROOT, 'assets/build/experiences');
  if (!fs.existsSync(path.join(dir, 'index.js'))) {
    const r = spawnSync('npm', ['run', 'build:modules'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
  const gz = (file) => zlib.gzipSync(fs.readFileSync(path.join(dir, file))).length;
  assert.ok(gz('index.js') <= 25 * 1024, `JS gz ${gz('index.js')}`);
  assert.ok(gz('index.css') <= 8 * 1024, `CSS gz ${gz('index.css')}`);
});
