/**
 * 10.33.0 — Kısa kod / liste E2E.
 * Staging ürün meta/fiyatı geçici değişir; testten sonra eski haline döner.
 * Nafile #10695 ve Akika'ya kalıcı dokunulmaz (fixed ürün kullanılır).
 */
import { SEL } from './selectors.mjs';
import { withCacheBust } from './env.mjs';
import { makeFailure } from './checks.mjs';
import {
  getProductMeta,
  setProductMeta,
  saveProductPrices,
  bumpListCache,
} from './staging-wp-meta.mjs';
import { requireFixtureRole, mutationBrowserContext } from './fixtures.mjs';
import { skipLocalOnlyOnRemote } from './mutation-policy.mjs';

const CHECK_MS = 40000;
const FORBIDDEN_IDS = new Set([10695]);

function forbiddenIds(env) {
  const extra = env?._profile?.protectedProductIds;
  if (Array.isArray(extra) && extra.length) return new Set(extra.map(Number));
  return FORBIDDEN_IDS;
}
const PRICE_MARKER = '8877';

/**
 * @param {string} hay
 */
function hayHasPriceMarker(hay) {
  const digits = String(hay || '').replace(/\D/g, '');
  return digits.includes(PRICE_MARKER);
}

/**
 * @param {number} productId
 * @param {string[]} keys
 */
async function snapshotMeta(productId, keys) {
  /** @type {Record<string,string>} */
  const snap = {};
  for (const key of keys) {
    snap[key] = await getProductMeta(productId, key);
  }
  return snap;
}

/**
 * @param {number} productId
 * @param {Record<string,string>} snapshot
 */
async function restoreMeta(productId, snapshot) {
  for (const [key, prev] of Object.entries(snapshot)) {
    await setProductMeta(productId, key, prev || '');
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} env
 * @param {string} target
 * @param {string} [hash]
 */
async function gotoPage(page, env, target, hash) {
  let url = withCacheBust(env.E2E_BASE_URL, target, { hdf_no_side_cart: '1' });
  if (hash) {
    url += '#' + hash;
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CHECK_MS });
}

/**
 * @param {{ browser: import('@playwright/test').Browser, contextOpts: object, env: object, productUrls: object, productIds: object, listPagePath?: string, failures: any[], stats: { passed: number, failed: number } }} args
 */
export async function runShortcodeChecks({
  browser,
  contextOpts,
  env,
  productIds,
  failures,
  stats,
  skips = [],
  createAdminContext,
  createVisitorContext,
}) {
  let fixedId = Number(productIds.fixed || 0);
  try {
    const fx = requireFixtureRole(env, 'fixed');
    fixedId = fx.id;
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'shortcodes-fixture',
        description: String(e.message || e),
        error: e,
      })
    );
    stats.failed += 1;
    return;
  }
  const campaignId = Number(productIds.campaign || 0);
  const blocked = forbiddenIds(env);
  if (campaignId) blocked.add(campaignId);

  const ctx = await mutationBrowserContext(browser, contextOpts, createAdminContext, {
    createVisitorContext,
    env,
    role: 'fixed',
  });
  const page = await ctx.newPage();
  /** @type {string[]} */
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  try {
    if (!fixedId || blocked.has(fixedId)) {
      throw new Error('Kısa kod E2E için güvenli ürün ID yok');
    }
    const listUrl = env.E2E_LIST_PAGE;
    const skipList = skipLocalOnlyOnRemote(env, 'shortcodes-setup', skips, stats);
    if (skipList) {
      skipLocalOnlyOnRemote(env, 'shortcode-list-price-refresh', skips, stats);
      skipLocalOnlyOnRemote(env, 'shortcode-tabs-aria', skips, stats);
      skipLocalOnlyOnRemote(env, 'shortcode-bad-hash', skips, stats);
    } else {
      if (!listUrl) {
        throw new Error(
          'Liste sayfası yok — sayfa oluşturulmaz (2026-10-22). Mevcut liste yolunu profilden verin.'
        );
      }
      await runListPriceCheck({ page, env, listUrl, fixedId, failures, stats });
      await runTabsAriaCheck({ page, env, listUrl, failures, stats });
      await runBadHashCheck({ page, env, listUrl, pageErrors, failures, stats });
    }
    let productPath = env.E2E_PRODUCT_FIXED || '';
    try {
      const fx = requireFixtureRole(env, 'fixed');
      productPath = fx.path || fx.url || productPath;
    } catch {
      /* productIds.fixed yedek */
    }
    await runButtonTextCheck({ page, env, fixedId, failures, stats, productPath });
    await runOutOfStockFormCheck({ page, env, fixedId, failures, stats, productPath });
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'shortcodes-setup',
        description: 'Kısa kod E2E kurulumu',
        error: e,
      })
    );
    stats.failed += 1;
  } finally {
    await page.close();
    await ctx.close();
  }
}

/**
 * @param {object} args
 */
async function runListPriceCheck({ page, env, listUrl, fixedId, failures, stats }) {
  const check = 'shortcode-list-price-refresh';
  const keys = ['_price', '_regular_price', '_sale_price'];
  let snap = {};
  try {
    snap = await snapshotMeta(fixedId, keys);
    await saveProductPrices(fixedId, { price: PRICE_MARKER, regular: PRICE_MARKER, sale: '' });
    await bumpListCache();
    await gotoPage(page, env, listUrl);
    await page.locator('.wdp-list-wrap').first().waitFor({ state: 'visible', timeout: CHECK_MS });
    const wrap = page.locator('.wdp-list-wrap').first();
    const body = (await wrap.innerText()) + (await wrap.innerHTML());
    if (!hayHasPriceMarker(body)) {
      throw new Error('Liste HTML içinde güncel fiyat yok: ' + body.replace(/\s+/g, ' ').slice(0, 240));
    }
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Ürün fiyatı değişince [wdp_donations] listesi güncellenir',
        error: e,
      })
    );
    stats.failed += 1;
  } finally {
    try {
      await saveProductPrices(fixedId, {
        price: snap._price || '',
        regular: snap._regular_price || snap._price || '',
        sale: snap._sale_price || '',
      });
      await restoreMeta(fixedId, snap);
      await bumpListCache();
    } catch (restoreErr) {
      failures.push(
        makeFailure({
          check: `${check}-restore`,
          description: 'Liste fiyat meta geri yüklemesi başarısız',
          error: restoreErr,
        })
      );
      stats.failed += 1;
    }
  }
}

/**
 * @param {object} args
 */
async function runTabsAriaCheck({ page, env, listUrl, failures, stats }) {
  const check = 'shortcode-tabs-aria';
  try {
    await gotoPage(page, env, listUrl);
    await page.locator('.wdp-list-wrap').first().waitFor({ state: 'visible', timeout: CHECK_MS });
    const tab = page.locator('.wdp-list-wrap [role="tab"]').first();
    await tab.waitFor({ state: 'visible', timeout: CHECK_MS });
    const controls = await tab.getAttribute('aria-controls');
    if (!controls) {
      throw new Error('aria-controls yok');
    }
    const panel = page.locator('[id="' + String(controls).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
    if ((await panel.count()) < 1) {
      throw new Error('aria-controls hedefi DOM’da yok: ' + controls);
    }
    const role = await panel.first().getAttribute('role');
    if (role !== 'tabpanel') {
      throw new Error('panel role=tabpanel değil: ' + role);
    }
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Liste sekmeleri ARIA (aria-controls hedefi var)',
        error: e,
      })
    );
    stats.failed += 1;
  }
}

/**
 * @param {object} args
 */
async function runBadHashCheck({ page, env, listUrl, pageErrors, failures, stats }) {
  const check = 'shortcode-bad-hash';
  const before = pageErrors.length;
  try {
    const hash = encodeURIComponent('bagis-foo"] img[src=x onerror=alert(1)]');
    await gotoPage(page, env, listUrl, hash);
    await page.locator('.wdp-list-wrap').first().waitFor({ state: 'visible', timeout: CHECK_MS });
    const tab = page.locator('.wdp-list-wrap [role="tab"]').first();
    if ((await tab.count()) > 0) {
      await tab.click({ timeout: CHECK_MS });
    }
    if (pageErrors.length > before) {
      throw new Error('Kötü hash sayfa hatası: ' + pageErrors.slice(before).join(' | '));
    }
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Kötü hash ile list.js kırılmaz',
        error: e,
      })
    );
    stats.failed += 1;
  }
}

/**
 * @param {object} args
 */
async function runButtonTextCheck({ page, env, fixedId, failures, stats, productPath }) {
  const check = 'shortcode-button-text';
  try {
    const pathName = productPath || `/product/${fixedId}/`;
    await gotoPage(page, env, pathName);
    const btn = page.locator('.wdp-donate-button, .wdp-loop-donate, [data-wdp-open]').first();
    await btn.waitFor({ state: 'visible', timeout: CHECK_MS });
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Ürün sayfasında bağış düğmesi (geçici sayfa yok)',
        error: e,
      })
    );
    stats.failed += 1;
  }
}

/**
 * @param {object} args
 */
async function runOutOfStockFormCheck({ page, env, fixedId, failures, stats, productPath }) {
  const check = 'shortcode-form-outofstock';
  const keys = ['_stock_status', '_stock', '_manage_stock'];
  let snap = {};
  try {
    snap = await snapshotMeta(fixedId, keys);
    await setProductMeta(fixedId, '_stock_status', 'outofstock');
    const pathName = productPath || `/product/${fixedId}/`;
    await gotoPage(page, env, pathName);
    const formCount = await page.locator(SEL.donationForm).count();
    if (formCount > 0) {
      throw new Error('Stoksuz üründe inline form hâlâ basıldı');
    }
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Stoksuz ürün formu uyarı gösterir / form basılmaz',
        error: e,
      })
    );
    stats.failed += 1;
  } finally {
    try {
      await restoreMeta(fixedId, snap);
    } catch (restoreErr) {
      failures.push(
        makeFailure({
          check: `${check}-restore`,
          description: 'Stok meta geri yüklemesi başarısız',
          error: restoreErr,
        })
      );
      stats.failed += 1;
    }
  }
}
