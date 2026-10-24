#!/usr/bin/env node
/**
 * Uzak kısa kritik-akış kontrolü (iPhone WebKit).
 *
 *   npm run e2e:remote-smoke -- --env local
 *   npm run e2e:remote-smoke -- --env staging|ikram   (yalnız Claude)
 *
 * Merge kriteri: verify + yerel tam paket + bu komut iki uzak ortamda yeşil.
 * Tam paket yalnız faz sonunda / bilgi amaçlı. Hedef: uzak ≤ 4 dk, yerel ≤ 1.5 dk.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadE2EEnv, parseE2ECli, ROOT, beginNavCache, endNavCache } from './helpers/env.mjs';
import { fillMissingProductSlugs } from './helpers/resolve-products.mjs';
import {
  loadProfile,
  setActiveProfile,
  isRemoteProfile,
  resolveTimeouts,
} from './helpers/profile.mjs';
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
import {
  parseRemoteSmokeArgs,
  isLocalSmokeEnv,
  pickSmokeProduct,
  runRemoteSmokeChecks,
  SMOKE_CHECKS,
} from './helpers/remote-smoke.mjs';
import {
  writeRunManifest,
  readLocalPluginVersion,
  runJsonFor,
  currentDirFor,
} from './helpers/run-io.mjs';
import { makeFailure } from './helpers/checks.mjs';

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function localE2EPort() {
  const n = Number(process.env.WDP_LOCAL_E2E_PORT || 8899);
  return Number.isFinite(n) && n > 0 ? n : 8899;
}

async function main() {
  const parsed = parseRemoteSmokeArgs(process.argv.slice(2));
  const flags = parseE2ECli(process.argv.slice(2));
  const envRaw = flags.envId || parsed.envId || 'local';
  const profile = loadProfile(isLocalSmokeEnv(envRaw) ? 'local' : envRaw);
  const profileId = profile.id;
  const remote = isRemoteProfile(profile);
  const timeouts = resolveTimeouts(profile);
  setActiveProfile(profile);

  if (remote) {
    if (isRemoteFrozen()) fail(FREEZE_MESSAGE);
    try {
      assertOperatorGate();
    } catch {
      fail(OPERATOR_GATE_MESSAGE);
    }
  }

  /** @type {{ stop: () => Promise<void> } | null} */
  let localServer = null;
  let code = 0;
  try {
    if (isLocalSmokeEnv(envRaw)) {
      const tPrep = Date.now();
      const { prepareLocalFullStack } = await import('./helpers/matrix-setup.mjs');
      const stack = await prepareLocalFullStack(localE2EPort());
      localServer = stack.server;
      console.log(`[e2e] prepareLocalFullStack: ${((Date.now() - tPrep) / 1000).toFixed(1)}s`);
    }

    let env = isLocalSmokeEnv(envRaw)
      ? loadE2EEnv({
          envId: 'local',
          parsed: {
            E2E_USER: 'admin',
            E2E_PASS: 'admin',
            E2E_BASE_URL: `http://127.0.0.1:${localE2EPort()}`,
          },
        })
      : loadE2EEnv({ envId: envRaw });
    env = await fillMissingProductSlugs(env);

    code = await withEnvRunLock(profileId, async () => {
      const startedAt = new Date().toISOString();
      const started = Date.now();
      const runId = `run-smoke-${Date.now()}`;
      resetRegistry(runId, {
        fixtureRecords: fixtureProductRecords(loadFixtures(profileId)),
        envId: profileId,
        siteUrl: env.E2E_BASE_URL || profile.baseUrl,
      });
      beginNavCache(runId);

      /** @type {object[]} */
      const failures = [];
      /** @type {object[]} */
      const skips = [];
      const stats = { passed: 0, failed: 0, skipped: 0 };
      /** @type {string[]} */
      const debugFiles = [];

      console.log(
        `E2E remote-smoke (iphone, env=${profileId}, nav=${timeouts.navigation}ms action=${timeouts.action}ms)`
      );

      let canaryBefore = null;
      try {
        canaryBefore = snapshotCanary();
        const health = preflightCanary(canaryBefore);
        if (!health.ok) {
          writeCanaryAlert(health, 'Ön kontrol: ortam bozuk, smoke başlamadı.');
          throw new Error(`Kanarya ön kontrol kırmızı — ${formatCanaryDiff(health)}`);
        }
      } catch (e) {
        endNavCache();
        console.error(String(e && e.message ? e.message : e));
        return 1;
      }

      const product = pickSmokeProduct(env);
      if (!product) {
        failures.push(
          makeFailure({
            check: 'product-page',
            description: 'Yayımlı ürün yolu yok (WP/Woo katalog / fixture)',
          })
        );
        stats.failed += 1;
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
        if (profile.comingSoon) {
          await applyComingSoonBypass(ctx, profile, env);
        }
        const page = await ctx.newPage();
        try {
          await runRemoteSmokeChecks({
            page,
            env,
            profile,
            product,
            timeouts,
            failures,
            skips,
            stats,
            debugFiles,
          });
        } finally {
          await page.close();
          await ctx.close();
          await browser.close();
        }
      }

      const blocked_trackers = snapshotBlockedTrackers();
      const blocked_live = snapshotBlockedLive();
      const remote_post_blocked = snapshotRemotePostBlocked();
      const izinli_okuma = snapshotAllowedReads();

      if (canaryBefore) {
        try {
          const after = snapshotCanary();
          const cmp = compareWithRegistry(canaryBefore, after, undefined, { envId: profileId });
          if (!cmp.ok) {
            writeCanaryAlert(cmp, 'Smoke sonrası kayıt defteri dışı fark.');
            failures.push(
              makeFailure({
                check: 'canary-diff',
                description: 'Kanarya: kayıt defteri dışı fark',
                error: new Error(formatCanaryDiff(cmp)),
              })
            );
            stats.failed += 1;
          }
        } catch (e) {
          failures.push(
            makeFailure({
              check: 'canary-after',
              description: 'Kanarya son görüntü alınamadı',
              error: e,
            })
          );
          stats.failed += 1;
        }
      }

      try {
        const cleaned = await Promise.race([
          cleanupE2EData({ envId: profileId }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('cleanup 120s zaman aşımı')), 120000)
          ),
        ]);
        debugFiles.push(`cleanup:${JSON.stringify(cleaned)}`);
        if (canaryBefore) {
          const afterCleanup = snapshotCanary();
          const cmpCleanup = compareWithRegistry(canaryBefore, afterCleanup, undefined, { envId: profileId });
          if (!cmpCleanup.ok) {
            writeCanaryAlert(cmpCleanup, 'Temizlik sonrası kayıt defteri dışı fark.');
            failures.push(
              makeFailure({
                check: 'canary-after-cleanup',
                description: 'Kanarya: temizlik sonrası beklenmeyen fark',
                error: new Error(formatCanaryDiff(cmpCleanup)),
              })
            );
            stats.failed += 1;
          }
        }
      } catch (e) {
        failures.push(
          makeFailure({
            check: 'e2e-cleanup',
            description: 'İşaretli test verisi silinemedi',
            error: e,
          })
        );
        stats.failed += 1;
      }

      endNavCache();
      const durationSec = Number(((Date.now() - started) / 1000).toFixed(1));
      const outDir = currentDirFor(profileId, 'iphone');
      const manifestFile = runJsonFor(profileId);
      writeRunManifest(
        {
          mode: 'remote-smoke',
          env: profileId,
          device: 'iphone',
          startedAt,
          endedAt: new Date().toISOString(),
          durationSec,
          pluginVersion: readLocalPluginVersion(),
          checks: SMOKE_CHECKS,
          stats: {
            passed: stats.passed,
            skipped: stats.skipped,
            failed: failures.length,
          },
          skips,
          failures: failures.map((f) => ({
            check: f.check,
            description: f.description,
            debugFile: f.debugFile || '',
          })),
          currentDir: path.relative(ROOT, outDir),
          blocked_trackers,
          blocked_live,
          remote_post_blocked,
          izinli_okuma,
          timeouts,
        },
        manifestFile
      );

      console.log(
        `İşlevsel özet: Geçti=${stats.passed} Atlandı=${stats.skipped} Hata=${failures.length}`
      );
      console.log(`Kontroller: ${SMOKE_CHECKS.join(', ')}`);
      if (skips.length) {
        console.log('Atlandı:');
        for (const s of skips) console.log(`  • [${s.check}] ${s.description}`);
      }
      console.log(`Süre: ${durationSec}s (hedef uzak ≤240s, yerel ≤90s)`);
      console.log(formatRemotePostBlockedLines(remote_post_blocked, izinli_okuma, { blocked_live }));
      console.log(`Manifest: ${path.relative(ROOT, manifestFile)}`);

      if (failures.length) {
        console.error('');
        console.error('=== Smoke hataları ===');
        for (const f of failures) {
          console.error(`• [${f.check}] ${f.description}`);
          if (f.detail) console.error(`  ${String(f.detail).split(/\r?\n/).slice(0, 2).join('\n  ')}`);
          if (f.debugFile) console.error(`  debug: ${f.debugFile}`);
        }
        if (debugFiles.length) {
          console.error('=== Teşhis dosyaları ===');
          for (const p of debugFiles) console.error(`  • ${p}`);
        }
        return 1;
      }
      console.log('E2E remote-smoke passed.');
      return 0;
    }, { command: 'e2e:remote-smoke' });
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

export { parseRemoteSmokeArgs };
