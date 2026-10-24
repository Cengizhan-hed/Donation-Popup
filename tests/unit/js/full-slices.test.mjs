/**
 * e2e:full iPhone üç çocuk; mutasyon alanları iki dilim.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHILD_TIMEOUT_MS,
  IPHONE_CORE_AREAS,
  IPHONE_MUT_AREAS,
  IPHONE_MUT_AREAS_A,
  IPHONE_MUT_AREAS_B,
  fullChildJobs,
  isMutationSlice,
  outputDeviceId,
  partitionSpawnWaves,
  wantAnyMutationArea,
} from '../../../tests/e2e/helpers/full-slices.mjs';

describe('fullChildJobs', () => {
  it('iphone → core + mut + mut2; diğer cihaz tek; --areas ezmesi', () => {
    const iphone = fullChildJobs('iphone');
    assert.equal(iphone.length, 3);
    assert.equal(iphone[0].slice, 'core');
    assert.deepEqual(iphone[0].areas, [...IPHONE_CORE_AREAS]);
    assert.equal(iphone[1].slice, 'mut');
    assert.deepEqual(iphone[1].areas, [...IPHONE_MUT_AREAS_A]);
    assert.equal(iphone[2].slice, 'mut2');
    assert.deepEqual(iphone[2].areas, [...IPHONE_MUT_AREAS_B]);
    assert.equal(iphone[0].areas.some((a) => IPHONE_MUT_AREAS.includes(a)), false);
    assert.equal(iphone[1].areas.includes('checkout-flow'), false);
    assert.equal(iphone[1].areas.includes('campaign-blocks'), false);
    assert.equal(iphone[2].areas.includes('form-fields'), false);
    const union = [...iphone[1].areas, ...iphone[2].areas];
    assert.deepEqual([...union].sort(), [...IPHONE_MUT_AREAS].sort());

    const android = fullChildJobs('android');
    assert.equal(android.length, 1);
    assert.equal(android[0].areas, null);

    const forced = fullChildJobs('iphone', ['checkout-flow']);
    assert.equal(forced.length, 1);
    assert.deepEqual(forced[0].areas, ['checkout-flow']);
  });
});

describe('outputDeviceId / timeout', () => {
  it('core → iphone; mut → iphone-mut; mut2 → iphone-mut2; 20 dk', () => {
    assert.equal(outputDeviceId('iphone', 'core'), 'iphone');
    assert.equal(outputDeviceId('iphone', 'mut'), 'iphone-mut');
    assert.equal(outputDeviceId('iphone', 'mut2'), 'iphone-mut2');
    assert.equal(outputDeviceId('desktop', ''), 'desktop');
    assert.equal(CHILD_TIMEOUT_MS, 20 * 60 * 1000);
    assert.equal(isMutationSlice('mut'), true);
    assert.equal(isMutationSlice('mut2'), true);
    assert.equal(isMutationSlice('core'), false);
  });
});

describe('partitionSpawnWaves', () => {
  it('yerelde mut dilimleri ayrı dalga; uzakta ilk mut çekirdekle, mut2 sonra', () => {
    const jobs = [
      { slice: 'core', deviceId: 'iphone' },
      { slice: 'mut', deviceId: 'iphone' },
      { slice: 'mut2', deviceId: 'iphone' },
      { slice: '', deviceId: 'android' },
    ];
    const remote = partitionSpawnWaves(jobs, { local: false });
    assert.equal(remote.length, 2);
    assert.equal(remote[0].some((j) => j.slice === 'mut'), true);
    assert.equal(remote[0].some((j) => j.slice === 'mut2'), false);
    assert.equal(remote[1].length, 1);
    assert.equal(remote[1][0].slice, 'mut2');
    const local = partitionSpawnWaves(jobs, { local: true });
    assert.equal(local.length, 3);
    assert.equal(local[0].some((j) => isMutationSlice(j.slice)), false);
    assert.equal(local[1][0].slice, 'mut');
    assert.equal(local[2][0].slice, 'mut2');
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
