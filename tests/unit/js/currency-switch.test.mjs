/**
 * currencySwitch: Woo fiyat HTML’sinden sembol/tutar; liste=form=sepet.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile } from '../../../tests/e2e/helpers/profile.mjs';
import {
  assertCurrencySurfacesConsistent,
  currencySwitchFromProfile,
  extractPriceSnapshot,
  symbolForCode,
} from '../../../tests/e2e/helpers/currency-switch.mjs';

const EUR_CURRENCY = {
  decimals: 2,
  thousandSeparator: '.',
  decimalSeparator: ',',
};

describe('profil currencySwitch', () => {
  it('staging-hedef param+EUR/USD; ikram yok', () => {
    const st = currencySwitchFromProfile(loadProfile('staging'));
    assert.equal(st.param, 'wmc-currency');
    assert.deepEqual(st.codes, ['EUR', 'USD']);
    assert.equal(currencySwitchFromProfile(loadProfile('ikram')), null);
  });
});

describe('Woo fiyat HTML tutarlılığı', () => {
  it('EUR: liste kartı = form min = sepet satırı', () => {
    const list = extractPriceSnapshot(
      '<p class="wdp-card__price">min. <span class="woocommerce-Price-amount amount"><bdi>10,00&nbsp;<span class="woocommerce-Price-currencySymbol">&euro;</span></bdi></span></p>',
      EUR_CURRENCY
    );
    const form = extractPriceSnapshot(
      '<span class="woocommerce-Price-amount amount"><bdi>10,00&nbsp;<span class="woocommerce-Price-currencySymbol">€</span></bdi></span><input placeholder="min: 10,00">',
      EUR_CURRENCY
    );
    const cart = extractPriceSnapshot(
      '<td class="product-price"><span class="woocommerce-Price-amount amount"><bdi>10,00&nbsp;<span class="woocommerce-Price-currencySymbol">€</span></bdi></span></td>',
      EUR_CURRENCY
    );
    const r = assertCurrencySurfacesConsistent({ list, form, cart, code: 'EUR' });
    assert.equal(r.ok, true, r.reason);
    assert.equal(symbolForCode('EUR'), '€');
  });

  it('USD sembolü $; tutar kayması kırmızı', () => {
    const list = extractPriceSnapshot(
      '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">$</span>12.00</span>'
    );
    const form = extractPriceSnapshot(
      '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">$</span>12.00</span>'
    );
    const cart = extractPriceSnapshot(
      '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">$</span>99.00</span>'
    );
    const bad = assertCurrencySurfacesConsistent({ list, form, cart, code: 'USD' });
    assert.equal(bad.ok, false);
    const good = assertCurrencySurfacesConsistent({
      list,
      form,
      cart: list,
      code: 'USD',
    });
    assert.equal(good.ok, true);
  });
});
