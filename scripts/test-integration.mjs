#!/usr/bin/env node
/**
 * Gerçek WordPress + WooCommerce (SQLite) üzerinde PHPUnit entegrasyon testleri.
 *
 * build/local-wp/wordpress (yalnız yerel; uzak bağlantı yok) APFS klonuyla build/integration-wp/wordpress'e kopyalanır,
 * eklenti dosyaları her koşuda yeniden eşlenir, WP hazırlanır (tests/integration/prepare.php) ve
 * `phpunit.integration.xml.dist` çalışır. Kendi kopyasında çalıştığı için `build/local-wp` verisini değiştirmez.
 *
 *   npm run test:integration [-- --filter ADI] [-- --fresh]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ensureLocalWp, LOCAL_WP_ROOT } from './local-wp.mjs';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';

const INTEGRATION_ROOT = path.join(ROOT, 'build/integration-wp');
const DEST = path.join(INTEGRATION_ROOT, 'wordpress');
const PLUGIN_SLUG = 'woo-donation-popup';
const PLUGIN_PARTS = ['src', 'assets', 'templates', 'blocks', 'languages', 'woo-donation-popup.php', 'uninstall.php', 'readme.txt', 'index.php'];

function run(bin, args, opts = {}) {
  return spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
}

function ensureWoo(srcWp) {
  const wooDir = path.join(srcWp, 'wp-content/plugins/woocommerce');
  if (fs.existsSync(path.join(wooDir, 'woocommerce.php'))) return;
  const zip = path.join(LOCAL_WP_ROOT, 'woocommerce.latest-stable.zip');
  if (!fs.existsSync(zip) || fs.statSync(zip).size < 10000) {
    const d = run('curl', ['-fsSL', '-o', zip, 'https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip']);
    if (d.status !== 0) throw new Error('WooCommerce indirilemedi');
  }
  const u = run('unzip', ['-q', '-o', zip, '-d', path.join(srcWp, 'wp-content/plugins')]);
  if (u.status !== 0) throw new Error('WooCommerce açılamadı');
}

function syncPlugin() {
  const dest = path.join(DEST, 'wp-content/plugins', PLUGIN_SLUG);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const part of PLUGIN_PARTS) {
    const src = path.join(ROOT, part);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, part), { recursive: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const fresh = args.includes('--fresh');
  const rest = args.filter((a) => a !== '--fresh');
  const srcWp = ensureLocalWp({ root: LOCAL_WP_ROOT, quiet: true });
  ensureWoo(srcWp);
  if (fresh) fs.rmSync(INTEGRATION_ROOT, { recursive: true, force: true });
  if (!fs.existsSync(path.join(DEST, 'wp-load.php'))) {
    fs.mkdirSync(INTEGRATION_ROOT, { recursive: true });
    const c = run('cp', ['-Rc', srcWp, DEST]);
    if (c.status !== 0) fs.cpSync(srcWp, DEST, { recursive: true });
  }
  syncPlugin();
  const env = { ...process.env, WDP_INTEGRATION_WP_DIR: DEST };
  const prep = run('php', ['-d', 'memory_limit=1G', path.join(ROOT, 'tests/integration/prepare.php')], { env });
  if (prep.status !== 0) {
    console.error(`hazırlık başarısız:\n${(prep.stderr || prep.stdout || '').slice(0, 800)}`);
    process.exit(1);
  }
  console.log(`WP hazır: ${String(prep.stdout).trim().split('\n').pop()}`);
  const t = spawnSync('php', ['-d', 'memory_limit=1G', path.join(ROOT, 'vendor/bin/phpunit'), '-c', 'phpunit.integration.xml.dist', ...rest], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  process.exit(t.status ?? 1);
}

main();
