/**
 * Shared functional checks for staging E2E.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, withCacheBust } from './env.mjs';
import { SEL } from './selectors.mjs';
import { extractAjaxActionFromRequest } from './network-guard.mjs';

/** Kontrol başına en fazla bekleme (ms). Bulunamayan öğe hemen hata yazar. */
export const CHECK_MS = 5000;

/** Sepete ekle AJAX yanıtı (alt bağış / fixed cart). */
export const CART_AJAX_MS = 15000;

/**
 * POST gövdesinden action (urlencoded, multipart, JSON, query).
 * @param {import('@playwright/test').Request} req
 * @returns {string}
 */
export function extractPostActionFromRequest(req) {
  return extractAjaxActionFromRequest(req);
}

/** product.js / modal.js genel hata metinleri — doğrulama mesajı değil. */
export const UNEXPECTED_PLUGIN_ERROR_RE =
  /Ürün bilgileri alınamadı|Form tam yüklenemedi|sayfayı yenileyip|ağ hatası|network error|HTTP error/i;

/** form/feedback.js .wdp-form-error; utils.js .wdp-toast--error */
export const PLUGIN_ERROR_BANNER_SEL = `${SEL.formError}, .wdp-toast--error, #wdp-toast-host .wdp-toast--error, [role="alert"].wdp-form-error`;

/**
 * Açık kabuktaki genel hata kutusu metinleri (alan doğrulaması değil).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function collectVisiblePluginErrorNotices(page) {
  const shell = openShellLocator(page);
  const root = (await shell.count().catch(() => 0)) ? shell : page.locator('body');
  const nodes = root.locator(PLUGIN_ERROR_BANNER_SEL);
  const texts = [];
  const n = await nodes.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const el = nodes.nth(i);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    const t = ((await el.innerText().catch(() => '')) || '').trim();
    if (t && !texts.includes(t.slice(0, 200))) texts.push(t.slice(0, 200));
  }
  return texts;
}

/**
 * form/panel/popup açık ekran: genel hata kutusu KIRMIZI.
 * `errors` senaryosunda yalnız beklenen doğrulama serbest; beklenmeyen genel hata yine KIRMIZI.
 * @param {import('@playwright/test').Page} page
 * @param {{ scenarioId?: string }} [opts]
 */
export async function assertNoUnexpectedPluginErrors(page, opts = {}) {
  const scenarioId = String(opts.scenarioId || '');
  const isErrors = /(?:^|[-_])errors(?:[-_]|$)/i.test(scenarioId);
  const notices = await collectVisiblePluginErrorNotices(page);
  const bad = isErrors ? notices.filter((t) => UNEXPECTED_PLUGIN_ERROR_RE.test(t)) : notices;
  if (bad.length) {
    throw new Error(`Görünür eklenti hatası: ${bad.slice(0, 2).join(' | ')}`);
  }
}

/**
 * @param {Array<{ action?: string, status?: number }>} hits
 */
export function assertNoPluginAjaxFailures(hits) {
  const list = Array.isArray(hits) ? hits : [];
  if (!list.length) return;
  const first = list[0] || {};
  throw new Error(
    `Eklenti AJAX kırmızı: action=${first.action || '(unknown)'} status=${first.status ?? '?'}`
  );
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertNoCriticalError(page) {
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  if (body.includes('ciddi bir sorun') || body.includes('critical error')) {
    throw new Error('Page shows a critical error message');
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (overflow) {
    throw new Error('Horizontal overflow detected');
  }
}

/**
 * 404 / konsol kaynağını ayırt et (gizleme yok).
 * @param {string} url
 */
export function classifyResourceUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return 'unknown';
  if (/favicon|apple-touch-icon|\.ico(\?|$)/.test(u)) return 'favicon';
  if (/\/wp-content\/plugins\/woo-donation-popup\//.test(u)) return 'plugin';
  if (/\/wp-content\/plugins\//.test(u)) return 'other-plugin';
  if (/\/wp-content\/themes\//.test(u)) return 'theme';
  if (/\/wp-content\/uploads\//.test(u)) return 'upload';
  if (/\/wp-includes\//.test(u)) return 'core';
  return 'page';
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {string[]}
 */
export function attachConsoleErrorCollector(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/pass(word)?=/i.test(text)) return;
    const loc = typeof msg.location === 'function' ? msg.location() : {};
    const locUrl = loc && loc.url ? String(loc.url) : '';
    const kind = classifyResourceUrl(locUrl);
    const extra = locUrl ? ` src=${locUrl.slice(0, 180)} kind=${kind}` : '';
    errors.push(`${text.slice(0, 220)}${extra}`);
  });
  page.on('pageerror', (err) => {
    errors.push(String(err.message || err).slice(0, 300));
  });
  page.on('response', (res) => {
    if (res.status() !== 404) return;
    const url = res.url();
    if (/pass(word)?=/i.test(url)) return;
    const kind = classifyResourceUrl(url);
    errors.push(`HTTP 404 ${url.slice(0, 220)} kind=${kind}`);
  });
  return errors;
}

/**
 * @param {string[]} errors
 */
/**
 * Tema/medya (upload, favicon, theme) 404 test başarısızlığı sayılmaz.
 * Eklentinin kendi URL'lerinden gelen 404 hâlâ hata.
 * @param {string[]} errors
 */
export function assertNoConsoleErrors(errors) {
  const fatal = (errors || []).filter((e) => {
    const k = (String(e).match(/kind=([a-z-]+)/) || [])[1] || '';
    if (k === 'upload' || k === 'favicon' || k === 'theme') return false;
    const t = String(e);
    // WebKit: iptal edilen admin-ajax isteği "access control checks" yazar; gerçek eklenti 404/JS hatası değil.
    if (/admin-ajax\.php/i.test(t) && /access control checks/i.test(t)) return false;
    return true;
  });
  if (fatal.length) {
    const kinds = [...new Set(fatal.map((e) => (String(e).match(/kind=([a-z-]+)/) || [])[1] || 'unknown'))];
    throw new Error(
      `Browser console errors (kinds=${kinds.join(',')}): ` + fatal.slice(0, 5).join(' | ')
    );
  }
}

/**
 * Empty WooCommerce cart via Store API.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
/**
 * WooCommerce sepet sayfası mı (permalink /cart/ veya /sepet/; checkout değil).
 * @param {string} url
 */
export function isWooCartUrl(url) {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, '') || '/';
    if (/checkout|odeme|ödeme|order-pay|order-received/i.test(p)) return false;
    return /\/(cart|sepet)$/i.test(p);
  } catch {
    return /\/(cart|sepet)\/?(?:[?#]|$)/i.test(String(url || '')) &&
      !/checkout|odeme|ödeme/i.test(String(url || ''));
  }
}

/**
 * 404 / ana sayfa sepet değildir. Woo sepet formu veya boş-sepet metni aranır.
 * @param {import('@playwright/test').Page} page
 */
export async function pageLooksLikeWooCart(page) {
  if (!isWooCartUrl(page.url())) return false;
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  if (/sayfa bulunamadı|page not found|hata,\s*sayfa/i.test(body) &&
      !/woocommerce-cart-form|sepetiniz|your cart/i.test(body)) {
    return false;
  }
  const n = await page
    .locator(
      '.woocommerce-cart-form, .wc-block-cart, .wp-block-woocommerce-cart, .cart_item, .woocommerce-cart-item, .cart-empty, form.woocommerce-cart-form, .woocommerce-info'
    )
    .count()
    .catch(() => 0);
  return n > 0 || /sepetiniz|your cart|cart is currently empty|sepetinizde ürün yok/i.test(body);
}

/**
 * Woo sepet yolu adayları. Kök `/` veya ana sayfa cart_url sayılmaz (Hedef wc_get_cart_url
 * bazen site köküne düşer). /sepet/ (TR) ve /cart/ her zaman denenir.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<string[]>}
 */
export async function resolveCartPaths(page, baseUrl) {
  /** @type {string[]} */
  const out = [];
  const add = (p) => {
    const n = String(p || '').trim();
    if (!n) return;
    const pathOnly = n.startsWith('http')
      ? (() => {
          try {
            return new URL(n, baseUrl).pathname || '';
          } catch {
            return '';
          }
        })()
      : n.startsWith('/')
        ? n
        : `/${n}`;
    const compact = pathOnly.replace(/\/+$/, '') || '/';
    if (compact === '/') return;
    if (!/cart|sepet/i.test(compact)) return;
    if (!out.includes(pathOnly)) out.push(pathOnly.endsWith('/') ? pathOnly : `${pathOnly}/`);
  };
  try {
    const raw = await page.evaluate(() => {
      const w = window.wdp_ajax && window.wdp_ajax.cart_url;
      const wc = window.wc_add_to_cart_params && window.wc_add_to_cart_params.cart_url;
      return { w: String(w || ''), wc: String(wc || '') };
    });
    add(raw.w);
    add(raw.wc);
  } catch {
    /* yedekler */
  }
  add('/cart/');
  add('/sepet/');
  return out.length ? out : ['/cart/'];
}

/**
 * Sepet sayfasına git. Ana sayfa cart_url yok sayılır; /sepet/ sonra /cart/.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<string>} son URL
 */
export async function gotoWooCart(page, baseUrl) {
  const paths = await resolveCartPaths(page, baseUrl);
  for (const pathName of paths) {
    if (await pageLooksLikeWooCart(page)) break;
    const cartUrl = withCacheBust(baseUrl, pathName, { hdf_no_side_cart: '1' });
    try {
      await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (navErr) {
      if (!/interrupted/i.test(String(navErr && navErr.message))) throw navErr;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  }
  await page
    .locator(
      '.woocommerce-cart-form, .wc-block-cart, .wp-block-woocommerce-cart, .cart_item, .woocommerce-cart-item, .cart-empty, .woocommerce-info'
    )
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(400);
  return page.url();
}

export async function emptyCart(page, baseUrl) {
  await page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    const res = await fetch(`${root}/wp-json/wc/store/v1/cart/items`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { Nonce: window?.wcSettings?.storeApiNonce || '' },
    }).catch(() => null);
    if (!res || !res.ok) {
      return;
    }
  }, baseUrl);

  await page
    .goto(baseUrl.replace(/\/$/, '') + '/cart/?wdp_e2e=' + Date.now(), {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    .catch(() => {});
  const remove = page.locator('.woocommerce-cart-form .remove, a.remove');
  const count = await remove.count();
  for (let i = 0; i < count; i++) {
    await remove.nth(0).click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function cartItemCount(page, baseUrl) {
  return page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    try {
      const res = await fetch(`${root}/wp-json/wc/store/v1/cart`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        return -1;
      }
      const data = await res.json();
      return Array.isArray(data.items) ? data.items.length : (data.items_count ?? -1);
    } catch (e) {
      return -1;
    }
  }, baseUrl);
}

/**
 * Store API sepet kalemleri (id + ad + tutar).
 * TRY gibi currency_minor_unit=0 sitelerde `|| 2` kullanılmaz (0 geçerli).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<Array<{id:number,name:string,totals:string,quantity:number}>>}
 */
export async function cartItemsDetail(page, baseUrl) {
  return page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    try {
      const res = await fetch(`${root}/wp-json/wc/store/v1/cart`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const cartMinor =
        data.totals && data.totals.currency_minor_unit != null
          ? Number(data.totals.currency_minor_unit)
          : NaN;
      return items.map((it) => {
        const totals = it.totals || {};
        const raw =
          totals.line_subtotal != null
            ? totals.line_subtotal
            : totals.line_total != null
              ? totals.line_total
              : null;
        const minor = raw != null ? Number(raw) : NaN;
        const itemMinor =
          totals.currency_minor_unit != null
            ? Number(totals.currency_minor_unit)
            : NaN;
        // ?? : 0 (TRY) geçerli; yalnızca null/undefined iken üst/varsayılan
        let decimals = 2;
        if (Number.isFinite(itemMinor)) {
          decimals = itemMinor;
        } else if (Number.isFinite(cartMinor)) {
          decimals = cartMinor;
        }
        const amount = Number.isFinite(minor) ? minor / Math.pow(10, decimals) : NaN;
        const id = Number(it.id) || Number(it.product_id) || 0;
        return {
          id,
          name: String(it.name || '').trim(),
          totals: Number.isFinite(amount) ? String(amount) : '',
          quantity: Number(it.quantity) || 0,
        };
      });
    } catch (e) {
      return [];
    }
  }, baseUrl);
}

/**
 * Staging kalıcı bağlantısından ürün URL’si (Store API permalink veya sayfa linki).
 * /product/ sabit yazılmaz.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} slug
 * @returns {Promise<string>} absolute or site-relative path usable with withCacheBust
 */
export async function resolveProductPath(page, baseUrl, slug) {
  const root = baseUrl.replace(/\/$/, '');
  const fromApi = await page.evaluate(
    async ({ base, productSlug }) => {
      try {
        const url =
          `${base}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(productSlug)}&per_page=5`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const hit =
          list.find((p) => p && p.slug === productSlug) ||
          list.find((p) => p && String(p.permalink || '').includes(productSlug));
        return hit && hit.permalink ? String(hit.permalink) : null;
      } catch (e) {
        return null;
      }
    },
    { base: root, productSlug: slug }
  );

  if (fromApi) {
    try {
      const u = new URL(fromApi, root + '/');
      return u.pathname.replace(/\/?$/, '/') + (u.search || '');
    } catch (e) {
      /* fall through */
    }
  }

  // Shop / arama sayfasındaki ürün linki
  for (const probe of [`/?s=${encodeURIComponent(slug)}&post_type=product`, '/shop/']) {
    try {
      await page.goto(root + probe, { waitUntil: 'domcontentloaded' });
    } catch (e) {
      console.error(`[e2e:catch-fail] resolveProductPath ${probe}: ${e && e.message ? e.message : e}`);
      continue;
    }
    const link = page
      .locator(
        `a[href*="${slug}"][href*="product"], .woocommerce ul.products li.product a.woocommerce-LoopProduct-link`
      )
      .first();
    if (await link.count()) {
      const href = await link.getAttribute('href');
      if (href && href.includes(slug)) {
        try {
          const u = new URL(href, root + '/');
          return u.pathname.replace(/\/?$/, '/') + (u.search || '');
        } catch (e) {
          console.error(`[e2e:catch-fail] resolveProductPath href: ${e && e.message ? e.message : e}`);
        }
      }
    }
  }

  // /product/${slug}/ tahmini yok (uzak permalink farklı → 404).
  return '';
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {Record<string,string>} products key → slug
 * @returns {Promise<Record<string,string>>} key → path
 */
export async function resolveAllProductPaths(page, baseUrl, products) {
  const out = {};
  for (const [key, slug] of Object.entries(products)) {
    out[key] = await resolveProductPath(page, baseUrl, slug);
  }
  return out;
}

/**
 * Store API ile ürün ID’si (slug).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} slug
 * @returns {Promise<number>}
 */
export async function resolveProductIdBySlug(page, baseUrl, slug, fallbackId = 0) {
  const known = Number(fallbackId) > 0 ? Number(fallbackId) : 0;
  if (!slug) return known;
  const root = baseUrl.replace(/\/$/, '');
  const fromApi = await page.evaluate(
    async ({ base, productSlug }) => {
      try {
        const url = `${base}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(productSlug)}&per_page=5`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return 0;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const hit =
          list.find((p) => p && p.slug === productSlug) ||
          list.find((p) => p && String(p.permalink || '').includes(productSlug));
        return hit && hit.id ? Number(hit.id) || 0 : 0;
      } catch (e) {
        return 0;
      }
    },
    { base: root, productSlug: slug }
  );
  return Number(fromApi) > 0 ? Number(fromApi) : known;
}

/**
 * Açık bağış kabuğu.
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'|''} [mode] popup → ortadaki modal; panel → sağ panel; boş → herhangi .show
 */
export function openShellLocator(page, mode = '') {
  if (mode === 'panel') {
    return page.locator(SEL.openSidePanel).first();
  }
  if (mode === 'popup') {
    return page.locator(SEL.openCenteredPopup).first();
  }
  return page.locator(SEL.openModalShell).first();
}

/**
 * Açılış animasyonu bitsin (wdp-side-panel--opening + translateX). Sabit uyku yok.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
export async function waitOpenShellSettled(page, timeout = 8000) {
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
      if (!el) return false;
      if (el.classList.contains('wdp-side-panel--opening')) return false;
      const box = (el.querySelector('.wdp-modal-content') || el).getBoundingClientRect();
      return box.width > 80;
    }, { timeout });
    await page.waitForFunction(() => {
      const el = document.querySelector(
        '.hdf-donation-modal-wrapper.wdp-modal.show .wdp-modal-content'
      );
      if (!el) return true;
      const st = getComputedStyle(el);
      if (st.animationPlayState === 'running') return false;
      const t = st.transform;
      if (!t || t === 'none') return true;
      const m = t.match(/matrix\(([^)]+)\)/);
      if (!m) return true;
      const parts = m[1].split(',').map(Number);
      const tx = parts.length === 6 ? parts[4] : 0;
      return Math.abs(tx) < 2;
    }, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Kabuk tetikleyici: panel → side-panel sınıfı; popup → ortadaki (side-panel değil).
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ productId?: number }} [opts]
 */
/**
 * Liste sekmesi/hash gizlemesini aç: Tümü + ilgili kart .is-hidden kalksın.
 * @param {import('@playwright/test').Page} page
 * @param {number} [productId]
 */
export async function revealListProductTrigger(page, productId = 0) {
  const allTab = page.locator('[data-wdp-tab="all"]').first();
  if ((await allTab.count().catch(() => 0)) > 0) {
    await allTab.click({ timeout: 4000 }).catch(() => {});
  }
  const id = Number(productId) || 0;
  if (id > 0) {
    await page
      .evaluate((pid) => {
        document.querySelectorAll('.wdp-list__item').forEach((item) => {
          if (item.querySelector('[data-product-id="' + String(pid) + '"]')) {
            item.classList.remove('is-hidden');
          }
        });
      }, id)
      .catch(() => {});
  }
}

export function shellTriggerLocator(page, mode, opts = {}) {
  const productId = Number(opts.productId) > 0 ? Number(opts.productId) : 0;
  const idSel = productId ? `[data-product-id="${productId}"]` : '';
  const anyId = productId ? `.wdp-open-modal${idSel}, .wdp-card__cta${idSel}, .wdp-loop-donate${idSel}` : '';
  const preferred =
    mode === 'panel'
      ? `.wdp-card__cta.wdp-open-side-panel${idSel}, .wdp-loop-donate.wdp-open-side-panel${idSel}, ${SEL.sidePanelTrigger}${idSel}, ${anyId}`
      : `.wdp-card__cta${idSel}, .wdp-loop-donate${idSel}, ${SEL.centeredPopupTrigger}${idSel}, ${anyId}`;
  return page.locator(preferred.replace(/,\s*,/g, ',').replace(/,\s*$/, ''));
}

/**
 * Görünür ilk eşleşmeyi tıkla; yoksa DOM click() (gizli kısa kod).
 * @param {import('@playwright/test').Locator} trigger
 * @param {number} [timeout]
 */
export async function clickShellTrigger(trigger, timeout = CHECK_MS) {
  const vis = trigger.filter({ visible: true });
  if ((await vis.count().catch(() => 0)) > 0) {
    await vis.first().click({ timeout });
    return;
  }
  const n = await trigger.count().catch(() => 0);
  if (!n) {
    throw new Error('Bağış tetikleyicisi yok');
  }
  await trigger.first().evaluate((el) => {
    if (el && typeof el.click === 'function') {
      el.click();
    }
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function waitForShellClosed(page, timeout = CHECK_MS) {
  await page.waitForFunction(
    (sel) => document.querySelectorAll(sel).length === 0,
    SEL.openModalShell,
    { timeout }
  ).catch(() => {
    throw new Error('Bağış formu kabuğu kapanmadı (.show hâlâ var)');
  });
  // aria-hidden da true olmalı (assets/js/src/modal.js finalizeModalClose)
  const stillAriaOpen = await page
    .locator('.hdf-donation-modal-wrapper.wdp-modal[aria-hidden="false"]')
    .count();
  if (stillAriaOpen > 0) {
    throw new Error('Bağış formu kabuğu kapanmadı (aria-hidden=false)');
  }
}

/**
 * Formda görünen doğrulama hata metinleri.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function visibleValidationErrors(page) {
  const shell = openShellLocator(page);
  const root = (await shell.count()) ? shell : page.locator('body');
  const texts = [];
  // Banner + satır içi + role=alert (eski .wdp-error sınıfı metinsiz olabilir)
  const nodes = root.locator(
    `${SEL.formError}, .wdp-input-error, [role="alert"].wdp-input-error, [role="alert"].wdp-form-error`
  );
  const n = await nodes.count();
  for (let i = 0; i < n; i++) {
    const el = nodes.nth(i);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    const t = ((await el.innerText().catch(() => '')) || '').trim();
    if (t && !texts.includes(t.slice(0, 200))) texts.push(t.slice(0, 200));
  }
  return texts;
}

/**
 * Sepete ekleme AJAX yanıtını bekle (admin-ajax wdp_ajax_add_to_cart veya wc-ajax).
 * waitForResponse tıklamadan ÖNCE kurulur.
 *
 * @param {import('@playwright/test').Page} page
 * @param {() => Promise<void>} clickFn
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<{ status: number, bodyPreview: string, ok: boolean, url: string, timedOut: boolean, ms: number }>}
 */
export async function clickAddToCartAndWait(page, clickFn, opts = {}) {
  const timeout = Number(opts.timeout) > 0 ? Number(opts.timeout) : CART_AJAX_MS;
  const t0 = Date.now();
  const matchAjax = (res) => {
    const req = res.request();
    if (req.method() !== 'POST') return false;
    const url = res.url();
    const post = req.postData() || '';
    const isAdminAjax = /admin-ajax\.php/i.test(url);
    const isWcAjax = /[?&]wc-ajax=/i.test(url) || /\/wc-ajax\//i.test(url);
    if (!isAdminAjax && !isWcAjax) return false;
    if (isAdminAjax) {
      const action = extractPostActionFromRequest(req);
      if (action === 'wdp_ajax_add_to_cart') return true;
      return (
        post.includes('wdp_ajax_add_to_cart') ||
        post.includes('action=wdp_ajax_add_to_cart') ||
        post.includes('donation_add_to_cart')
      );
    }
    return true;
  };

  let status = 0;
  let bodyPreview = '';
  let url = '';
  let ok = false;
  let timedOut = false;
  try {
    // waitForResponse tıklamadan ÖNCE kurulur
    const [res] = await Promise.all([
      page.waitForResponse(matchAjax, { timeout }),
      clickFn(),
    ]);
    status = res.status();
    url = res.url();
    const text = await res.text().catch(() => '');
    bodyPreview = String(text || '').slice(0, 300);
    ok = res.ok();
    try {
      const json = JSON.parse(text);
      if (json && typeof json.success === 'boolean') {
        ok = json.success;
      }
    } catch (e) {
      /* non-JSON */
    }
  } catch (e) {
    timedOut = true;
    bodyPreview = `waitForResponse failed: ${String(e.message || e).slice(0, 200)}`;
  }

  return { status, bodyPreview, ok, url, timedOut, ms: Date.now() - t0 };
}

/**
 * Sepete Ekle tıklaması: görünür/enabled + 2 rAF, AJAX 15 sn, zaman aşımında 1 yeniden deneme.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} button
 * @param {{ checkId?: string }} [opts]
 * @returns {Promise<{
 *   status: number,
 *   bodyPreview: string,
 *   ok: boolean,
 *   url: string,
 *   timedOut: boolean,
 *   flaky: boolean,
 *   attempts: Array<{ attempt: number, ms: number, timedOut: boolean, ok: boolean, error?: string }>,
 *   buttonState: { visible: boolean, disabled: boolean },
 *   networkTail: string[],
 *   consoleErrors: string[]
 * }>}
 */
export async function clickAddToCartWithRetry(page, button, opts = {}) {
  const checkId = opts.checkId || 'cart-ajax';
  /** @type {(info: object) => Promise<void>|void|undefined} */
  const onAttemptFail = opts.onAttemptFail;
  /** @type {string[]} */
  const consoleErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(String(msg.text() || '').slice(0, 200));
  };
  const onPageError = (err) => {
    consoleErrors.push(String(err.message || err).slice(0, 200));
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  /** @type {Array<{ method: string, url: string, status: number, action: string, bodyPreview: string }>} */
  const network = [];
  const onResponse = (res) => {
    const req = res.request();
    const action = extractPostActionFromRequest(req);
    const entry = {
      method: req.method(),
      url: res.url().slice(0, 180),
      status: res.status(),
      action,
      bodyPreview: '',
    };
    network.push(entry);
    if (network.length > 40) network.shift();
    // Yanıt gövdesi (ilk 200) — async, fire-and-forget
    res
      .text()
      .then((t) => {
        entry.bodyPreview = String(t || '').slice(0, 200);
      })
      .catch(() => {});
  };
  page.on('response', onResponse);

  const attempts = [];
  let lastAjax = {
    status: 0,
    bodyPreview: '',
    ok: false,
    url: '',
    timedOut: true,
    ms: 0,
  };
  let buttonState = { visible: false, disabled: true };
  /** @type {object|null} */
  let firstAttemptDiag = null;

  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await button.waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
      // Form/wizard JS init: data-wdp-ready veya 2 rAF
      await page
        .evaluate(async () => {
          const ready =
            document.querySelector('[data-wdp-form-ready], [data-wdp-ready], .wdp-form.is-ready') ||
            document.querySelector('.wdp-shell form, form.wdp-donation-form');
          if (ready) {
            /* form DOM var — rAF ile paint/init bekle */
          }
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          });
        })
        .catch(() => {});
      // enabled olana kadar kısa bekle
      const enableDeadline = Date.now() + CHECK_MS;
      while (Date.now() < enableDeadline) {
        const vis = await button.isVisible().catch(() => false);
        const dis = vis ? await button.isDisabled().catch(() => true) : true;
        buttonState = { visible: vis, disabled: dis };
        if (vis && !dis) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      buttonState = {
        visible: await button.isVisible().catch(() => false),
        disabled: await button.isDisabled().catch(() => true),
      };

      lastAjax = await clickAddToCartAndWait(
        page,
        async () => {
          await button.click({ timeout: CHECK_MS });
        },
        { timeout: CART_AJAX_MS }
      );
      attempts.push({
        attempt,
        ms: lastAjax.ms,
        timedOut: lastAjax.timedOut,
        ok: lastAjax.ok,
        error: lastAjax.timedOut ? lastAjax.bodyPreview : undefined,
      });

      if (!lastAjax.timedOut) {
        return {
          ...lastAjax,
          flaky: attempt > 1,
          attempts,
          buttonState,
          networkTail: network
            .slice(-15)
            .map(
              (n) =>
                `${n.method} ${n.status} action=${n.action || '-'} ${n.url}`
            ),
          networkRaw: network.slice(-15),
          consoleErrors: consoleErrors.slice(-10),
          checkId,
          firstAttemptDiag,
        };
      }

      // İlk deneme zaman aşımı → retry ÖNCESİ teşhis
      if (attempt === 1 && typeof onAttemptFail === 'function') {
        try {
          firstAttemptDiag = await onAttemptFail({
            attempt,
            ajax: lastAjax,
            buttonState,
            networkRaw: network.slice(-15),
            consoleErrors: consoleErrors.slice(-10),
          });
        } catch (e) {
          firstAttemptDiag = { error: String(e.message || e) };
        }
      }
      // Zaman aşımı → bir kez daha dene
    }
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }

  return {
    ...lastAjax,
    flaky: false,
    attempts,
    buttonState,
    networkTail: network
      .slice(-15)
      .map((n) => `${n.method} ${n.status} action=${n.action || '-'} ${n.url}`),
    networkRaw: network.slice(-15),
    consoleErrors: consoleErrors.slice(-10),
    checkId,
    firstAttemptDiag,
  };
}

/**
 * Playwright Call log’unu kısalt; tam metni debug dosyasına yaz.
 * @param {string} checkId
 * @param {string} fullMessage
 * @returns {{ short: string, debugFile: string }}
 */
export function shortenAndStoreError(checkId, fullMessage) {
  const debugDir = path.join(ROOT, 'build/e2e/debug');
  fs.mkdirSync(debugDir, { recursive: true });
  const safe = String(checkId || 'error').replace(/[^\w.-]+/g, '_');
  const debugFile = path.join(debugDir, `${safe}.txt`);
  const full = String(fullMessage || '');
  fs.writeFileSync(debugFile, full, 'utf8');

  const lines = full.split(/\r?\n/);
  let shortLines = lines.slice(0, 3);
  // Call log bloğunu 3 satırla sınırla
  const callIdx = lines.findIndex((l) => /Call log:/i.test(l));
  if (callIdx >= 0) {
    shortLines = [...lines.slice(0, callIdx + 1), ...lines.slice(callIdx + 1, callIdx + 3)];
    if (lines.length > callIdx + 3) {
      shortLines.push(`… (tam log: ${path.relative(ROOT, debugFile)})`);
    }
  } else if (lines.length > 3) {
    shortLines = [...lines.slice(0, 3), `… (tam log: ${path.relative(ROOT, debugFile)})`];
  }

  return { short: shortLines.join('\n'), debugFile: path.relative(ROOT, debugFile) };
}

/**
 * @param {object} opts
 * @param {string} opts.check
 * @param {string} opts.description
 * @param {string} [opts.detail]
 * @param {string} [opts.screenshot]
 * @param {Error|string} [opts.error]
 */
export function makeFailure(opts) {
  const errText = opts.error
    ? typeof opts.error === 'string'
      ? opts.error
      : String(opts.error.message || opts.error)
    : opts.detail || '';
  const { short, debugFile } = shortenAndStoreError(opts.check, errText);
  return {
    check: opts.check,
    description: opts.description,
    detail: short,
    screenshot: opts.screenshot || '',
    debugFile: opts.debugFile || debugFile,
  };
}
