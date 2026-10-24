#!/usr/bin/env node
/**
 * Eklenti açık/kapalı karşılaştırma (YEREL WP + SQLite; uzak yok).
 *
 * Aynı yönetici + ön yüz sayfaları: eklenti KAPALI → AÇIK. Sayfa başına PHP uyarı/bildirim sayısı
 * (php günlüğü, kaynak sınıflamalı) ve tarayıcı konsol hatası karşılaştırılır; eklenti hata EKLİYORSA kırmızı.
 * Üçüncü taraf (sahte `wdp-fake-third`) gürültüsü iki durumda eşit olduğundan fark vermez.
 *
 * Uzakta eklenti kapatılmaz: uzak "açık" sayıları kanarya benzeri tabanla `compareToBaseline` ile kıyaslanır
 * (ship akışı: ship-core sağlık kaynağı ayırt etme).
 *
 *   node scripts/plugin-onoff-compare.mjs [--inject-ours] [--no-console]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLocalWp, writeWpConfig, phpEvalFile } from './local-wp.mjs';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { classifyLogLines, compareOnOff, formatOnOffLine, OUR_SLUG } from './lib/health-attribution.mjs';

const COPY_SKIP = new Set(['node_modules', '.git', 'build', 'docs', 'tests', 'scripts', 'vendor', 'vendor-dev', '.claude', '.cursor', 'tools']);

export const PAGES = Object.freeze([
  { name: 'home', path: '/', admin: false },
  { name: 'shop', path: '/?post_type=product', admin: false },
  { name: 'dashboard', path: '/wp-admin/index.php', admin: true },
  { name: 'plugins', path: '/wp-admin/plugins.php', admin: true },
  { name: 'wc-settings', path: '/wp-admin/admin.php?page=wc-settings', admin: true },
  { name: 'orders', path: '/wp-admin/admin.php?page=wc-orders', admin: true },
  { name: 'product-edit', path: '/wp-admin/post-new.php?post_type=product', admin: true },
  { name: 'wdp-settings', path: '/wp-admin/admin.php?page=wdp-popup-settings', admin: true },
]);

function copyPlugin(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(ROOT, dest, {
    recursive: true,
    filter: (src) => !COPY_SKIP.has(path.basename(src)) || path.resolve(src) === ROOT,
  });
}

function writeFakeThird(pluginsDir) {
  const dir = path.join(pluginsDir, 'wdp-fake-third');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'wdp-fake-third.php'),
    `<?php
/** Plugin Name: WDP Fake Third (yalnız yerel test) */
add_action('init', function () { trigger_error('fake third-party warning', E_USER_WARNING); });
add_action('wp_footer', function () { echo '<script>console.error("third-party")</script>'; });
add_action('admin_footer', function () { echo '<script>console.error("third-party")</script>'; });
`
  );
}

/**
 * Gerçek WooCommerce yerelde yok; eklentinin "WooCommerce gerekli" bağımlılığı için boş bir yer tutucu
 * (yalnız geçici kopya; iki durumda da aynı).
 */
function writeWooStub(pluginsDir) {
  const dir = path.join(pluginsDir, 'woocommerce');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'woocommerce.php'),
    `<?php
/** Plugin Name: WooCommerce (yerel yer tutucu) */
if (!class_exists('WooCommerce')) { class WooCommerce { public $version = '9.0.0'; } }
`
  );
}

/** Sahte "bizden" hata: kopyalanan eklentiye kod ekler (yalnız geçici kopya). */
function injectOurs(pluginDir) {
  fs.writeFileSync(
    path.join(pluginDir, 'wdp-fault.php'),
    `<?php
add_action('init', function () { trigger_error('injected ours warning', E_USER_WARNING); });
add_action('wp_footer', function () { echo '<script>console.error("ours")</script>'; });
add_action('admin_footer', function () { echo '<script>console.error("ours")</script>'; });
`
  );
  const main = path.join(pluginDir, 'woo-donation-popup.php');
  fs.appendFileSync(main, `\nrequire_once __DIR__ . '/wdp-fault.php';\n`);
}

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
    s.on('error', rej);
  });
}

async function startServer(wpDir, logFile) {
  const port = await freePort();
  writeWpConfig(wpDir, { homeUrl: `http://127.0.0.1:${port}` });
  const child = spawn(
    'php',
    ['-d', `error_log=${logFile}`, '-d', 'log_errors=1', '-d', 'display_errors=0', '-d', 'error_reporting=32767', '-S', `127.0.0.1:${port}`, '-t', wpDir],
    { cwd: wpDir, stdio: 'ignore' }
  );
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  for (;;) {
    try {
      const r = await fetch(`${base}/`, { redirect: 'manual' });
      await r.text();
      break;
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return { child, base, port };
}

function logSize(file) {
  try { return fs.statSync(file).size; } catch { return 0; }
}
function logSince(file, offset) {
  try {
    const buf = fs.readFileSync(file);
    return buf.subarray(offset).toString('utf8').split(/\r?\n/).filter(Boolean);
  } catch { return []; }
}

async function openBrowser(base, cookies) {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch { return null; }
  try {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, url: base })));
    return { browser, ctx };
  } catch { return null; }
}

async function measure(base, logFile, cookieHeader, br) {
  const out = {};
  for (const p of PAGES) {
    const off0 = logSize(logFile);
    const url = `${base}${p.path}`;
    let consoleErrors = null;
    if (br) {
      const page = await br.ctx.newPage();
      let n = 0;
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) n++; });
      page.on('pageerror', () => { n++; });
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      } finally {
        consoleErrors = n;
        await page.close();
      }
    } else {
      const r = await fetch(url, { headers: p.admin ? { Cookie: cookieHeader } : {}, redirect: 'follow' });
      await r.text();
    }
    const cls = classifyLogLines(logSince(logFile, off0));
    out[p.name] = {
      consoleErrors: consoleErrors == null ? 0 : consoleErrors,
      phpIssues: cls.ours.length + cls.thirdParty.length + cls.unknown.length,
      ours: cls.ours.length,
    };
  }
  return out;
}

/**
 * @param {{ injectOurs?: boolean, browser?: boolean }} [opts]
 */
export async function runOnOffCompare(opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-onoff-'));
  const wpDir = ensureLocalWp({ root, quiet: true });
  const pluginsDir = path.join(wpDir, 'wp-content/plugins');
  const pluginDir = path.join(pluginsDir, OUR_SLUG);
  copyPlugin(pluginDir);
  writeFakeThird(pluginsDir);
  writeWooStub(pluginsDir);
  if (opts.injectOurs) injectOurs(pluginDir);
  const env = { WDP_LOCAL_WP_DIR: wpDir };
  const logFile = path.join(root, 'php-errors.log');
  fs.writeFileSync(logFile, '');

  /** Çerez adı site adresine (port) bağlı: sunucu açıldıktan sonra üretilir. */
  const authCookies = () => {
    const authRaw = phpEvalFile('scripts/lib/ship-auth-cookie.php', env);
    const auth = JSON.parse(authRaw.slice(authRaw.indexOf('{'), authRaw.lastIndexOf('}') + 1));
    return [
      { name: auth.logged_in_name, value: auth.logged_in },
      { name: auth.auth_name, value: auth.auth },
    ];
  };

  const result = { states: {} };
  let server;
  let br = null;
  try {
    for (const mode of ['off', 'on']) {
      phpEvalFile('tests/local-wp/plugin-toggle.php', env, [mode]);
      server = await startServer(wpDir, logFile);
      const cookies = authCookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      if (opts.browser !== false) br = await openBrowser(server.base, cookies);
      result.browser = !!br;
      result.states[mode] = await measure(server.base, logFile, cookieHeader, br);
      if (br) { await br.browser.close(); br = null; }
      server.child.kill('SIGTERM');
      server = null;
    }
  } finally {
    if (br) await br.browser.close();
    if (server) server.child.kill('SIGTERM');
    fs.rmSync(root, { recursive: true, force: true });
  }
  result.compare = compareOnOff(result.states.off, result.states.on);
  result.line = formatOnOffLine(result.compare);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const res = await runOnOffCompare({ injectOurs: args.includes('--inject-ours'), browser: !args.includes('--no-console') });
  console.log(`${res.line}${res.browser ? '' : ' (konsol atlandı: tarayıcı yok)'}`);
  process.exit(res.compare.red ? 1 : 0);
}
