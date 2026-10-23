/**
 * Koşu içi ortak wdp_e2e jetonu — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginNavCache,
  endNavCache,
  withCacheBust,
} from '../../../tests/e2e/helpers/env.mjs';

describe('beginNavCache / withCacheBust', () => {
  it('aynı jetonla ürün URL’si tekrarlanır (ortak sayfa önbelleği)', () => {
    beginNavCache('run-token');
    try {
      const a = withCacheBust('http://local.test', '/product/fixed');
      const b = withCacheBust('http://local.test', '/product/fixed');
      assert.equal(a, b);
      assert.match(a, /wdp_e2e=run-token/);
    } finally {
      endNavCache();
    }
  });

  it('endNavCache sonrası jeton düşer; her goto benzersiz', () => {
    beginNavCache('run-token');
    endNavCache();
    const a = withCacheBust('http://local.test', '/p');
    const b = withCacheBust('http://local.test', '/p');
    assert.equal(/wdp_e2e=run-token/.test(a), false);
    assert.notEqual(a, b);
  });
});
