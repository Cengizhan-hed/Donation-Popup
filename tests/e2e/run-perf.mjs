#!/usr/bin/env node
/**
 * Form açılış hızı ölçümü (eklenti koduna dokunmaz).
 *
 *   npm run e2e:perf
 *
 * Her sayfa × kabuk için 5 tekrar (soğuk + ılık context ayrı).
 * Çıktı: build/e2e/perf/report.md + konsol özeti.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { loadE2EEnv, ROOT, productPaths, withCacheBust } from './helpers/env.mjs';
import { ensureAuth } from './helpers/auth.mjs';
import {
  CHECK_MS,
  extractPostActionFromRequest,
  openShellLocator,
  resolveAllProductPaths,
  resolveProductIdBySlug,
  shellTriggerLocator,
} from './helpers/checks.mjs';
import { SEL } from './helpers/selectors.mjs';

const PERF_DIR = path.join(ROOT, 'build/e2e/perf');
const REPEATS = 5;
const DESKTOP = { width: 1440, height: 900 };

const WDP_ACTIONS = new Set([
  'wdp_get_product_info',
  'wdp_render_modal',
  'wdp_ajax_add_to_cart',
]);

/**
 * @param {number[]} arr
 * @returns {{ median: number, worst: number, mean: number, n: number }}
 */
function stats(arr) {
  const a = arr.filter((n) => Number.isFinite(n)).slice().sort((x, y) => x - y);
  if (!a.length) return { median: NaN, worst: NaN, mean: NaN, n: 0 };
  const mid = Math.floor(a.length / 2);
  const median = a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  return { median, worst: a[a.length - 1], mean, n: a.length };
}

/**
 * @param {number} n
 */
function fmtMs(n) {
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}`;
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ loaded: boolean, url: string, async: string, defer: string }>}
 */
async function probeWdpBundle(page) {
  return page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const hit = scripts.find((s) => {
      const src = s.getAttribute('src') || '';
      return /donation|wdp|woo-donation/i.test(src) && /\.js(\?|$)/i.test(src);
    });
    if (!hit) {
      const hasApp = !!(window.WDPApp && (window.WDPApp.modal || window.WDPApp.lazyModal));
      return { loaded: hasApp, url: hasApp ? '(inline/global)' : '', async: '', defer: '' };
    }
    return {
      loaded: true,
      url: hit.getAttribute('src') || '',
      async: hit.hasAttribute('async') ? 'async' : '',
      defer: hit.hasAttribute('defer') ? 'defer' : '',
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {number} productId
 */
async function countShellInDom(page, mode, productId) {
  return page.evaluate(
    ({ modeSel, id }) => {
      const wantPanel = modeSel === 'panel';
      const nodes = Array.from(document.querySelectorAll('.hdf-donation-modal-wrapper.wdp-modal'));
      const match = nodes.filter((el) => {
        const isPanel = el.classList.contains('wdp-side-panel');
        if (wantPanel !== isPanel) return false;
        if (!id) return true;
        const pid =
          el.getAttribute('data-product-id') ||
          (el.querySelector('input[name="wdp_product_id"]') || {}).value ||
          '';
        return String(pid) === String(id) || el.id.includes(String(id));
      });
      return {
        count: match.length,
        ids: match.map((el) => el.id || '(no-id)').slice(0, 5),
        lazyTriggers: Array.from(
          document.querySelectorAll(
            wantPanel
              ? '.wdp-open-side-panel[data-wdp-lazy]'
              : '.wdp-open-modal:not(.wdp-open-side-panel)[data-wdp-lazy]'
          )
        ).length,
        embedded: match.filter((el) => !el.classList.contains('show')).length,
      };
    },
    { modeSel: mode, id: productId || 0 }
  );
}

/**
 * Tıklamadan kabuk hazır olana kadar ölç.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} trigger
 * @param {'popup'|'panel'} mode
 */
async function measureOpen(page, trigger, mode) {
  /** @type {Array<{ action: string, ms: number, bytes: number, when: 'pre'|'post', url: string }>} */
  const ajax = [];
  /** @type {{ t: number }} */
  const clickMark = { t: Number.POSITIVE_INFINITY };

  const onReq = (req) => {
    if (req.method() !== 'POST') return;
    const url = req.url();
    if (!/admin-ajax\.php/i.test(url) && !/[?&]wc-ajax=/i.test(url)) return;
    const action = extractPostActionFromRequest(req) || '(unknown)';
    if (!WDP_ACTIONS.has(action) && !/^wdp_/i.test(action)) return;
    const started = Date.now();
    req
      .response()
      .then(async (res) => {
        let bytes = 0;
        try {
          const buf = await res.body();
          bytes = buf ? buf.length : 0;
        } catch (e) {
          /* ignore */
        }
        ajax.push({
          action,
          ms: Date.now() - started,
          bytes,
          when: started < clickMark.t ? 'pre' : 'post',
          url: url.slice(0, 120),
        });
      })
      .catch(() => {});
  };

  page.on('request', onReq);

  const productIdAttr = (await trigger.getAttribute('data-product-id').catch(() => '')) || '';
  const productIdNum = Number.parseInt(String(productIdAttr), 10) || 0;
  const bundleBefore = await probeWdpBundle(page);
  const shellBefore = await countShellInDom(page, mode, productIdNum);

  await trigger.waitFor({ state: 'visible', timeout: CHECK_MS });
  clickMark.t = Date.now();

  const timing = await page.evaluate(
    async ({ triggerSel, productId, openSel }) => {
      const t0 = performance.now();
      /** @type {HTMLElement|null} */
      let btn = null;
      if (productId) {
        btn = document.querySelector(`${triggerSel}[data-product-id="${productId}"]`);
      }
      if (!btn) btn = /** @type {HTMLElement|null} */ (document.querySelector(triggerSel));
      if (!btn) return { error: 'trigger-missing', domMs: NaN, visibleMs: NaN, unlockMs: NaN, readyMs: NaN };

      btn.click();

      const deadline = t0 + 15000;
      let domMs = NaN;
      let visibleMs = NaN;
      let unlockMs = NaN;
      let readyMs = NaN;

      while (performance.now() < deadline) {
        const shell = document.querySelector(openSel);
        if (shell && !Number.isFinite(domMs)) {
          domMs = performance.now() - t0;
        }
        if (shell) {
          const st = window.getComputedStyle(shell);
          const vis =
            st.display !== 'none' &&
            st.visibility !== 'hidden' &&
            Number.parseFloat(st.opacity || '1') > 0.05;
          if (vis && !Number.isFinite(visibleMs)) {
            visibleMs = performance.now() - t0;
          }
          const name = shell.querySelector('input[name="donation_full_name"]');
          const locked =
            shell.classList.contains('wdp-is-skeleton') ||
            shell.getAttribute('aria-busy') === 'true' ||
            !!(name && (/** @type {HTMLInputElement} */ (name).disabled || /** @type {HTMLInputElement} */ (name).readOnly));
          if (name && !locked && !Number.isFinite(unlockMs)) {
            const input = /** @type {HTMLInputElement} */ (name);
            if (!input.disabled) {
              unlockMs = performance.now() - t0;
            }
          }
          const form = shell.querySelector('form.wdp-donation-form-fields');
          const addBtn = shell.querySelector('button[name="donation_add_to_cart"]');
          if (
            Number.isFinite(unlockMs) &&
            form &&
            addBtn &&
            !shell.classList.contains('wdp-is-skeleton') &&
            !Number.isFinite(readyMs)
          ) {
            readyMs = performance.now() - t0;
            break;
          }
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { domMs, visibleMs, unlockMs, readyMs, error: null };
    },
    {
      triggerSel: mode === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger,
      productId: productIdAttr,
      openSel: mode === 'panel' ? SEL.openSidePanel : SEL.openCenteredPopup,
    }
  );

  const shell = openShellLocator(page, mode);
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  page.off('request', onReq);

  const isPanel = await shell
    .evaluate((el) => el.classList.contains('wdp-side-panel'))
    .catch(() => null);

  return {
    clickToDomMs: timing.domMs,
    clickToVisibleMs: timing.visibleMs,
    clickToUnlockMs: timing.unlockMs,
    clickToReadyMs: timing.readyMs,
    error: timing.error || null,
    bundleBeforeClick: bundleBefore,
    shellBeforeClick: shellBefore,
    openedIsSidePanel: isPanel,
    ajax: ajax.slice(),
  };
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {object} opts
 */
async function runOneTrial(browser, opts) {
  const { env, pagePath, mode, productId, warm, guestExtra, label } = opts;
  const context = await browser.newContext({
    viewport: DESKTOP,
    reducedMotion: 'reduce',
    storageState: warm ? undefined : undefined,
  });
  // Soğuk: hiç cache yok; ılık: aynı context’te ikinci yükleme
  const page = await context.newPage();
  const url = withCacheBust(env.E2E_BASE_URL, pagePath, guestExtra);

  if (warm) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 300));
    // Aynı context’te ikinci yükleme (HTTP cache / JS heap ılık)
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  await new Promise((r) => setTimeout(r, 200));

  let trigger = shellTriggerLocator(page, mode, { productId });
  if ((await trigger.count().catch(() => 0)) === 0 && mode === 'popup') {
    // Liste kartı yoksa genel donate (yanlışlıkla panel olabilir — raporda işaretlenir)
    trigger = page.locator(SEL.donateTrigger).first();
  }
  if ((await trigger.count().catch(() => 0)) === 0 && mode === 'panel') {
    trigger = page.locator(SEL.sidePanelTrigger).first();
  }
  if ((await trigger.count().catch(() => 0)) === 0) {
    await context.close();
    return {
      label,
      warm,
      mode,
      pagePath,
      error: 'trigger-not-found',
      clickToDomMs: NaN,
      clickToVisibleMs: NaN,
      clickToUnlockMs: NaN,
      clickToReadyMs: NaN,
      ajax: [],
      bundleBeforeClick: { loaded: false },
      shellBeforeClick: { count: 0 },
      openedIsSidePanel: null,
    };
  }

  const result = await measureOpen(page, trigger, mode);
  await context.close().catch(() => {});
  return { label, warm, mode, pagePath, productId, ...result };
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

async function main() {
  const started = Date.now();
  let env;
  try {
    env = loadE2EEnv();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  fs.mkdirSync(PERF_DIR, { recursive: true });
  await ensureAuth(env);

  const browser = await chromium.launch();
  const probe = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'reduce' });
  const probePage = await probe.newPage();
  await probePage.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
  const products = productPaths(env);
  const productUrls = await resolveAllProductPaths(probePage, env.E2E_BASE_URL, products);
  /** @type {Record<string, number>} */
  const productIds = {};
  for (const [key, slug] of Object.entries(products)) {
    productIds[key] = await resolveProductIdBySlug(probePage, env.E2E_BASE_URL, slug);
  }
  await probePage.close();
  await probe.close();

  /** @type {Array<{ label: string, path: string, mode: 'popup'|'panel', productId: number, productKey?: string }>} */
  const targets = [];

  // Liste × gerçek popup (4 ürün tipi — kısa kod button=popup beklenir)
  for (const key of /** @type {const} */ (['fixed', 'custom', 'shares', 'campaign'])) {
    targets.push({
      label: `list-popup-${key}`,
      path: env.E2E_LIST_PAGE,
      mode: 'popup',
      productId: productIds[key] || 0,
      productKey: key,
    });
  }
  // Mağaza × panel (loop_button varsayılan panel)
  targets.push({
    label: 'shop-panel',
    path: env.E2E_SHOP_PAGE,
    mode: 'panel',
    productId: productIds.fixed || 0,
    productKey: 'fixed',
  });
  // Ürün sayfaları × panel (display varsayılan button_panel)
  for (const key of /** @type {const} */ (['fixed', 'custom', 'shares', 'campaign'])) {
    targets.push({
      label: `product-${key}-panel`,
      path: productUrls[key],
      mode: 'panel',
      productId: productIds[key] || 0,
      productKey: key,
    });
  }

  /** @type {object[]} */
  const allTrials = [];
  console.log(`E2E perf — ${targets.length} hedef × ${REPEATS} tekrar × (soğuk+ılık)`);

  for (const target of targets) {
    for (const warm of [false, true]) {
      const kind = warm ? 'warm' : 'cold';
      console.log(`  → ${target.label} [${kind}]`);
      for (let i = 0; i < REPEATS; i++) {
        const trial = await runOneTrial(browser, {
          env,
          pagePath: target.path,
          mode: target.mode,
          productId: target.productId,
          warm,
          guestExtra: {},
          label: `${target.label}/${kind}`,
        });
        allTrials.push({ ...trial, target: target.label, productKey: target.productKey, repeat: i + 1 });
        process.stdout.write('.');
      }
      process.stdout.write('\n');
    }
  }

  await browser.close();

  // Grupla
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const t of allTrials) {
    const k = `${t.target}|${t.warm ? 'warm' : 'cold'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }

  const summaryRows = [];
  const detailBlocks = [];

  for (const [key, trials] of groups) {
    const [target, kind] = key.split('|');
    const dom = stats(trials.map((t) => t.clickToDomMs));
    const vis = stats(trials.map((t) => t.clickToVisibleMs));
    const unlock = stats(trials.map((t) => t.clickToUnlockMs));
    const ready = stats(trials.map((t) => t.clickToReadyMs));
    const panelFlags = trials.map((t) => t.openedIsSidePanel);
    const ajaxActions = {};
    for (const t of trials) {
      for (const a of t.ajax || []) {
        const ak = `${a.action}@${a.when}`;
        if (!ajaxActions[ak]) ajaxActions[ak] = [];
        ajaxActions[ak].push(a.ms);
      }
    }
    const ajaxSummary = Object.entries(ajaxActions)
      .map(([ak, ms]) => {
        const s = stats(ms);
        return `${ak}: med=${fmtMs(s.median)}ms worst=${fmtMs(s.worst)}ms n=${s.n}`;
      })
      .join('; ');

    const sample = trials[0] || {};
    const htmlReady = sample.shellBeforeClick && sample.shellBeforeClick.count > 0;
    const lazy = sample.shellBeforeClick && sample.shellBeforeClick.lazyTriggers > 0;
    const bundle = sample.bundleBeforeClick || {};

    summaryRows.push([
      target,
      kind,
      fmtMs(dom.median),
      fmtMs(dom.worst),
      fmtMs(vis.median),
      fmtMs(unlock.median),
      fmtMs(ready.median),
      fmtMs(ready.worst),
      htmlReady ? 'evet' : 'hayır',
      lazy ? 'lazy' : 'embed?',
      bundle.loaded ? 'evet' : 'hayır',
      panelFlags.every((f) => f === true) ? 'panel' : panelFlags.every((f) => f === false) ? 'popup' : 'karışık',
    ]);

    detailBlocks.push(
      `### ${target} (${kind})\n\n` +
        `- DOM: med ${fmtMs(dom.median)} / worst ${fmtMs(dom.worst)}\n` +
        `- Görünür: med ${fmtMs(vis.median)} / worst ${fmtMs(vis.worst)}\n` +
        `- Kilit kalktı: med ${fmtMs(unlock.median)} / worst ${fmtMs(unlock.worst)}\n` +
        `- Form hazır: med ${fmtMs(ready.median)} / worst ${fmtMs(ready.worst)}\n` +
        `- Tıklama öncesi kabuk DOM’da: ${htmlReady ? 'evet' : 'hayır'} (lazy tetik: ${lazy ? 'evet' : 'hayır'})\n` +
        `- Bundle tıklama öncesi: ${bundle.loaded ? 'yüklü' : 'yok'} ${bundle.defer || ''} ${bundle.async || ''} ${bundle.url || ''}\n` +
        `- Açılan kabuk: ${panelFlags.filter((f) => f === true).length} panel / ${panelFlags.filter((f) => f === false).length} popup\n` +
        `- AJAX: ${ajaxSummary || '(yok)'}\n`
    );
  }

  const placementNotes = `
## Popup vs panel — hangi ayar neyi seçtirir

| Yüzey | Ayar / kaynak | Dosya | Değerler |
| --- | --- | --- | --- |
| Ürün sayfası (auto_place) | \`wdp_placement_settings.display\` | \`includes/class-placement-settings.php:37\` varsayılan \`button_panel\`; uygulama \`includes/class-product-page-integration.php:302-310\` | \`inline\` / \`button_popup\` / \`button_panel\` |
| Mağaza / döngü | \`wdp_placement_settings.loop_button\` | \`class-placement-settings.php:40\` varsayılan \`panel\`; \`class-product-page-integration.php:365-378\` | \`link\` / \`popup\` / \`panel\` / \`off\` |
| Liste kısa kodu \`[wdp_donations]\` | \`button\` özniteliği | \`includes/class-donations-list.php:103\` varsayılan \`panel\`; kart \`530-533\` | \`panel\` / \`popup\` / \`link\` |
| Tek buton kısa kod | etiket | \`includes/class-shortcodes.php:33-52\` — \`wdp_donation_button\` → popup, \`wdp_donation_button_panel\` → panel | — |
| Lazy HTML | \`data-wdp-lazy=1\` | liste/döngü kartları; \`assets/js/src/lazy-modal.js\` → \`wdp_render_modal\` | gömülü shortcode: lazy=false, HTML sayfada |

**Staging varsayılanı:** ürün + mağaza → sağ panel; \`/bagislar/\` kısa kodu \`button="popup"\` ise ortadaki gerçek popup.

## Olası hız farkı nedenleri (olasılık sırası)

1. **Sağ panel açılış animasyonu + çift rAF** (\`modal.js\` side panel yolu) — ortadaki popup’ta yok; kullanıcı 1–2 sn “geç” hissi.
2. **\`wdp_get_product_info\` / form init** — her açılışta; kilit \`runModalOpenInit\` finally’de kalkar ama panel slide ile örtüşür.
3. **Lazy \`wdp_render_modal\`** — liste/döngüde HTML tıklamada gelir; ürün sayfasında (button_panel) HTML genelde gömülü.
4. **JS bundle geç enqueue** (\`force_enqueue\` / footer) — tıklama anında \`WDPApp\` henüz yoksa gecikme.
5. **Prefetch** — hover’da \`lazyModal.prefetch\`; soğuk ilk tıklama vs ılık farkı.

## Önerilen düzeltmeler (henüz uygulama — eklenti kodu)

1. Ürün/mağaza için \`display=button_popup\` veya panel CSS/JS açılışını kısalt.
2. \`wdp_get_product_info\`’yu sayfa yükünde prefetch; açılışta beklemeyi kaldır.
3. Panel çift-rAF / skeleton süresini ölçüp gereksiz beklemeyi budamak.
4. Bundle’ı ürün/liste sayfalarında erken yükle (footer gecikmesini azalt).
`;

  const report =
    `# E2E form açılış perf raporu\n\n` +
    `Tarih: ${new Date().toISOString()}\n` +
    `Tekrar: ${REPEATS} (soğuk + ılık ayrı context)\n` +
    `Süre: ${((Date.now() - started) / 1000).toFixed(1)}s\n\n` +
    `## Özet tablo (ms)\n\n` +
    mdTable(
      [
        'Hedef',
        'Cache',
        'DOM med',
        'DOM worst',
        'Visible med',
        'Unlock med',
        'Ready med',
        'Ready worst',
        'HTML hazır',
        'Lazy?',
        'Bundle',
        'Kabuk',
      ],
      summaryRows
    ) +
    `\n` +
    detailBlocks.join('\n') +
    placementNotes;

  const reportFile = path.join(PERF_DIR, 'report.md');
  fs.writeFileSync(reportFile, report, 'utf8');
  fs.writeFileSync(path.join(PERF_DIR, 'raw.json'), JSON.stringify({ trials: allTrials, summaryRows }, null, 2));

  console.log('');
  console.log('=== Perf özeti (ready medyan ms) ===');
  for (const r of summaryRows) {
    console.log(`  ${r[0].padEnd(28)} ${r[1].padEnd(5)} ready med=${r[6]} worst=${r[7]} kabuk=${r[11]} html=${r[8]}`);
  }
  console.log(`Report: ${path.relative(ROOT, reportFile)}`);
  console.log(`Süre: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
