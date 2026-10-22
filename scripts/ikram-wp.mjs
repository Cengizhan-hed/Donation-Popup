#!/usr/bin/env node
/**
 * Ikram Aid WP-CLI köprüsü. Yalnız SSH alias ikramaid.
 * Doğrudan `ssh` yazılmaz; bu script spawn eder.
 *
 *   npm run ikram:wp -- plugin list
 *   npm run ikram:wp -- plugin-health
 *   npm run ikram:wp -- php-ok
 *   npm run ikram:wp -- debug-log
 *   npm run ikram:wp -- eval-file tests/e2e/helpers/cleanup-e2e.php
 *
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IKRAM_ALLOW_REMOVAL_NOTE,
  findTargetByAlias,
  validateRemoteSiteUrl,
  wpPathFlag,
  shellQuoteWpPath,
  buildGuardedEvalFileCommand,
} from './lib/deploy-guards.mjs';
import { assertRemoteAllowed, spawnGuarded } from './lib/remote-guard.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { loadDeployEnvSilent, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import {
  allowIkramWpCommand,
  normalizeWpTail,
  normalizeRemotePluginDir,
  IKRAM_WP_SLUG,
  IKRAM_WP_ALIAS,
  CLEANUP_EVAL_FILE,
  TEMP_PRODUCT_EVAL_FILE,
  TRASH_REPORT_EVAL_FILE,
} from './lib/ikram-wp-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_WP = findTargetByAlias('ikramaid')?.wpPath || '~/www/ikramaid.uk/public_html';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadEnv() {
  const profile = loadProfile('ikram');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy.ikram');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(loaded.reason);
  const env = loaded.env;
  if (env.DEPLOY_SSH_ALIAS !== IKRAM_WP_ALIAS) {
    fail('eşleşmiyor');
  }
  if (loaded.target?.id !== 'ikram-aid') fail('ikram:wp yalnız ikramaid.uk hedefine gider.');
  return env;
}

function sshArgs(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (!alias) fail('SSH alias yok (profil tek kaynak).');
  return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', alias];
}

function remote(env, remoteCmd) {
  const res = spawnGuarded(
    'ssh',
    [...sshArgs(env), remoteCmd],
    { encoding: 'utf8', cwd: ROOT, timeout: 60000 },
    {
      alias: env?.DEPLOY_SSH_ALIAS,
      siteUrl: env?.DEPLOY_SITE_URL,
      wpPath: env?.DEPLOY_WP_PATH,
    }
  );
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 500);
    fail(`ssh/wp başarısız${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

function logicalWpPath(env) {
  return String(env.DEPLOY_WP_PATH || DEFAULT_WP).trim();
}

function runWp(env, tail) {
  const cmd = normalizeWpTail(tail);
  return remote(env, `wp ${cmd} ${wpPathFlag(logicalWpPath(env))}`);
}

function builtinPluginHealth(env) {
  const wpPath = logicalWpPath(env);
  const rawPath = remote(
    env,
    `wp plugin path ${IKRAM_WP_SLUG} --dir ${wpPathFlag(wpPath)} 2>/dev/null || echo ${shellQuoteWpPath(`${wpPath}/wp-content/plugins/${IKRAM_WP_SLUG}`)}`
  );
  const dir = normalizeRemotePluginDir(rawPath, IKRAM_WP_SLUG);
  const listing = remote(
    env,
    [
      `DIR='${dir.replace(/'/g, `'\\''`)}'`,
      `echo "plugin_dir=$DIR"`,
      `if [ -d "$DIR" ]; then echo "is_dir=1"; else echo "is_dir=0"; fi`,
      `if [ -f "$DIR/${IKRAM_WP_SLUG}.php" ]; then echo "has_main=1"; else echo "has_main=0"; fi`,
      `if [ -f "$DIR" ]; then echo "path_is_file=1"; else echo "path_is_file=0"; fi`,
      `echo -n "file_count="`,
      `if [ -d "$DIR" ]; then find "$DIR" -type f | wc -l | tr -d ' '; else echo 0; fi`,
    ].join('\n')
  );
  let pluginJson = '';
  try {
    pluginJson = runWp(env, `plugin get ${IKRAM_WP_SLUG} --format=json`);
  } catch {
    pluginJson = '{"error":"plugin get failed"}';
  }
  const listLine = runWp(env, `plugin list --name=${IKRAM_WP_SLUG} --format=table`);
  console.log(listLine);
  console.log(listing);
  console.log(`plugin_json=${pluginJson}`);
}

function builtinPhpOk(env) {
  const out = runWp(env, `eval 'echo 1;'`);
  console.log(out);
  if (String(out).trim() !== '1') fail(`php-ok beklenen 1, alınan: ${out.slice(0, 80)}`);
}

function builtinAuthProbe(env) {
  const php =
    '$ids=get_users(array("role"=>"administrator","number"=>3,"fields"=>"ID")); echo "admins=",count((array)$ids); if($ids){ $c=wp_generate_auth_cookie((int)$ids[0], time()+3600, "logged_in"); echo " cookie_len=",strlen((string)$c); } echo " ssl=", is_ssl()?"1":"0"; echo " cookie_domain=", defined("COOKIE_DOMAIN")?COOKIE_DOMAIN:"(undef)"; echo " logged_in_name=", LOGGED_IN_COOKIE;';
  const out = runWp(env, `eval '${php}'`);
  console.log(out);
}

function builtinGateways(env) {
  const php =
    'if(!function_exists("WC")){echo "no-wc"; return;} WC()->payment_gateways(); foreach(WC()->payment_gateways()->payment_gateways() as $id=>$gw){ echo $id,"=",($gw->enabled==="yes"?"yes":"no"),"\\n"; }';
  const out = runWp(env, `eval '${php}'`);
  console.log(out);
}

function builtinDebugLog(env) {
  const wpPath = logicalWpPath(env);
  const out = remote(
    env,
    `LOG=${shellQuoteWpPath(`${wpPath}/wp-content/debug.log`)}; if [ -f "$LOG" ]; then tail -n 80 "$LOG"; else echo "debug.log yok"; fi`
  );
  console.log(out);
}

function runEvalFileCleanup(env, relFile) {
  const rel = relFile || CLEANUP_EVAL_FILE;
  const local = path.join(ROOT, rel);
  if (!fs.existsSync(local)) fail(`Yerel dosya yok: ${rel}`);
  const b64 = fs.readFileSync(local).toString('base64');
  const extra = rel === TEMP_PRODUCT_EVAL_FILE ? 'cleanup' : '';
  const out = remote(
    env,
    buildGuardedEvalFileCommand(logicalWpPath(env), {
      tmpPrefix: 'wdp-cleanup',
      extraArgs: extra,
      b64,
    })
  );
  console.log(out);
}

function main() {
  console.log(IKRAM_ALLOW_REMOVAL_NOTE);
  try {
    assertRemoteAllowed();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
  const env = loadEnv();
  const wpPath = logicalWpPath(env);
  const siteCheck = remote(env, `wp option get siteurl ${wpPathFlag(wpPath)}`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (!argv.length) {
    fail('Kullanım: npm run ikram:wp -- plugin list | plugin-health | php-ok | debug-log | trash-report | eval-file <dosya>');
  }

  const builtin = argv[0];
  if (builtin === 'trash-report') {
    runEvalFileCleanup(env, TRASH_REPORT_EVAL_FILE);
    return;
  }
  if (builtin === 'plugin-health') {
    builtinPluginHealth(env);
    return;
  }
  if (builtin === 'php-ok') {
    builtinPhpOk(env);
    return;
  }
  if (builtin === 'debug-log') {
    builtinDebugLog(env);
    return;
  }
  if (builtin === 'gateways') {
    builtinGateways(env);
    return;
  }
  if (builtin === 'auth-probe') {
    builtinAuthProbe(env);
    return;
  }

  const tail = argv.join(' ');
  const allowed = allowIkramWpCommand(tail);
  if (!allowed.ok) fail(allowed.reason);

  if (allowed.kind === 'eval-file') {
    runEvalFileCleanup(env, allowed.file);
    return;
  }

  const out = runWp(env, tail);
  console.log(out);
}

main();
