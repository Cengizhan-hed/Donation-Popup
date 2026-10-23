#!/usr/bin/env node
/**
 * Determinizm: e2e:quick kapsamını 2 kez çalıştırıp run1 ↔ run2 karşılaştırır.
 * Baseline / run.json / accept akışına dokunmaz. Çıktı: build/e2e/stability/
 *
 *   npm run e2e:stability
 *   npm run e2e:stability -- --max-runs 4
 *     → hata yakalanana kadar en fazla N tam çift koşu (her biri run1+run2);
 *       ilk alt bağış (sadaka-*) hatasında durur ve teşhis yollarını yazar.
 *   npm run e2e:stability -- --no-side-cart
 *     → guest URL’lere hdf_no_side_cart=1 (yan sepet snippet kapalı)
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadE2EEnv, parseE2ECli, ROOT } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { captureAll } from './helpers/capture.mjs';
import { compareAndReport } from './helpers/report.mjs';
import { resolveQuickAreas } from './helpers/area-filter.mjs';
import { cleanE2EOutputDirs, normalizeScreenNames } from './helpers/run-io.mjs';

const STAB_DIR = path.join(ROOT, 'build/e2e/stability');

function rmTree(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * @param {string[]} argv
 */
function parseFlags(argv) {
  let maxRuns = 1;
  let noSideCart = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-runs') {
      maxRuns = Math.max(1, Math.min(20, Number.parseInt(String(argv[++i] || '1'), 10) || 1));
    } else if (a.startsWith('--max-runs=')) {
      maxRuns = Math.max(1, Math.min(20, Number.parseInt(a.slice('--max-runs='.length), 10) || 1));
    } else if (a === '--no-side-cart') {
      noSideCart = true;
    }
  }
  return { maxRuns, noSideCart };
}

/**
 * @param {Array<{check?:string}>} failures
 */
function sadakaFailures(failures) {
  return (failures || []).filter((f) => /^sadaka-/i.test(String(f.check || '')));
}

async function main() {
  const { maxRuns, noSideCart } = parseFlags(process.argv.slice(2).filter((a) => a !== '--'));
  const cli = parseE2ECli(process.argv.slice(2));
  const deviceId = cli.device || 'iphone';
  let env;
  try {
    env = loadE2EEnv({ envId: cli.envId });
    env = await fillMissingProductSlugs(env);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  const threshold = Number.isFinite(Number(env.E2E_DIFF_THRESHOLD))
    ? Number(env.E2E_DIFF_THRESHOLD)
    : 0.5;

  let lastFailed = false;
  /** @type {object|null} */
  let stopReason = null;

  const areaInfo = cli.all
    ? { areas: null, files: [], unmatched: [], reason: '--all' }
    : resolveQuickAreas(cli.areas);
  console.log(
    `E2E stability (${deviceId}, env=${env.E2E_PROFILE_ID || env._profile?.id}, alan=${areaInfo.areas ? areaInfo.areas.join(',') : 'hepsi'} — ${areaInfo.reason})`
  );

  if (noSideCart) {
    console.log('Seçenek: --no-side-cart (guest URL + hdf_no_side_cart=1)');
  }

  for (let round = 1; round <= maxRuns; round++) {
    rmTree(STAB_DIR);
    fs.mkdirSync(STAB_DIR, { recursive: true });

    /** @type {Array<{label:string, screens:string[], failures:import('./helpers/checks.mjs').makeFailure extends Function ? any[] : never, failureChecks:string[], flaky:Array<{check:string}>, debugFiles:string[], secs:number, noSideCart:boolean}>} */
    const runs = [];

    console.log(`\n######## Stability tur ${round}/${maxRuns} ########`);

    for (const label of ['run1', 'run2']) {
      cleanE2EOutputDirs(env.E2E_PROFILE_ID);
      const outDir = path.join(STAB_DIR, label);
      fs.mkdirSync(outDir, { recursive: true });
      console.log(`\n=== Stability ${label} (tur ${round}) ===`);
      const started = Date.now();
      const {
        failures = [],
        flaky = [],
        screens = [],
        shots = [],
        debugFiles = [],
        noSideCart: runNoSideCart = false,
      } = await captureAll({
        env,
        outDir,
        runFunctional: true,
        mode: 'quick',
        workers: deviceId === 'iphone' ? 2 : 3,
        runLabel: `stab${round}-${label}`,
        noSideCart,
        device: deviceId,
        areas: areaInfo.areas,
      });
      const secs = (Date.now() - started) / 1000;
      const screenList = screens.length ? screens : normalizeScreenNames(shots);
      const failureChecks = failures.map((f) => String(f.check || '?'));
      runs.push({
        label,
        screens: screenList,
        failures,
        failureChecks,
        flaky,
        debugFiles,
        secs,
        noSideCart: !!runNoSideCart,
      });
      console.log(
        `${label}: ${screenList.length} ekran, işlevsel hata=${failures.length}, kararsız=${flaky.length}, süre=${secs.toFixed(1)}s` +
          ` | noSideCart=${runNoSideCart ? 'evet' : 'hayır'}`
      );
      if (flaky.length) {
        console.warn(
          `  Kararsız (yeniden denemede geçti): ${flaky.map((f) => f.check).join(', ')}`
        );
      }
      if (debugFiles.length) {
        console.warn(`  Teşhis dosyaları (${debugFiles.length}):`);
        for (const f of debugFiles.slice(0, 12)) {
          console.warn(`    • ${f}`);
        }
      }

      const sadakaFails = sadakaFailures(failures);
      if (sadakaFails.length) {
        stopReason = {
          round,
          label,
          checks: sadakaFails.map((f) => f.check),
          debugFiles: [
            ...debugFiles,
            ...sadakaFails.map((f) => f.debugFile).filter(Boolean),
          ],
        };
        console.error('');
        console.error(
          `Stability DURDU — alt bağış hatası yakalandı (tur ${round}, ${label})`
        );
        for (const f of sadakaFails) {
          console.error(`  • [${f.check}] ${f.description || ''}`);
          if (f.debugFile) console.error(`    debug: ${f.debugFile}`);
        }
        for (const p of [...new Set(stopReason.debugFiles)].slice(0, 20)) {
          console.error(`  dosya: ${p}`);
        }
        process.exit(1);
      }
    }

    const reportDir = path.join(STAB_DIR, 'report');
    const run1Dir = path.join(STAB_DIR, 'run1');
    const run2Dir = path.join(STAB_DIR, 'run2');
    const captured = runs[1].screens.length
      ? runs[1].screens
      : normalizeScreenNames(
          fs.existsSync(run2Dir)
            ? fs
                .readdirSync(run2Dir)
                .filter((f) => f.endsWith('.png'))
                .map((f) => path.join(run2Dir, f))
            : []
        );

    const shellThreshold = Number.isFinite(Number(env.E2E_SHELL_DIFF_THRESHOLD))
      ? Number(env.E2E_SHELL_DIFF_THRESHOLD)
      : 0.1;

    const {
      reportFile,
      changedCount,
      changedScreens = [],
      shellThreshold: reportShellThreshold = shellThreshold,
    } = compareAndReport(run1Dir, run2Dir, reportDir, [], threshold, {
      capturedScreens: captured,
      mode: 'stability',
      autoCreateBaseline: false,
      stats: { passed: 0, skipped: 0, failed: 0 },
      shellDiffThreshold: shellThreshold,
    });

    const summary = {
      mode: 'stability',
      round,
      maxRuns,
      noSideCart: !!noSideCart,
      threshold,
      shellThreshold: reportShellThreshold,
      report: path.relative(ROOT, reportFile),
      runs: runs.map((r) => ({
        label: r.label,
        secs: Number(r.secs.toFixed(1)),
        failureChecks: r.failureChecks,
        flaky: r.flaky.map((f) => f.check),
        debugFiles: r.debugFiles,
        noSideCart: !!r.noSideCart,
      })),
      changedScreens,
    };
    fs.writeFileSync(
      path.join(STAB_DIR, 'run.json'),
      JSON.stringify(summary, null, 2) + '\n',
      'utf8'
    );

    console.log('');
    console.log(`=== Stability özet (tur ${round}) ===`);
    console.log(`run1: ${runs[0].secs.toFixed(1)}s | run2: ${runs[1].secs.toFixed(1)}s`);
    console.log(`noSideCart: ${noSideCart ? 'evet' : 'hayır'}`);
    console.log(
      `Eşik: sayfa ≤ ${threshold}% · kabuk (popup/panel) ≤ ${reportShellThreshold}%`
    );
    console.log(`Rapor: ${path.relative(ROOT, reportFile)}`);
    console.log(`Manifest: ${path.relative(ROOT, path.join(STAB_DIR, 'run.json'))}`);
    for (const r of runs) {
      if (r.flaky.length) {
        console.warn(`${r.label} kararsız: ${r.flaky.map((f) => f.check).join(', ')}`);
      }
    }

    let failed = false;

    const funcFailRuns = runs.filter((r) => r.failures.length > 0);
    if (funcFailRuns.length) {
      failed = true;
      console.error('');
      console.error('Stability BAŞARISIZ — işlevsel hata');
      for (const r of funcFailRuns) {
        console.error(`${r.label}: ${r.failures.length} hata`);
        for (const name of r.failureChecks.slice(0, 10)) {
          console.error(`  • ${name}`);
        }
        for (const f of r.debugFiles.slice(0, 10)) {
          console.error(`  teşhis: ${f}`);
        }
      }
    }

    if (changedScreens.length) {
      failed = true;
      console.error('');
      console.error(`Kararsız ekran (${changedScreens.length}):`);
      for (const name of changedScreens) {
        console.error(`  • ${name}`);
      }
    } else if (changedCount > 0) {
      failed = true;
      console.error(`Kararsız ekran sayısı: ${changedCount}`);
    }

    if (failed) {
      lastFailed = true;
      if (round < maxRuns) {
        console.warn(`Tur ${round} başarısız — --max-runs ile devam (${round + 1}/${maxRuns})…`);
        continue;
      }
      process.exit(1);
    }

    console.log(
      'Stability geçti — iki koşu görsel olarak aynı (eşik içinde), işlevsel hata yok.'
    );
    process.exit(0);
  }

  if (lastFailed) process.exit(1);
  void stopReason;
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
