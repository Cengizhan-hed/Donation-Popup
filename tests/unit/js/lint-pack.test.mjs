/**
 * Dağıtım ZIP'inde lint araçları yok — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseDistignore } from '../../../scripts/lib/pack-excludes.mjs';
import {
  DISTIGNORE_REQUIRED,
  forbiddenZipEntries,
} from '../../../scripts/lib/lint-pack-scan.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

describe('lint pack excludes', () => {
  it('.distignore lint/geliştirme yollarını dışlar', () => {
    const list = parseDistignore(ROOT);
    for (const need of DISTIGNORE_REQUIRED) {
      assert.ok(
        list.some((p) => p === need || p.replace(/\/$/, '') === need.replace(/\/$/, '')),
        `eksik distignore: ${need}`
      );
    }
  });

  it('yasak zip girişlerini ayıklar', () => {
    const hits = forbiddenZipEntries([
      'woo-donation-popup/includes/class-cart.php',
      'woo-donation-popup/vendor-dev/bin/phpcs',
      'woo-donation-popup/tools/bin/composer.phar',
      'woo-donation-popup/phpcs.xml.dist',
      'woo-donation-popup/phpstan.neon',
      'woo-donation-popup/composer.json',
      'woo-donation-popup/composer.lock',
      'woo-donation-popup/README.md',
    ]);
    assert.deepEqual(hits.sort(), [
      'composer.json',
      'composer.lock',
      'phpcs.xml.dist',
      'phpstan.neon',
      'tools/bin/composer.phar',
      'vendor-dev/bin/phpcs',
    ]);
  });

  it('varsa gerçek dağıtım ZIP’ini tarar', () => {
    const zip = path.join(ROOT, 'build/woo-donation-popup.zip');
    if (!fs.existsSync(zip)) {
      assert.ok(true, 'zip henüz yok — kalıp testi yeterli');
      return;
    }
    const r = spawnSync('unzip', ['-Z', '-1', zip], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || 'unzip -Z');
    const entries = String(r.stdout || '')
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    assert.ok(entries.length > 5, 'zip boş');
    const bad = forbiddenZipEntries(entries);
    assert.deepEqual(bad, [], `ZIP’te yasak yol: ${bad.join(', ')}`);
  });
});
