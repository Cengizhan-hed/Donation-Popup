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
import { TRASH_REPORT_EVAL_FILE } from './lib/ikram-wp-guard.mjs';
import { RETIRED_HEDEF_STAGING_NOTE, validateRemoteSiteUrl } from './lib/deploy-guards.mjs';
import { assertRemoteAllowed } from './lib/remote-guard.mjs';

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
  const wpPath = resolveWpPath(env).replace(/'/g, `'\\''`);
  const b64 = fs.readFileSync(local).toString('base64');
  const out = remote(
    env,
    [
      `TMP=$(mktemp /tmp/wdp-read-XXXX.php)`,
      `echo '${b64}' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" --path='${wpPath}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n')
  );
  console.log(out);
}

function main() {
  try {
    assertRemoteAllowed();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
  setActiveDeployEnvFile('.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging:wp: ${loaded.reason}`);
  const env = loaded.env;
  fail(RETIRED_HEDEF_STAGING_NOTE);
  const wpPath = resolveWpPath(env);
  const siteCheck = remote(env, `wp option get siteurl --path='${wpPath.replace(/'/g, `'\\''`)}'`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (argv[0] !== 'trash-report') {
    fail('Kullanım: npm run staging:wp -- trash-report (yalnız salt okunur).');
  }
  runEvalFileReadOnly(env, TRASH_REPORT_EVAL_FILE);
}

main();
