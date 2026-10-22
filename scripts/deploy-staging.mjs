#!/usr/bin/env node
/**
 * Yalnızca staging’e kurulum / geri alma.
 * Hedef = profil + izin listesi. .env.deploy hedef anahtarları kullanılmaz.
 *
 * Kullanım:
 *   node scripts/deploy-staging.mjs
 *   node scripts/deploy-staging.mjs --rollback
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findTargetByAlias,
  parsePluginVersion,
  validateRemoteSiteUrl,
  wpPathFlag,
  shellQuoteWpPath,
} from './lib/deploy-guards.mjs';
import { assertRemoteAllowed, spawnGuarded } from './lib/remote-guard.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { loadDeployEnvSilent, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROLLBACK = process.argv.includes('--rollback');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadDeployEnv() {
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(loaded.reason);
  return loaded.env;
}

function sshBase(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (!alias) fail('SSH alias yok (profil tek kaynak).');
  return ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', alias];
}

function run(cmd, args, opts = {}, guardOpts = {}) {
  const res = spawnGuarded(cmd, args, {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  }, guardOpts);
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 500);
    fail(`${cmd} başarısız${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

function remote(env, remoteCmd) {
  const base = sshBase(env);
  return run(base[0], [...base.slice(1), remoteCmd], {}, {
    alias: env?.DEPLOY_SSH_ALIAS,
    siteUrl: env?.DEPLOY_SITE_URL,
    wpPath: env?.DEPLOY_WP_PATH,
  });
}

function main() {
  try {
    assertRemoteAllowed();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
  const env = loadDeployEnv();

  const pluginFile = path.join(ROOT, 'woo-donation-popup.php');
  const localVersion = parsePluginVersion(fs.readFileSync(pluginFile, 'utf8'));
  if (!localVersion) {
    fail('Yerel sürüm okunamadı (woo-donation-popup.php Version).');
  }

  // Kilit c: uzak siteurl
  const flag = wpPathFlag(env.DEPLOY_WP_PATH);
  const siteCheck = remote(env, `wp option get siteurl ${flag}`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);
  const listed = findTargetByAlias(env.DEPLOY_SSH_ALIAS);
  const siteRoot = String(listed?.allowedRoot || '').replace(/\/$/, '');
  const backupRoot = `${siteRoot}/wdp-backups`;
  const deployRoot = `${siteRoot}/wdp-deploy`;
  const pluginSlug = 'woo-donation-popup';

  if (ROLLBACK) {
    console.log('Staging geri alma…');
    const latestName = remote(
      env,
      `ls -1t ${shellQuoteWpPath(backupRoot)} 2>/dev/null | head -n 1`
    );
    const latest = latestName ? `${backupRoot}/${latestName}` : '';
    if (!latest) fail('Geri alınacak yedek bulunamadı.');
    remote(
      env,
      `wp plugin install ${shellQuoteWpPath(latest)} --force --activate ${flag}`
    );
    remote(
      env,
      `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' ${flag}`
    );
    remote(env, `(wp sg purge ${flag} 2>/dev/null || wp cache flush ${flag})`);
    const installed = remote(env, `wp plugin get ${pluginSlug} --field=version ${flag}`);
    console.log(`Staging geri alındı: ${installed || '(sürüm okunamadı)'}`);
    return;
  }

  console.log('Doğrulama ve paket…');
  run('npm', ['run', 'verify'], { stdio: 'inherit' });
  run('npm', ['run', 'test'], { stdio: 'inherit' });
  run('npm', ['run', 'pack'], { stdio: 'inherit' });

  const zipLocal = path.join(ROOT, 'build', 'woo-donation-popup.zip');
  if (!fs.existsSync(zipLocal)) fail('build/woo-donation-popup.zip oluşmadı.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const remoteZip = `${deployRoot}/${pluginSlug}-${localVersion}-${stamp}.zip`;
  const backupZip = `${backupRoot}/${pluginSlug}-pre-${localVersion}-${stamp}.zip`;

  remote(env, `mkdir -p ${shellQuoteWpPath(backupRoot)} ${shellQuoteWpPath(deployRoot)}`);

  // Mevcut eklenti klasörünü yedekle (son 3 tutulur)
  remote(
    env,
    [
      `PLUGIN_DIR=$(wp plugin path ${pluginSlug} ${flag} 2>/dev/null || true)`,
      `if [ -n "$PLUGIN_DIR" ] && [ -d "$PLUGIN_DIR" ]; then`,
      `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr ${shellQuoteWpPath(backupZip)} "$(basename "$PLUGIN_DIR")")`,
      `  ls -1t ${shellQuoteWpPath(backupRoot)} 2>/dev/null | tail -n +4 | while read -r f; do rm -f ${shellQuoteWpPath(backupRoot)}/"$f"; done`,
      `fi`,
    ].join('\n')
  );

  const scp = [
    'scp',
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    zipLocal,
    `${env.DEPLOY_SSH_ALIAS}:${remoteZip}`,
  ];
  run(scp[0], scp.slice(1), { stdio: 'inherit' }, {
    alias: env.DEPLOY_SSH_ALIAS,
    siteUrl: env.DEPLOY_SITE_URL,
    wpPath: env.DEPLOY_WP_PATH,
  });

  remote(
    env,
    `wp plugin install ${shellQuoteWpPath(remoteZip)} --force --activate ${flag}`
  );
  remote(
    env,
    `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' ${flag}`
  );

  const installed = remote(env, `wp plugin get ${pluginSlug} --field=version ${flag}`);
  if (installed !== localVersion) {
    fail(`Kurulu sürüm yerel ile eşleşmiyor (yerel ${localVersion}).`);
  }

  remote(env, `(wp sg purge ${flag} 2>/dev/null || wp cache flush ${flag})`);
  remote(env, `rm -f ${shellQuoteWpPath(remoteZip)}`);

  console.log(`Staging'e kuruldu: ${localVersion}`);
}

main();
