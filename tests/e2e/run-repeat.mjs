#!/usr/bin/env node
/**
 * Tek işlevsel senaryoyu N kez tekrarla (yeni context).
 * Kullanım:
 *   npm run e2e:repeat -- sadaka-fixed-popup 20
 *   npm run e2e:repeat -- sadaka-fixed-popup 30 --parallel 3 --cpu 4 --slow-js
 * Başarısız denemede Playwright trace → build/e2e/traces/<senaryo>-<n>.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { loadE2EEnv, ROOT, productPaths, withCacheBust } from './helpers/env.mjs';
import { ensureAuth, AUTH_FILE } from './helpers/auth.mjs';
import { resolveAllProductPaths } from './helpers/checks.mjs';
import {
  readProductSadakaAdminConfig,
  runSadakaScenario,
} from './helpers/capture.mjs';

const TRACES_DIR = path.join(ROOT, 'build/e2e/traces');

/**
 * @param {string} name
 * @returns {{ productKey: 'fixed'|'custom', mode: 'popup'|'panel' }}
 */
function parseScenario(name) {
  const m = String(name || '').trim().match(/^sadaka-(fixed|custom)-(popup|panel)$/i);
  if (!m) {
    throw new Error(
      `Desteklenen senaryo: sadaka-fixed-popup|sadaka-fixed-panel|sadaka-custom-popup|sadaka-custom-panel (verilen: ${name})`
    );
  }
  return {
    productKey: /** @type {'fixed'|'custom'} */ (m[1].toLowerCase()),
    mode: /** @type {'popup'|'panel'} */ (m[2].toLowerCase()),
  };
}

/**
 * @param {string[]} argv
 */
function parseFlags(argv) {
  let parallel = 1;
  let cpu = 0;
  let slowJs = false;
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--parallel') {
      parallel = Math.max(1, Math.min(8, Number.parseInt(String(argv[++i] || '1'), 10) || 1));
    } else if (a.startsWith('--parallel=')) {
      parallel = Math.max(1, Math.min(8, Number.parseInt(a.slice('--parallel='.length), 10) || 1));
    } else if (a === '--cpu') {
      cpu = Math.max(0, Number.parseInt(String(argv[++i] || '0'), 10) || 0);
    } else if (a.startsWith('--cpu=')) {
      cpu = Math.max(0, Number.parseInt(a.slice('--cpu='.length), 10) || 0);
    } else if (a === '--slow-js') {
      slowJs = true;
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }
  return { positional, parallel, cpu, slowJs };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * @param {import('@playwright/test').BrowserContext} ctx
 * @param {{ cpu: number, slowJs: boolean }} load
 */
async function applyLoadStress(ctx, load) {
  if (load.slowJs) {
    // Side-panel open: çift rAF ile resetForm geciksin → doldurma yarışını zorla
    await ctx.addInitScript(() => {
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function (cb) {
        return orig(function (ts) {
          try {
            const sk = document.querySelector('.wdp-modal.show.wdp-is-skeleton');
            if (sk) {
              window.setTimeout(function () {
                cb(ts);
              }, 900 + Math.floor(Math.random() * 1100));
              return;
            }
          } catch (e) {
            /* fall through */
          }
          cb(ts);
        });
      };
    });
    await ctx.route('**/*', async (route) => {
      const req = route.request();
      const url = req.url();
      const post = typeof req.postData === 'function' ? req.postData() || '' : '';
      const isWdpJs =
        /donation-modal[^/]*\.js/i.test(url) ||
        /\/assets\/js\/.*wdp/i.test(url) ||
        /woo-donation|donation-popup/i.test(url);
      const isAdminAjax = /admin-ajax\.php/i.test(url);
      const isRenderModal =
        isAdminAjax && /action=wdp_render_modal|wdp_render_modal/i.test(post + url);
      const isProductInfo =
        isAdminAjax && /action=wdp_get_product_info|wdp_get_product_info/i.test(post + url);
      if (isRenderModal || isProductInfo) {
        // Form yerleşimi / resetForm yarışını doldurma sırasında zorla
        const delay = 800 + Math.floor(Math.random() * 1201);
        await new Promise((r) => setTimeout(r, delay));
      } else if (isWdpJs || isAdminAjax) {
        const delay = 200 + Math.floor(Math.random() * 1301);
        await new Promise((r) => setTimeout(r, delay));
      }
      await route.continue();
    });
  }
  if (load.cpu > 1) {
    ctx.on('page', (page) => {
      page
        .context()
        .newCDPSession(page)
        .then((client) => client.send('Emulation.setCPUThrottlingRate', { rate: load.cpu }))
        .catch(() => {});
    });
  }
}

/**
 * @param {object} opts
 */
async function runOneAttempt(opts) {
  const {
    browser,
    contextOpts,
    i,
    count,
    scenarioName,
    productKey,
    mode,
    env,
    productUrls,
    slug,
    authed,
    adminConfigCache,
    load,
  } = opts;

  const ctx = await browser.newContext(contextOpts);
  await applyLoadStress(ctx, load);
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });

  /** @type {ReturnType<typeof import('./helpers/checks.mjs').makeFailure>[]} */
  const failures = [];
  const skips = [];
  const flaky = [];
  const stats = { passed: 0, skipped: 0, failed: 0 };
  /** @type {object|null} */
  let collected = null;

  let result;
  try {
    result = await runSadakaScenario({
      context: ctx,
      authed,
      env,
      productPath: productUrls[productKey],
      productSlug: slug,
      productKey,
      mode,
      failures,
      skips,
      stats,
      flaky,
      sadakaAmount: '5566',
      sadakaProductIds: [],
      adminConfigCache,
      failDiagnostics: {
        enabled: true,
        onCollected: (d) => {
          collected = d;
        },
      },
    });
  } catch (e) {
    failures.push({
      check: scenarioName,
      description: 'Senaryo exception',
      detail: String(e && e.message ? e.message : e),
    });
    result = { ok: false, check: scenarioName, skipped: false };
  }

  const ok = !!(result && result.ok && !result.skipped && failures.length === 0);
  const wasSkip = !!(result && result.skipped);
  /** @type {'pass'|'fail'|'skip'} */
  let status = 'fail';
  /** @type {object|null} */
  let failInfo = null;

  if (wasSkip) {
    status = 'skip';
    await ctx.tracing.stop({ path: path.join(TRACES_DIR, `${scenarioName}-${i}-skip.zip`) }).catch(() => {});
  } else if (ok) {
    status = 'pass';
    await ctx.tracing.stop({ path: path.join(TRACES_DIR, `${scenarioName}-${i}-ok.zip`) }).catch(() => {});
    try {
      fs.unlinkSync(path.join(TRACES_DIR, `${scenarioName}-${i}-ok.zip`));
    } catch (e) {
      /* ignore */
    }
  } else {
    status = 'fail';
    const tracePath = path.join(TRACES_DIR, `${scenarioName}-${i}.zip`);
    await ctx.tracing.stop({ path: tracePath }).catch(() => {});
    failInfo = {
      attempt: i,
      check: scenarioName,
      failures,
      collected,
      trace: path.relative(ROOT, tracePath),
    };
    writeJson(path.join(TRACES_DIR, `${scenarioName}-${i}.json`), failInfo);
  }

  await ctx.close().catch(() => {});
  return {
    i,
    count,
    status,
    flaky: !!(result && result.flaky),
    failInfo,
    collected,
    failures,
  };
}

function printFailDetail(i, count, scenarioName, failInfo) {
  console.error(`[${i}/${count}] BAŞARISIZ → ${(failInfo && failInfo.trace) || '?'}`);
  const collected = failInfo && failInfo.collected;
  if (collected) {
    const net = (collected.ajax && collected.ajax.networkRaw) || [];
    console.error(
      '  network(15):',
      net
        .slice(-15)
        .map((n) => `${n.method} ${n.status} action=${n.action || '-'} ${String(n.url || '').slice(0, 80)}`)
        .join(' | ') || '(yok)'
    );
    const cd = collected.clickDiag || {};
    console.error('  formFlags:', JSON.stringify(cd.formFlags || {}));
    console.error('  topAtPoint:', JSON.stringify(cd.topAtPoint || null));
    console.error('  modules:', JSON.stringify(cd.modules || {}));
    console.error('  buttonHTML:', String(cd.buttonOuterHTML || '').slice(0, 200));
    console.error('  mutations:', JSON.stringify(collected.mutationSummary || {}));
    console.error('  POST sadaka_*:', JSON.stringify(collected.postedSadaka || {}));
    console.error('  errsAfter:', (collected.errsAfter || []).join(' | ') || '(yok)');
  } else if (failInfo && failInfo.failures && failInfo.failures[0]) {
    console.error('  ', failInfo.failures[0].description);
    console.error('  ', String(failInfo.failures[0].detail || '').split('\n').slice(0, 4).join('\n  '));
  }
  void scenarioName;
}

async function main() {
  const { positional, parallel, cpu, slowJs } = parseFlags(
    process.argv.slice(2).filter((a) => a !== '--')
  );
  const scenarioName = positional[0];
  const count = Math.max(1, Math.min(100, Number.parseInt(String(positional[1] || '1'), 10) || 1));
  if (!scenarioName) {
    console.error('Kullanım: npm run e2e:repeat -- <senaryo> <adet> [--parallel N] [--cpu N] [--slow-js]');
    console.error('Örnek: npm run e2e:repeat -- sadaka-fixed-popup 30 --parallel 3 --cpu 4 --slow-js');
    process.exit(1);
  }

  const { productKey, mode } = parseScenario(scenarioName);
  let env;
  try {
    env = loadE2EEnv();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  fs.mkdirSync(TRACES_DIR, { recursive: true });
  await ensureAuth(env);

  const browser = await chromium.launch();
  const contextOpts = {
    viewport: { width: 1440, height: 900 },
    reducedMotion: /** @type {'reduce'} */ ('reduce'),
  };

  const probeCtx = await browser.newContext(contextOpts);
  const probe = await probeCtx.newPage();
  await probe.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
  const products = productPaths(env);
  const productUrls = await resolveAllProductPaths(probe, env.E2E_BASE_URL, products);
  await probeCtx.close();

  const authed = await browser.newContext({
    ...contextOpts,
    storageState: AUTH_FILE,
  });
  const adminConfigCache = new Map();
  const slug = products[productKey];
  const cfg = await readProductSadakaAdminConfig(authed, env, slug);
  adminConfigCache.set(slug, cfg);
  if (!cfg.expected) {
    console.error(`Senaryo atlanır — yapılandırma yok: ${cfg.reason} (${cfg.detail})`);
    await authed.close();
    await browser.close();
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  /** @type {object|null} */
  let firstFail = null;
  const load = { cpu, slowJs };

  console.log(`e2e:repeat ${scenarioName} × ${count}`);
  console.log(
    `ürün=${slug} path=${productUrls[productKey]} wcAlt=${cfg.resolvedWcId} parallel=${parallel} cpu=${cpu || '-'} slow-js=${slowJs ? 'on' : 'off'}`
  );

  let next = 1;
  const workers = Array.from({ length: Math.min(parallel, count) }, async () => {
    while (true) {
      const i = next++;
      if (i > count) break;
      const outcome = await runOneAttempt({
        browser,
        contextOpts,
        i,
        count,
        scenarioName,
        productKey,
        mode,
        env,
        productUrls,
        slug,
        authed,
        adminConfigCache,
        load,
      });
      if (outcome.status === 'skip') {
        skipped += 1;
        console.log(`[${outcome.i}/${count}] atlandı`);
      } else if (outcome.status === 'pass') {
        passed += 1;
        console.log(`[${outcome.i}/${count}] geçti${outcome.flaky ? ' (flaky)' : ''}`);
      } else {
        failed += 1;
        printFailDetail(outcome.i, count, scenarioName, outcome.failInfo);
        if (!firstFail && outcome.failInfo) firstFail = outcome.failInfo;
      }
    }
  });
  await Promise.all(workers);

  await authed.close();
  await browser.close();

  const total = passed + failed;
  const rate = total ? ((passed / total) * 100).toFixed(1) : '0.0';
  console.log('');
  console.log('=== e2e:repeat özet ===');
  console.log(`senaryo=${scenarioName} deneme=${count} parallel=${parallel} cpu=${cpu || '-'} slow-js=${slowJs}`);
  console.log(`geçti=${passed} başarısız=${failed} atlandı=${skipped} oran=${rate}%`);
  if (firstFail) {
    console.log(`ilk hata: deneme #${firstFail.attempt} trace=${firstFail.trace}`);
    writeJson(path.join(TRACES_DIR, `${scenarioName}-first-fail.json`), firstFail);
    const cd = (firstFail.collected && firstFail.collected.clickDiag) || {};
    console.log('--- ilk hata teşhis özeti ---');
    console.log('formFlags:', JSON.stringify(cd.formFlags || {}));
    console.log('modules:', JSON.stringify(cd.modules || {}));
    console.log('topAtPoint:', JSON.stringify(cd.topAtPoint || null));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
