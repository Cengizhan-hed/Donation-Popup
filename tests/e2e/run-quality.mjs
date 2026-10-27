#!/usr/bin/env node
/**
 * Kalite kapıları koşucusu (E8B). YALNIZ yerel WP + SQLite (--env local). Uzak profil yok.
 *
 *   npm run e2e:quality [-- --only axe,lighthouse,budget] [-- --theme storefront] [-- --project iphone]
 *
 * Çıktı: build/quality/ozet.json (+ ozet.md). Port: WDP_Q_PORT (varsayılan 8942).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bootQualityWorker, qualityConfigs, setQualityState, QUALITY_DIR, ROOT } from './helpers/quality-env.mjs';
import { runBudget } from './helpers/quality-budget.mjs';
import { runLighthouse } from './helpers/quality-lighthouse.mjs';
import { qualityMarkdown } from './helpers/quality-md.mjs';

const PORT = Number(process.env.WDP_Q_PORT || 8942) || 8942;

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '') : '';
}

async function main() {
  if (process.argv.includes('--env') && !/^(local|local-wp)$/.test(flag('--env'))) {
    console.error('e2e:quality yalnız --env local ile çalışır.');
    process.exit(2);
  }
  const only = (flag('--only') || 'axe,lighthouse,budget').split(',');
  const themeOnly = flag('--theme');
  const project = flag('--project');
  fs.mkdirSync(QUALITY_DIR, { recursive: true });
  const resultsFile = path.join(QUALITY_DIR, 'results.jsonl');
  fs.rmSync(resultsFile, { force: true });
  for (const d of ['test-results', 'playwright-report']) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });
  const summary = { generated: new Date().toISOString(), configs: [], lighthouse: [], budget: [], browser: [] };
  const t0 = Date.now();
  for (const cfg of qualityConfigs()) {
    if (themeOnly && cfg.theme !== themeOnly) continue;
    const w = await bootQualityWorker(cfg, PORT);
    try {
      const ids = {
        custom: w.probe.products.custom.id,
        fixed: w.probe.products.fixed.id,
        fixedPath: w.probe.products.fixed.path,
        customPath: w.probe.products.custom.path,
        sharesPath: w.probe.products.shares && w.probe.products.shares.path,
        campaignPath: w.probe.products.campaign.path,
        campaign: w.probe.products.campaign.id,
      };
      const checkoutPath = new URL(w.probe.checkoutUrl).pathname;
      const qcfg = { ...cfg, store: w.store, ids, checkoutUrl: w.base + checkoutPath };
      summary.configs.push({ id: cfg.id, theme: cfg.theme, store: cfg.store, checkout: cfg.checkout, hpos: cfg.hpos });
      if (only.includes('axe')) {
        const args = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', 'quality-gates'];
        if (project) args.push('--project', project);
        setQualityState(w.wpDir, { modules: 'all', override: true });
        const r = spawnSync('npx', args, {
          cwd: ROOT,
          stdio: 'inherit',
          env: {
            ...process.env,
            E2E_BASE_URL: w.base,
            WDP_LOCAL_WP_DIR: w.wpDir,
            WDP_Q_CFG: JSON.stringify(qcfg),
            WDP_Q_RESULTS: resultsFile,
          },
        });
        if (r.status !== 0) process.exitCode = 1;
      }
      if (only.includes('budget')) summary.budget.push(...(await runBudget(w, qcfg)));
      if (only.includes('lighthouse')) {
        summary.lighthouse.push(...(await runLighthouse(w, qcfg)));
      }
    } finally {
      await w.server.stop();
    }
  }
  if (fs.existsSync(resultsFile)) {
    summary.browser = fs.readFileSync(resultsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
  summary.seconds = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(QUALITY_DIR, 'ozet.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(QUALITY_DIR, 'ozet.md'), qualityMarkdown(summary));
  const failed = summary.browser.filter((r) => !r.ok).length;
  console.log(`\ne2e:quality: tarayıcı ${summary.browser.length - failed} geçti / ${failed} hata; lighthouse ${summary.lighthouse.length}; bütçe ${summary.budget.length}; ${summary.seconds} sn`);
  if (failed) process.exitCode = 1;
  if (!process.exitCode) fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
