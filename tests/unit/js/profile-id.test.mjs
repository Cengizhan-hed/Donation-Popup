/**
 * Profil id normalizasyonu + görüntüleme kararı + onarım kırmızı.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveProfileId,
  sameProfileId,
  isolateUnitProfile,
  loadProfile,
  resolveTimeouts,
  getActiveTimeouts,
  DEFAULT_TIMEOUTS_LOCAL,
  DEFAULT_TIMEOUTS_REMOTE,
} from '../../../tests/e2e/helpers/profile.mjs';
import { parseRemoteSmokeArgs, isLocalSmokeEnv, SMOKE_CHECKS } from '../../../tests/e2e/helpers/remote-smoke.mjs';
import { outputProfileId, requireProfileId, safeProfileId } from '../../../tests/e2e/helpers/e2e-paths.mjs';
import {
  decideDonationViewContext,
  assertRepairTargetMarked,
} from '../../../tests/e2e/helpers/fixtures.mjs';
import { assertRegistryMatchesActiveEnv, REGISTRY_ENV_MISMATCH } from '../../../tests/e2e/helpers/run-registry.mjs';
import { collectRepairTargets, parseArgs } from '../../../scripts/e2e-bootstrap.mjs';
import { deviceRunsMutations, MUTATION_DEVICE_ID } from '../../../tests/e2e/helpers/mutation-policy.mjs';

const ALIASES = {
  'staging-hedef': ['staging', 'hedef', 'staging-hedef'],
  'ikram-aid': ['ikram', 'ikram-aid'],
  local: ['local'],
};

let restore = () => {};
beforeEach(() => {
  restore = isolateUnitProfile({ id: 'local', remote: false, allowedHosts: ['127.0.0.1'] });
});
afterEach(() => {
  restore();
});

describe('resolveProfileId takma ad', () => {
  it('staging/hedef/staging-hedef, ikram/ikram-aid, local eşit', () => {
    for (const [id, aliases] of Object.entries(ALIASES)) {
      for (const a of aliases) {
        assert.equal(resolveProfileId(a), id, a);
        assert.equal(sameProfileId(a, id), true, `${a} vs ${id}`);
        assert.equal(safeProfileId(a), id, `safe ${a}`);
        assert.equal(outputProfileId(a), id, `out ${a}`);
        assert.equal(requireProfileId(a), id, `req ${a}`);
      }
    }
    assert.equal(sameProfileId('staging', 'staging-hedef'), true);
    assert.equal(sameProfileId('ikram', 'ikram-aid'), true);
    assert.equal(sameProfileId('local', 'local'), true);
    assert.equal(sameProfileId('staging', 'ikram'), false);
    assert.equal(loadProfile('ikram').id, 'ikram-aid');
    assert.equal(loadProfile('staging').id, 'staging-hedef');
  });

  it('defter envId=ikram-aid etkin=ikram eşit (REGISTRY-ENV-MISMATCH yok)', () => {
    const r = { envId: 'ikram-aid', created: [{ id: 1, type: 'product' }] };
    assert.equal(assertRegistryMatchesActiveEnv(r, 'ikram'), r);
    assert.equal(assertRegistryMatchesActiveEnv(r, 'ikram-aid'), r);
    const s = { envId: 'staging-hedef', created: [] };
    assert.equal(assertRegistryMatchesActiveEnv(s, 'staging'), s);
    assert.equal(assertRegistryMatchesActiveEnv(s, 'hedef'), s);
    assert.throws(
      () => assertRegistryMatchesActiveEnv({ envId: 'ikram-aid' }, 'staging'),
      (err) => String(err && err.message).includes(REGISTRY_ENV_MISMATCH)
    );
  });
});

describe('decideDonationViewContext', () => {
  const remote = { id: 'staging-hedef', ssh: { alias: 'hedef-staging' } };
  const local = { id: 'local', remote: false, allowedHosts: ['127.0.0.1'] };

  it('uzak + private → yönetici; yayımlı → ziyaretçi', () => {
    assert.equal(
      decideDonationViewContext({ profile: remote, product: { status: 'private' } }),
      'admin'
    );
    assert.equal(
      decideDonationViewContext({ profile: remote, product: { fromFixture: true, published: false } }),
      'admin'
    );
    assert.equal(
      decideDonationViewContext({ profile: remote, product: { status: 'publish' } }),
      'visitor'
    );
    assert.equal(
      decideDonationViewContext({ profile: remote, product: { published: true } }),
      'visitor'
    );
    assert.equal(
      decideDonationViewContext({ profile: local, product: { status: 'publish' } }),
      'visitor'
    );
  });
});

describe('bootstrap --repair', () => {
  it('işaretsiz ürün id RED', () => {
    const fixtures = {
      runId: 'boot-test',
      roles: { custom: { id: 913, mark: 'boot-test', type: 'product' } },
    };
    assert.throws(() => assertRepairTargetMarked(10720, fixtures, 'catalog'), /REPAIR-RED: işaretsiz/);
    assert.throws(
      () => collectRepairTargets(fixtures, {}, [10720]),
      /REPAIR-RED: işaretsiz/
    );
    assert.equal(assertRepairTargetMarked(913, fixtures).id, 913);
    const parsed = parseArgs(['--env', 'ikram', '--repair', '--dry-run']);
    assert.equal(parsed.repair, true);
    assert.equal(parsed.dry, true);
    assert.equal(resolveProfileId(parsed.envId), 'ikram-aid');
  });
});

describe('mutasyon cihazı', () => {
  it('yalnız iphone yazar; android/desktop salt okunur', () => {
    assert.equal(MUTATION_DEVICE_ID, 'iphone');
    assert.equal(deviceRunsMutations('iphone'), true);
    assert.equal(deviceRunsMutations('android'), false);
    assert.equal(deviceRunsMutations('desktop'), false);
  });
});

describe('resolveTimeouts', () => {
  it('profil değeri okunur; yoksa uzak/yerel varsayılan', () => {
    const local = resolveTimeouts({ id: 'local', remote: false });
    assert.deepEqual(local, { ...DEFAULT_TIMEOUTS_LOCAL });
    const remoteDefault = resolveTimeouts({
      id: 'staging-hedef',
      ssh: { alias: 'hedef-staging' },
    });
    assert.equal(remoteDefault.navigation, DEFAULT_TIMEOUTS_REMOTE.navigation);
    assert.equal(remoteDefault.action, DEFAULT_TIMEOUTS_REMOTE.action);
    const fromJson = resolveTimeouts(loadProfile('staging'));
    assert.equal(fromJson.navigation, 60000);
    assert.equal(fromJson.action, DEFAULT_TIMEOUTS_REMOTE.action);
    const ikram = resolveTimeouts(loadProfile('ikram'));
    assert.equal(ikram.navigation, 60000);
    const override = resolveTimeouts({
      id: 'x',
      remote: true,
      timeouts: { navigation: 60000, action: 12000 },
    });
    assert.equal(override.navigation, 60000);
    assert.equal(override.action, 12000);
    assert.equal(override.expect, DEFAULT_TIMEOUTS_REMOTE.expect);
  });

  it('etkin profil getActiveTimeouts', () => {
    const t = getActiveTimeouts();
    assert.equal(t.navigation, DEFAULT_TIMEOUTS_LOCAL.navigation);
  });
});

describe('e2e:remote-smoke args', () => {
  it('varsayılan local; staging/ikram takma ad; kontrol listesi 8', () => {
    assert.equal(parseRemoteSmokeArgs([]).envId, 'local');
    assert.equal(parseRemoteSmokeArgs(['--env', 'staging']).envId, 'staging-hedef');
    assert.equal(parseRemoteSmokeArgs(['--env=ikram']).envId, 'ikram-aid');
    assert.equal(isLocalSmokeEnv('local'), true);
    assert.equal(isLocalSmokeEnv('staging-hedef'), false);
    assert.equal(SMOKE_CHECKS.length, 8);
    assert.ok(SMOKE_CHECKS.includes('checkout-view'));
    assert.ok(SMOKE_CHECKS.includes('amount-ambiguous'));
  });
});
