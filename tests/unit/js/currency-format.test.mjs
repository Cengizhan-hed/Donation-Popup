import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoney,
  formatMinPlaceholder,
  parseMoney,
  textHasFormattedAmount,
  formatFillAmount,
  pickDonationFillAmount,
} from '../../../tests/e2e/helpers/currency.mjs';

describe('currency format from profile', () => {
  it('min placeholder matches WC decimals without trimming', () => {
    assert.equal(
      formatMinPlaceholder(5, {
        symbol: '£',
        decimals: 2,
        thousandSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'left',
      }),
      'min: 5.00'
    );
    assert.equal(
      formatMinPlaceholder(10, {
        symbol: '€',
        decimals: 2,
        thousandSeparator: '.',
        decimalSeparator: ',',
        symbolPosition: 'right_space',
      }),
      'min: 10,00'
    );
  });

  it('GBP left symbol, comma thousands', () => {
    assert.equal(
      formatMoney(3000, {
        symbol: '£',
        decimals: 2,
        thousandSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'left',
      }),
      '£3,000.00'
    );
  });

  it('TRY left symbol, dot thousands', () => {
    assert.equal(
      formatMoney(3000, {
        symbol: '₺',
        decimals: 2,
        thousandSeparator: '.',
        decimalSeparator: ',',
        symbolPosition: 'left',
      }),
      '₺3.000,00'
    );
  });

  it('textHasFormattedAmount', () => {
    const c = { symbol: '£', decimals: 2, thousandSeparator: ',', decimalSeparator: '.', symbolPosition: 'left' };
    assert.equal(textHasFormattedAmount('Goal £3,000.00', 3000, c), true);
  });

  it('parseMoney GBP 2dp comma thousand', () => {
    const gbp = { decimals: 2, thousandSeparator: ',', decimalSeparator: '.' };
    assert.equal(parseMoney('12.50', gbp), 12.5);
    assert.equal(parseMoney('1,250', gbp), 1250);
    assert.equal(parseMoney('1,250.50', gbp), 1250.5);
    assert.equal(parseMoney('£12.50', gbp), 12.5);
  });

  it('parseMoney TRY 0dp dot thousand', () => {
    const try0 = { decimals: 0, thousandSeparator: '.', decimalSeparator: ',' };
    assert.equal(parseMoney('1.000', try0), 1000);
    assert.equal(Number.isFinite(parseMoney('1,000', try0)), false);
    assert.equal(parseMoney('250', try0), 250);
    assert.equal(Number.isFinite(parseMoney('10.00', try0)), false);
  });

  it('parseMoney EUR 2dp dot thousand comma decimal', () => {
    const eur = { decimals: 2, thousandSeparator: '.', decimalSeparator: ',' };
    assert.equal(parseMoney('1.000,50', eur), 1000.5);
    assert.equal(parseMoney('1,50', eur), 1.5);
    assert.equal(parseMoney('1.000', eur), 1000);
  });

  it('formatMoney USD left/right/space and JPY 0dp', () => {
    assert.equal(
      formatMoney(12.5, { symbol: '$', decimals: 2, thousandSeparator: ',', decimalSeparator: '.', symbolPosition: 'left' }),
      '$12.50'
    );
    assert.equal(
      formatMoney(12.5, { symbol: '$', decimals: 2, thousandSeparator: ',', decimalSeparator: '.', symbolPosition: 'right' }),
      '12.50$'
    );
    assert.equal(
      formatMoney(12.5, { symbol: '$', decimals: 2, thousandSeparator: ',', decimalSeparator: '.', symbolPosition: 'left_space' }),
      '$ 12.50'
    );
    assert.equal(
      formatMoney(1250, { symbol: '¥', decimals: 0, thousandSeparator: ',', decimalSeparator: '.', symbolPosition: 'left' }),
      '¥1,250'
    );
  });

  it('formatFillAmount mağaza ondalığı; pickDonationFillAmount min/önerilen (sabit 10 yok)', () => {
    assert.equal(formatFillAmount(50, { decimals: 0, decimalSeparator: ',' }), '50');
    assert.equal(formatFillAmount(50, { decimals: 2, decimalSeparator: ',' }), '50,00');
    assert.equal(formatFillAmount(50, { decimals: 2, decimalSeparator: '.' }), '50.00');
    assert.equal(formatFillAmount(50, {}), '50');
    assert.equal(formatFillAmount(50), '50');
    const fromMin = pickDonationFillAmount({ min: '50' }, { decimals: 0, decimalSeparator: ',' });
    assert.equal(fromMin.amount, 50);
    assert.equal(fromMin.fill, '50');
    const fromRec = pickDonationFillAmount({ recommended: '75' }, { decimals: 2, decimalSeparator: ',' });
    assert.equal(fromRec.amount, 75);
    assert.equal(fromRec.fill, '75,00');
    assert.equal(pickDonationFillAmount({ min: '50' }, {}).fill, '50');
    const both = pickDonationFillAmount({ min: '50', recommended: '100' }, { decimals: 0 });
    assert.equal(both.amount, 100);
    const empty = pickDonationFillAmount({}, { decimals: 0 });
    assert.equal(Number.isFinite(empty.amount), false);
    assert.equal(empty.fill, '');
  });

  it('type=number makine biçimi (nokta, step); type=text yerel ondalık', () => {
    const try2 = { decimals: 2, decimalSeparator: ',' };
    assert.equal(formatFillAmount(50, try2, { type: 'number', step: '1' }), '50');
    assert.equal(formatFillAmount(50, try2, { type: 'number', step: 1 }), '50');
    assert.equal(formatFillAmount(50, try2, { type: 'number', step: '0.01' }), '50.00');
    assert.equal(formatFillAmount(50, try2, { type: 'number' }), '50');
    assert.equal(formatFillAmount(50, try2, { type: 'text' }), '50,00');
    assert.equal(formatFillAmount(50, try2), '50,00');
    const numField = pickDonationFillAmount(
      { min: '50', type: 'number', step: '1' },
      try2
    );
    assert.equal(numField.amount, 50);
    assert.equal(numField.fill, '50');
    const textField = pickDonationFillAmount({ min: '50', type: 'text' }, try2);
    assert.equal(textField.fill, '50,00');
    const viaArg = pickDonationFillAmount({ min: '50' }, try2, { type: 'number', step: 1 });
    assert.equal(viaArg.fill, '50');
    const recNum = pickDonationFillAmount(
      { recommended: '75', inputType: 'number', step: '1' },
      try2
    );
    assert.equal(recNum.fill, '75');
  });
});
