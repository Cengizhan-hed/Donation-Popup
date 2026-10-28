import test from 'node:test';
import assert from 'node:assert/strict';
import { median, judge } from '../../../scripts/measure-lighthouse.mjs';

test('median: tek ve çift sayıda örnek', () => {
  assert.equal(median([90, 70, 80]), 80);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});

test('judge: puan düşüşü ≤3, LCP ≤+100 ms, CLS +0 sınırları', () => {
  const off = { score: 90, lcp: 2000, cls: 0 };
  assert.deepEqual(judge(off, { score: 87, lcp: 2100, cls: 0 }), []);
  assert.equal(judge(off, { score: 86, lcp: 2000, cls: 0 }).length, 1);
  assert.equal(judge(off, { score: 90, lcp: 2101, cls: 0 }).length, 1);
  assert.equal(judge(off, { score: 90, lcp: 2000, cls: 0.01 }).length, 1);
  assert.equal(judge(off, { score: 80, lcp: 3000, cls: 0.1 }).length, 3);
});
