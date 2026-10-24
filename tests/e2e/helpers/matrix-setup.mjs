/**
 * Yerel matris: tema/WC indirme, anlık görüntü, PHP sunucu, işçi kopyası.
 * Uzak site yok. İndirme yalnız downloads.wordpress.org / wordpress.org.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT } from './env-root.mjs';
import {
  ensureLocalWp,
  writeWpConfig,
  sqliteDbFile,
  sqliteDbDir,
} from '../../../scripts/local-wp.mjs';

export const MATRIX_DIR = path.join(ROOT, 'build/e2e/matrix');
export const CACHE_DIR = path.join(MATRIX_DIR, '_cache');
export const TEMPLATE_ROOT = path.join(MATRIX_DIR, '_template');
export const SNAPSHOT_DIR = path.join(MATRIX_DIR, '_snapshots');
export const WORKER_DIR = path.join(MATRIX_DIR, '_workers');

const PLUGIN_SLUG = 'woo-donation-popup';
const WC_SLUG = 'woocommerce';
const OPS = 'tests/local-wp/matrix-ops.php';
const ROUTER_SRC = path.join(ROOT, 'tests/local-wp/router.php');

const WP_ORG_PLUGIN = 'https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip';
const WP_ORG_THEME = (slug) => `https://downloads.wordpress.org/theme/${slug}.latest-stable.zip`;

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  if (r.status !== 0) {
    throw new Error(`${bin} ${args[0] || ''} başarısız: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return r.stdout || '';
}

function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  if (!/^https:\/\/(downloads\.)?wordpress\.org\//i.test(url)) {
    throw new Error(`yalnız wordpress.org indirmesi: ${url}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  run('curl', ['-fsSL', '-L', '-o', dest, url]);
  return dest;
}

function parseJsonLine(text) {
  const raw = String(text || '');
  const i = raw.indexOf('{');
  const j = raw.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error(`JSON yok: ${raw.slice(0, 240)}`);
  return JSON.parse(raw.slice(i, j + 1));
}

/**
 * @param {string} wpDir
 * @param {string[]} extraArgs
 * @param {{ timeout?: number }} [opts]
 */
export function matrixEval(wpDir, extraArgs, opts = {}) {
  const evalFile = path.join(ROOT, 'tests/local-wp/eval-file.php');
  const r = spawnSync(
    'php',
    ['-d', 'memory_limit=1024M', evalFile, OPS, ...extraArgs],
    {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, WDP_LOCAL_WP_DIR: wpDir },
      timeout: opts.timeout || 180000,
    }
  );
  if (r.status !== 0) {
    throw new Error(`matrix-ops ${extraArgs[0] || ''}: ${(r.stderr || r.stdout || '').slice(0, 700)}`);
  }
  return parseJsonLine(r.stdout);
}

function cloneDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync('cp', ['-Rc', src, dest], { encoding: 'utf8' });
  if (r.status !== 0) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

function installCurrentPlugin(wpDir) {
  const dest = path.join(wpDir, 'wp-content/plugins', PLUGIN_SLUG);
  const cssBundle = path.join(ROOT, 'assets/css/donation-modal.css');
  const jsBundle = path.join(ROOT, 'assets/js/donation-modal.js');
  if (!fs.existsSync(cssBundle) || !fs.existsSync(jsBundle)) {
    run('npm', ['run', 'build']);
  }
  const parts = [
    'includes',
    'assets',
    'templates',
    'blocks',
    'languages',
    'woo-donation-popup.php',
    'uninstall.php',
    'readme.txt',
    'index.php',
  ];
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const p of parts) {
    const src = path.join(ROOT, p);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(dest, p), { recursive: true });
  }
  return dest;
}

function ensureWooCommerce(wpDir) {
  const dest = path.join(wpDir, 'wp-content/plugins', WC_SLUG);
  if (fs.existsSync(path.join(dest, 'woocommerce.php'))) return dest;
  const zip = path.join(CACHE_DIR, 'woocommerce.latest-stable.zip');
  const fallbacks = [
    path.join(ROOT, 'build/migration/cache/woocommerce.latest-stable.zip'),
    path.join(ROOT, 'build/local-wp/woocommerce.latest-stable.zip'),
  ];
  if (!fs.existsSync(zip) || fs.statSync(zip).size < 10000) {
    for (const fb of fallbacks) {
      if (fb && fs.existsSync(fb) && fs.statSync(fb).size > 10000) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.copyFileSync(fb, zip);
        break;
      }
    }
  }
  download(WP_ORG_PLUGIN, zip);
  run('unzip', ['-q', '-o', zip, '-d', path.join(wpDir, 'wp-content/plugins')]);
  return dest;
}

function ensureTheme(wpDir, slug) {
  const dest = path.join(wpDir, 'wp-content/themes', slug);
  if (fs.existsSync(path.join(dest, 'style.css')) || fs.existsSync(path.join(dest, 'theme.json'))) {
    return dest;
  }
  const zip = path.join(CACHE_DIR, `${slug}.latest-stable.zip`);
  download(WP_ORG_THEME(slug), zip);
  run('unzip', ['-q', '-o', zip, '-d', path.join(wpDir, 'wp-content/themes')]);
  return dest;
}

function copyRouter(wpDir) {
  fs.copyFileSync(ROUTER_SRC, path.join(wpDir, 'router.php'));
}

/**
 * @param {string} wpDir
 * @param {string} destFile
 */
export function snapshotSqlite(wpDir, destFile) {
  matrixEval(wpDir, ['checkpoint']);
  const src = sqliteDbFile(wpDir);
  if (!fs.existsSync(src)) throw new Error(`sqlite yok: ${src}`);
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.copyFileSync(src, destFile);
  for (const ext of ['-wal', '-shm']) {
    const s = src + ext;
    const d = destFile + ext;
    if (fs.existsSync(s) && fs.statSync(s).size > 0) fs.copyFileSync(s, d);
    else if (fs.existsSync(d)) fs.rmSync(d, { force: true });
  }
  return destFile;
}

/**
 * @param {string} wpDir
 * @param {string} snapshotFile
 */
export function restoreSqlite(wpDir, snapshotFile) {
  if (!fs.existsSync(snapshotFile)) throw new Error(`görüntü yok: ${snapshotFile}`);
  const dir = sqliteDbDir(wpDir);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, f), { force: true });
  }
  const dest = sqliteDbFile(wpDir);
  fs.copyFileSync(snapshotFile, dest);
  for (const ext of ['-wal', '-shm']) {
    const s = snapshotFile + ext;
    if (fs.existsSync(s)) fs.copyFileSync(s, dest + ext);
  }
  return dest;
}

/**
 * @param {string} wpDir
 * @returns {string} wordpress dizini
 */
function seedZipCache() {
  const sibling = path.resolve(ROOT, '../Donation Popup/build');
  const copies = [
    [path.join(sibling, 'local-wp/wordpress-latest.zip'), path.join(TEMPLATE_ROOT, 'wordpress-latest.zip')],
    [
      path.join(sibling, 'local-wp/sqlite-database-integration.zip'),
      path.join(TEMPLATE_ROOT, 'sqlite-database-integration.zip'),
    ],
    [
      path.join(sibling, 'migration/cache/woocommerce.latest-stable.zip'),
      path.join(CACHE_DIR, 'woocommerce.latest-stable.zip'),
    ],
  ];
  for (const [src, dest] of copies) {
    if (fs.existsSync(src) && fs.statSync(src).size > 10000) {
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
  }
  const siblingCache = path.join(sibling, 'e2e/matrix/_cache');
  if (fs.existsSync(siblingCache)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    for (const name of fs.readdirSync(siblingCache)) {
      if (!name.endsWith('.zip')) continue;
      const src = path.join(siblingCache, name);
      const dest = path.join(CACHE_DIR, name);
      if (fs.existsSync(src) && fs.statSync(src).size > 10000) {
        if (!fs.existsSync(dest) || fs.statSync(dest).size < 10000) {
          fs.copyFileSync(src, dest);
        }
      }
    }
  }
}

function seedSiblingSnapshots() {
  const sibling = path.resolve(ROOT, '../Donation Popup/build/e2e/matrix');
  const pairs = [
    [path.join(sibling, '_snapshots/_base.sqlite'), path.join(SNAPSHOT_DIR, '_base.sqlite')],
    [
      path.join(sibling, '_snapshots/tt5-try-blocks-hpos.sqlite'),
      path.join(SNAPSHOT_DIR, 'tt5-try-blocks-hpos.sqlite'),
    ],
    [
      path.join(sibling, '_snapshots/tt5-try-blocks-hpos.json'),
      path.join(SNAPSHOT_DIR, 'tt5-try-blocks-hpos.json'),
    ],
  ];
  for (const [src, dest] of pairs) {
    if (fs.existsSync(src) && fs.statSync(src).size > 1000) {
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }
    for (const ext of ['-wal', '-shm']) {
      const s = src + ext;
      const d = dest + ext;
      if (fs.existsSync(s) && (!fs.existsSync(d) || fs.statSync(d).size === 0)) {
        fs.copyFileSync(s, d);
      }
    }
  }
}

export function ensureMatrixTemplate() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  seedZipCache();
  seedSiblingSnapshots();
  const wpDir = ensureLocalWp({ root: TEMPLATE_ROOT, quiet: true });
  ensureWooCommerce(wpDir);
  ensureTheme(wpDir, 'twentytwentyfive');
  ensureTheme(wpDir, 'storefront');
  installCurrentPlugin(wpDir);
  copyRouter(wpDir);
  writeWpConfig(wpDir, { homeUrl: 'http://127.0.0.1:8899' });
  const baseSnap = path.join(SNAPSHOT_DIR, '_base.sqlite');
  if (!fs.existsSync(baseSnap)) {
    const r = matrixEval(wpDir, ['base'], { timeout: 240000 });
    if (!r.ok) throw new Error(`WC/WDP taban: ${r.error || JSON.stringify(r).slice(0, 300)}`);
    snapshotSqlite(wpDir, baseSnap);
  }
  return wpDir;
}

/**
 * @param {object} resolved resolveConfig sonucu
 */
function snapshotHasRequiredProducts(meta) {
  const products = (meta && meta.probe && meta.probe.products) || (meta && meta.products) || {};
  return ['fixed', 'custom', 'shares', 'campaign'].every((k) => products[k] && products[k].path);
}

export function prepareConfigSnapshot(resolved) {
  const wpDir = ensureMatrixTemplate();
  const snap = path.join(SNAPSHOT_DIR, `${resolved.id}.sqlite`);
  const metaFile = path.join(SNAPSHOT_DIR, `${resolved.id}.json`);
  if (fs.existsSync(snap) && fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    if (snapshotHasRequiredProducts(meta)) {
      return { snap, meta };
    }
    fs.rmSync(snap, { force: true });
    fs.rmSync(metaFile, { force: true });
    for (const ext of ['-wal', '-shm']) {
      fs.rmSync(snap + ext, { force: true });
    }
  }
  restoreSqlite(wpDir, path.join(SNAPSHOT_DIR, '_base.sqlite'));
  const spec = {
    id: resolved.id,
    themeSlug: resolved.themeSpec.slug,
    store: resolved.storeSpec,
    checkout: resolved.checkout,
    hpos: !!resolved.hpos,
  };
  const specFile = path.join(SNAPSHOT_DIR, `${resolved.id}.spec.json`);
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
  const r = matrixEval(wpDir, ['apply', specFile], { timeout: 240000 });
  if (!r.ok) throw new Error(`yapılandırma ${resolved.id}: ${r.error || JSON.stringify(r).slice(0, 400)}`);
  snapshotSqlite(wpDir, snap);
  const meta = r.probe || matrixEval(wpDir, ['probe']);
  fs.writeFileSync(metaFile, JSON.stringify({ spec, probe: meta }, null, 2) + '\n');
  return { snap, meta };
}

/**
 * @param {number} port
 * @returns {number[]}
 */
export function listenPids(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
  });
  return String(r.stdout || '')
    .trim()
    .split(/\s+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 1);
}

/**
 * Portu dinleyen süreçleri kapat; kalıntı kalmayınca döner.
 * @param {number} port
 * @param {number} [timeoutMs]
 */
export async function freeListenPort(port, timeoutMs = 8000) {
  const t0 = Date.now();
  let pids = listenPids(port);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (e) {
      if (e && e.code !== 'ESRCH') throw e;
    }
  }
  while (Date.now() - t0 < timeoutMs) {
    pids = listenPids(port);
    if (!pids.length) return;
    if (Date.now() - t0 > 1500) {
      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) {
          if (e && e.code !== 'ESRCH') throw e;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  pids = listenPids(port);
  if (pids.length) {
    throw new Error(`port ${port} hâlâ dinleniyor: ${pids.join(',')}`);
  }
}

function waitHttp(url, timeoutMs = 40000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, { timeout: 2000 }, (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      });
      req.on('error', () => {
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(`PHP sunucu açılmadı: ${url}`));
          return;
        }
        setTimeout(tick, 200);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(`PHP sunucu zaman aşımı: ${url}`));
          return;
        }
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

/**
 * @param {{ wpDir: string, port: number, host?: string }} opts
 */
export async function startPhpServer(opts) {
  const host = opts.host || '127.0.0.1';
  const port = Number(opts.port);
  const wpDir = opts.wpDir;
  copyRouter(wpDir);
  const logFile = path.join(MATRIX_DIR, `php-${port}.log`);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, '', 'utf8');
  const url = `http://${host}:${port}/`;
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  let stopping = false;
  let spawnCount = 0;

  async function spawnOnce() {
    await freeListenPort(port);
    spawnCount += 1;
    const logFd = fs.openSync(logFile, 'a');
    const phpWorkers = Math.max(1, Number(process.env.WDP_PHP_SERVER_WORKERS || 2) || 2);
    const proc = spawn('php', ['-S', `${host}:${port}`, '-t', wpDir, path.join(wpDir, 'router.php')], {
      cwd: wpDir,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, PHP_CLI_SERVER_WORKERS: String(phpWorkers) },
    });
    fs.closeSync(logFd);
    child = proc;
    proc.on('exit', (code, sig) => {
      if (stopping) return;
      console.error(`[e2e] PHP ${port} çıktı kod=${code} sig=${sig} — yeniden başlat`);
      spawnOnce().catch((e) => {
        console.error(`[e2e:catch-fail] PHP restart: ${e && e.message ? e.message : e}`);
      });
    });
    await waitHttp(url);
    if (proc.exitCode != null) {
      throw new Error(`PHP sunucu çıktı (kod ${proc.exitCode})`);
    }
  }

  await spawnOnce();

  return {
    get child() {
      return child;
    },
    url,
    port,
    wpDir,
    spawnCount: () => spawnCount,
    async stop() {
      stopping = true;
      const proc = child;
      if (!proc || proc.exitCode != null) {
        await freeListenPort(port, 3000);
        return;
      }
      proc.kill('SIGTERM');
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          if (proc.exitCode == null) proc.kill('SIGKILL');
          resolve();
        }, 3000);
        proc.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
      await freeListenPort(port, 3000);
    },
  };
}

/**
 * e2e:full --env local: TT5 matris WP + fixture ürünleri + PHP 8899.
 * @param {number} [port]
 */
export async function prepareLocalFullStack(port = 8899) {
  const { loadMatrix, resolveConfig } = await import('./matrix-cover.mjs');
  const matrix = loadMatrix();
  const resolved = resolveConfig(matrix, 'tt5-try-blocks-hpos');
  const { snap } = prepareConfigSnapshot(resolved);
  const wpDir = materializeWorker(resolved.id, port, snap, { hpos: !!resolved.hpos });
  process.env.WDP_LOCAL_WP_DIR = wpDir;
  process.env.WDP_E2E_PUBLISH_FIXTURES = '1';
  const admin = matrixEval(wpDir, ['ensure-admin']);
  if (!admin.ok) {
    throw new Error(`local admin: ${admin.error || JSON.stringify(admin).slice(0, 200)}`);
  }
  const phpFile = path.join(ROOT, 'tests/local-wp/bootstrap-fixtures.php');
  const r = spawnSync('php', [phpFile, 'upsert', 'local', 'fixture'], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, WDP_LOCAL_WP_DIR: wpDir, WDP_E2E_PUBLISH_FIXTURES: '1' },
    timeout: 120000,
  });
  if (r.status !== 0) {
    throw new Error(`local fixtures: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  const data = parseJsonLine(r.stdout);
  const prepared = matrixEval(wpDir, ['prepare-full']);
  if (!prepared.ok) {
    throw new Error(`local prepare-full: ${prepared.error || JSON.stringify(prepared).slice(0, 300)}`);
  }
  if (prepared.roles && typeof prepared.roles === 'object') {
    data.roles = { ...(data.roles || {}), ...prepared.roles };
    for (const [role, row] of Object.entries(data.roles)) {
      if (!row || typeof row !== 'object') continue;
      data.roles[role] = {
        ...row,
        mark: row.mark || data.runId || 'fixture',
        published: true,
        catalogVisible: true,
        status: 'publish',
      };
    }
  }
  data.pages = prepared.pages || {};
  data.published = true;
  const outFile = path.join(ROOT, 'build/e2e', 'fixtures-local.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n');
  const server = await startPhpServer({ wpDir, port, host: '127.0.0.1' });
  return { server, wpDir, fixtures: data };
}

/**
 * WC 11 koşu sırasında HPOS seçeneğini evet yapabiliyor; matris beklenen değeri kilitler.
 * @param {string} wpDir
 * @param {boolean} hposOn
 */
function writeHposLock(wpDir, hposOn) {
  const dir = path.join(wpDir, 'wp-content/mu-plugins');
  fs.mkdirSync(dir, { recursive: true });
  const val = hposOn ? 'yes' : 'no';
  fs.writeFileSync(
    path.join(dir, 'wdp-matrix-hpos-lock.php'),
    `<?php\nadd_filter('pre_option_woocommerce_custom_orders_table_enabled', static function () { return '${val}'; });\n`
  );
}

/**
 * Yerel WP locale kilidi (dil paketi yok). RTL için text_direction mu-plugin.
 * @param {string} wpDir
 * @param {string} locale
 */
export function applyMatrixLocale(wpDir, locale) {
  const evalFile = path.join(ROOT, 'tests/local-wp/eval-file.php');
  const loc = String(locale || 'tr_TR');
  const r = spawnSync(
    'php',
    ['-d', 'memory_limit=1024M', evalFile, path.join(ROOT, 'tests/local-wp/i18n-locale.php'), loc],
    {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, WDP_LOCAL_WP_DIR: wpDir },
      timeout: 60000,
    }
  );
  if (r.status !== 0) {
    throw new Error(`locale ${loc}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  return parseJsonLine(r.stdout);
}

/**
 * @param {string} configId
 * @param {number} port
 * @param {string} snapshotFile
 * @param {{ hpos?: boolean }} [opts]
 */
export function materializeWorker(configId, port, snapshotFile, opts = {}) {
  const templateWp = path.join(TEMPLATE_ROOT, 'wordpress');
  const destRoot = path.join(WORKER_DIR, `${configId}-${port}`);
  const destWp = path.join(destRoot, 'wordpress');
  cloneDir(templateWp, destWp);
  restoreSqlite(destWp, snapshotFile);
  writeWpConfig(destWp, { homeUrl: `http://127.0.0.1:${port}` });
  copyRouter(destWp);
  if (typeof opts.hpos === 'boolean') {
    writeHposLock(destWp, opts.hpos);
  }
  return destWp;
}
