#!/usr/bin/env node
/**
 * Çoklu para birimi tutar ölçümü (salt ölçüm; sipariş yok, ödeme formu doldurulmaz).
 *
 *   node tests/e2e/run-curcy-check.mjs --env local [--codes EUR,USD]   (yerel; currencySwitch yoksa temiz atlar)
 *   node tests/e2e/run-curcy-check.mjs --env staging                    (yalnız Claude)
 *
 * Her kod için: ?<param>=KOD → işaretli 'custom' test ürünü → formda 100 yaz → sepete ekle →
 * Store API GET /wc/store/v1/cart + sepet/ödeme sayfası DOM → sepeti boşalt.
 * Çıktı: build/handoff/curcy-check-<env>.json ve .md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadE2EEnv, ROOT, withCacheBust, beginNavCache, endNavCache } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import { loadProfile, setActiveProfile, isRemoteProfile, resolveTimeouts, applyTimeoutsToPage } from './helpers/profile.mjs';
import { getDevicePreset } from './helpers/devices.mjs';
import {
  installBrowserGuard,
  formatRemotePostBlockedLines,
  resetBlockedTrackers,
  resetRemotePostBlocked,
  snapshotBlockedLive,
  snapshotBlockedTrackers,
  snapshotRemotePostBlocked,
  snapshotAllowedReads,
} from './helpers/network-guard.mjs';
import { applyComingSoonBypass, comingSoonQuery } from './helpers/coming-soon.mjs';
import { withEnvRunLock } from './helpers/env-lock.mjs';
import { resetRegistry } from './helpers/run-registry.mjs';
import { fixtureProductRecords, loadFixtures } from './helpers/fixtures.mjs';
import {
  snapshotCanary,
  preflightCanary,
  compareWithRegistry,
  formatCanaryDiff,
  writeCanaryAlert,
} from './helpers/canary.mjs';
import { cleanupE2EData } from './helpers/test-cleanup.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE, assertOperatorGate, OPERATOR_GATE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';
import { isLocalSmokeEnv, pickSmokeProduct } from './helpers/remote-smoke.mjs';
import {
  classifyVisiblePluginEntry,
  collectVisiblePluginEntry,
} from './helpers/product-page-ui.mjs';
import {
  clickShellTrigger,
  emptyCart,
  gotoWooCart,
  openShellLocator,
  visibleValidationErrors,
} from './helpers/checks.mjs';
import { fillDonationShell } from './helpers/donation-flow.mjs';
import { clickAddOrGo } from './helpers/remote-smoke.mjs';
import { checkoutPathFromUrl } from './helpers/checkout-setup.mjs';
import { SEL } from './helpers/selectors.mjs';
import { attachNativeSubmitReloadGuard } from './helpers/native-submit-guard.mjs';
import {
  parseCurcyCheckArgs,
  codesToCheck,
  summarizeStoreCart,
  parseDomAmounts,
  classifyMeasurement,
  formatCurcyMarkdown,
} from './helpers/curcy-check.mjs';

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function localE2EPort() {
  const n = Number(process.env.WDP_LOCAL_E2E_PORT || 8899);
  return Number.isFinite(n) && n > 0 ? n : 8899;
}

const OUT_DIR = path.join(ROOT, 'build/handoff');

function writeOutputs(envLabel, payload) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonFile = path.join(OUT_DIR, `curcy-check-${envLabel}.json`);
  const mdFile = path.join(OUT_DIR, `curcy-check-${envLabel}.md`);
  fs.writeFileSync(jsonFile, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(mdFile, formatCurcyMarkdown({ ...payload, env: envLabel }));
  return { jsonFile, mdFile };
}

/** Sayfadaki fiyat metinleri (WooCommerce standart seçicileri; blok + klasik). */
async function readDomPriceTexts(page) {
  return page.evaluate(() => {
    const sels = [
      'td.product-subtotal .woocommerce-Price-amount',
      'td.product-price .woocommerce-Price-amount',
      '.cart-subtotal .woocommerce-Price-amount',
      '.order-total .woocommerce-Price-amount',
      '.cart_totals .woocommerce-Price-amount',
      '.wc-block-components-product-price__value',
      '.wc-block-components-totals-item__value',
      '.wc-block-formatted-money-amount',
      'td.product-total .woocommerce-Price-amount',
    ];
    const out = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && out.length < 40) out.push(t);
      }
    }
    return out;
  });
}

async function fetchStoreCart(page, baseUrl) {
  return page.evaluate(async (base) => {
    const res = await fetch(`${base.replace(/\/$/, '')}/wp-json/wc/store/v1/cart`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  }, baseUrl);
}

async function openShell(page, timeouts) {
  const ui = await collectVisiblePluginEntry(page);
  const kind = classifyVisiblePluginEntry(ui);
  if (!kind.ok) throw new Error(`bağış girişi görünmüyor: ${kind.reason || '?'}`);
  if (kind.kind === 'panel' || kind.kind === 'popup') {
    const sel = kind.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
    await clickShellTrigger(page.locator(sel).first(), timeouts.action);
  }
  const shell =
    kind.kind === 'form'
      ? page.locator(SEL.inlineRoot).first()
      : openShellLocator(page, kind.kind === 'panel' ? 'panel' : 'popup');
  await shell.waitFor({ state: 'visible', timeout: timeouts.expect });
  return shell;
}

/**
 * @returns {Promise<object>} tek kod için ölçüm satırı
 */
async function measureCode({ page, env, profile, product, timeouts, code, param, typed, extraBase }) {
  const extra = { ...extraBase, [param]: code };
  const row = { code, typed, cart: null, cartDom: [], checkoutDom: [], note: '' };
  const guard = attachNativeSubmitReloadGuard(page);
  try {
    await emptyCart(page, env.E2E_BASE_URL);
    await page.goto(withCacheBust(env.E2E_BASE_URL, product.pagePath, extra), {
      waitUntil: 'domcontentloaded',
      timeout: timeouts.navigation,
    });
    const shell = await openShell(page, timeouts);
    await fillDonationShell(shell, { kind: 'custom', amount: typed, fill: String(typed) });
    guard.clearHits();
    guard.arm();
    await clickAddOrGo(page, shell, timeouts.action);
    guard.disarm();

    let got = await fetchStoreCart(page, env.E2E_BASE_URL);
    if (!got.ok) throw new Error(`Store API sepet HTTP ${got.status}`);
    let cart = summarizeStoreCart(got.data);
    if (!cart || !cart.itemsCount) {
      const errs = await visibleValidationErrors(page);
      row.note = `sepet boş; form doğrulama: ${errs.length ? errs.map((e) => String(e).slice(0, 80)).join(' | ') : 'mesaj yok'}`;
    } else {
      row.cart = cart;
      const sep = { decimalSeparator: cart.decimalSeparator, thousandSeparator: cart.thousandSeparator, minorUnit: cart.minorUnit };
      await gotoWooCart(page, env.E2E_BASE_URL);
      row.cartDomTexts = await readDomPriceTexts(page);
      row.cartDom = parseDomAmounts(row.cartDomTexts, sep);

      const checkoutPath = checkoutPathFromUrl(env.E2E_CHECKOUT_PAGE || '', env.E2E_BASE_URL);
      await page.goto(withCacheBust(env.E2E_BASE_URL, checkoutPath, extra), {
        waitUntil: 'domcontentloaded',
        timeout: timeouts.navigation,
      });
      await page
        .locator('body.woocommerce-checkout, .wp-block-woocommerce-checkout, form.woocommerce-checkout, .wc-block-checkout')
        .first()
        .waitFor({ state: 'attached', timeout: timeouts.expect });
      await page.waitForFunction(
        () => !!document.querySelector('.wc-block-components-order-summary-item, td.product-name, .cart_item, .wc-block-checkout, form.checkout'),
        { timeout: timeouts.expect }
      );
      const summaryBtn = page
        .locator('.wc-block-components-order-summary button[aria-expanded], .wc-block-components-checkout-order-summary__title')
        .first();
      if ((await summaryBtn.count()) > 0 && (await summaryBtn.isVisible())) {
        if ((await summaryBtn.getAttribute('aria-expanded')) !== 'true') await summaryBtn.click({ timeout: timeouts.action });
      }
      row.checkoutDomTexts = await readDomPriceTexts(page);
      row.checkoutDom = parseDomAmounts(row.checkoutDomTexts, sep);
    }
  } catch (e) {
    row.note = `ölçüm hatası: ${String(e && e.message ? e.message : e).slice(0, 200)}`;
  } finally {
    guard.disarm();
    try {
      await emptyCart(page, env.E2E_BASE_URL);
    } catch (e) {
      row.note += ` | sepet boşaltılamadı: ${String(e && e.message ? e.message : e).slice(0, 100)}`;
    }
  }
  const verdict = classifyMeasurement({ code, typed, cart: row.cart, cartDom: row.cartDom, checkoutDom: row.checkoutDom, note: row.note });
  return { ...row, verdict: verdict.verdict, reasons: row.note && !row.cart ? [row.note] : verdict.reasons };
}

async function main() {
  const parsed = parseCurcyCheckArgs(process.argv.slice(2));
  const envRaw = parsed.envId;
  const local = isLocalSmokeEnv(envRaw);
  const profile = loadProfile(local ? 'local' : envRaw);
  const profileId = profile.id;
  const remote = isRemoteProfile(profile);
  const timeouts = resolveTimeouts(profile);
  setActiveProfile(profile);
  const envLabel = local ? 'local' : envRaw;
  const startedAt = new Date().toISOString();

  const param = String(profile.currencySwitch?.param || (parsed.codes ? 'wmc-currency' : '')).trim();
  const codes = param ? codesToCheck(profile, parsed.codes) : [];
  if (!param || !codes.length) {
    const msg = 'currencySwitch yok (profilde param/kod tanımlı değil) — ölçüm atlandı.';
    const files = writeOutputs(envLabel, {
      startedAt, baseUrl: profile.baseUrl || '', productRole: '', typed: parsed.amount, rows: [], skipped: msg,
    });
    console.log(msg);
    console.log(`Çıktı: ${path.relative(ROOT, files.mdFile)}`);
    return;
  }

  if (remote) {
    if (isRemoteFrozen()) fail(FREEZE_MESSAGE);
    try {
      assertOperatorGate();
    } catch {
      fail(OPERATOR_GATE_MESSAGE);
    }
  }

  let localServer = null;
  let code = 0;
  try {
    if (local) {
      const { prepareLocalFullStack } = await import('./helpers/matrix-setup.mjs');
      const stack = await prepareLocalFullStack(localE2EPort());
      localServer = stack.server;
    }
    let env = local
      ? loadE2EEnv({
          envId: 'local',
          parsed: { E2E_USER: 'admin', E2E_PASS: 'admin', E2E_BASE_URL: `http://127.0.0.1:${localE2EPort()}` },
        })
      : loadE2EEnv({ envId: envRaw });
    env = await fillMissingProductSlugs(env);

    code = await withEnvRunLock(profileId, async () => {
      const runId = `run-curcy-${Date.now()}`;
      resetRegistry(runId, {
        fixtureRecords: fixtureProductRecords(loadFixtures(profileId)),
        envId: profileId,
        siteUrl: env.E2E_BASE_URL || profile.baseUrl,
      });
      beginNavCache(runId);
      console.log(`Curcy ölçümü (iphone, env=${profileId}, kodlar=${codes.join(',')}, yazılan=${parsed.amount})`);

      let canaryBefore = null;
      try {
        canaryBefore = snapshotCanary();
        const health = preflightCanary(canaryBefore);
        if (!health.ok) {
          writeCanaryAlert(health, 'Ön kontrol: ortam bozuk, curcy ölçümü başlamadı.');
          throw new Error(`Kanarya ön kontrol kırmızı — ${formatCanaryDiff(health)}`);
        }
      } catch (e) {
        endNavCache();
        console.error(String(e && e.message ? e.message : e));
        return 1;
      }

      const rows = [];
      let problem = '';
      const product = pickSmokeProduct(env);
      if (!product || product.role !== 'custom') {
        problem = `işaretli 'custom' (serbest tutarlı) test ürünü yok${product ? ` (bulunan rol: ${product.role})` : ''} — önce e2e:bootstrap`;
      } else {
        resetBlockedTrackers();
        resetRemotePostBlocked();
        const device = getDevicePreset('iphone');
        const browser = await device.browserType.launch();
        installBrowserGuard(browser, env, {
          checkoutPath: env.E2E_CHECKOUT_PAGE || '/checkout/',
          cartPath: env.E2E_CART_PAGE || '/cart/',
        });
        const ctx = await browser.newContext({ ...device.context });
        if (profile.comingSoon) await applyComingSoonBypass(ctx, profile, env);
        const page = await ctx.newPage();
        applyTimeoutsToPage(page, timeouts);
        try {
          const extraBase = comingSoonQuery(env, profile);
          for (const c of codes) {
            const row = await measureCode({ page, env, profile, product, timeouts, code: c, param, typed: parsed.amount, extraBase });
            rows.push(row);
            console.log(`  ${c}: ${row.verdict}${row.reasons.length ? ` — ${row.reasons.join('; ')}` : ''}`);
          }
        } finally {
          await page.close();
          await ctx.close();
          await browser.close();
        }
      }

      const guardInfo = {
        blocked_trackers: snapshotBlockedTrackers(),
        blocked_live: snapshotBlockedLive(),
        remote_post_blocked: snapshotRemotePostBlocked(),
        izinli_okuma: snapshotAllowedReads(),
      };

      let canaryProblem = '';
      if (canaryBefore) {
        try {
          const cmp = compareWithRegistry(canaryBefore, snapshotCanary(), undefined, { envId: profileId });
          if (!cmp.ok) {
            writeCanaryAlert(cmp, 'Curcy ölçümü sonrası kayıt defteri dışı fark.');
            canaryProblem = `Kanarya: kayıt defteri dışı fark — ${formatCanaryDiff(cmp)}`;
          }
        } catch (e) {
          canaryProblem = `Kanarya son görüntü alınamadı: ${String(e && e.message ? e.message : e)}`;
        }
      }
      try {
        await Promise.race([
          cleanupE2EData({ envId: profileId }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('cleanup 120s zaman aşımı')), 120000)),
        ]);
        if (canaryBefore && !canaryProblem) {
          const cmp = compareWithRegistry(canaryBefore, snapshotCanary(), undefined, { envId: profileId });
          if (!cmp.ok) {
            writeCanaryAlert(cmp, 'Temizlik sonrası kayıt defteri dışı fark.');
            canaryProblem = `Kanarya (temizlik sonrası): ${formatCanaryDiff(cmp)}`;
          }
        }
      } catch (e) {
        canaryProblem = canaryProblem || `İşaretli test verisi silinemedi: ${String(e && e.message ? e.message : e)}`;
      }
      endNavCache();

      const payload = {
        startedAt,
        endedAt: new Date().toISOString(),
        baseUrl: env.E2E_BASE_URL || profile.baseUrl,
        productRole: product ? product.role : '',
        typed: parsed.amount,
        param,
        rows,
        problem: problem || undefined,
        canaryProblem: canaryProblem || undefined,
        guard: guardInfo,
      };
      const files = writeOutputs(envLabel, payload);
      console.log(formatCurcyMarkdown({ ...payload, env: envLabel }));
      console.log(formatRemotePostBlockedLines(guardInfo.remote_post_blocked, guardInfo.izinli_okuma, { blocked_live: guardInfo.blocked_live }));
      console.log(`Çıktı: ${path.relative(ROOT, files.jsonFile)} , ${path.relative(ROOT, files.mdFile)}`);
      if (problem) {
        console.error(problem);
        return 1;
      }
      if (canaryProblem) {
        console.error(canaryProblem);
        return 1;
      }
      return 0;
    }, { command: 'curcy-check' });
  } finally {
    if (localServer) await localServer.stop();
  }
  if (code) process.exit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  });
}
