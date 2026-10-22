/**
 * Deploy kilitleri — ağ yok. İzin listesi + canlı kara liste + staging28 emekli.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePluginVersion,
  validateDeployEnv,
  validateRemoteSiteUrl,
  validateE2EBaseUrl,
  isLiveHedefHost,
  isRetiredHedefStaging,
  IKRAM_ALLOW_REMOVAL_NOTE,
  RETIRED_HEDEF_STAGING_NOTE,
} from '../../../scripts/lib/deploy-guards.mjs';

describe('deploy-guards', () => {
  const retiredStaging = {
    DEPLOY_SSH_HOST: 'ssh.example.com',
    DEPLOY_SSH_USER: 'u',
    DEPLOY_SSH_PORT: '18765',
    DEPLOY_SSH_KEY: '/tmp/id',
    DEPLOY_WP_PATH: '/home/customer/www/staging28.hedefdernegi.org/public_html',
    DEPLOY_SITE_URL: 'https://staging28.hedefdernegi.org',
  };

  const goodIkram = {
    DEPLOY_SSH_ALIAS: 'ikramaid',
    DEPLOY_WP_PATH: '/home/customer/www/ikramaid.uk/public_html',
    DEPLOY_SITE_URL: 'https://ikramaid.uk',
  };

  it('rejects retired Hedef staging28', () => {
    const r = validateDeployEnv(retiredStaging);
    assert.equal(r.ok, false);
    assert.match(r.reason, /staging28|2026-10-22/i);
    assert.equal(isRetiredHedefStaging(retiredStaging.DEPLOY_SITE_URL), true);
  });

  it('accepts ikramaid.uk (alias SSH)', () => {
    const r = validateDeployEnv(goodIkram);
    assert.equal(r.ok, true);
    assert.equal(r.target?.id, 'ikram-aid');
  });

  it('rejects live site path', () => {
    const r = validateDeployEnv({
      ...goodIkram,
      DEPLOY_WP_PATH: '/home/customer/www/hedefdernegi.org/public_html',
      DEPLOY_SITE_URL: 'https://hedefdernegi.org',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /canlı|hedefdernegi\.org|kara/i);
  });

  it('rejects live Hedef URL even if path looks like ikram', () => {
    const r = validateDeployEnv({
      ...goodIkram,
      DEPLOY_SITE_URL: 'https://hedefdernegi.org',
    });
    assert.equal(r.ok, false);
  });

  it('rejects unknown host', () => {
    const r = validateDeployEnv({
      DEPLOY_SSH_ALIAS: 'x',
      DEPLOY_SITE_URL: 'https://example.com',
      DEPLOY_WP_PATH: '/var/www/example.com/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /izin/i);
  });

  it('rejects relative path without ~', () => {
    const r = validateDeployEnv({
      ...goodIkram,
      DEPLOY_WP_PATH: 'www/ikramaid.uk/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /mutlak/i);
  });

  it('rejects mismatched remote siteurl', () => {
    const r = validateRemoteSiteUrl('https://hedefdernegi.org', 'https://ikramaid.uk');
    assert.equal(r.ok, false);
  });

  it('rejects retired siteurl even when expected matches', () => {
    const r = validateRemoteSiteUrl(
      'https://staging28.hedefdernegi.org',
      'https://staging28.hedefdernegi.org'
    );
    assert.equal(r.ok, false);
    assert.match(r.reason, /staging28|2026-10-22/i);
  });

  it('E2E URL: staging28 reddedilir, canlı reddedilir, ikram ok', () => {
    assert.equal(
      validateE2EBaseUrl('https://staging28.hedefdernegi.org', [
        'staging28.hedefdernegi.org',
      ]).ok,
      false
    );
    assert.equal(validateE2EBaseUrl('https://hedefdernegi.org', []).ok, false);
    assert.equal(validateE2EBaseUrl('https://ikramaid.uk', ['ikramaid.uk']).ok, true);
  });

  it('isLiveHedefHost ignores staging subdomain', () => {
    assert.equal(isLiveHedefHost('https://staging28.hedefdernegi.org'), false);
    assert.equal(isLiveHedefHost('https://hedefdernegi.org'), true);
    assert.equal(isLiveHedefHost('https://www.hedefdernegi.org'), true);
  });

  it('ikram izin kaldırma notu sabit; retired notu durur', () => {
    assert.match(IKRAM_ALLOW_REMOVAL_NOTE, /KALDIRILACAK/);
    assert.match(IKRAM_ALLOW_REMOVAL_NOTE, /ikramaid\.uk/);
    assert.match(RETIRED_HEDEF_STAGING_NOTE, /staging28/);
  });

  it('parses plugin version', () => {
    const src = ` * Version: 10.28.4\n define('WDP_VERSION', '10.28.4');`;
    assert.equal(parsePluginVersion(src), '10.28.4');
  });
});
