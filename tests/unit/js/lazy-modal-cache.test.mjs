/**
 * lazy-modal önbellek anahtarı / para birimi cookie okuma — saf mantık smoke.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function cookieValue(cookieStr, name) {
  const m = String(cookieStr || '').match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  );
  return m ? decodeURIComponent(m[1]) : '';
}

function currentCurrency(cookieStr, ajaxCode) {
  const fromCookie =
    cookieValue(cookieStr, 'wmc_current_currency') ||
    cookieValue(cookieStr, 'woocommerce_currency') ||
    cookieValue(cookieStr, 'woocs_current_currency');
  if (fromCookie) return String(fromCookie).toUpperCase();
  return String(ajaxCode || 'TRY').toUpperCase() || 'TRY';
}

function cacheKey(productId, mode, currency, lang) {
  return String(productId) + ':' + mode + ':' + currency + ':' + lang;
}

describe('lazy-modal cache key', () => {
  it('Curcy cookie para birimini ajax üzerinde önceler', () => {
    assert.equal(currentCurrency('wmc_current_currency=EUR; path=/', 'TRY'), 'EUR');
    assert.equal(currentCurrency('', 'USD'), 'USD');
  });

  it('ürün+mod+para+dil anahtarı ayırır', () => {
    const a = cacheKey(12, 'side_panel', 'TRY', 'tr');
    const b = cacheKey(12, 'side_panel', 'EUR', 'tr');
    const c = cacheKey(12, 'side_panel', 'TRY', 'en');
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.equal(a, '12:side_panel:TRY:tr');
  });
});
