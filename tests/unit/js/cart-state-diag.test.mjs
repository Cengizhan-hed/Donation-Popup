/**
 * Sepet doğrulama teşhis sınıflandırıcı + güvenli JSON (çerez değeri / PII yok).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCartStateFailure,
  buildCartStateDebugPayload,
  parseAddToCartAjax,
  pickCacheHeaders,
  cacheHeadersIndicateHit,
  summarizeWooCartCookies,
} from '../../../tests/e2e/helpers/cart-state-diag.mjs';

describe('parseAddToCartAjax', () => {
  it('HTTP 200 success + cart_count gövdeden', () => {
    const got = parseAddToCartAjax({
      status: 200,
      ok: true,
      bodyPreview: JSON.stringify({ success: true, cart_count: 2 }),
    });
    assert.deepEqual(got, { status: 200, success: true, cart_count: 2 });
  });

  it('success=false gövdeyi esas alır', () => {
    const got = parseAddToCartAjax({
      status: 200,
      ok: true,
      bodyPreview: JSON.stringify({ success: false, cart_count: 0 }),
    });
    assert.equal(got.success, false);
    assert.equal(got.cart_count, 0);
  });
});

describe('pickCacheHeaders / HIT', () => {
  it('yalnız izinli başlıklar; büyük/küçük harf', () => {
    const h = pickCacheHeaders({
      'Cache-Control': 'public',
      Age: '12',
      'X-Cache': 'HIT',
      'set-cookie': 'secret=1',
    });
    assert.equal(h['cache-control'], 'public');
    assert.equal(h.age, '12');
    assert.equal(h['x-cache'], 'HIT');
    assert.equal(Object.prototype.hasOwnProperty.call(h, 'set-cookie'), false);
  });

  it('age>0 veya HIT → onbellek; BYPASS değil', () => {
    assert.equal(cacheHeadersIndicateHit({ age: '8' }), true);
    assert.equal(cacheHeadersIndicateHit({ 'cf-cache-status': 'HIT' }), true);
    assert.equal(cacheHeadersIndicateHit({ 'x-litespeed-cache': 'hit' }), true);
    assert.equal(cacheHeadersIndicateHit({ 'x-proxy-cache': 'BYPASS', age: '' }), false);
    assert.equal(cacheHeadersIndicateHit({ 'x-cache': 'MISS' }), false);
  });
});

describe('summarizeWooCartCookies', () => {
  it('yalnız ad + alan + yol; değer yok', () => {
    const got = summarizeWooCartCookies([
      {
        name: 'wp_woocommerce_session_abc',
        value: 'SECRET-SESSION',
        domain: '.shop.test',
        path: '/',
      },
      { name: 'woocommerce_items_in_cart', value: '1', domain: 'shop.test', path: '/' },
      { name: 'woocommerce_cart_hash', value: 'deadbeef', domain: 'shop.test', path: '/' },
      { name: 'wordpress_logged_in_xx', value: 'ADMIN', domain: 'shop.test', path: '/' },
    ]);
    assert.equal(got.length, 3);
    assert.deepEqual(got[0], {
      name: 'wp_woocommerce_session_abc',
      domain: '.shop.test',
      path: '/',
    });
    const dumped = JSON.stringify(got);
    assert.equal(dumped.includes('SECRET'), false);
    assert.equal(dumped.includes('ADMIN'), false);
    assert.equal(dumped.includes('deadbeef'), false);
  });
});

describe('classifyCartStateFailure', () => {
  const base = {
    context: { add: 'visitor', read: 'visitor', same: true },
    cookies: [{ name: 'wp_woocommerce_session_x', domain: 's.test', path: '/' }],
    store_api: { headers: { 'x-proxy-cache': 'BYPASS', age: '' } },
    cart_page: { headers: { 'x-cache': 'MISS' } },
  };

  it('baglam-farki: ekleme ziyaretçi, okuma yönetici', () => {
    assert.equal(
      classifyCartStateFailure({
        ...base,
        context: { add: 'visitor', read: 'admin', same: false },
        same_context: false,
      }),
      'baglam-farki'
    );
  });

  it('cerez-yok: oturum çerezi yok (bağlam aynı)', () => {
    assert.equal(
      classifyCartStateFailure({
        ...base,
        cookies: [{ name: 'woocommerce_cart_hash', domain: 's.test', path: '/' }],
      }),
      'cerez-yok'
    );
    assert.equal(classifyCartStateFailure({ ...base, cookies: [] }), 'cerez-yok');
  });

  it('onbellek: age>0 veya HIT (çerez var, bağlam aynı)', () => {
    assert.equal(
      classifyCartStateFailure({
        ...base,
        store_api: { headers: { age: '3', 'x-cache': 'HIT' } },
      }),
      'onbellek'
    );
  });

  it('bilinmiyor: bağlam aynı, çerez var, önbellek HIT değil', () => {
    assert.equal(classifyCartStateFailure(base), 'bilinmiyor');
  });

  it('öncelik: baglam-farki > cerez-yok > onbellek', () => {
    assert.equal(
      classifyCartStateFailure({
        context: { add: 'admin', read: 'visitor' },
        cookies: [],
        store_api: { headers: { 'cf-cache-status': 'HIT' } },
      }),
      'baglam-farki'
    );
  });
});

describe('buildCartStateDebugPayload', () => {
  it('sınıf yazar; çerez değeri ve set-cookie yok', () => {
    const payload = buildCartStateDebugPayload({
      scenario: 'fixed-cart',
      device: 'android',
      add: { status: 200, success: true, bodyPreview: '{"success":true,"cart_count":2}' },
      add_context: 'admin',
      read_context: 'admin',
      cookies: [
        { name: 'wp_woocommerce_session_z', value: 'LEAK', domain: 'ikram.test', path: '/' },
      ],
      store_api: {
        status: 200,
        items_count: 0,
        headers: { 'cache-control': 'no-store', age: '', 'x-proxy-cache': 'BYPASS' },
      },
      cart_page: { status: 200, dom_row_count: 0, headers: { vary: 'Accept-Encoding' } },
    });
    assert.equal(payload.class, 'bilinmiyor');
    assert.equal(payload.add.cart_count, 2);
    assert.equal(payload.context.same, true);
    assert.equal(payload.store_api.items_count, 0);
    assert.equal(payload.cart_page.dom_row_count, 0);
    const dumped = JSON.stringify(payload);
    assert.equal(dumped.includes('LEAK'), false);
    assert.equal(dumped.includes('set-cookie'), false);
  });
});
