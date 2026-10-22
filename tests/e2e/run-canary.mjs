#!/usr/bin/env node
/**
 * Kanarya. Salt okunur ölçüm → baseline karşılaştırma.
 *
 *   npm run e2e:canary -- --env local
 *   npm run e2e:canary -- --env staging|ikram          (yalnız Claude)
 *   npm run e2e:canary -- --env staging --update-baseline
 *
 * Kayıt defteri dışındaki fark: KIRMIZI + build/e2e/CANARY-ALERT.txt
 * --update-baseline yalnız TEMİZ iken (fark yok veya yalnız defterde).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRemoteFrozen, FREEZE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';
import { canonicalEnv } from '../../scripts/lib/remote-discover-lib.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile } from './helpers/profile.mjs';
import { loadRegistry } from './helpers/run-registry.mjs';
import { loadFixtures } from './helpers/fixtures.mjs';
import {
  snapshotCanary,
  snapshotCanaryLocal,
  canaryBaselinePath,
  writeSnapshot,
  writeCanaryAlert,
  formatCanaryDiff,
  evaluateCanaryHealth,
} from './helpers/canary.mjs';

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * @param {string[]} argv
 */
export function parseCanaryArgs(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envRaw = 'local';
  let updateBaseline = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env') envRaw = String(a[++i] || envRaw);
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
    else if (x === '--update-baseline') updateBaseline = true;
  }
  return { envName: canonicalEnv(envRaw), updateBaseline };
}

/**
 * @param {{ envName: string, updateBaseline?: boolean, snapshotFn?: () => object, registry?: object, fixtures?: object|null, baseline?: object|null }} opts
 */
export function runCanary(opts) {
  const envName = canonicalEnv(opts.envName);
  const profile = loadProfile(envName);
  const remote = isRemoteProfile(profile);
  if (remote) setActiveProfile(profile);

  const current = opts.snapshotFn
    ? opts.snapshotFn()
    : remote
      ? snapshotCanary()
      : snapshotCanaryLocal();

  const registry = opts.registry || loadRegistry();
  const fixtures = opts.fixtures !== undefined ? opts.fixtures : loadFixtures(profile.id);
  const health = evaluateCanaryHealth(current, envName, registry, {
    updateBaseline: !!opts.updateBaseline,
    baseline: opts.baseline,
    fixtures,
    envId: profile.id,
  });
  const pre = health.pre;
  const evald = health.evald;
  const diffs = health.diffs;
  const warnings = health.warnings;
  const ok = health.ok;
  const status = ok ? 'TEMİZ' : 'KIRMIZI';
  const alertDiff = { ok: false, diffs, warnings };

  if (!ok) {
    writeCanaryAlert(alertDiff, `e2e:canary --env ${envName}`);
  } else if (warnings.length) {
    console.warn(formatCanaryDiff({ ok: true, diffs: [], warnings }));
  }

  if (opts.updateBaseline) {
    if (!evald.canUpdate || !pre.ok) {
      throw new Error(
        `--update-baseline reddedildi: fark kayıt defteri dışında veya ön kontrol kırmızı (${formatCanaryDiff(alertDiff)})`
      );
    }
    const file = canaryBaselinePath(envName);
    writeSnapshot(current, file);
    console.log(`baseline yazıldı: ${file}`);
  }

  console.log(`Kanarya ${envName}: ${status}`);
  if (!ok) {
    console.error(formatCanaryDiff(alertDiff));
  }
  return { status, ok, diffs, warnings, evald, pre, current };
}

function main() {
  const args = parseCanaryArgs();
  const profile = loadProfile(args.envName);
  if (isRemoteProfile(profile) && isRemoteFrozen()) {
    fail(FREEZE_MESSAGE);
  }
  try {
    const r = runCanary(args);
    if (!r.ok) process.exit(1);
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
