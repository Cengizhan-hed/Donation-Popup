import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  resetRegistry,
  loadRegistry,
  registerCreated,
  saveRegistry,
  setRegistryRootForTest,
  resetRegistryTestHooks,
  REGISTRY_ENV_MISMATCH,
} from '../../../tests/e2e/helpers/run-registry.mjs';
import { setActiveProfile, clearActiveProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { cleanupE2EData } from '../../../tests/e2e/helpers/test-cleanup.mjs';
import { compareWithRegistry } from '../../../tests/e2e/helpers/canary.mjs';
import { runCanary } from '../../../tests/e2e/run-canary.mjs';
import {
  acquireEnvLock,
  releaseEnvLock,
  setLockDirForTest,
  resetLockTestHooks,
  isPidAlive,
} from '../../../tests/e2e/helpers/env-lock.mjs';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function clearLockEnv() {
  delete process.env.WDP_E2E_ENV_LOCK_SHARED;
  delete process.env.WDP_E2E_ENV_LOCK_PID;
  delete process.env.WDP_E2E_PROFILE_ID;
  delete process.env.WDP_E2E_RUN_ID;
}

afterEach(() => {
  resetRegistryTestHooks();
  resetLockTestHooks();
  clearActiveProfile();
  clearLockEnv();
});

describe('koşu defteri ortam ayrımı', () => {
  it('iki farklı profil defteri karışmaz', () => {
    const root = tmpDir('wdp-reg-');
    setRegistryRootForTest(root);
    setActiveProfile({ id: 'local', baseUrl: 'http://127.0.0.1:8899' });
    resetRegistry('run-local-aaaa', { envId: 'local', siteUrl: 'http://127.0.0.1:8899' });
    registerCreated({ id: 25, type: 'order' });
    registerCreated({ id: 26, type: 'order' });

    setActiveProfile({ id: 'ikram-aid', baseUrl: 'https://ikramaid.uk' });
    resetRegistry('run-ikram-bbbb', { envId: 'ikram-aid', siteUrl: 'https://ikramaid.uk' });
    registerCreated({ id: 99, type: 'order' });

    const local = loadRegistry('local');
    const ikram = loadRegistry('ikram-aid');
    assert.equal(local.envId, 'local');
    assert.deepEqual(
      local.created.map((x) => x.id),
      [25, 26]
    );
    assert.equal(ikram.envId, 'ikram-aid');
    assert.deepEqual(
      ikram.created.map((x) => x.id),
      [99]
    );
    assert.ok(fs.existsSync(path.join(root, 'local', 'run-local-aaaa.json')));
    assert.ok(fs.existsSync(path.join(root, 'ikram-aid', 'run-ikram-bbbb.json')));
  });

  it('envId uyuşmazlığında cleanup spawn çağırmaz', async () => {
    const root = tmpDir('wdp-reg-mm-');
    setRegistryRootForTest(root);
    setActiveProfile({ id: 'ikram-aid', baseUrl: 'https://ikramaid.uk' });
    resetRegistry('run-ikram-cccc', { envId: 'ikram-aid', siteUrl: 'https://ikramaid.uk' });
    saveRegistry(
      {
        runId: 'run-ikram-cccc',
        envId: 'local',
        created: [
          { id: 25, type: 'order', source: 'run' },
          { id: 26, type: 'order', source: 'run' },
        ],
        mutated: [{ id: 12, type: 'product' }],
        fixtures: [],
      },
      'ikram-aid'
    );
    let spawned = 0;
    await assert.rejects(
      () =>
        cleanupE2EData({
          envId: 'ikram-aid',
          execFn: () => {
            spawned += 1;
            return '{"orders_deleted":0}';
          },
        }),
      (err) => String(err && err.message).includes(REGISTRY_ENV_MISMATCH)
    );
    assert.equal(spawned, 0);
  });

  it('envId uyuşmazlığında kanarya snapshot çağırmaz', () => {
    let called = 0;
    const snap = {
      posts: [],
      options: {
        show_on_front: 'posts',
        page_on_front: '0',
        page_for_posts: '0',
        woocommerce_cart_page_id: '0',
        woocommerce_checkout_page_id: '0',
        woocommerce_myaccount_page_id: '0',
        woocommerce_shop_page_id: '0',
        woocommerce_terms_page_id: '0',
      },
      user_count: 1,
      page_count: 0,
      product_count: 0,
      attachment_count: 0,
    };
    assert.throws(
      () =>
        runCanary({
          envName: 'ikram',
          snapshotFn: () => {
            called += 1;
            return snap;
          },
          registry: {
            envId: 'local',
            created: [{ id: 25, type: 'order' }],
            mutated: [{ id: 12, type: 'product' }],
          },
          baseline: snap,
          fixtures: null,
        }),
      (err) => String(err && err.message).includes(REGISTRY_ENV_MISMATCH)
    );
    assert.equal(called, 0);
    assert.throws(
      () =>
        compareWithRegistry(snap, snap, {
          envId: 'local',
          created: [{ id: 12, type: 'product' }],
          mutated: [{ id: 12, type: 'product' }],
        }, { envId: 'ikram-aid' }),
      (err) => String(err && err.message).includes(REGISTRY_ENV_MISMATCH)
    );
  });
});

describe('ortam kilidi', () => {
  it('aynı profil ikinci koşuyu reddeder, farklı profil geçer; ölü pid temizlenir', () => {
    const dir = tmpDir('wdp-lock-');
    setLockDirForTest(dir);
    const a = acquireEnvLock('local', { command: 'e2e:quick' });
    assert.equal(a.shared, false);
    assert.equal(isPidAlive(process.pid), true);
    assert.throws(() => acquireEnvLock('local', { command: 'e2e:full' }), /ENV-LOCK/);
    const b = acquireEnvLock('ikram-aid', { command: 'e2e:quick' });
    assert.equal(b.envId, 'ikram-aid');
    releaseEnvLock(b);

    const dead = path.join(dir, 'staging-hedef.lock');
    fs.writeFileSync(
      dead,
      JSON.stringify({ pid: 99999999, startedAt: '2026-01-01T00:00:00.000Z', command: 'dead' }) + '\n'
    );
    const c = acquireEnvLock('staging-hedef', { command: 'e2e:canary' });
    assert.equal(c.shared, false);
    releaseEnvLock(c);
    releaseEnvLock(a);
  });
});
