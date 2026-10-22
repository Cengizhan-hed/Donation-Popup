import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  compareCanary,
  preflightCanary,
  formatCanaryDiff,
  evaluateCanaryAgainstBaseline,
  evaluateCanaryHealth,
  formatCanaryStatusLine,
  writeCanaryAlert,
  CANARY_ALERT_PATH,
} from '../../../tests/e2e/helpers/canary.mjs';
import { parseCanaryArgs, runCanary } from '../../../tests/e2e/run-canary.mjs';
import { evaluateBootstrapCanary } from '../../../scripts/e2e-bootstrap.mjs';
import { evaluateDeleteGuard, evaluateUserDeleteGuard } from '../../../tests/e2e/helpers/safe-remote-write.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

function blogHomeSnap(extraOptions = {}, extraPosts = []) {
  return {
    posts: extraPosts,
    options: {
      show_on_front: 'posts',
      page_on_front: '0',
      page_for_posts: '0',
      woocommerce_cart_page_id: '0',
      woocommerce_checkout_page_id: '0',
      woocommerce_myaccount_page_id: '0',
      woocommerce_shop_page_id: '0',
      woocommerce_terms_page_id: '0',
      ...extraOptions,
    },
    user_count: 1,
    page_count: extraPosts.filter((p) => p.type === 'page').length,
    product_count: 0,
    attachment_count: 0,
  };
}

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
    assert.ok(h.diffs.some((d) => d.option === 'woocommerce_cart_page_id' && d.change === 'core-bad-status' && d.status === 'trash'));
    assert.match(formatCanaryDiff(h), /çöpte|taslakta|çekirdek/);
  });

  it('ön kontrol: page_for_posts=0 sorun değil', () => {
    const snap = blogHomeSnap({
      woocommerce_cart_page_id: '4',
      woocommerce_checkout_page_id: '5',
      page_for_posts: '0',
    }, [
      { id: 4, type: 'page', status: 'publish', modified: 'a', mark: '' },
      { id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' },
    ]);
    const h = preflightCanary(snap);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.equal(h.diffs.some((d) => d.option === 'page_for_posts'), false);
  });

  it('ön kontrol: show_on_front=posts + page_on_front=0 sorun değil', () => {
    const snap = blogHomeSnap({
      woocommerce_cart_page_id: '4',
      woocommerce_checkout_page_id: '5',
    }, [
      { id: 4, type: 'page', status: 'publish', modified: 'a', mark: '' },
      { id: 5, type: 'page', status: 'publish', modified: 'a', mark: '' },
    ]);
    const h = preflightCanary(snap);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.equal(
      h.diffs.some((d) => d.option === 'page_on_front' || d.option === 'show_on_front'),
      false
    );
  });

  it('ön kontrol: checkout id=0 uyarı, engel değil', () => {
    const snap = blogHomeSnap({
      woocommerce_cart_page_id: '4',
      woocommerce_checkout_page_id: '0',
    }, [{ id: 4, type: 'page', status: 'publish', modified: 'a', mark: '' }]);
    const h = preflightCanary(snap);
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.ok(h.warnings.some((d) => d.option === 'woocommerce_checkout_page_id' && d.change === 'core-unset' && d.id === 0));
    assert.match(formatCanaryDiff(h), /woocommerce_checkout_page_id/);
  });

  it('bootstrap KIRMIZI uyarısı gerçek option/id/durum yazar (pre-bootstrap yok)', () => {
    const snap = blogHomeSnap(
      { woocommerce_cart_page_id: '8', woocommerce_checkout_page_id: '0' },
      [{ id: 8, type: 'page', status: 'trash', modified: 'a', mark: '' }]
    );
    const health = evaluateBootstrapCanary('local', snap, { created: [], mutated: [] }, { baseline: snap });
    assert.equal(health.ok, false);
    assert.ok(health.diffs.some((d) => d.option === 'woocommerce_cart_page_id' && d.id === 8 && d.status === 'trash'));
    assert.equal(
      health.diffs.some((d) => d.change === 'pre-bootstrap'),
      false
    );
    const file = writeCanaryAlert(
      { ok: false, diffs: health.diffs, warnings: health.warnings },
      'e2e:bootstrap önce kanarya'
    );
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(file, CANARY_ALERT_PATH);
    assert.match(text, /woocommerce_cart_page_id/);
    assert.match(text, /id=8/);
    assert.match(text, /trash/);
    assert.doesNotMatch(text, /pre-bootstrap/);
    assert.doesNotMatch(text, /\{"change":"pre-bootstrap"\}/);
    assert.doesNotMatch(text, /post_content|post_title|<p>/);
  });
});

describe('run-canary', () => {
  it('CLI dosyası path import ile yüklenir ve parse eder (ağ yok)', () => {
    const script = path.join(ROOT, 'tests/e2e/run-canary.mjs');
    const src = fs.readFileSync(script, 'utf8');
    assert.match(src, /import path from 'node:path'/);
    const parsed = parseCanaryArgs(['--env', 'local']);
    assert.equal(parsed.envName, 'local');
    const r = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { parseCanaryArgs } from ${JSON.stringify(pathToFileURL(script).href)};
         const a = parseCanaryArgs(['--env', 'local']);
         if (a.envName !== 'local') process.exit(2);
         console.log('ok');`,
      ],
      {
        encoding: 'utf8',
        cwd: ROOT,
        timeout: 10000,
        env: { ...process.env, WDP_UNIT_TEST: '1' },
      }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /ok/);
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /path is not defined/);
    assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /ReferenceError/);
  });

  it('sahte ölçümle çalışır: page_for_posts=0 TEMİZ, checkout uyarı (ağ yok)', () => {
    const snap = blogHomeSnap({
      woocommerce_cart_page_id: '4',
      woocommerce_checkout_page_id: '0',
      page_for_posts: '0',
    }, [{ id: 4, type: 'page', status: 'publish', modified: 'a', mark: '' }]);
    const r = runCanary({
      envName: 'local',
      snapshotFn: () => snap,
      registry: { created: [], mutated: [] },
      baseline: snap,
    });
    assert.equal(r.ok, true, JSON.stringify(r.diffs));
    assert.equal(r.status, 'TEMİZ');
    assert.ok(r.warnings.some((d) => d.option === 'woocommerce_checkout_page_id'));
  });

  it('ön kontrol kırmızısında CANARY-ALERT option/id/durum yazar', () => {
    const snap = blogHomeSnap(
      { woocommerce_cart_page_id: '8', woocommerce_checkout_page_id: '9' },
      [
        { id: 8, type: 'page', status: 'trash', modified: 'a', mark: '' },
        { id: 9, type: 'page', status: 'publish', modified: 'a', mark: '' },
      ]
    );
    const r = runCanary({
      envName: 'local',
      snapshotFn: () => snap,
      registry: { created: [], mutated: [] },
      baseline: snap,
    });
    assert.equal(r.ok, false);
    const text = fs.readFileSync(CANARY_ALERT_PATH, 'utf8');
    assert.match(text, /woocommerce_cart_page_id/);
    assert.match(text, /id=8/);
    assert.doesNotMatch(text, /\{"change":"pre-bootstrap"\}/);
  });
});

describe('evaluateCanaryHealth', () => {
  it('staging30 tipi: page_for_posts=0 + blog ana sayfa, baseline aynı → TEMİZ', () => {
    const snap = blogHomeSnap({
      woocommerce_cart_page_id: '20',
      woocommerce_checkout_page_id: '21',
    }, [
      { id: 20, type: 'page', status: 'publish', modified: 'a', mark: '' },
      { id: 21, type: 'page', status: 'publish', modified: 'a', mark: '' },
    ]);
    const h = evaluateCanaryHealth(snap, 'local', { created: [], mutated: [] }, {
      allowMissingBaseline: true,
      baseline: snap,
    });
    assert.equal(h.ok, true, JSON.stringify(h.diffs));
    assert.equal(h.pre.ok, true);
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
