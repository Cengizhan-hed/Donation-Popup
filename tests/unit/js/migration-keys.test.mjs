/**
 * Göç anahtar çıkarıcı + salt okunur snapshot PHP taraması.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  extractKeysFromText,
  extractKeysFromTrees,
  extractRemapTable,
  findWriteFunctions,
  optionPrefixes,
  buildKeyset,
} from '../../../scripts/lib/migration-keys.mjs';
import { CURSOR_AGENT_ENV_KEYS } from '../../../scripts/lib/remote-guard.mjs';

const SAMPLE_PHP = `<?php
class Sample {
  const OPTION = 'wdp_button_settings';
  function x($id) {
    $a = get_option('wdp_success_settings', array());
    update_option('wdp_legacy_render_count', 1);
    add_option('hdf_old_flag', '1');
    $b = get_post_meta($id, '_allow_custom_price', true);
    update_post_meta($id, '_min_custom_price', '10');
    $c = get_post_meta($id, '_faq_items', true);
  }
}
`;

describe('migration-keys extractor', () => {
  it('örnek PHP’den seçenek ve meta adlarını çıkarır', () => {
    const r = extractKeysFromText(SAMPLE_PHP);
    assert.ok(r.options.includes('wdp_button_settings'));
    assert.ok(r.options.includes('wdp_success_settings'));
    assert.ok(r.options.includes('wdp_legacy_render_count'));
    assert.ok(r.options.includes('hdf_old_flag'));
    assert.ok(r.meta.includes('_allow_custom_price'));
    assert.ok(r.meta.includes('_min_custom_price'));
    assert.ok(r.meta.includes('_faq_items'));
  });

  it('ağaçtan aynı anahtarları okur', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-mig-keys-'));
    fs.writeFileSync(path.join(dir, 'sample.php'), SAMPLE_PHP);
    const r = extractKeysFromTrees(dir);
    assert.ok(r.options.includes('hdf_old_flag'));
    assert.ok(r.meta.includes('_allow_custom_price'));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('hdf_ önekini seçenek öneklerine ekler', () => {
    const p = optionPrefixes(['wdp_button_settings', 'hdf_old_flag']);
    assert.ok(p.includes('wdp_'));
    assert.ok(p.includes('hdf_'));
  });

  it('class-migrations.php BACKUP eşlemesini çıkarır', () => {
    const php = fs.readFileSync(path.join(ROOT, 'src/Core/class-version-migrations.php'), 'utf8');
    const map = extractRemapTable(php);
    assert.equal(map.wdp_settings_backup_10_27, 'wdp_settings_backup_10_27_restored');
  });

  it('buildKeyset önek ve varsayılan üretir', () => {
    const ks = buildKeyset(extractKeysFromText("get_option('wdp_foo', false);"));
    assert.ok(ks.optionPrefixes.includes('wdp_'));
    assert.equal(ks.defaults.wdp_foo, false);
  });
});

describe('migration-snapshot.php salt okunur', () => {
  it('yazma fonksiyonu içermez', () => {
    const php = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/migration-snapshot.php'), 'utf8');
    const hits = findWriteFunctions(php);
    assert.deepEqual(hits, []);
  });
});

function envNoClaude() {
  const env = { ...process.env, WDP_UNIT_TEST: '1' };
  delete env.CLAUDECODE;
  for (const k of CURSOR_AGENT_ENV_KEYS) delete env[k];
  return env;
}

describe('migration:snapshot uzak', () => {
  it('operatör kapısı yokken --env staging reddedilir (ağ yok; ortam testte kurulur)', () => {
    const r = spawnSync('node', [path.join(ROOT, 'scripts/migration-snapshot.mjs'), '--env', 'staging', '--label', 'x'], {
      encoding: 'utf8',
      cwd: ROOT,
      env: envNoClaude(),
    });
    assert.notEqual(r.status, 0);
    const msg = String(r.stderr || r.stdout || '');
    assert.match(
      msg,
      /UZAK|REMOTE_FREEZE|missing \.env|Kara liste|izin listesi|2026-10-22|yalnız Claude|merkezi koruma|Birim testte gerçek ssh/i
    );
    assert.doesNotMatch(msg, /ssh\s+\S+@/);
    assert.doesNotMatch(msg, /This does not seem to be a WordPress/i);
  });

  it('1A profil hedefi + snapshot komutu kilitten geçer (ağ yok)', async () => {
    const { resolveSnapshotRemoteTarget, buildSnapshotRemoteCommand } = await import(
      '../../../scripts/migration-snapshot.mjs'
    );
    const { checkRemoteTarget } = await import('../../../scripts/lib/deploy-guards.mjs');
    for (const envId of ['staging', 'ikram']) {
      const resolved = resolveSnapshotRemoteTarget(envId);
      assert.ok(resolved.alias);
      assert.ok(resolved.wpPath);
      const cmd = buildSnapshotRemoteCommand(resolved.wpPath, 'YmFzZTY0');
      assert.match(cmd, /wp --path=/);
      assert.match(cmd, /eval-file/);
      assert.match(cmd, /wdp-mig-/);
      assert.match(cmd, /fold -w 76/);
      assert.match(cmd, /\[ -s "\$TMP" \] \|\| /);
      const r = checkRemoteTarget({
        alias: resolved.alias,
        wpPath: resolved.wpPath,
        siteUrl: resolved.siteUrl,
        remoteCommand: cmd,
      });
      assert.equal(r.ok, true, `${envId}: ${r.reason || ''}`);
    }
  });
});
