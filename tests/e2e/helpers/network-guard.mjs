/**
 * Uzak E2E ağ koruması: ölçüm/reklam isteklerini kes, uzakta sipariş yazımını RED et.
 * URL sorgu dizesi loglanmaz (kişisel veri içerebilir).
 */
import { isRemoteProfile, peekActiveProfile } from './profile.mjs';

const INSTALLED = Symbol('wdpNetworkGuard');

/** Host soneki (alt alan dahil). fonts.googleapis.com / gstatic burada YOK. */
export const TRACKER_HOST_SUFFIXES = [
  'connect.facebook.net',
  'facebook.net',
  'graph.facebook.com',
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
  'bat.bing.com',
  'clarity.ms',
  'hotjar.com',
  'static.hotjar.com',
  'analytics.tiktok.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'ct.pinterest.com',
  'sc-static.net',
  'mc.yandex.ru',
  'segment.io',
  'cdn.segment.com',
  'plausible.io',
  'pixel.wp.com',
  'stats.wp.com',
  'cdn.matomo.cloud',
  'matomo.cloud',
];

/** Yola bağlı host kuralları (google.com'un tamamı değil). */
export const TRACKER_HOST_PATH_RULES = [
  { host: 'facebook.com', path: /^\/tr(\/|$)/i },
  { host: 'www.facebook.com', path: /^\/tr(\/|$)/i },
  { host: 'google.com', path: /^\/(pagead|ccm)(\/|$)/i },
  { host: 'www.google.com', path: /^\/(pagead|ccm)(\/|$)/i },
  { host: 'wp.com', path: /^\/stats(\/|$)/i },
  { host: 'www.wp.com', path: /^\/stats(\/|$)/i },
];

const MATOMO_PATH_RE = /\/(?:matomo|piwik)\.(?:js|php)(?:$|[/?])/i;
const MATOMO_HOST_RE = /(^|\.)matomo\.(cloud|org)$/i;

/** Uzak yazımda izinli wc-ajax uçları (apply_coupon / update_order_review yok). */
export const ALLOWED_WC_AJAX = new Set([
  'add_to_cart',
  'get_refreshed_fragments',
  'remove_from_cart',
]);

/** admin-ajax Woo sepet uçları (checkout yok). */
export const ALLOWED_ADMIN_AJAX = new Set([
  'woocommerce_add_to_cart',
  'woocommerce_get_refreshed_fragments',
]);

/** @type {Map<string, number>} */
const blockedByHost = new Map();
/** @type {string[]} */
const orderBlocks = [];
/** @type {Map<string, number>} */
const blockedPosts = new Map();

/**
 * @param {string} url
 * @returns {{ hostname: string, pathname: string } | null}
 */
export function parseUrlParts(url) {
  try {
    const u = new URL(String(url || ''), 'http://local.test');
    return {
      hostname: String(u.hostname || '').toLowerCase().replace(/\.$/, ''),
      pathname: u.pathname || '/',
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} hostname
 * @param {string} suffix
 */
export function hostMatchesSuffix(hostname, suffix) {
  const h = String(hostname || '').toLowerCase();
  const s = String(suffix || '').toLowerCase();
  if (!h || !s) return false;
  return h === s || h.endsWith(`.${s}`);
}

/**
 * @param {string} hostname
 * @param {string} [siteHost]
 */
export function isFirstPartyHost(hostname, siteHost) {
  const h = String(hostname || '').toLowerCase();
  const s = String(siteHost || '').toLowerCase().replace(/^www\./, '');
  if (!h || !s) return false;
  const bare = h.replace(/^www\./, '');
  return bare === s || bare.endsWith(`.${s}`);
}

/**
 * @param {string} url
 * @param {{ siteHost?: string }} [opts]
 */
export function isTrackerUrl(url, opts = {}) {
  const parts = parseUrlParts(url);
  if (!parts) return false;
  if (isFirstPartyHost(parts.hostname, opts.siteHost)) return false;

  for (const suffix of TRACKER_HOST_SUFFIXES) {
    if (hostMatchesSuffix(parts.hostname, suffix)) return true;
  }
  for (const rule of TRACKER_HOST_PATH_RULES) {
    if (hostMatchesSuffix(parts.hostname, rule.host) && rule.path.test(parts.pathname)) {
      return true;
    }
  }
  if (MATOMO_HOST_RE.test(parts.hostname)) return true;
  if (MATOMO_PATH_RE.test(parts.pathname) && !isFirstPartyHost(parts.hostname, opts.siteHost)) {
    // Üçüncü taraf /matomo.php — kendi site alanı yukarıda elendi.
    return true;
  }
  return false;
}

/**
 * @param {string|null|undefined} postData
 * @param {string} key
 */
function formField(postData, key) {
  const raw = String(postData || '');
  if (!raw) return '';
  try {
    const params = new URLSearchParams(raw);
    if (params.has(key)) return String(params.get(key) || '');
  } catch {
    /* düz metin */
  }
  const re = new RegExp(`(?:^|[&\\n])${key}=([^&\\n]*)`, 'i');
  const m = raw.match(re);
  return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
}

/**
 * @param {string} pathname
 */
function normalizePath(pathname) {
  const p = String(pathname || '/');
  if (p.length > 1 && p.endsWith('/')) return p.replace(/\/+$/, '') || '/';
  return p || '/';
}

/**
 * Tam URL veya yol → normalize pathname (sorgu yok).
 * @param {string} raw
 * @param {string} [fallback]
 */
export function pathFromMaybeUrl(raw, fallback = '/') {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  try {
    if (/^https?:\/\//i.test(s)) {
      return normalizePath(new URL(s).pathname || fallback);
    }
  } catch {
    /* relative */
  }
  const pathOnly = s.split('?')[0];
  if (pathOnly.startsWith('/')) return normalizePath(pathOnly);
  return normalizePath(`/${pathOnly}`);
}

/**
 * @param {string} pathname
 * @param {URLSearchParams} search
 */
function wcAjaxName(pathname, search) {
  const fromQuery = String(search?.get('wc-ajax') || '').trim();
  if (fromQuery) return fromQuery;
  const m = String(pathname || '').match(/\/wc-ajax\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : '';
}

/**
 * Store API batch gövdesindeki her istek cart yolunda mı?
 * @param {string} postData
 */
export function storeBatchAllCart(postData) {
  let parsed;
  try {
    parsed = JSON.parse(String(postData || ''));
  } catch {
    return false;
  }
  const reqs = Array.isArray(parsed?.requests) ? parsed.requests : [];
  if (!reqs.length) return false;
  return reqs.every((r) => {
    const p = String(r?.path || '');
    return /\/wc\/store\/(?:v\d+\/)?cart(?:\/|$)/i.test(p);
  });
}

/**
 * @param {string} action
 */
export function isWdpAjaxAction(action) {
  return /^wdp_[a-z0-9_]+$/i.test(String(action || '').trim());
}

/**
 * @param {{ method?: string, url?: string, postData?: string|null, checkoutPath?: string }} req
 */
export function isRemoteOrderRequest(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  const url = String(req?.url || '');
  let u;
  try {
    u = new URL(url, 'http://local.test');
  } catch {
    return false;
  }
  const pathname = normalizePath(u.pathname || '/');
  const search = u.searchParams;
  const postData = req?.postData == null ? '' : String(req.postData);

  if (/\/wp-admin\/post-new\.php$/i.test(pathname) && search.get('post_type') === 'shop_order') {
    return true;
  }
  if (
    /\/wp-admin\/admin\.php$/i.test(pathname) &&
    search.get('page') === 'wc-orders' &&
    search.get('action') === 'new'
  ) {
    return true;
  }

  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const storePath = pathname.replace(/^\/wp-json/, '');

  if (/\/wc\/store\/(?:v\d+\/)?cart(?:\/|$)/i.test(storePath)) {
    return false;
  }

  if (method === 'POST' && search.get('wc-ajax') === 'checkout') {
    return true;
  }

  if (
    isWrite &&
    /\/wc\/store\/(?:v\d+\/)?checkout(?:\/|$)/i.test(storePath)
  ) {
    return true;
  }

  if (method === 'POST' && /\/admin-ajax\.php$/i.test(pathname)) {
    const action = search.get('action') || formField(postData, 'action');
    if (action === 'woocommerce_checkout') return true;
  }

  if (method === 'POST') {
    if (/woocommerce_checkout_place_order|woocommerce-process-checkout-nonce/i.test(postData)) {
      return true;
    }
    const configured = pathFromMaybeUrl(req?.checkoutPath || '/checkout/', '/checkout/');
    if (pathname === configured || pathname === `${configured}/`) return true;
  }

  return false;
}

/**
 * Uzak profilde site alanına giden yazma: yalnız izin listesi.
 * apply_coupon ve update_order_review yok (ödeme sayfasında da).
 *
 * @param {{ method?: string, url?: string, postData?: string|null, checkoutPath?: string, cartPath?: string }} req
 */
export function isRemoteWriteAllowed(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;
  const url = String(req?.url || '');
  let u;
  try {
    u = new URL(url, 'http://local.test');
  } catch {
    return false;
  }
  const pathname = normalizePath(u.pathname || '/');
  const search = u.searchParams;
  const postData = req?.postData == null ? '' : String(req.postData);
  const storePath = pathname.replace(/^\/wp-json/, '');

  const ajax = wcAjaxName(pathname, search);
  if (ajax) {
    return ALLOWED_WC_AJAX.has(ajax);
  }

  if (/\/wc\/store\/(?:v\d+\/)?cart(?:\/|$)/i.test(storePath)) {
    return true;
  }

  if (/\/wc\/store\/(?:v\d+\/)?batch$/i.test(storePath)) {
    return storeBatchAllCart(postData);
  }

  if (/\/admin-ajax\.php$/i.test(pathname)) {
    const action = String(search.get('action') || formField(postData, 'action') || '').trim();
    if (isWdpAjaxAction(action)) return true;
    return ALLOWED_ADMIN_AJAX.has(action);
  }

  if (method === 'POST') {
    const cartPath = pathFromMaybeUrl(req?.cartPath || '/cart/', '/cart/');
    if (pathname === cartPath || pathname === `${cartPath}/`) {
      if (/(?:^|[&\n])(?:update_cart|remove_item)=/i.test(postData) || search.has('remove_item')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sayaç anahtarı: yol (sorgu yok); action adı serbest.
 * @param {string} url
 * @param {string} [postData]
 */
export function remotePostBlockKey(url, postData = '') {
  let pathname = '/';
  let action = '';
  let wcAjax = '';
  try {
    const u = new URL(String(url), 'http://local.test');
    pathname = u.pathname || '/';
    action = String(u.searchParams.get('action') || formField(postData, 'action') || '').trim();
    wcAjax = String(u.searchParams.get('wc-ajax') || '').trim();
  } catch {
    pathname = '/';
  }
  if (action) return `${pathname} action=${action}`;
  if (wcAjax) return `${pathname} wc-ajax=${wcAjax}`;
  return pathname;
}

/**
 * @param {string} url
 */
export function safeRequestPath(url) {
  try {
    const u = new URL(String(url), 'http://local.test');
    return `${u.pathname || '/'}${u.search ? '?…' : ''}`;
  } catch {
    return '/';
  }
}

function recordTracker(hostname) {
  const host = String(hostname || 'unknown').toLowerCase();
  blockedByHost.set(host, (blockedByHost.get(host) || 0) + 1);
}

export function resetBlockedTrackers() {
  blockedByHost.clear();
}

export function snapshotBlockedTrackers() {
  /** @type {Record<string, number>} */
  const byHost = {};
  let total = 0;
  for (const [host, n] of blockedByHost) {
    byHost[host] = n;
    total += n;
  }
  return { total, byHost };
}

function recordRemotePost(key) {
  const k = String(key || '/') || '/';
  blockedPosts.set(k, (blockedPosts.get(k) || 0) + 1);
}

export function resetRemotePostBlocked() {
  blockedPosts.clear();
}

export function snapshotRemotePostBlocked() {
  /** @type {Record<string, number>} */
  const byPath = {};
  let total = 0;
  for (const [p, n] of blockedPosts) {
    byPath[p] = n;
    total += n;
  }
  return { total, byPath };
}

export function consumeOrderBlocks() {
  const out = orderBlocks.slice();
  orderBlocks.length = 0;
  return out;
}

export function peekOrderBlocks() {
  return orderBlocks.slice();
}

export class RemoteOrderBlockedError extends Error {
  /**
   * @param {string} requestPath
   */
  constructor(requestPath) {
    super(`REMOTE-ORDER-BLOCKED: ${requestPath}`);
    this.name = 'RemoteOrderBlockedError';
    this.requestPath = requestPath;
  }
}

export function throwIfRemoteOrderBlocked() {
  const hits = consumeOrderBlocks();
  if (!hits.length) return;
  throw new RemoteOrderBlockedError(hits[0]);
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function siteHostFromEnv(env) {
  const base = String(env?.E2E_BASE_URL || env?._profile?.baseUrl || '');
  try {
    return new URL(base).hostname;
  } catch {
    return '';
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} env
 * @param {{ remote?: boolean, checkoutPath?: string, siteHost?: string }} [extra]
 */
export function guardOptionsFromEnv(env, extra = {}) {
  let profile = env?._profile || extra.profile || null;
  if (!profile) {
    try {
      profile = peekActiveProfile();
    } catch {
      profile = null;
    }
  }
  const remote =
    typeof extra.remote === 'boolean' ? extra.remote : isRemoteProfile(profile);
  return {
    remote,
    siteHost: extra.siteHost || siteHostFromEnv(env),
    checkoutPath: pathFromMaybeUrl(extra.checkoutPath || '/checkout/', '/checkout/'),
    cartPath: pathFromMaybeUrl(extra.cartPath || '/cart/', '/cart/'),
    blockTrackers: true,
  };
}

/**
 * Uzakta tracker engeli kapatılamaz (env ile bile).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ remote?: boolean, siteHost?: string, checkoutPath?: string, cartPath?: string, blockTrackers?: boolean }} opts
 */
export async function applyNetworkGuard(context, opts = {}) {
  if (!context || context[INSTALLED]) return context;
  const remote = !!opts.remote;
  const siteHost = String(opts.siteHost || '');
  const checkoutPath = pathFromMaybeUrl(opts.checkoutPath || '/checkout/', '/checkout/');
  const cartPath = pathFromMaybeUrl(opts.cartPath || '/cart/', '/cart/');
  const blockTrackers = remote ? true : opts.blockTrackers !== false;

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (blockTrackers && isTrackerUrl(url, { siteHost })) {
      const parts = parseUrlParts(url);
      recordTracker(parts?.hostname || 'unknown');
      await route.abort('blockedbyclient');
      return;
    }

    if (remote) {
      let postData = '';
      try {
        postData = request.postData() || '';
      } catch {
        postData = '';
      }
      const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
      const parts = parseUrlParts(url);
      const firstParty = !siteHost || isFirstPartyHost(parts?.hostname, siteHost);
      if (write && firstParty) {
        const reqInfo = { method, url, postData, checkoutPath, cartPath };
        const allowed = isRemoteWriteAllowed(reqInfo);
        if (!allowed) {
          recordRemotePost(remotePostBlockKey(url, postData));
          if (isRemoteOrderRequest(reqInfo)) {
            orderBlocks.push(safeRequestPath(url));
          }
          await route.abort('blockedbyclient');
          return;
        }
      }
    }

    await route.continue();
  });

  context[INSTALLED] = true;
  return context;
}

/**
 * browser.newContext sarmalayıcısı — her context otomatik korunur.
 * @param {import('@playwright/test').Browser} browser
 * @param {Record<string, unknown>|null} env
 * @param {{ remote?: boolean, checkoutPath?: string, siteHost?: string }} [extra]
 */
export function installBrowserGuard(browser, env, extra = {}) {
  if (!browser || browser[INSTALLED]) return browser;
  const orig = browser.newContext.bind(browser);
  const options = guardOptionsFromEnv(env, extra);
  browser.newContext = async function guardedNewContext(contextOpts) {
    const ctx = await orig(contextOpts);
    await applyNetworkGuard(ctx, options);
    return ctx;
  };
  browser[INSTALLED] = true;
  return browser;
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {object} [contextOpts]
 * @param {Record<string, unknown>|null} [env]
 * @param {{ remote?: boolean, checkoutPath?: string, siteHost?: string }} [extra]
 */
export async function createGuardedContext(browser, contextOpts, env, extra = {}) {
  installBrowserGuard(browser, env, extra);
  return browser.newContext(contextOpts);
}
