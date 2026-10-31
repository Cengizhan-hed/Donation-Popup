/**
 * ikram:wp izin/kara liste + eklenti dizin normalizasyonu — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CRON_STATUS_EVAL_FILE,
  CRON_CRONTAB_HINT_COMMAND,
  isReadOnlyCronStatusSource,
  allowIkramWpCommand,
  normalizeRemotePluginDir,
  CLEANUP_EVAL_FILE,
  TEMP_PRODUCT_EVAL_FILE,
  TRASH_REPORT_EVAL_FILE,
} from '../../../scripts/lib/ikram-wp-guard.mjs';
import { parseDistignore, rsyncExcludeArgs } from '../../../scripts/lib/pack-excludes.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

describe('ikram-wp-guard', () => {
  it('allows plugin list / option get / cache flush', () => {
    assert.equal(allowIkramWpCommand('plugin list').ok, true);
    assert.equal(allowIkramWpCommand('wp plugin get woo-donation-popup').ok, true);
    assert.equal(allowIkramWpCommand('option get siteurl').ok, true);
    assert.equal(allowIkramWpCommand('cache flush').ok, true);
    assert.equal(allowIkramWpCommand('sg purge').ok, true);
    assert.equal(allowIkramWpCommand("eval 'echo 1;'").ok, true);
  });

  it('blocks destructive commands', () => {
    assert.equal(allowIkramWpCommand('db drop').ok, false);
    assert.equal(allowIkramWpCommand('db reset --yes').ok, false);
    assert.equal(allowIkramWpCommand('site empty').ok, false);
    assert.equal(allowIkramWpCommand('user delete 1').ok, false);
    assert.equal(allowIkramWpCommand('post delete 12 --force').ok, false);
    assert.equal(allowIkramWpCommand('plugin delete woo-donation-popup').ok, false);
    assert.equal(allowIkramWpCommand('option update blog_public 1').ok, false);
  });

  it('eval-file only cleanup-e2e.php or e2e-temp-product.php or trash-report.php', () => {
    const ok = allowIkramWpCommand(`eval-file ${CLEANUP_EVAL_FILE}`);
    assert.equal(ok.ok, true);
    const temp = allowIkramWpCommand(`eval-file ${TEMP_PRODUCT_EVAL_FILE}`);
    assert.equal(temp.ok, true);
    const report = allowIkramWpCommand(`eval-file ${TRASH_REPORT_EVAL_FILE}`);
    assert.equal(report.ok, true);
    assert.equal(allowIkramWpCommand('eval-file /tmp/evil.php').ok, false);
    assert.equal(allowIkramWpCommand("eval 'wp_delete_user(1);'").ok, false);
    assert.equal(allowIkramWpCommand("eval 'wp_untrash_post(1);'").ok, false);
    assert.equal(allowIkramWpCommand("eval 'update_post_meta(1,\"k\",\"v\");'").ok, false);
  });

  it('cron-status: yalniz izinli dosya, yazma/ag cagrisi yok, sir cikmaz', () => {
    assert.equal(allowIkramWpCommand(`eval-file ${CRON_STATUS_EVAL_FILE}`).ok, true);
    assert.equal(allowIkramWpCommand('eval-file tests/e2e/helpers/cron-status.php.bak').ok, false);
    assert.equal(allowIkramWpCommand('eval-file /tmp/cron-status.php').ok, false);
    // izin listesi genisletilmedi: cron alt komutlari hala reddedilir
    assert.equal(allowIkramWpCommand('cron event run --due-now').ok, false);
    assert.equal(allowIkramWpCommand('cron test').ok, false);
    assert.equal(allowIkramWpCommand('cron event delete foo').ok, false);

    const src = fs.readFileSync(path.join(ROOT, CRON_STATUS_EVAL_FILE), 'utf8');
    assert.equal(isReadOnlyCronStatusSource(src), true);
    assert.equal(isReadOnlyCronStatusSource('<?php wp_schedule_event(1,"hourly","x");'), false);
    assert.equal(isReadOnlyCronStatusSource('<?php spawn_cron();'), false);
    assert.equal(isReadOnlyCronStatusSource('<?php wp_remote_get("http://x");'), false);
    assert.equal(isReadOnlyCronStatusSource('<?php update_option("a","b");'), false);
    // yalniz bilinen anahtar=deger satirlari basilir
    const keys = [...src.matchAll(/^echo '([A-Za-z_]+)=/gm)].map((m) => m[1]);
    assert.deepEqual(keys, [
      'DISABLE_WP_CRON',
      'ALTERNATE_WP_CRON',
      'events_total',
      'events_overdue',
      'oldest_overdue_seconds',
      'schedules',
    ]);
    assert.equal(/\bgetenv|DB_PASSWORD|AUTH_KEY|SECURE_AUTH|\$_SERVER|ABSPATH/i.test(src), false);
  });

  it('cron crontab ipucu: yalniz evet/hayir, crontab satiri yazilmaz', () => {
    const c = CRON_CRONTAB_HINT_COMMAND;
    assert.ok(c.includes('crontab -l'));
    assert.ok(c.includes('grep -qE'));
    assert.ok(/wp-cron\\\.php\|wp cron event run/.test(c));
    assert.ok(c.includes('echo crontab_wp_cron=yes'));
    assert.ok(c.includes('echo crontab_wp_cron=no'));
    assert.equal(/crontab\s+(-e|-r|-)\b(?!l)/.test(c.replace('crontab -l', '')), false);
    assert.equal(/\bcat\b|>>|\btee\b/.test(c), false);
  });

  it('mkdir bug: plugin path file → directory', () => {
    const file =
      '/home/u/www/ikramaid.uk/public_html/wp-content/plugins/woo-donation-popup/woo-donation-popup.php';
    const dir = normalizeRemotePluginDir(file);
    assert.equal(dir.endsWith('/woo-donation-popup'), true);
    assert.equal(dir.endsWith('.php'), false);
    assert.equal(
      normalizeRemotePluginDir('/home/u/www/ikramaid.uk/public_html/wp-content/plugins'),
      '/home/u/www/ikramaid.uk/public_html/wp-content/plugins/woo-donation-popup'
    );
  });
});

describe('pack-excludes', () => {
  it('reads .distignore and includes tests/docs/node_modules', () => {
    const list = parseDistignore(ROOT);
    assert.ok(list.some((p) => p.includes('node_modules')));
    assert.ok(list.some((p) => p.includes('tests')));
    assert.ok(list.some((p) => p.includes('docs')));
    assert.ok(list.some((p) => p.includes('.env')));
    const args = rsyncExcludeArgs(ROOT);
    assert.ok(args.includes('--exclude'));
    assert.ok(args.includes('tests/'));
  });
});
