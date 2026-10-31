#!/usr/bin/env node
/**
 * Elementor Pro uyum testi (E8N) koşucusu. Eklenti Elementor'u tanımaz; bu yalnız TEST.
 *
 *   npm run e2e:elementor-compat                      -> varsayılan (local): TÜMÜ ATLANIR ("Elementor Pro yok")
 *   npm run e2e:elementor-compat -- --sim             -> yerel şablon simülasyonu (işaret taklidi; gerçek Elementor yok)
 *   npm run e2e:elementor-compat -- --env ikram-aid   -> uzak, ziyaretçi gibi, salt okunur (yalnız Claude)
 *
 * Uzak kural: açık `--env ikram-aid` ZORUNLU; merkezi koruma + operatör kapısı + ortam kilidi + kanarya öncesi/sonrası +
 * ağ koruması (POST engeli, ölçüm servisleri engelli). Sayfa/şablon/menü oluşturulmaz; sipariş verilmez; forma kişisel
 * veri yazılmaz. Kendi eklediği sepet öğesi sonunda boşaltılır. Elementor Pro Popup Builder KULLANILMAZ.
 * Yerel simülasyon: WDP_LOCAL_E2E_PORT (varsayılan 8956); iPhone/Android/masaüstü `--project` ile seçilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadE2EEnv, ROOT, beginNavCache, endNavCache } from './helpers/env.mjs';
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
import { applyComingSoonBypass } from './helpers/coming-soon.mjs';
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
import { pickSmokeProduct } from './helpers/remote-smoke.mjs';
import { writeRunManifest, readLocalPluginVersion, runJsonFor, currentDirFor } from './helpers/run-io.mjs';
import {
  SCENARIOS,
  cleanupCart,
  compatPaths,
  decideMode,
  makeContext,
  parseElementorCompatArgs,
  runScenario,
} from './helpers/elementor-compat.mjs';
import {
  ensureMatrixTemplate,
  ensureTheme,
  matrixEval,
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';
import { loadMatrix } from './helpers/matrix-cover.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_FILES = ['wdp-exp-sim.php', 'wdp-sc-sim.php', 'wdp-da-sim.php', 'wdp-elementor-sim.php'];

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * Yerel şablon simülasyonu: matris WP + 4 mu-plugin, Playwright spec'i.
 *
 * @param {{ project: string, grep: string }} args Bayraklar.
 * @return {Promise<number>} Çıkış kodu.
 */
async function runSim(args) {
  const port = Number(process.env.WDP_LOCAL_E2E_PORT || 8956) || 8956;
  const theme = process.env.WDP_EXP_THEME || 'twentytwentyfive';
  const store = loadMatrix().stores.try;
  const template = ensureMatrixTemplate();
  ensureTheme(template, theme);
  const resolved = { id: `elsim-${theme}`, themeSpec: { slug: theme }, storeSpec: store, checkout: 'classic', hpos: true };
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, port, snap, { hpos: true });
  fs.mkdirSync(path.join(wpDir, 'wp-content/mu-plugins'), { recursive: true });
  for (const f of SIM_FILES) fs.copyFileSync(path.join(__dirname, 'helpers', f), path.join(wpDir, 'wp-content/mu-plugins', f));
  restoreSqlite(wpDir, snap);
  const gateways = matrixEval(wpDir, ['enable-offline-gateways']);
  if (gateways && gateways.ok === false) throw new Error(`çevrimdışı ödeme yöntemleri açılamadı: ${gateways.error || ''}`);
  const server = await startPhpServer({ wpDir, port });
  let status = 1;
  try {
    fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'playwright-report'), { recursive: true, force: true });
    const pwArgs = ['playwright', 'test', '-c', 'tests/e2e/playwright.config.mjs', 'elementor-pro-compat'];
    if (args.project) pwArgs.push('--project', args.project);
    if (args.grep) pwArgs.push('--grep', args.grep);
    const r = spawnSync('npx', pwArgs, {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_BASE_URL: `http://127.0.0.1:${port}`,
        WDP_ELEMENTOR_COMPAT: 'sim',
        WDP_EXP_PRODUCT_ID: String(probe.products.custom.id),
        WDP_EXP_TRY: '1',
        WDP_EXP_STORE: JSON.stringify(store),
        WDP_LOCAL_WP_DIR: wpDir,
      },
    });
    status = r.status ?? 1;
    if (status === 0) fs.rmSync(path.join(ROOT, 'test-results'), { recursive: true, force: true });
  } finally {
    await server.stop();
  }
  return status;
}

/**
 * Uzak koşu (ikram-aid): ziyaretçi gibi, merkezi korumalı, kanaryalı.
 *
 * @param {string} envRaw Ortam kimliği.
 * @return {Promise<number>} Çıkış kodu.
 */
async function runRemote(envRaw) {
  const profile = loadProfile(envRaw);
  if (profile.id !== 'ikram-aid' || !isRemoteProfile(profile)) fail(`e2e:elementor-compat uzak koşusu yalnız --env ikram-aid ile (verilen: ${profile.id}).`, 2);
  const timeouts = resolveTimeouts(profile);
  setActiveProfile(profile);
  if (isRemoteFrozen()) fail(FREEZE_MESSAGE);
  try {
    assertOperatorGate();
  } catch {
    fail(OPERATOR_GATE_MESSAGE);
  }
  let env = loadE2EEnv({ envId: envRaw });
  env = await fillMissingProductSlugs(env);

  return withEnvRunLock(
    profile.id,
    async () => {
      const startedAt = new Date().toISOString();
      const started = Date.now();
      const runId = `run-elcompat-${Date.now()}`;
      resetRegistry(runId, {
        fixtureRecords: fixtureProductRecords(loadFixtures(profile.id)),
        envId: profile.id,
        siteUrl: env.E2E_BASE_URL || profile.baseUrl,
      });
      beginNavCache(runId);
      console.log(`E2E elementor-compat (iphone, env=${profile.id}, ziyaretçi, salt okunur)`);

      let canaryBefore = null;
      try {
        canaryBefore = snapshotCanary();
        const health = preflightCanary(canaryBefore);
        if (!health.ok) {
          writeCanaryAlert(health, 'Ön kontrol: ortam bozuk, Elementor uyum testi başlamadı.');
          throw new Error(`Kanarya ön kontrol kırmızı — ${formatCanaryDiff(health)}`);
        }
      } catch (e) {
        endNavCache();
        console.error(String(e && e.message ? e.message : e));
        return 1;
      }

      const product = pickSmokeProduct(env);
      if (!product) {
        endNavCache();
        console.error('Yayımlı ürün yolu yok (WP/Woo katalog / fixture).');
        return 1;
      }

      resetBlockedTrackers();
      resetRemotePostBlocked();
      const device = getDevicePreset('iphone');
      const browser = await device.browserType.launch();
      installBrowserGuard(browser, env, {
        checkoutPath: env.E2E_CHECKOUT_PAGE || '/checkout/',
        cartPath: env.E2E_CART_PAGE || '/cart/',
      });
      const ctxBrowser = await browser.newContext({ ...device.context });
      if (profile.comingSoon) await applyComingSoonBypass(ctxBrowser, profile, env);
      const page = await ctxBrowser.newPage();
      applyTimeoutsToPage(page, timeouts);
      const ctx = makeContext({
        base: env.E2E_BASE_URL,
        env,
        profile,
        timeouts,
        paths: compatPaths(env, product.pagePath),
      });
      /** @type {Array<{id: string, status: string, detail: string}>} */
      const results = [];
      try {
        for (const scenario of SCENARIOS) {
          const r = await runScenario(scenario, page, ctx);
          results.push(r);
          console.log(`  [${r.status}] ${r.id}${r.detail ? ` — ${r.detail}` : ''}`);
        }
        try {
          await cleanupCart(page, ctx);
        } catch (e) {
          results.push({ id: 'cart-cleanup', status: 'failed', detail: `sepet boşaltılamadı: ${String(e && e.message ? e.message : e).slice(0, 200)}` });
        }
      } finally {
        await page.close();
        await ctxBrowser.close();
        await browser.close();
      }

      const blocked_trackers = snapshotBlockedTrackers();
      const blocked_live = snapshotBlockedLive();
      const remote_post_blocked = snapshotRemotePostBlocked();
      const izinli_okuma = snapshotAllowedReads();

      let canaryOk = true;
      if (canaryBefore) {
        try {
          const cmp = compareWithRegistry(canaryBefore, snapshotCanary(), undefined, { envId: profile.id });
          if (!cmp.ok) {
            canaryOk = false;
            writeCanaryAlert(cmp, 'Elementor uyum testi sonrası kayıt defteri dışı fark.');
            results.push({ id: 'canary-diff', status: 'failed', detail: formatCanaryDiff(cmp) });
          }
        } catch (e) {
          canaryOk = false;
          results.push({ id: 'canary-after', status: 'failed', detail: String(e && e.message ? e.message : e).slice(0, 200) });
        }
      }
      try {
        await Promise.race([
          cleanupE2EData({ envId: profile.id }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('cleanup 120s zaman aşımı')), 120000)),
        ]);
      } catch (e) {
        results.push({ id: 'e2e-cleanup', status: 'failed', detail: String(e && e.message ? e.message : e).slice(0, 200) });
      }
      endNavCache();

      const passed = results.filter((r) => r.status === 'passed').length;
      const skipped = results.filter((r) => r.status === 'skipped');
      const failed = results.filter((r) => r.status === 'failed');
      const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
      const manifestFile = runJsonFor(profile.id);
      writeRunManifest(
        {
          mode: 'elementor-compat',
          env: profile.id,
          device: 'iphone',
          startedAt,
          endedAt: new Date().toISOString(),
          durationSec,
          pluginVersion: readLocalPluginVersion(),
          checks: SCENARIOS.map((s) => s.id),
          stats: { passed, skipped: skipped.length, failed: failed.length },
          skips: skipped.map((s) => ({ check: s.id, description: s.detail })),
          failures: failed.map((f) => ({ check: f.id, description: f.detail, debugFile: '' })),
          currentDir: path.relative(ROOT, currentDirFor(profile.id, 'iphone')),
          blocked_trackers,
          blocked_live,
          remote_post_blocked,
          izinli_okuma,
          timeouts,
          canaryOk,
        },
        manifestFile
      );
      console.log(`İşlevsel özet: Geçti=${passed} Atlandı=${skipped.length} Hata=${failed.length}`);
      for (const s of skipped) console.log(`  • atlandı [${s.id}] ${s.detail}`);
      console.log(`Süre: ${durationSec}s`);
      console.log(formatRemotePostBlockedLines(remote_post_blocked, izinli_okuma, { blocked_live }));
      if (failed.length) {
        console.error('=== Elementor uyum hataları ===');
        for (const f of failed) console.error(`• [${f.id}] ${f.detail}`);
        return 1;
      }
      console.log('E2E elementor-compat passed.');
      return 0;
    },
    { command: 'e2e:elementor-compat' }
  );
}

async function main() {
  const args = parseElementorCompatArgs(process.argv.slice(2));
  const mode = decideMode(args);
  if (mode === 'reject') fail(`e2e:elementor-compat yalnız local (varsayılan: atla / --sim) ya da --env ikram-aid ile çalışır (verilen: ${args.envId}).`, 2);
  if (mode === 'skip') {
    console.log('Elementor Pro yok: varsayılan (local) ortamda tüm senaryolar ATLANDI. Yerel simülasyon: --sim; uzak: --env ikram-aid (yalnız Claude).');
    return;
  }
  const code = mode === 'sim' ? await runSim(args) : await runRemote(args.envId);
  if (code) process.exit(code);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
