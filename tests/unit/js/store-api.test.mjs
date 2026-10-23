import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyCartStoreApiWithFetch,
  storeApiHeaders,
  storeApiNonceFromGlobals,
  storeApiNonceFromHeaders,
} from '../../../tests/e2e/helpers/store-api.mjs';

describe('Store API nonce', () => {
  it('globals: wcStoreApiNonce / wc.wcSettings / wpApiSettings', () => {
    assert.equal(storeApiNonceFromGlobals({ wcStoreApiNonce: 'abc' }), 'abc');
    assert.equal(
      storeApiNonceFromGlobals({ wc: { wcSettings: { storeApiNonce: 'from-wc' } } }),
      'from-wc'
    );
    assert.equal(storeApiNonceFromGlobals({ wpApiSettings: { nonce: 'wp' } }), 'wp');
    assert.equal(storeApiNonceFromGlobals({}), '');
  });

  it('yanıt başlığı Nonce / X-WC-Store-API-Nonce', () => {
    assert.equal(storeApiNonceFromHeaders({ get: (k) => (k === 'Nonce' ? 'hdr' : null) }), 'hdr');
    assert.equal(
      storeApiNonceFromHeaders({ get: (k) => (k === 'X-WC-Store-API-Nonce' ? 'x' : null) }),
      'x'
    );
    assert.equal(storeApiNonceFromHeaders({ Nonce: 'map' }), 'map');
  });

  it('yazma başlıkları her iki nonce adını koyar', () => {
    const h = storeApiHeaders('tok');
    assert.equal(h.Nonce, 'tok');
    assert.equal(h['X-WC-Store-API-Nonce'], 'tok');
    assert.equal(storeApiHeaders('').Nonce, undefined);
  });

  it('GET başlığındaki nonce ile DELETE; nonce yoksa DELETE yok (401 olmaz)', async () => {
    const calls = [];
    const fake = async (url, init = {}) => {
      calls.push({ url, method: String(init.method || 'GET').toUpperCase(), headers: init.headers || {} });
      if (String(init.method || 'GET').toUpperCase() === 'GET') {
        return {
          ok: true,
          status: 200,
          headers: { get: (k) => (k === 'Nonce' || k === 'X-WC-Store-API-Nonce' ? 'fresh-nonce' : null) },
          json: async () => ({ items: [] }),
        };
      }
      const n = init.headers?.Nonce || init.headers?.['X-WC-Store-API-Nonce'];
      if (n === 'fresh-nonce') {
        return { ok: true, status: 200, headers: { get: () => n } };
      }
      return { ok: false, status: 401, headers: { get: () => null } };
    };
    const r = await emptyCartStoreApiWithFetch(fake, {
      baseUrl: 'https://staging30.example.test',
      globals: {},
    });
    assert.equal(r.emptied, true);
    assert.equal(r.status, 200);
    assert.equal(r.nonce, 'fresh-nonce');
    assert.deepEqual(r.requested, ['GET /cart', 'DELETE /cart/items']);
    const del = calls.find((c) => c.method === 'DELETE');
    assert.ok(del);
    assert.equal(del.headers.Nonce, 'fresh-nonce');
    assert.equal(del.headers['X-WC-Store-API-Nonce'], 'fresh-nonce');
    assert.equal(
      calls.some((c) => c.method === 'DELETE' && !c.headers.Nonce),
      false
    );

    const noNonceCalls = [];
    const noNonce = async (url, init = {}) => {
      noNonceCalls.push(init);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ items: [{ id: 1 }] }),
      };
    };
    const skipped = await emptyCartStoreApiWithFetch(noNonce, {
      baseUrl: 'https://staging30.example.test',
      globals: {},
    });
    assert.equal(skipped.emptied, false);
    assert.equal(skipped.reason, 'missing-nonce');
    assert.equal(
      noNonceCalls.some((c) => String(c.method || '').toUpperCase() === 'DELETE'),
      false
    );
  });
});
