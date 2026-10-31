/**
 * E2X: bayraksız çağrıda ortam HER ZAMAN local; uzak ortam yalnız açık --env + merkezi koruma.
 * Ağ yok, ssh yok.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseE2ECli, loadE2EEnv } from '../../../tests/e2e/helpers/env.mjs';
import { DEFAULT_ENV_ID, loadProfile, isRemoteProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { assertRemoteAllowed } from '../../../scripts/lib/remote-guard.mjs';
import { validateE2EBaseUrl, isLiveHedefHost } from '../../../scripts/lib/deploy-guards.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const LOCAL_PARSED = { E2E_USER: 'admin', E2E_PASS: 'admin', E2E_BASE_URL: 'http://127.0.0.1:8912' };
const savedEnv = process.env.E2E_ENV;

afterEach(() => {
  if (savedEnv === undefined) delete process.env.E2E_ENV;
  else process.env.E2E_ENV = savedEnv;
});

describe('varsayılan ortam local', () => {
  it('DEFAULT_ENV_ID local ve profil yalnız yerel host izinli', () => {
    assert.equal(DEFAULT_ENV_ID, 'local');
    const p = loadProfile(DEFAULT_ENV_ID);
    assert.equal(isRemoteProfile(p), false);
    assert.deepEqual([...p.allowedHosts].sort(), ['127.0.0.1', 'localhost']);
  });

  it('bayraksız parseE2ECli → local (E2E_ENV uzak seçemez)', () => {
    for (const bad of ['hedef', 'staging', 'ikram', 'staging-hedef', 'ikram-aid']) {
      process.env.E2E_ENV = bad;
      const cli = parseE2ECli([]);
      assert.equal(cli.envId, 'local', bad);
      assert.equal(cli.envExplicit, false);
    }
  });

  it('açık --env uzak adı aynen döner (açık seçim korunur)', () => {
    const cli = parseE2ECli(['--env', 'ikram']);
    assert.equal(cli.envId, 'ikram');
    assert.equal(cli.envExplicit, true);
    assert.equal(parseE2ECli(['--env=staging']).envId, 'staging');
  });

  it('bayraksız loadE2EEnv → local profil, yalnız 127.0.0.1/localhost', () => {
    process.env.E2E_ENV = 'hedef';
    const env = loadE2EEnv({ parsed: LOCAL_PARSED });
    assert.equal(env.E2E_PROFILE_ID, 'local');
    assert.equal(isRemoteProfile(env._profile), false);
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(env.E2E_BASE_URL).hostname));
    assert.deepEqual([...env._profile.allowedHosts].sort(), ['127.0.0.1', 'localhost']);
  });

  it('kaynak taraması: giriş betikleri E2E_ENV okumaz, "hedef" varsayılanı yok', () => {
    const files = [];
    for (const dir of ['tests/e2e', 'tests/e2e/helpers', 'scripts', 'scripts/lib']) {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        if (f.endsWith('.mjs') && !f.endsWith('.test.mjs')) files.push(path.join(dir, f));
      }
    }
    const offenders = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (/process\.env\.E2E_ENV\b/.test(src)) offenders.push(`${rel}: process.env.E2E_ENV`);
      if (/\|\|\s*'(hedef|staging|ikram)'/.test(src) && /envId|envName|envRaw/.test(src)) {
        offenders.push(`${rel}: uzak varsayılan`);
      }
      if (/arg\('--env',\s*'(staging|hedef|ikram)/.test(src)) offenders.push(`${rel}: --env uzak varsayılanı`);
    }
    assert.deepEqual(offenders, []);
  });

  it('bayraksız uzak çağrı guard tarafından reddedilir (alias/site yok, operatör kapısı)', () => {
    assert.throws(() => assertRemoteAllowed({ bin: 'ssh', args: [], env: {} }));
    assert.throws(() => assertRemoteAllowed({ bin: 'ssh', args: ['example.org', 'true'], env: { CLAUDECODE: '1' } }));
  });

  it('canlı alan adı hâlâ reddedilir', () => {
    assert.equal(isLiveHedefHost('hedefdernegi.org'), true); // live-scan:allow-reject-test
    assert.equal(validateE2EBaseUrl('https://hedefdernegi.org', ['127.0.0.1', 'localhost']).ok, false); // live-scan:allow-reject-test
    assert.equal(validateE2EBaseUrl('https://example.org', ['127.0.0.1', 'localhost']).ok, false);
    assert.equal(validateE2EBaseUrl('http://127.0.0.1:8912', ['127.0.0.1', 'localhost']).ok, true);
  });
});
