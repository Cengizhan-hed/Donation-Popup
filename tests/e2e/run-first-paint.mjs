#!/usr/bin/env node
/**
 * 12.2 fouc: ilk boyama stil testi (first-paint-styles.spec) — 4 tema × iPhone/Android/masaüstü. YALNIZ yerel WP (--env local).
 *
 *   npm run e2e:queue -- node tests/e2e/run-first-paint.mjs [--theme storefront] [--project iphone] [--serve]
 *     [--spec style-order-independence]
 *
 * Port: WDP_FP_PORT (varsayılan 8961). `--serve`: yalnız sunucuyu açar, URL'leri yazar, Ctrl+C ile kapanır (ölçüm betiği için).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bootQualityWorker } from './helpers/quality-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SIM_SRC = path.join(__dirname, 'helpers/wdp-first-paint-sim.php');
const PORT = Number(process.env.WDP_FP_PORT || 8961) || 8961;
const THEMES = ['twentytwentyfive', 'storefront', 'blocksy', 'hello-elementor'];

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
}

async function main() {
  if (process.argv.includes('--env') && !/^(local|local-wp)$/.test(flag('--env'))) {
    console.error('first-paint yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const only = flag('--theme');
  const project = flag('--project');
  const themes = only ? [only] : THEMES;
  const results = [];
  for (const theme of themes) {
    const w = await bootQualityWorker({ id: `fp-${theme}`, theme, store: 'try', checkout: 'classic', hpos: true }, PORT);
    fs.copyFileSync(SIM_SRC, path.join(w.wpDir, 'wp-content/mu-plugins/wdp-first-paint-sim.php'));
    const ids = { product: w.probe.products.custom.id, fixed: w.probe.products.fixed.id, campaign: w.probe.products.campaign.id };
    try {
      if (process.argv.includes('--serve')) {
        console.log(`FP_SERVE ${w.base}/?dp_fp=page&dp_product=${ids.product}&dp_fixed=${ids.fixed}&dp_campaign=${ids.campaign}`);
        await new Promise((resolve) => process.on('SIGINT', resolve));
        continue;
      }
      for (const d of ['test-results', 'playwright-report']) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });
      // `--spec style-order-independence`: aynı sim sayfasında stil sıra bağımsızlığı (122-cascade).
      const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', flag('--spec') || 'first-paint-styles'];
      if (project) args.push('--project', project);
      const r = spawnSync('npx', args, {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, E2E_BASE_URL: w.base, WDP_FP_IDS: JSON.stringify(ids), WDP_FP_THEME: theme },
      });
      results.push({ theme, status: r.status ?? 1 });
    } finally {
      await w.server.stop();
    }
  }
  for (const r of results) console.log(`FP_RESULT ${r.theme} ${r.status === 0 ? 'GEÇTİ' : 'KALDI'}`);
  process.exit(results.every((r) => r.status === 0) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
