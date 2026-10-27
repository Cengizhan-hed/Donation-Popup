#!/usr/bin/env node
/**
 * Bağış listesi ([wdp_donations]) yerel e2e: iPhone (WebKit) / Android (Chromium) / masaüstü (Chrome).
 * YALNIZ yerel WP + SQLite (--env local). Uzak profil yok.
 *
 *   npm run e2e:queue -- node tests/e2e/run-list.mjs --env local [--project iphone] [--grep metin] [--spec list]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 8913). Tema: WDP_EXP_THEME (varsayılan twentytwentyfive).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLocalEvalFile } from './helpers/local-wp-eval.mjs';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  matrixEval,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const EXP_SIM = path.join(__dirname, 'helpers/wdp-exp-sim.php');
const LIST_SIM = path.join(__dirname, 'helpers/wdp-list-sim.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8913) || 8913;

/**
 * @param {string[]} argv Komut satırı.
 * @param {string} name Bayrak adı.
 * @return {string} Değer ya da boş.
 */
function flag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? String(argv[i + 1] || '') : '';
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--env') && !/^(local|local-wp)$/.test(flag(argv, '--env'))) {
    console.error('run-list yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const store = loadMatrix().stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `list-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  // Form motoru ayarı ve hız sınırı sıfırlama (exp-sim) + liste sayfası (list-sim).
  fs.copyFileSync(EXP_SIM, path.join(wpDir, 'wp-content/mu-plugins/wdp-exp-sim.php'));
  fs.copyFileSync(LIST_SIM, path.join(wpDir, 'wp-content/mu-plugins/wdp-list-sim.php'));
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) {
    throw new Error(`çevrimdışı ödeme yöntemleri açılamadı: ${gateways.error || ''}`);
  }
  const server = await startPhpServer({ wpDir, port: PORT });
  const p = probe.products;
  const seed = runLocalEvalFile(
    'tests/e2e/helpers/wdp-list-seed.php',
    [p.campaign?.id || 0, p.shares?.id || 0, p.custom?.id || 0, p.fixed?.id || 0].map(String),
    { env: { WDP_LOCAL_WP_DIR: wpDir } }
  );
  if (!/"ok":true/.test(String(seed))) {
    throw new Error(`liste tohumu başarısız: ${String(seed).slice(0, 200)}`);
  }
  let status = 1;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'playwright-report'), { recursive: true, force: true });
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'list'];
    const project = flag(argv, '--project');
    if (project) args.push('--project', project);
    const grep = flag(argv, '--grep');
    if (grep) args.push('--grep', grep);
    const r = spawnSync('npx', args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_BASE_URL: `http://127.0.0.1:${PORT}`,
        WDP_LOCAL_WP_DIR: wpDir,
      },
    });
    status = r.status ?? 1;
    if (status === 0) {
      fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    }
  } finally {
    await server.stop();
  }
  process.exit(status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
