import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, textHasFormattedAmount } from '../../../tests/e2e/helpers/currency.mjs';

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
});
