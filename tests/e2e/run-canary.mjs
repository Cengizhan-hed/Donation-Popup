#!/usr/bin/env node
/**
 * Kanarya. Salt okunur ölçüm → baseline karşılaştırma.
 *
 *   npm run e2e:canary -- --env local
 *   npm run e2e:canary -- --env staging|ikram          (yalnız Claude)
 *   npm run e2e:canary -- --env staging --update-baseline
 *   npm run e2e:canary -- --env ikram --accept-user-option woocommerce_cod_settings_enabled,…
 *     (site sahibi ayarı değiştirdi; yalnız adı verilen anahtarlar baseline'a işlenir, başka fark varsa red)
 *
 * Kayıt defteri dışındaki fark: KIRMIZI + build/e2e/CANARY-ALERT.txt
 * --update-baseline yalnız TEMİZ iken (fark yok veya yalnız defterde).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRemoteFrozen, FREEZE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile, resolveProfileId } from './helpers/profile.mjs';
import { assertRegistryMatchesActiveEnv, loadRegistry } from './helpers/run-registry.mjs';
import { withEnvRunLock } from './helpers/env-lock.mjs';
import { loadFixtures } from './helpers/fixtures.mjs';
import {
  snapshotCanary,
  snapshotCanaryLocal,
  canaryBaselinePath,
  writeSnapshot,
  writeCanaryAlert,
  formatCanaryDiff,
  evaluateCanaryHealth,
  acceptUserOptionChanges,
  readBaseline,
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
  /** @type {string[]} */
  let acceptOptions = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env') envRaw = String(a[++i] || envRaw);
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
    else if (x === '--update-baseline') updateBaseline = true;
    else if (x === '--accept-user-option') acceptOptions = String(a[++i] || '').split(',').map((k) => k.trim()).filter(Boolean);
    else if (x.startsWith('--accept-user-option=')) acceptOptions = x.slice('--accept-user-option='.length).split(',').map((k) => k.trim()).filter(Boolean);
  }
  return { envName: resolveProfileId(envRaw) || 'local', updateBaseline, acceptOptions };
}

/**
 * @param {{ envName: string, updateBaseline?: boolean, snapshotFn?: () => object, registry?: object, fixtures?: object|null, baseline?: object|null }} opts
 */
export function runCanary(opts) {
  const envName = resolveProfileId(opts.envName) || 'local';
  const profile = loadProfile(envName);
  const remote = isRemoteProfile(profile);
  setActiveProfile(profile);

  const registry = opts.registry || loadRegistry(profile.id);
  assertRegistryMatchesActiveEnv(registry, profile.id);

  const current = opts.snapshotFn
    ? opts.snapshotFn()
    : remote
      ? snapshotCanary()
      : snapshotCanaryLocal();
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
  let status = ok ? 'TEMİZ' : 'KIRMIZI';
  const alertDiff = { ok: false, diffs, warnings };

  if (!ok && Array.isArray(opts.acceptOptions) && opts.acceptOptions.length) {
    const base = opts.baseline || readBaseline(profile.id);
    const acc = acceptUserOptionChanges(base, current, diffs, opts.acceptOptions);
    if (!acc.ok) {
      throw new Error(`--accept-user-option reddedildi: ${acc.reason}`);
    }
    const file = canaryBaselinePath(envName);
    writeSnapshot(acc.baseline, file);
    console.log(`baseline güncellendi (kullanıcı kararı): ${acc.accepted.join(', ')}`);
    return runCanary({ ...opts, acceptOptions: [], baseline: acc.baseline });
  }

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

async function main() {
  const args = parseCanaryArgs();
  const profile = loadProfile(args.envName);
  if (isRemoteProfile(profile) && isRemoteFrozen()) {
    fail(FREEZE_MESSAGE);
  }
  const code = await withEnvRunLock(
    profile.id,
    () => {
      const r = runCanary(args);
      return r.ok ? 0 : 1;
    },
    { command: 'e2e:canary' }
  );
  if (code) process.exit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
