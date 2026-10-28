#!/usr/bin/env node
/**
 * Lighthouse mobil ölçümü (CLAUDE.md §24 kabul; yalnız yerel WP + SQLite, uzak komut yok, dev bağımlılığı `lighthouse`).
 *
 *   npm run measure:lighthouse [-- --theme twentytwentyfive] [-- --runs 3] [-- --pages ana-sayfa,bagis-urunu]
 *
 * Eklenti KAPALI (etkin listeden çıkarılmış) ↔ AÇIK, her sayfa için N koşu (varsayılan 3), alternatif sırayla;
 * medyan: performans puanı, LCP, CLS, TBT, FCP. Kabul: puan düşüşü ≤3, LCP artışı ≤100 ms, CLS artışı 0.
 * Chrome: Playwright'ın indirdiği Chromium (CHROME_PATH). Çıktı: konsol tablosu + build/e2e/lighthouse/<tema>.json.
 * Tek süreç: `npm run e2e:queue -- npm run measure:lighthouse`. Port: WDP_LOCAL_E2E_PORT (varsayılan 8934).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { loadMatrix } from '../tests/e2e/helpers/matrix-cover.mjs';
import { ensureMatrixTemplate, ensureTheme, prepareConfigSnapshot, materializeWorker, startPhpServer, restoreSqlite } from '../tests/e2e/helpers/matrix-setup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SIM_SRC = path.join(ROOT, 'tests/e2e/helpers/wdp-scope-sim.php');
const PROBE_SRC = path.join(ROOT, 'tests/e2e/helpers/wdp-load-probe.php');
const PORT = Number(process.env.WDP_LOCAL_E2E_PORT || 8934);
const OUT_DIR = path.join(ROOT, 'build/e2e/lighthouse');
const LIMITS = { score: 3, lcp: 100, cls: 0 };

const PAGES = [
  { id: 'ana-sayfa', page: 'home' },
  { id: 'bagis-disi-urun', page: 'plainprod' },
  { id: 'magaza-bagis-urunleriyle', page: 'shop' },
  { id: 'bagis-urunu', page: 'donation' },
  { id: 'bagis-listesi', page: 'list' },
];

/** @param {number[]} a */
export function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Kabul değerlendirmesi: on − off.
 * @param {{score:number,lcp:number,cls:number}} off
 * @param {{score:number,lcp:number,cls:number}} on
 * @return {string[]} İhlaller.
 */
export function judge(off, on) {
  const out = [];
  if (off.score - on.score > LIMITS.score) out.push(`puan düşüşü ${(off.score - on.score).toFixed(0)} > ${LIMITS.score}`);
  if (on.lcp - off.lcp > LIMITS.lcp) out.push(`LCP +${(on.lcp - off.lcp).toFixed(0)} ms > ${LIMITS.lcp}`);
  if (on.cls - off.cls > 0.0005) out.push(`CLS +${(on.cls - off.cls).toFixed(4)} > 0`);
  return out;
}

function lighthouse(url) {
  const bin = path.join(ROOT, 'node_modules/.bin/lighthouse');
  const res = spawnSync(
    bin,
    [url, '--output=json', '--quiet', '--only-categories=performance', '--form-factor=mobile', '--chrome-flags=--headless=new --no-sandbox --disable-gpu'],
    { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', timeout: 180000 }
  );
  if (res.status !== 0) throw new Error(`lighthouse çıkış ${res.status}: ${String(res.stderr).slice(0, 300)}`);
  const j = JSON.parse(res.stdout);
  const a = j.audits;
  return {
    score: Math.round((j.categories.performance.score || 0) * 100),
    lcp: a['largest-contentful-paint'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    fcp: a['first-contentful-paint'].numericValue,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n, d) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : d);
  const theme = arg('--theme', 'twentytwentyfive');
  const runs = Number(arg('--runs', '3'));
  const only = arg('--pages', '').split(',').filter(Boolean);
  const matrix = loadMatrix();
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `lh-${theme}`, themeSpec: { slug: theme }, storeSpec: matrix.stores.try, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probeMeta = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, PORT, snap, { hpos: true });
  const muDir = path.join(wpDir, 'wp-content/mu-plugins');
  fs.copyFileSync(SIM_SRC, path.join(muDir, 'wdp-scope-sim.php'));
  fs.copyFileSync(PROBE_SRC, path.join(muDir, 'wdp-load-probe.php'));
  restoreSqlite(wpDir, snap);
  fs.rmSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), { force: true });
  const setState = (s) => fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-load-probe.json'), JSON.stringify(s));
  setState({});
  fs.writeFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim.json'), '{}');

  const server = await startPhpServer({ wpDir, port: PORT });
  const base = server.url.replace(/\/$/, '');
  const rows = [];
  const violations = [];
  try {
    await fetch(`${base}/`, { signal: AbortSignal.timeout(120000) });
    const urls = JSON.parse(fs.readFileSync(path.join(wpDir, 'wp-content/wdp-scope-sim-urls.json'), 'utf8'));
    urls.donation = probeMeta.products.fixed.path;
    for (const pg of PAGES.filter((p) => !only.length || only.includes(p.id))) {
      const url = `${base}${urls[pg.page]}`;
      const samples = { off: [], on: [] };
      for (let i = 0; i < runs; i += 1) {
        for (const mode of i % 2 ? ['on', 'off'] : ['off', 'on']) {
          setState(mode === 'off' ? { plugin_off: 1 } : {});
          await fetch(url, { signal: AbortSignal.timeout(120000) }); // ısınma
          samples[mode].push(lighthouse(url));
        }
      }
      const med = (mode, k) => median(samples[mode].map((s) => s[k]));
      const sum = (mode) => ({ score: med(mode, 'score'), lcp: med(mode, 'lcp'), cls: med(mode, 'cls'), tbt: med(mode, 'tbt'), fcp: med(mode, 'fcp') });
      const off = sum('off');
      const on = sum('on');
      const bad = judge(off, on);
      if (bad.length) violations.push(`${theme}/${pg.id}: ${bad.join('; ')}`);
      rows.push({ page: pg.id, off, on, bad, samples });
      console.log(`| ${pg.id} | ${off.score}→${on.score} | ${off.lcp.toFixed(0)}→${on.lcp.toFixed(0)} | ${off.cls.toFixed(3)}→${on.cls.toFixed(3)} | ${off.tbt.toFixed(0)}→${on.tbt.toFixed(0)} | ${bad.length ? 'KALDI: ' + bad.join('; ') : 'geçti'} |`);
    }
  } finally {
    await server.stop?.();
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${theme}.json`), JSON.stringify({ theme, runs, rows }, null, 2));
  console.log(violations.length ? `\nİHLAL (${violations.length}):\n- ${violations.join('\n- ')}` : '\nmeasure:lighthouse: ihlal yok');
  process.exit(violations.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
