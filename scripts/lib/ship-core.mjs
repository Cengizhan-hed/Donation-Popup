#!/usr/bin/env node
/**
 * Ortak güvenli kurulum zinciri (staging + ikram). Ortam farkı yalnız profilden.
 *
 * ön koşullar → ön anlık görüntü → yedek → rsync → sağlık → kırmızıysa otomatik
 * geri dönüş → son anlık görüntü + compare → kanarya.
 *
 * Uzak yazma spawnGuarded üzerinden. Cursor çalıştırmaz; birim test spawnImpl.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT } from '../../tests/e2e/helpers/env-root.mjs';
import {
  findTargetByAlias,
  parsePluginVersion,
  validateRemoteSiteUrl,
  wpPathFlag,
  shellQuoteWpPath,
  buildGuardedEvalFileCommand,
  IKRAM_ALLOW_REMOVAL_NOTE,
  MIGRATE_EVAL_PHP,
  CACHE_BUMP_EVAL_PHP,
} from './deploy-guards.mjs';
import { assertRemoteAllowed, spawnGuarded, isRemoteRsync } from './remote-guard.mjs';
import { rsyncExcludeArgs } from './pack-excludes.mjs';
import { normalizeRemotePluginDir, IKRAM_WP_SLUG } from './ikram-wp-guard.mjs';
import { blockedActivePlugins } from './remote-discover-lib.mjs';
import { loadProfile, resolveAllowedRemoteTarget, setActiveProfile } from '../../tests/e2e/helpers/profile.mjs';
import { runSnapshot } from '../migration-snapshot.mjs';
import { runCompare } from '../migration-compare.mjs';
import { evaluateCanaryHealth, snapshotCanary } from '../../tests/e2e/helpers/canary.mjs';
import { loadRegistry } from '../../tests/e2e/helpers/run-registry.mjs';
import { acquireEnvLock, releaseEnvLock } from '../../tests/e2e/helpers/env-lock.mjs';
import { loadFixtures } from '../../tests/e2e/helpers/fixtures.mjs';
import {
  classifyLogLines,
  logVerdict,
  attributePages,
  browseMetricsFromResponse,
  compareToBaseline,
  formatOnOffLine,
  pagesTriggerRollback,
  writeRollbackNotice,
} from './health-attribution.mjs';
import { phpEvalFile, ensureLocalWp, writeWpConfig, LOCAL_WP_ROOT } from '../local-wp.mjs';

export const PLUGIN_SLUG = IKRAM_WP_SLUG;
export const SHIP_DIR = path.join(ROOT, 'build/ship');
export const MIGRATION_DIR = path.join(ROOT, 'build/migration');

export const HEALTH_PHP = 'scripts/lib/ship-health.php';
export const URL_PROBE_PHP = 'scripts/lib/ship-url-probe.php';
export const BACKUP_OPTIONS_PHP = 'scripts/lib/ship-backup-options.php';
export const RESTORE_OPTIONS_PHP = 'scripts/lib/ship-restore-options.php';
export const AUTH_COOKIE_PHP = 'scripts/lib/ship-auth-cookie.php';

export const FATAL_HTML_RE = /There has been a critical error|Fatal error|Kritik bir hata/i;
export const WDP_MARKER_RE = /\bwdp-/i;

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_COMPARE = 2;
export const EXIT_BLOCKED = 3;

/** Geri dönüş komut sırası (sağlık kırmızı). */
export const ROLLBACK_STEPS = Object.freeze(['restore-zip', 'restore-options', 'cache-flush', 'health']);

export const PLAN_STEPS = Object.freeze([
  'verify+test+pack',
  'kanarya TEMİZ',
  'REMOTE-BLOCKED kontrolü',
  'ön anlık görüntü',
  'yedek zip + wdp_* JSON',
  'rsync kurulum',
  'etkinleştir + göç + önbellek',
  'sağlık kontrolü',
  'kırmızıysa otomatik geri dönüş',
  'son anlık görüntü + compare',
  'kanarya (sonra)',
]);

const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new'];

/**
 * @param {string[]} argv
 */
export function parseShipArgs(argv = []) {
  const a = argv.filter((x) => x !== '--');
  const out = { dryRun: false, rollback: false, envName: '' };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--dry-run') out.dryRun = true;
    else if (x === '--rollback') out.rollback = true;
    else if (x === '--env') out.envName = String(a[++i] || '');
    else if (x.startsWith('--env=')) out.envName = x.slice('--env='.length);
  }
  return out;
}

/**
 * @param {Date} [d]
 */
export function shipStamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, '-');
}

/**
 * @param {string} envName
 * @param {string} stamp
 */
export function defaultReportPath(envName, stamp) {
  const env = String(envName || 'env').replace(/[^a-z0-9_-]/gi, '');
  return path.join(SHIP_DIR, `${env}-${stamp}.md`);
}

/**
 * @param {string} envName
 * @param {'pre'|'post'} kind
 * @param {string} version
 * @param {string} stamp
 */
export function snapshotOutPath(envName, kind, version, stamp) {
  const env = String(envName || 'env').replace(/[^a-z0-9_-]/gi, '');
  const ver = String(version || '0').replace(/[^0-9.]/g, '');
  return path.join(MIGRATION_DIR, `${env}-${kind}-${ver}-${stamp}.json`);
}

/**
 * @param {string} cmd
 */
export function isRemoteWriteCommand(cmd) {
  const s = String(cmd || '');
  if (!s.trim()) return false;
  if (/\b(mkdir|rm\b|unzip|zip\s+-|rsync|scp)\b/.test(s)) return true;
  if (/\bplugin\s+(install|activate|deactivate|update)\b/.test(s)) return true;
  if (/\boption\s+(update|delete|add|patch)\b/.test(s)) return true;
  if (/ship-restore-options|ship-backup-options/.test(s)) return true;
  if (/WDP_Migrations::maybe_run|Version_Migrations|\$vm::maybe_run/.test(s)) return true;
  if (/\bsg purge\b|\bcache flush\b/.test(s)) return true;
  if (/file_put_contents|update_option/.test(s)) return true;
  return false;
}

/**
 * @param {string} bin
 * @param {string[]} args
 */
export function isRemoteWriteInvocation(bin, args) {
  const base = path.basename(String(bin || ''));
  const list = Array.isArray(args) ? args.map(String) : [];
  if (base === 'scp' || base === 'sftp') return true;
  if (base === 'rsync') {
    if (list.includes('-n') || list.includes('--dry-run')) return false;
    return isRemoteRsync(list);
  }
  if (base === 'ssh') {
    const remoteCmd = list.length ? list[list.length - 1] : '';
    return isRemoteWriteCommand(remoteCmd);
  }
  return false;
}

/**
 * @param {unknown} plugins
 * @returns {string[]}
 */
export function blockedShipPlugins(plugins) {
  const list = (Array.isArray(plugins) ? plugins : []).map((p) => ({
    slug: String(p?.slug || p?.name || ''),
    name: String(p?.name || p?.slug || ''),
    status: String(p?.status || ''),
  }));
  return blockedActivePlugins(list);
}

/**
 * @param {unknown} plugins
 */
export function assertDiscoverNotBlocked(plugins) {
  const blocked = blockedShipPlugins(plugins);
  if (blocked.length) {
    const err = new Error(`REMOTE-BLOCKED: ${blocked.join(', ')} aktif`);
    err.exitCode = EXIT_BLOCKED;
    err.blocked = blocked;
    throw err;
  }
  return blocked;
}

/**
 * @param {{ php_ok?: number, active?: number, version?: string, needs_run?: number }} payload
 * @param {string} expectedVersion
 */
export function evaluatePhpHealth(payload, expectedVersion, opts = {}) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const reasons = [];
  // Günlük: yalnız koşu başlangıcından sonrası; bizden/bilinmeyen fatal kırmızı, üçüncü taraf yalnız bilgi.
  const logClass = classifyLogLines(Array.isArray(p.log_lines) ? p.log_lines : [], {
    sinceEpoch: opts.sinceEpoch || 0,
  });
  const verdict = logVerdict(logClass);
  reasons.push(...verdict.reasons);
  if (Number(p.php_ok) !== 1) reasons.push('php_ok değil');
  if (Number(p.active) !== 1) reasons.push('eklenti pasif');
  const got = String(p.version || '');
  const want = String(expectedVersion || '');
  if (want && got !== want) reasons.push(`sürüm ${got || 'yok'} ≠ ${want}`);
  if (Number(p.needs_run) !== 0) reasons.push('needs_run');
  return { ok: reasons.length === 0, reasons, payload: p, logClass, thirdParty: verdict.thirdParty };
}

/**
 * @param {string} name
 * @param {{ status?: number, text?: string }} res
 * @param {{ requireMarker?: boolean, allowSkip?: boolean }} [opts]
 */
export function evaluateHttpPage(name, res, opts = {}) {
  if (!res) {
    if (opts.allowSkip) return { name, ok: true, skipped: true, reason: 'yok' };
    return { name, ok: false, skipped: false, reason: 'yanıt yok' };
  }
  if (res.skipped) {
    return { name, ok: true, skipped: true, reason: String(res.reason || 'atlandı') };
  }
  const status = Number(res.status || 0);
  const text = String(res.text || '');
  if (status !== 200) {
    return { name, ok: false, skipped: false, reason: `HTTP ${status || 'yok'}` };
  }
  if (FATAL_HTML_RE.test(text)) {
    return { name, ok: false, skipped: false, reason: 'critical/fatal' };
  }
  if (opts.requireMarker && !WDP_MARKER_RE.test(text)) {
    return { name, ok: false, skipped: false, reason: 'wdp- yok' };
  }
  return { name, ok: true, skipped: false, reason: '200' };
}

/**
 * @param {{ php?: { ok: boolean, reasons?: string[] }, pages?: Array<{ name: string, ok: boolean, skipped?: boolean, reason?: string }> }} health
 */
export function formatHealthLine(health) {
  const php = health?.php;
  const pages = Array.isArray(health?.pages) ? health.pages : [];
  const phpBit = php?.ok ? 'php=ok' : `php=KIRMIZI(${(php?.reasons || []).join(',')})`;
  const bits = pages.map((p) => {
    if (p.skipped) return `${p.name}=atlandı`;
    if (p.thirdParty) return `${p.name}=${p.reason || 'üçüncü taraf'}`;
    return `${p.name}=${p.ok ? '200' : p.reason || 'KIRMIZI'}`;
  });
  const red = (php && !php.ok) || pagesTriggerRollback(pages);
  const tp = php?.thirdParty ? ` üçüncü-taraf-php=${php.thirdParty.count}(${php.thirdParty.owners.join('|')})` : '';
  const checked = pages.filter((p) => !p.skipped);
  const pass = checked.filter((p) => p.ok).length;
  const tag = red ? 'KIRMIZI' : 'YEŞİL';
  const tpPages = pages.filter((p) => p.thirdParty).length;
  const tpBit = tpPages ? ` üçüncü-taraf-sayfa=${tpPages}` : '';
  return `Sağlık: ${tag} ${phpBit} http=${bits.join(',') || 'yok'} (${pass}/${checked.length})${tp}${tpBit}`;
}

/**
 * @param {{ php: { ok: boolean }, pages: Array<{ ok: boolean, skipped?: boolean }> }} health
 */
export function healthIsRed(health) {
  if (!health?.php?.ok) return true;
  return pagesTriggerRollback(health.pages || []);
}

function fail(msg, code = EXIT_FAIL) {
  const err = new Error(msg);
  err.exitCode = code;
  throw err;
}

function extractJson(text) {
  const raw = String(text || '');
  const obj = raw.indexOf('{');
  const arr = raw.indexOf('[');
  let start = -1;
  let endChar = '}';
  if (obj >= 0 && (arr < 0 || obj < arr)) {
    start = obj;
    endChar = '}';
  } else if (arr >= 0) {
    start = arr;
    endChar = ']';
  }
  if (start < 0) return null;
  const end = raw.lastIndexOf(endChar);
  if (end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function readPluginVersion() {
  const src = fs.readFileSync(path.join(ROOT, 'woo-donation-popup.php'), 'utf8');
  return parsePluginVersion(src);
}

function phpB64(rel) {
  const abs = path.join(ROOT, rel);
  return fs.readFileSync(abs).toString('base64');
}

/**
 * @param {object} target
 * @param {string} wpPath
 */
export function shipPaths(target, wpPath) {
  const listed = target || {};
  const siteRoot = String(listed.allowedRoot || '').replace(/\/$/, '');
  const backupRoot = `${siteRoot}/wdp-backups`;
  const pluginDir = `${String(wpPath || listed.wpPath).replace(/\/$/, '')}/wp-content/plugins/${PLUGIN_SLUG}`;
  return { siteRoot, backupRoot, pluginDir };
}

/**
 * @param {string} wpPath
 * @param {string} extraQuoted
 */
export function buildEvalFileCmd(wpPath, relPhp, extraQuoted = '') {
  const extra = extraQuoted ? ` ${extraQuoted}` : '';
  return buildGuardedEvalFileCommand(wpPath, {
    tmpPrefix: 'wdp-ship',
    b64: phpB64(relPhp),
    extraArgs: extra.trim(),
  });
}

/**
 * @param {{ backupRoot: string, pluginDir: string, backupZip: string }} p
 */
export function buildBackupZipCommand(p) {
  const qDir = shellQuoteWpPath(p.pluginDir);
  const qZip = shellQuoteWpPath(p.backupZip);
  const qRoot = shellQuoteWpPath(p.backupRoot);
  return [
    `# wdp-ship:backup-zip`,
    `mkdir -p ${qRoot}`,
    `PLUGIN_DIR=${qDir}`,
    `if [ -d "$PLUGIN_DIR" ]; then`,
    `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr ${qZip} "$(basename "$PLUGIN_DIR")")`,
    `  ls -1t ${qRoot} 2>/dev/null | tail -n +4 | while read -r f; do rm -f ${qRoot}/"$f"; done`,
    `fi`,
  ].join('\n');
}

/**
 * @param {string} wpPath
 * @param {string} optionsJsonPath
 */
export function buildBackupOptionsCommand(wpPath, optionsJsonPath) {
  return `# wdp-ship:backup-options\n${buildEvalFileCmd(wpPath, BACKUP_OPTIONS_PHP, shellQuoteWpPath(optionsJsonPath))}`;
}

/**
 * @param {{ pluginDir: string, backupZip: string }} p
 */
export function buildRestoreZipCommand(p) {
  const qDir = shellQuoteWpPath(p.pluginDir);
  const qZip = shellQuoteWpPath(p.backupZip);
  return [
    `# wdp-ship:restore-zip`,
    `PLUGIN_DIR=${qDir}`,
    `ZIP=${qZip}`,
    `if [ ! -f "$ZIP" ]; then echo "yedek zip yok"; exit 1; fi`,
    `mkdir -p "$(dirname "$PLUGIN_DIR")"`,
    `rm -rf "$PLUGIN_DIR"`,
    `unzip -qo "$ZIP" -d "$(dirname "$PLUGIN_DIR")"`,
  ].join('\n');
}

/**
 * @param {string} wpPath
 * @param {string} optionsJsonPath
 */
export function buildRestoreOptionsCommand(wpPath, optionsJsonPath) {
  return `# wdp-ship:restore-options\n${buildEvalFileCmd(wpPath, RESTORE_OPTIONS_PHP, shellQuoteWpPath(optionsJsonPath))}`;
}

/**
 * @param {string} wpPath
 */
export function buildCacheFlushCommand(wpPath) {
  const flag = wpPathFlag(wpPath);
  return `# wdp-ship:cache-flush\n(wp sg purge ${flag} 2>/dev/null || true; wp cache flush ${flag} 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } ${CACHE_BUMP_EVAL_PHP}' ${flag})`;
}

/**
 * @param {string} wpPath
 */
export function buildActivateMigrateCommand(wpPath) {
  const flag = wpPathFlag(wpPath);
  return [
    `# wdp-ship:activate-migrate`,
    `wp plugin activate ${PLUGIN_SLUG} ${flag}`,
    `wp eval '${MIGRATE_EVAL_PHP}' ${flag}`,
  ].join('\n');
}

/**
 * @param {string} wpPath
 */
export function buildHealthPhpCommand(wpPath) {
  return `# wdp-ship:health-php\n${buildEvalFileCmd(wpPath, HEALTH_PHP)}`;
}

/**
 * @param {string} wpPath
 */
export function buildUrlProbeCommand(wpPath) {
  return `# wdp-ship:url-probe\n${buildEvalFileCmd(wpPath, URL_PROBE_PHP)}`;
}

/**
 * @param {string} wpPath
 */
export function buildAuthCookieCommand(wpPath) {
  return `# wdp-ship:auth-cookie\n${buildEvalFileCmd(wpPath, AUTH_COOKIE_PHP)}`;
}

/**
 * @param {{ backupZip: string, optionsJson: string, pluginDir: string, wpPath: string }} ctx
 */
export function buildRollbackCommands(ctx) {
  return [
    { step: 'restore-zip', cmd: buildRestoreZipCommand(ctx) },
    { step: 'restore-options', cmd: buildRestoreOptionsCommand(ctx.wpPath, ctx.optionsJson) },
    { step: 'cache-flush', cmd: buildCacheFlushCommand(ctx.wpPath) },
    { step: 'health', cmd: buildHealthPhpCommand(ctx.wpPath) },
  ];
}

function cookieHeaderFromAuth(data) {
  if (!data || Number(data.ok) !== 1 || !data.logged_in_name || !data.logged_in) return '';
  const parts = [`${data.logged_in_name}=${data.logged_in}`];
  if (data.auth_name && data.auth) parts.push(`${data.auth_name}=${data.auth}`);
  return parts.join('; ');
}

/**
 * @param {object} probe
 */
export function collectHttpTargets(probe) {
  const p = probe && typeof probe === 'object' ? probe : {};
  return [
    { name: 'home', url: String(p.home || ''), requireMarker: false, allowSkip: false },
    { name: 'shop', url: String(p.shop || ''), requireMarker: false, allowSkip: true },
    { name: 'product', url: String(p.product || ''), requireMarker: true, allowSkip: true },
    {
      name: 'plugin',
      url: String(p.plugin_page || ''),
      requireMarker: true,
      allowSkip: true,
      skipReason: Number(p.plugin_skipped) === 1 ? 'kısa kod/blok sayfası yok' : '',
    },
    { name: 'admin', url: String(p.admin || ''), requireMarker: false, allowSkip: false, cookie: true },
  ];
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: Function, cookieHeader?: string, timeoutMs?: number }} [opts]
 */
export async function fetchHtml(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch yok');
  }
  const headers = { 'User-Agent': 'WDP-ship-health/1.0', Accept: 'text/html' };
  if (opts.cookieHeader) headers.Cookie = opts.cookieHeader;
  const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(opts.timeoutMs || 20000)
    : undefined;
  const res = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    headers,
    signal: ctrl,
  });
  const text = await res.text();
  return { status: res.status, text };
}

/**
 * @param {{ targets: ReturnType<typeof collectHttpTargets>, fetchImpl?: Function, cookieHeader?: string }} opts
 */
export async function runHttpHealthChecks(opts) {
  const pages = [];
  for (const t of opts.targets || []) {
    if (!t.url) {
      pages.push({
        name: t.name,
        ok: !!t.allowSkip,
        skipped: true,
        reason: t.skipReason || `${t.name} yok`,
      });
      continue;
    }
    let res;
    try {
      res = await fetchHtml(t.url, {
        fetchImpl: opts.fetchImpl,
        cookieHeader: opts.cookieHeader || '',
      });
    } catch (e) {
      pages.push({
        name: t.name,
        ok: false,
        skipped: false,
        reason: `istek hata: ${e && e.message ? e.message : e}`.slice(0, 80),
      });
      continue;
    }
    pages.push(evaluateHttpPage(t.name, res, { requireMarker: !!t.requireMarker, allowSkip: !!t.allowSkip }));
  }
  return pages;
}

function sshTransport() {
  return `ssh ${SSH_OPTS.join(' ')}`;
}

function createCtx(opts) {
  const calls = [];
  const spawnImpl = (bin, args, spawnOpts) => {
    const rec = { bin: path.basename(String(bin)), args: (args || []).map(String) };
    rec.write = isRemoteWriteInvocation(rec.bin, rec.args);
    calls.push(rec);
    if (typeof opts.spawnImpl === 'function') {
      return opts.spawnImpl(bin, args, spawnOpts, rec);
    }
    return spawnSync(bin, args, spawnOpts);
  };
  return { calls, spawnImpl, guardEnv: opts.guardEnv || process.env, freezePath: opts.freezePath, baselineRedNames: opts.baselineRedNames || [] };
}

function remote(ctx, resolved, remoteCmd, spawnOpts = {}) {
  const res = spawnGuarded(
    'ssh',
    [...SSH_OPTS, resolved.alias, remoteCmd],
    { encoding: 'utf8', cwd: ROOT, timeout: 120000, ...spawnOpts },
    {
      alias: resolved.alias,
      siteUrl: resolved.siteUrl,
      wpPath: resolved.wpPath,
      spawnImpl: ctx.spawnImpl,
      env: ctx.guardEnv,
      freezePath: ctx.freezePath,
    }
  );
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 400);
    fail(`ssh başarısız${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

function rsyncTo(ctx, resolved, localDir, remoteDir, dry) {
  const src = `${String(localDir).replace(/\/$/, '')}/`;
  const dest = `${resolved.alias}:${String(remoteDir).replace(/\/$/, '')}/`;
  const args = ['-az', '--delete', ...rsyncExcludeArgs(ROOT), '-e', sshTransport()];
  if (dry) args.unshift('-n', '--itemize-changes');
  args.push(src, dest);
  const res = spawnGuarded(
    'rsync',
    args,
    { encoding: 'utf8', cwd: ROOT, timeout: 180000, stdio: dry ? 'pipe' : 'inherit' },
    {
      alias: resolved.alias,
      siteUrl: resolved.siteUrl,
      wpPath: resolved.wpPath,
      spawnImpl: ctx.spawnImpl,
      env: ctx.guardEnv,
      freezePath: ctx.freezePath,
    }
  );
  if (res.status !== 0) {
    fail(`rsync başarısız: ${(res.stderr || res.stdout || '').trim().slice(0, 300)}`);
  }
  return (res.stdout || '').trim();
}

function runLocal(ctx, cmd, args, inherit = true) {
  const res = spawnGuarded(
    cmd,
    args,
    { encoding: 'utf8', cwd: ROOT, stdio: inherit ? 'inherit' : 'pipe' },
    { spawnImpl: ctx.spawnImpl, env: ctx.guardEnv, localPack: cmd === 'rsync' }
  );
  if (res.status !== 0) fail(`${cmd} başarısız`);
  return (res.stdout || '').trim();
}

function writeReport(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = `${lines.filter(Boolean).join('\n')}\n`;
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function formatCompareLine(result) {
  const c = result?.counts || {};
  return `compare: KAYBOLDU=${c.KAYBOLDU || 0} VARSAYILANA=${c['VARSAYILANA DÖNDÜ'] || 0} DEĞİŞTİ=${c.DEĞİŞTİ || 0} KORUNDU=${c.KORUNDU || 0} YENİ=${c.YENİ || 0}`;
}

function resolvePluginDir(ctx, resolved, wpPath) {
  const flag = wpPathFlag(wpPath);
  const fallback = `${wpPath}/wp-content/plugins/${PLUGIN_SLUG}`;
  const raw = remote(
    ctx,
    resolved,
    `wp plugin path ${PLUGIN_SLUG} --dir ${flag} 2>/dev/null || echo ${shellQuoteWpPath(fallback)}`
  );
  const dir = normalizeRemotePluginDir(raw, PLUGIN_SLUG);
  if (!dir) fail('Uzak eklenti dizini çözülemedi.');
  return dir;
}

/**
 * Salt-okunur gezinti sayfaları (açık/kapalı tabanı). Uzakta eklenti KAPATILMAZ: kurulumdan önce (eski sürüm)
 * ve sonra (yeni sürüm) aynı sayfalar yalnız GET ile gezilir, sayılar `compareToBaseline` ile kıyaslanır.
 * Sipariş/alan doldurma yok; "product-edit" yerine ürün LİSTESİ (yeni ürün sayfası taslak kayıt oluşturur).
 *
 * @param {object} probe
 */
export function collectBrowseTargets(probe) {
  const p = probe && typeof probe === 'object' ? probe : {};
  const pub = (name, url) => ({ name, url: String(url || ''), cookie: false });
  const adm = (name, url) => ({ name, url: String(url || ''), cookie: true });
  return [
    pub('home', p.home),
    pub('shop', p.shop),
    pub('product', p.product),
    pub('cart', p.cart),
    pub('checkout', p.checkout),
    pub('plugin', p.plugin_page),
    adm('dashboard', p.admin),
    adm('wc-settings', p.wc_settings),
    adm('orders', p.orders),
    adm('product-list', p.product_list),
  ];
}

/**
 * @param {{ targets: ReturnType<typeof collectBrowseTargets>, fetchImpl?: Function, cookieHeader?: string }} opts
 * @returns {Promise<Record<string, { consoleErrors: number, phpIssues: number, ours: number, thirdParty: number }>>}
 */
export async function runBrowseChecks(opts) {
  const out = {};
  for (const t of opts.targets || []) {
    if (!t.url) continue;
    let res = null;
    try {
      res = await fetchHtml(t.url, { fetchImpl: opts.fetchImpl, cookieHeader: t.cookie ? opts.cookieHeader || '' : '' });
    } catch {
      continue;
    }
    out[t.name] = browseMetricsFromResponse(res);
  }
  return out;
}

/** Kurulumdan ÖNCE (eski sürüm) hata tabanı. Başarısızlık kurulumu durdurmaz (taban yok = karşılaştırma yok). */
async function collectBrowseBaseline(ctx, resolved, fetchImpl) {
  try {
    const probe = extractJson(remote(ctx, resolved, buildUrlProbeCommand(resolved.wpPath))) || {};
    const targets = collectBrowseTargets(probe);
    let cookieHeader = '';
    if (targets.some((t) => t.cookie && t.url)) {
      cookieHeader = cookieHeaderFromAuth(extractJson(remote(ctx, resolved, buildAuthCookieCommand(resolved.wpPath))));
    }
    const metrics = await runBrowseChecks({ targets, fetchImpl, cookieHeader });
    return Object.keys(metrics).length ? metrics : null;
  } catch {
    return null;
  }
}

async function runPhpAndHttpHealth(ctx, resolved, expectedVersion, fetchImpl) {
  const phpRaw = remote(ctx, resolved, buildHealthPhpCommand(resolved.wpPath));
  const phpJson = extractJson(phpRaw) || {};
  const php = evaluatePhpHealth(phpJson, expectedVersion, { sinceEpoch: ctx.startEpoch ? ctx.startEpoch - 60 : 0 });

  const probeRaw = remote(ctx, resolved, buildUrlProbeCommand(resolved.wpPath));
  const probe = extractJson(probeRaw) || {};
  const targets = collectHttpTargets(probe);
  let cookieHeader = '';
  if (targets.some((t) => t.cookie && t.url)) {
    const authRaw = remote(ctx, resolved, buildAuthCookieCommand(resolved.wpPath));
    cookieHeader = cookieHeaderFromAuth(extractJson(authRaw));
  }
  const rawPages = await runHttpHealthChecks({ targets, fetchImpl, cookieHeader });
  const pages = attributePages(rawPages, { cls: php.logClass, baselineRedNames: ctx.baselineRedNames || [] });
  let onoff = null;
  if (ctx.browseBaseline) {
    const current = await runBrowseChecks({ targets: collectBrowseTargets(probe), fetchImpl, cookieHeader });
    const cls = php.logClass || { ours: [], unknown: [] };
    current['php-log'] = { consoleErrors: 0, phpIssues: cls.ours.length + cls.unknown.length, ours: cls.ours.length };
    onoff = compareToBaseline({ ...ctx.browseBaseline, 'php-log': { consoleErrors: 0, phpIssues: 0 } }, current);
    if (onoff.red) {
      pages.push({ name: 'onoff', ok: false, skipped: false, reason: formatOnOffLine(onoff).replace(/^Açık\/kapalı: /, 'taban: ') });
    }
  }
  const health = { php, pages, probe, onoff };
  health.line = formatHealthLine(health);
  health.red = healthIsRed(health);
  return health;
}

function extractPack(extractedDir) {
  if (extractedDir && fs.existsSync(extractedDir)) return extractedDir;
  const zipLocal = path.join(ROOT, 'build', 'woo-donation-popup.zip');
  if (!fs.existsSync(zipLocal)) fail('build/woo-donation-popup.zip oluşmadı.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-ship-'));
  const r = spawnSync('unzip', ['-q', '-o', zipLocal, '-d', tmp], { encoding: 'utf8' });
  if (r.status !== 0) fail('paket açılamadı');
  const nested = path.join(tmp, PLUGIN_SLUG);
  const extracted = fs.existsSync(nested) ? nested : tmp;
  if (!fs.existsSync(path.join(extracted, `${PLUGIN_SLUG}.php`))) {
    fail('Paket içinde woo-donation-popup.php yok.');
  }
  return extracted;
}

/**
 * Yerel WP HTTP sağlık (birim test / kanıt). SSH yok.
 * @param {{ wpDir?: string, fetchImpl?: Function, port?: number }} [opts]
 */
export async function runLocalHttpHealth(opts = {}) {
  const wpDir = opts.wpDir || path.join(LOCAL_WP_ROOT, 'wordpress');
  ensureLocalWp({ quiet: true, root: path.dirname(wpDir) });

  let server;
  let port = opts.port || 0;
  let homeUrl = '';
  if (!opts.fetchImpl) {
    const started = await startPhpServer(wpDir, port);
    server = started.child;
    port = started.port;
    homeUrl = `http://127.0.0.1:${port}/`;
  }

  if (server && homeUrl) {
    const deadline = Date.now() + 8000;
    let up = false;
    while (Date.now() < deadline) {
      try {
        const ping = await fetch(homeUrl, { redirect: 'manual' });
        await ping.text();
        up = true;
        break;
      } catch (e) {
        if (Date.now() >= deadline) throw e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    if (!up) throw new Error('yerel PHP sunucu yanıt vermedi');
  }

  const probeRaw = phpEvalFile(URL_PROBE_PHP, { WDP_LOCAL_WP_DIR: wpDir });
  const probe = extractJson(probeRaw) || {};
  if (opts.fetchImpl) {
    homeUrl = String(probe.home || 'http://127.0.0.1/');
  }
  let cookieHeader = '';
  const authRaw = phpEvalFile(AUTH_COOKIE_PHP, { WDP_LOCAL_WP_DIR: wpDir });
  cookieHeader = cookieHeaderFromAuth(extractJson(authRaw));

  const rewrite = (url) => {
    const u = String(url || '');
    if (!u || opts.fetchImpl) return u;
    try {
      const parsed = new URL(u);
      return `${homeUrl.replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
    } catch {
      return homeUrl;
    }
  };

  const probeLocal = {
    ...probe,
    home: rewrite(probe.home) || homeUrl,
    shop: rewrite(probe.shop),
    product: rewrite(probe.product),
    plugin_page: rewrite(probe.plugin_page),
    admin: rewrite(probe.admin) || `${homeUrl.replace(/\/$/, '')}/wp-admin/`,
  };

  try {
    const pages = await runHttpHealthChecks({
      targets: collectHttpTargets(probeLocal),
      fetchImpl: opts.fetchImpl,
      cookieHeader,
    });
    const phpRaw = phpEvalFile(HEALTH_PHP, { WDP_LOCAL_WP_DIR: wpDir });
    const phpJson = extractJson(phpRaw) || {};
    const phpOk = Number(phpJson.php_ok) === 1;
    const php = { ok: phpOk, reasons: phpOk ? [] : ['php_ok değil'], payload: phpJson };
    const health = { php, pages, probe: probeLocal };
    health.line = formatHealthLine(health);
    health.red = healthIsRed(health);
    return health;
  } finally {
    if (server) {
      server.kill('SIGTERM');
      writeWpConfig(wpDir);
    }
  }
}

/**
 * @param {string} wpDir
 * @param {number} [port]
 */
export function startPhpServer(wpDir, port = 0) {
  return new Promise((resolve, reject) => {
    const pick = (p) =>
      new Promise((res, rej) => {
        if (p) return res(p);
        const s = net.createServer();
        s.listen(0, '127.0.0.1', () => {
          const n = s.address().port;
          s.close(() => res(n));
        });
        s.on('error', rej);
      });
    pick(port).then((usePort) => {
      writeWpConfig(wpDir, { homeUrl: `http://127.0.0.1:${usePort}` });
      const child = spawn('php', ['-S', `127.0.0.1:${usePort}`, '-t', wpDir], {
        cwd: wpDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let ready = false;
      const onOut = () => {
        if (ready) return;
        ready = true;
        resolve({ child, port: usePort });
      };
      child.stdout.on('data', onOut);
      child.stderr.on('data', onOut);
      child.on('error', reject);
      setTimeout(() => {
        if (!ready) {
          ready = true;
          resolve({ child, port: usePort });
        }
      }, 400);
    }, reject);
  });
}

/**
 * @param {{
 *   envName: string,
 *   dryRun?: boolean,
 *   rollback?: boolean,
 *   argv?: string[],
 *   spawnImpl?: Function,
 *   fetchImpl?: Function,
 *   skipPrechecks?: boolean,
 *   skipInstall?: boolean,
 *   extractedDir?: string,
 *   canaryFn?: Function,
 *   snapshotFn?: Function,
 *   compareFn?: Function,
 *   pluginsFn?: Function,
 *   now?: Date,
 *   guardEnv?: NodeJS.ProcessEnv,
 *   freezePath?: string,
 *   writeReport?: boolean,
 * }} opts
 */
export async function runShip(opts = {}) {
  const parsed = parseShipArgs(opts.argv || []);
  const envName = canonicalShipEnv(opts.envName || parsed.envName);
  const dryRun = !!(opts.dryRun || parsed.dryRun);
  const rollbackOnly = !!(opts.rollback || parsed.rollback);
  if (rollbackOnly && dryRun) fail('--rollback ile --dry-run birlikte olmaz.');

  if (envName === 'ikram') console.log(IKRAM_ALLOW_REMOVAL_NOTE);

  const stamp = shipStamp(opts.now || new Date());
  const version = readPluginVersion();
  if (!version) fail('Yerel sürüm okunamadı.');

  const reportFile = defaultReportPath(envName, stamp);
  const lines = [
    `# ship ${envName} ${stamp}`,
    `sürüm: ${version}`,
    `dry-run: ${dryRun ? 'evet' : 'hayır'}`,
  ];

  if (dryRun) {
    lines.push('', '## Plan (uzak yazma yok)', ...PLAN_STEPS.map((s, i) => `${i + 1}. ${s}`));
    if (opts.writeReport !== false) writeReport(reportFile, lines);
    return {
      exitCode: EXIT_OK,
      dryRun: true,
      reportFile,
      calls: [],
      remoteWrites: 0,
      plan: PLAN_STEPS.slice(),
      summary: `dry-run ${envName}: ${PLAN_STEPS.length} adım, uzak yazma 0`,
    };
  }

  try {
    assertRemoteAllowed({ env: opts.guardEnv || process.env, freezePath: opts.freezePath });
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }

  const profile = loadProfile(envName);
  const resolved = resolveAllowedRemoteTarget(profile);
  setActiveProfile(profile);
  const lock =
    opts.spawnImpl || opts.skipEnvLock
      ? null
      : acquireEnvLock(profile.id, { command: `ship:${envName}` });
  try {
  const ctx = createCtx(opts);
  ctx.startEpoch = Math.floor(Date.now() / 1000);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;

  const siteCheck = remote(ctx, resolved, `wp option get siteurl ${wpPathFlag(resolved.wpPath)}`);
  const urlGuard = validateRemoteSiteUrl(siteCheck, resolved.siteUrl);
  if (!urlGuard.ok) fail(urlGuard.reason);

  const listed = findTargetByAlias(resolved.alias) || resolved.target;
  const paths = shipPaths(listed, resolved.wpPath);
  const pluginDir = resolvePluginDir(ctx, resolved, resolved.wpPath);
  const backupZip = `${paths.backupRoot}/${PLUGIN_SLUG}-pre-${version}-${stamp}.zip`;
  const optionsJson = `${paths.backupRoot}/wdp-options-pre-${version}-${stamp}.json`;
  const preSnapPath = snapshotOutPath(envName, 'pre', version, stamp);
  const postSnapPath = snapshotOutPath(envName, 'post', version, stamp);

  if (rollbackOnly) {
    const latestName = remote(
      ctx,
      resolved,
      `ls -1t ${shellQuoteWpPath(paths.backupRoot)} 2>/dev/null | grep '\\.zip$' | head -n 1`
    );
    const latest = String(latestName || '').trim().split(/\n/)[0].replace(/^.*\//, '');
    if (!latest) fail('Geri alınacak yedek bulunamadı.');
    const zip = `${paths.backupRoot}/${latest}`;
    const optGuess = zip.replace(/woo-donation-popup-pre-/, 'wdp-options-pre-').replace(/\.zip$/, '.json');
    const rb = buildRollbackCommands({
      backupZip: zip,
      optionsJson: optGuess,
      pluginDir,
      wpPath: resolved.wpPath,
    });
    for (const step of rb) remote(ctx, resolved, step.cmd);
    const health = await runPhpAndHttpHealth(ctx, resolved, version, fetchImpl);
    lines.push(health.line, `elle geri dönüş: ${zip}`);
    if (opts.writeReport !== false) writeReport(reportFile, lines);
    return {
      exitCode: health.red ? EXIT_FAIL : EXIT_OK,
      reportFile,
      calls: ctx.calls,
      health,
      rolledBack: true,
      summary: health.line,
    };
  }

  if (!opts.skipPrechecks) {
    runLocal(ctx, 'npm', ['run', 'verify']);
    runLocal(ctx, 'npm', ['run', 'test']);
    runLocal(ctx, 'npm', ['run', 'pack']);
  }

  const canaryBefore = opts.canaryFn
    ? await opts.canaryFn({ phase: 'before', envName })
    : evaluateCanaryHealth(snapshotCanary(), envName, loadRegistry(profile.id), {
        fixtures: loadFixtures(profile.id),
        envId: profile.id,
      });
  if (!canaryBefore.ok) {
    fail(`Kanarya KIRMIZI — kurulum yok (${(canaryBefore.diffs || []).length} fark)`);
  }
  lines.push(`kanarya önce: TEMİZ`);

  let plugins;
  if (opts.pluginsFn) {
    plugins = await opts.pluginsFn();
  } else {
    const raw = remote(
      ctx,
      resolved,
      `wp plugin list --fields=name,status,version --format=json ${wpPathFlag(resolved.wpPath)}`
    );
    plugins = extractJson(raw) || JSON.parse(raw || '[]');
  }
  try {
    assertDiscoverNotBlocked(plugins);
  } catch (e) {
    lines.push(e.message);
    if (opts.writeReport !== false) writeReport(reportFile, lines);
    e.calls = ctx.calls;
    e.remoteWrites = ctx.calls.filter((c) => c.write).length;
    throw e;
  }
  lines.push('REMOTE-BLOCKED: yok');

  if (!opts.skipBrowse && (!opts.skipInstall || opts.forceBrowse)) {
    ctx.browseBaseline = await collectBrowseBaseline(ctx, resolved, fetchImpl);
    lines.push(ctx.browseBaseline
      ? `açık/kapalı tabanı (kurulum öncesi, salt-okunur): ${Object.keys(ctx.browseBaseline).length} sayfa`
      : 'açık/kapalı tabanı: alınamadı (karşılaştırma yok)');
  }

  const snapFn = opts.snapshotFn || ((a) => runSnapshot(a));
  await snapFn({ env: envName, label: `pre-${version}-${stamp}`, out: preSnapPath });
  lines.push(`ön anlık: ${path.relative(ROOT, preSnapPath)}`);

  remote(ctx, resolved, `mkdir -p ${shellQuoteWpPath(paths.backupRoot)}`);
  remote(ctx, resolved, buildBackupZipCommand({ ...paths, pluginDir, backupZip }));
  remote(ctx, resolved, buildBackupOptionsCommand(resolved.wpPath, optionsJson));
  lines.push(`yedek: zip + wdp_* JSON`);

  if (!opts.skipInstall) {
    const extracted = extractPack(opts.extractedDir);
    rsyncTo(ctx, resolved, extracted, pluginDir, false);
    remote(ctx, resolved, buildActivateMigrateCommand(resolved.wpPath));
    remote(ctx, resolved, buildCacheFlushCommand(resolved.wpPath));
    const installed = remote(
      ctx,
      resolved,
      `wp plugin get ${PLUGIN_SLUG} --field=version ${wpPathFlag(resolved.wpPath)}`
    );
    if (String(installed).trim() !== version) {
      fail(`Kurulu sürüm yerel ile eşleşmiyor (yerel ${version}).`);
    }
    lines.push(`kurulum: ${version}`);
  }

  let health = await runPhpAndHttpHealth(ctx, resolved, version, fetchImpl);
  lines.push(health.line);
  let rolledBack = false;
  ctx.browseBaseline = null;
  if (health.red) {
    rolledBack = true;
    const rb = buildRollbackCommands({ backupZip, optionsJson, pluginDir, wpPath: resolved.wpPath });
    for (const step of rb.slice(0, 3)) {
      remote(ctx, resolved, step.cmd);
    }
    const after = await runPhpAndHttpHealth(ctx, resolved, '', fetchImpl);
    lines.push(`geri dönüş uygulandı`, after.line);
    if (opts.writeReport !== false) {
      const notice = writeRollbackNotice(path.join(ROOT, 'build/handoff'), {
        env: envName,
        stamp,
        version,
        reasons: health.php?.reasons || [],
        redPages: health.pages.filter((p) => !p.ok && !p.skipped && !p.thirdParty).map((p) => p.name),
        thirdParty: [
          ...(health.php?.thirdParty?.owners || []),
          ...health.pages.filter((p) => p.thirdParty).map((p) => p.name),
        ],
        after: after.line,
      });
      lines.push(`bildirim: ${path.relative(ROOT, notice)}`);
    }
    if (opts.writeReport !== false) writeReport(reportFile, lines);
    return {
      exitCode: EXIT_FAIL,
      reportFile,
      calls: ctx.calls,
      health: after,
      healthBeforeRollback: health,
      rolledBack: true,
      rollbackSteps: rb.map((s) => s.step),
      remoteWrites: ctx.calls.filter((c) => c.write).length,
      summary: `${health.line} → geri dönüş → ${after.line}`,
    };
  }

  await snapFn({ env: envName, label: `post-${version}-${stamp}`, out: postSnapPath });
  const compareFn = opts.compareFn || ((args) => runCompare(args));
  let compare;
  try {
    compare = compareFn({
      before: preSnapPath,
      after: postSnapPath,
      out: path.join(MIGRATION_DIR, `${envName}-compare-${stamp}.md`),
      title: `ship ${envName} pre vs post`,
    });
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
  const compareLine = formatCompareLine(compare);
  lines.push(compareLine);

  const canaryAfter = opts.canaryFn
    ? await opts.canaryFn({ phase: 'after', envName })
    : evaluateCanaryHealth(snapshotCanary(), envName, loadRegistry(profile.id), {
        fixtures: loadFixtures(profile.id),
        envId: profile.id,
      });
  lines.push(`kanarya sonra: ${canaryAfter.ok ? 'TEMİZ' : 'KIRMIZI'}`);

  let exitCode = EXIT_OK;
  if (compare?.fail) {
    const c = compare.counts || {};
    lines.push(
      `UYARI: göç karşılaştırması KAYBOLDU=${c.KAYBOLDU || 0} VARSAYILANA=${c['VARSAYILANA DÖNDÜ'] || 0} DEĞİŞTİ=${c.DEĞİŞTİ || 0} — geri dönüş otomatik değil`
    );
    exitCode = EXIT_COMPARE;
  } else if (!canaryAfter.ok) {
    exitCode = EXIT_FAIL;
  }

  if (opts.writeReport !== false) writeReport(reportFile, lines);
  return {
    exitCode,
    reportFile,
    calls: ctx.calls,
    health,
    rolledBack,
    compare,
    remoteWrites: ctx.calls.filter((c) => c.write).length,
    summary: [health.line, compareLine, `çıkış ${exitCode}`].join(' | '),
  };
  } finally {
    releaseEnvLock(lock);
  }
}

/**
 * @param {string} raw
 */
export function canonicalShipEnv(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'staging' || s === 'hedef' || s === 'staging-hedef') return 'staging';
  if (s === 'ikram' || s === 'ikram-aid') return 'ikram';
  if (s) return s;
  fail('Kullanım: --env staging|ikram');
}

export async function runShipCli(opts = {}) {
  try {
    const r = await runShip({ ...opts, argv: opts.argv || process.argv.slice(2) });
    if (r.summary) console.log(r.summary);
    if (r.reportFile) console.log(`özet: ${path.relative(ROOT, r.reportFile)}`);
    process.exit(r.exitCode);
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error(msg);
    process.exit(e && e.exitCode ? e.exitCode : EXIT_FAIL);
  }
}
