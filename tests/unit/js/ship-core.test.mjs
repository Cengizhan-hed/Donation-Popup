/**
 * Güvenli ship zinciri — ağ yok (sahte ssh/spawnImpl). Yerel WP HTTP ayrı.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import { checkRemoteTarget, parsePluginVersion, ALLOWED_DEPLOY_TARGETS } from '../../../scripts/lib/deploy-guards.mjs';
import {
  EXIT_BLOCKED,
  EXIT_COMPARE,
  EXIT_FAIL,
  EXIT_OK,
  PLAN_STEPS,
  ROLLBACK_STEPS,
  assertDiscoverNotBlocked,
  buildActivateMigrateCommand,
  buildBackupOptionsCommand,
  buildBackupZipCommand,
  buildCacheFlushCommand,
  buildHealthPhpCommand,
  buildRestoreOptionsCommand,
  buildRestoreZipCommand,
  buildRollbackCommands,
  buildUrlProbeCommand,
  collectHttpTargets,
  evaluateHttpPage,
  evaluatePhpHealth,
  formatHealthLine,
  isRemoteWriteCommand,
  isRemoteWriteInvocation,
  parseShipArgs,
  runLocalHttpHealth,
  runShip,
  shipPaths,
} from '../../../scripts/lib/ship-core.mjs';

const VERSION = parsePluginVersion(fs.readFileSync(path.join(ROOT, 'woo-donation-popup.php'), 'utf8'));
const STAGING = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
const GUARD = { CLAUDECODE: '1' };
const PLUGIN_DIR = `${STAGING.wpPath}/wp-content/plugins/woo-donation-popup`;

function htmlRes(status, html) {
  return { status, text: async () => html };
}

function okHtml(url) {
  const u = String(url || '');
  const marker = /p=10|page_id=20|product/.test(u) ? ' class="wdp-modal"' : '';
  return htmlRes(200, `<html><body><div${marker}>ok</div></body></html>`);
}

function shipTags(calls) {
  const tags = [];
  for (const c of calls || []) {
    const cmd = c.bin === 'ssh' ? c.args[c.args.length - 1] : '';
    const m = String(cmd).match(/# wdp-ship:([a-z0-9-]+)/);
    if (m) tags.push(m[1]);
  }
  return tags;
}

function makeSpawnImpl(opts = {}) {
  const siteUrl = opts.siteUrl || STAGING.siteUrl;
  const version = opts.version || VERSION;
  const pluginDir = opts.pluginDir || PLUGIN_DIR;
  const plugins = opts.plugins || [
    { name: 'woocommerce', status: 'active', version: '8.0' },
    { name: 'woo-donation-popup', status: 'active', version },
  ];
  const phpHealth = opts.phpHealth || { php_ok: 1, active: 1, version, needs_run: 0 };
  const phpHealth2 = opts.phpHealth2 || phpHealth;
  const probe = opts.probe || {
    home: `${siteUrl}/`,
    shop: `${siteUrl}/?post_type=product`,
    shop_id: 6,
    product: `${siteUrl}/?p=10`,
    product_id: 10,
    plugin_page: `${siteUrl}/?page_id=20`,
    plugin_page_id: 20,
    admin: `${siteUrl}/wp-admin/`,
    plugin_skipped: 0,
  };
  let healthN = 0;
  return (bin, args) => {
    const base = path.basename(String(bin));
    const cmd = Array.isArray(args) ? String(args[args.length - 1] || '') : '';
    if (base === 'rsync') return { status: 0, stdout: '', stderr: '' };
    if (cmd.includes('option get siteurl')) return { status: 0, stdout: siteUrl, stderr: '' };
    if (cmd.includes('plugin path')) return { status: 0, stdout: pluginDir, stderr: '' };
    if (cmd.includes('plugin list')) return { status: 0, stdout: JSON.stringify(plugins), stderr: '' };
    if (cmd.includes('plugin get') && cmd.includes('version')) {
      return { status: 0, stdout: version, stderr: '' };
    }
    if (cmd.includes('# wdp-ship:health-php')) {
      healthN += 1;
      const payload = healthN === 1 ? phpHealth : phpHealth2;
      return { status: 0, stdout: JSON.stringify(payload), stderr: '' };
    }
    if (cmd.includes('# wdp-ship:url-probe')) return { status: 0, stdout: JSON.stringify(probe), stderr: '' };
    if (cmd.includes('# wdp-ship:auth-cookie')) {
      return {
        status: 0,
        stdout: JSON.stringify({
          ok: 1,
          logged_in_name: 'wordpress_logged_in_x',
          logged_in: 'tok',
          auth_name: 'wordpress_x',
          auth: 'tok2',
        }),
        stderr: '',
      };
    }
    if (cmd.includes('# wdp-ship:backup-options') || cmd.includes('# wdp-ship:restore-options')) {
      return { status: 0, stdout: JSON.stringify({ ok: 1, count: 2 }), stderr: '' };
    }
    return { status: 0, stdout: 'ok', stderr: '' };
  };
}

function baseOpts(over = {}) {
  return {
    envName: 'staging',
    skipPrechecks: true,
    skipInstall: true,
    guardEnv: GUARD,
    writeReport: true,
    now: new Date('2026-10-22T15:00:00.000Z'),
    canaryFn: async () => ({ ok: true, status: 'TEMİZ', diffs: [] }),
    snapshotFn: async () => ({ outFile: '/tmp/wdp-snap.json', snap: { options: {} } }),
    compareFn: () => ({
      fail: false,
      counts: {
        KAYBOLDU: 0,
        'VARSAYILANA DÖNDÜ': 0,
        DEĞİŞTİ: 0,
        KORUNDU: 1,
        YENİ: 0,
      },
      problems: [],
    }),
    fetchImpl: async (url) => okHtml(url),
    spawnImpl: makeSpawnImpl(),
    ...over,
  };
}

describe('ship-core yardımcılar', () => {
  it('parseShipArgs dry-run/rollback', () => {
    assert.equal(parseShipArgs(['--dry-run']).dryRun, true);
    assert.equal(parseShipArgs(['--rollback']).rollback, true);
    assert.equal(parseShipArgs(['--env', 'ikram']).envName, 'ikram');
  });

  it('evaluatePhpHealth sürüm ve needs_run', () => {
    const ok = evaluatePhpHealth(
      { php_ok: 1, active: 1, version: VERSION, needs_run: 0 },
      VERSION
    );
    assert.equal(ok.ok, true);
    const bad = evaluatePhpHealth(
      { php_ok: 1, active: 1, version: '0.0.1', needs_run: 1 },
      VERSION
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.reasons.some((r) => /sürüm/.test(r)));
    assert.ok(bad.reasons.includes('needs_run'));
  });

  it('evaluateHttpPage fatal ve wdp- işaret', () => {
    assert.equal(evaluateHttpPage('home', { status: 200, text: '<p>ok</p>' }).ok, true);
    assert.equal(
      evaluateHttpPage('home', { status: 200, text: 'There has been a critical error on this website.' }).ok,
      false
    );
    assert.equal(
      evaluateHttpPage('product', { status: 200, text: '<div>yok</div>' }, { requireMarker: true }).ok,
      false
    );
    assert.equal(
      evaluateHttpPage('product', { status: 200, text: '<div class="wdp-form">' }, { requireMarker: true }).ok,
      true
    );
  });

  it('formatHealthLine tek satır', () => {
    const line = formatHealthLine({
      php: { ok: true, reasons: [] },
      pages: [
        { name: 'home', ok: true, skipped: false, reason: '200' },
        { name: 'plugin', ok: true, skipped: true, reason: 'yok' },
      ],
    });
    assert.match(line, /^Sağlık: YEŞİL /);
    assert.match(line, /plugin=atlandı/);
  });

  it('REMOTE-BLOCKED kuralı (ölçüm/SMS)', () => {
    assert.doesNotThrow(() =>
      assertDiscoverNotBlocked([{ name: 'woocommerce', status: 'active' }])
    );
    assert.throws(
      () =>
        assertDiscoverNotBlocked([
          { name: 'google-site-kit', status: 'active' },
        ]),
      (e) => e.exitCode === EXIT_BLOCKED && /REMOTE-BLOCKED/.test(e.message)
    );
    assert.throws(
      () => assertDiscoverNotBlocked([{ slug: 'netgsm', status: 'active' }]),
      /REMOTE-BLOCKED/
    );
  });

  it('geri dönüş komut sırası sabit', () => {
    const paths = shipPaths(STAGING, STAGING.wpPath);
    const cmds = buildRollbackCommands({
      backupZip: `${paths.backupRoot}/woo-donation-popup-pre-x.zip`,
      optionsJson: `${paths.backupRoot}/wdp-options-pre-x.json`,
      pluginDir: PLUGIN_DIR,
      wpPath: STAGING.wpPath,
    });
    assert.deepEqual(
      cmds.map((c) => c.step),
      ROLLBACK_STEPS
    );
  });

  it('üretilen uzak komutlar izinli kökte', () => {
    const paths = shipPaths(STAGING, STAGING.wpPath);
    const zip = `${paths.backupRoot}/woo-donation-popup-pre-x.zip`;
    const opt = `${paths.backupRoot}/wdp-options-pre-x.json`;
    const list = [
      buildBackupZipCommand({ ...paths, pluginDir: PLUGIN_DIR, backupZip: zip }),
      buildBackupOptionsCommand(STAGING.wpPath, opt),
      buildRestoreZipCommand({ pluginDir: PLUGIN_DIR, backupZip: zip }),
      buildRestoreOptionsCommand(STAGING.wpPath, opt),
      buildCacheFlushCommand(STAGING.wpPath),
      buildActivateMigrateCommand(STAGING.wpPath),
      buildHealthPhpCommand(STAGING.wpPath),
      buildUrlProbeCommand(STAGING.wpPath),
    ];
    for (const remoteCommand of list) {
      const r = checkRemoteTarget({
        alias: STAGING.sshAlias,
        wpPath: STAGING.wpPath,
        siteUrl: STAGING.siteUrl,
        remoteCommand,
      });
      assert.equal(r.ok, true, `${r.reason}\n${remoteCommand.slice(0, 180)}`);
    }
  });
});

describe('ship-core runShip sahte ssh', () => {
  it('dry-run: uzak yazma 0, plan listelenir', async () => {
    const calls = [];
    const r = await runShip(
      baseOpts({
        dryRun: true,
        spawnImpl: (bin, args) => {
          calls.push({ bin, args });
          return { status: 0, stdout: '', stderr: '' };
        },
      })
    );
    assert.equal(r.exitCode, EXIT_OK);
    assert.equal(r.dryRun, true);
    assert.equal(r.remoteWrites, 0);
    assert.equal(calls.length, 0);
    assert.equal(r.plan.length, PLAN_STEPS.length);
    assert.ok(fs.existsSync(r.reportFile));
    const md = fs.readFileSync(r.reportFile, 'utf8');
    assert.match(md, /uzak yazma yok/i);
    assert.equal(isRemoteWriteInvocation('ssh', ['hedef-staging', 'mkdir -p x']), true);
    assert.equal(isRemoteWriteCommand('wp plugin list --format=json'), false);
  });

  it('REMOTE-BLOCKED → kurulum yok', async () => {
    const spawnImpl = makeSpawnImpl({
      plugins: [
        { name: 'woocommerce', status: 'active' },
        { name: 'google-site-kit', status: 'active' },
      ],
    });
    await assert.rejects(
      () =>
        runShip(
          baseOpts({
            spawnImpl,
            pluginsFn: async () => [
              { name: 'woocommerce', status: 'active' },
              { name: 'google-site-kit', status: 'active' },
            ],
          })
        ),
      (e) => {
        assert.equal(e.exitCode, EXIT_BLOCKED);
        assert.match(e.message, /REMOTE-BLOCKED/);
        assert.equal(e.remoteWrites || 0, 0);
        const tags = shipTags(e.calls || []);
        assert.equal(tags.includes('backup-zip'), false);
        assert.equal(tags.includes('restore-zip'), false);
        assert.equal(
          (e.calls || []).some((c) => c.bin === 'rsync'),
          false
        );
        return true;
      }
    );
  });

  it('sağlık kırmızı → geri dönüş sırası', async () => {
    let fetches = 0;
    const r = await runShip(
      baseOpts({
        spawnImpl: makeSpawnImpl(),
        fetchImpl: async (url) => {
          fetches += 1;
          if (fetches <= 5) {
            return htmlRes(500, 'There has been a critical error on this website.');
          }
          return okHtml(url);
        },
      })
    );
    assert.equal(r.exitCode, EXIT_FAIL);
    assert.equal(r.rolledBack, true);
    const tags = shipTags(r.calls);
    const i = tags.indexOf('restore-zip');
    assert.ok(i >= 0, `tags=${tags.join(',')}`);
    assert.deepEqual(tags.slice(i, i + 4), [
      'restore-zip',
      'restore-options',
      'cache-flush',
      'health-php',
    ]);
    assert.equal(r.rollbackSteps.join(','), ROLLBACK_STEPS.join(','));
    assert.match(r.summary, /geri dönüş/);
  });

  it('compare fail → çıkış 2, geri dönüş yok', async () => {
    const r = await runShip(
      baseOpts({
        compareFn: () => ({
          fail: true,
          counts: {
            KAYBOLDU: 1,
            'VARSAYILANA DÖNDÜ': 0,
            DEĞİŞTİ: 2,
            KORUNDU: 0,
            YENİ: 0,
          },
          problems: [{ class: 'KAYBOLDU', key: 'option:wdp_x' }],
        }),
      })
    );
    assert.equal(r.exitCode, EXIT_COMPARE);
    assert.equal(r.rolledBack, false);
    const tags = shipTags(r.calls);
    assert.equal(tags.includes('restore-zip'), false);
    const md = fs.readFileSync(r.reportFile, 'utf8');
    assert.match(md, /UYARI/);
    assert.match(md, /geri dönüş otomatik değil/);
  });
});

describe('ship-core yerel WP HTTP sağlık', () => {
  it('ana sayfa 200, fatal yok (gerçek PHP sunucu)', async () => {
    const wpDir = path.join(ROOT, 'build/local-wp/wordpress');
    if (!fs.existsSync(path.join(wpDir, 'wp-load.php'))) {
      const ana = path.resolve(ROOT, '../Donation Popup/build/local-wp/wordpress');
      if (!fs.existsSync(path.join(ana, 'wp-load.php'))) {
        assert.fail('yerel WP yok; ana repoda da yok');
      }
      fs.mkdirSync(path.dirname(wpDir), { recursive: true });
      const cp = spawnSync('cp', ['-R', ana, path.dirname(wpDir)], { encoding: 'utf8' });
      assert.equal(cp.status, 0, cp.stderr || 'wp kopyalanamadı');
    }
    const health = await runLocalHttpHealth({ wpDir });
    assert.match(health.line, /^Sağlık: /);
    const home = health.pages.find((p) => p.name === 'home');
    assert.ok(home, 'home yok');
    assert.equal(home.ok, true, home.reason);
    assert.equal(home.skipped, false);
    assert.equal(FATAL_FROM(health), false);
    const admin = health.pages.find((p) => p.name === 'admin');
    assert.ok(admin);
    assert.equal(admin.ok, true, admin.reason);
  });
});

function FATAL_FROM(health) {
  return (health.pages || []).some((p) => p.reason === 'critical/fatal');
}

describe('collectHttpTargets atlama', () => {
  it('kısa kod sayfası yoksa atlanır', () => {
    const t = collectHttpTargets({
      home: 'https://staging30.hedefdernegi.org/',
      shop: '',
      product: '',
      plugin_page: '',
      plugin_skipped: 1,
      admin: 'https://staging30.hedefdernegi.org/wp-admin/',
    });
    assert.equal(t.find((x) => x.name === 'plugin').allowSkip, true);
    assert.equal(t.find((x) => x.name === 'home').allowSkip, false);
  });
});
