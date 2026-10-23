/**
 * e2e:bootstrap dry-run — uzak yazma yok.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  describeBootstrapPlan,
  AMOUNT_PRESET_FIXTURE_META,
  fixtureProductRecords,
} from '../../../tests/e2e/helpers/fixtures.mjs';
import {
  parseArgs,
  registerRepairTargetsMutated,
  ensureRepairRegistry,
} from '../../../scripts/e2e-bootstrap.mjs';
import { updateCanaryBaselineIfClean } from '../../../tests/e2e/helpers/canary.mjs';
import { checkRemoteTarget, ALLOWED_DEPLOY_TARGETS, buildGuardedEvalFileCommand } from '../../../scripts/lib/deploy-guards.mjs';
import {
  loadRegistry,
  setRegistryRootForTest,
  resetRegistryTestHooks,
} from '../../../tests/e2e/helpers/run-registry.mjs';
import { isolateUnitProfile, setActiveProfile } from '../../../tests/e2e/helpers/profile.mjs';

const SCRIPT = path.join(ROOT, 'scripts/e2e-bootstrap.mjs');

function runBootstrap(args) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT, timeout: 20000 });
}

afterEach(() => {
  resetRegistryTestHooks();
});

describe('e2e:bootstrap dry-run', () => {
  it('--env staging --dry-run uzak yazmadan plan listeler', () => {
    const r = runBootstrap(['--env', 'staging', '--dry-run']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const plan = JSON.parse(r.stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.remoteWrite, false);
    assert.equal(plan.createsPages, false);
    assert.equal(plan.createsMenus, false);
    assert.equal(plan.createsCategories, false);
    assert.equal(plan.uploadsMedia, false);
    assert.equal(plan.changesSiteSettings, false);
    assert.equal(plan.status, 'private');
    assert.equal(plan.catalogVisible, false);
    assert.equal(plan.searchVisible, false);
    assert.match(plan.mark, /^_wdp_e2e_test=/);
    assert.ok(Array.isArray(plan.products) && plan.products.length >= 4);
    assert.ok(plan.products.every((p) => p.status === 'private' && p.catalogVisible === false));
  });

  it('--env ikram --dry-run aynı güvenlik alanları', () => {
    const r = runBootstrap(['--env', 'ikram', '--dry-run']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const plan = JSON.parse(r.stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.remoteWrite, false);
    assert.equal(plan.env, 'ikram-aid');
  });

  it('--env local --dry-run plan üretir', () => {
    const r = runBootstrap(['--env', 'local', '--dry-run']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const plan = JSON.parse(r.stdout);
    assert.equal(plan.env, 'local');
    assert.equal(plan.would, 'create');
    const shaped = describeBootstrapPlan('local', 'boot-dry', { dryRun: true });
    assert.equal(shaped.createsPages, false);
  });

  it('--remove-fixtures bayrağı parse edilir', () => {
    const a = parseArgs(['--env', 'ikram', '--remove-fixtures']);
    assert.equal(a.remove, true);
    assert.equal(a.envId, 'ikram');
    const b = parseArgs(['--env', 'staging', '--remove']);
    assert.equal(b.remove, true);
  });

  it('--repair --dry-run uzak yazmadan liste üretir', () => {
    const a = parseArgs(['--env', 'staging', '--repair', '--dry-run']);
    assert.equal(a.repair, true);
    assert.equal(a.dry, true);
    const r = runBootstrap(['--env', 'local', '--repair', '--dry-run']);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const plan = JSON.parse(r.stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.action, 'repair');
    assert.equal(plan.remoteWrite, false);
    assert.equal(plan.changesSiteSettings, false);
    assert.equal(plan.createsPages, false);
  });

  it('baseline yalnız TEMİZ karşılaştırmada yazılır (karar, disk yok)', () => {
    const skip = updateCanaryBaselineIfClean('local', { posts: [] }, { ok: false });
    assert.equal(skip.updated, false);
    assert.equal(skip.file, null);
  });

  it('uzak bootstrap PHP yazma kancası (sayfa/option/menü) yok; kilitten geçer', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/bootstrap-e2e-products.php'), 'utf8');
    assert.equal(/\bwp_insert_post\s*\([^)]*page/.test(src), false);
    assert.equal(/\bupdate_option\b/.test(src), false);
    assert.equal(/\bwp_update_nav_menu/.test(src), false);
    assert.equal(/\bwp_insert_attachment\b/.test(src), false);
    assert.equal(/\bwp_set_object_terms\b/.test(src), false);
    assert.match(src, /set_catalog_visibility\('hidden'\)/);
    assert.match(src, /set_status\('private'\)/);
    for (const target of ALLOWED_DEPLOY_TARGETS) {
      const cmd = buildGuardedEvalFileCommand(target.wpPath, {
        tmpPrefix: 'wdp-eval',
        extraArgs: 'upsert',
      }).replace(`wp --path=`, `WDP_E2E_RUN_ID='boot-dry' wp --path=`);
      const r = checkRemoteTarget({
        alias: target.sshAlias,
        wpPath: target.wpPath,
        siteUrl: target.siteUrl,
        remoteCommand: cmd,
      });
      assert.equal(r.ok, true, r.reason);
    }
  });

  it('--repair yazmadan önce registerMutated (kaynak sırası)', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const reg = src.indexOf('registerRepairTargetsMutated(');
    const writeLocal = src.indexOf("runLocalPhp('repair'");
    const writeRemote = src.indexOf('runEvalFile(REMOTE_BOOTSTRAP_PHP');
    assert.ok(reg > 0, 'registerRepairTargetsMutated yok');
    assert.ok(reg < writeLocal && reg < writeRemote, 'registerMutated yazmadan önce olmalı');
    assert.match(src, /compareWithRegistry\(before, after/);
  });

  it('etkin profil uzakken repair mutated yazar; işaretsiz RED (ağ yok)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-3w-reg-'));
    setRegistryRootForTest(dir);
    const restore = isolateUnitProfile({
      id: 'staging-hedef',
      remote: true,
      allowedHosts: ['staging30.example.test'],
      baseUrl: 'https://staging30.example.test',
    });
    try {
      setActiveProfile({
        id: 'staging-hedef',
        remote: true,
        baseUrl: 'https://staging30.example.test',
      });
      const fixtures = {
        runId: 'boot-3w-aaaa',
        roles: { custom: { id: 25914, mark: 'boot-3w-aaaa', type: 'product' } },
      };
      ensureRepairRegistry(
        { id: 'staging-hedef', baseUrl: 'https://staging30.example.test' },
        'boot-3w-aaaa',
        fixtures
      );
      registerRepairTargetsMutated([{ id: 25914, role: 'custom' }], fixtures);
      const r = loadRegistry('staging-hedef');
      assert.equal(r.envId, 'staging-hedef');
      assert.equal(r.mutated.length, 1);
      assert.equal(r.mutated[0].id, 25914);
      assert.equal(r.mutated[0].type, 'product');
      assert.ok(r.mutated[0].keys.includes('_price'));
      assert.throws(
        () => registerRepairTargetsMutated([{ id: 10720, role: 'catalog' }], fixtures),
        /REPAIR-RED: işaretsiz/
      );
      assert.equal(loadRegistry('staging-hedef').mutated.length, 1);
    } finally {
      restore();
    }
  });

  it('custom fixture tutar ön ayarı bootstrap PHP ile aynı kaynak', () => {
    const php = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/bootstrap-e2e-products.php'), 'utf8');
    assert.equal(AMOUNT_PRESET_FIXTURE_META._enable_amount_presets, 'yes');
    assert.equal(AMOUNT_PRESET_FIXTURE_META._amount_presets, '10,25,50,1234');
    assert.match(php, /'_enable_amount_presets'\s*=>\s*'yes'/);
    assert.match(php, /'_amount_presets'\s*=>\s*'10,25,50,1234'/);
  });

  it('fixtureProductRecords published/status kopyalar (list-visible önkoşul)', () => {
    const recs = fixtureProductRecords({
      runId: 'run-a',
      roles: {
        custom: { id: 12, mark: 'run-a', published: true, status: 'publish' },
        shares: { id: 14, mark: 'run-a', status: 'private' },
      },
    });
    const custom = recs.find((r) => r.id === 12);
    const shares = recs.find((r) => r.id === 14);
    assert.equal(custom.published, true);
    assert.equal(custom.status, 'publish');
    assert.equal(shares.status, 'private');
    assert.equal(shares.published, false);
  });
});
