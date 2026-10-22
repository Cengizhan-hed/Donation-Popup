/**
 * e2e:bootstrap dry-run — uzak yazma yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { describeBootstrapPlan } from '../../../tests/e2e/helpers/fixtures.mjs';
import { checkRemoteTarget, ALLOWED_DEPLOY_TARGETS } from '../../../scripts/lib/deploy-guards.mjs';

const SCRIPT = path.join(ROOT, 'scripts/e2e-bootstrap.mjs');

function runBootstrap(args) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT, timeout: 20000 });
}

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
      const wp = target.wpPath.replace(/'/g, `'\\''`);
      const cmd = [
        `TMP=$(mktemp /tmp/wdp-eval-XXXX.php)`,
        `echo 'YmFzZTY0' | base64 -d > "$TMP"`,
        `WDP_E2E_RUN_ID='boot-dry' wp eval-file "$TMP" upsert --path='${wp}'`,
        `EC=$?`,
        `rm -f "$TMP"`,
        `exit $EC`,
      ].join('\n');
      const r = checkRemoteTarget({
        alias: target.sshAlias,
        wpPath: target.wpPath,
        siteUrl: target.siteUrl,
        remoteCommand: cmd,
      });
      assert.equal(r.ok, true, r.reason);
    }
  });
});
