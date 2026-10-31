#!/usr/bin/env node
/**
 * Yönetici ekranı stil denetimi (SALT OKUNUR): wp-admin/plugins.php açılır; eklentimizin
 * CSS/JS dosyalarının bu sayfada yüklenip yüklenmediği ve başka eklentilerin (ör. devre dışı
 * bırakma anketi) stil/betik dosyalarının yüklenme durumu yazılır. Yazma, tıklama, form yok.
 *
 *   npm run admin:style-audit -- --env staging      (yalnız Claude)
 *
 * Çıktı: yalnız dosya yolları (sorgusuz), durum kodları, sınıf adları; içerik/kişisel veri yok.
 */
import { chromium } from '@playwright/test';
import { loadE2EEnv } from '../tests/e2e/helpers/env.mjs';
import { DEFAULT_ENV_ID } from '../tests/e2e/helpers/profile.mjs';
import { ensureAuth, getAuthFile, getInMemoryAdminCookies } from '../tests/e2e/helpers/auth.mjs';
import { applyNetworkGuard, guardOptionsFromEnv } from '../tests/e2e/helpers/network-guard.mjs';
import { withEnvRunLock } from '../tests/e2e/helpers/env-lock.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE } from './lib/remote-guard.mjs';

const OUR_SLUG = 'woo-donation-popup';

function arg(name, def) {
  const a = process.argv.slice(2).filter((x) => x !== '--');
  for (let i = 0; i < a.length; i++) {
    if (a[i] === name) return a[i + 1];
    if (a[i].startsWith(`${name}=`)) return a[i].slice(name.length + 1);
  }
  return def;
}

function pathOnly(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return String(url || '').split('?')[0];
  }
}

function pluginSlug(p) {
  const m = String(p).match(/\/wp-content\/(?:plugins|themes)\/([^/]+)\//);
  return m ? m[1] : '';
}

async function main() {
  const envName = String(arg('--env', DEFAULT_ENV_ID));
  const env = loadE2EEnv({ envId: envName });
  if (env.E2E_PROFILE_ID && isRemoteFrozen()) {
    console.error(FREEZE_MESSAGE);
    process.exit(1);
  }
  const profileId = env.E2E_PROFILE_ID || envName;
  const code = await withEnvRunLock(
    profileId,
    async () => {
      await ensureAuth(env);
      const mem = getInMemoryAdminCookies();
      const browser = await chromium.launch();
      const opts = {};
      if (!mem && getAuthFile()) opts.storageState = getAuthFile();
      const ctx = await browser.newContext(opts);
      await applyNetworkGuard(ctx, guardOptionsFromEnv(env));
      if (mem && mem.length) await ctx.addCookies(mem);
      const page = await ctx.newPage();

      /** @type {Map<string, number>} */
      const status = new Map();
      /** @type {string[]} */
      const failed = [];
      page.on('response', (r) => {
        const t = r.request().resourceType();
        if (t === 'stylesheet' || t === 'script') status.set(pathOnly(r.url()), r.status());
      });
      page.on('requestfailed', (r) => {
        const t = r.resourceType();
        if (t === 'stylesheet' || t === 'script') failed.push(pathOnly(r.url()));
      });

      const base = String(env.E2E_BASE_URL || '').replace(/\/$/, '');
      await page.goto(`${base}/wp-admin/plugins.php`, { waitUntil: 'load', timeout: 60000 });

      const report = await page.evaluate((slug) => {
        const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
        const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
        const inlineStyles = [...document.querySelectorAll('style')].map((s) => ({
          id: s.id || '',
          hasOur: /wdp-|hdf-donation/.test(s.textContent || ''),
        }));
        const surveyEls = [...document.querySelectorAll('div,section,form')]
          .filter((el) => /anket|survey|feedback|deactivat|devre dışı/i.test(el.id + ' ' + el.className))
          .slice(0, 12)
          .map((el) => {
            const cs = getComputedStyle(el);
            return {
              tag: el.tagName,
              id: el.id || '',
              cls: String(el.className || '').slice(0, 80),
              display: cs.display,
              position: cs.position,
              inBody: !!el.closest('body'),
            };
          });
        const ourBodyClasses = [...document.querySelectorAll('[class*="wdp-"],[id^="wdp-"]')].length;
        return { sheets, scripts, inlineStyles, surveyEls, ourBodyClasses };
      }, OUR_SLUG);

      const ours = [...report.sheets, ...report.scripts].map(pathOnly).filter((p) => p.includes(OUR_SLUG));
      const bySlug = {};
      for (const [p, st] of status) {
        const s = pluginSlug(p);
        if (!s) continue;
        bySlug[s] = bySlug[s] || { ok: 0, bad: 0 };
        if (st >= 400) bySlug[s].bad += 1;
        else bySlug[s].ok += 1;
      }
      const pos = Object.keys(bySlug).filter((s) => /pos|gpos|entegrator/i.test(s));
      console.log(JSON.stringify({
        page: '/wp-admin/plugins.php',
        ourAssetsOnPage: ours,
        ourInlineStyles: report.inlineStyles.filter((x) => x.hasOur).map((x) => x.id || '(adsız)'),
        ourDomNodes: report.ourBodyClasses,
        posPlugins: pos.map((s) => ({ slug: s, ...bySlug[s] })),
        failedAssets: failed.map((p) => ({ path: p, slug: pluginSlug(p) })).slice(0, 20),
        assetStatusNon200: [...status].filter(([, st]) => st >= 400).map(([p, st]) => ({ path: p, status: st })).slice(0, 20),
        surveyCandidates: report.surveyEls,
      }, null, 2));
      await browser.close();
      return 0;
    },
    { command: 'admin:style-audit' }
  );
  process.exit(code || 0);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
