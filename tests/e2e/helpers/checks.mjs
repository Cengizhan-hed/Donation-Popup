/**
 * Shared functional checks for staging E2E.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, withCacheBust } from './env.mjs';
import { SEL } from './selectors.mjs';
import { extractAjaxActionFromRequest, classifyBlockedConsoleError } from './network-guard.mjs';
import { waitShellAnimationsDone } from './shell-overlap.mjs';
import {
  emptyCartStoreApiWithFetch,
  playwrightStoreFetch,
  readStoreApiNonceGlobals,
  storeApiCartUrl,
  storeApiFetch,
  storeApiNonceFromGlobals,
  storeApiNonceFromHeaders,
} from './store-api.mjs';
import { writeDebugJson } from './scenario-debug.mjs';
import { debugDirFor } from './e2e-paths.mjs';
import { buildCheckoutFlowDiagExtras } from './flow-diag.mjs';
import { getActiveTimeouts } from './profile.mjs';

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
  /Ürün bilgileri alınamadı|Form tam yüklenemedi|sayfayı yenileyip|ağ hatası|network error|HTTP error|could not be loaded|did not finish loading|refresh the page/i;

/** Yeni form: form düzeyi uyarı kutusu (role=alert, `data-dp-summary`). */
export const PLUGIN_ERROR_BANNER_SEL = SEL.formError;

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
    const blocked = classifyBlockedConsoleError(text) || classifyBlockedConsoleError(locUrl);
    const kind = blocked || classifyResourceUrl(locUrl) || classifyResourceUrl(text);
    const extra = locUrl ? ` src=${locUrl.slice(0, 180)} kind=${kind}` : kind ? ` kind=${kind}` : '';
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
    if (k === 'upload' || k === 'favicon' || k === 'theme' || k === 'blocked-live' || k === 'blocked-site') {
      return false;
    }
    const t = String(e);
    const blocked = classifyBlockedConsoleError(t);
    if (blocked === 'blocked-live' || blocked === 'blocked-site' || blocked === 'cancelled-ajax') {
      return false;
    }
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
 * URL’den yalnız pathname (sorgu / hash yok).
 * @param {string} url
 * @param {string} [base]
 * @returns {string}
 */
export function urlPathnameOnly(url, base) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const origin = String(base || '').trim() || 'https://e2e.invalid';
    return new URL(raw, origin).pathname || '';
  } catch {
    const noQuery = raw.split('#')[0].split('?')[0];
    return noQuery.startsWith('/') ? noQuery : '';
  }
}

/**
 * @param {string} pathname
 */
export function isWooCartPath(pathname) {
  const p = urlPathnameOnly(pathname) || String(pathname || '');
  if (!p) return false;
  return isWooCartUrl(`https://e2e.invalid${p.startsWith('/') ? p : `/${p}`}`);
}

/**
 * @param {string} pathname
 */
export function isWooCheckoutPath(pathname) {
  const p = urlPathnameOnly(pathname) || String(pathname || '');
  return /checkout|order-pay|order-received|odeme|ödeme/i.test(p);
}

/**
 * Woo oturum çerez adı (değer yok).
 * @param {string} name
 */
export function isWooSessionCookieName(name) {
  const n = String(name || '');
  return /^wp_woocommerce_session_/i.test(n) || n === 'woocommerce_items_in_cart';
}

/**
 * admin-ajax JSON’dan yalnız checkout_url pathname. Gövde saklanmaz.
 * @param {string} text
 */
export function extractAjaxCheckoutPathname(text) {
  try {
    const json = JSON.parse(String(text || ''));
    const data = json && typeof json === 'object' ? json.data : null;
    const raw =
      (data && typeof data === 'object' && data.checkout_url) ||
      (json && json.checkout_url) ||
      '';
    return urlPathnameOnly(String(raw || ''));
  } catch {
    return '';
  }
}

/**
 * @param {string} text
 * @param {boolean} httpOk
 */
export function extractAjaxSuccessFlag(text, httpOk) {
  try {
    const json = JSON.parse(String(text || ''));
    if (json && typeof json.success === 'boolean') return json.success;
  } catch {
    /* non-JSON */
  }
  return !!httpOk;
}

function normCheckoutPath(p) {
  return String(p || '').replace(/\/+$/, '') || '/';
}

function hasCheckoutToCartRedirect(redirects) {
  return (Array.isArray(redirects) ? redirects : []).some((r) => {
    const code = Number(r && (r.status ?? r.code));
    if (!(code >= 300 && code < 400)) return false;
    return isWooCheckoutPath(r.from || r.source || '') && isWooCartPath(r.to || r.target || '');
  });
}

function checkoutHasAddToCart(d) {
  const a = d && d.add_to_cart && typeof d.add_to_cart === 'object' ? d.add_to_cart : null;
  if (!a) return false;
  if (a.success === true) return true;
  if (Number(a.status) > 0) return true;
  return !!(a.action || a.endpoint);
}

function checkoutValidationMessage(d) {
  const raw = d && typeof d === 'object' ? d : {};
  if (typeof raw.validation_message === 'string' && raw.validation_message.trim()) {
    return raw.validation_message.trim().slice(0, 80);
  }
  const list = Array.isArray(raw.validation_errors) ? raw.validation_errors : [];
  const first = list.find((t) => String(t || '').trim());
  return first ? String(first).trim().slice(0, 80) : '';
}

/**
 * checkout-flow gezinme hatası sınıfı.
 * Öncelik: form-dogrulama-reddi → tıklama-gezinmedi → eklenti-checkout-url-yanlış
 * → sepet-boş-yönlendirme → tema-yönlendirmesi.
 *
 * @param {object} diag
 * @returns {'form-dogrulama-reddi'|'sepet-boş-yönlendirme'|'eklenti-checkout-url-yanlış'|'tema-yönlendirmesi'|'tıklama-gezinmedi'}
 */
export function classifyCheckoutNavFailure(diag) {
  const d = diag && typeof diag === 'object' ? diag : {};
  const items = Number(d.items_count);
  const finalPath = String(d.final_pathname || '');
  const clickPath = String(d.click_pathname || '');
  const redirects = Array.isArray(d.redirects) ? d.redirects : [];
  const pluginPath = String(d.wdp_ajax_checkout_pathname || '');
  const ajaxPath = String((d.add_to_cart && d.add_to_cart.checkout_url_pathname) || '');
  const endedOnCart = isWooCartPath(finalPath);
  const endedOnCheckout = isWooCheckoutPath(finalPath);
  const navigated =
    typeof d.navigated === 'boolean'
      ? d.navigated
      : redirects.length > 0 ||
        (!!finalPath && !!clickPath && normCheckoutPath(finalPath) !== normCheckoutPath(clickPath));

  if (checkoutValidationMessage(d) && !checkoutHasAddToCart(d)) {
    return 'form-dogrulama-reddi';
  }
  if (!navigated && !endedOnCart && !endedOnCheckout) {
    return 'tıklama-gezinmedi';
  }
  if (isWooCartPath(pluginPath) || isWooCartPath(ajaxPath)) {
    return 'eklenti-checkout-url-yanlış';
  }
  if (items === 0) {
    return 'sepet-boş-yönlendirme';
  }
  if (items > 0 && (hasCheckoutToCartRedirect(redirects) || endedOnCart)) {
    return 'tema-yönlendirmesi';
  }
  return 'tıklama-gezinmedi';
}

/**
 * Teşhis JSON: yalnız yol / durum / sayı. Sorgu, gövde, çerez değeri yok.
 * @param {object} raw
 */
export function buildCheckoutFlowDebugPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const add = r.add_to_cart && typeof r.add_to_cart === 'object' ? r.add_to_cart : {};
  const redirects = Array.isArray(r.redirects)
    ? r.redirects.map((x) => ({
        from: urlPathnameOnly(x && x.from),
        to: urlPathnameOnly(x && x.to),
        status: Number(x && x.status) || 0,
      }))
    : [];
  const cookies = r.cookies && typeof r.cookies === 'object' ? r.cookies : {};
  return {
    device: String(r.device || ''),
    add_to_cart: {
      action: String(add.action || ''),
      endpoint: urlPathnameOnly(add.endpoint) || String(add.endpoint || '').split('?')[0],
      status: Number(add.status) || 0,
      success: add.success === true,
      checkout_url_pathname: urlPathnameOnly(add.checkout_url_pathname),
    },
    items_count_before_click: Number.isFinite(Number(r.items_count_before_click))
      ? Number(r.items_count_before_click)
      : -1,
    items_count: Number.isFinite(Number(r.items_count)) ? Number(r.items_count) : -1,
    redirects,
    final_pathname: urlPathnameOnly(r.final_pathname),
    expected_checkout_pathname: urlPathnameOnly(r.expected_checkout_pathname),
    cookies: {
      wp_woocommerce_session: cookies.wp_woocommerce_session === true,
      woocommerce_items_in_cart: cookies.woocommerce_items_in_cart === true,
    },
    wdp_ajax_checkout_pathname: urlPathnameOnly(r.wdp_ajax_checkout_pathname),
    navigated: r.navigated === true,
    class: String(r.class || ''),
    validation_message: String(r.validation_message || checkoutValidationMessage(r) || '').slice(0, 80),
    ...buildCheckoutFlowDiagExtras(r),
  };
}

/**
 * @param {string} deviceId
 * @param {object} raw
 * @returns {string} repo-göreli yol
 */
export function writeCheckoutFlowDebug(deviceId, raw) {
  const payload = buildCheckoutFlowDebugPayload({ ...raw, device: deviceId });
  const file = path.join(debugDirFor(), `checkout-flow-${String(deviceId || 'device')}.json`);
  writeDebugJson(file, payload);
  return path.relative(ROOT, file);
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function collectWooSessionCookieFlags(page) {
  const cookies = await page.context().cookies();
  let wp_woocommerce_session = false;
  let woocommerce_items_in_cart = false;
  for (const c of cookies) {
    const n = String(c.name || '');
    if (/^wp_woocommerce_session_/i.test(n)) wp_woocommerce_session = true;
    if (n === 'woocommerce_items_in_cart') woocommerce_items_in_cart = true;
  }
  return { wp_woocommerce_session, woocommerce_items_in_cart };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function collectWdpAjaxCheckoutPathname(page) {
  try {
    const raw = await page.evaluate(() => {
      const root = document.querySelector('[data-dp-exp][data-dp-checkout]');
      return root ? String(root.getAttribute('data-dp-checkout') || '') : '';
    });
    return urlPathnameOnly(raw);
  } catch (e) {
    console.error(`[e2e:catch-fail] data-dp-checkout: ${e && e.message ? e.message : e}`);
    return '';
  }
}

/**
 * Sepete ekle POST (admin-ajax wdp_ajax_add_to_cart veya wc-ajax add_to_cart).
 * @param {import('@playwright/test').Request} req
 */
export function isDonationAddToCartRequest(req) {
  if (!req || typeof req.method !== 'function' || req.method() !== 'POST') return false;
  const url = req.url();
  const post = req.postData() || '';
  // Yeni nesil form: REST `donation-panel/v1/cart/add` (rest_route sorgusu kodlanmış olabilir).
  if (/donation-panel(?:\/|%2F)v1(?:\/|%2F)cart(?:\/|%2F)add/i.test(url)) return true;
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
  try {
    const u = new URL(url);
    if (u.searchParams.get('wc-ajax') === 'add_to_cart') return true;
  } catch {
    /* pathname */
  }
  return /\/wc-ajax\/add_to_cart/i.test(url) || /add_to_cart/i.test(post);
}

/**
 * Tıklama sonrası 3xx zinciri + sepete ekleme yanıtı (gövde saklanmaz).
 * @param {import('@playwright/test').Page} page
 */
export function attachCheckoutFlowProbes(page) {
  /** @type {Array<{ action: string, endpoint: string, status: number, success: boolean, checkout_url_pathname: string }>} */
  const addToCartHits = [];
  /** @type {Array<{ from: string, to: string, status: number }>} */
  const redirects = [];
  /** @type {Promise<void>[]} */
  const pending = [];

  const onResponse = (res) => {
    const status = res.status();
    const req = res.request();
    const type = typeof req.resourceType === 'function' ? req.resourceType() : '';
    if (status >= 300 && status < 400 && (type === 'document' || type === 'other')) {
      const headers = res.headers();
      const loc = headers.location || headers.Location || '';
      redirects.push({
        from: urlPathnameOnly(res.url()),
        to: loc ? urlPathnameOnly(loc, res.url()) : '',
        status,
      });
    }
    if (!isDonationAddToCartRequest(req)) return;
    pending.push(
      res
        .text()
        .then((text) => {
          addToCartHits.push({
            action: extractPostActionFromRequest(req) || '',
            endpoint: urlPathnameOnly(res.url()),
            status,
            success: extractAjaxSuccessFlag(text, res.ok()),
            checkout_url_pathname: extractAjaxCheckoutPathname(text),
          });
        })
        .catch((e) => {
          addToCartHits.push({
            action: extractPostActionFromRequest(req) || '',
            endpoint: urlPathnameOnly(res.url()),
            status,
            success: res.ok(),
            checkout_url_pathname: '',
          });
          console.error(`[e2e:catch-fail] addToCartDiag: ${e && e.message ? e.message : e}`);
        })
    );
  };
  page.on('response', onResponse);
  return {
    addToCartHits,
    redirects,
    async flush() {
      await Promise.all(pending);
    },
    /**
     * POST göründüğü anda flush; yoksa zaman aşımı.
     * @param {number} timeoutMs
     */
    async waitForAddToCart(timeoutMs) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        if (pending.length > 0) {
          await Promise.all(pending);
          if (addToCartHits.length) return addToCartHits[0];
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      await Promise.all(pending);
      return addToCartHits[0] || null;
    },
    dispose() {
      page.off('response', onResponse);
    },
  };
}

/**
 * Woo sepet sayfası mı? Dil bağımsız: `body.woocommerce-cart` (Woo her temada ekler).
 * @param {import('@playwright/test').Page} page
 */
export async function pageLooksLikeWooCart(page) {
  const n = await page.locator('body.woocommerce-cart').count().catch(() => 0);
  return n > 0;
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
  const add = (p, requireName = true) => {
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
    if (requireName && !/cart|sepet/i.test(compact)) return;
    if (!out.includes(pathOnly)) out.push(pathOnly.endsWith('/') ? pathOnly : `${pathOnly}/`);
  };
  try {
    const raw = await page.evaluate(() => {
      const w = window.wdp_ajax && window.wdp_ajax.cart_url;
      const wc = window.wc_add_to_cart_params && window.wc_add_to_cart_params.cart_url;
      return { w: String(w || ''), wc: String(wc || '') };
    });
    add(raw.w, false);
    add(raw.wc, false);
  } catch {
    /* yedekler */
  }
  add('/cart/');
  add('/sepet/');
  return out.length ? out : ['/cart/'];
}

/**
 * Sepet sayfasına git. Hazır = wc_get_cart_url yolu + body.woocommerce-cart + DOMContentLoaded.
 * Klasik/blok işaret VARSA görünür olmalarını bekle; yoksa (Avada/oluşturucu) bekleme yok.
 * Dil bazlı gövde metni yok. Sepet içeriği Store API ile doğrulanır.
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
      await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: getActiveTimeouts().navigation });
    } catch (navErr) {
      if (!/interrupted/i.test(String(navErr && navErr.message))) throw navErr;
      await page.waitForLoadState('domcontentloaded');
    }
  }
  await waitForWooCartReady(page);
  return page.url();
}

/**
 * Dil bağımsız sepet-hazır: body.woocommerce-cart zorunlu; standart işaret isteğe bağlı.
 * @param {string} html
 * @returns {{ ready: true } | { ready: false, error: string }}
 */
export function assessWooCartReadyFromHtml(html) {
  const s = String(html || '');
  const bodyOpen = s.match(/<body\b([^>]*)>/i);
  const classAttr = bodyOpen
    ? (bodyOpen[1].match(/\bclass\s*=\s*["']([^"']*)["']/i) || [])[1] || ''
    : '';
  if (!/(?:^|\s)woocommerce-cart(?:\s|$)/.test(classAttr)) {
    return { ready: false, error: 'body.woocommerce-cart yok' };
  }
  const present = cartReadyMarkerPresent(s);
  if (present.count > 0 && present.visible === 0) {
    return { ready: false, error: 'standart sepet işareti gizli' };
  }
  return { ready: true };
}

const CART_READY_CLASSES = [
  'woocommerce-cart-form',
  'wc-block-cart-items',
  'wc-block-cart__empty-cart',
  'wp-block-woocommerce-empty-cart-block',
  'wp-block-woocommerce-filled-cart-block',
  'wp-block-woocommerce-cart',
  'wc-empty-cart-message',
  'cart_item',
  'woocommerce-cart-item',
  'cart-empty',
  'woocommerce-info',
];

/**
 * @param {string} html
 * @returns {{ count: number, visible: number }}
 */
function cartReadyMarkerPresent(html) {
  const s = String(html || '');
  let count = 0;
  let visible = 0;
  const tagRe = /<([a-zA-Z0-9]+)([^>]*?)>/g;
  let m;
  while ((m = tagRe.exec(s))) {
    const attrs = m[2] || '';
    const cls = (attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    const names = cls.split(/\s+/).filter(Boolean);
    const hit = CART_READY_CLASSES.some((c) => names.includes(c));
    if (!hit) continue;
    const hidden =
      /\bhidden\b/i.test(attrs) ||
      /\bhidden\s*=/i.test(attrs) ||
      /style\s*=\s*["'][^"']*display\s*:\s*none/i.test(attrs);
    if (names.includes('wp-block-woocommerce-cart') && hidden) continue;
    count += 1;
    if (!hidden) visible += 1;
  }
  return { count, visible };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function waitForWooCartReady(page) {
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.locator('body.woocommerce-cart').waitFor({ state: 'attached', timeout: getActiveTimeouts().expect });
  } catch {
    throw new Error('sepet sayfası hazır değil: body.woocommerce-cart yok');
  }
  const n = await page.locator(CART_READY_SEL).count().catch(() => 0);
  if (n > 0) {
    await page
      .locator(CART_READY_SEL)
      .filter({ visible: true })
      .first()
      .waitFor({ state: 'visible', timeout: getActiveTimeouts().expect });
  }
}

/** Yalnız sepet sayfası formu/bloğu — tema başlık mini sepeti (`a.remove`) yok. */
export const CART_PAGE_REMOVE_SEL = [
  '.woocommerce-cart-form a.remove',
  '.woocommerce-cart-form .remove',
  '.wc-block-cart-items .wc-block-cart-item__remove-link',
  '.wp-block-woocommerce-filled-cart-block .wc-block-cart-item__remove-link',
].join(', ');
const CART_REMOVE_SEL = CART_PAGE_REMOVE_SEL;
const CART_EMPTY_SEL =
  '.cart-empty, .wc-block-cart__empty-cart, .wc-empty-cart-message, .wp-block-woocommerce-empty-cart-block, .woocommerce-info';

/** Görünür sepet hazır (gizli `.wp-block-woocommerce-cart` sarmalayıcı değil). */
export const CART_READY_SEL = [
  '.woocommerce-cart-form',
  '.wc-block-cart-items',
  '.wc-block-cart__empty-cart',
  '.wp-block-woocommerce-empty-cart-block',
  '.wp-block-woocommerce-filled-cart-block',
  '.wp-block-woocommerce-cart:not([hidden])',
  '.wc-empty-cart-message',
  '.cart_item',
  '.woocommerce-cart-item',
  '.cart-empty',
  '.woocommerce-info',
].join(', ');

/**
 * Playwright sayfası sitenin http(s) origin'inde mi?
 * about:blank / origin null → Store API CORS 401.
 * @param {string} pageUrl
 * @param {string} baseUrl
 */
export function pageHasSiteOrigin(pageUrl, baseUrl) {
  try {
    const raw = String(pageUrl || '').trim();
    if (!raw || raw === 'about:blank' || raw.startsWith('chrome') || raw.startsWith('data:')) {
      return false;
    }
    const pageOrigin = new URL(raw).origin;
    if (!pageOrigin || pageOrigin === 'null') return false;
    const siteOrigin = new URL(String(baseUrl || '')).origin;
    return pageOrigin === siteOrigin;
  } catch {
    return false;
  }
}

/**
 * Sepeti sepet sayfası HTML'i ile boşalt (Store API yok).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function emptyCartViaPageHtml(page, baseUrl) {
  if (!(await pageLooksLikeWooCart(page))) {
    await gotoWooCart(page, baseUrl);
  }
  const visibleRemove = () => page.locator(CART_PAGE_REMOVE_SEL).filter({ visible: true });
  for (let i = 0; i < 12; i++) {
    const n = await visibleRemove().count();
    if (n === 0) return;
    await visibleRemove().first().click({ timeout: 5000 });
    try {
      await page.waitForFunction(
        ({ remove, empty, prev }) => {
          const nodes = [...document.querySelectorAll(remove)].filter((el) => {
            const st = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return st.display !== 'none' && st.visibility !== 'hidden' && r.width + r.height > 0;
          });
          if (nodes.length < prev) return true;
          return !!document.querySelector(empty);
        },
        { remove: CART_PAGE_REMOVE_SEL, empty: CART_EMPTY_SEL, prev: n },
        { timeout: 8000 }
      );
    } catch (e) {
      if (page.isClosed()) throw e;
      const left = await visibleRemove().count();
      if (left < n) continue;
      if ((await page.locator(CART_EMPTY_SEL).count()) > 0) return;
      throw e;
    }
  }
}

/**
 * Sepeti boşalt. Store API yalnız sayfa site origin'indeyken (about:blank yok).
 * Yedek: sepet sayfası HTML remove.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function emptyCart(page, baseUrl) {
  const tryStore = async () => {
    if (!pageHasSiteOrigin(page.url(), baseUrl)) return false;
    const globals = await readStoreApiNonceGlobals(page);
    const result = await emptyCartStoreApiWithFetch(playwrightStoreFetch(page), {
      baseUrl,
      globals,
    });
    if (result.emptied) {
      const n = await cartItemCount(page, baseUrl);
      if (n === 0) return true;
    }
    return false;
  };
  if (await tryStore()) return;
  await emptyCartViaPageHtml(page, baseUrl);
  if (await tryStore()) return;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
async function storeApiGetCartData(page, baseUrl) {
  const globals = await readStoreApiNonceGlobals(page);
  let nonce = storeApiNonceFromGlobals(globals);
  const res = await storeApiFetch(playwrightStoreFetch(page), {
    url: storeApiCartUrl(baseUrl, '/cart'),
    method: 'GET',
    nonce,
  });
  const headerNonce = storeApiNonceFromHeaders(res.headers);
  if (headerNonce) nonce = headerNonce;
  if (!res.ok) return { ok: false, status: res.status, data: null, nonce };
  const data = await res.json();
  return { ok: true, status: res.status, data, nonce };
}

export async function cartItemCount(page, baseUrl) {
  try {
    const got = await storeApiGetCartData(page, baseUrl);
    if (!got.ok || !got.data) return -1;
    const data = got.data;
    return Array.isArray(data.items) ? data.items.length : (data.items_count ?? -1);
  } catch (e) {
    console.error(`[e2e:catch-fail] cartItemCount: ${e && e.message ? e.message : e}`);
    return -1;
  }
}

/**
 * Store API sepet kalemleri (id + ad + tutar).
 * TRY gibi currency_minor_unit=0 sitelerde `|| 2` kullanılmaz (0 geçerli).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<Array<{id:number,name:string,totals:string,quantity:number}>>}
 */
export function mapStoreCartItems(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const cartMinor =
    data?.totals && data.totals.currency_minor_unit != null
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
      totals.currency_minor_unit != null ? Number(totals.currency_minor_unit) : NaN;
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
}

export async function cartItemsDetail(page, baseUrl) {
  try {
    const got = await storeApiGetCartData(page, baseUrl);
    if (!got.ok || !got.data) return [];
    return mapStoreCartItems(got.data);
  } catch (e) {
    console.error(`[e2e:catch-fail] cartItemsDetail: ${e && e.message ? e.message : e}`);
    return [];
  }
}

/**
 * Store API sepet özeti (adet / ürün / tutar / para birimi). DOM yok.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<{items_count:number,currency_code:string,currency_symbol:string,items:Array<{id:number,name:string,totals:string,quantity:number}>}>}
 */
export async function cartStoreSnapshot(page, baseUrl) {
  const got = await storeApiGetCartData(page, baseUrl);
  if (!got.ok || !got.data) {
    throw new Error(`Store API sepet HTTP ${got.status || 0}`);
  }
  const data = got.data;
  const totals = data && data.totals ? data.totals : {};
  const items = mapStoreCartItems(data);
  return {
    items_count: Array.isArray(data.items)
      ? data.items.length
      : Number(data.items_count) || 0,
    currency_code: String(totals.currency_code || ''),
    currency_symbol: String(totals.currency_symbol || ''),
    items,
  };
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
 * Açılış animasyonu bitsin (getAnimations + opacity≥0.99). Sabit uyku yok.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<boolean>}
 */
export async function waitOpenShellSettled(page, timeout = 8000) {
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-dp-overlay].is-open');
      if (!el) return false;
      const surface = el.querySelector('[data-dp-surface]') || el;
      const box = surface.getBoundingClientRect();
      if (box.width <= 80) return false;
      return Number.parseFloat(getComputedStyle(surface).opacity || '1') > 0.99;
    }, { timeout });
    await waitShellAnimationsDone(page, timeout);
    return true;
  } catch (eSettle) {
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
  if ((await allTab.count()) > 0) {
    await allTab.click({ timeout: 4000 });
  }
  const id = Number(productId) || 0;
  if (id > 0) {
    await page.evaluate((pid) => {
      document.querySelectorAll('.wdp-list__item').forEach((item) => {
        if (item.querySelector('[data-wdp-form="' + String(pid) + '"]')) {
          item.hidden = false;
        }
      });
    }, id);
  }
}

export function shellTriggerLocator(page, mode, opts = {}) {
  const productId = Number(opts.productId) > 0 ? Number(opts.productId) : 0;
  const cardId = productId ? `[data-wdp-form="${productId}"]` : '';
  const rootId = productId ? `[data-dp-product="${productId}"]` : '';
  const kindSel =
    mode === 'panel'
      ? `[data-dp-exp][data-dp-kind="side_panel"]${rootId} [data-dp-open]`
      : `[data-dp-exp]:is([data-dp-kind="popup"], [data-dp-kind="bottom_sheet"])${rootId} [data-dp-open]`;
  // Liste kartı / döngü düğmesi önce (kendi ürün kimliğiyle), sonra köklerin açma düğmesi.
  return page.locator(`.wdp-card__cta${cardId}, .wdp-loop-donate${cardId}, ${kindSel}`);
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
    throw new Error('Bağış formu kabuğu kapanmadı (.is-open hâlâ var)');
  });
  // Açma düğmesi aria-expanded=false'a dönmeli (assets/src/experiences/layer.mjs close)
  const stillExpanded = await page.locator('[data-dp-open][aria-expanded="true"]').count();
  if (stillExpanded > 0) {
    throw new Error('Bağış formu kabuğu kapanmadı (aria-expanded=true)');
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
  // Form düzeyi uyarı + alan hata metinleri (`data-dp-error`)
  const nodes = root.locator(`${SEL.formError}, [data-dp-error]`);
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
  const matchAjax = (res) => isDonationAddToCartRequest(res.request());

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
      // Form JS bağlandı (data-dp-mounted) + 2 rAF
      await page
        .evaluate(async () => {
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
  const debugDir = path.join(ROOT, 'build/e2e/debug', String(process.env.WDP_E2E_PROFILE_ID || 'local'));
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
