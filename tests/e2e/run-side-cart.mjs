#!/usr/bin/env node
/**
 * Yan sepet (E4) yerel e2e: iPhone (WebKit) / Android (Chromium) / masaüstü (Chrome), yeni + eski motor.
 * YALNIZ yerel WP + SQLite (--env local). Uzak profil yok.
 *
 *   npm run e2e:side-cart [-- --project iphone] [-- --grep açılır]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 8924). Tema: WDP_EXP_THEME (varsayılan twentytwentyfive).
 * Ödeme: `--checkout classic|blocks` (varsayılan classic); `--spec <ad>` yalnız o dosyayı koşar (varsayılan: side-cart).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
const SIM_SRC = path.join(__dirname, 'helpers/wdp-exp-sim.php');
const SC_SIM_SRC = path.join(__dirname, 'helpers/wdp-sc-sim.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8924) || 8924;

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
    console.error('e2e:side-cart yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const matrix = loadMatrix();
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const checkout = flag(argv, '--checkout') === 'blocks' ? 'blocks' : 'classic';
  const resolved = { id: `sc-${theme}-${checkout}`, themeSpec: { slug: theme }, storeSpec: store, checkout, hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-exp-sim.php'));
  fs.copyFileSync(SC_SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-sc-sim.php'));
  if (flag(argv, '--spec') === 'cache-contract') {
    fs.copyFileSync(path.join(__dirname, 'helpers/wdp-cc-sim.php'), path.join(wpDir, 'wp-content/mu-plugins/wdp-cc-sim.php'));
  }
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) {
    throw new Error(`çevrimdışı ödeme yöntemleri açılamadı: ${gateways.error || ''}`);
  }
  const server = await startPhpServer({ wpDir, port: PORT });
  let status = 1;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'playwright-report'), { recursive: true, force: true });
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'side-cart'];
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
        WDP_EXP_PRODUCT_ID: String(probe.products.custom.id),
        WDP_EXP_TRY: '1',
        WDP_EXP_CHECKOUT: checkout,
        WDP_EXP_STORE: JSON.stringify(store),
        WDP_LOCAL_WP_DIR: wpDir,
      },
    });
    status = r.status ?? 1;
    if (status === 0) {
      // Disk kuralı: yalnız başarısız koşunun çıktısı saklanır.
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
