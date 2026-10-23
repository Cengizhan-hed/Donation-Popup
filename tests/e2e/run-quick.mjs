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
  cleanE2EOutputDirs,
  normalizeScreenNames,
  readLocalPluginVersion,
  writeRunManifest,
  slowestSections,
  reportDirFor,
  runJsonFor,
} from './helpers/run-io.mjs';
import { formatRemotePostBlockedLines } from './helpers/network-guard.mjs';
import { withEnvRunLock } from './helpers/env-lock.mjs';

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

function isLocalEnvId(envId) {
  const v = String(envId || '').toLowerCase();
  return v === 'local' || v === 'local-wp';
}

async function main() {
  const flags = parseE2ECli(process.argv.slice(2));
  const deviceId = flags.device || 'iphone';
  const localPort = Number(process.env.WDP_LOCAL_E2E_PORT || 8899) || 8899;
  /** @type {{ stop: () => Promise<void> } | null} */
  let localServer = null;
  let code = 0;
  try {
  if (isLocalEnvId(flags.envId)) {
    const tPrep = Date.now();
    const { prepareLocalFullStack } = await import('./helpers/matrix-setup.mjs');
    const stack = await prepareLocalFullStack(localPort);
    localServer = stack.server;
    console.log(`[e2e] prepareLocalFullStack: ${((Date.now() - tPrep) / 1000).toFixed(1)}s`);
  }
  let env;
  try {
    env = isLocalEnvId(flags.envId)
      ? loadE2EEnv({
          envId: 'local',
          parsed: {
            E2E_USER: 'admin',
            E2E_PASS: 'admin',
            E2E_BASE_URL: `http://127.0.0.1:${localPort}`,
          },
        })
      : loadE2EEnv({ envId: flags.envId });
    env = await fillMissingProductSlugs(env);
  } catch (e) {
    console.error(String(e.message || e));
    throw e;
  }

  const areaInfo = flags.all
    ? { areas: null, files: [], unmatched: [], reason: '--all' }
    : resolveQuickAreas(flags.areas);
  const profileId = env.E2E_PROFILE_ID || env._profile?.id || 'staging-hedef';
  const outDir = currentDirFor(profileId, deviceId);
  const baselineDir = baselineDirFor(profileId, deviceId);

  code = await withEnvRunLock(profileId, async () => {
  cleanE2EOutputDirs(profileId);
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
    warnings = [],
    flaky = [],
    debugFiles = [],
    stats = {},
    screens = [],
    shots = [],
    noSideCart = false,
    a11yFindings = [],
    blocked_trackers = { total: 0, byHost: {} },
    remote_post_blocked = { total: 0, byPath: {} },
    izinli_okuma = { total: 0, byAction: {} },
    sections = [],
  } = await captureAll({
    env,
    outDir,
    runFunctional: true,
    mode: 'quick',
    workers: 4,
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
  } = compareAndReport(baselineDir, outDir, reportDirFor(profileId), failures, env.E2E_DIFF_THRESHOLD, {
    skips,
    warnings,
    flaky,
    stats,
    capturedScreens,
    mode: 'quick',
    shellDiffThreshold: env.E2E_SHELL_DIFF_THRESHOLD,
  });

  const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
  const manifestFile = runJsonFor(profileId);
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
      warned: warnings.length,
    },
    warnings,
    changedScreens,
    newBaselineScreens,
    flaky,
    a11yFindings,
    baselineDir: path.relative(ROOT, baselineDir),
    currentDir: path.relative(ROOT, outDir),
    blocked_trackers,
    remote_post_blocked,
    izinli_okuma,
    sections,
  }, manifestFile);

  console.log('Report:', reportFile);
  console.log(
    `İşlevsel özet: Geçti=${passedCount} Atlandı=${skippedCount} Hata=${failedCount} Uyarı=${warnings.length}` +
      ` | noSideCart=${noSideCart ? 'evet' : 'hayır'}`
  );
  if (warnings.length) {
    console.warn('=== Uyarılar (hata değil) ===');
    for (const w of warnings) {
      console.warn(`• [${w.check}] ${w.description}`);
      if (w.detail) console.warn(`  ${w.detail}`);
    }
  }
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
  const slow = slowestSections(sections, 5);
  if (slow.length) {
    console.log('En yavaş 5 bölüm:');
    for (const s of slow) console.log(`  ${s.label}: ${s.secs.toFixed(1)}s`);
  }
  console.log(formatRemotePostBlockedLines(remote_post_blocked, izinli_okuma));
  console.log(`Manifest: ${path.relative(ROOT, manifestFile)}`);

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
    return 1;
  }
  console.log('E2E quick passed.');
  return 0;
  });
  } finally {
    if (localServer) await localServer.stop();
  }
  if (code) process.exit(code);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
