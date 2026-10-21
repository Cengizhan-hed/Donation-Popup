#!/usr/bin/env node
/**
 * Ikram Aid kurulum / geri alma.
 * Zip yerine rsync; SSH alias "ikramaid".
 * .env.deploy.ikram değerleri yazdırılmaz.
 *
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 *
 *   node scripts/deploy-ikram.mjs
 *   node scripts/deploy-ikram.mjs --dry-run
 *   node scripts/deploy-ikram.mjs --rollback
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import {
  IKRAM_ALLOW_REMOVAL_NOTE,
  parsePluginVersion,
  validateDeployEnv,
  validateRemoteSiteUrl,
} from './lib/deploy-guards.mjs';
import { rsyncExcludeArgs } from './lib/pack-excludes.mjs';
import { normalizeRemotePluginDir, IKRAM_WP_SLUG } from './lib/ikram-wp-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROLLBACK = process.argv.includes('--rollback');
const DRY_RUN = process.argv.includes('--dry-run');
const PLUGIN_SLUG = IKRAM_WP_SLUG;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function loadDeployEnv() {
  const envPath = path.join(ROOT, '.env.deploy.ikram');
  if (!fs.existsSync(envPath)) {
    fail('Eksik .env.deploy.ikram (şablon: .env.deploy.ikram.example).');
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  return {
    DEPLOY_SSH_ALIAS: String(parsed.DEPLOY_SSH_ALIAS || 'ikramaid').trim(),
    DEPLOY_SSH_HOST: String(parsed.DEPLOY_SSH_HOST || '').trim(),
    DEPLOY_SSH_USER: String(parsed.DEPLOY_SSH_USER || '').trim(),
    DEPLOY_SSH_PORT: String(parsed.DEPLOY_SSH_PORT || '').trim(),
    DEPLOY_SSH_KEY: String(parsed.DEPLOY_SSH_KEY || '').trim(),
    DEPLOY_WP_PATH: String(parsed.DEPLOY_WP_PATH || '~/www/ikramaid.uk/public_html').trim(),
    DEPLOY_SITE_URL: String(parsed.DEPLOY_SITE_URL || 'https://ikramaid.uk')
      .trim()
      .replace(/\/$/, ''),
  };
}

function sshArgs(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (alias) {
    return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', alias];
  }
  return [
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
  const args = sshArgs(env);
  return run('ssh', [...args, remoteCmd]);
}

function sshTransport(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (alias) return 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new';
  return `ssh -i ${env.DEPLOY_SSH_KEY} -p ${env.DEPLOY_SSH_PORT} -o BatchMode=yes`;
}

function rsyncDest(env, remoteDir) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  const dir = String(remoteDir || '').replace(/\/$/, '');
  if (alias) return `${alias}:${dir}/`;
  return `${env.DEPLOY_SSH_USER}@${env.DEPLOY_SSH_HOST}:${dir}/`;
}

/**
 * İçerik senkronu: kaynak ve hedef sonda slash. --delete yalnız eklenti dizini içinde.
 * @param {boolean} dry
 */
function rsyncTo(env, localDir, remoteDir, dry) {
  const src = `${String(localDir).replace(/\/$/, '')}/`;
  const dest = rsyncDest(env, remoteDir);
  const args = [
    '-az',
    '--delete',
    ...rsyncExcludeArgs(ROOT),
    '-e',
    sshTransport(env),
  ];
  if (dry) args.unshift('-n', '--itemize-changes');
  args.push(src, dest);
  const out = run('rsync', args, { stdio: dry ? 'pipe' : 'inherit' });
  if (dry) {
    const lines = String(out || '').split(/\r?\n/).filter(Boolean);
    console.log(`rsync dry-run: ${lines.length} satır`);
    console.log(lines.slice(0, 40).join('\n'));
    if (lines.length > 40) console.log(`… +${lines.length - 40} satır`);
  }
}

function resolveWpPath(env) {
  const raw = String(env.DEPLOY_WP_PATH || '').trim();
  if (raw.startsWith('~/') || raw.startsWith('$HOME')) {
    return remote(env, `echo ${raw.replace(/'/g, `'\\''`)}`);
  }
  return raw;
}

/**
 * Yalnız DİZİN. `wp plugin path SLUG` dosya döner; --dir şart.
 */
function resolvePluginDir(env, wpPathEsc) {
  const raw = remote(
    env,
    `wp plugin path ${PLUGIN_SLUG} --dir --path='${wpPathEsc}' 2>/dev/null || echo '${wpPathEsc}/wp-content/plugins/${PLUGIN_SLUG}'`
  );
  const dir = normalizeRemotePluginDir(raw, PLUGIN_SLUG);
  if (!dir) fail('Uzak eklenti dizini çözülemedi.');
  if (/\.php$/i.test(dir)) fail(`Eklenti yolu dosya; dizin beklenir: (gizlendi)`);
  const base = dir.split('/').filter(Boolean).pop();
  if (base !== PLUGIN_SLUG) fail(`Eklenti dizin adı ${PLUGIN_SLUG} olmalı.`);
  return dir;
}

function main() {
  console.log(IKRAM_ALLOW_REMOVAL_NOTE);
  const env = loadDeployEnv();
  const guard = validateDeployEnv(env);
  if (!guard.ok) fail(guard.reason);

  const pluginFile = path.join(ROOT, 'woo-donation-popup.php');
  const localVersion = parsePluginVersion(fs.readFileSync(pluginFile, 'utf8'));
  if (!localVersion) fail('Yerel sürüm okunamadı (woo-donation-popup.php Version).');

  const wpPath = resolveWpPath(env).replace(/'/g, `'\\''`);

  const siteCheck = remote(env, `wp option get siteurl --path='${wpPath}'`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const home = remote(env, 'echo $HOME').replace(/'/g, `'\\''`);
  const backupRoot = `${home}/wdp-backups`;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (ROLLBACK) {
    if (DRY_RUN) fail('--rollback ile --dry-run birlikte olmaz.');
    console.log('Ikram geri alma…');
    const latest = remote(
      env,
      `ls -1t '${backupRoot}'/${PLUGIN_SLUG}-*.zip 2>/dev/null | head -n 1`
    );
    if (!latest) fail('Geri alınacak yedek bulunamadı.');
    remote(
      env,
      `wp plugin install '${latest.replace(/'/g, `'\\''`)}' --force --activate --path='${wpPath}'`
    );
    remote(
      env,
      `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' --path='${wpPath}'`
    );
    remote(env, `(wp sg purge --path='${wpPath}' 2>/dev/null || wp cache flush --path='${wpPath}')`);
    const installed = remote(env, `wp plugin get ${PLUGIN_SLUG} --field=version --path='${wpPath}'`);
    console.log(`Ikram geri alındı: ${installed || '(sürüm okunamadı)'}`);
    return;
  }

  if (!DRY_RUN) {
    console.log('Doğrulama ve paket…');
    run('npm', ['run', 'verify'], { stdio: 'inherit' });
    run('npm', ['run', 'test'], { stdio: 'inherit' });
    run('npm', ['run', 'pack'], { stdio: 'inherit' });
  } else {
    console.log('Kuru çalıştırma: verify/test atlandı; paket varsa kullanılır.');
    const zipLocalEarly = path.join(ROOT, 'build', 'woo-donation-popup.zip');
    if (!fs.existsSync(zipLocalEarly)) {
      run('npm', ['run', 'pack'], { stdio: 'inherit' });
    }
  }

  const zipLocal = path.join(ROOT, 'build', 'woo-donation-popup.zip');
  if (!fs.existsSync(zipLocal)) fail('build/woo-donation-popup.zip oluşmadı.');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-ikram-'));
  run('unzip', ['-q', '-o', zipLocal, '-d', tmp]);
  const extracted = fs.existsSync(path.join(tmp, PLUGIN_SLUG))
    ? path.join(tmp, PLUGIN_SLUG)
    : tmp;
  if (!fs.existsSync(path.join(extracted, `${PLUGIN_SLUG}.php`))) {
    fail('Paket içinde woo-donation-popup.php yok.');
  }

  const pluginDir = resolvePluginDir(env, wpPath);
  console.log(`Hedef dizin (dizin, dosya değil): …/${PLUGIN_SLUG}`);

  if (DRY_RUN) {
    rsyncTo(env, extracted, pluginDir, true);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    console.log(`Ikram dry-run bitti (uzak yazılmadı). Yerel ${localVersion}.`);
    return;
  }

  remote(env, `mkdir -p '${backupRoot}'`);
  const backupZip = `${backupRoot}/${PLUGIN_SLUG}-pre-${localVersion}-${stamp}.zip`;
  const pluginDirEsc = pluginDir.replace(/'/g, `'\\''`);
  remote(
    env,
    [
      `PLUGIN_DIR='${pluginDirEsc}'`,
      `if [ -d "$PLUGIN_DIR" ]; then`,
      `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr '${backupZip}' "$(basename "$PLUGIN_DIR")")`,
      `  ls -1t '${backupRoot}'/${PLUGIN_SLUG}-*.zip 2>/dev/null | tail -n +4 | while read -r f; do rm -f "$f"; done`,
      `fi`,
      `mkdir -p "$PLUGIN_DIR"`,
    ].join('\n')
  );

  rsyncTo(env, extracted, pluginDir, true);
  rsyncTo(env, extracted, pluginDir, false);

  remote(env, `wp plugin activate ${PLUGIN_SLUG} --path='${wpPath}'`);
  remote(
    env,
    `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' --path='${wpPath}'`
  );

  const installed = remote(env, `wp plugin get ${PLUGIN_SLUG} --field=version --path='${wpPath}'`);
  if (installed !== localVersion) {
    fail(`Kurulu sürüm yerel ile eşleşmiyor (yerel ${localVersion}, uzak ${installed}).`);
  }

  const phpOk = remote(env, `wp eval 'echo 1;' --path='${wpPath}'`);
  if (String(phpOk).trim() !== '1') {
    fail(`PHP eval echo 1 beklenen 1 değil: ${String(phpOk).slice(0, 80)}`);
  }

  remote(
    env,
    `(wp sg purge --path='${wpPath}' 2>/dev/null || true; wp cache flush --path='${wpPath}' 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' --path='${wpPath}')`
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log(`Ikram'a kuruldu: ${localVersion}`);
}

main();
