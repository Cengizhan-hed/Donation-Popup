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

/** @type {Map<string, number>} */
const blockedByHost = new Map();
/** @type {string[]} */
const orderBlocks = [];

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
    const configured = normalizePath(req?.checkoutPath || '/checkout/');
    if (pathname === configured || pathname === `${configured}/`) return true;
    if (/\/(checkout|odeme|ödeme)(?:\/|$)/i.test(pathname)) return true;
  }

  return false;
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
    checkoutPath: extra.checkoutPath || '/checkout/',
    blockTrackers: true,
  };
}

/**
 * Uzakta tracker engeli kapatılamaz (env ile bile).
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{ remote?: boolean, siteHost?: string, checkoutPath?: string, blockTrackers?: boolean }} opts
 */
export async function applyNetworkGuard(context, opts = {}) {
  if (!context || context[INSTALLED]) return context;
  const remote = !!opts.remote;
  const siteHost = String(opts.siteHost || '');
  const checkoutPath = opts.checkoutPath || '/checkout/';
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
      if (isRemoteOrderRequest({ method, url, postData, checkoutPath })) {
        const requestPath = safeRequestPath(url);
        orderBlocks.push(requestPath);
        await route.abort('blockedbyclient');
        return;
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
