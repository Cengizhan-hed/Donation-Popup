import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  compareCanary,
  compareWithRegistry,
  preflightCanary,
  formatCanaryDiff,
  evaluateCanaryAgainstBaseline,
  evaluateCanaryHealth,
  formatCanaryStatusLine,
  writeCanaryAlert,
  updateCanaryBaselineIfClean,
  canaryAlertPath,
  writeSnapshot,
  readSnapshot,
} from '../../../tests/e2e/helpers/canary.mjs';
import { verifiedFixtureIds } from '../../../tests/e2e/helpers/fixtures.mjs';
import { parseCanaryArgs, runCanary } from '../../../tests/e2e/run-canary.mjs';
import { evaluateBootstrapCanary } from '../../../scripts/e2e-bootstrap.mjs';
import { evaluateDeleteGuard, evaluateUserDeleteGuard } from '../../../tests/e2e/helpers/safe-remote-write.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { isolateUnitProfile } from '../../../tests/e2e/helpers/profile.mjs';

let restoreUnitProfile = () => {};
beforeEach(() => {
  restoreUnitProfile = isolateUnitProfile({ id: 'local', remote: false, allowedHosts: ['127.0.0.1'] });
});
afterEach(() => {
  restoreUnitProfile();
});

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
      'e2e:bootstrap önce kanarya',
      'local'
    );
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(file, canaryAlertPath('local'));
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
      fixtures: null,
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
      fixtures: null,
    });
    assert.equal(r.ok, false);
    const text = fs.readFileSync(canaryAlertPath('local'), 'utf8');
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

  it('fixture ürün silinmez (fixture-protected)', () => {
    const g = evaluateDeleteGuard({
      id: 913,
      expectedType: 'product',
      registryIds: [913],
      coreIds: [],
      runId: 'run-abc',
      post: { type: 'product', mark: 'run-abc', status: 'private' },
      fixtureIds: [913],
    });
    assert.equal(g.ok, false);
    assert.equal(g.reason, 'fixture-protected');
  });
});

const FIXTURE_IDS = [913, 914, 915, 916, 917, 918, 919];
const FIXTURE_MARK = 'boot-abc';

function catalogPosts() {
  return [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    type: 'product',
    status: 'publish',
    modified: 'a',
    mark: '',
  }));
}

function fixturePosts(overrides = {}) {
  return FIXTURE_IDS.map((id) => ({
    id,
    type: 'product',
    status: 'private',
    modified: 'b',
    mark: FIXTURE_MARK,
    ...overrides,
  }));
}

function fixtureFile(mark = FIXTURE_MARK) {
  const roles = {};
  const names = ['custom', 'fixed', 'shares', 'campaign', 'sadaka', 'goal-reached', 'empty-price'];
  names.forEach((role, i) => {
    roles[role] = { id: FIXTURE_IDS[i], mark, type: 'product' };
  });
  return { runId: mark, roles };
}

function countSnap(posts) {
  return {
    posts,
    options: { show_on_front: 'posts' },
    user_count: 1,
    page_count: posts.filter((p) => p.type === 'page').length,
    product_count: posts.filter((p) => p.type === 'product').length,
    attachment_count: 0,
  };
}

describe('kanarya fixture birleşimi', () => {
  it('boş defter + doğrulanmış 7 fixture TEMİZ (product_count 6→13)', () => {
    const baseline = countSnap(catalogPosts());
    const current = countSnap([...catalogPosts(), ...fixturePosts()]);
    const fixtures = fixtureFile();
    assert.deepEqual(verifiedFixtureIds(current, fixtures), FIXTURE_IDS);
    const r = evaluateCanaryAgainstBaseline(baseline, current, { created: [], mutated: [] }, { fixtures });
    assert.equal(r.ok, true, JSON.stringify(r.diffs));
    assert.equal(r.status, 'TEMİZ');
    assert.equal(r.canUpdate, true);
  });

  it('fixture id dosyada değilse KIRMIZI', () => {
    const baseline = countSnap(catalogPosts());
    const current = countSnap([...catalogPosts(), ...fixturePosts()]);
    const fixtures = fixtureFile();
    delete fixtures.roles.custom;
    const r = evaluateCanaryAgainstBaseline(baseline, current, { created: [], mutated: [] }, { fixtures });
    assert.equal(r.ok, false);
    assert.ok(r.diffs.some((d) => d.change === 'created' && d.id === 913));
  });

  it('uzakta işaret fixture ile eşit değilse KIRMIZI', () => {
    const baseline = countSnap(catalogPosts());
    const current = countSnap([...catalogPosts(), ...fixturePosts({ mark: 'other-boot' })]);
    const r = evaluateCanaryAgainstBaseline(baseline, current, { created: [], mutated: [] }, {
      fixtures: fixtureFile(),
    });
    assert.equal(r.ok, false);
    assert.ok(r.diffs.some((d) => d.change === 'created' && Number(d.id) >= 913));
  });

  it('durum private değilse KIRMIZI', () => {
    const baseline = countSnap(catalogPosts());
    const current = countSnap([...catalogPosts(), ...fixturePosts({ status: 'publish' })]);
    const r = evaluateCanaryAgainstBaseline(baseline, current, { created: [], mutated: [] }, {
      fixtures: fixtureFile(),
    });
    assert.equal(r.ok, false);
    assert.ok(r.diffs.some((d) => d.change === 'created'));
  });

  it('fixture silinince allowedDeleted + product_count düşüşü TEMİZ', () => {
    const before = countSnap([...catalogPosts(), ...fixturePosts()]);
    const after = countSnap(catalogPosts());
    const cmp = compareCanary(before, after, { allowedDeletedIds: FIXTURE_IDS });
    assert.equal(cmp.ok, true, JSON.stringify(cmp.diffs));
  });

  it('beklenmeyen sayfa farkı varken fixture TEMİZ sayılmaz', () => {
    const baseline = countSnap([
      ...catalogPosts(),
      { id: 50, type: 'page', status: 'publish', modified: 'a', mark: '' },
    ]);
    const current = countSnap([...catalogPosts(), ...fixturePosts()]);
    current.page_count = 0;
    const r = evaluateCanaryAgainstBaseline(baseline, current, { created: [], mutated: [] }, {
      fixtures: fixtureFile(),
    });
    assert.equal(r.ok, false);
    assert.ok(r.diffs.some((d) => d.change === 'deleted' && d.id === 50));
    assert.equal(updateCanaryBaselineIfClean('local', current, r).updated, false);
  });

  it('runCanary boş defter + doğrulanmış fixture TEMİZ (ağ yok)', () => {
    const baseline = countSnap(catalogPosts());
    const current = countSnap([...catalogPosts(), ...fixturePosts()]);
    const r = runCanary({
      envName: 'local',
      snapshotFn: () => current,
      registry: { created: [], mutated: [], fixtures: [] },
      baseline,
      fixtures: fixtureFile(),
    });
    assert.equal(r.ok, true, JSON.stringify(r.diffs));
    assert.equal(r.status, 'TEMİZ');
  });

  it('compareWithRegistry envId olmadan disk fixture yüklemez', () => {
    const snap = countSnap(catalogPosts());
    const cmp = compareWithRegistry(snap, snap, { created: [], mutated: [] });
    assert.equal(cmp.ok, true);
  });
});

describe('repair kanarya + baseline (3W)', () => {
  it('repair hedefleri beklenen modified → TEMİZ; baseline yalnız işaretli modified', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-3w-clean-'));
    const file = path.join(dir, 'baseline.json');
    const before = countSnap([...catalogPosts(), ...fixturePosts({ modified: 'old' })]);
    const after = countSnap([...catalogPosts(), ...fixturePosts({ modified: 'new' })]);
    writeSnapshot(before, file);
    const registry = {
      created: [],
      mutated: FIXTURE_IDS.map((id) => ({ id, type: 'product', keys: ['_price'] })),
      fixtures: FIXTURE_IDS.map((id) => ({ id, type: 'product', mark: FIXTURE_MARK })),
    };
    const cmp = compareWithRegistry(before, after, registry, { fixtures: fixtureFile() });
    assert.equal(cmp.ok, true, JSON.stringify(cmp.diffs));
    const upd = updateCanaryBaselineIfClean('local', after, cmp, {
      file,
      markedIds: FIXTURE_IDS,
    });
    assert.equal(upd.updated, true);
    const next = readSnapshot(file);
    assert.equal(next.posts.find((p) => p.id === 1).modified, 'a');
    assert.equal(next.posts.find((p) => p.id === 913).modified, 'new');
    assert.equal(next.posts.find((p) => p.id === 919).modified, 'new');
  });

  it('işaretsiz ürün farkı → KIRMIZI ve baseline değişmez', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-3w-red-'));
    const file = path.join(dir, 'baseline.json');
    const before = countSnap([...catalogPosts(), ...fixturePosts({ modified: 'old' })]);
    const after = countSnap([
      { id: 1, type: 'product', status: 'publish', modified: 'hacked', mark: '' },
      ...catalogPosts().slice(1),
      ...fixturePosts({ modified: 'new' }),
    ]);
    writeSnapshot(before, file);
    const beforeRaw = fs.readFileSync(file, 'utf8');
    const registry = {
      created: [],
      mutated: FIXTURE_IDS.map((id) => ({ id, type: 'product', keys: ['_price'] })),
    };
    const cmp = compareWithRegistry(before, after, registry, { fixtures: fixtureFile() });
    assert.equal(cmp.ok, false);
    assert.ok(cmp.diffs.some((d) => d.id === 1 && d.change === 'modified'));
    const upd = updateCanaryBaselineIfClean('local', after, cmp, {
      file,
      markedIds: FIXTURE_IDS,
    });
    assert.equal(upd.updated, false);
    assert.equal(fs.readFileSync(file, 'utf8'), beforeRaw);
    const forced = updateCanaryBaselineIfClean('local', after, { ok: true }, {
      file,
      markedIds: FIXTURE_IDS,
    });
    assert.equal(forced.updated, false);
    assert.equal(fs.readFileSync(file, 'utf8'), beforeRaw);
  });
});

it('acceptUserOptionChanges: yalnız adı verilen seçenekler; yabancı fark reddedilir', async () => {
  const { acceptUserOptionChanges } = await import('../../e2e/helpers/canary.mjs');
  const baseline = { options: { a: 'no', b: 'no', c: 'x' }, posts: [] };
  const current = { options: { a: 'yes', b: 'yes', c: 'x' }, posts: [] };
  const ok = acceptUserOptionChanges(
    baseline,
    current,
    [{ change: 'option', option: 'a' }, { change: 'option', option: 'b' }],
    ['a', 'b']
  );
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.accepted.sort(), ['a', 'b']);
  assert.equal(ok.baseline.options.a, 'yes');
  assert.equal(ok.baseline.options.c, 'x');
  assert.equal(baseline.options.a, 'no', 'girdi değişmez');

  const bad = acceptUserOptionChanges(
    baseline,
    current,
    [{ change: 'option', option: 'a' }, { change: 'modified', id: 5 }],
    ['a']
  );
  assert.equal(bad.ok, false);
  assert.equal(bad.baseline.options.a, 'no');

  assert.equal(acceptUserOptionChanges(baseline, current, [], []).ok, false);
});

it('acceptUserContentChanges: verilen id kabul; dış fark, boş liste, açıklanamayan sayaç reddedilir', async () => {
  const { acceptUserContentChanges } = await import('../../e2e/helpers/canary.mjs');
  const baseline = { posts: [{ id: 1, type: 'page', status: 'publish' }], attachment_count: 4, page_count: 1, options: {} };
  const current = {
    posts: [
      { id: 1, type: 'page', status: 'publish' },
      { id: 50, type: 'elementor_library', status: 'publish' },
      { id: 51, type: 'attachment', status: 'inherit' },
    ],
    attachment_count: 5,
    page_count: 1,
    options: {},
  };
  const diffs = [
    { id: 50, change: 'created', type: 'elementor_library', status: 'publish' },
    { id: 51, change: 'created', type: 'attachment', status: 'inherit' },
    { option: 'attachment_count', change: 'count', from: '4', to: '5' },
  ];
  const ok = acceptUserContentChanges(baseline, current, diffs, [50, '51']);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.accepted, [50, 51]);
  assert.equal(ok.baseline.attachment_count, 5);
  assert.equal(ok.baseline.posts.length, 3);
  assert.equal(baseline.posts.length, 1, 'girdi değişmez');

  // listede olmayan id'nin yeni kaydı dış fark sayılır
  assert.equal(acceptUserContentChanges(baseline, current, diffs, [50]).ok, false);
  // silme gibi başka tür fark
  const del = [...diffs, { id: 9, change: 'deleted', type: 'page', status: 'publish' }];
  assert.equal(acceptUserContentChanges(baseline, current, del, [50, 51]).ok, false);
  // boş liste
  assert.equal(acceptUserContentChanges(baseline, current, diffs, []).ok, false);
  // sayaç farkı yeni kayıt sayısıyla açıklanamıyor
  assert.equal(acceptUserContentChanges(baseline, { ...current, attachment_count: 9 }, diffs, [50, 51]).ok, false);
  // verilen id için yeni kayıt farkı yok
  assert.equal(acceptUserContentChanges(baseline, current, [], [50]).ok, false);
});

it('acceptUserContentChanges: modified kabul, karışık, dış id ve baseline kaydı yok reddi', async () => {
  const { acceptUserContentChanges } = await import('../../e2e/helpers/canary.mjs');
  const baseline = {
    posts: [
      { id: 1, type: 'page', status: 'publish', modified: 'a' },
      { id: 2, type: 'page', status: 'publish', modified: 'b' },
    ],
    attachment_count: 0, page_count: 2, options: {},
  };
  const current = {
    posts: [
      { id: 1, type: 'page', status: 'publish', modified: 'a2' },
      { id: 2, type: 'page', status: 'publish', modified: 'b' },
      { id: 60, type: 'attachment', status: 'inherit', modified: 'c' },
    ],
    attachment_count: 1, page_count: 2, options: {},
  };
  const mod = { id: 1, change: 'modified', type: 'page', from: 'a', to: 'a2' };
  const ok = acceptUserContentChanges(baseline, current, [mod], [1]);
  assert.equal(ok.ok, true);
  assert.equal(ok.baseline.posts.find((p) => p.id === 1).modified, 'a2');
  assert.equal(baseline.posts[0].modified, 'a', 'girdi değişmez');

  const created = { id: 60, change: 'created', type: 'attachment', status: 'inherit' };
  const cnt = { option: 'attachment_count', change: 'count', from: '0', to: '1' };
  const mix = acceptUserContentChanges(baseline, current, [mod, created, cnt], [1, 60]);
  assert.equal(mix.ok, true);
  assert.deepEqual([...mix.accepted].sort((a, b) => a - b), [1, 60]);
  assert.equal(mix.baseline.posts.length, 3);

  const out = { id: 2, change: 'modified', type: 'page', from: 'b', to: 'b2' };
  assert.equal(acceptUserContentChanges(baseline, current, [mod, out], [1]).ok, false);
  const ghost = { id: 99, change: 'modified', type: 'page', from: 'x', to: 'y' };
  assert.equal(acceptUserContentChanges(baseline, current, [ghost], [99]).ok, false);
});

it('acceptUserContentChanges: silinen id sayıyı -1 açıklar; listede yoksa, sayı açıklanamazsa, option farkı reddedilir', async () => {
  const { acceptUserContentChanges } = await import('../../e2e/helpers/canary.mjs');
  const baseline = {
    posts: [{ id: 1, type: 'page', status: 'publish' }, { id: 965, type: 'attachment', status: 'inherit' }],
    attachment_count: 123, page_count: 1, options: {},
  };
  const current = {
    posts: [
      { id: 1, type: 'page', status: 'publish' },
      { id: 1042, type: 'attachment', status: 'inherit' },
      { id: 1044, type: 'attachment', status: 'inherit' },
    ],
    attachment_count: 124, page_count: 1, options: {},
  };
  const diffs = [
    { id: 1042, change: 'created', type: 'attachment', status: 'inherit' },
    { id: 1044, change: 'created', type: 'attachment', status: 'inherit' },
    { id: 965, change: 'deleted', type: 'attachment', status: 'inherit' },
    { option: 'attachment_count', change: 'count', from: '123', to: '124' },
  ];
  const ok = acceptUserContentChanges(baseline, current, diffs, [1042, 1044, 965]);
  assert.equal(ok.ok, true);
  assert.equal(ok.baseline.attachment_count, 124);
  assert.equal(ok.baseline.posts.some((p) => p.id === 965), false, 'silinen tabandan çıkar');
  assert.equal(ok.baseline.posts.length, 3);
  assert.equal(baseline.posts.length, 2, 'girdi değişmez');
  // (b) silinen id listede yok
  assert.equal(acceptUserContentChanges(baseline, current, diffs, [1042, 1044]).ok, false);
  // (c) sayı açıklanamıyor
  assert.equal(acceptUserContentChanges(baseline, { ...current, attachment_count: 126 }, diffs, [1042, 1044, 965]).ok, false);
  // (d) option farkı
  const opt = [...diffs, { option: 'blogname', change: 'changed', from: 'a', to: 'b' }];
  assert.equal(acceptUserContentChanges(baseline, current, opt, [1042, 1044, 965]).ok, false);
});
