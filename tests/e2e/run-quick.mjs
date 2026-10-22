#!/usr/bin/env node
/**
 * Hızlı E2E: YALNIZ iPhone (WebKit), YALNIZ değişen alanın işlevsel testleri.
 * Varsayılan ortam Hedef staging; `--env ikram` ile Ikram.
 * Hedef süre < 5 dk. `--all` alan süzgecini kapatır. `--device desktop` eski 70’lik küme.
 *
 *   npm run e2e:quick
 *   npm run e2e:quick -- --env ikram
 *   npm run e2e:quick -- --all --device desktop
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadE2EEnv, parseE2ECli, ROOT } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { captureAll } from './helpers/capture.mjs';
import { compareAndReport } from './helpers/report.mjs';
import { resolveQuickAreas } from './helpers/area-filter.mjs';
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

function openReport(reportFile) {
  if (process.platform === 'darwin') {
    spawn('open', [reportFile], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', reportFile], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [reportFile], { detached: true, stdio: 'ignore' }).unref();
}

async function main() {
  const flags = parseE2ECli(process.argv.slice(2));
  const deviceId = flags.device || 'iphone';
  let env;
  try {
    env = loadE2EEnv({ envId: flags.envId });
    env = await fillMissingProductSlugs(env);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  const areaInfo = flags.all
    ? { areas: null, files: [], unmatched: [], reason: '--all' }
    : resolveQuickAreas(flags.areas);
  const profileId = env.E2E_PROFILE_ID || env._profile?.id || 'staging-hedef';
  const outDir = currentDirFor(profileId, deviceId);
  const baselineDir = baselineDirFor(profileId, deviceId);

  cleanE2EOutputDirs();
  const startedAt = new Date().toISOString();
  const started = Date.now();
  console.log(
    `E2E quick (${deviceId}, env=${profileId}, alan=${areaInfo.areas ? areaInfo.areas.join(',') : 'hepsi'} — ${areaInfo.reason})`
  );
  if (areaInfo.files.length) {
    console.log(`Değişen dosya: ${areaInfo.files.length} (eşlemesiz ${areaInfo.unmatched.length})`);
  }
  if (flags.noSideCart) console.log('Seçenek: --no-side-cart');

  const {
    failures,
    skips = [],
    flaky = [],
    debugFiles = [],
    stats = {},
    screens = [],
    shots = [],
    noSideCart = false,
    a11yFindings = [],
    blocked_trackers = { total: 0, byHost: {} },
    remote_post_blocked = { total: 0, byPath: {} },
  } = await captureAll({
    env,
    outDir,
    runFunctional: true,
    mode: 'quick',
    workers: deviceId === 'iphone' ? 2 : 4,
    runLabel: 'quick',
    noSideCart: flags.noSideCart,
    device: deviceId,
    areas: areaInfo.areas,
  });

  const capturedScreens = screens.length ? screens : normalizeScreenNames(shots);

  const {
    reportFile,
    changedCount,
    changedScreens = [],
    newBaselineCount = 0,
    newBaselineScreens = [],
    threshold,
    passedCount,
    skippedCount,
    failedCount,
  } = compareAndReport(baselineDir, outDir, REPORT_DIR, failures, env.E2E_DIFF_THRESHOLD, {
    skips,
    flaky,
    stats,
    capturedScreens,
    mode: 'quick',
    shellDiffThreshold: env.E2E_SHELL_DIFF_THRESHOLD,
  });

  const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
  writeRunManifest({
    mode: 'quick',
    env: profileId,
    device: deviceId,
    areas: areaInfo.areas,
    areaReason: areaInfo.reason,
    startedAt,
    endedAt: new Date().toISOString(),
    durationSec,
    pluginVersion: readLocalPluginVersion(),
    noSideCart: !!noSideCart,
    screens: capturedScreens,
    stats: {
      passed: passedCount,
      skipped: skippedCount,
      failed: failedCount,
    },
    changedScreens,
    newBaselineScreens,
    flaky,
    a11yFindings,
    baselineDir: path.relative(ROOT, baselineDir),
    currentDir: path.relative(ROOT, outDir),
    blocked_trackers,
    remote_post_blocked,
  });

  console.log('Report:', reportFile);
  console.log(
    `İşlevsel özet: Geçti=${passedCount} Atlandı=${skippedCount} Hata=${failedCount}` +
      ` | noSideCart=${noSideCart ? 'evet' : 'hayır'}`
  );
  if (flaky.length) {
    console.warn(`Kararsız (yeniden denemede geçti): ${flaky.map((f) => f.check).join(', ')}`);
  }
  console.log(
    `Görsel durum: Değişti=${changedCount} Yeni referans=${newBaselineCount}` +
      ` (sayfa ≤ ${threshold}% · kabuk ≤ ${env.E2E_SHELL_DIFF_THRESHOLD}%)`
  );
  if (changedScreens.length) {
    console.log('Değişti:');
    for (const name of changedScreens) console.log(`  • ${name}`);
  }
  if (newBaselineScreens.length) {
    console.log('Yeni:');
    for (const name of newBaselineScreens) console.log(`  • ${name}`);
  }
  console.log(`Süre: ${durationSec}s`);
  console.log(formatRemotePostBlockedLines(remote_post_blocked));
  console.log(`Manifest: ${path.relative(ROOT, path.join(CURRENT_DIR, 'run.json'))}`);

  if (flags.openReport) {
    openReport(reportFile);
    console.log('Rapor açıldı.');
  }

  if (failures.length) {
    console.error('');
    console.error('=== İşlevsel hatalar ===');
    for (const f of failures) {
      console.error(`• [${f.check}] ${f.description}`);
      if (f.detail) console.error(`  ${String(f.detail).split(/\r?\n/).slice(0, 2).join('\n  ')}`);
      if (f.debugFile) console.error(`  debug: ${f.debugFile}`);
    }
    if (debugFiles.length) {
      console.error('=== Teşhis dosyaları ===');
      for (const p of debugFiles) console.error(`  • ${p}`);
    }
    process.exit(1);
  }
  console.log('E2E quick passed.');
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
