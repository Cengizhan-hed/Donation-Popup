#!/usr/bin/env node
/**
 * Yerel WordPress + SQLite (Docker yok, wp-env yok).
 * PHP yerleşik; gerçek dosya sistemi — wp_delete_user kanıtı için.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const LOCAL_WP_ROOT = path.join(ROOT, 'build/local-wp');
export const WP_DIR = path.join(LOCAL_WP_ROOT, 'wordpress');
const WP_ZIP = path.join(LOCAL_WP_ROOT, 'wordpress-latest.zip');
const SQLITE_ZIP = path.join(LOCAL_WP_ROOT, 'sqlite-database-integration.zip');

/**
 * @param {string} [root]
 */
export function localWpPaths(root = LOCAL_WP_ROOT) {
  return {
    root,
    wpDir: path.join(root, 'wordpress'),
    wpZip: path.join(root, 'wordpress-latest.zip'),
    sqliteZip: path.join(root, 'sqlite-database-integration.zip'),
  };
}

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  if (r.status !== 0) {
    throw new Error(`${bin} ${args[0] || ''} başarısız: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  return r.stdout || '';
}

function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  run('curl', ['-fsSL', '-o', dest, url]);
}

/**
 * @param {string} [wpDir]
 * @param {{ homeUrl?: string }} [opts]
 */
export function writeWpConfig(wpDir = WP_DIR, opts = {}) {
  const home = String(opts.homeUrl || 'http://127.0.0.1:8080').replace(/\/$/, '');
  const homePhp = home.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const cfg = `<?php
define('DB_NAME', 'local_wdp');
define('DB_USER', 'root');
define('DB_PASSWORD', '');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
define('DB_DIR', __DIR__ . '/wp-content/database/');
define('DB_FILE', '.ht.sqlite');
define('AUTH_KEY', 'local-wdp-auth-key-not-secret');
define('SECURE_AUTH_KEY', 'local-wdp-secure-auth-key');
define('LOGGED_IN_KEY', 'local-wdp-logged-in-key');
define('NONCE_KEY', 'local-wdp-nonce-key');
define('AUTH_SALT', 'local-wdp-auth-salt');
define('SECURE_AUTH_SALT', 'local-wdp-secure-auth-salt');
define('LOGGED_IN_SALT', 'local-wdp-logged-in-salt');
define('NONCE_SALT', 'local-wdp-nonce-salt');
\\$table_prefix = 'wp_';
define('WP_DEBUG', true);
define('WP_DEBUG_DISPLAY', false);
define('WP_DEBUG_LOG', false);
define('WP_MEMORY_LIMIT', '512M');
define('DISABLE_WP_CRON', true);
define('WP_HOME', '${homePhp}');
define('WP_SITEURL', '${homePhp}');
if (empty(\\$_SERVER['HTTP_HOST'])) {
  \\$_SERVER['HTTP_HOST'] = '127.0.0.1';
  \\$_SERVER['SERVER_NAME'] = '127.0.0.1';
  \\$_SERVER['REQUEST_URI'] = '/';
}
if (!defined('ABSPATH')) {
  define('ABSPATH', __DIR__ . '/');
}
require_once ABSPATH . 'wp-settings.php';
`;
  fs.writeFileSync(path.join(wpDir, 'wp-config.php'), cfg.replace(/\\\$/g, '$'), 'utf8');
}

/** @param {string} [wpDir] */
export function sqliteDbDir(wpDir = WP_DIR) {
  return path.join(wpDir, 'wp-content/database');
}

/** @param {string} [wpDir] */
export function sqliteDbFile(wpDir = WP_DIR) {
  return path.join(sqliteDbDir(wpDir), '.ht.sqlite');
}

function copyCachedZip(dest, fallbacks) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  for (const fb of fallbacks) {
    if (fb && fs.existsSync(fb) && fs.statSync(fb).size > 10000) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(fb, dest);
      return dest;
    }
  }
  return dest;
}

/**
 * @param {string|{root?: string, quiet?: boolean}} [rootOrOpts]
 * @returns {string} wordpress dizini
 */
export function ensureLocalWp(rootOrOpts = LOCAL_WP_ROOT) {
  let root = LOCAL_WP_ROOT;
  let quiet = false;
  if (rootOrOpts && typeof rootOrOpts === 'object') {
    root = rootOrOpts.root || LOCAL_WP_ROOT;
    quiet = !!rootOrOpts.quiet;
  } else if (typeof rootOrOpts === 'string') {
    root = rootOrOpts;
  }
  const log = quiet ? () => {} : console.log;
  const { wpDir, wpZip, sqliteZip } = localWpPaths(root);
  fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(path.join(wpDir, 'wp-load.php'))) {
    log('WordPress indiriliyor (wordpress.org/latest.zip)…');
    copyCachedZip(wpZip, [WP_ZIP, path.join(LOCAL_WP_ROOT, 'wordpress-latest.zip')]);
    download('https://wordpress.org/latest.zip', wpZip);
    run('unzip', ['-q', '-o', wpZip, '-d', root]);
  }
  writeWpConfig(wpDir);
  fs.mkdirSync(path.join(wpDir, 'wp-content/database'), { recursive: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/uploads'), { recursive: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/plugins'), { recursive: true });

  const sqliteDest = path.join(wpDir, 'wp-content/plugins/sqlite-database-integration');
  if (!fs.existsSync(path.join(sqliteDest, 'db.php')) && !fs.existsSync(path.join(sqliteDest, 'load.php'))) {
    log('SQLite eklentisi indiriliyor…');
    copyCachedZip(sqliteZip, [SQLITE_ZIP, path.join(LOCAL_WP_ROOT, 'sqlite-database-integration.zip')]);
    download(
      'https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip',
      sqliteZip
    );
    run('unzip', ['-q', '-o', sqliteZip, '-d', path.join(wpDir, 'wp-content/plugins')]);
  }
  const dropinSrcCandidates = [
    path.join(sqliteDest, 'db.copy'),
    path.join(sqliteDest, 'db.php'),
  ];
  const dropinSrc = dropinSrcCandidates.find((p) => fs.existsSync(p));
  if (dropinSrc) {
    fs.copyFileSync(dropinSrc, path.join(wpDir, 'wp-content/db.php'));
  }

  const installPhp = path.join(root, 'install.php');
  fs.writeFileSync(
    installPhp,
    `<?php
define('WP_INSTALLING', true);
require '${wpDir.replace(/'/g, "\\'")}/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
if (get_option('siteurl')) { echo "already-installed\\n"; echo get_option('siteurl'); exit(0); }
$result = wp_install('WDP Local', 'admin', 'admin@local.test', true, '', 'admin');
echo "installed\\n";
echo isset($result['url']) ? $result['url'] : get_option('siteurl');
`
  );
  const out = run('php', [installPhp]);
  log(String(out).trim().slice(0, 200));
  return wpDir;
}

/**
 * SQLite + eklentileri (sqlite dışında) silip yeniden kurar. Yalnız verilen kök.
 * @param {string} [root]
 */
export function resetLocalWp(root = LOCAL_WP_ROOT) {
  const { wpDir } = localWpPaths(root);
  const dbDir = path.join(wpDir, 'wp-content/database');
  if (fs.existsSync(dbDir)) {
    for (const f of fs.readdirSync(dbDir)) {
      fs.rmSync(path.join(dbDir, f), { force: true });
    }
  }
  const plugins = path.join(wpDir, 'wp-content/plugins');
  if (fs.existsSync(plugins)) {
    for (const f of fs.readdirSync(plugins)) {
      if (f === 'sqlite-database-integration') continue;
      fs.rmSync(path.join(plugins, f), { recursive: true, force: true });
    }
  }
  return ensureLocalWp(root);
}

export function phpEvalFile(rel, extraEnv = {}, extraArgs = []) {
  const wpDir = extraEnv.WDP_LOCAL_WP_DIR || WP_DIR;
  if (!extraEnv.WDP_LOCAL_WP_DIR) ensureLocalWp();
  const env = { ...process.env, ...extraEnv, WDP_LOCAL_WP_DIR: extraEnv.WDP_LOCAL_WP_DIR || wpDir };
  const phpArgs = ['-d', 'memory_limit=512M', path.join(ROOT, 'tests/local-wp/eval-file.php'), rel, ...extraArgs];
  const r = spawnSync('php', phpArgs, {
    encoding: 'utf8',
    cwd: ROOT,
    env,
  });
  if (r.status !== 0) {
    throw new Error(`local eval-file ${rel}: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return r.stdout || '';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'ensure';
  if (cmd === 'ensure') {
    const dir = ensureLocalWp();
    console.log(`Yerel WP: ${dir}`);
  } else {
    console.error('Kullanım: node scripts/local-wp.mjs ensure');
    process.exit(1);
  }
}
