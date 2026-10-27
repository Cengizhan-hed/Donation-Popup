/**
 * PHP + e2e yardımcısı aynı JSON vektörleri (eski ön yüz JS'i kaldırıldı).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMoneyDetailed } from '../../e2e/helpers/currency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const vectorsPath = path.join(root, 'tests/fixtures/amount-parse-vectors.json');

const fixture = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

test('e2e helper parseMoneyDetailed matches shared vectors', () => {
  for (const row of fixture.vectors) {
    const store = fixture.stores[row.store];
    const got = parseMoneyDetailed(row.input, store);
    assert.equal(got.status, row.status, `${row.store} "${row.input}" helper`);
    if (row.status === 'ok') {
      assert.ok(Math.abs(got.amount - row.amount) < 0.0001);
    }
  }
});
