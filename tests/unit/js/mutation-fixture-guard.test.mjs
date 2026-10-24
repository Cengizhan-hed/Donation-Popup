/**
 * Mutasyon hedefi fixture listesinde değilse kırmızı.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMutationTargetIsFixture,
  assertRunMutationTargetsAreFixtures,
  MUTATION_FIXTURE_ROLES,
  isFixtureProductId,
} from '../../e2e/helpers/fixtures.mjs';

describe('mutasyon fixture iddiası', () => {
  it('MUTATION_FIXTURE_ROLES hisseli/kampanya/addon/hedef/boş fiyat içerir', () => {
    for (const role of ['shares', 'campaign', 'sadaka', 'goal-reached', 'empty-price']) {
      assert.equal(MUTATION_FIXTURE_ROLES.includes(role), true, role);
    }
  });

  it('listede olmayan id kırmızı', () => {
    const env = { E2E_PROFILE_ID: 'local' };
    assert.throws(
      () => assertMutationTargetIsFixture(999001, env, 'catalog'),
      /fixture listesinde değil/
    );
    assert.equal(isFixtureProductId(999001, env), false);
  });

  it('geçersiz id kırmızı', () => {
    assert.throws(() => assertMutationTargetIsFixture(0, {}, 'x'), /geçersiz id/);
  });

  it('yerel fixtures yoksa koşu başı atlanır (uzak kırmızı)', () => {
    const local = assertRunMutationTargetsAreFixtures({
      _profile: { id: 'local', remote: false },
      E2E_PROFILE_ID: 'local',
    });
    assert.equal(local.ok, true);
  });
});
