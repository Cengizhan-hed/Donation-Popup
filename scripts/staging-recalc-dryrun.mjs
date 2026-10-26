#!/usr/bin/env node
/**
 * staging30 toplam yeniden hesap KURU ÇALIŞTIRMA (yalnız Claude; CLAUDECODE=1; HİÇBİR yazma yok).
 *
 *   CLAUDECODE=1 npm run staging:recalc-dryrun [-- --md] [--detail 123,456]
 *   npm run staging:recalc-dryrun -- --local [--md]   (yerel WP; WDP_LOCAL_WP_DIR ya da build/local-wp)
 *
 * Çıktı: ürün başına eski toplam -> hesaplanan toplam + uyarılar (JSON ya da --md). Kişisel veri yok.
 */
import { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { assertStagingTarget } from './lib/staging-tools.mjs';
import { RECALC_EVAL_FILE, parseDetailArg, runRecalcDryRun, toMarkdown } from './lib/staging-recalc-dryrun.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function runLocal(md, detail) {
  const { runLocalEvalFile, parseLocalEvalJson } = await import('../tests/e2e/helpers/local-wp-eval.mjs');
  const res = parseLocalEvalJson(runLocalEvalFile(RECALC_EVAL_FILE, [], { env: { WDP_RECALC_DIGEST: '1' } }));
  if (!res.ok) fail(`staging-recalc-dryrun (yerel): ${res.error}`);
  console.log(md ? toMarkdown(res, { detail }) : JSON.stringify(res, null, 2));
  if (res.digest_same !== true) fail('Yerel veritabanı özeti değişti (yazma var!).');
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const md = argv.includes('--md');
  const detail = parseDetailArg(argv);
  if (argv.includes('--local')) return runLocal(md, detail);
  if (process.env.CLAUDECODE !== '1') fail('staging-recalc-dryrun: yalnız Claude çalıştırır (CLAUDECODE=1 gerekir).');
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging-recalc-dryrun: ${loaded.reason}`);
  const env = { ...loaded.env };
  env.DEPLOY_WP_PATH = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const g = assertStagingTarget(env, loaded.target);
  if (!g.ok) fail(`staging-recalc-dryrun: ${g.reason}`);
  try {
    const res = runRecalcDryRun(env, { remoteFn: (cmd) => remote(env, cmd) });
    console.log(md ? toMarkdown(res, { detail }) : JSON.stringify(res, null, 2));
  } catch (e) {
    fail(`staging-recalc-dryrun: ${e && e.message ? e.message : e}`);
  }
}

main();
