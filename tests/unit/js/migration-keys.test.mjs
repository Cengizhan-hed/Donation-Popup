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
    const php = fs.readFileSync(path.join(ROOT, 'includes/class-migrations.php'), 'utf8');
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

describe('migration:snapshot uzak', () => {
  it('REMOTE_FREEZE varken --env staging reddedilir', () => {
    const r = spawnSync('node', [path.join(ROOT, 'scripts/migration-snapshot.mjs'), '--env', 'staging', '--label', 'x'], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    assert.notEqual(r.status, 0);
    const msg = String(r.stderr || r.stdout || '');
    assert.match(msg, /UZAK|REMOTE_FREEZE|missing \.env|Kara liste|izin listesi|2026-10-22/i);
    assert.doesNotMatch(msg, /ssh\s+\S+@/);
  });
});
