#!/usr/bin/env node
/**
 * Hızlı E2E: masaüstü Chromium — ürün + form (popup/panel) + liste/mağaza + işlevsel.
 * Baseline yoksa ekran bazında otomatik oluşturur. Hedef ≤ 180 sn.
 * desktop-popup-* = ortadaki modal (liste); desktop-panel-* = sağ panel (ürün sayfası).
 *
 *   npm run e2e:quick
 *   npm run e2e:quick -- --no-side-cart
 *     → guest URL’lere hdf_no_side_cart=1 (yan sepet snippet kapalı)
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadE2EEnv, ROOT } from './helpers/env.mjs';
import { captureAll } from './helpers/capture.mjs';
import { compareAndReport } from './helpers/report.mjs';
import {
  BASELINE_DIR,
  CURRENT_DIR,
  REPORT_DIR,
  cleanE2EOutputDirs,
  normalizeScreenNames,
  readLocalPluginVersion,
  writeRunManifest,
} from './helpers/run-io.mjs';

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

/**
 * @param {string[]} argv
 */
function parseFlags(argv) {
  return {
    openReport: argv.includes('--open-report'),
    noSideCart: argv.includes('--no-side-cart'),
  };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2).filter((a) => a !== '--'));
  let env;
  try {
    env = loadE2EEnv();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  cleanE2EOutputDirs();
  const startedAt = new Date().toISOString();
  const started = Date.now();
  console.log('E2E quick (desktop Chromium, 4 worker, form dahil) → build/e2e/current/');
  if (flags.noSideCart) {
    console.log('Seçenek: --no-side-cart (guest URL + hdf_no_side_cart=1)');
  }

  const {
    failures,
    skips = [],
    flaky = [],
    debugFiles = [],
    stats = {},
    screens = [],
    shots = [],
    noSideCart = false,
  } = await captureAll({
    env,
    outDir: CURRENT_DIR,
    runFunctional: true,
    mode: 'quick',
    workers: 4,
    runLabel: 'quick',
    noSideCart: flags.noSideCart,
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
  } = compareAndReport(BASELINE_DIR, CURRENT_DIR, REPORT_DIR, failures, env.E2E_DIFF_THRESHOLD, {
    skips,
    flaky,
    stats,
    capturedScreens,
    mode: 'quick',
    shellDiffThreshold: env.E2E_SHELL_DIFF_THRESHOLD,
  });

  const endedAt = new Date().toISOString();
  writeRunManifest({
    mode: 'quick',
    startedAt,
    endedAt,
    durationSec: Number(((Date.now() - started) / 1000).toFixed(1)),
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
  });

  console.log('Report:', reportFile);
  console.log(
    `İşlevsel özet: Geçti=${passedCount} Atlandı=${skippedCount} Hata=${failedCount}` +
      ` | noSideCart=${noSideCart ? 'evet' : 'hayır'}`
  );
  if (flaky.length) {
    console.warn(
      `Kararsız (yeniden denemede geçti): ${flaky.map((f) => f.check).join(', ')}`
    );
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
  console.log(`Süre: ${((Date.now() - started) / 1000).toFixed(1)}s`);
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
