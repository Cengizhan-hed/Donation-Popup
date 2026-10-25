#!/usr/bin/env node
/**
 * Experiences (E2A) yerel e2e: 4 kap x iPhone (WebKit) / Android (Chromium) / masaüstü (Chrome).
 * YALNIZ yerel WP + SQLite (--env local). Uzak profil yok.
 *
 *   npm run e2e:experiences [-- --project iphone] [-- --grep açılır]
 *
 * Port: WDP_LOCAL_E2E_PORT (varsayılan 8911). Tema: WDP_EXP_THEME (varsayılan twentytwentyfive).
 * Ödeme: `--checkout classic|blocks` (varsayılan classic); `--spec <ad>` yalnız o dosyayı koşar (varsayılan: experiences).
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

/**
 * E2C: "WDP E2E Addon" test ürününe işlem ücreti + ek bağış tanımlar (yalnız yerel WP; paralel cihaz koşuları için bir kez).
 * Ek bağış satırı ürünü olarak sabit tutarlı test ürünü kullanılır. Ürün kimliğini döndürür (yoksa 0).
 *
 * @param {string} wpDir Yerel WP klasörü.
 * @param {Record<string, {id: number}>} products Test ürünleri.
 * @return {number} Ana ürün kimliği.
 */
function seedAddonProduct(wpDir, products) {
  if (!products.fixed) {
    return 0;
  }
  const out = runLocalEvalFile('tests/e2e/helpers/wdp-exp-seed.php', [String(products.fixed.id)], { env: { WDP_LOCAL_WP_DIR: wpDir } });
  const match = String(out).match(/\{.*\}/s);
  const parsed = match ? JSON.parse(match[0]) : { ok: false };
  return parsed.ok ? Number(parsed.id) : 0;
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
  const checkout = flag(argv, '--checkout') === 'blocks' ? 'blocks' : 'classic';
  const resolved = { id: `exp-${theme}-${checkout}`, themeSpec: { slug: theme }, storeSpec: store, checkout, hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  fs.copyFileSync(SIM_SRC, path.join(wpDir, 'wp-content/mu-plugins/wdp-exp-sim.php'));
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) {
    throw new Error(`çevrimdışı ödeme yöntemleri açılamadı: ${gateways.error || ''}`);
  }
  const server = await startPhpServer({ wpDir, port: PORT });
  const addonHostId = seedAddonProduct(wpDir, probe.products);
  let status = 1;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'playwright-report'), { recursive: true, force: true });
    const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag(argv, '--spec') || 'experiences'];
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
        WDP_EXP_PRODUCTS: JSON.stringify(
          {
            ...Object.fromEntries(['fixed', 'custom', 'shares', 'campaign'].filter((k) => probe.products[k]).map((k) => [k, probe.products[k].id])),
            ...(addonHostId ? { addon: addonHostId } : {}),
          }
        ),
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
