/**
 * run.json bölüm süreleri.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slowestSections } from '../../../tests/e2e/helpers/run-io.mjs';

describe('slowestSections', () => {
  it('en yavaş 5; boş/NaN yok', () => {
    const top = slowestSections(
      [
        { label: 'popup/panel ekranları', secs: 90.2 },
        { label: 'ürün sayfaları', secs: 41 },
        { label: 'a11y+checkout-flow', secs: 38.4 },
        { label: 'liste + mağaza', secs: 22 },
        { label: 'currency-switch', secs: 18.1 },
        { label: 'auth', secs: 3 },
        { label: '', secs: 99 },
        { label: 'bad', secs: 'x' },
      ],
      5
    );
    assert.equal(top.length, 5);
    assert.equal(top[0].label, 'popup/panel ekranları');
    assert.equal(top[4].label, 'currency-switch');
    assert.deepEqual(slowestSections(null), []);
  });
});
