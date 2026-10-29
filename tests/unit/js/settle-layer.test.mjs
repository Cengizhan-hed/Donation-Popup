import test from 'node:test';
import assert from 'node:assert/strict';
import { settleLayerInPage } from '../../e2e/helpers/settle-layer.mjs';

/** Sahte saat: her rAF 16 ms ilerler. */
function fakeEnv(animEndsAt, rectAt) {
  let t = 0;
  const root = {
    getAnimations: () => (t < animEndsAt ? [{ playState: 'running', effect: { getComputedTiming: () => ({ iterations: 1 }) } }] : []),
    getBoundingClientRect: () => rectAt(t),
  };
  return {
    root,
    now: () => t,
    raf: (cb) => {
      t += 16;
      Promise.resolve().then(cb);
    },
  };
}

test('animasyon sürerken ölçmeye izin vermez, bitince 56x53 görünür', async () => {
  const rectAt = (t) => (t < 500 ? { left: 0, top: 0, width: 16, height: 18 } : { left: 0, top: 0, width: 56, height: 53 });
  const env = fakeEnv(500, rectAt);
  const res = await settleLayerInPage({ quietMs: 300, maxMs: 3000 }, env);
  assert.equal(res.settled, true);
  assert.equal(res.timedOut, false);
  assert.ok(res.waitedMs >= 800, 'animasyon + 300 ms sessizlik beklenmeli: ' + res.waitedMs);
  assert.equal(env.root.getBoundingClientRect().width, 56);
});

test('bitmeyen animasyonda 3 sn sonra timedOut döner', async () => {
  const env = fakeEnv(1e9, () => ({ left: 0, top: 0, width: 10, height: 10 }));
  const res = await settleLayerInPage({ quietMs: 300, maxMs: 3000 }, env);
  assert.equal(res.timedOut, true);
  assert.ok(res.waitedMs >= 3000 && res.waitedMs < 3100);
});

test('sonsuz animasyon (spinner) beklemeyi engellemez', async () => {
  const env = fakeEnv(0, () => ({ left: 0, top: 0, width: 56, height: 53 }));
  env.root.getAnimations = () => [{ playState: 'running', effect: { getComputedTiming: () => ({ iterations: Infinity }) } }];
  const res = await settleLayerInPage({ quietMs: 300, maxMs: 3000 }, env);
  assert.equal(res.settled, true);
});
