#!/usr/bin/env node
/**
 * Save reference screenshots to tests/e2e/__baseline__/
 * Does not print secrets. Does not run while on production unless E2E_ALLOW_PROD=1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadE2EEnv, ROOT } from './helpers/env.mjs';
import { captureAll } from './helpers/capture.mjs';
import {
  BASELINE_DIR,
  CURRENT_DIR,
  cleanE2EOutputDirs,
  normalizeScreenNames,
  readLocalPluginVersion,
  writeRunManifest,
} from './helpers/run-io.mjs';

async function main() {
  let env;
  try {
    env = loadE2EEnv();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  // Bayat current/diff temizlenir; __baseline__ silinmez (üzerine yazılır).
  cleanE2EOutputDirs();
  fs.mkdirSync(BASELINE_DIR, { recursive: true });

  const startedAt = new Date().toISOString();
  const started = Date.now();
  console.log('Capturing baseline → tests/e2e/__baseline__/');
  const { failures, screens = [], shots = [], stats = {} } = await captureAll({
    env,
    outDir: BASELINE_DIR,
    runFunctional: false,
    mode: 'full',
    workers: 3,
  });

  const capturedScreens = screens.length ? screens : normalizeScreenNames(shots);
  writeRunManifest({
    mode: 'full',
    startedAt,
    endedAt: new Date().toISOString(),
    durationSec: Number(((Date.now() - started) / 1000).toFixed(1)),
    pluginVersion: readLocalPluginVersion(),
    screens: capturedScreens,
    stats: {
      passed: Number(stats.passed) || 0,
      skipped: Number(stats.skipped) || 0,
      failed: failures.length,
    },
    changedScreens: [],
    newBaselineScreens: capturedScreens,
    note: 'e2e:baseline — ekranlar doğrudan __baseline__ altına yazıldı',
  });

  if (failures.length) {
    console.warn('Baseline finished with warnings:');
    for (const f of failures) console.warn(' -', f.check || f);
  }
  console.log(`Baseline saved (${capturedScreens.length} ekran).`);
  console.log(`Manifest: ${path.relative(ROOT, path.join(CURRENT_DIR, 'run.json'))}`);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
