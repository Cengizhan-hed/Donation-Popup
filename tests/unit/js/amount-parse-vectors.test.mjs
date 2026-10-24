/**
 * PHP + JS aynı JSON vektörleri.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseMoneyDetailed } from '../../e2e/helpers/currency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const vectorsPath = path.join(root, 'tests/fixtures/amount-parse-vectors.json');
const utilsPath = path.resolve(root, 'assets/js/src/core/utils.js');

const fixture = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

function loadUtils(currency) {
  const code = fs.readFileSync(utilsPath, 'utf8');
  const documentElement = { classList: { add() {}, remove() {} } };
  const document = {
    readyState: 'complete',
    documentElement,
    addEventListener() {},
    createElement() {
      return { innerHTML: '', get value() { return this.innerHTML; } };
    },
    body: { appendChild() {} },
  };
  const win = {
    wdp_ajax: { currency: currency || {}, nonces: {}, strings: {} },
    document,
    addEventListener() {},
    location: { origin: 'https://example.test' },
    WDPApp: {},
  };
  win.window = win;
  vm.runInNewContext(code, {
    window: win,
    document,
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn(),
  });
  return win.WDPApp.utils;
}

test('plugin parseMoneyDetailed matches shared vectors', () => {
  for (const row of fixture.vectors) {
    const store = fixture.stores[row.store];
    const u = loadUtils(store);
    const got = u.parseMoneyDetailed(row.input, store);
    assert.equal(got.status, row.status, `${row.store} "${row.input}" plugin`);
    if (row.status === 'ok') {
      assert.equal(got.ok, true);
      assert.ok(Math.abs(got.amount - row.amount) < 0.0001, `${row.store} ${row.input} amount`);
    } else {
      assert.equal(got.ok, false);
    }
  }
});

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

test('TRY 10.00 never becomes 1000; message is integer example', () => {
  const try0 = fixture.stores.try;
  const u = loadUtils(try0);
  const got = u.parseMoneyDetailed('10.00', try0);
  assert.equal(got.status, 'ambiguous');
  assert.equal(Number.isFinite(u.parseMoney('10.00', try0)), false);
  assert.match(u.getAmbiguousAmountMessage(try0), /tam sayı/);
  assert.match(u.getAmbiguousAmountMessage(try0), /10/);
  assert.equal(u.normalizeAmountInput('₺1.250', try0), '1.250');
  assert.equal(u.normalizeAmountInput('1 250', try0), '1250');
});
