/**
 * e2e:full iPhone iki çocuk; mutasyon alanları ayrı.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHILD_TIMEOUT_MS,
  IPHONE_CORE_AREAS,
  IPHONE_MUT_AREAS,
  fullChildJobs,
  outputDeviceId,
  partitionSpawnWaves,
  wantAnyMutationArea,
} from '../../../tests/e2e/helpers/full-slices.mjs';

describe('fullChildJobs', () => {
  it('iphone → core + mut; diğer cihaz tek; --areas ezmesi', () => {
    const iphone = fullChildJobs('iphone');
    assert.equal(iphone.length, 2);
    assert.equal(iphone[0].slice, 'core');
    assert.deepEqual(iphone[0].areas, [...IPHONE_CORE_AREAS]);
    assert.equal(iphone[1].slice, 'mut');
    assert.deepEqual(iphone[1].areas, [...IPHONE_MUT_AREAS]);
    assert.equal(iphone[0].areas.some((a) => IPHONE_MUT_AREAS.includes(a)), false);
    assert.equal(iphone[1].areas.includes('checkout-flow'), false);

    const android = fullChildJobs('android');
    assert.equal(android.length, 1);
    assert.equal(android[0].areas, null);

    const forced = fullChildJobs('iphone', ['checkout-flow']);
    assert.equal(forced.length, 1);
    assert.deepEqual(forced[0].areas, ['checkout-flow']);
  });
});

describe('outputDeviceId / timeout', () => {
  it('core → iphone; mut → iphone-mut; 20 dk', () => {
    assert.equal(outputDeviceId('iphone', 'core'), 'iphone');
    assert.equal(outputDeviceId('iphone', 'mut'), 'iphone-mut');
    assert.equal(outputDeviceId('desktop', ''), 'desktop');
    assert.equal(CHILD_TIMEOUT_MS, 20 * 60 * 1000);
  });
});

describe('partitionSpawnWaves', () => {
  it('yerelde mut ayrı dalga; uzakta tek dalga', () => {
    const jobs = [
      { slice: 'core', deviceId: 'iphone' },
      { slice: 'mut', deviceId: 'iphone' },
      { slice: '', deviceId: 'android' },
    ];
    const remote = partitionSpawnWaves(jobs, { local: false });
    assert.equal(remote.length, 1);
    assert.equal(remote[0].length, 3);
    const local = partitionSpawnWaves(jobs, { local: true });
    assert.equal(local.length, 2);
    assert.equal(local[0].some((j) => j.slice === 'mut'), false);
    assert.equal(local[1].every((j) => j.slice === 'mut'), true);
  });
});

describe('wantAnyMutationArea', () => {
  it('yalnız istenen mutasyon alanları', () => {
    const suites = [
      ['amount-options'],
      ['form-fields'],
    ];
    assert.equal(wantAnyMutationArea((id) => id === 'amount-options', suites), true);
    assert.equal(wantAnyMutationArea((id) => id === 'core', suites), false);
  });
});
