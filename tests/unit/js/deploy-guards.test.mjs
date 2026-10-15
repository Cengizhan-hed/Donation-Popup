/**
 * Staging deploy kilitleri — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePluginVersion,
  validateDeployEnv,
  validateRemoteSiteUrl,
} from '../../../scripts/lib/deploy-guards.mjs';

describe('deploy-guards', () => {
  const good = {
    DEPLOY_SSH_HOST: 'ssh.example.com',
    DEPLOY_SSH_USER: 'u',
    DEPLOY_SSH_PORT: '18765',
    DEPLOY_SSH_KEY: '/tmp/id',
    DEPLOY_WP_PATH: '/home/customer/www/staging28.hedefdernegi.org/public_html',
    DEPLOY_SITE_URL: 'https://staging28.hedefdernegi.org',
  };

  it('accepts staging path and URL', () => {
    assert.equal(validateDeployEnv(good).ok, true);
  });

  it('rejects live site path', () => {
    const r = validateDeployEnv({
      ...good,
      DEPLOY_WP_PATH: '/home/customer/www/hedefdernegi.org/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /canlı|hedefdernegi\.org/i);
  });

  it('rejects URL without staging', () => {
    const r = validateDeployEnv({
      ...good,
      DEPLOY_SITE_URL: 'https://hedefdernegi.org',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /staging/i);
  });

  it('rejects relative path', () => {
    const r = validateDeployEnv({
      ...good,
      DEPLOY_WP_PATH: '~/www/staging28.hedefdernegi.org/public_html',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /mutlak/i);
  });

  it('rejects mismatched remote siteurl', () => {
    const r = validateRemoteSiteUrl(
      'https://hedefdernegi.org',
      'https://staging28.hedefdernegi.org'
    );
    assert.equal(r.ok, false);
  });

  it('parses plugin version', () => {
    const src = ` * Version: 10.28.4\n define('WDP_VERSION', '10.28.4');`;
    assert.equal(parsePluginVersion(src), '10.28.4');
  });
});
