#!/usr/bin/env node
/**
 * 12.3 canlı kampanya ilerleme çubuğu yerel e2e (kart + form + compact kart + yan sepet; iPhone / Android / masaüstü).
 * YALNIZ yerel WP + SQLite (--env local). Uzak profil yok. Yerel sipariş yalnız bu geçici WP'de.
 *
 *   npm run e2e:queue -- node tests/e2e/run-live-progress.mjs --env local [--project iphone] [--grep ...]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 9053). Tema: WDP_EXP_THEME (varsayılan twentytwentyfive).
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
const SIM_SRC = path.join(__dirname, 'helpers/wdp-live-progress-sim.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 9053) || 9053;

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
    console.error('e2e:live-progress yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const matrix = loadMatrix();
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const checkout = flag(argv, '--checkout') === 'blocks' ? 'blocks' : 'classic';
  const resolved = { id: `lp-${theme}-${checkout}`, themeSpec: { slug: theme }, storeSpec: store, checkout, hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-live-progress-sim.php'));
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
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'live-progress.spec'];
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
