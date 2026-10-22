import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRegistryAfterReset,
  preservedFixtures,
  createdForCleanup,
} from '../../../tests/e2e/helpers/run-registry.mjs';
import {
  fixtureProductRecords,
  verifiedFixtureIds,
  resolveFixtureProfileId,
  normalizeFixtureMark,
} from '../../../tests/e2e/helpers/fixtures.mjs';
import { parseArgs } from '../../../scripts/e2e-bootstrap.mjs';

describe('koşu defteri fixture koruması', () => {
  it('sıfırlama created/mutated temizler, fixtures kalır', () => {
    const prev = {
      runId: 'boot-old',
      created: [
        { id: 913, type: 'product', mark: 'boot-old', source: 'fixture' },
        { id: 50, type: 'order', mark: 'run-1', source: 'run' },
      ],
      mutated: [{ id: 3, type: 'product' }],
      fixtures: [{ id: 913, type: 'product', mark: 'boot-old', source: 'fixture' }],
    };
    const next = nextRegistryAfterReset(prev, 'run-9999', { now: '2026-10-22T00:00:00.000Z' });
    assert.equal(next.runId, 'run-9999');
    assert.deepEqual(next.created, []);
    assert.deepEqual(next.mutated, []);
    assert.equal(next.fixtures.length, 1);
    assert.equal(next.fixtures[0].id, 913);
    assert.equal(next.fixtures[0].source, 'fixture');
  });

  it('fixtureRecords dosyası kaynak: eski defter id’si düşer', () => {
    const prev = {
      fixtures: [
        { id: 913, type: 'product', mark: 'boot-old' },
        { id: 914, type: 'product', mark: 'boot-old' },
      ],
      created: [],
    };
    const next = nextRegistryAfterReset(prev, 'run-1000', {
      fixtureRecords: [{ id: 913, type: 'product', mark: 'boot-new' }],
    });
    assert.deepEqual(
      next.fixtures.map((f) => f.id),
      [913]
    );
  });

  it('clearFixtures fixtures’ı boşaltır', () => {
    const prev = {
      fixtures: [{ id: 913, type: 'product', mark: 'boot-old' }],
      created: [{ id: 913, type: 'product', source: 'fixture' }],
    };
    const next = nextRegistryAfterReset(prev, 'run-1000', { clearFixtures: true });
    assert.deepEqual(next.fixtures, []);
    assert.deepEqual(next.created, []);
  });

  it('temizlik fixture id ve source=fixture kaydı silmez', () => {
    const registry = {
      created: [
        { id: 913, type: 'product', source: 'fixture' },
        { id: 80, type: 'order', source: 'run' },
        { id: 914, type: 'product', source: 'run' },
      ],
      fixtures: [{ id: 913, type: 'product' }],
    };
    const kept = createdForCleanup(registry, [914]);
    assert.deepEqual(
      kept.map((x) => x.id),
      [80]
    );
  });

  it('preservedFixtures source=fixture created kaydını taşır', () => {
    const rows = preservedFixtures({
      created: [{ id: 919, type: 'product', mark: 'boot-x', source: 'fixture' }],
      fixtures: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 919);
  });
});

describe('fixture doğrulama', () => {
  it('ikram alias profil id’si ikram-aid', () => {
    assert.equal(resolveFixtureProfileId('ikram'), 'ikram-aid');
    assert.equal(resolveFixtureProfileId('ikram-aid'), 'ikram-aid');
  });

  it('işaret öneki normalize edilir', () => {
    assert.equal(normalizeFixtureMark('_wdp_e2e_test=boot-1'), 'boot-1');
    assert.equal(normalizeFixtureMark('boot-1'), 'boot-1');
  });

  it('üç koşul: id dosyada, mark eşit, private', () => {
    const data = {
      runId: 'boot-1',
      roles: {
        custom: { id: 913, mark: 'boot-1' },
        fixed: { id: 914, mark: 'boot-1' },
      },
    };
    assert.deepEqual(
      fixtureProductRecords(data).map((r) => r.id),
      [913, 914]
    );
    const snap = {
      posts: [
        { id: 913, type: 'product', status: 'private', mark: 'boot-1' },
        { id: 914, type: 'product', status: 'publish', mark: 'boot-1' },
        { id: 915, type: 'product', status: 'private', mark: 'boot-1' },
      ],
    };
    assert.deepEqual(verifiedFixtureIds(snap, data), [913]);
  });
});

describe('e2e:bootstrap --remove-fixtures', () => {
  it('parseArgs --remove-fixtures ve --remove aynı', () => {
    assert.equal(parseArgs(['--env', 'ikram', '--remove-fixtures']).remove, true);
    assert.equal(parseArgs(['--env', 'local', '--remove']).remove, true);
    assert.equal(parseArgs(['--env', 'local']).remove, false);
    assert.equal(parseArgs(['--env', 'ikram', '--remove-fixtures']).envId, 'ikram');
  });
});
