#!/usr/bin/env node
/**
 * Tam paket: 3 cihaz × gerçek ortam(lar). Merge öncesi.
 * Varsayılan: Hedef + Ikram. `--env hedef` yalnız Hedef.
 *
 *   npm run e2e:full
 *   npm run e2e:full -- --env hedef
 *   npm run e2e:full -- --device desktop --env hedef
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadE2EEnv, parseE2ECli, ROOT } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { captureAll } from './helpers/capture.mjs';
import { compareAndReport } from './helpers/report.mjs';
import { DEVICE_ORDER, parseDeviceList } from './helpers/devices.mjs';
import {
  baselineDirFor,
  currentDirFor,
  REPORT_DIR,
  cleanE2EOutputDirs,
  normalizeScreenNames,
  readLocalPluginVersion,
  writeRunManifest,
  CURRENT_DIR,
} from './helpers/run-io.mjs';
import { formatRemotePostBlockedLines } from './helpers/network-guard.mjs';

function envList(envId) {
  const v = String(envId || '').trim().toLowerCase();
  if (!v || v === 'all') return ['hedef', 'ikram'];
  return [v];
}

async function runOne({ envId, deviceId, noSideCart }) {
  let env = loadE2EEnv({ envId });
  env = await fillMissingProductSlugs(env);
  const profileId = env.E2E_PROFILE_ID || env._profile?.id || envId;
  const outDir = currentDirFor(profileId, deviceId);
  fs.mkdirSync(outDir, { recursive: true });
  const started = Date.now();
  console.log(`\n=== full ${profileId} × ${deviceId} ===`);
  const result = await captureAll({
    env,
    outDir,
    runFunctional: true,
    mode: deviceId === 'desktop' ? 'full' : 'quick',
    workers: deviceId === 'iphone' ? 2 : 3,
    runLabel: `full-${profileId}-${deviceId}`,
    noSideCart,
    device: deviceId,
    areas: null,
  });
  const capturedScreens = result.screens?.length
    ? result.screens
    : normalizeScreenNames(result.shots || []);
  const baselineDir = baselineDirFor(profileId, deviceId);
  const compared = compareAndReport(
    baselineDir,
    outDir,
    REPORT_DIR,
    result.failures || [],
    env.E2E_DIFF_THRESHOLD,
    {
      skips: result.skips || [],
      flaky: result.flaky || [],
      stats: result.stats || {},
      capturedScreens,
      mode: 'full',
      shellDiffThreshold: env.E2E_SHELL_DIFF_THRESHOLD,
    }
  );
  return {
    env: profileId,
    device: deviceId,
    secs: Number(((Date.now() - started) / 1000).toFixed(1)),
    passed: compared.passedCount,
    skipped: compared.skippedCount,
    failed: compared.failedCount,
    failures: result.failures || [],
    skips: result.skips || [],
    flaky: result.flaky || [],
    screens: capturedScreens,
    changedScreens: compared.changedScreens || [],
    newBaselineScreens: compared.newBaselineScreens || [],
    a11yFindings: result.a11yFindings || [],
    reportFile: compared.reportFile,
    blocked_trackers: result.blocked_trackers || { total: 0, byHost: {} },
    remote_post_blocked: result.remote_post_blocked || { total: 0, byPath: {} },
  };
}

async function main() {
  const flags = parseE2ECli(process.argv.slice(2));
  const devices = flags.device ? parseDeviceList(flags.device) : [...DEVICE_ORDER];
  const envs = envList(flags.envId);
  cleanE2EOutputDirs();
  const startedAt = new Date().toISOString();
  const started = Date.now();
  /** @type {object[]} */
  const rows = [];

  for (const envId of envs) {
    const tEnv = Date.now();
    /** Cihazlar sırayla: aynı ürün metasını paralel yazmamak için. */
    const deviceRuns = [];
    for (const deviceId of devices) {
      try {
        deviceRuns.push(await runOne({ envId, deviceId, noSideCart: flags.noSideCart }));
      } catch (e) {
        deviceRuns.push({
          env: envId,
          device: deviceId,
          secs: 0,
          passed: 0,
          skipped: 0,
          failed: 1,
          failures: [{ check: 'runner', description: String(e.message || e) }],
          skips: [],
          flaky: [],
          screens: [],
          changedScreens: [],
          newBaselineScreens: [],
          a11yFindings: [],
        });
      }
    }
    rows.push(...deviceRuns);
    console.log(`Ortam ${envId} cihazları: ${((Date.now() - tEnv) / 1000).toFixed(1)}s`);
  }

  const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
  const failedCount = rows.reduce((n, r) => n + (r.failed || 0), 0);
  const passedCount = rows.reduce((n, r) => n + (r.passed || 0), 0);
  const skippedCount = rows.reduce((n, r) => n + (r.skipped || 0), 0);
  const allScreens = [...new Set(rows.flatMap((r) => r.screens || []))];
  const changedScreens = [...new Set(rows.flatMap((r) => r.changedScreens || []))];
  const newBaselineScreens = [...new Set(rows.flatMap((r) => r.newBaselineScreens || []))];
  const a11yFindings = rows.flatMap((r) => r.a11yFindings || []);
  /** @type {Record<string, number>} */
  const trackerHosts = {};
  for (const r of rows) {
    const byHost = r.blocked_trackers?.byHost || {};
    for (const [host, n] of Object.entries(byHost)) {
      trackerHosts[host] = (trackerHosts[host] || 0) + Number(n || 0);
    }
  }
  const blocked_trackers = {
    total: Object.values(trackerHosts).reduce((a, b) => a + b, 0),
    byHost: trackerHosts,
  };
  /** @type {Record<string, number>} */
  const postPaths = {};
  for (const r of rows) {
    const byPath = r.remote_post_blocked?.byPath || {};
    for (const [p, n] of Object.entries(byPath)) {
      postPaths[p] = (postPaths[p] || 0) + Number(n || 0);
    }
  }
  const remote_post_blocked = {
    total: Object.values(postPaths).reduce((a, b) => a + b, 0),
    byPath: postPaths,
  };

  writeRunManifest({
    mode: 'full',
    envs,
    devices,
    startedAt,
    endedAt: new Date().toISOString(),
    durationSec,
    pluginVersion: readLocalPluginVersion(),
    screens: allScreens,
    stats: { passed: passedCount, skipped: skippedCount, failed: failedCount },
    changedScreens,
    newBaselineScreens,
    rows: rows.map((r) => ({
      env: r.env,
      device: r.device,
      secs: r.secs,
      passed: r.passed,
      skipped: r.skipped,
      failed: r.failed,
    })),
    a11yFindings,
    blocked_trackers,
    remote_post_blocked,
  });

  console.log('\n=== e2e:full özet ===');
  console.log('ortam\tcihaz\tgeçti\tatlandı\thata\tsüre');
  for (const r of rows) {
    console.log(`${r.env}\t${r.device}\t${r.passed}\t${r.skipped}\t${r.failed}\t${r.secs}s`);
  }
  console.log(`TOPLAM süre: ${durationSec}s  Geçti=${passedCount} Atlandı=${skippedCount} Hata=${failedCount}`);
  console.log(formatRemotePostBlockedLines(remote_post_blocked));
  console.log(`Manifest: ${path.relative(ROOT, path.join(CURRENT_DIR, 'run.json'))}`);

  if (failedCount > 0) {
    console.error('\n=== Hatalar ===');
    for (const r of rows) {
      for (const f of r.failures || []) {
        console.error(`• [${r.env}/${r.device}/${f.check}] ${f.description}`);
      }
    }
    process.exit(1);
  }
  console.log('E2E full passed.');
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
