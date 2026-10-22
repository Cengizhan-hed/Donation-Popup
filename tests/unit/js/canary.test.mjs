import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCanary,
  preflightCanary,
  formatCanaryDiff,
  evaluateCanaryAgainstBaseline,
  formatCanaryStatusLine,
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

  it('defterdeki yeni ürün product_count artışını bekler', () => {
    const before = {
      posts: [{ id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' }],
      options: { show_on_front: 'page' },
      user_count: 2,
      page_count: 1,
      product_count: 0,
      attachment_count: 0,
    };
    const after = {
      posts: [
        { id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 80, type: 'product', status: 'private', modified: 'b', mark: 'boot-1' },
      ],
      options: { show_on_front: 'page' },
      user_count: 2,
      page_count: 1,
      product_count: 1,
      attachment_count: 0,
    };
    const cmp = compareCanary(before, after, { allowedCreatedIds: [80] });
    assert.equal(cmp.ok, true, JSON.stringify(cmp.diffs));
  });

  it('sahte ölçüm: temiz (baseline = current)', () => {
    const snap = {
      posts: [{ id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' }],
      options: { show_on_front: 'page' },
      user_count: 2,
      page_count: 1,
      product_count: 0,
      attachment_count: 0,
    };
    const r = evaluateCanaryAgainstBaseline(snap, snap, { created: [], mutated: [] });
    assert.equal(r.ok, true);
    assert.equal(r.status, 'TEMİZ');
    assert.equal(r.canUpdate, true);
  });

  it('sahte ölçüm: defter içi fark TEMİZ ve --update-baseline izinli', () => {
    const before = {
      posts: [{ id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' }],
      options: { show_on_front: 'page' },
      user_count: 2,
      page_count: 1,
      product_count: 0,
      attachment_count: 0,
    };
    const after = {
      posts: [
        { id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' },
        { id: 80, type: 'product', status: 'private', modified: 'b', mark: 'boot-1' },
      ],
      options: { show_on_front: 'page' },
      user_count: 2,
      page_count: 1,
      product_count: 1,
      attachment_count: 0,
    };
    const r = evaluateCanaryAgainstBaseline(before, after, {
      created: [{ id: 80, type: 'product' }],
      mutated: [],
    });
    assert.equal(r.ok, true, JSON.stringify(r.diffs));
    assert.equal(r.canUpdate, true);
    assert.equal(r.status, 'TEMİZ');
  });

  it('sahte ölçüm: defter dışı fark KIRMIZI, --update-baseline yok', () => {
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
    const r = evaluateCanaryAgainstBaseline(before, after, { created: [], mutated: [] });
    assert.equal(r.ok, false);
    assert.equal(r.canUpdate, false);
    assert.equal(r.status, 'KIRMIZI');
  });

  it('baseline yok: KIRMIZI; --update-baseline ile ilk yazı TEMİZ', () => {
    const snap = {
      posts: [{ id: 1, type: 'page', status: 'publish', modified: 'a', mark: '' }],
      options: { show_on_front: 'page' },
    };
    const red = evaluateCanaryAgainstBaseline(null, snap, { created: [], mutated: [] });
    assert.equal(red.ok, false);
    assert.equal(red.missingBaseline, true);
    const write = evaluateCanaryAgainstBaseline(null, snap, { created: [], mutated: [] }, { updateBaseline: true });
    assert.equal(write.ok, true);
    assert.equal(write.canUpdate, true);
  });

  it('Kanarya satırı TEMİZ/KIRMIZI', () => {
    assert.equal(
      formatCanaryStatusLine(true, true, 7),
      'Kanarya: önce TEMİZ, sonra TEMİZ (beklenen yeni: 7 ürün)'
    );
    assert.equal(
      formatCanaryStatusLine(false, true, 0),
      'Kanarya: önce KIRMIZI, sonra TEMİZ (beklenen yeni: 0 ürün)'
    );
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
