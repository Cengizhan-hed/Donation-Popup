/**
 * Plugin formatMoney / parseMoney (assets/js/src/core/utils.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const utilsPath = path.resolve(__dirname, '../../../assets/js/src/core/utils.js');

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
    wdp_ajax: { currency: currency || {}, nonces: {} },
    document,
    addEventListener() {},
    location: { origin: 'https://example.test' },
    WDPApp: {},
  };
  win.window = win;
  const sandbox = {
    window: win,
    document,
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn(),
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.WDPApp.utils;
}

test('GBP 2dp comma thousand', () => {
  const u = loadUtils({
    code: 'GBP',
    symbol: '£',
    decimals: 2,
    thousandSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'left',
  });
  assert.equal(u.parseMoney('12.50'), 12.5);
  assert.equal(u.parseMoney('1,250'), 1250);
  assert.equal(u.parseMoney('1,250.50'), 1250.5);
  assert.equal(u.formatMoney(12.5), '£12.50');
  assert.equal(u.formatMoney(1250), '£1,250.00');
});

test('TRY 0dp dot thousand', () => {
  const u = loadUtils({
    code: 'TRY',
    symbol: '₺',
    decimals: 0,
    thousandSeparator: '.',
    decimalSeparator: ',',
    symbolPosition: 'left',
  });
  assert.equal(u.parseMoney('1.000'), 1000);
  assert.equal(u.parseMoney('1,000'), 1000);
  assert.equal(u.formatMoney(1000), '₺1.000');
});

test('EUR 2dp dot thousand comma decimal', () => {
  const u = loadUtils({
    code: 'EUR',
    symbol: '€',
    decimals: 2,
    thousandSeparator: '.',
    decimalSeparator: ',',
    symbolPosition: 'right_space',
  });
  assert.equal(u.parseMoney('1.000,50'), 1000.5);
  assert.equal(u.formatMoney(1000.5), '1.000,50 €');
});

test('USD symbol positions', () => {
  const left = loadUtils({
    code: 'USD',
    symbol: '$',
    decimals: 2,
    thousandSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'left',
  });
  assert.equal(left.formatMoney(12.5), '$12.50');
  const right = loadUtils({
    code: 'USD',
    symbol: '$',
    decimals: 2,
    thousandSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'right',
  });
  assert.equal(right.formatMoney(12.5), '12.50$');
});

test('formatMinPlaceholder keeps decimals and omits symbol', () => {
  const gbp = loadUtils({
    code: 'GBP',
    symbol: '£',
    decimals: 2,
    thousandSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'left',
  });
  assert.equal(gbp.formatMinPlaceholder(5), 'min: 5.00');
  assert.equal(gbp.formatPrice(5), '5.00');
  const eur = loadUtils({
    code: 'EUR',
    symbol: '€',
    decimals: 2,
    thousandSeparator: '.',
    decimalSeparator: ',',
    symbolPosition: 'right_space',
  });
  assert.equal(eur.formatMinPlaceholder(10), 'min: 10,00');
  assert.equal(eur.formatMoney(10), '10,00 €');
});

test('JPY 0 decimal', () => {
  const u = loadUtils({
    code: 'JPY',
    symbol: '¥',
    decimals: 0,
    thousandSeparator: ',',
    decimalSeparator: '.',
    symbolPosition: 'left',
  });
  assert.equal(u.parseMoney('1,250'), 1250);
  assert.equal(u.formatMoney(1250), '¥1,250');
});
