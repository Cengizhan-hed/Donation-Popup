/**
 * Form durum makinesi: Object.hasOwn (ES2022) kullanılmaz; reducer eski iOS uyumlu çağrıyla çalışır.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, reducer } from '../../../assets/src/experiences/store.mjs';

describe('store reducer', () => {
  it('bilinen eylemi işler, bilinmeyeni ve prototip anahtarını yok sayar', () => {
    const state = initialState();
    assert.equal(reducer(state, { type: 'open' }).open, true);
    assert.equal(reducer(state, { type: 'nope' }), state);
    assert.equal(reducer(state, { type: 'toString' }), state);
    assert.equal(reducer(state, { type: 'constructor' }), state);
  });

  it('kaynakta ES2022+ API yok (iOS 14 uyumu)', () => {
    const src = readFileSync(new URL('../../../assets/src/experiences/store.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /Object\.hasOwn\(|\.at\(|structuredClone\(|\.findLast\(|\.replaceAll\(/);
  });
});
