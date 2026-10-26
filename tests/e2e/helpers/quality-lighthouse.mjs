/**
 * Lighthouse (E8B): mobil emülasyon + simüle throttling; bağış ürün sayfası, ödeme sayfası, mağaza. Yerel Chromium (Playwright).
 * Eşik: performans >= 90, erişilebilirlik >= 95.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { setQualityState } from './quality-env.mjs';
import { startGzipProxy } from './gzip-proxy.mjs';

export const LH_MIN = { performance: 90, accessibility: 95 };
const LH_PORT = Number(process.env.WDP_Q_LH_PORT || 9422) || 9422;

/**
 * @param {{base:string, wpDir:string}} w İşçi.
 * @param {object} qcfg Yapılandırma.
 * @param {{engine?:string}} [opts] Seçenekler.
 * @return {Promise<object[]>} Satırlar.
 */
export async function runLighthouse(w, qcfg, opts = {}) {
  const engine = opts.engine || 'new';
  setQualityState(w.wpDir, { engine, modules: 'all', override: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-lh-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${LH_PORT}`, '--no-sandbox'],
  });
  const rows = [];
  const originPort = Number(new URL(w.base).port);
  const proxy = await startGzipProxy(originPort, Number(process.env.WDP_Q_PROXY_PORT || originPort + 500));
  const base = proxy.base;
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const cdp = await ctx.newCDPSession(page);
    // E8W: ürün ve mağaza ilk ziyaretçi gibi BOŞ sepetle ölçülür. Sepet doluyken ürün sayfasında WooCommerce mini-sepet
    // blok varlıkları (~1 MB) yüklenir; eklentisiz kontrolde de sepet kalamaz (bağış ürünü eklenti pasifken geçersiz sayılıp
    // sepetten düşer), bu yüzden karşılaştırma yanıltır. Sepetli ürün sayfası ve ödeme bağış sepetiyle ayrıca ölçülür;
    // sepetli ürün için kontrol: eklentinin tüm varlıkları çıkarılmış aynı sayfa.
    const addToCart = () => page.request.get(`${base}/?dp_q_add=${qcfg.ids.custom}&amount=${qcfg.store.amount || 50}`);
    const targets = [
      { page: 'urun', path: qcfg.ids.fixedPath },
      { page: 'magaza', path: '/shop/' },
      { page: 'urun-sepetli', path: qcfg.ids.fixedPath, cart: true, controlQuery: 'dp_q_strip=all' },
      { page: 'odeme', path: new URL(qcfg.checkoutUrl).pathname, cart: true },
    ];
    let cartAdded = false;
    const RUNS = Number(process.env.WDP_Q_LH_RUNS || 3) || 3;
    const median = (arr) => [...arr].sort((x, y) => x - y)[Math.floor(arr.length / 2)];
    /** Her sayfa RUNS kez ölçülür; skorlar/metrikler medyan (Lighthouse koşular arası oynaklığı yüksek). */
    const measure = async (pathname) => {
      await page.goto(`${base}${pathname}`); // ısınma: ilk istek (PHP/SQLite) yavaş
      const runs = [];
      for (let i = 0; i < RUNS; i += 1) {
        // Soğuk önbellek: çerezler (sepet) korunur, HTTP önbelleği her ölçümden önce temizlenir (kontrol sayfası kazanmasın).
        await cdp.send('Network.clearBrowserCache');
        const r = await lighthouse(`${base}${pathname}`, { port: LH_PORT, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility'], disableStorageReset: true }, undefined);
        runs.push(r.lhr);
      }
      const med = (fn) => median(runs.map(fn));
      return {
        perf: Math.round(med((l) => l.categories.performance.score || 0) * 100),
        a11y: Math.round(med((l) => l.categories.accessibility.score || 0) * 100),
        lcp: Math.round(med((l) => l.audits['largest-contentful-paint'].numericValue)),
        tbt: Math.round(med((l) => l.audits['total-blocking-time'].numericValue)),
        cls: +med((l) => l.audits['cumulative-layout-shift'].numericValue || 0).toFixed(3),
        ttfb: Math.round(med((l) => (l.audits['server-response-time'] || { numericValue: 0 }).numericValue)),
        perfRuns: runs.map((l) => Math.round((l.categories.performance.score || 0) * 100)),
        a11yNodes: runs
          .flatMap((l) =>
            (l.categories.accessibility.auditRefs || [])
              .map((ref) => l.audits[ref.id])
              .filter((a) => a && a.score === 0)
              .flatMap((a) => ((a.details && a.details.items) || []).slice(0, 3).map((i) => `${a.id}: ${((i.node && i.node.snippet) || '').slice(0, 140)}`))
          )
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .slice(0, 6),
        a11yFails: [
          ...new Set(
            runs.flatMap((l) =>
              (l.categories.accessibility.auditRefs || [])
                .map((ref) => l.audits[ref.id])
                .filter((a) => a && a.score === 0)
                .map((a) => a.id)
            )
          ),
        ],
      };
    };
    for (const t of targets) {
      if (t.cart && !cartAdded) {
        await addToCart();
        cartAdded = true;
      }
      const m = await measure(t.path);
      const control = await measure(`${t.path}${t.path.includes('?') ? '&' : '?'}${t.controlQuery || 'dp_q_off=1'}`);
      const meetsAbs = m.perf >= LH_MIN.performance;
      // Ortam sınırı: eklentisiz aynı sayfa da eşiğin altındaysa ve eklenti kaynaklı kayıp (taban - ölçüm) <= 3 puansa ortam sınırlı sayılır.
      const envLimited = !meetsAbs && control.perf < LH_MIN.performance && control.perf - m.perf <= 3;
      rows.push({
        config: qcfg.id,
        theme: qcfg.theme,
        engine,
        page: t.page,
        performance: m.perf,
        perfRuns: m.perfRuns,
        controlPerformance: control.perf,
        accessibility: m.a11y,
        lcpMs: m.lcp,
        controlLcpMs: control.lcp,
        tbtMs: m.tbt,
        cls: m.cls,
        controlCls: control.cls,
        ttfbMs: m.ttfb,
        a11yFails: m.a11yFails,
        a11yNodes: m.a11yNodes,
        perfStatus: meetsAbs ? 'gecti' : envLimited ? 'ortam-sinirli' : 'esik-alti',
        ok: (meetsAbs || envLimited) && m.a11y >= LH_MIN.accessibility,
      });
    }
  } finally {
    await ctx.close();
    await proxy.stop();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  return rows;
}
