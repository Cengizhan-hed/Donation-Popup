/**
 * Uzak erişim kilidi — ağ yok. REMOTE_FREEZE + izin listesi + ham ssh yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  assertRemoteAllowed,
  isRemoteFrozen,
  isRemoteRsync,
  redactSpawnArgs,
  REMOTE_FREEZE_PATH,
  FREEZE_MESSAGE,
} from '../../../scripts/lib/remote-guard.mjs';
import {
  validateDeployEnv,
  validateE2EBaseUrl,
  isRetiredHedefStaging,
  RETIRED_HEDEF_STAGING_NOTE,
  IKRAM_ALLOW_REMOVAL_NOTE,
} from '../../../scripts/lib/deploy-guards.mjs';

describe('remote-guard', () => {
  it('REMOTE_FREEZE dosyası bu çalışma ağacında var', () => {
    assert.equal(fs.existsSync(REMOTE_FREEZE_PATH), true);
    assert.equal(isRemoteFrozen(), true);
  });

  it('freeze varken ssh reddedilir (Türkçe mesaj)', () => {
    assert.throws(() => assertRemoteAllowed({ bin: 'ssh' }), (e) => {
      assert.match(String(e.message), /UZAK ERİŞİM KİLİTLİ|REMOTE_FREEZE|2026-10-22/);
      assert.equal(e.message, FREEZE_MESSAGE);
      return true;
    });
  });

  it('freeze varken scp ve uzak rsync reddedilir', () => {
    assert.throws(() => assertRemoteAllowed({ bin: 'scp', args: ['a', 'host:b'] }));
    assert.throws(() =>
      assertRemoteAllowed({
        bin: 'rsync',
        args: ['-az', '-e', 'ssh', 'src/', 'alias:dest/'],
      })
    );
  });

  it('yerel paket rsync freeze altında izinli', () => {
    const r = assertRemoteAllowed({
      bin: 'rsync',
      args: ['-a', '/tmp/src/', '/tmp/dest/'],
      localPack: true,
    });
    assert.equal(r.ok, true);
    assert.equal(r.localPack, true);
  });

  it('isRemoteRsync: host:path ve -e ssh', () => {
    assert.equal(isRemoteRsync(['-az', 'src/', 'ikramaid:/var/www/']), true);
    assert.equal(isRemoteRsync(['-az', '-e', 'ssh', 'src/', 'dest/']), true);
    assert.equal(isRemoteRsync(['-a', '/tmp/a/', '/tmp/b/']), false);
  });

  it('-i anahtar yolu logdan çıkarılır', () => {
    const red = redactSpawnArgs(['-i', '/Users/me/.ssh/id_ed25519', 'host']);
    assert.equal(red.includes('/Users/me/.ssh/id_ed25519'), false);
    assert.equal(red.includes('[redacted-key-path]'), true);
  });
});

describe('deploy-guards 2e', () => {
  const goodIkram = {
    DEPLOY_SSH_ALIAS: 'ikramaid',
    DEPLOY_WP_PATH: '/home/customer/www/ikramaid.uk/public_html',
    DEPLOY_SITE_URL: 'https://ikramaid.uk',
  };

  it('staging28 Hedef staging reddedilir', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_HOST: 'ssh.example.com',
      DEPLOY_SSH_USER: 'u',
      DEPLOY_SSH_PORT: '18765',
      DEPLOY_SSH_KEY: '/tmp/id',
      DEPLOY_WP_PATH: '/home/customer/www/staging28.hedefdernegi.org/public_html',
      DEPLOY_SITE_URL: 'https://staging28.hedefdernegi.org',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /staging28|2026-10-22|izin listesinden/i);
    assert.equal(isRetiredHedefStaging('https://staging28.hedefdernegi.org'), true);
    assert.match(RETIRED_HEDEF_STAGING_NOTE, /staging28/);
  });

  it('canlı hedefdernegi.org reddedilir', () => {
    const r = validateDeployEnv({
      ...goodIkram,
      DEPLOY_SITE_URL: 'https://hedefdernegi.org',
      DEPLOY_WP_PATH: '/home/customer/www/hedefdernegi.org/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /canlı|kara/i);
  });

  it('izinsiz hedef reddedilir', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_ALIAS: 'x',
      DEPLOY_WP_PATH: '/var/www/example.com',
      DEPLOY_SITE_URL: 'https://example.com',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /izin/i);
  });

  it('ikramaid.uk izin listesinde (freeze ayrı kilit); kaldırma notu durur', () => {
    const r = validateDeployEnv(goodIkram);
    assert.equal(r.ok, true);
    assert.equal(r.target?.id, 'ikram-aid');
    assert.match(IKRAM_ALLOW_REMOVAL_NOTE, /KALDIRILACAK/);
  });

  it('E2E URL staging28 reddedilir (profil allowedHosts olsa bile)', () => {
    const r = validateE2EBaseUrl('https://staging28.hedefdernegi.org', [
      'staging28.hedefdernegi.org',
    ]);
    assert.equal(r.ok, false);
    assert.match(r.reason, /staging28|2026-10-22/i);
  });
});

describe('ham ssh/scp/rsync spawn yok', () => {
  it('spawnSync("ssh"|"scp"|"rsync") uygulama kodunda yok (yalnız spawnGuarded)', () => {
    const res = spawnSync(
      'rg',
      [
        '-n',
        `spawnSync\\(\\s*['"](ssh|scp|rsync)['"]`,
        '--glob',
        '*.{mjs,js,cjs}',
        '--glob',
        '!**/*.test.mjs',
        ROOT,
      ],
      { encoding: 'utf8' }
    );
    const lines = String(res.stdout || '')
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.includes('.test.mjs') && !l.includes('node_modules'));
    assert.deepEqual(lines, [], lines.join('\n'));
  });

  it('js ssh/scp/rsync spawn uygulama kodunda spawnGuarded veya remote-guard CLI', () => {
    const res = spawnSync(
      'rg',
      [
        '-n',
        `spawnGuarded\\(\\s*['"](ssh|scp|rsync)['"]|spawnSync\\(\\s*['"](ssh|scp|rsync)['"]`,
        '--glob',
        '*.{mjs,js,sh}',
        ROOT,
      ],
      { encoding: 'utf8' }
    );
    const lines = String(res.stdout || '')
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.includes('node_modules') && !l.includes('.test.mjs'));
    const offenders = lines.filter((line) => {
      if (line.includes('remote-guard.mjs')) return false;
      if (/spawnGuarded\(/.test(line)) return false;
      return /spawnSync\(/.test(line);
    });
    assert.deepEqual(offenders, [], offenders.join('\n'));
  });
});
