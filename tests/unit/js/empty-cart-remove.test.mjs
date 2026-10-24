/**
 * Sepet boşaltma: yalnız görünür sepet formu/bloğu; başlık mini sepeti yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CART_PAGE_REMOVE_SEL } from '../../../tests/e2e/helpers/checks.mjs';

describe('CART_PAGE_REMOVE_SEL', () => {
  it('yalnız sepet formu/blok; çıplak a.remove yok', () => {
    assert.match(CART_PAGE_REMOVE_SEL, /\.woocommerce-cart-form a\.remove/);
    assert.match(CART_PAGE_REMOVE_SEL, /\.wc-block-cart-items/);
    assert.doesNotMatch(CART_PAGE_REMOVE_SEL, /(?:^|,\s*)a\.remove(?:\s*,|$)/);
  });
});
