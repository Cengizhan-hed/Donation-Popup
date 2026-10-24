/**
 * Sepet doğrulama teşhisi: ekleme/okuma bağlamı, çerez ADI+alan/yol, Store API + /cart önbellek.
 * Çerez DEĞERİ ve kişisel veri yazılmaz.
 */
import path from 'node:path';
import { ROOT, withCacheBust, parseE2ECli } from './env.mjs';
import { debugDirFor } from './e2e-paths.mjs';
import { writeDebugJson } from './scenario-debug.mjs';
import { outputDeviceId } from './full-slices.mjs';
import { storeApiCartUrl } from './store-api.mjs';

/** @type {WeakMap<object, 'visitor'|'admin'>} */
const CONTEXT_KIND = new WeakMap();

export const CART_STATE_CLASSES = Object.freeze([
  'baglam-farki',
  'cerez-yok',
  'onbellek',
  'bilinmiyor',
]);

export const CART_CACHE_HEADER_KEYS = Object.freeze([
  'cache-control',
  'age',
  'x-cache',
  'x-litespeed-cache',
  'cf-cache-status',
  'x-proxy-cache',
  'vary',
]);

const WOO_CART_COOKIE_RE =
  /^(wp_woocommerce_session_|woocommerce_items_in_cart$|woocommerce_cart_hash$)/i;

const CART_ROW_SEL = [
  '.woocommerce-cart-form .cart_item',
  'tr.cart_item',
  '.woocommerce-cart-item',
  '.wc-block-cart-items .wc-block-cart-item',
  '.wc-block-cart-items .wc-block-cart-item__product',
].join(', ');

/**
 * @param {import('@playwright/test').BrowserContext} ctx
 * @param {'visitor'|'admin'|string} kind
 */
export function markBrowserContextKind(ctx, kind) {
  if (ctx) CONTEXT_KIND.set(ctx, kind === 'admin' ? 'admin' : 'visitor');
  return ctx;
}

/**
 * @param {import('@playwright/test').BrowserContext|null|undefined} ctx
 * @returns {'visitor'|'admin'|'bilinmiyor'}
 */
export function browserContextKind(ctx) {
  if (!ctx) return 'bilinmiyor';
  return CONTEXT_KIND.get(ctx) || 'bilinmiyor';
}

/**
 * @param {import('@playwright/test').Page|null|undefined} page
 * @returns {'visitor'|'admin'|'bilinmiyor'}
 */
export function pageContextKind(page) {
  try {
    return browserContextKind(page && page.context());
  } catch {
    return 'bilinmiyor';
  }
}

/**
 * @param {string} [explicit]
 */
export function e2eDeviceLabel(explicit) {
  if (explicit) return String(explicit);
  const flags = parseE2ECli();
  return outputDeviceId(flags.device || 'device', flags.slice || '');
}

/**
 * @param {object|null|undefined} headers
 */
export function pickCacheHeaders(headers) {
  const src = headers && typeof headers === 'object' ? headers : {};
  const get = (k) => {
    if (typeof src.get === 'function') {
      return String(src.get(k) || src.get(k.toUpperCase()) || '');
    }
    const want = String(k).toLowerCase();
    for (const [key, val] of Object.entries(src)) {
      if (String(key).toLowerCase() === want) return val == null ? '' : String(val);
    }
    return '';
  };
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of CART_CACHE_HEADER_KEYS) out[k] = get(k);
  return out;
}

/**
 * age>0 veya x-cache / LiteSpeed / CF / proxy HIT.
 * @param {object|null|undefined} headers
 */
export function cacheHeadersIndicateHit(headers) {
  const h = pickCacheHeaders(headers);
  const age = Number(h.age);
  if (Number.isFinite(age) && age > 0) return true;
  const blob = [h['x-cache'], h['x-litespeed-cache'], h['cf-cache-status'], h['x-proxy-cache']]
    .join(' ')
    .toLowerCase();
  return /\bhit\b/.test(blob);
}

/**
 * @param {object|null|undefined} ajax
 */
export function parseAddToCartAjax(ajax) {
  const a = ajax && typeof ajax === 'object' ? ajax : {};
  let success = a.success === true || a.ok === true;
  let cart_count = Number.isFinite(Number(a.cart_count)) ? Number(a.cart_count) : -1;
  const status = Number(a.status) || 0;
  const preview = String(a.bodyPreview || a.body || '');
  if (preview) {
    try {
      const json = JSON.parse(preview);
      if (json && typeof json.success === 'boolean') success = json.success;
      const n =
        json && json.cart_count != null
          ? json.cart_count
          : json && json.data && json.data.cart_count != null
            ? json.data.cart_count
            : null;
      if (n != null && Number.isFinite(Number(n))) cart_count = Number(n);
    } catch {
      /* non-JSON */
    }
  }
  return { status, success, cart_count };
}

/**
 * @param {Array<{ name?: string, domain?: string, path?: string, value?: string, sameSite?: string }>|null|undefined} cookies
 */
export function summarizeWooCartCookies(cookies) {
  return (Array.isArray(cookies) ? cookies : [])
    .filter((c) => WOO_CART_COOKIE_RE.test(String((c && c.name) || '')))
    .map((c) => ({
      name: String(c.name || ''),
      domain: String(c.domain || ''),
      path: String(c.path || ''),
    }));
}

function hasWooSessionCookie(cookies) {
  return (Array.isArray(cookies) ? cookies : []).some((c) => {
    const n = String((c && c.name) || '');
    return /^wp_woocommerce_session_/i.test(n) || n === 'woocommerce_items_in_cart';
  });
}

/**
 * Öncelik: baglam-farki → cerez-yok → onbellek → bilinmiyor.
 * @param {object|null|undefined} diag
 * @returns {'baglam-farki'|'cerez-yok'|'onbellek'|'bilinmiyor'}
 */
export function classifyCartStateFailure(diag) {
  const d = diag && typeof diag === 'object' ? diag : {};
  const ctx = d.context && typeof d.context === 'object' ? d.context : {};
  const add = String(d.add_context || ctx.add || '');
  const read = String(d.read_context || ctx.read || '');
  const known = (k) => k === 'visitor' || k === 'admin';
  if (d.same_context === false || (known(add) && known(read) && add !== read)) {
    return 'baglam-farki';
  }
  const cookies = Array.isArray(d.cookies) ? d.cookies : [];
  if (!hasWooSessionCookie(cookies)) return 'cerez-yok';
  const storeH = d.store_api && d.store_api.headers;
  const pageH = d.cart_page && d.cart_page.headers;
  if (cacheHeadersIndicateHit(storeH) || cacheHeadersIndicateHit(pageH)) return 'onbellek';
  return 'bilinmiyor';
}

function emptyCacheHeaders() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const k of CART_CACHE_HEADER_KEYS) out[k] = '';
  return out;
}

/**
 * @param {object|null|undefined} raw
 */
export function buildCartStateDebugPayload(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const addIn = r.add && typeof r.add === 'object' ? r.add : {};
  const parsed = parseAddToCartAjax({ ...addIn, bodyPreview: addIn.bodyPreview || addIn.body });
  const ctxIn = r.context && typeof r.context === 'object' ? r.context : {};
  const addCtx = String(r.add_context || ctxIn.add || 'bilinmiyor');
  const readCtx = String(r.read_context || ctxIn.read || 'bilinmiyor');
  const same =
    typeof r.same_context === 'boolean'
      ? r.same_context
      : typeof ctxIn.same === 'boolean'
        ? ctxIn.same
        : addCtx === readCtx && addCtx !== 'bilinmiyor';
  const storeIn = r.store_api && typeof r.store_api === 'object' ? r.store_api : {};
  const pageIn = r.cart_page && typeof r.cart_page === 'object' ? r.cart_page : {};
  const built = {
    scenario: String(r.scenario || ''),
    device: String(r.device || ''),
    add: {
      status: Number.isFinite(Number(parsed.status)) ? Number(parsed.status) : 0,
      success: parsed.success === true,
      cart_count: Number.isFinite(Number(parsed.cart_count)) ? Number(parsed.cart_count) : -1,
    },
    context: {
      add: addCtx === 'admin' ? 'admin' : addCtx === 'visitor' ? 'visitor' : 'bilinmiyor',
      read: readCtx === 'admin' ? 'admin' : readCtx === 'visitor' ? 'visitor' : 'bilinmiyor',
      same,
    },
    cookies: summarizeWooCartCookies(r.cookies),
    store_api: {
      status: Number(storeIn.status) || 0,
      items_count: Number.isFinite(Number(storeIn.items_count)) ? Number(storeIn.items_count) : -1,
      headers: pickCacheHeaders(storeIn.headers),
    },
    cart_page: {
      status: Number(pageIn.status) || 0,
      dom_row_count: Number.isFinite(Number(pageIn.dom_row_count)) ? Number(pageIn.dom_row_count) : -1,
      headers: pickCacheHeaders(pageIn.headers),
    },
  };
  built.class = CART_STATE_CLASSES.includes(r.class)
    ? r.class
    : classifyCartStateFailure({ ...built, same_context: same });
  return built;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function probeStoreApiCartState(page, baseUrl) {
  const url = storeApiCartUrl(baseUrl, '/cart');
  /** @type {{ status: number, items_count: number, headers: Record<string, string> }} */
  const out = { status: 0, items_count: -1, headers: emptyCacheHeaders() };
  try {
    const res = await page.request.fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      failOnStatusCode: false,
    });
    out.status = res.status();
    out.headers = pickCacheHeaders(res.headers());
    try {
      const data = await res.json();
      out.items_count = Array.isArray(data.items)
        ? data.items.length
        : Number.isFinite(Number(data.items_count))
          ? Number(data.items_count)
          : -1;
    } catch {
      out.items_count = -1;
    }
  } catch {
    out.status = 0;
    out.items_count = -1;
  }
  return out;
}

function cartPathnameOf(url) {
  try {
    return new URL(String(url || '')).pathname;
  } catch {
    return '';
  }
}

function looksLikeCartPath(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return /\/cart$/i.test(p) || /\/sepet$/i.test(p);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} [cartPath]
 */
export async function probeCartPageState(page, baseUrl, cartPath) {
  const dest = String(cartPath || '/cart/') || '/cart/';
  /** @type {{ status: number, dom_row_count: number, headers: Record<string, string> }} */
  const out = { status: 0, dom_row_count: -1, headers: emptyCacheHeaders() };
  const already = looksLikeCartPath(cartPathnameOf(page.url()));
  try {
    const abs = new URL(dest, String(baseUrl || page.url() || 'http://127.0.0.1/').replace(/\/?$/, '/'));
    const res = await page.request.fetch(abs.href, { failOnStatusCode: false });
    out.status = res.status();
    out.headers = pickCacheHeaders(res.headers());
  } catch {
    /* istek yok */
  }
  if (!already) {
    try {
      const gotoUrl = withCacheBust(baseUrl, dest, { hdf_no_side_cart: '1' });
      const hadHeaders = CART_CACHE_HEADER_KEYS.some((k) => out.headers[k]);
      const nav = page.waitForResponse(
        (r) => {
          try {
            return r.request().resourceType() === 'document' && looksLikeCartPath(cartPathnameOf(r.url()));
          } catch {
            return false;
          }
        },
        { timeout: 20000 }
      );
      await Promise.all([
        nav
          .then((r) => {
            if (!hadHeaders && !out.status) {
              out.status = r.status();
              out.headers = pickCacheHeaders(r.headers());
            }
          })
          .catch(() => {}),
        page.goto(gotoUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }),
      ]);
    } catch {
      /* sayfa açılamadı */
    }
  }
  out.dom_row_count = await page.locator(CART_ROW_SEL).count().catch(() => -1);
  return out;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   baseUrl: string,
 *   scenario: string,
 *   device?: string,
 *   ajax?: object,
 *   add?: object,
 *   addContext?: string,
 *   cartPath?: string,
 * }} opts
 */
export async function collectCartStateDiag(page, opts = {}) {
  const addContext = opts.addContext || pageContextKind(page);
  const readContext = pageContextKind(page);
  const cookies = await page.context().cookies().catch(() => []);
  const store_api = await probeStoreApiCartState(page, opts.baseUrl || '');
  const cart_page = await probeCartPageState(page, opts.baseUrl || '', opts.cartPath);
  return buildCartStateDebugPayload({
    scenario: opts.scenario,
    device: e2eDeviceLabel(opts.device),
    add: opts.add || parseAddToCartAjax(opts.ajax),
    add_context: addContext,
    read_context: readContext,
    same_context: addContext === readContext && addContext !== 'bilinmiyor',
    cookies,
    store_api,
    cart_page,
  });
}

/**
 * @param {object} payload
 */
export function writeCartStateDebug(payload) {
  const p = buildCartStateDebugPayload(payload);
  const scenario = String(p.scenario || 'cart').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const device = String(p.device || 'device').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const file = path.join(debugDirFor(), `cart-state-${scenario}-${device}.json`);
  writeDebugJson(file, p);
  return path.relative(ROOT, file);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {object} opts
 */
export async function collectAndWriteCartState(page, opts) {
  try {
    const payload = await collectCartStateDiag(page, opts);
    const debugFile = writeCartStateDebug(payload);
    return { ...payload, debugFile };
  } catch {
    const fallback = buildCartStateDebugPayload({
      scenario: opts && opts.scenario,
      device: e2eDeviceLabel(opts && opts.device),
      add: (opts && (opts.add || opts.ajax)) || {},
      add_context: (opts && opts.addContext) || 'bilinmiyor',
      read_context: 'bilinmiyor',
      same_context: false,
      cookies: [],
    });
    const debugFile = writeCartStateDebug(fallback);
    return { ...fallback, debugFile };
  }
}
