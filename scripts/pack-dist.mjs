#!/usr/bin/env node
/**
 * Faz 9 paket adayı: `wp dist-archive` (resmi wp-cli/dist-archive-command) ile sürüm zip'i.
 * Çıktı: build/dist/woo-donation-popup.zip (mevcut `npm run pack` çıktısı build/woo-donation-popup.zip ile karışmaz).
 * Yerel; uzak yok. Araçlar proje içinde: tools/bin/wp-cli.phar + build/wpcli-packages (WP_CLI_PACKAGES_DIR).
 *
 *   npm run pack:dist           # önce build, sonra zip
 *   node scripts/pack-dist.mjs --install   # dist-archive-command 3.1.0 kurar (proje içi)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHAR = path.join(ROOT, 'tools/bin/wp-cli.phar');
const PKG_DIR = path.join(ROOT, 'build/wpcli-packages');
const OUT = path.join(ROOT, 'build/dist/woo-donation-popup.zip');
const DIST_ARCHIVE_VERSION = '3.1.0'; // wp-cli ^2 ile uyumlu; 3.2.x wp-cli ^2.13/^3 ister

const env = {
  ...process.env,
  WP_CLI_PACKAGES_DIR: PKG_DIR,
  WP_CLI_CACHE_DIR: path.join(ROOT, 'build/wpcli-cache'),
  WP_CLI_CONFIG_PATH: path.join(ROOT, 'build/wpcli-config.yml'),
};

function wp(args) {
  return spawnSync('php', ['-d', 'error_reporting=E_ALL&~E_DEPRECATED', '-d', 'display_errors=0', PHAR, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  });
}

if (!fs.existsSync(PHAR)) {
  console.error('wp-cli.phar yok. Önce: npm run test:install');
  process.exit(2);
}

if (process.argv.includes('--install')) {
  fs.mkdirSync(PKG_DIR, { recursive: true });
  const r = wp(['package', 'install', `wp-cli/dist-archive-command:${DIST_ARCHIVE_VERSION}`]);
  process.stdout.write(r.stdout || '');
  if (r.status !== 0) {
    process.stderr.write(r.stderr || '');
    process.exit(r.status || 1);
  }
}

const guard = spawnSync('node', [path.join(ROOT, 'scripts/lib/remote-guard.mjs'), '--assert-local-pack'], { cwd: ROOT, stdio: 'inherit' });
if (guard.status !== 0) process.exit(guard.status || 1);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const r = wp(['dist-archive', '.', OUT, '--force', '--create-target-dir', '--plugin-dirname=woo-donation-popup']);
process.stdout.write(r.stdout || '');
if (r.status !== 0) {
  process.stderr.write(r.stderr || '');
  console.error('pack:dist başarısız. dist-archive kurulu mu? node scripts/pack-dist.mjs --install');
  process.exit(r.status || 1);
}
console.log(`pack:dist: ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bayt)`);
