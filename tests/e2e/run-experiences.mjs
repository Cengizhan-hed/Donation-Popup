#!/usr/bin/env node
/**
 * Experiences (E2A) yerel e2e: 4 kap x iPhone (WebKit) / Android (Chromium) / masaüstü (Chrome).
 * YALNIZ yerel WP + SQLite (--env local). Uzak profil yok.
 *
 *   npm run e2e:experiences [-- --project iphone] [-- --grep açılır]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 8911). Tema: WDP_EXP_THEME (varsayılan twentytwentyfive).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadMatrix } from './helpers/matrix-cover.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SIM_SRC = path.join(__dirname, 'helpers/wdp-exp-sim.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8911) || 8911;

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
    console.error('e2e:experiences yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const matrix = loadMatrix();
  const store = matrix.stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `exp-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-exp-sim.php'));
  restoreSqlite(wpDir, snap);
  const server = await startPhpServer({ wpDir, port: PORT });
  let status = 1;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'playwright-report'), { recursive: true, force: true });
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', 'experiences'];
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
      },
    });
    status = r.status ?? 1;
  } finally {
    await server.stop();
  }
  process.exit(status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
