import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCanary,
  preflightCanary,
  formatCanaryDiff,
} from '../../../tests/e2e/helpers/canary.mjs';
import { evaluateDeleteGuard, evaluateUserDeleteGuard } from '../../../tests/e2e/helpers/safe-remote-write.mjs';

describe('canary', () => {
  it('kayıt defteri dışı silinen sayfa kırmızı', () => {
    const before = {
      posts: [{ id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' }],
      options: { show_on_front: 'page', page_on_front: '5' },
      user_count: 2,
    };
    const after = {
      posts: [{ id: 5, type: 'page', status: 'trash', modified: 'b', mark: '' }],
      options: { show_on_front: 'posts', page_on_front: '0' },
      user_count: 1,
    };
    const cmp = compareCanary(before, after, { allowedCreatedIds: [] });
    assert.equal(cmp.ok, false);
    assert.ok(cmp.diffs.some((d) => d.change === 'status'));
    assert.ok(cmp.diffs.some((d) => d.option === 'show_on_front'));
    assert.ok(cmp.diffs.some((d) => d.option === 'user_count'));
  });

  it('ön kontrol: çöpteki sepet kırmızı', () => {
    const snap = {
      posts: [
        { id: 1, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 8, type: 'page', status: 'trash', modified: 'a', mark: '' },
        { id: 9, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 10, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 11, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 12, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 13, type: 'page', status: 'publish', modified: 'a', mark: '' },
      ],
      options: {
        page_on_front: '1',
        page_for_posts: '10',
        woocommerce_cart_page_id: '8',
        woocommerce_checkout_page_id: '9',
        woocommerce_myaccount_page_id: '11',
        woocommerce_shop_page_id: '12',
        woocommerce_terms_page_id: '13',
        show_on_front: 'page',
      },
    };
    const h = preflightCanary(snap);
    assert.equal(h.ok, false);
    assert.ok(h.diffs.some((d) => d.option === 'woocommerce_cart_page_id'));
    assert.match(formatCanaryDiff(h), /çöpte|taslakta|çekirdek/);
  });
});

describe('safe-remote-write guards', () => {
  it('page/attachment silinmez; boş defter silmez', () => {
    assert.equal(
      evaluateDeleteGuard({
        id: 3,
        expectedType: 'page',
        registryIds: [3],
        coreIds: [],
        runId: 'run-abc',
        post: { type: 'page', mark: 'run-abc' },
      }).ok,
      false
    );
    assert.equal(
      evaluateDeleteGuard({
        id: 3,
        expectedType: 'product',
        registryIds: [],
        coreIds: [],
        runId: 'run-abc',
        post: { type: 'product', mark: 'run-abc' },
      }).reason,
      'empty-registry'
    );
  });

  it('kullanıcı: içerik varsa reddedilir; reassign kararı içerik yokken', () => {
    const g = evaluateUserDeleteGuard({
      id: 4,
      registryIds: [4],
      runId: 'run-abc',
      email: 'e2e.x@wdp-e2e.test',
      userMark: 'run-abc',
      ownedPosts: [{ id: 9, type: 'page', mark: '' }],
    });
    assert.equal(g.ok, false);
    assert.equal(g.reason, 'user-has-content');
  });
});
