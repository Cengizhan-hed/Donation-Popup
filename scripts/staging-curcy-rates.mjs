#!/usr/bin/env node
/**
 * staging30 Curcy kur aracı (yalnız Claude; CLAUDECODE=1 gerekir).
 *
 *   node scripts/staging-curcy-rates.mjs backup [--force]
 *   node scripts/staging-curcy-rates.mjs set --rates EUR=0.02,USD=0.022 [--restore-on-exit]
 *   node scripts/staging-curcy-rates.mjs restore
 *   node scripts/staging-curcy-rates.mjs status
 *   node scripts/staging-curcy-rates.mjs expected-total [--with-progress]
 *
 * `set --restore-on-exit`: kur girilir, ardından `--then "<komut>"` ile verilen YEREL komut koşar;
 * komut başarısız ya da kesilse bile (try/finally + SIGINT/SIGTERM) yedek geri yüklenir.
 * Ekrana kur/ayar DEĞERİ yazılmaz (yalnız anahtar sayısı + sha256 + para birimi kodları).
 */
import { spawnSync } from 'node:child_process';
import { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { assertStagingTarget, runProgressReport } from './lib/staging-tools.mjs';
import { parseRates, runCurcyOp, runExpectedTotal } from './lib/staging-curcy-rates.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main() {
  if (process.env.CLAUDECODE !== '1') fail('staging-curcy-rates: yalnız Claude çalıştırır (CLAUDECODE=1 gerekir).');
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const op = argv[0];
  const known = ['backup', 'set', 'restore', 'status', 'expected-total'];
  if (!known.includes(op)) fail(`Kullanım: node scripts/staging-curcy-rates.mjs ${known.join('|')}`);
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging-curcy-rates: ${loaded.reason}`);
  const env = { ...loaded.env };
  env.DEPLOY_WP_PATH = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const g = assertStagingTarget(env, loaded.target);
  if (!g.ok) fail(`staging-curcy-rates: ${g.reason}`);
  const remoteFn = (cmd) => remote(env, cmd);
  const restore = () => runCurcyOp(env, 'restore', { remoteFn });
  try {
    if (op === 'expected-total') {
      const progress = argv.includes('--with-progress') ? runProgressReport(env, { remoteFn }) : null;
      console.log(JSON.stringify(runExpectedTotal(env, { remoteFn, progress }), null, 2));
      return;
    }
    if (op === 'set') {
      const rates = parseRates(arg(argv, '--rates'));
      const onExit = argv.includes('--restore-on-exit');
      const then = arg(argv, '--then');
      if (onExit && !then) fail('--restore-on-exit için --then "<yerel komut>" gerekir.');
      console.log(JSON.stringify(runCurcyOp(env, 'set', { remoteFn, rates })));
      if (onExit) {
        let restored = false;
        const safeRestore = () => {
          if (restored) return;
          restored = true;
          console.log(JSON.stringify({ restore_on_exit: restore() }));
        };
        for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { safeRestore(); } finally { process.exit(130); } });
        let status = 1;
        try {
          status = spawnSync(then, { shell: true, stdio: 'inherit' }).status ?? 1;
        } finally {
          safeRestore();
        }
        process.exit(status);
      }
      return;
    }
    console.log(JSON.stringify(runCurcyOp(env, op, { remoteFn, force: argv.includes('--force') })));
  } catch (e) {
    fail(`staging-curcy-rates: ${e && e.message ? e.message : e}`);
  }
}

main();
