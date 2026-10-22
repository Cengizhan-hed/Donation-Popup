import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, parseMoney, textHasFormattedAmount } from '../../../tests/e2e/helpers/currency.mjs';

describe('currency format from profile', () => {
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
    assert.equal(parseMoney('1,000', try0), 1000);
    assert.equal(parseMoney('250', try0), 250);
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
});
