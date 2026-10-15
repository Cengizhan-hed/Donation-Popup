#!/usr/bin/env node
/**
 * Yalnızca staging’e kurulum / geri alma.
 * .env.deploy okunur; gizli değerler yazdırılmaz. Canlıya kurulum yok.
 *
 * Kullanım:
 *   node scripts/deploy-staging.mjs
 *   node scripts/deploy-staging.mjs --rollback
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import {
  parsePluginVersion,
  validateDeployEnv,
  validateRemoteSiteUrl,
} from './lib/deploy-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROLLBACK = process.argv.includes('--rollback');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadDeployEnv() {
  const envPath = path.join(ROOT, '.env.deploy');
  if (!fs.existsSync(envPath)) {
    fail('Eksik .env.deploy (şablon: .env.deploy.example).');
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  return {
    DEPLOY_SSH_HOST: String(parsed.DEPLOY_SSH_HOST || '').trim(),
    DEPLOY_SSH_USER: String(parsed.DEPLOY_SSH_USER || '').trim(),
    DEPLOY_SSH_PORT: String(parsed.DEPLOY_SSH_PORT || '').trim(),
    DEPLOY_SSH_KEY: String(parsed.DEPLOY_SSH_KEY || '').trim(),
    DEPLOY_WP_PATH: String(parsed.DEPLOY_WP_PATH || '').trim(),
    DEPLOY_SITE_URL: String(parsed.DEPLOY_SITE_URL || '')
      .trim()
      .replace(/\/$/, ''),
  };
}

function sshBase(env) {
  return [
    'ssh',
    '-i',
    env.DEPLOY_SSH_KEY,
    '-p',
    env.DEPLOY_SSH_PORT,
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    `${env.DEPLOY_SSH_USER}@${env.DEPLOY_SSH_HOST}`,
  ];
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: ROOT,
    ...opts,
  });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 500);
    fail(`${cmd} başarısız${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

function remote(env, remoteCmd) {
  const base = sshBase(env);
  return run(base[0], [...base.slice(1), remoteCmd]);
}

function main() {
  const env = loadDeployEnv();
  const guard = validateDeployEnv(env);
  if (!guard.ok) fail(guard.reason);

  const pluginFile = path.join(ROOT, 'woo-donation-popup.php');
  const localVersion = parsePluginVersion(fs.readFileSync(pluginFile, 'utf8'));
  if (!localVersion) {
    fail('Yerel sürüm okunamadı (woo-donation-popup.php Version).');
  }

  // Kilit c: uzak siteurl
  const siteCheck = remote(
    env,
    `wp option get siteurl --path='${env.DEPLOY_WP_PATH.replace(/'/g, `'\\''`)}'`
  );
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const wpPath = env.DEPLOY_WP_PATH.replace(/'/g, `'\\''`);
  const backupRoot = '/home/customer/wdp-backups';
  const deployRoot = '/home/customer/wdp-deploy';
  const pluginSlug = 'woo-donation-popup';

  if (ROLLBACK) {
    console.log('Staging geri alma…');
    const latest = remote(
      env,
      `ls -1t '${backupRoot}'/${pluginSlug}-*.zip 2>/dev/null | head -n 1`
    );
    if (!latest) fail('Geri alınacak yedek bulunamadı (/home/customer/wdp-backups).');
    remote(
      env,
      `wp plugin install '${latest.replace(/'/g, `'\\''`)}' --force --activate --path='${wpPath}'`
    );
    remote(
      env,
      `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' --path='${wpPath}'`
    );
    remote(env, `(wp sg purge --path='${wpPath}' 2>/dev/null || wp cache flush --path='${wpPath}')`);
    const installed = remote(
      env,
      `wp plugin get ${pluginSlug} --field=version --path='${wpPath}'`
    );
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

  remote(env, `mkdir -p '${backupRoot}' '${deployRoot}'`);

  // Mevcut eklenti klasörünü yedekle (son 3 tutulur)
  remote(
    env,
    [
      `PLUGIN_DIR=$(wp plugin path ${pluginSlug} --path='${wpPath}' 2>/dev/null || true)`,
      `if [ -n "$PLUGIN_DIR" ] && [ -d "$PLUGIN_DIR" ]; then`,
      `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr '${backupZip}' "$(basename "$PLUGIN_DIR")")`,
      `  ls -1t '${backupRoot}'/${pluginSlug}-*.zip 2>/dev/null | tail -n +4 | while read -r f; do rm -f "$f"; done`,
      `fi`,
    ].join('\n')
  );

  const scp = [
    'scp',
    '-i',
    env.DEPLOY_SSH_KEY,
    '-P',
    env.DEPLOY_SSH_PORT,
    '-o',
    'BatchMode=yes',
    zipLocal,
    `${env.DEPLOY_SSH_USER}@${env.DEPLOY_SSH_HOST}:${remoteZip}`,
  ];
  run(scp[0], scp.slice(1), { stdio: 'inherit' });

  remote(
    env,
    `wp plugin install '${remoteZip.replace(/'/g, `'\\''`)}' --force --activate --path='${wpPath}'`
  );
  remote(
    env,
    `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' --path='${wpPath}'`
  );

  const installed = remote(
    env,
    `wp plugin get ${pluginSlug} --field=version --path='${wpPath}'`
  );
  if (installed !== localVersion) {
    fail(`Kurulu sürüm yerel ile eşleşmiyor (yerel ${localVersion}).`);
  }

  remote(env, `(wp sg purge --path='${wpPath}' 2>/dev/null || wp cache flush --path='${wpPath}')`);
  remote(env, `rm -f '${remoteZip.replace(/'/g, `'\\''`)}'`);

  console.log(`Staging'e kuruldu: ${localVersion}`);
}

main();
