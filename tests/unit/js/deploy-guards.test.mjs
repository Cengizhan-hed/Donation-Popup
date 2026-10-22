/**
 * Deploy kilitleri — ağ yok. Klasör yolu + üçlü eşleşme.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePluginVersion,
  validateDeployEnv,
  validateRemoteSiteUrl,
  validateE2EBaseUrl,
  isLiveHedefHost,
  hasBlockedHedefMention,
  assertRemoteTarget,
  checkRemoteTarget,
  inspectRemoteCommand,
  plannedRemoteCommands,
  buildGuardedEvalFileCommand,
  shellQuoteWpPath,
  wpPathFlag,
  unquoteShellWpPath,
  IKRAM_ALLOW_REMOVAL_NOTE,
  ALLOWED_DEPLOY_TARGETS,
} from '../../../scripts/lib/deploy-guards.mjs';
import {
  DISCOVER_STEPS,
  buildRemoteWpCommand,
  stepToWpTail,
} from '../../../scripts/lib/remote-discover-lib.mjs';

const STAGING = {
  alias: 'hedef-staging',
  wpPath: '~/www/staging30.hedefdernegi.org/public_html',
  siteUrl: 'https://staging30.hedefdernegi.org',
};

const IKRAM = {
  alias: 'ikramaid',
  wpPath: '~/www/ikramaid.uk/public_html',
  siteUrl: 'https://ikramaid.uk',
};

describe('deploy-guards', () => {
  it('izinli: hedef-staging + staging30 public_html', () => {
    const r = checkRemoteTarget(STAGING);
    assert.equal(r.ok, true);
    assert.equal(r.target?.id, 'staging-hedef');
    assert.doesNotThrow(() => assertRemoteTarget(STAGING));
  });

  it('izinli: ikramaid üçlüsü', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_ALIAS: IKRAM.alias,
      DEPLOY_WP_PATH: IKRAM.wpPath,
      DEPLOY_SITE_URL: IKRAM.siteUrl,
    });
    assert.equal(r.ok, true);
    assert.equal(r.target?.id, 'ikram-aid');
  });

  it('RED: live public_html path', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      wpPath: '~/www/hedefdernegi.org/public_html', // live-scan:allow-reject-test
      remoteCommand: 'ls ~/www/hedefdernegi.org/public_html', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: path traversal via ..', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls ~/www/staging30.hedefdernegi.org/../hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: live root /staging subfolder', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls ~/www/hedefdernegi.org/staging', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
    assert.equal(hasBlockedHedefMention('~/www/hedefdernegi.org/staging'), true); // live-scan:allow-reject-test
  });

  it('RED: $HOME live www', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls $HOME/www/hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: /home/x live www', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls /home/x/www/hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: live https URL', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      siteUrl: 'https://hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: www live host', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'curl https://www.hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
  });

  it('RED: retired staging28 host', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      siteUrl: 'https://staging28.hedefdernegi.org', // live-scan:allow-reject-test
    });
    assert.equal(r.ok, false);
    assert.equal(isLiveHedefHost('https://staging28.hedefdernegi.org'), true); // live-scan:allow-reject-test
  });

  it('RED: alias/yol çaprazlama', () => {
    const r = checkRemoteTarget({
      alias: 'hedef-staging',
      wpPath: IKRAM.wpPath,
      siteUrl: STAGING.siteUrl,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /eşleşmiyor/i);
  });

  it('RED: --path eksik wp çağrısı', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'wp option get siteurl',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /--path/i);
  });

  it('izinli wp --path tam wpPath', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: `wp option get siteurl --path=${STAGING.wpPath}`,
    });
    assert.equal(r.ok, true);
  });

  it('shellQuoteWpPath ~ tırnak dışında; kilit tanır', () => {
    assert.equal(shellQuoteWpPath(STAGING.wpPath), `"$HOME/www/staging30.hedefdernegi.org/public_html"`);
    assert.equal(shellQuoteWpPath(IKRAM.wpPath), `"$HOME/www/ikramaid.uk/public_html"`);
    assert.equal(unquoteShellWpPath(shellQuoteWpPath(STAGING.wpPath)), STAGING.wpPath);
    const cmd = `wp option get siteurl ${wpPathFlag(STAGING.wpPath)}`;
    assert.equal(checkRemoteTarget({ ...STAGING, remoteCommand: cmd }).ok, true);
    const cmdHome = `wp option get siteurl ${wpPathFlag('$HOME/www/staging30.hedefdernegi.org/public_html')}`;
    assert.equal(checkRemoteTarget({ ...STAGING, remoteCommand: cmdHome }).ok, true);
  });

  it('RED: glob / $(', () => {
    const glob = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls ~/www/staging30.hedefdernegi.org/*',
    });
    assert.equal(glob.ok, false);
    const sub = checkRemoteTarget({
      ...STAGING,
      remoteCommand: 'ls ~/www/staging30.hedefdernegi.org/$(echo public_html)',
    });
    assert.equal(sub.ok, false);
  });

  it('env değeri listeden farklıysa eşleşmiyor (değer yok)', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_ALIAS: 'hedef-staging',
      DEPLOY_WP_PATH: '/var/www/other/public_html',
      DEPLOY_SITE_URL: STAGING.siteUrl,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'eşleşmiyor');
    assert.equal(/other|public_html/.test(r.reason), false);
  });

  it('rejects unknown host', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_ALIAS: 'x',
      DEPLOY_SITE_URL: 'https://example.com',
      DEPLOY_WP_PATH: '/var/www/example.com/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /izin|alias/i);
  });

  it('rejects mismatched remote siteurl', () => {
    const r = validateRemoteSiteUrl('https://example.net', 'https://ikramaid.uk');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'eşleşmiyor');
  });

  it('E2E URL: canlı ve staging28 red, staging30 ve ikram ok', () => {
    assert.equal(
      validateE2EBaseUrl('https://staging28.hedefdernegi.org', [ // live-scan:allow-reject-test
        'staging28.hedefdernegi.org', // live-scan:allow-reject-test
      ]).ok,
      false
    );
    assert.equal(validateE2EBaseUrl('https://hedefdernegi.org', []).ok, false); // live-scan:allow-reject-test
    assert.equal(
      validateE2EBaseUrl('https://staging30.hedefdernegi.org', [
        'staging30.hedefdernegi.org',
      ]).ok,
      true
    );
    assert.equal(validateE2EBaseUrl('https://ikramaid.uk', ['ikramaid.uk']).ok, true);
    assert.equal(validateE2EBaseUrl('http://127.0.0.1:8899', ['127.0.0.1']).ok, true);
  });

  it('isLiveHedefHost klasör yoluna göre (staging alt klasör canlıdır)', () => {
    assert.equal(isLiveHedefHost('https://staging30.hedefdernegi.org'), false);
    assert.equal(isLiveHedefHost('https://hedefdernegi.org'), true); // live-scan:allow-reject-test
    assert.equal(isLiveHedefHost('https://www.hedefdernegi.org'), true); // live-scan:allow-reject-test
    assert.equal(isLiveHedefHost('~/www/hedefdernegi.org/staging'), true); // live-scan:allow-reject-test
  });

  it('ikram izin kaldırma notu sabit; iki izinli hedef', () => {
    assert.match(IKRAM_ALLOW_REMOVAL_NOTE, /KALDIRILACAK/);
    assert.deepEqual(
      ALLOWED_DEPLOY_TARGETS.map((t) => t.id).sort(),
      ['ikram-aid', 'staging-hedef']
    );
  });

  it('parses plugin version', () => {
    const src = ` * Version: 10.28.4\n define('WDP_VERSION', '10.28.4');`;
    assert.equal(parsePluginVersion(src), '10.28.4');
  });

  it('RED: cd ../.. kaçışı (izinli köke girdikten sonra)', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: `cd ${STAGING.wpPath} && cd ../.. && ls`,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /\.\.|cd/i);
  });

  it('RED: cd …/public_html/../../ + wp --path', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: `cd ${STAGING.wpPath}/../../ && wp --path=${STAGING.wpPath} option get x`,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /\.\./);
  });

  it('RED: wp --path doğru; cd ~ && ls www', () => {
    const r = checkRemoteTarget({
      ...STAGING,
      remoteCommand: `wp --path=${STAGING.wpPath} eval "echo 1;" ; cd ~ && ls www`,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /cd|ls ~/i);
  });

  it('RED: pushd/popd, ln -s, find /, ls ~, ls /', () => {
    const cases = [
      `pushd ${STAGING.wpPath}`,
      `popd`,
      `ln -s /tmp/x ${STAGING.wpPath}/x`,
      `find / -name wp-config.php`,
      `ls ~`,
      `ls /`,
      `cd`,
      `cd -`,
      `cd $HOME`,
      `cd ${STAGING.wpPath}/../other`,
    ];
    for (const remoteCommand of cases) {
      const r = checkRemoteTarget({ ...STAGING, remoteCommand });
      assert.equal(r.ok, false, remoteCommand);
    }
  });

  it('Ikram: aynı kaçışlar RED; izinli wp --path geçer', () => {
    assert.equal(
      checkRemoteTarget({
        ...IKRAM,
        remoteCommand: `cd ${IKRAM.wpPath} && cd ../.. && ls`,
      }).ok,
      false
    );
    assert.equal(
      checkRemoteTarget({
        ...IKRAM,
        remoteCommand: `wp eval 'echo 1;' --path='${IKRAM.wpPath}'`,
      }).ok,
      true
    );
    const lsHome = inspectRemoteCommand('ls ~', IKRAM.wpPath);
    assert.equal(lsHome.ok, false);
  });

  it('deploy/discover/ikram-wp/staging-wp dry-run komutları kilitten geçer', () => {
    for (const target of ALLOWED_DEPLOY_TARGETS) {
      const cmds = plannedRemoteCommands(target);
      assert.ok(cmds.length > 8, target.id);
      assert.ok(cmds.some((c) => c.includes('wdp-mig-')), 'snapshot eval-file');
      assert.ok(cmds.some((c) => c.includes('wdp-canary-')), 'canary eval-file');
      const snap = buildGuardedEvalFileCommand(target.wpPath, { tmpPrefix: 'wdp-mig' });
      assert.match(snap, /wp --path=/);
      assert.match(snap, /eval-file/);
      for (const remoteCommand of cmds) {
        const r = checkRemoteTarget({
          alias: target.sshAlias,
          wpPath: target.wpPath,
          siteUrl: target.siteUrl,
          remoteCommand,
        });
        assert.equal(r.ok, true, `${target.id}: ${r.reason || ''} :: ${remoteCommand.slice(0, 120)}`);
      }
      for (const step of DISCOVER_STEPS) {
        if (step.kind !== 'eval') continue;
        const remoteCommand = buildRemoteWpCommand(target.wpPath, stepToWpTail(step));
        const r = checkRemoteTarget({
          alias: target.sshAlias,
          wpPath: target.wpPath,
          siteUrl: target.siteUrl,
          remoteCommand,
        });
        assert.equal(r.ok, true, `discover ${step.id}: ${r.reason || ''}`);
      }
    }
  });
});
