#!/usr/bin/env node
/**
 * Minimum sürüm gerçek testi (yerel, tek seferlik): belirli WordPress + WooCommerce sürümüyle
 * yerel SQLite WP kurar, matris senaryolarını koşar, eklentiye ait PHP uyarı/bildirim satırlarını sayar.
 * Uzak site yok. İndirme yalnız wordpress.org / downloads.wordpress.org; indirilenler çalıştırılmaz (yalnız açılır).
 *
 *   node scripts/min-versions.mjs --wp 6.3.5 --wc 8.0.3 [--theme storefront] [--store gbp]
 *        [--checkout classic|blocks] [--hpos 0|1] [--device iphone] [--port 8974] [--clean] [--no-reinstall]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ensureLocalWp,
  writeWpConfig,
  sqliteDbFile,
} from './local-wp.mjs';
import {
  matrixEval,
  ensureTheme,
  startPhpServer,
  snapshotSqlite,
  restoreSqlite,
  CACHE_DIR,
} from '../tests/e2e/helpers/matrix-setup.mjs';
import { runDeviceScenarios } from '../tests/e2e/helpers/matrix-scenarios.mjs';
import { loadMatrix } from '../tests/e2e/helpers/matrix-cover.mjs';
import { setActiveProfile } from '../tests/e2e/helpers/profile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MV_DIR = path.join(ROOT, 'build/min-versions');
const ZIP_CACHE = path.join(MV_DIR, '_zips');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const flag = (n) => process.argv.includes(`--${n}`);

function sh(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  if (r.status !== 0) throw new Error(`${bin} ${args[0] || ''}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  return r.stdout || '';
}

function fetchZip(url, dest) {
  if (!/^https:\/\/(downloads\.)?wordpress\.org\//i.test(url)) throw new Error(`yalnız wordpress.org: ${url}`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  sh('curl', ['-fsSL', '-L', '-o', dest, url]);
  return dest;
}

const PLUGIN_PARTS = ['includes', 'src', 'assets', 'templates', 'blocks', 'languages', 'woo-donation-popup.php', 'uninstall.php', 'readme.txt', 'index.php'];

function installPlugin(wpDir) {
  const dest = path.join(wpDir, 'wp-content/plugins/woo-donation-popup');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const p of PLUGIN_PARTS) {
    const src = path.join(ROOT, p);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, p), { recursive: true });
  }
}

async function main() {
  const wp = arg('wp', '6.3.5');
  const wc = arg('wc', '8.0.3');
  const themeSlug = arg('theme', 'storefront');
  const storeKey = arg('store', 'gbp');
  const checkout = arg('checkout', 'classic');
  const hpos = arg('hpos', '1') === '1';
  const device = arg('device', 'iphone');
  const port = Number(arg('port', '8974'));
  const id = `wp${wp}-wc${wc}-${themeSlug}-${checkout}-${hpos ? 'hpos' : 'nohpos'}`;
  const root = path.join(MV_DIR, id);
  const wpDir = path.join(root, 'wordpress');
  const shotDir = path.join(root, 'shots');

  setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
  const matrix = loadMatrix();
  const store = matrix.stores[storeKey];
  if (!store) throw new Error(`mağaza yok: ${storeKey}`);

  if (flag('clean')) fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(shotDir, { recursive: true });

  if (!fs.existsSync(path.join(wpDir, 'wp-load.php'))) {
    const zip = fetchZip(`https://wordpress.org/wordpress-${wp}.zip`, path.join(ZIP_CACHE, `wordpress-${wp}.zip`));
    sh('unzip', ['-q', '-o', zip, '-d', root]);
  }
  ensureLocalWp({ root, quiet: true });
  if (!fs.existsSync(path.join(wpDir, 'wp-content/plugins/woocommerce/woocommerce.php'))) {
    const zip = fetchZip(
      `https://downloads.wordpress.org/plugin/woocommerce.${wc}.zip`,
      path.join(ZIP_CACHE, `woocommerce.${wc}.zip`)
    );
    sh('unzip', ['-q', '-o', zip, '-d', path.join(wpDir, 'wp-content/plugins')]);
  }
  if (themeSlug) {
    const themeDir = path.join(wpDir, 'wp-content/themes', themeSlug);
    if (!fs.existsSync(themeDir)) {
      // Tema sürümü: WP 6.3 uyumlu en son tema için önbellek dizinini kullan (matrix-setup indirir).
      ensureTheme(wpDir, themeSlug);
    }
  }
  if (!flag('no-reinstall')) installPlugin(wpDir);
  fs.copyFileSync(path.join(ROOT, 'tests/local-wp/router.php'), path.join(wpDir, 'router.php'));
  writeWpConfig(wpDir, { homeUrl: `http://127.0.0.1:${port}` });
  // Eklentiye ait PHP uyarılarını yakalamak için hata günlüğü.
  const logFile = path.join(root, 'php-errors.log');
  fs.rmSync(logFile, { force: true });
  const cfgFile = path.join(wpDir, 'wp-config.php');
  let cfg = fs.readFileSync(cfgFile, 'utf8');
  cfg = cfg.replace("define('WP_DEBUG_LOG', false);", `define('WP_DEBUG_LOG', '${logFile.replace(/'/g, "\\'")}');`);
  fs.writeFileSync(cfgFile, cfg);

  const report = { id, wp, wc, php: sh('php', ['-r', 'echo PHP_VERSION;']).trim(), steps: [] };
  const step = (name, ok, info = '') => {
    report.steps.push({ name, ok, info });
    console.log(`${ok ? 'OK ' : 'HATA'} ${name} ${info}`);
  };

  // WP/WC/eklenti gerçek sürümü
  const ver = matrixEval(wpDir, ['probe']);
  step('probe', !!ver, JSON.stringify(ver).slice(0, 200));

  const spec = { id, themeSlug, store, checkout, hpos };
  const specFile = path.join(root, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const base = matrixEval(wpDir, ['base'], { timeout: 300000 });
  step('base (WC + eklenti etkinleştirme)', !!base.ok, base.ok ? '' : String(base.error || JSON.stringify(base)).slice(0, 300));
  if (!base.ok) return finish(report, root, logFile, 1);
  const applied = matrixEval(wpDir, ['apply', specFile], { timeout: 300000 });
  step('apply (ürün/mağaza/ödeme/HPOS)', !!applied.ok, applied.ok ? '' : String(applied.error || '').slice(0, 300));
  if (!applied.ok) return finish(report, root, logFile, 1);
  const probe = applied.probe || matrixEval(wpDir, ['probe']);
  const snap = path.join(root, 'snap.sqlite');
  snapshotSqlite(wpDir, snap);

  restoreSqlite(wpDir, snap);
  const server = await startPhpServer({ wpDir, port });
  let scenarios = [];
  try {
    scenarios = await runDeviceScenarios({
      deviceId: device,
      baseUrl: server.url.replace(/\/$/, ''),
      wpDir,
      probe,
      store,
      checkoutKind: checkout,
      shotDir,
    });
  } catch (e) {
    scenarios = [{ id: 'runner', ok: false, error: String(e && e.message ? e.message : e).slice(0, 300), loc: '' }];
  } finally {
    await server.stop();
  }
  for (const s of scenarios) step(`senaryo:${s.id}`, s.ok, s.ok ? `${s.ms}ms` : `${s.error} ${s.loc || ''}`);
  const failed = scenarios.filter((s) => !s.ok).length;
  report.passed = scenarios.length - failed;
  report.failed = failed;
  return finish(report, root, logFile, failed ? 1 : 0);
}

function finish(report, root, logFile, code) {
  let pluginLines = [];
  let total = 0;
  if (fs.existsSync(logFile)) {
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    total = lines.length;
    pluginLines = lines.filter((l) => /woo-donation-popup/.test(l));
  }
  report.phpLogTotal = total;
  report.phpLogPlugin = pluginLines.length;
  console.log(`PHP günlüğü: toplam ${total}, eklentiye ait ${pluginLines.length}`);
  for (const l of pluginLines.slice(0, 8)) console.log('  ' + l.replace(/\/Users\/[^ ]*\/wordpress\//, '').slice(0, 220));
  fs.writeFileSync(path.join(root, 'sonuc.json'), JSON.stringify(report, null, 2));
  console.log(`SONUC ${report.id}: geçen=${report.passed ?? 0} kalan=${report.failed ?? 0} eklenti-php-satırı=${pluginLines.length}`);
  process.exit(code);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(2);
});
