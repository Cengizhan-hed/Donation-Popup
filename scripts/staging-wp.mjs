#!/usr/bin/env node
/**
 * Hedef staging salt okunur WP-CLI. Yalnız trash-report.
 * Yazma / silme / çöp / untrash / option update yok.
 *
 *   npm run staging:wp -- trash-report
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import {
  TRASH_REPORT_EVAL_FILE,
  CRON_STATUS_EVAL_FILE,
  isReadOnlyCronStatusSource,
} from './lib/ikram-wp-guard.mjs';
import { validateRemoteSiteUrl, buildGuardedEvalFileCommand, wpPathFlag } from './lib/deploy-guards.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function runEvalFileReadOnly(env, relFile) {
  const local = path.join(ROOT, relFile);
  if (!fs.existsSync(local)) fail(`Yerel dosya yok: ${relFile}`);
  const src = fs.readFileSync(local, 'utf8');
  if (/\b(wp_delete_|wp_trash_|wp_untrash_|wp_update_post|wp_insert_post|update_option|delete_option|update_post_meta)\b/i.test(src)) {
    fail(`Salt okunur rapor dosyası yazma çağrısı içeriyor: ${relFile}`);
  }
  const wpPath = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const b64 = fs.readFileSync(local).toString('base64');
  const out = remote(env, buildGuardedEvalFileCommand(wpPath, { tmpPrefix: 'wdp-read', b64 }));
  console.log(out);
}

function runCronStatus(env) {
  const local = path.join(ROOT, CRON_STATUS_EVAL_FILE);
  if (!fs.existsSync(local)) fail(`Yerel dosya yok: ${CRON_STATUS_EVAL_FILE}`);
  if (!isReadOnlyCronStatusSource(fs.readFileSync(local, 'utf8'))) {
    fail('cron-status.php yazma/ağ çağrısı içeriyor; reddedildi.');
  }
  runEvalFileReadOnly(env, CRON_STATUS_EVAL_FILE);
  console.log("not=sunucu cron'u bu araçla okunmaz; hosting panelinden bakın");
}

function main() {
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging:wp: ${loaded.reason}`);
  const env = loaded.env;
  const wpPath = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const siteCheck = remote(env, `wp option get siteurl ${wpPathFlag(wpPath)}`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (argv[0] === 'cron-status') {
    runCronStatus(env);
    return;
  }
  if (argv[0] !== 'trash-report') {
    fail('Kullanım: npm run staging:wp -- trash-report | cron-status (yalnız salt okunur).');
  }
  runEvalFileReadOnly(env, TRASH_REPORT_EVAL_FILE);
}

main();
