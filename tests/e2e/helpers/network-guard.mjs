/**
 * Uzak E2E ağ koruması: ölçüm/reklam isteklerini kes, uzakta sipariş yazımını RED et.
 * URL sorgu dizesi loglanmaz (kişisel veri içerebilir).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { isRemoteProfile, peekActiveProfile } from './profile.mjs';
import {
  LIVE_HOST_BLOCKLIST,
  ALLOWED_HEDEF_HOST,
  extractHost,
} from '../../../scripts/lib/deploy-guards.mjs';

const INSTALLED = Symbol('wdpNetworkGuard');
const AJAX_WATCH = Symbol('wdpPluginAjaxWatch');

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
  // Stripe.js ölçüm işaretçileri (WooCommerce Payments sepet/ödeme sayfalarında): ödeme API'si DEĞİL.
  'r.stripe.com',
  'q.stripe.com',
  'm.stripe.com',
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

/**
 * includes/ içindeki `wp_ajax_nopriv_wdp_*` — ziyaretçi uçları (görev 1K kanıt listesi).
 * Yönetici `wp_ajax_wdp_save_*` vb. burada YOK.
 */
export const EXPECTED_WDP_NOPRIV_AJAX = Object.freeze([
  'wdp_ajax_add_to_cart',
  'wdp_get_cart_contents',
  'wdp_get_cart_count',
  'wdp_get_fresh_nonces',
  'wdp_get_product_info',
  'wdp_get_product_name',
  'wdp_remove_cart_item',
  'wdp_render_modal',
  'wdp_verify_submission_in_cart',
]);

/** Emekli Hedef staging — her uzak koşuda GET dahil iptal + kırmızı. live-scan:allow-reject-test */
export const RETIRED_HOST_SUFFIXES = Object.freeze([
  'staging28.hedefdernegi.org', // live-scan:allow-reject-test
]);

/** @type {Map<string, number>} */
const blockedByHost = new Map();
/** @type {Map<string, number>} */
const blockedLiveByHost = new Map();
/** @type {string[]} */
const orderBlocks = [];
/** @type {string[]} */
const adminWriteBlocks = [];
/** @type {string[]} */
const foreignWriteBlocks = [];
/** @type {string[]} */
const retiredHostBlocks = [];
/** @type {Map<string, number>} */
const blockedPosts = new Map();
/** @type {Map<string, number>} */
const allowedReads = new Map();
/** @type {Array<{ action: string, status: number }>} */
const pluginAjaxFails = [];
let ajaxWatchPaused = 0;

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

function isIpOrLocalhost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h);
}

/**
 * Canlı Hedef apeksi (www düşer). staging30 hariç; alt alanlar retired.
 * LIVE_HOST_BLOCKLIST + ALLOWED_HEDEF_HOST. live-scan:blacklist-def
 * @param {string} hostOrUrl
 */
export function isLiveBlockedHost(hostOrUrl) {
  const h = extractHost(hostOrUrl);
  if (!h) return false;
  if (h === ALLOWED_HEDEF_HOST) return false;
  return h === 'hedefdernegi.org'; // live-scan:blacklist-def
}

/**
 * @param {string} hostname
 */
export function matchesLiveHostBlocklist(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  return LIVE_HOST_BLOCKLIST.some((re) => re.test(h));
}

/**
 * @param {string} hostname
 */
export function parentRegisteredDomain(hostname) {
  const h = extractHost(hostname);
  if (!h || isIpOrLocalhost(h)) return h;
  const parts = h.split('.').filter(Boolean);
  if (parts.length <= 2) return h;
  return parts.slice(-2).join('.');
}

/**
 * @param {string} hostname
 * @param {string[]} [allowedHosts]
 */
export function isAllowedProfileHost(hostname, allowedHosts = []) {
  const h = extractHost(hostname);
  if (!h) return false;
  for (const raw of allowedHosts || []) {
    const a = extractHost(raw);
    if (a && h === a) return true;
  }
  return false;
}

/**
 * Bilinen emekli host veya izinli profilin aynı ebeveyn alanındaki izinsiz kardeş.
 * @param {string} hostname
 * @param {string[]} [allowedHosts]
 */
export function isRetiredSimilarHost(hostname, allowedHosts = []) {
  const h = extractHost(hostname);
  if (!h || isIpOrLocalhost(h)) return false;
  if (isLiveBlockedHost(h)) return false;
  if (isAllowedProfileHost(h, allowedHosts)) return false;
  for (const suffix of RETIRED_HOST_SUFFIXES) {
    if (hostMatchesSuffix(h, suffix)) return true;
  }
  if (matchesLiveHostBlocklist(h) && h !== ALLOWED_HEDEF_HOST) {
    return true;
  }
  for (const raw of allowedHosts || []) {
    const a = extractHost(raw);
    if (!a || isIpOrLocalhost(a)) continue;
    const parent = parentRegisteredDomain(a);
    if (!parent) continue;
    if (h === parent || h.endsWith(`.${parent}`)) return true;
  }
  return false;
}

/**
 * @param {string} hostname
 * @param {{ allowedHosts?: string[], siteHost?: string }} [opts]
 * @returns {'allowed'|'live'|'retired'|'first-party'|'foreign'}
 */
export function classifyRemoteHost(hostname, opts = {}) {
  const h = extractHost(hostname);
  if (!h) return 'foreign';
  const allowed = Array.isArray(opts.allowedHosts) ? opts.allowedHosts : [];
  if (isAllowedProfileHost(h, allowed)) return 'allowed';
  if (isLiveBlockedHost(h)) return 'live';
  if (isRetiredSimilarHost(h, allowed)) return 'retired';
  if (opts.siteHost && isFirstPartyHost(h, opts.siteHost)) return 'first-party';
  return 'foreign';
}

/**
 * Konsol metninden host/URL — font CORS ve iptal edilen istek.
 * @param {string} text
 */
export function hostFromConsoleText(text) {
  const t = String(text || '');
  const m = t.match(/https?:\/\/([^/\s'"]+)/i);
  if (m) return extractHost(m[1]);
  const pathHost = t.match(/\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
  if (pathHost) return extractHost(pathHost[1]);
  return '';
}

/**
 * Konsol satırı: site/engellendi (canlı font, emekli host, iptal) eklenti hatası değil.
 * @param {string} text
 * @returns {'blocked-live'|'blocked-site'|'cancelled-ajax'|'plugin'|''}
 */
export function classifyBlockedConsoleError(text) {
  const t = String(text || '');
  const host = hostFromConsoleText(t);
  const live = host && isLiveBlockedHost(host);
  const retired = host && isRetiredSimilarHost(host, []);
  const fontCors =
    /access to font/i.test(t) ||
    (/font/i.test(t) && /cors|access control/i.test(t));
  if (live || (fontCors && (!host || live || /hedefdernegi\.org/i.test(t)))) {
    return 'blocked-live';
  }
  if (retired) return 'blocked-site';
  if (/ERR_BLOCKED_BY_CLIENT|blockedbyclient/i.test(t)) {
    return 'blocked-site';
  }
  if (
    (/net::ERR_FAILED/i.test(t) && (live || retired || /hedefdernegi\.org|staging28/i.test(t))) ||
    (/access control checks/i.test(t) && (live || retired || /staging28|hedefdernegi\.org/i.test(t)))
  ) {
    return 'blocked-site';
  }
  if (/admin-ajax\.php/i.test(t) && /access control checks/i.test(t)) {
    return 'cancelled-ajax';
  }
  return '';
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
 * @param {string|Buffer|null|undefined} postData
 * @returns {string}
 */
export function bodyToString(postData) {
  if (postData == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(postData)) {
    return postData.toString('utf8');
  }
  if (typeof postData === 'string') return postData;
  try {
    return String(postData);
  } catch {
    return '';
  }
}

/**
 * @param {Headers|Record<string, string>|null|undefined} headers
 * @param {string} name
 */
function headerValue(headers, name) {
  if (!headers) return '';
  const want = String(name || '').toLowerCase();
  if (typeof headers.get === 'function') {
    return String(headers.get(name) || headers.get(want) || '');
  }
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === want) return String(v || '');
  }
  return '';
}

/**
 * @param {string} raw
 * @param {string} [contentType]
 */
function actionFromMultipart(raw, contentType = '') {
  const body = String(raw || '');
  if (!body) return '';
  let boundary = '';
  const bm = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (bm) boundary = String(bm[1] || bm[2] || '').trim();
  if (!boundary) {
    const first = body.match(/^--+([^\r\n]+)/);
    if (first) boundary = String(first[1] || '').replace(/--$/, '');
  }
  if (boundary) {
    const esc = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = body.split(new RegExp(`(?:\\r?\\n)?--+${esc}`));
    for (const part of parts) {
      if (!/Content-Disposition:/i.test(part)) continue;
      const nameM = part.match(/\bname=(?:"action"|'action'|action)(?:[;\s"]|$)/i);
      if (!nameM) continue;
      const split = part.split(/\r?\n\r?\n/, 2);
      if (split.length < 2) continue;
      return String(split[1] || '')
        .replace(/\r?\n[\s\S]*$/, '')
        .trim();
    }
  }
  const fallback = body.match(/name=["']?action["']?[^\r\n]*\r?\n\r?\n([^\r\n]*)/i);
  return fallback ? String(fallback[1] || '').trim() : '';
}

/**
 * @param {string} raw
 */
function actionFromUrlEncoded(raw) {
  const body = String(raw || '');
  if (!body) return '';
  try {
    const params = new URLSearchParams(body);
    if (params.has('action')) return String(params.get('action') || '').trim();
  } catch {
    /* düz metin */
  }
  const m = body.match(/(?:^|[&\n])action=([^&\n]*)/i);
  if (!m) return '';
  try {
    return decodeURIComponent(String(m[1] || '').replace(/\+/g, ' ')).trim();
  } catch {
    return String(m[1] || '').trim();
  }
}

/**
 * @param {string} raw
 */
function actionFromJson(raw) {
  try {
    const parsed = JSON.parse(String(raw || ''));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.action != null) {
      return String(parsed.action).trim();
    }
  } catch {
    /* JSON değil */
  }
  return '';
}

/**
 * admin-ajax `action` — query, urlencoded, multipart, JSON.
 * @param {{ url?: string, postData?: string|Buffer|null, headers?: Headers|Record<string, string> }} [req]
 */
export function extractAjaxAction(req = {}) {
  const url = String(req?.url || '');
  try {
    const u = new URL(url, 'http://local.test');
    const q = String(u.searchParams.get('action') || '').trim();
    if (q) return q;
  } catch {
    /* relative */
  }
  const raw = bodyToString(req?.postData);
  const ctype = headerValue(req?.headers, 'content-type');
  const looksMultipart =
    /multipart\/form-data/i.test(ctype) || /^(?:--[A-Za-z0-9'()+_,\-./:=?]+)/.test(raw.trim());
  if (looksMultipart) {
    const fromMulti = actionFromMultipart(raw, ctype);
    if (fromMulti) return fromMulti;
  }
  if (/application\/json/i.test(ctype) || /^\s*[{[]/.test(raw)) {
    const fromJson = actionFromJson(raw);
    if (fromJson) return fromJson;
  }
  const fromUrlenc = actionFromUrlEncoded(raw);
  if (fromUrlenc) return fromUrlenc;
  const fromMulti2 = actionFromMultipart(raw, ctype);
  if (fromMulti2) return fromMulti2;
  return '';
}

/**
 * Playwright Request — postData() boşsa postDataBuffer (WebKit FormData).
 * @param {import('@playwright/test').Request|null|undefined} request
 */
export function extractAjaxActionFromRequest(request) {
  if (!request) return '';
  let postData = '';
  try {
    postData = request.postData() || '';
  } catch {
    postData = '';
  }
  if (!postData && typeof request.postDataBuffer === 'function') {
    try {
      const buf = request.postDataBuffer();
      if (buf && buf.length) postData = Buffer.from(buf).toString('utf8');
    } catch {
      /* ignore */
    }
  }
  let headers = {};
  try {
    headers = typeof request.headers === 'function' ? request.headers() : {};
  } catch {
    headers = {};
  }
  let url = '';
  try {
    url = request.url();
  } catch {
    url = '';
  }
  return extractAjaxAction({ url, postData, headers });
}

/**
 * @param {import('@playwright/test').Request|null|undefined} request
 */
export function readRequestBody(request) {
  if (!request) return '';
  try {
    const s = request.postData();
    if (s) return s;
  } catch {
    /* ignore */
  }
  if (typeof request.postDataBuffer === 'function') {
    try {
      const buf = request.postDataBuffer();
      if (buf && buf.length) return Buffer.from(buf).toString('utf8');
    } catch {
      /* ignore */
    }
  }
  return '';
}

/**
 * includes/ (özyinelemeli) `wp_ajax_nopriv_wdp_*` ve yalnız `wp_ajax_wdp_*`.
 * @param {string} [includesDir]
 * @returns {{ nopriv: string[], adminOnly: string[] }}
 */
export function listWdpAjaxFromIncludes(includesDir) {
  const dir = includesDir || path.join(ROOT, 'includes');
  const nopriv = new Set();
  const priv = new Set();
  function walk(d) {
    if (!d || !fs.existsSync(d)) return;
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(p);
        continue;
      }
      if (!ent.name.endsWith('.php')) continue;
      let src = '';
      try {
        src = fs.readFileSync(p, 'utf8');
      } catch {
        continue;
      }
      let m;
      const noprivRe = /wp_ajax_nopriv_(wdp_[a-z0-9_]+)/gi;
      while ((m = noprivRe.exec(src))) nopriv.add(m[1]);
      const privRe = /wp_ajax_(?!nopriv_)(wdp_[a-z0-9_]+)/gi;
      while ((m = privRe.exec(src))) priv.add(m[1]);
    }
  }
  walk(dir);
  return {
    nopriv: [...nopriv].sort(),
    adminOnly: [...priv].filter((a) => !nopriv.has(a)).sort(),
  };
}

/**
 * 12.0.0: ön yüz AJAX uçları kaldırıldı (includes/ artık `wp_ajax_nopriv_wdp_*` içermez). Liste donmuş sözleşme olarak kalır
 * (emekli adlar; sunucuda uç yok, izin vermek zararsız); yeni ziyaretçi uçları REST `donation-panel/v1` altındadır.
 */
export const ALLOWED_WDP_NOPRIV_AJAX = new Set(EXPECTED_WDP_NOPRIV_AJAX);

/**
 * Profil `remoteReadOnlyPostActions` — yalnız eklenebilir; kod kuralı değişmez.
 * @param {object|null|undefined} profile
 * @returns {string[]}
 */
export function profileReadOnlyPostActions(profile) {
  const raw = profile?.remoteReadOnlyPostActions;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const a of raw) {
    const s = String(a || '').trim();
    if (s && /^[a-z0-9_]+$/i.test(s)) out.push(s);
  }
  return out;
}

/**
 * Eklenti yönetici uçları + sipariş — profil listesine konsa bile RED.
 * @param {string} action
 */
export function isHardDeniedRemoteAjaxAction(action) {
  const a = String(action || '').trim();
  if (!a) return false;
  if (a === 'woocommerce_checkout') return true;
  if (isWdpAjaxAction(a) && !ALLOWED_WDP_NOPRIV_AJAX.has(a)) return true;
  return false;
}

/**
 * @param {string} action
 * @param {string[]} extra
 */
export function isProfileReadOnlyPostAction(action, extra) {
  const a = String(action || '').trim();
  if (!a) return false;
  if (isHardDeniedRemoteAjaxAction(a)) return false;
  const list = Array.isArray(extra) ? extra : [];
  return list.includes(a);
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
 * Uzakta sipariş yazımı. Klasik checkout.js `update_order_review` /
 * `update_shipping_method` sipariş değildir (yine iptal: izin listesinde yok).
 * `woocommerce-process-checkout-nonce` yalnız checkout ajax / ödeme yolu /
 * admin-ajax `woocommerce_checkout` için kanıt; `woocommerce_checkout_place_order` gerçek gönderim.
 *
 * @param {{ method?: string, url?: string, postData?: string|null, headers?: Record<string, string>, checkoutPath?: string }} req
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
  const postData = bodyToString(req?.postData);
  const headers = req?.headers || {};
  const ajax = wcAjaxName(pathname, search);

  // Klasik checkout.js yenilemesi sipariş değil (izin listesinde yok → iptal + remote_post_blocked).
  if (ajax === 'update_order_review' || ajax === 'update_shipping_method') {
    return false;
  }

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

  if (method === 'POST' && ajax === 'checkout') {
    return true;
  }

  if (
    isWrite &&
    /\/wc\/store\/(?:v\d+\/)?checkout(?:\/|$)/i.test(storePath)
  ) {
    return true;
  }

  if (method === 'POST' && /\/admin-ajax\.php$/i.test(pathname)) {
    const action = extractAjaxAction({ url, postData, headers });
    if (action === 'woocommerce_checkout') return true;
  }

  if (method === 'POST') {
    if (/woocommerce_checkout_place_order/i.test(postData)) {
      return true;
    }
    const configured = pathFromMaybeUrl(req?.checkoutPath || '/checkout/', '/checkout/');
    if (pathname === configured || pathname === `${configured}/`) return true;
    // woocommerce-process-checkout-nonce tek başına sipariş değil
    // (update_order_review post_data); kanıt yalnız checkout ajax / ödeme yolu /
    // admin-ajax woocommerce_checkout (yukarıda).
  }

  return false;
}

/**
 * Uzak profilde site alanına giden yazma: yalnız izin listesi.
 * apply_coupon ve update_order_review yok (ödeme sayfasında da).
 *
 * @param {{ method?: string, url?: string, postData?: string|null, headers?: Record<string, string>, checkoutPath?: string, cartPath?: string, readOnlyActions?: string[] }} req
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
  const postData = bodyToString(req?.postData);
  const headers = req?.headers || {};
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
    const action = extractAjaxAction({ url, postData, headers });
    if (ALLOWED_WDP_NOPRIV_AJAX.has(action)) return true;
    if (ALLOWED_ADMIN_AJAX.has(action)) return true;
    const extra = Array.isArray(req?.readOnlyActions) ? req.readOnlyActions : [];
    if (isProfileReadOnlyPostAction(action, extra)) return true;
    return false;
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
 * Yönetici wdp_* (nopriv değil) — uzakta iptal + kırmızı.
 * @param {{ method?: string, url?: string, postData?: string|null, headers?: Record<string, string> }} req
 */
export function isRemoteAdminWrite(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  const url = String(req?.url || '');
  let pathname = '/';
  try {
    pathname = normalizePath(new URL(url, 'http://local.test').pathname || '/');
  } catch {
    return false;
  }
  if (!/\/admin-ajax\.php$/i.test(pathname)) return false;
  const action = extractAjaxAction({
    url,
    postData: req?.postData,
    headers: req?.headers,
  });
  if (!isWdpAjaxAction(action)) return false;
  return !ALLOWED_WDP_NOPRIV_AJAX.has(action);
}

/**
 * Sayaç anahtarı: yol (sorgu yok); action adı serbest.
 * @param {string} url
 * @param {string} [postData]
 * @param {Record<string, string>} [headers]
 */
export function remotePostBlockKey(url, postData = '', headers = {}) {
  let pathname = '/';
  let action = '';
  let wcAjax = '';
  try {
    const u = new URL(String(url), 'http://local.test');
    pathname = u.pathname || '/';
    action = extractAjaxAction({ url, postData, headers });
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

/**
 * Yabancı alan adına yazma girişimi için kaynak teşhisi (kişisel veri yok): ana makine, yol (sorgusuz),
 * kaynak türü, isteği başlatan sayfa yolu, yöntem. Hangi eklenti/tema olduğunu bulmaya yarar.
 * @param {import('@playwright/test').Request} request
 * @param {string} url
 */
export function describeForeignWrite(request, url) {
  let host = '';
  let pathName = '/';
  try {
    const u = new URL(String(url));
    host = u.hostname;
    pathName = u.pathname || '/';
  } catch {
    /* geçersiz URL */
  }
  let type = '';
  let framePath = '';
  let method = '';
  try {
    type = typeof request.resourceType === 'function' ? request.resourceType() : '';
    method = typeof request.method === 'function' ? request.method() : '';
    const fr = typeof request.frame === 'function' ? request.frame() : null;
    framePath = fr && typeof fr.url === 'function' ? safeRequestPath(fr.url()).replace(/\?…$/, '') : '';
  } catch {
    /* sayfa kapanmış olabilir */
  }
  return `${method} ${host}${pathName} [tür=${type || '?'} sayfa=${framePath || '?'}]`;
}

function recordTracker(hostname) {
  const host = String(hostname || 'unknown').toLowerCase();
  blockedByHost.set(host, (blockedByHost.get(host) || 0) + 1);
}

export function resetBlockedTrackers() {
  blockedByHost.clear();
  blockedLiveByHost.clear();
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

function recordLiveBlock(hostname) {
  const host = String(hostname || 'unknown').toLowerCase();
  blockedLiveByHost.set(host, (blockedLiveByHost.get(host) || 0) + 1);
}

export function snapshotBlockedLive() {
  /** @type {Record<string, number>} */
  const byHost = {};
  let total = 0;
  for (const [host, n] of blockedLiveByHost) {
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
  allowedReads.clear();
  adminWriteBlocks.length = 0;
  foreignWriteBlocks.length = 0;
  retiredHostBlocks.length = 0;
  pluginAjaxFails.length = 0;
}

function recordAllowedRead(action) {
  const k = String(action || '').trim() || '(unknown)';
  allowedReads.set(k, (allowedReads.get(k) || 0) + 1);
}

export function snapshotAllowedReads() {
  /** @type {Record<string, number>} */
  const byAction = {};
  let total = 0;
  for (const [a, n] of allowedReads) {
    byAction[a] = n;
    total += n;
  }
  return { total, byAction };
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

/**
 * @param {{ total?: number, byPath?: Record<string, number> }|null|undefined} snap
 */
export function formatRemotePostBlockedLines(snap, allowed, extra = {}) {
  const s = snap && typeof snap === 'object' ? snap : { total: 0, byPath: {} };
  const total = Number(s.total) || 0;
  const lines = [`remote_post_blocked: ${total}`];
  if (total > 0) {
    const byPath = s.byPath || {};
    for (const [k, n] of Object.entries(byPath)) {
      lines.push(`  • ${k}  ${n}`);
    }
  }
  if (allowed !== undefined) {
    const a = allowed && typeof allowed === 'object' ? allowed : { total: 0, byAction: {} };
    const n = Number(a.total) || 0;
    lines.push(`izinli-okuma: ${n}`);
    if (n > 0) {
      for (const [k, c] of Object.entries(a.byAction || {})) {
        lines.push(`  • ${k}  ${c}`);
      }
    }
  }
  const live = extra?.blocked_live;
  if (live && typeof live === 'object') {
    const n = Number(live.total) || 0;
    lines.push(`blocked_live: ${n}`);
    if (n > 0) {
      lines.push('UYARI: canlı alan isteği iptal edildi (sitenin önbellek kalıntısı; kırmızı değil)');
      for (const [k, c] of Object.entries(live.byHost || {})) {
        lines.push(`  • ${k}  ${c}`);
      }
    }
  }
  return lines.join('\n');
}

export function consumeOrderBlocks() {
  const out = orderBlocks.slice();
  orderBlocks.length = 0;
  return out;
}

export function peekOrderBlocks() {
  return orderBlocks.slice();
}

export function consumeAdminWriteBlocks() {
  const out = adminWriteBlocks.slice();
  adminWriteBlocks.length = 0;
  return out;
}

export function peekAdminWriteBlocks() {
  return adminWriteBlocks.slice();
}

export function snapshotPluginAjaxFails() {
  return pluginAjaxFails.slice();
}

export function pausePluginAjaxWatch() {
  ajaxWatchPaused += 1;
}

export function resumePluginAjaxWatch() {
  ajaxWatchPaused = Math.max(0, ajaxWatchPaused - 1);
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

export class RemoteAdminWriteBlockedError extends Error {
  /**
   * @param {string} requestPath
   */
  constructor(requestPath) {
    super(`REMOTE-ADMIN-WRITE-BLOCKED: ${requestPath}`);
    this.name = 'RemoteAdminWriteBlockedError';
    this.requestPath = requestPath;
  }
}

export class RemoteForeignWriteBlockedError extends Error {
  /**
   * @param {string} requestPath
   */
  constructor(requestPath) {
    super(`REMOTE-FOREIGN-WRITE: ${requestPath}`);
    this.name = 'RemoteForeignWriteBlockedError';
    this.requestPath = requestPath;
  }
}

export class RemoteRetiredHostBlockedError extends Error {
  /**
   * @param {string} requestPath
   */
  constructor(requestPath) {
    super(`REMOTE-RETIRED-HOST: ${requestPath}`);
    this.name = 'RemoteRetiredHostBlockedError';
    this.requestPath = requestPath;
  }
}

export function throwIfRemoteOrderBlocked() {
  const hits = consumeOrderBlocks();
  if (!hits.length) return;
  throw new RemoteOrderBlockedError(hits[0]);
}

export function throwIfRemoteAdminWriteBlocked() {
  const hits = consumeAdminWriteBlocks();
  if (!hits.length) return;
  throw new RemoteAdminWriteBlockedError(hits[0]);
}

export function consumeForeignWriteBlocks() {
  const out = foreignWriteBlocks.slice();
  foreignWriteBlocks.length = 0;
  return out;
}

export function consumeRetiredHostBlocks() {
  const out = retiredHostBlocks.slice();
  retiredHostBlocks.length = 0;
  return out;
}

export function throwIfRemoteForeignWriteBlocked() {
  const hits = consumeForeignWriteBlocks();
  if (!hits.length) return;
  throw new RemoteForeignWriteBlockedError(hits[0]);
}

export function throwIfRemoteRetiredHostBlocked() {
  const hits = consumeRetiredHostBlocks();
  if (!hits.length) return;
  throw new RemoteRetiredHostBlockedError(hits[0]);
}

/**
 * Eklenti admin-ajax / REST yanıtı: HTTP ≥400 veya success=false.
 * Gövde yazılmaz; yalnız action + durum kodu.
 * @param {import('@playwright/test').Page} page
 */
export function attachPluginAjaxFailureCollector(page) {
  if (!page || typeof page.on !== 'function') return pluginAjaxFails;
  if (page[AJAX_WATCH]) return pluginAjaxFails;
  page[AJAX_WATCH] = true;
  page.on('response', async (res) => {
    if (ajaxWatchPaused > 0) return;
    try {
      const url = res.url();
      const isAjax = /\/admin-ajax\.php/i.test(url);
      const isRest = /\/wp-json\//i.test(url);
      if (!isAjax && !isRest) return;
      const req = res.request();
      const action = extractAjaxActionFromRequest(req);
      const pluginAjax =
        isWdpAjaxAction(action) || /woo-donation-popup|\/wdp[_/-]/i.test(url);
      if (!pluginAjax) return;
      const status = Number(res.status()) || 0;
      if (status >= 400) {
        pluginAjaxFails.push({ action: action || '(unknown)', status });
        return;
      }
      let json = null;
      try {
        json = await res.json();
      } catch {
        return;
      }
      if (json && json.success === false) {
        pluginAjaxFails.push({ action: action || '(unknown)', status });
      }
    } catch {
      /* koleksiyon test akışını düşürmez */
    }
  });
  return pluginAjaxFails;
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
  const allowedHosts = Array.isArray(extra.allowedHosts)
    ? extra.allowedHosts
    : Array.isArray(profile?.allowedHosts)
      ? profile.allowedHosts
      : [];
  return {
    remote,
    siteHost: extra.siteHost || siteHostFromEnv(env),
    checkoutPath: pathFromMaybeUrl(extra.checkoutPath || '/checkout/', '/checkout/'),
    cartPath: pathFromMaybeUrl(extra.cartPath || '/cart/', '/cart/'),
    blockTrackers: true,
    readOnlyActions: profileReadOnlyPostActions(profile),
    allowedHosts,
    profile,
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
  const readOnlyActions = Array.isArray(opts.readOnlyActions)
    ? opts.readOnlyActions
    : profileReadOnlyPostActions(opts.profile);
  const allowedHosts = Array.isArray(opts.allowedHosts)
    ? opts.allowedHosts
    : Array.isArray(opts.profile?.allowedHosts)
      ? opts.profile.allowedHosts
      : siteHost
        ? [siteHost]
        : [];

  const existingPages = typeof context.pages === 'function' ? context.pages() : [];
  for (const page of existingPages || []) {
    attachPluginAjaxFailureCollector(page);
  }
  if (typeof context.on === 'function') {
    context.on('page', (page) => {
      attachPluginAjaxFailureCollector(page);
    });
  }

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
      const postData = readRequestBody(request);
      let headers = {};
      try {
        headers = typeof request.headers === 'function' ? request.headers() : {};
      } catch {
        headers = {};
      }
      const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
      const parts = parseUrlParts(url);
      const reqHost = parts?.hostname || '';
      const kind = classifyRemoteHost(reqHost, { allowedHosts, siteHost });
      if (kind === 'live') {
        recordLiveBlock(reqHost);
        await route.abort('blockedbyclient');
        return;
      }
      if (kind === 'retired') {
        retiredHostBlocks.push(safeRequestPath(url));
        await route.abort('blockedbyclient');
        return;
      }
      const onAllowed =
        kind === 'allowed' || kind === 'first-party' || isAllowedProfileHost(reqHost, allowedHosts);
      if (write && !onAllowed) {
        foreignWriteBlocks.push(describeForeignWrite(request, url));
        await route.abort('blockedbyclient');
        return;
      }
      const firstParty = onAllowed;
      if (write && firstParty) {
        const reqInfo = { method, url, postData, headers, checkoutPath, cartPath, readOnlyActions };
        const allowed = isRemoteWriteAllowed(reqInfo);
        if (!allowed) {
          recordRemotePost(remotePostBlockKey(url, postData, headers));
          if (isRemoteOrderRequest(reqInfo)) {
            orderBlocks.push(safeRequestPath(url));
          } else if (isRemoteAdminWrite(reqInfo)) {
            adminWriteBlocks.push(remotePostBlockKey(url, postData, headers));
          }
          await route.abort('blockedbyclient');
          return;
        }
        const action = extractAjaxAction({ url, postData, headers });
        if (
          isProfileReadOnlyPostAction(action, readOnlyActions) &&
          !ALLOWED_WDP_NOPRIV_AJAX.has(action) &&
          !ALLOWED_ADMIN_AJAX.has(action)
        ) {
          recordAllowedRead(action);
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
