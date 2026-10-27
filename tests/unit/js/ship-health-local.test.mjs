/**
 * Ship sağlık/göç araçları yeni 12.0.0 sınıflarıyla (yerel WP; yoksa atlanır). Uzak yok.
 *  - scripts/lib/ship-health.php: göç öncesi needs_run=1, kurulum sonrası göç adımından sonra 0.
 *  - MIGRATE_EVAL_PHP (kurulum sonrası `wp eval` gövdesi) gerçekten çalışır.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { MIGRATE_EVAL_PHP, CACHE_BUMP_EVAL_PHP } from '../../../scripts/lib/deploy-guards.mjs';

const WP = path.join(ROOT, 'build/local-wp/wordpress');
const PLUGIN = path.join(WP, 'wp-content/plugins/woo-donation-popup');
const HAVE =
  fs.existsSync(path.join(WP, 'wp-load.php')) &&
  fs.existsSync(path.join(WP, 'wp-content/plugins/woocommerce/woocommerce.php')) &&
  fs.existsSync(path.join(PLUGIN, 'src/Core/class-version-migrations.php')) &&
  fs.existsSync(path.join(PLUGIN, 'src/Core/class-release-12-upgrade.php'));

function evalFile(file, ...args) {
  const r = spawnSync('php', ['-d', 'memory_limit=1024M', path.join(ROOT, 'tests/local-wp/eval-file.php'), file, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, WDP_LOCAL_WP_DIR: WP },
    timeout: 120000,
  });
  assert.equal(r.status, 0, `php çıkış ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 600)}`);
  return String(r.stdout);
}

function json(text) {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

describe('ship sağlık/göç: yeni sınıflar (yerel WP)', { skip: !HAVE && 'yerel WP/12.0.0 eklentisi yok' }, () => {
  it('göç dizgileri eski WDP_ sınıfına bağlı değil (yalnız 12 öncesi yedek)', () => {
    assert.match(MIGRATE_EVAL_PHP, /DonationPanel\\\\Core\\\\Version_Migrations/);
    assert.match(MIGRATE_EVAL_PHP, /DonationPanel\\\\Core\\\\Migrations/);
    assert.match(CACHE_BUMP_EVAL_PHP, /DonationPanel\\\\Modules\\\\EntryPoints\\\\Donations_List/);
    assert.doesNotMatch(CACHE_BUMP_EVAL_PHP, /WDP_/);
    assert.ok(!MIGRATE_EVAL_PHP.includes("'"), 'tek tırnak wp eval kabuk tırnağını bozar');
  });

  it('göç öncesi needs_run=1; göç adımından sonra needs_run=0 ve Release_12_Upgrade kaydı yazılır', () => {
    evalFile('tests/local-wp/ship-health-probe.php', 'ensure');
    evalFile('tests/local-wp/ship-health-probe.php', 'reset');
    const before = json(evalFile('scripts/lib/ship-health.php'));
    assert.equal(before.active, 1);
    assert.equal(before.needs_run, 1, 'göç öncesi needs_run=1 olmalı');

    const snippet = path.join(os.tmpdir(), `wdp-ship-migrate-${process.pid}.php`);
    fs.writeFileSync(
      snippet,
      `<?php\n${MIGRATE_EVAL_PHP}\necho wp_json_encode(array('state' => get_option('donation_panel_migrations'), 'db' => get_option('wdp_db_version')));\n`
    );
    try {
      const mig = json(evalFile(snippet));
      assert.ok(mig.state && mig.state.done && 'release_12_upgrade' in mig.state.done, 'release_12_upgrade adımı çalışmadı');
      assert.ok(mig.db, 'wdp_db_version yazılmadı');
    } finally {
      fs.rmSync(snippet, { force: true });
    }

    const after = json(evalFile('scripts/lib/ship-health.php'));
    assert.equal(after.needs_run, 0, 'göç sonrası needs_run=0 olmalı');
    assert.equal(after.php_ok, 1);
  });
});
