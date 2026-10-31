#!/usr/bin/env node
/**
 * 12.4 Stripe e2e: YALNIZ yerel WP + resmi "WooCommerce Stripe Payment Gateway" (TEST modu) + `stripe listen` + Mailpit.
 * Uzak profil/site REDDEDİLİR; uzak sitelere Stripe yapılandırması gitmez.
 *
 *   npm run e2e:queue -- node tests/e2e/run-stripe.mjs [--project desktop] [--checkout classic|blocks] [--store try|gbp|eur|usd] [--grep <ad>]
 *
 * Anahtarlar `.env.stripe.local` (gitignore'lu) → yalnız bu süreçte okunur, doğrulanır (sk_test_/pk_test_), değer YAZDIRILMAZ.
 * Yoksa koşu ATLANIR (çıkış 0, açık mesaj); canlı/yanlış biçimli anahtarda hiçbir şey yapılmadan durur (çıkış 3).
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 9066). Stripe eklentisi zip'i build/e2e/matrix/_cache altında (repo/zip dışı).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import { ensureMailpit, SMTP_PORT, HTTP_PORT } from './helpers/mailpit.mjs';
import { runLocalEvalFile, parseLocalEvalJson } from './helpers/local-wp-eval.mjs';
import { loadStripeKeys, maskSecrets, withoutStripeEnv } from './helpers/stripe-env.mjs';
import {
  CACHE_DIR,
  MATRIX_DIR,
  ensureMatrixTemplate,
  ensureTheme,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  warmUpWooFirstRequests,
} from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 9066) || 9066;
const STRIPE_SLUG = 'woocommerce-gateway-stripe';
const STRIPE_ZIP_URL = `https://downloads.wordpress.org/plugin/${STRIPE_SLUG}.latest-stable.zip`;
const EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.requires_action',
  'payment_intent.canceled',
  'charge.succeeded',
  'charge.failed',
].join(',');

/** @param {string[]} argv @param {string} name @return {string} */
function flag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? String(argv[i + 1] || '') : '';
}

/** @param {string} wpDir */
function ensureStripePlugin(wpDir) {
  const dest = path.join(wpDir, 'wp-content/plugins', STRIPE_SLUG);
  if (fs.existsSync(path.join(dest, `${STRIPE_SLUG}.php`))) return;
  const zip = path.join(CACHE_DIR, `${STRIPE_SLUG}.latest-stable.zip`);
  if (!fs.existsSync(zip) || fs.statSync(zip).size < 100000) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const r = spawnSync('curl', ['-fsSL', '-o', zip, STRIPE_ZIP_URL], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('Stripe eklentisi indirilemedi (wordpress.org)');
  }
  const r = spawnSync('unzip', ['-q', '-o', zip, '-d', path.join(wpDir, 'wp-content/plugins')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Stripe eklentisi açılamadı');
}

/**
 * `stripe listen` imza sırrı (whsec_) — yalnız bellekte, yazdırılmaz.
 * @param {string} secretKey
 * @return {string}
 */
function listenSecret(secretKey) {
  const r = spawnSync('stripe', ['listen', '--print-secret'], {
    encoding: 'utf8',
    env: { ...withoutStripeEnv(process.env), STRIPE_API_KEY: secretKey },
    timeout: 60000,
  });
  const out = String(r.stdout || '').trim();
  if (r.status !== 0 || !out.startsWith('whsec_')) {
    throw new Error(`stripe listen --print-secret başarısız: ${maskSecrets(String(r.stderr || '').slice(0, 300))}`);
  }
  return out;
}

/**
 * @param {string} secretKey
 * @param {string} forwardTo
 * @param {string} logFile Maskeli günlük.
 */
async function startListen(secretKey, forwardTo, logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, '');
  const proc = spawn('stripe', ['listen', '--forward-to', forwardTo, '--events', EVENTS], {
    env: { ...withoutStripeEnv(process.env), STRIPE_API_KEY: secretKey },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  const sink = (buf) => {
    const text = maskSecrets(buf.toString('utf8'));
    fs.appendFileSync(logFile, text);
    if (/Ready!/i.test(text)) ready = true;
  };
  proc.stdout.on('data', sink);
  proc.stderr.on('data', sink);
  const start = Date.now();
  while (!ready && Date.now() - start < 45000 && proc.exitCode == null) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    proc.kill('SIGTERM');
    throw new Error('stripe listen hazır olmadı (günlük: ' + path.relative(ROOT, logFile) + ')');
  }
  return {
    async stop() {
      if (proc.exitCode != null) return;
      proc.kill('SIGTERM');
      await new Promise((r) => {
        const t = setTimeout(() => {
          if (proc.exitCode == null) proc.kill('SIGKILL');
          r();
        }, 3000);
        proc.once('exit', () => {
          clearTimeout(t);
          r();
        });
      });
    },
  };
}

/** @param {string} logFile @return {Record<string, Record<string, number>>} */
function summarizeListen(logFile) {
  const out = { events: {}, responses: {} };
  if (!fs.existsSync(logFile)) return out;
  for (const line of fs.readFileSync(logFile, 'utf8').split('\n')) {
    const ev = line.match(/-->\s+([a-z_.]+)\s+\[/);
    if (ev) out.events[ev[1]] = (out.events[ev[1]] || 0) + 1;
    const res = line.match(/<--\s+\[(\d{3})\]/);
    if (res) out.responses[res[1]] = (out.responses[res[1]] || 0) + 1;
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--env') && !/^(local|local-wp)$/.test(flag(argv, '--env'))) {
    console.error('e2e stripe yalnız --env local ile çalışır (uzak YASAK).');
    process.exit(2);
  }
  const keys = loadStripeKeys(ROOT);
  if (keys.state === 'missing') {
    console.log(`[stripe] ATLANDI: ${keys.reason} — Stripe test anahtarı yok, spec koşulmadı.`);
    process.exit(0);
  }
  if (keys.state !== 'ok') {
    console.error(`[stripe] DURDU: ${keys.reason}. Hiçbir şey yapılmadı.`);
    process.exit(3);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const storeKey = flag(argv, '--store') || 'try';
  const store = loadMatrix().stores[storeKey];
  if (!store) throw new Error(`bilinmeyen mağaza: ${storeKey}`);
  const checkout = flag(argv, '--checkout') === 'blocks' ? 'blocks' : 'classic';
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `stripe-${theme}-${storeKey}-${checkout}`, themeSpec: { slug: theme }, storeSpec: store, checkout, hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const product = Number(probe.products.custom.id);
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  ensureStripePlugin(wpDir);
  const mu = path.join(wpDir, 'wp-content/mu-plugins');
  fs.mkdirSync(mu, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'helpers/wdp-stripe-sim.php'), path.join(mu, 'wdp-stripe-sim.php'));
  fs.copyFileSync(path.join(__dirname, 'helpers/wdp-mail-sink.php'), path.join(mu, 'wdp-mail-sink.php'));

  const base = `http://127.0.0.1:${PORT}`;
  const listenLog = path.join(MATRIX_DIR, `stripe-listen-${PORT}.log`);
  const whsec = listenSecret(keys.keys.secret);
  let setup;
  try {
    setup = parseLocalEvalJson(
      runLocalEvalFile('tests/local-wp/stripe-setup.php', [String(product), '100000'], {
        env: { WDP_LOCAL_WP_DIR: wpDir, WDP_STRIPE_PK: keys.keys.publishable, WDP_STRIPE_SK: keys.keys.secret, WDP_STRIPE_WHSEC: whsec },
      })
    );
  } catch (e) {
    // Özgün hata (cause) bilinçli olarak taşınmaz: ham çıktı anahtar içerebilir; yalnız maskeli metin.
    setup = { ok: false, error: e && e.message ? e.message : String(e) };
  }
  if (!setup.ok) throw new Error(`Stripe kurulumu: ${maskSecrets(setup.error || '')}`);
  console.log(`[stripe] eklenti ${setup.version}, test modu=${setup.testmode}, para=${setup.currency}, anahtarlar=${JSON.stringify(setup.keys)}, ürün=${product}`);

  const mailpit = await ensureMailpit();
  const server = await startPhpServer({ wpDir, port: PORT });
  let listen = null;
  let status;
  try {
    listen = await startListen(keys.keys.secret, `${base}/?wc-api=wc_stripe`, listenLog);
    await warmUpWooFirstRequests(base);
    const hold = Number(flag(argv, '--hold')) || 0;
    if (hold > 0) {
      // Keşif/hata ayıklama: ortamı ayakta tut (spec koşmaz), süre dolunca kapanır.
      console.log(`[stripe] ortam hazır: ${base} (ürün ${product}); ${hold} sn ayakta.`);
      await new Promise((r) => setTimeout(r, hold * 1000));
      status = 0;
      return;
    }
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    if (!argv.includes('--keep-results')) {
      fs.rmSync(path.join(ROOT, `build/handoff/RAPOR-124-stripe/results-${storeKey}-${checkout}.jsonl`), { force: true });
    }
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'specs/stripe-'];
    const project = flag(argv, '--project');
    if (project) args.push('--project', project);
    const grep = flag(argv, '--grep');
    if (grep) args.push('--grep', grep);
    const r = spawnSync('npx', args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...withoutStripeEnv(process.env),
        E2E_BASE_URL: base,
        WDP_STRIPE_READY: '1',
        WDP_EXP_PRODUCT_ID: String(product),
        WDP_EXP_CHECKOUT: checkout,
        WDP_EXP_STORE: JSON.stringify(store),
        WDP_STRIPE_STORE_KEY: storeKey,
        WDP_LOCAL_WP_DIR: wpDir,
        WDP_MAILPIT_SMTP_PORT: String(SMTP_PORT),
        WDP_MAILPIT_HTTP_PORT: String(HTTP_PORT),
      },
    });
    status = r.status ?? 1;
    if (status === 0) fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
  } finally {
    if (listen) await listen.stop();
    await server.stop();
    await mailpit.stop();
    const summary = summarizeListen(listenLog);
    const outDir = path.join(ROOT, 'build/handoff/RAPOR-124-stripe');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `listen-${storeKey}-${checkout}.json`), JSON.stringify(summary, null, 2) + '\n');
    console.log(`[stripe] webhook özeti: ${JSON.stringify(summary)}`);
  }
  process.exit(status);
}

main().catch((e) => {
  console.error(maskSecrets(e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
