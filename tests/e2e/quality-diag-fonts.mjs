#!/usr/bin/env node
/**
 * K7 tt4 teşhisi (yalnız yerel): eklentili / eklentisiz ürün sayfası, N Lighthouse koşusu; FCP, LCP öğesi ve yazı tipi istekleri.
 *
 *   WDP_Q_PORT=8977 npm run e2e:queue -- node tests/e2e/quality-diag-fonts.mjs [--theme twentytwentyfour] [--runs 5] [--path /product/x/]
 *
 * Çıktı: koşu başına satır + özet (JSON, stdout). Gerçek veri yok; yalnız yerel WP.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { bootQualityWorker, qualityConfigs } from './helpers/quality-env.mjs';
import { startGzipProxy } from './helpers/gzip-proxy.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const theme = arg('--theme', 'twentytwentyfour');
const RUNS = Number(arg('--runs', 5));
const PORT = Number(process.env.WDP_Q_PORT || 8977);
const LH_PORT = Number(process.env.WDP_Q_LH_PORT || 9477);
const variants = (arg('--variants', 'plugin,control,stripcss')).split(',');
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const cfg = qualityConfigs().find((c) => c.theme === theme);
const w = await bootQualityWorker(cfg, PORT);
const proxy = await startGzipProxy(PORT, Number(process.env.WDP_Q_PROXY_PORT || PORT + 500));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-diag-'));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, args: [`--remote-debugging-port=${LH_PORT}`, '--no-sandbox'] });
const out = {};
try {
  const page = ctx.pages()[0] || (await ctx.newPage());
  const cdp = await ctx.newCDPSession(page);
  const p = arg('--path', w.probe.products.fixed.path);
  for (const v of variants) {
    const q = { control: '?dp_q_off=1', stripcss: '?dp_q_strip=css', stripjs: '?dp_q_strip=js', stripall: '?dp_q_strip=all', stripside: '?dp_q_strip=side', htmljson: '?dp_q_html=json', htmlcss: '?dp_q_html=css', htmlform: '?dp_q_html=form', htmlall: '?dp_q_html=all' }[v] || '';
    const url = `${proxy.base}${p}${q}`;
    await page.goto(url);
    const rows = [];
    for (let i = 0; i < RUNS; i += 1) {
      await cdp.send('Network.clearBrowserCache');
      const { lhr } = await lighthouse(url, { port: LH_PORT, output: 'json', logLevel: 'error', onlyCategories: ['performance'], disableStorageReset: true }, undefined);
      const items = ((lhr.audits['largest-contentful-paint-element'] || {}).details || {}).items;
      const node = items && items[0] && items[0].items && items[0].items[0] && items[0].items[0].node;
      const fonts = (lhr.audits['network-requests'].details.items || [])
        .filter((r) => /font|woff/i.test(`${r.resourceType} ${r.url}`))
        .map((r) => `${r.url.split('/').pop().slice(0, 40)}@${Math.round(r.networkRequestTime)}-${Math.round(r.networkEndTime)}`);
      rows.push({
        perf: Math.round(lhr.categories.performance.score * 100),
        fcp: Math.round(lhr.audits['first-contentful-paint'].numericValue),
        lcp: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
        lcpEl: node ? String(node.selector || '').slice(0, 70) : '-',
        fonts,
      });
    }
    out[v] = { medianFcp: median(rows.map((r) => r.fcp)), medianLcp: median(rows.map((r) => r.lcp)), medianPerf: median(rows.map((r) => r.perf)), fcpRuns: rows.map((r) => r.fcp), rows };
  }
} finally {
  await ctx.close();
  await proxy.stop();
  await w.server.stop();
  fs.rmSync(profile, { recursive: true, force: true });
}
console.log(JSON.stringify(out, null, 1));
