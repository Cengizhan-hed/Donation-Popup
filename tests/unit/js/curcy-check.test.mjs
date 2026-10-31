import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCurcyCheckArgs,
  codesToCheck,
  summarizeStoreCart,
  parseDomAmounts,
  classifyMeasurement,
  formatCurcyMarkdown,
} from '../../e2e/helpers/curcy-check.mjs';

const storeCart = (code, minor, unit = 2, extra = {}) => ({
  items: [
    {
      name: 'Test',
      quantity: 1,
      prices: { price: String(minor), currency_minor_unit: unit },
      totals: { line_subtotal: String(minor), line_total: String(minor), currency_minor_unit: unit },
      item_data: [
        { name: 'Amount', value: '100' },
        { name: 'Donor name', value: 'Gizli Kisi' },
      ],
      ...extra,
    },
  ],
  totals: { currency_code: code, currency_symbol: '€', currency_minor_unit: unit, total_items: String(minor), total_price: String(minor), currency_decimal_separator: ',', currency_thousand_separator: '.' },
});

describe('curcy-check', () => {
  it('parses args', () => {
    assert.deepEqual(parseCurcyCheckArgs(['--env', 'staging']), { envId: 'staging', codes: null, amount: 100 });
    assert.deepEqual(parseCurcyCheckArgs(['--env=local', '--codes', 'eur,usd', '--amount=50']), { envId: 'local', codes: ['EUR', 'USD'], amount: 50 });
  });
  it('codes: base first, deduped', () => {
    assert.deepEqual(codesToCheck({ currency: { code: 'TRY' }, currencySwitch: { codes: ['EUR', 'USD', 'TRY'] } }), ['TRY', 'EUR', 'USD']);
    assert.deepEqual(codesToCheck({}, ['EUR']), ['EUR']);
  });
  it('summary hides personal meta values', () => {
    const s = summarizeStoreCart(storeCart('EUR', 10000));
    assert.equal(s.lineSubtotal, 100);
    assert.equal(s.itemMeta.find((m) => m.name === 'Amount').value, '100');
    assert.equal(s.itemMeta.find((m) => m.name === 'Donor name').value, null);
  });
  it('dom amounts use store separators', () => {
    assert.deepEqual(parseDomAmounts(['€100,00', '1.100,50 €'], { decimalSeparator: ',', thousandSeparator: '.', minorUnit: 2 }), [100, 1100.5]);
  });
  it('classifies doğru / yanlış / belirsiz', () => {
    const ok = summarizeStoreCart(storeCart('EUR', 10000));
    assert.equal(classifyMeasurement({ code: 'EUR', typed: 100, cart: ok, cartDom: [100], checkoutDom: [100] }).verdict, 'doğru');
    assert.equal(classifyMeasurement({ code: 'EUR', typed: 100, cart: ok }).verdict, 'belirsiz');
    const conv = summarizeStoreCart(storeCart('EUR', 300));
    assert.equal(classifyMeasurement({ code: 'EUR', typed: 100, cart: conv, cartDom: [3] }).verdict, 'yanlış');
    const wrongCur = summarizeStoreCart(storeCart('TRY', 10000));
    assert.equal(classifyMeasurement({ code: 'EUR', typed: 100, cart: wrongCur, cartDom: [100] }).verdict, 'yanlış');
    assert.equal(classifyMeasurement({ code: 'EUR', typed: 100, cart: null, note: 'sepet boş' }).verdict, 'belirsiz');
    const dom = classifyMeasurement({ code: 'EUR', typed: 100, cart: ok, cartDom: [100], checkoutDom: [3] });
    assert.equal(dom.verdict, 'yanlış');
  });
  it('markdown has table', () => {
    const md = formatCurcyMarkdown({ env: 'x', startedAt: 't', baseUrl: 'u', productRole: 'custom', typed: 100, rows: [{ code: 'EUR', typed: 100, cart: null, verdict: 'belirsiz', reasons: ['a'] }] });
    assert.match(md, /\| EUR \| 100 \|/);
  });
});
