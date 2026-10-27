#!/usr/bin/env node
/**
 * 12-g2 tanı: ürün sayfasında eklentinin yüklediği betik/stil/satır içi parçaları (boyut) ve eklenti açık/kapalı fark listesi.
 *
 *   WDP_Q_PORT=8978 npm run e2e:queue -- node tests/e2e/quality-diag-assets.mjs [--theme twentytwentyfour]
 *
 * Yalnız yerel WP. Çıktı JSON (stdout).
 */
import { chromium, devices } from '@playwright/test';
import { bootQualityWorker, qualityConfigs } from './helpers/quality-env.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const theme = arg('--theme', 'twentytwentyfour');
const PORT = Number(process.env.WDP_Q_PORT || 8978);
const cfg = qualityConfigs().find((c) => c.theme === theme);
const w = await bootQualityWorker(cfg, PORT);
try {
  const p = arg('--path', w.probe.products.fixed.path);
  const base = `http://127.0.0.1:${PORT}${p}`;
  const get = async (q) => (await fetch(`${base}${q}`)).text();
  const on = await get('');
  const off = await get('?dp_q_off=1');
  const tags = (html) => [...html.matchAll(/<(?:script|link|style)\b[^>]*?(?:src|href|id)="([^"]+)"/g)].map((m) => m[1]);
  const offSet = new Set(tags(off));
  const added = tags(on).filter((t) => !offSet.has(t));
  const inline = [...on.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].length).filter((n) => n > 0);
  const inlineOff = [...off.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].length).filter((n) => n > 0);
  const lcp = {};
  if (process.argv.includes('--lcp')) {
    const browser = await chromium.launch();
    for (const [name, q] of [['plugin', ''], ['control', '?dp_q_off=1'], ['stripside', '?dp_q_strip=side_cart']]) {
      const ctx = await browser.newContext({ ...devices['Pixel 5'] });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__lcp = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__lcp.push({ t: Math.round(e.startTime), tag: e.element ? e.element.tagName + '.' + String(e.element.className).slice(0, 60) : '-', size: e.size, url: e.url || '' });
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      await page.goto(`${base}${q}`, { waitUntil: 'load' });
      await page.evaluate(() => new Promise((r) => setTimeout(r, 2500)));
      lcp[name] = await page.evaluate(() => window.__lcp);
      await ctx.close();
    }
    await browser.close();
  }
  console.log(JSON.stringify({ lcp, added, htmlBytes: { on: on.length, off: off.length }, inlineScripts: { on: inline.length, off: inlineOff.length, extraBytes: inline.reduce((a, b) => a + b, 0) - inlineOff.reduce((a, b) => a + b, 0) } }, null, 1));
} finally {
  await w.server.stop();
}
