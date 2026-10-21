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
  createTempPage,
  deletePost,
} from './staging-wp-meta.mjs';

const CHECK_MS = 40000;
const FORBIDDEN_IDS = new Set([10695]);
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
}) {
  const fixedId = Number(productIds.fixed || 0);
  const campaignId = Number(productIds.campaign || 0);
  if (campaignId) FORBIDDEN_IDS.add(campaignId);

  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  /** @type {string[]} */
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  let listTemp = null;
  try {
    if (!fixedId || FORBIDDEN_IDS.has(fixedId)) {
      throw new Error('Kısa kod E2E için güvenli ürün ID yok');
    }
    listTemp = await createTempPage(
      'WDP E2E 1033 list',
      `[wdp_donations ids="${fixedId}" tabs="yes" tab_all="yes" limit="6" show_price="yes"]`
    );
    await runListPriceCheck({ page, env, listUrl: listTemp.url, fixedId, failures, stats });
    await runTabsAriaCheck({ page, env, listUrl: listTemp.url, failures, stats });
    await runBadHashCheck({ page, env, listUrl: listTemp.url, pageErrors, failures, stats });
    await runButtonTextCheck({ page, env, fixedId, failures, stats });
    await runOutOfStockFormCheck({ page, env, fixedId, failures, stats });
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
    if (listTemp && listTemp.id) {
      try {
        await deletePost(listTemp.id);
      } catch (restoreErr) {
        failures.push(
          makeFailure({
            check: 'shortcodes-list-page-restore',
            description: 'Geçici liste sayfası silinemedi',
            error: restoreErr,
          })
        );
        stats.failed += 1;
      }
    }
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
async function runButtonTextCheck({ page, env, fixedId, failures, stats }) {
  const check = 'shortcode-button-text';
  const label = 'E2E Ozel Buton 1033';
  let temp = null;
  try {
    temp = await createTempPage(
      'WDP E2E 1033 button',
      `[wdp_donation_button id="${fixedId}" text="${label}"]`
    );
    await gotoPage(page, env, temp.url);
    const btn = page.locator('.wdp-donate-button').first();
    await btn.waitFor({ state: 'visible', timeout: CHECK_MS });
    const text = ((await btn.innerText()) || '').trim();
    if (text !== label) {
      throw new Error('Buton metni uygulanmadı: ' + text);
    }
    stats.passed += 1;
  } catch (e) {
    failures.push(
      makeFailure({
        check,
        description: 'Popup butonunda button_text uygulanır',
        error: e,
      })
    );
    stats.failed += 1;
  } finally {
    if (temp && temp.id) {
      try {
        await deletePost(temp.id);
      } catch (restoreErr) {
        failures.push(
          makeFailure({
            check: `${check}-restore`,
            description: 'Geçici button_text sayfası silinemedi',
            error: restoreErr,
          })
        );
        stats.failed += 1;
      }
    }
  }
}

/**
 * @param {object} args
 */
async function runOutOfStockFormCheck({ page, env, fixedId, failures, stats }) {
  const check = 'shortcode-form-outofstock';
  const keys = ['_stock_status', '_stock', '_manage_stock'];
  let snap = {};
  let temp = null;
  try {
    snap = await snapshotMeta(fixedId, keys);
    await setProductMeta(fixedId, '_stock_status', 'outofstock');
    temp = await createTempPage(
      'WDP E2E 1033 form stock',
      `[wdp_donation_form id="${fixedId}"]`
    );
    await gotoPage(page, env, temp.url);
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
    if (temp && temp.id) {
      try {
        await deletePost(temp.id);
      } catch (restoreErr) {
        failures.push(
          makeFailure({
            check: `${check}-page-restore`,
            description: 'Geçici stoksuz form sayfası silinemedi',
            error: restoreErr,
          })
        );
        stats.failed += 1;
      }
    }
  }
}
