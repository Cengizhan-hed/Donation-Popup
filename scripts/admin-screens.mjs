#!/usr/bin/env node
/**
 * Yönetici ekran adlarını doğrular (SALT OKUNUR; yalnız wp-admin GET gezintisi).
 * Mevcut yönetici oturumuyla (helpers/auth.mjs; oturum tek kez) ekranları açar, sol menü + sayfa başlığı
 * + sekme/bölüm başlıkları + ayar etiketlerini METİN olarak toplar. Forma yazma, düğmeye tıklama YOK.
 *
 *   node scripts/admin-screens.mjs --env local
 *   CLAUDECODE=1 npm run admin:screens -- --env staging-hedef --check-doc docs/CANLIYA-ALMA.md   (yalnız Claude)
 *
 * Bayraklar: --env local|staging-hedef|ikram-aid, --ui new|legacy (yalnız yerel), --check-doc <md>, --out-dir <klasör>, --strict
 * (belgede bulunamayan yol varsa çıkış kodu 3), --no-shots (yerelde ekran görüntüsünü kapatır).
 * Çıktı: build/handoff/admin-screens-<env>.json + .md. Ekran görüntüsü YALNIZ yerelde.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { loadE2EEnv, ROOT, beginNavCache, endNavCache } from '../tests/e2e/helpers/env.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { ensureAuth, getAuthFile, getInMemoryAdminCookies, resetAuthStateForTests } from '../tests/e2e/helpers/auth.mjs';
import { applyNetworkGuard, guardOptionsFromEnv } from '../tests/e2e/helpers/network-guard.mjs';
import { withEnvRunLock } from '../tests/e2e/helpers/env-lock.mjs';
import { loadFixtures, fixtureProductRecords } from '../tests/e2e/helpers/fixtures.mjs';
import { resetRegistry } from '../tests/e2e/helpers/run-registry.mjs';
import {
  snapshotCanary,
  preflightCanary,
  compareWithRegistry,
  formatCanaryDiff,
  writeCanaryAlert,
} from '../tests/e2e/helpers/canary.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE, assertOperatorGate, OPERATOR_GATE_MESSAGE } from './lib/remote-guard.mjs';
import {
  NAV_DELAY_MS,
  PLUGIN_SLUG,
  SCREENS,
  assertEnvAllowed,
  assertAdminGetUrl,
  isReadMethod,
  screenUrl,
  norm,
  extractDocPaths,
  compareDocPaths,
  detectUiMode,
  collectScreenDom,
  renderMarkdown,
} from './lib/admin-screens-lib.mjs';

const SELF = fileURLToPath(import.meta.url);

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * @param {string[]} argv Komut satırı.
 * @param {string} name Bayrak.
 * @param {string} [def] Varsayılan.
 * @returns {string}
 */
function arg(argv, name, def = '') {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return String(argv[i + 1] ?? def);
    if (argv[i].startsWith(`${name}=`)) return argv[i].slice(name.length + 1);
  }
  return def;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ürün düzenleme sayfası için işaretli test ürününü seçer (varsa).
 * @param {string} profileId Ortam.
 * @returns {number} ürün kimliği ya da 0
 */
function pickProductId(profileId) {
  try {
    const recs = fixtureProductRecords(loadFixtures(profileId));
    const pref = ['custom', 'fixed', 'shares', 'campaign'];
    for (const role of pref) {
      const r = recs.find((x) => x.role === role);
      if (r) return r.id;
    }
    return recs[0] ? recs[0].id : 0;
  } catch (e) {
    console.error(`[admin:screens] fikstür okunamadı: ${e && e.message ? e.message : e}`);
    return 0;
  }
}

/**
 * Oturum açık bağlamda ekranları gezip veriyi toplar.
 * @param {import('@playwright/test').BrowserContext} ctx Bağlam.
 * @param {{ base: string, productId: number, shotDir: string|null }} o Seçenekler.
 */
async function crawl(ctx, o) {
  const page = await ctx.newPage();
  const blocked = [];
  const blockedSample = [];
  await ctx.route('**/*', (route) => {
    const req = route.request();
    if (!isReadMethod(req.method())) {
      blocked.push(req.method());
      if (blockedSample.length < 5) blockedSample.push(`${req.method()} ${new URL(req.url()).pathname}`);
      return route.abort('blockedbyclient');
    }
    return route.fallback();
  });
  const screens = [];
  let menu = [];
  for (const sc of SCREENS) {
    const url = screenUrl(o.base, sc, o.productId);
    if (!url) {
      screens.push({ id: sc.id, path: sc.path, note: sc.note, status: 'atlandı: işaretli ürün yok', optional: !!sc.optional });
      continue;
    }
    assertAdminGetUrl(o.base, url);
    let status = 'tamam';
    let data = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      const code = resp ? resp.status() : 0;
      data = await page.evaluate(collectScreenDom, {
        pluginSlug: PLUGIN_SLUG,
        pluginRowOnly: !!sc.pluginRowOnly,
        wantMenu: menu.length === 0,
      });
      if (data.loginScreen) status = 'oturum yok (giriş ekranı)';
      else if (data.denied || code >= 400) status = `erişilemedi (HTTP ${code})${data.denied ? ', WP hata sayfası' : ''}`;
      if (data.menu.length && menu.length === 0) menu = data.menu;
      if (o.shotDir && status === 'tamam') {
        await page.screenshot({ path: path.join(o.shotDir, `${sc.id}.png`), fullPage: false });
      }
    } catch (e) {
      status = `hata: ${String(e && e.message ? e.message : e).split('\n')[0].slice(0, 120)}`;
    }
    const row = {
      id: sc.id,
      path: sc.path.replace('{id}', '<ürün>'),
      note: sc.note,
      optional: !!sc.optional,
      status,
      title: data ? data.title : '',
      docTitle: data ? data.docTitle : '',
      tabs: data ? data.tabs : [],
      headings: data ? data.headings : [],
      labels: data ? data.labels : [],
      buttons: data ? data.buttons : [],
      productTabs: data ? data.productTabs : [],
      pluginRow: data ? data.pluginRow : null,
      pluginRowCount: data ? data.pluginRowCount : undefined,
    };
    if (sc.sectionProbe && data && status === 'tamam') {
      const pool = [...row.headings, ...row.buttons, ...row.tabs].map(norm);
      row.sectionFound = pool.some((t) => /donation|bağış|bagis/.test(t));
    }
    screens.push(row);
    await sleep(NAV_DELAY_MS);
  }
  await page.close();
  return { screens, menu, blocked, blockedSample };
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  let envId;
  try {
    envId = assertEnvAllowed(arg(argv, '--env', 'local'));
  } catch (e) {
    fail(e.message, 2);
  }
  const profile = loadProfile(envId);
  setActiveProfile(profile);
  const remote = isRemoteProfile(profile);
  const docArg = arg(argv, '--check-doc');
  const outDir = path.resolve(ROOT, arg(argv, '--out-dir', 'build/handoff'));
  const tag = envId + (!remote && arg(argv, '--ui') ? `-ui-${arg(argv, '--ui')}` : '');
  const wantShots = !remote && !argv.includes('--no-shots');

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
    let env;
    if (!remote) {
      const port = Number(process.env.WDP_LOCAL_E2E_PORT || 8966) || 8966;
      const { prepareLocalFullStack } = await import('../tests/e2e/helpers/matrix-setup.mjs');
      const stack = await prepareLocalFullStack(port);
      localServer = stack.server;
      const ui = arg(argv, '--ui');
      if (ui) {
        if (!/^(new|legacy)$/.test(ui)) fail('--ui yalnız new|legacy olabilir.', 2);
        // Yalnız yerel işçi: yönetici ekranı kipini yerel seçenekte ayarlar (uzakta bu yol yok).
        const mu = path.join(stack.wpDir, 'wp-content/mu-plugins');
        fs.mkdirSync(mu, { recursive: true });
        fs.copyFileSync(path.join(ROOT, 'tests/e2e/helpers/wdp-admin-sim.php'), path.join(mu, 'wdp-admin-sim.php'));
        const r = await fetch(`http://127.0.0.1:${port}/?dp_ad_reset=1&ui=${ui}`);
        if (!r.ok) fail(`--ui ${ui}: sıfırlama yanıtı ${r.status}`);
      }
      env = loadE2EEnv({
        envId: 'local',
        parsed: { E2E_USER: 'admin', E2E_PASS: 'admin', E2E_BASE_URL: `http://127.0.0.1:${port}` },
      });
    } else {
      env = loadE2EEnv({ envId });
    }
    const profileId = env.E2E_PROFILE_ID || envId;
    const base = String(env.E2E_BASE_URL).replace(/\/$/, '');

    code = await withEnvRunLock(
      profileId,
      async () => {
        let canaryBefore = null;
        if (remote) {
          resetRegistry(`run-screens-${Date.now()}`, {
            fixtureRecords: fixtureProductRecords(loadFixtures(profileId)),
            envId: profileId,
            siteUrl: base,
          });
          canaryBefore = snapshotCanary();
          const health = preflightCanary(canaryBefore);
          if (health && health.ok === false) {
            writeCanaryAlert(health, 'Ön kontrol: ortam bozuk, admin:screens başlamadı.');
            throw new Error(`Kanarya ön kontrol kırmızı — ${formatCanaryDiff(health)}`);
          }
        }
        beginNavCache(`screens-${Date.now()}`);
        // Yerel işçi her koşuda yeniden kurulur: eski oturum işareti geçersizdir (uzakta dokunulmaz).
        if (!remote) resetAuthStateForTests();
        await ensureAuth(env);
        const mem = getInMemoryAdminCookies();
        const browser = await chromium.launch();
        let result;
        try {
          const opts = {};
          if (!mem && getAuthFile()) opts.storageState = getAuthFile();
          const ctx = await browser.newContext({ ...opts, viewport: { width: 1280, height: 900 } });
          await applyNetworkGuard(ctx, guardOptionsFromEnv(env));
          if (mem && mem.length) await ctx.addCookies(mem);
          let shotDir = null;
          if (wantShots) {
            shotDir = path.join(outDir, `admin-screens-${tag}-shots`);
            fs.rmSync(shotDir, { recursive: true, force: true });
            fs.mkdirSync(shotDir, { recursive: true });
          }
          result = await crawl(ctx, { base, productId: pickProductId(profileId), shotDir });
        } finally {
          await browser.close();
          endNavCache();
        }
        const report = {
          env: envId,
          baseHost: new URL(base).host,
          generatedAt: new Date().toISOString(),
          uiMode: detectUiMode(result.menu),
          menu: result.menu,
          screens: result.screens,
          blockedNonGet: result.blocked.length,
          blockedSample: result.blockedSample,
        };
        if (docArg) {
          const docFile = path.resolve(ROOT, docArg);
          if (!fs.existsSync(docFile)) throw new Error(`Belge yok: ${docArg}`);
          const cmp = compareDocPaths(extractDocPaths(fs.readFileSync(docFile, 'utf8')), report);
          report.docCheck = { doc: path.relative(ROOT, docFile), ...cmp };
        }
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, `admin-screens-${tag}.json`), JSON.stringify(report, null, 2) + '\n');
        fs.writeFileSync(path.join(outDir, `admin-screens-${tag}.md`), renderMarkdown(report));

        let rc = 0;
        if (canaryBefore) {
          const cmp = compareWithRegistry(canaryBefore, snapshotCanary(), undefined, { envId: profileId });
          if (!cmp.ok) {
            writeCanaryAlert(cmp, 'admin:screens sonrası beklenmeyen fark.');
            console.error(`CANARY-ALERT ${formatCanaryDiff(cmp)}`);
            rc = 4;
          } else {
            console.log('Kanarya: öncesi/sonrası temiz.');
          }
        }
        const bad = report.screens.filter((s) => s.status !== 'tamam' && !s.optional && !String(s.status).startsWith('atlandı'));
        console.log(
          `admin:screens ${envId}: ${report.screens.length} ekran, uiMode=${report.uiMode.uiMode}, ` +
            `ulaşılamayan(zorunlu)=${bad.length}, engellenen POST=${report.blockedNonGet}` +
            (report.docCheck ? `, belgede bulunamayan=${report.docCheck.missing.length}/${report.docCheck.found.length + report.docCheck.missing.length}` : '')
        );
        if (report.docCheck) {
          for (const m of report.docCheck.missing) console.log(`  bulunamadı (satır ${m.line}): ${m.raw}  -> "${m.missingSegment}"`);
        }
        console.log(`Çıktı: ${path.relative(ROOT, path.join(outDir, `admin-screens-${tag}.md`))}`);
        if (!rc && bad.length) rc = 1;
        if (!rc && argv.includes('--strict') && report.docCheck && report.docCheck.missing.length) rc = 3;
        return rc;
      },
      { command: 'admin:screens' }
    );
  } finally {
    if (localServer) await localServer.stop();
  }
  process.exit(code || 0);
}

// Yalnız doğrudan çalıştırılırsa başlar (birim testleri içe aktarabilir).
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main().catch((e) => fail(e && e.message ? e.message : String(e)));
}
