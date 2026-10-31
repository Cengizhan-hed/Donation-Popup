/**
 * Yerel matris: tema/WC indirme, anlık görüntü, PHP sunucu, işçi kopyası.
 * Uzak site yok. İndirme yalnız downloads.wordpress.org / wordpress.org.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT } from './env-root.mjs';
import { withFileLockSync } from './file-lock.mjs';
import { listenPids, reservePort, stopOwnListener } from './port-reserve.mjs';
import { killTree, registerServerCleanup } from './server-cleanup.mjs';
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
    'src',
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

export function ensureTheme(wpDir, slug) {
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
  return withFileLockSync(path.join(MATRIX_DIR, '_template.lock'), ensureMatrixTemplateLocked, {
    label: 'matris şablonu kurulumu',
  });
}

function ensureMatrixTemplateLocked() {
  seedZipCache();
  seedSiblingSnapshots();
  const wpDir = ensureLocalWp({ root: TEMPLATE_ROOT, quiet: true });
  ensureWooCommerce(wpDir);
  ensureTheme(wpDir, 'twentytwentyfive');
  ensureTheme(wpDir, 'storefront');
  ensureTheme(wpDir, 'blocksy');
  ensureTheme(wpDir, 'hello-elementor');
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

export { listenPids };

/**
 * Port boşalana dek bekler; HİÇBİR süreci kapatmaz (başkasının sunucusuna dokunulmaz).
 * @param {number} port
 * @param {number} [timeoutMs]
 */
export async function waitPortFree(port, timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (!listenPids(port).length) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  const pids = listenPids(port);
  if (pids.length) {
    throw new Error(`port ${port} hâlâ dinleniyor (PID ${pids.join(',')}); başka koşunun olabilir, kapatılmadı. Boş bir WDP_LOCAL_E2E_PORT seçin.`);
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
  // Port rezervasyonu: başka koşuya ait portta başlamaz, başkasının sunucusunu KAPATMAZ.
  const reservation = reservePort(port);
  if (!reservation.ok) {
    throw new Error(`${reservation.reason}. Boş bir port seçin (WDP_LOCAL_E2E_PORT / WDP_MATRIX_BASE_PORT).`);
  }
  const logFile = path.join(MATRIX_DIR, `php-${port}.log`);
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, '', 'utf8');
  const url = `http://${host}:${port}/`;
  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  let stopping = false;
  let spawnCount = 0;

  async function spawnOnce() {
    await waitPortFree(port);
    spawnCount += 1;
    const logFd = fs.openSync(logFile, 'a');
    const phpWorkers = Math.max(1, Number(process.env.WDP_PHP_SERVER_WORKERS || 2) || 2);
    const proc = spawn('php', ['-S', `${host}:${port}`, '-t', wpDir, path.join(wpDir, 'router.php')], {
      cwd: wpDir,
      stdio: ['ignore', logFd, logFd],
      detached: true, // kendi süreç grubu: işçi süreçleri de tek hamlede kapanır
      env: { ...process.env, PHP_CLI_SERVER_WORKERS: String(phpWorkers) },
    });
    fs.closeSync(logFd);
    child = proc;
    reservation.setChild(proc.pid ?? null);
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

  const unregister = registerServerCleanup({
    pid: () => (child && child.exitCode == null ? child.pid : null),
    release: () => reservation.release(),
  });

  try {
    await spawnOnce();
  } catch (e) {
    stopping = true;
    unregister();
    if (child && child.exitCode == null) await stopOwnListener(port, child.pid).catch(() => {});
    reservation.release();
    throw e;
  }

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
      unregister();
      const proc = child;
      if (!proc || proc.exitCode != null) {
        reservation.release();
        return;
      }
      // Yalnız KENDİ çocuk sürecimiz (ve süreç grubu) kapatılır.
      killTree(proc.pid, 'SIGTERM');
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          if (proc.exitCode == null) killTree(proc.pid, 'SIGKILL');
          resolve();
        }, 3000);
        proc.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
      reservation.release();
    },
  };
}

/** Woo'nun ilk isteklerde kendiliğinden yazdığı seçenekleri tetikleyen ön yüz yolları (yerel). */
export const WOO_WARMUP_FRONT = ['/', '/?post_type=product', '/cart/', '/checkout/', '/my-account/', '/wp-json/wc/store/v1/cart'];
/** İlk yönetici yüklemesi (admin_init: e-posta iyileştirmeleri göçü, ödeme sırası, özellik bayrakları) ve ayar ekranı. */
export const WOO_WARMUP_ADMIN = ['index.php', 'admin.php?page=wc-settings'];

/**
 * Yalnız YEREL: taze yerel WP'de WooCommerce kendi seçeneklerini ilk ön yüz/yönetici isteklerinde oluşturur
 * (ör. `woocommerce_checkout_*_field`, `woocommerce_email_*`, `woocommerce_gateway_order`, `woocommerce_share_key`).
 * Kanarya "önce" görüntüsü bu isteklerden ÖNCE alınırsa koşu sonunda bu anahtarlar eklentiye ait olmayan fark olarak
 * KIRMIZI çıkar (v122-fouc e2e:full 6 hata). Çözüm: kanarya tabanı, yerel WP hazırlanıp Woo'nun ilk istekleri yapıldıktan
 * SONRA alınır. Uzak ortamda çağrılmaz; uzak kanarya koruması değişmez.
 *
 * @param {string} base `http://127.0.0.1:PORT` ya da `http://localhost:PORT`.
 * @return {Promise<{front: number, admin: number, login: number}>} İstek sayıları ve giriş durumu.
 */
export async function warmUpWooFirstRequests(base) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(String(base))) {
    throw new Error(`warmUpWooFirstRequests yalnız yerel adreste çalışır: ${base}`);
  }
  const jar = new Map([['wordpress_test_cookie', 'WP%20Cookie%20check']]);
  const keep = (r) => {
    const list = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
    for (const c of list) {
      const kv = c.split(';')[0];
      const i = kv.indexOf('=');
      if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const get = async (url, withCookie) => {
    const r = await fetch(url, { redirect: 'manual', headers: withCookie ? { cookie: cookie() } : {}, signal: AbortSignal.timeout(120000) });
    keep(r);
    await r.arrayBuffer();
    return r.status;
  };
  let front = 0;
  for (const p of WOO_WARMUP_FRONT) {
    await get(base + p, false);
    front += 1;
  }
  // Yerel yönetici (matrix-ops ensure-admin: admin/admin; yalnız yerel tek kullanımlık WP).
  const login = await fetch(`${base}/wp-login.php`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie() },
    body: 'log=admin&pwd=admin&wp-submit=Log+In&testcookie=1&redirect_to=%2Fwp-admin%2F',
    signal: AbortSignal.timeout(120000),
  });
  keep(login);
  await login.arrayBuffer();
  let admin = 0;
  if (login.status === 302) {
    for (const p of WOO_WARMUP_ADMIN) {
      await get(`${base}/wp-admin/${p}`, true);
      admin += 1;
    }
  }
  return { front, admin, login: login.status };
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
  // Kanarya "önce" görüntüsünden önce Woo'nun ilk istek yazımları biter (yerel yanlış KIRMIZI yok).
  const warm = await warmUpWooFirstRequests(`http://127.0.0.1:${port}`);
  // Her cihaz koşusu (checkout-setup) çevrimdışı yöntemleri açar ve `woocommerce_gateway_order`'a yazar; bu yazım
  // kanarya "önce" görüntüsünden sonra olursa ilk koşuda fark çıkar. Aynı idempotent işlem burada bir kez yapılır,
  // ardından Woo'nun sıralamayı normalleştirmesi için yönetici ısınması tekrarlanır (sonraki çağrılar değer değiştirmez).
  const gw = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gw && gw.ok === false) throw new Error(`local enable-offline-gateways: ${gw.error || ''}`);
  const warm2 = await warmUpWooFirstRequests(`http://127.0.0.1:${port}`);
  console.log(`[e2e] Woo ilk istekleri (yerel ısınma): ön yüz ${warm.front}+${warm2.front}, yönetici ${warm.admin}+${warm2.admin} (giriş ${warm.login}); çevrimdışı ödeme yöntemleri önceden açık`);
  return { server, wpDir, fixtures: data };
}

/**
 * WC 11 koşu sırasında HPOS seçeneğini evet yapabiliyor; matris beklenen değeri kilitler.
 * @param {string} wpDir
 * @param {boolean} hposOn
 */
function writeLocaleLock(wpDir, locale) {
  const loc = /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(String(locale)) ? String(locale) : 'tr_TR';
  const dir = path.join(wpDir, 'wp-content/mu-plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'wdp-i18n-locale.php'),
    `<?php\n/** WDP test locale lock — no language pack. */\n` +
      `add_filter('locale', static function () { return '${loc}'; }, 99);\n` +
      `add_filter('determine_locale', static function () { return '${loc}'; }, 99);\n` +
      `add_filter('plugin_locale', static function ($l, $d) { unset($l, $d); return '${loc}'; }, 99, 2);\n`
  );
}

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
  // Yerel profil dili (varsayılan tr_TR = Hedef eşdeğeri): çeviri paketi yok, yalnız eklenti metinleri; mu-plugin kilidi.
  writeLocaleLock(destWp, opts.locale || process.env.WDP_LOCAL_WP_LOCALE || 'tr_TR');
  ensureWcPlaceholderUploads(destWp);
  return destWp;
}

/**
 * WooCommerce 11 ürün yer tutucu görselini uploads altında üretilmiş dosya olarak bekler; taze (worktree) WP'de bu
 * dosyalar yok → kırık görsel, sayfa yüksekliği ve ekran farkı. Eklenti dosyasından deterministik kopya (görsel fixture).
 * @param {string} wpDir
 */
function ensureWcPlaceholderUploads(wpDir) {
  const imgDir = path.join(wpDir, 'wp-content/plugins/woocommerce/assets/images');
  const src = ['placeholder.webp', 'placeholder.png']
    .map((n) => path.join(imgDir, n))
    .find((f) => fs.existsSync(f));
  if (!src) return;
  const ext = path.extname(src);
  const uploads = path.join(wpDir, 'wp-content/uploads');
  fs.mkdirSync(uploads, { recursive: true });
  // WC üretilmiş dosyaları kare ve bu boyutlarda: 1200 (orijinal), 1024, 768, 300, 150. PHP GD ile ölçekle (yoksa kopya).
  const sizes = { '': 1200, '-1024x1024': 1024, '-768x768': 768, '-300x300': 300, '-150x150': 150 };
  for (const [suffix, px] of Object.entries(sizes)) {
    const dest = path.join(uploads, `woocommerce-placeholder${suffix}${ext}`);
    if (fs.existsSync(dest)) continue;
    const gd = ext === '.webp'
      ? spawnSync(
          'php',
          [
            '-r',
            'if(!function_exists("imagecreatefromwebp"))exit(2);$i=imagecreatefromwebp($argv[1]);if(!$i)exit(3);' +
              '$n=(int)$argv[3];$o=imagecreatetruecolor($n,$n);imagealphablending($o,false);imagesavealpha($o,true);' +
              'if(!imagecopyresampled($o,$i,0,0,0,0,$n,$n,imagesx($i),imagesy($i)))exit(4);if(!imagewebp($o,$argv[2],82))exit(5);',
            src,
            dest,
            String(px),
          ],
          { encoding: 'utf8' }
        )
      : { status: 1 };
    if (gd.status !== 0 || !fs.existsSync(dest)) fs.copyFileSync(src, dest);
  }
}
