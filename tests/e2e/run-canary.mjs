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
import { fileURLToPath } from 'node:url';
import { isRemoteFrozen, FREEZE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';
import { canonicalEnv } from '../../scripts/lib/remote-discover-lib.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile } from './helpers/profile.mjs';
import { loadRegistry } from './helpers/run-registry.mjs';
import {
  snapshotCanary,
  snapshotCanaryLocal,
  canaryBaselinePath,
  readBaseline,
  evaluateCanaryAgainstBaseline,
  writeSnapshot,
  writeCanaryAlert,
  formatCanaryDiff,
  preflightCanary,
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
 * @param {{ envName: string, updateBaseline?: boolean, snapshotFn?: () => object, registry?: object }} opts
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

  const pre = preflightCanary(current);
  const baseline = readBaseline(envName);
  const registry = opts.registry || loadRegistry();
  const evald = evaluateCanaryAgainstBaseline(baseline, current, registry, {
    updateBaseline: !!opts.updateBaseline,
  });

  const ok = evald.ok && pre.ok;
  const status = ok ? 'TEMİZ' : 'KIRMIZI';
  const diffs = [...(evald.diffs || []), ...(pre.ok ? [] : pre.diffs || [])];

  if (!ok) {
    writeCanaryAlert({ ok: false, diffs }, `e2e:canary --env ${envName}`);
  }

  if (opts.updateBaseline) {
    if (!evald.canUpdate || !pre.ok) {
      throw new Error(
        `--update-baseline reddedildi: fark kayıt defteri dışında veya ön kontrol kırmızı (${formatCanaryDiff({ ok: false, diffs })})`
      );
    }
    const file = canaryBaselinePath(envName);
    writeSnapshot(current, file);
    console.log(`baseline yazıldı: ${file}`);
  }

  console.log(`Kanarya ${envName}: ${status}`);
  if (!ok) {
    console.error(formatCanaryDiff({ ok: false, diffs }));
  }
  return { status, ok, diffs, evald, pre, current };
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
