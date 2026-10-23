/**
 * run.json bölüm süreleri.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slowestSections, dedupeFullSummaryRows } from '../../../tests/e2e/helpers/run-io.mjs';

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

describe('dedupeFullSummaryRows', () => {
  it('takma ad + leftover aynı profil/cihaz tek satır; yüksek skor kalır', () => {
    const rows = dedupeFullSummaryRows([
      { env: 'staging', device: 'desktop', passed: 0, failed: 1, secs: 0 },
      { env: 'staging-hedef', device: 'desktop', passed: 40, failed: 0, secs: 100 },
      { env: 'ikram', device: 'iphone', passed: 10, failed: 0, secs: 20 },
      { env: 'ikram-aid', device: 'iphone', passed: 12, failed: 0, secs: 22 },
    ]);
    assert.equal(rows.length, 2);
    const st = rows.find((r) => r.device === 'desktop');
    const ik = rows.find((r) => r.device === 'iphone');
    assert.equal(st.env, 'staging-hedef');
    assert.equal(st.passed, 40);
    assert.equal(ik.env, 'ikram-aid');
    assert.equal(ik.passed, 12);
  });
});
