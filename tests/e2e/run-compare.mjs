#!/usr/bin/env node
/**
 * Capture current screens, compare to baseline, write build/e2e/report.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadE2EEnv, parseE2ECli, ROOT } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { captureAll } from './helpers/capture.mjs';
import { compareAndReport } from './helpers/report.mjs';
import {
  CURRENT_DIR,
  REPORT_DIR,
  baselineDirFor,
  currentDirFor,
  cleanE2EOutputDirs,
  normalizeScreenNames,
  readLocalPluginVersion,
  writeRunManifest,
} from './helpers/run-io.mjs';

async function main() {
  const flags = parseE2ECli(process.argv.slice(2));
  const deviceId = flags.device || 'desktop';
  let env;
  try {
    env = loadE2EEnv({ envId: flags.envId });
    env = await fillMissingProductSlugs(env);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  const profileId = env.E2E_PROFILE_ID || 'staging-hedef';
  const baselineDir = baselineDirFor(profileId, deviceId);
  const outDir = currentDirFor(profileId, deviceId);
  cleanE2EOutputDirs();
  fs.mkdirSync(baselineDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const started = Date.now();
  console.log(`Capturing current → ${path.relative(ROOT, outDir)}/`);
  const {
    failures,
    skips = [],
    flaky = [],
    stats = {},
    screens = [],
    shots = [],
    blocked_trackers = { total: 0, byHost: {} },
  } = await captureAll({
    env,
    outDir,
    runFunctional: true,
    mode: 'full',
    workers: 3,
    runLabel: 'full',
    device: deviceId,
  });

  const capturedScreens = screens.length ? screens : normalizeScreenNames(shots);

  const {
    reportFile,
    rows,
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
    mode: 'full',
    shellDiffThreshold: env.E2E_SHELL_DIFF_THRESHOLD,
  });

  writeRunManifest({
    mode: 'full',
    startedAt,
    endedAt: new Date().toISOString(),
    durationSec: Number(((Date.now() - started) / 1000).toFixed(1)),
    pluginVersion: readLocalPluginVersion(),
    screens: capturedScreens,
    stats: {
      passed: passedCount,
      skipped: skippedCount,
      failed: failedCount,
    },
    changedScreens,
    newBaselineScreens,
    flaky,
    blocked_trackers,
  });

  console.log('Report:', reportFile);
  const top = rows.slice(0, 5).map((r) => `${r.name}: ${r.pct.toFixed(2)}%`).join(', ');
  console.log('Top diffs:', top || '(none)');
  console.log(
    `İşlevsel özet: Geçti=${passedCount} Atlandı=${skippedCount} Hata=${failedCount}`
  );
  if (flaky.length) {
    console.warn(
      `Kararsız (yeniden denemede geçti): ${flaky.map((f) => f.check).join(', ')}`
    );
  }
  console.log(
    `Görsel durum: Değişti=${changedCount} Yeni referans=${newBaselineCount} (eşik ≤ ${threshold}%)`
  );
  console.log(`Manifest: ${path.relative(ROOT, path.join(CURRENT_DIR, 'run.json'))}`);
  if (skips.length) {
    console.log('');
    console.log('=== Atlanan kontroller ===');
    for (const s of skips) {
      console.log(`• [${s.check}] ${s.description}`);
      if (s.detail) console.log(`  ${s.detail}`);
    }
  }

  if (failures.length) {
    console.error('');
    console.error('=== İşlevsel hatalar ===');
    for (const f of failures) {
      console.error(`• [${f.check}] ${f.description}`);
      const detailLines = String(f.detail || '')
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 3);
      for (const line of detailLines) {
        console.error(`  ${line}`);
      }
      if (f.screenshot) console.error(`  ekran: ${f.screenshot}`);
      if (f.debugFile) console.error(`  tam log: ${f.debugFile}`);
      console.error('');
    }
    process.exit(1);
  }
  console.log('E2E functional checks passed (skips allowed).');
}

main().catch((e) => {
  const msg = String(e && e.message ? e.message : e);
  const lines = msg.split(/\r?\n/);
  console.error(lines.slice(0, 3).join('\n'));
  if (lines.length > 3) {
    const debugDir = path.join(ROOT, 'build/e2e/debug');
    fs.mkdirSync(debugDir, { recursive: true });
    const debugFile = path.join(debugDir, 'uncaught.txt');
    fs.writeFileSync(debugFile, msg, 'utf8');
    console.error(`… (tam log: ${path.relative(ROOT, debugFile)})`);
  }
  process.exit(1);
});
