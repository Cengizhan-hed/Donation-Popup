#!/usr/bin/env node
/**
 * 12.2 fouc kare kare kanıt (CLAUDE.md §25): yavaş 4G (150 ms / 1.6 Mbps) + 4× CPU ile sayfa yüklemesinin ilk ~3 sn'si.
 * Chrome DevTools Protocol `Page.startScreencast` ile her kare PNG; aynı anda sayfa içinde her `requestAnimationFrame`'de
 * (boyamadan hemen önce) görünür eklenti öğelerinin hesaplanmış stilleri denetlenir → "stilsiz kare" sayısı.
 *
 *   Yerel (varsayılan; yerel WP + SQLite, tema seçilebilir):
 *     npm run e2e:queue -- node scripts/measure-first-paint.mjs [--theme storefront] [--views page,trigger]
 *   Uzak URL (yalnız GET + tarayıcı; yazma yok; uzak koşuyu yalnız Claude yapar):
 *     node scripts/measure-first-paint.mjs --url https://ornek.test/urun/ --name urun [--share-key-env E2E_COMING_SOON_SHARE_KEY]
 *
 * Seçenekler: --ms 3000 (kayıt süresi), --css-delay 0 (eklenti CSS isteklerine ek gecikme, ms).
 * Çıktı: build/e2e/first-paint/<ad>/kare-NN.png + ozet.json; konsolda `FIRST_PAINT {json}` satırı.
 * Ölçüm/reklam servisleri uzak koşuda engellenir (yalnız eklenti ve sayfa kaynakları).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build/e2e/first-paint');
const TRACKERS = /(google-analytics|googletagmanager|doubleclick|facebook\.net|connect\.facebook|hotjar|clarity\.ms|googleadservices)/i;

function flag(name, def = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] || '') : def;
}

/** Sayfa içi denetim (init betiği; tema-bağımsız, yalnız eklenti sınıfları). */
function probe() {
  const px = (v) => parseFloat(v) || 0;
  const transparent = (c) => !c || c === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(c);
  const box = (el) => el.getBoundingClientRect();
  const token = (el, name) => {
    const i = document.createElement('i');
    i.style.cssText = `position:absolute;inline-size:0;block-size:0;background:var(${name})`;
    el.appendChild(i);
    const c = getComputedStyle(i).backgroundColor;
    i.remove();
    return c;
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return el.isConnected && r.width >= 1 && r.height >= 1 && (typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true }));
  };
  const CHECKS = [
    [
      '.donation-panel-ac__trigger, .donation-panel-sc__trigger',
      (el) => box(el).width >= 40 && box(el).height >= 40 && px(getComputedStyle(el).borderTopLeftRadius) > 0,
    ],
    [
      '[data-dp-open], .donation-panel-btn--accent',
      (el) => {
        const w = token(el, '--_bg');
        return !transparent(w) && getComputedStyle(el).backgroundColor === w && box(el).height >= 44;
      },
    ],
    ['.donation-panel-bar', (el) => box(el).height >= 4 && box(el).height <= 32 && px(getComputedStyle(el).borderTopLeftRadius) > 0],
    ['.donation-panel-progress__nums, .wdp-list', (el) => /grid|flex/.test(getComputedStyle(el).display)],
    ['.donation-panel-amount', (el) => px(getComputedStyle(el).borderTopLeftRadius) > 0 && box(el).height >= 44],
    ['.donation-panel-custom, .donation-panel-input', (el) => box(el).height >= 48],
    ['.donation-panel-stepper button', (el) => box(el).width >= 44 && box(el).height >= 44],
    ['.donation-panel svg, .wdp-list-wrap svg', (el) => box(el).width <= 48 && box(el).height <= 48],
  ];
  const state = { frames: [] };
  window.__fpm = state;
  const loop = () => {
    let visible = 0;
    const bad = [];
    for (const [sel, ok] of CHECKS) {
      const els = Array.from(document.querySelectorAll(sel)).filter(shown).slice(0, 6);
      visible += els.length;
      for (const el of els) {
        let pass = false;
        try {
          pass = ok(el);
        } catch {
          pass = false;
        }
        if (!pass) bad.push(sel.split(',')[0]);
      }
    }
    state.frames.push({ t: Math.round(performance.now()), visible, bad: Array.from(new Set(bad)) });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/**
 * @param {import('@playwright/test').Browser} browser Tarayıcı.
 * @param {string} url Adres.
 * @param {string} name Çıktı adı.
 * @param {{ms:number, cssDelay:number, shareKey:string}} opt Seçenekler.
 */
async function measure(browser, url, name, opt) {
  const dir = path.join(OUT, name.replace(/[^a-z0-9_-]+/gi, '-'));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  if (opt.shareKey) {
    await context.addCookies([{ name: 'woo-share', value: opt.shareKey, url: new URL(url).origin }]);
  }
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (TRACKERS.test(u)) return route.abort();
    if (route.request().method() !== 'GET') return route.abort();
    if (opt.cssDelay > 0 && /\/woo-donation-popup\/.*\.css(\?|$)/.test(u)) await new Promise((r) => setTimeout(r, opt.cssDelay));
    return route.continue();
  });
  await page.addInitScript(probe);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  const shots = [];
  cdp.on('Page.screencastFrame', async (f) => {
    shots.push({ ts: f.metadata.timestamp, data: f.data });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch((e) => console.error(`ack: ${e.message}`));
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(opt.ms);
  await cdp.send('Page.stopScreencast');
  const frames = await page.evaluate(() => (window.__fpm ? window.__fpm.frames : []));
  await context.close();
  // ~50 ms aralıklı şerit: ardışık kareleri seyrelt.
  let last = -Infinity;
  let n = 0;
  for (const s of shots) {
    if (s.ts * 1000 - last < 50) continue;
    last = s.ts * 1000;
    n += 1;
    fs.writeFileSync(path.join(dir, `kare-${String(n).padStart(2, '0')}.png`), Buffer.from(s.data, 'base64'));
  }
  const withUi = frames.filter((f) => f.visible > 0);
  const unstyled = withUi.filter((f) => f.bad.length > 0);
  const summary = {
    name,
    url: url.replace(/woo-share=[^&]+/, 'woo-share=***'),
    wallMs: Date.now() - t0,
    rafFrames: frames.length,
    framesWithPluginUi: withUi.length,
    unstyledFrames: unstyled.length,
    firstUiAtMs: withUi.length ? withUi[0].t : null,
    unstyledSelectors: Array.from(new Set(unstyled.flatMap((f) => f.bad))),
    pngFrames: n,
  };
  fs.writeFileSync(path.join(dir, 'ozet.json'), JSON.stringify(summary, null, 2));
  console.log(`FIRST_PAINT ${JSON.stringify(summary)}`);
  return summary;
}

async function main() {
  const opt = { ms: Number(flag('--ms', '3000')) || 3000, cssDelay: Number(flag('--css-delay', '0')) || 0, shareKey: '' };
  const url = flag('--url');
  const targets = [];
  let stop = async () => {};
  if (url) {
    if (/hedefdernegi\.org/i.test(url) && !/staging30\./i.test(url)) {
      console.error('Canlı alan adı hedef olamaz.');
      process.exit(2);
    }
    const envName = flag('--share-key-env');
    opt.shareKey = envName ? String(process.env[envName] || '') : '';
    targets.push({ url, name: flag('--name', 'uzak') });
  } else {
    const { bootQualityWorker } = await import('../tests/e2e/helpers/quality-env.mjs');
    const theme = flag('--theme', 'storefront');
    const port = Number(process.env.WDP_FP_PORT || 8961) || 8961;
    const w = await bootQualityWorker({ id: `fp-${theme}`, theme, store: 'try', checkout: 'classic', hpos: true }, port);
    fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers/wdp-first-paint-sim.php'), path.join(w.wpDir, 'wp-content/mu-plugins/wdp-first-paint-sim.php'));
    stop = () => w.server.stop();
    const ids = `dp_product=${w.probe.products.custom.id}&dp_fixed=${w.probe.products.fixed.id}&dp_campaign=${w.probe.products.campaign.id}`;
    for (const view of flag('--views', 'page,trigger,slider,ajax').split(',')) {
      targets.push({ url: `${w.base}/?dp_fp=${view}&${ids}`, name: `${flag('--label', 'yerel')}-${theme}-${view}` });
    }
  }
  const browser = await chromium.launch();
  let total = 0;
  try {
    for (const t of targets) {
      total += (await measure(browser, t.url, t.name, opt)).unstyledFrames;
    }
  } finally {
    await browser.close();
    await stop();
  }
  console.log(`FIRST_PAINT_TOTAL stilsiz_kare=${total}`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
