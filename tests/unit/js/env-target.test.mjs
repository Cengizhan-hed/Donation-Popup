/**
 * Uzak hedef = profil + izin listesi. Env hedef anahtarları yok sayılır.
 * Ağ yok; .env dosyası okunmaz (parsed enjekte).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, setActiveProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { loadE2EEnv } from '../../../tests/e2e/helpers/env.mjs';
import { mergeDeployEnvFromProfile } from '../../../tests/e2e/helpers/wp-remote.mjs';
import {
  ALLOWED_DEPLOY_TARGETS,
  checkRemoteTarget,
  plannedRemoteCommands,
} from '../../../scripts/lib/deploy-guards.mjs';

const STAGING = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
const IKRAM = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'ikram-aid');

function captureWarn(fn) {
  const lines = [];
  const orig = console.warn;
  console.warn = (msg) => {
    lines.push(String(msg));
  };
  try {
    const result = fn();
    return { result, lines };
  } finally {
    console.warn = orig;
  }
}

function assertWarningSafe(text) {
  const s = String(text || '');
  assert.equal(/staging28/.test(s), false);
  assert.equal(/https?:\/\//.test(s), false);
  assert.equal(/public_html/.test(s), false);
  assert.equal(/E2E_PASS|secret|password/i.test(s), false);
}

describe('env hedef anahtarları (profil tek kaynak)', () => {
  it('staging: env staging28 → hedef izin listesi, KARA LİSTE uyarısı değer yok', () => {
    const profile = loadProfile('staging');
    const merged = mergeDeployEnvFromProfile(
      profile,
      {
        DEPLOY_SSH_ALIAS: 'hedef-staging',
        DEPLOY_WP_PATH: '~/www/staging28.hedefdernegi.org/public_html', // live-scan:allow-reject-test
        DEPLOY_SITE_URL: 'https://staging28.hedefdernegi.org', // live-scan:allow-reject-test
      },
      '.env.deploy'
    );
    assert.equal(merged.ok, true);
    assert.equal(merged.env.DEPLOY_SSH_ALIAS, STAGING.sshAlias);
    assert.equal(merged.env.DEPLOY_WP_PATH, STAGING.wpPath);
    assert.equal(merged.env.DEPLOY_SITE_URL, STAGING.siteUrl);
    assert.match(merged.warning, /KARA LİSTE/);
    assert.match(merged.warning, /\.env\.deploy/);
    assertWarningSafe(merged.warning);
  });

  it('staging: env canlı → KARA LİSTE, koşu profille devam', () => {
    const profile = loadProfile('staging');
    const merged = mergeDeployEnvFromProfile(
      profile,
      {
        DEPLOY_SITE_URL: 'https://hedefdernegi.org', // live-scan:allow-reject-test
        DEPLOY_WP_PATH: '~/www/hedefdernegi.org/public_html', // live-scan:allow-reject-test
      },
      '.env.deploy'
    );
    assert.equal(merged.ok, true);
    assert.equal(merged.env.DEPLOY_SITE_URL, STAGING.siteUrl);
    assert.match(merged.warning, /KARA LİSTE/);
    assertWarningSafe(merged.warning);
  });

  it('staging: env boş → uyarı yok, hedef profil', () => {
    const profile = loadProfile('staging');
    const merged = mergeDeployEnvFromProfile(profile, {}, '.env.deploy');
    assert.equal(merged.ok, true);
    assert.equal(merged.warning, '');
    assert.equal(merged.env.DEPLOY_WP_PATH, STAGING.wpPath);
  });

  it('ikram: env farklı URL → uyarı, hedef ikramaid', () => {
    const profile = loadProfile('ikram');
    const merged = mergeDeployEnvFromProfile(
      profile,
      { DEPLOY_SITE_URL: 'https://example.com', E2E_BASE_URL: 'https://example.com' },
      '.env.deploy.ikram'
    );
    assert.equal(merged.ok, true);
    assert.equal(merged.env.DEPLOY_SITE_URL, IKRAM.siteUrl);
    assert.equal(merged.env.DEPLOY_SSH_ALIAS, IKRAM.sshAlias);
    assert.match(merged.warning, /kullanılmıyor \(profil tek kaynak\)/);
    assert.equal(/example\.com/.test(merged.warning), false);
  });

  it('plannedRemoteCommands env hedefinden değil profil hedefinden', () => {
    const profile = loadProfile('staging');
    const merged = mergeDeployEnvFromProfile(
      profile,
      { DEPLOY_SITE_URL: 'https://staging28.hedefdernegi.org' }, // live-scan:allow-reject-test
      '.env.deploy'
    );
    const cmds = plannedRemoteCommands(merged.target);
    assert.ok(cmds.length > 8);
    for (const remoteCommand of cmds) {
      const r = checkRemoteTarget({
        alias: merged.env.DEPLOY_SSH_ALIAS,
        wpPath: merged.env.DEPLOY_WP_PATH,
        siteUrl: merged.env.DEPLOY_SITE_URL,
        remoteCommand,
      });
      assert.equal(r.ok, true, r.reason);
    }
  });

  it('loadE2EEnv uzak: E2E_BASE_URL env’den gelmez; wpCliAuth parolasız', () => {
    const { result, lines } = captureWarn(() =>
      loadE2EEnv({
        envId: 'staging',
        parsed: {
          E2E_BASE_URL: 'https://staging28.hedefdernegi.org', // live-scan:allow-reject-test
          E2E_USER: '',
          E2E_PASS: '',
        },
      })
    );
    assert.equal(result.E2E_BASE_URL, STAGING.siteUrl);
    assert.equal(result.E2E_USER, '');
    assert.equal(result.E2E_PASS, '');
    assert.equal(result.E2E_PROFILE_ID, 'staging-hedef');
    assert.ok(lines.some((l) => /KARA LİSTE/.test(l)));
    for (const l of lines) assertWarningSafe(l);
    setActiveProfile(null);
  });

  it('loadE2EEnv ikram: E2E_BASE_URL profil, sır anahtarı durur', () => {
    const { result, lines } = captureWarn(() =>
      loadE2EEnv({
        envId: 'ikram',
        parsed: {
          E2E_BASE_URL: 'https://example.net',
          E2E_COMING_SOON_SHARE_KEY: 'share-test',
        },
      })
    );
    assert.equal(result.E2E_BASE_URL, IKRAM.siteUrl);
    assert.equal(result.E2E_COMING_SOON_SHARE_KEY, 'share-test');
    assert.ok(lines.some((l) => /kullanılmıyor \(profil tek kaynak\)/.test(l)));
    for (const l of lines) assert.equal(/example\.net|share-test/.test(l), false);
    setActiveProfile(null);
  });
});
