/**
 * Uzak E2E sayfa/ürün çözümü: tek kaynak WP/Woo JSON (slug tahmini yok).
 * Env E2E_SHOP_PAGE / E2E_LIST_PAGE / E2E_PRODUCT_* uzak profilde kullanılmaz.
 */
import { SKIP_EVIDENCE, SKIP_REASONS, makeSkip } from './skip-policy.mjs';
export const PAGE_PRODUCT_ENV_KEYS = [
  'E2E_SHOP_PAGE',
  'E2E_LIST_PAGE',
  'E2E_PRODUCT_FIXED',
  'E2E_PRODUCT_CUSTOM',
  'E2E_PRODUCT_SHARES',
  'E2E_PRODUCT_CAMPAIGN',
];

export const DONATION_ROLES = ['fixed', 'custom', 'shares', 'campaign'];

/**
 * Ön yüz ürün sayfası mı (wp-admin değil). Sessiz devam yok — değilse yanlış-sayfa.
 * @param {{ pathname?: string, body_class?: string, product_id?: number, dom_product_id?: number }} state
 * @returns {{ ok: boolean, class: 'ok'|'yanlış-sayfa', reason: string }}
 */
export function classifyStorefrontProductPage(state) {
  const s = state && typeof state === 'object' ? state : {};
  const path = String(s.pathname || '');
  const body = String(s.body_class || '');
  const wantId = Number(s.product_id) || 0;
  const domId = Number(s.dom_product_id) || 0;
  if (/^\/wp-admin(\/|$)/i.test(path) || /\bwp-admin\b/.test(body)) {
    return { ok: false, class: 'yanlış-sayfa', reason: 'wp-admin' };
  }
  const single = /\bsingle-product\b/.test(body);
  const postIdMatch = wantId > 0 && new RegExp(`\\bpostid-${wantId}\\b`).test(body);
  const attrMatch = wantId > 0 && domId === wantId;
  if (single || postIdMatch || attrMatch) {
    return { ok: true, class: 'ok', reason: single ? 'single-product' : 'product-id' };
  }
  return { ok: false, class: 'yanlış-sayfa', reason: 'not-product' };
}

/**
 * E2E senaryo türü × ürün kaynağı (görev 3C).
 *
 * | Grup | Senaryo | Gerçek yayımlanmış ürün | Rol için gerçek yoksa |
 * |------|---------|-------------------------|------------------------|
 * | visitor-list-shop | ziyaretçi, liste, mağaza döngüsü, loop-donate | evet | ATLA (neden; hata değil) |
 * | product-form-panel-cart | ürün sayfası, form, panel, doğrulama, sepet | evet | fixture + yönetici oturumu |
 * | popup | popup (liste; yoksa mağaza döngüsü Bağış Yap) | evet | ATLA — kaynak yok veya fixture |
 */
export const SCENARIO_PRODUCT_POLICY = Object.freeze({
  'visitor-list-shop': Object.freeze({
    label: 'Ziyaretçi / liste / mağaza döngüsü',
    kinds: Object.freeze(['visitor', 'list', 'shop-loop', 'loop-donate']),
    source: 'published-only',
    ifMissing: 'skip',
  }),
  'product-form-panel-cart': Object.freeze({
    label: 'Ürün sayfası / form / panel / doğrulama / sepet',
    kinds: Object.freeze(['product-page', 'form', 'panel', 'validation', 'cart']),
    source: 'published-or-fixture-admin',
    ifMissing: 'fixture-admin',
  }),
  popup: Object.freeze({
    label: 'Popup (liste, yoksa mağaza döngüsü)',
    kinds: Object.freeze(['popup']),
    source: 'list-or-shop-loop',
    ifMissing: 'skip',
  }),
});

/** @type {Record<string, keyof typeof SCENARIO_PRODUCT_POLICY>} */
const SCENARIO_KIND_GROUP = (() => {
  /** @type {Record<string, keyof typeof SCENARIO_PRODUCT_POLICY>} */
  const map = {};
  for (const [group, spec] of Object.entries(SCENARIO_PRODUCT_POLICY)) {
    for (const kind of spec.kinds) map[kind] = /** @type {keyof typeof SCENARIO_PRODUCT_POLICY} */ (group);
  }
  return map;
})();

/**
 * @param {string} kind
 * @returns {keyof typeof SCENARIO_PRODUCT_POLICY | ''}
 */
export function scenarioPolicyGroup(kind) {
  return SCENARIO_KIND_GROUP[String(kind || '')] || '';
}

/**
 * @param {object} env
 * @param {string} role
 */
export function isFixtureRole(env, role) {
  if (Array.isArray(env?._fixtureRoles) && env._fixtureRoles.includes(role)) return true;
  const rec = env?._resolvedProducts?.[role];
  return !!(rec && rec.fromFixture);
}

/**
 * @param {object} env
 * @param {string} role
 */
export function isPublishedCatalogRole(env, role) {
  const rec = env?._resolvedProducts?.[role];
  return !!(rec && rec.fromCatalog);
}

/**
 * Popup açılış sayfası: liste kısa kodu, yoksa Woo mağaza döngüsü.
 * İkisi de yoksa atla (hata değil).
 *
 * @param {object} [env]
 * @returns {{ action: 'run'|'skip', path: string, source: 'list'|'shop'|'', reason: string, evidence?: string, detail?: string }}
 */
export function resolvePopupSource(env) {
  const list = pathFromMaybeUrl(env?.E2E_LIST_PAGE || env?._catalog?.list?.path || env?._catalog?.list?.url || '');
  if (list) {
    return { action: 'run', path: list, source: 'list', reason: '' };
  }
  const shop = pathFromMaybeUrl(env?.E2E_SHOP_PAGE || env?._catalog?.shop?.path || env?._catalog?.shop?.url || '');
  if (shop) {
    return {
      action: 'run',
      path: shop,
      source: 'shop',
      reason: '',
    };
  }
  return {
    action: 'skip',
    path: '',
    source: '',
    reason: SKIP_REASONS.NO_POPUP_SOURCE,
    evidence: SKIP_EVIDENCE.WP_DATA,
    detail: 'liste sayfası yok ve mağaza döngüsü yok',
  };
}

/**
 * @param {object} [env]
 * @param {string} [explicit]
 * @returns {string}
 */
export function popupPagePath(env, explicit) {
  const given = pathFromMaybeUrl(explicit || '');
  if (given) return given;
  return resolvePopupSource(env).path;
}

/**
 * @param {object} env
 * @param {string} role
 * @param {string} kind  SCENARIO_PRODUCT_POLICY kinds
 * @returns {{ action: 'run-visitor'|'run-admin'|'skip', admin: boolean, reason: string, evidence?: string, detail?: string, group: string, pagePath?: string, popupSource?: string }}
 */
export function decideScenarioProduct(env, role, kind) {
  const group = scenarioPolicyGroup(kind) || String(kind || '');
  const published = isPublishedCatalogRole(env, role);
  const fixture = isFixtureRole(env, role);
  if (group === 'popup') {
    if (!published) {
      return {
        action: 'skip',
        admin: false,
        reason: SKIP_REASONS.PRIVATE_FIXTURE,
        evidence: SKIP_EVIDENCE.WP_DATA,
        detail: String(role || ''),
        group,
      };
    }
    const src = resolvePopupSource(env);
    if (src.action === 'skip') {
      return {
        action: 'skip',
        admin: false,
        reason: src.reason || SKIP_REASONS.NO_POPUP_SOURCE,
        evidence: src.evidence || SKIP_EVIDENCE.WP_DATA,
        detail: src.detail || String(role || ''),
        group,
      };
    }
    return {
      action: 'run-visitor',
      admin: false,
      reason: '',
      group,
      pagePath: src.path,
      popupSource: src.source,
    };
  }
  if (group === 'visitor-list-shop') {
    if (published) {
      return { action: 'run-visitor', admin: false, reason: '', group };
    }
    return {
      action: 'skip',
      admin: false,
      reason: SKIP_REASONS.NO_PUBLISHED_PRODUCT,
      evidence: SKIP_EVIDENCE.WP_DATA,
      detail: String(role || ''),
      group,
    };
  }
  if (published) {
    return { action: 'run-visitor', admin: false, reason: '', group };
  }
  if (fixture) {
    return {
      action: 'run-admin',
      admin: true,
      reason: `${role}: fixture ürünü yönetici oturumunda`,
      group,
    };
  }
  return {
    action: 'skip',
    admin: false,
    reason: SKIP_REASONS.NO_PUBLISHED_PRODUCT,
    evidence: SKIP_EVIDENCE.WP_DATA,
    detail: String(role || ''),
    group,
  };
}

export const PLUGIN_CONTENT_NEEDLES = Object.freeze([
  '[wdp_',
  'wp:wdp',
  'woo-donation',
  'wdp-donation-form',
  'wdp-donations',
  'widgetType":"wdp-',
]);

/**
 * @param {string} fileName
 */
export function formatIgnoredPageEnvWarning(fileName) {
  const name = String(fileName || '.env').replace(/^.*[/\\]/, '') || '.env';
  return `UYARI: ${name} içindeki sayfa/ürün anahtarları kullanılmıyor (WP tek kaynak)`;
}

/**
 * Değer yazılmaz. Anahtar varsa uyarır.
 * @param {Record<string, string>} parsed
 * @param {string} fileName
 * @returns {{ present: boolean, warning: string }}
 */
export function inspectEnvPageProductKeys(parsed, fileName) {
  const env = parsed && typeof parsed === 'object' ? parsed : {};
  let present = false;
  for (const k of PAGE_PRODUCT_ENV_KEYS) {
    if (String(env[k] || '').trim()) {
      present = true;
      break;
    }
  }
  return {
    present,
    warning: present ? formatIgnoredPageEnvWarning(fileName) : '',
  };
}

/**
 * DonationPanel\Domain\Donation_Type::infer_from_meta ile aynı öncelik (shares → campaign → custom → fixed).
 * Yalnız sıkı `yes`.
 * @param {Record<string, string>|null|undefined} meta
 */
export function inferDonationType(meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const yes = (key) => m[key] === 'yes';
  if (yes('_allow_multiple_shares')) return 'shares';
  if (yes('_enable_progress_bar')) return 'campaign';
  if (yes('_allow_custom_price')) return 'custom';
  return 'fixed';
}

/**
 * @param {string} urlOrPath
 * @returns {string}
 */
export function pathFromMaybeUrl(urlOrPath) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const p = u.pathname || '/';
      return p === '/' ? '/' : p.endsWith('/') ? p : `${p}/`;
    }
  } catch {
    /* relative */
  }
  if (raw.startsWith('/')) {
    return raw === '/' ? '/' : raw.endsWith('/') ? raw : `${raw}/`;
  }
  return '';
}

/**
 * Ürün gezintisi: sorgu dizesi korunur.
 * `https://site/?post_type=product&p=915` → `/?post_type=product&p=915` (pathname "/" ana sayfa değildir).
 * @param {string} urlOrPath
 * @returns {string}
 */
export function navTargetFromUrl(urlOrPath) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const path = u.pathname || '/';
      const search = u.search || '';
      if (path === '/' || path === '') return search ? `/${search}` : '/';
      const withSlash = path.endsWith('/') ? path : `${path}/`;
      return `${withSlash}${search}`;
    }
  } catch {
    /* relative */
  }
  if (raw.startsWith('/')) return raw;
  if (raw.startsWith('?')) return `/${raw}`;
  return '';
}

/**
 * Döngü eşlemesi için path slug (tam URL Store API’de id=#0 üretir).
 * @param {{ slug?: string, path?: string, nav?: string, url?: string }|null|undefined} rec
 * @param {string} [raw]
 * @returns {string}
 */
export function loopProductSlug(rec, raw = '') {
  const fromRec = String(rec?.slug || '').trim();
  if (fromRec && !/[:/?#]/.test(fromRec)) return fromRec;
  const s = String(raw || rec?.path || rec?.nav || rec?.url || fromRec || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s, 'http://127.0.0.1');
    const parts = String(u.pathname || '')
      .split('/')
      .filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last && last !== 'product' && last !== 'urun') return last;
  } catch {
    const parts = s.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (last && !/[:?#]/.test(last)) return last;
  }
  return fromRec;
}

/**
 * Path "/" ve sorgu yok → ana sayfa (ürün adresi olamaz).
 * @param {string} target
 */
export function isBareHomeNav(target) {
  const t = String(target || '').trim();
  if (!t) return true;
  try {
    const u = /^https?:\/\//i.test(t) ? new URL(t) : new URL(t, 'http://e2e.local/');
    const path = u.pathname || '/';
    return (path === '/' || path === '') && !u.search;
  } catch {
    return t === '/' || t === '';
  }
}

/**
 * @param {string} target
 * @param {string} [label]
 * @returns {string}
 */
export function assertProductNavTarget(target, label = '') {
  const t = String(target || '').trim();
  const tag = label ? ` (${label})` : '';
  if (!t || isBareHomeNav(t)) {
    throw new Error(
      `ürün adresi ana sayfa ("/") olamaz${tag}; tam permalink veya ?post_type=product&p= gerekli`
    );
  }
  return t;
}

/**
 * Private fixture: get_permalink() (sorgu dahil) veya `/?post_type=product&p=ID`.
 * path "/" sessiz ana sayfa olarak kullanılmaz.
 * @param {{ url?: string, path?: string, id?: number|string }|null|undefined} row
 * @returns {string}
 */
export function pickFixtureNavTarget(row) {
  const url = String(row?.url || '').trim();
  if (/^https?:\/\//i.test(url) && !isBareHomeNav(url)) return url;
  const path = String(row?.path || '').trim();
  if (path && !isBareHomeNav(path)) return path.startsWith('/') || path.startsWith('?') ? path : `/${path}`;
  const fromUrl = navTargetFromUrl(url);
  if (fromUrl && !isBareHomeNav(fromUrl)) return fromUrl;
  const id = Math.abs(Number.parseInt(String(row?.id ?? ''), 10) || 0);
  if (id > 0) return `/?post_type=product&p=${id}`;
  return '';
}

/**
 * @param {string} text
 */
export function contentHasPluginMarker(text) {
  const s = String(text || '');
  if (!s) return false;
  return PLUGIN_CONTENT_NEEDLES.some((n) => s.includes(n));
}

/**
 * İlk yayımlanmış sayfa (içerik veya oluşturucu meta).
 * @param {Array<{ status?: string, content?: string, builder?: string, meta?: string, path?: string, url?: string, id?: number }>} pages
 */
export function pickListPage(pages) {
  const list = Array.isArray(pages) ? pages : [];
  for (const p of list) {
    if (!p) continue;
    const status = String(p.status || 'publish');
    if (status !== 'publish') continue;
    const blob = `${p.content || ''}\n${p.builder || ''}\n${p.meta || ''}`;
    if (contentHasPluginMarker(blob)) return p;
  }
  return null;
}

/**
 * Yayımlanmış + katalogda görünür, fixture değil. Rol başına ilk (id sırası çağıranda).
 * @param {Array<object>} products
 */
export function pickRoleProducts(products) {
  /** @type {Record<string, object>} */
  const out = {};
  const list = Array.isArray(products) ? products : [];
  for (const p of list) {
    if (!p) continue;
    if (p.fixture) continue;
    const status = String(p.status || 'publish');
    if (status !== 'publish') continue;
    const vis = String(p.visibility || 'visible');
    if (vis !== 'visible' && vis !== 'catalog') continue;
    const type = String(p.type || inferDonationType(p.meta || {}));
    if (!DONATION_ROLES.includes(type)) continue;
    if (out[type]) continue;
    const path = pathFromMaybeUrl(p.path || p.url || '');
    if (!path || path === '/') continue;
    out[type] = { ...p, type, path };
  }
  return out;
}

/**
 * @param {object} env loadE2EEnv çıktısı
 * @param {object} catalog WP eval JSON
 * @returns {object} env
 */
export function applyRemoteCatalog(env, catalog) {
  const cat = catalog && typeof catalog === 'object' ? catalog : {};
  env.E2E_SHOP_PAGE = pathFromMaybeUrl(cat.shop?.path || cat.shop?.url || '');
  env.E2E_CART_PAGE = pathFromMaybeUrl(cat.cart?.path || cat.cart?.url || '');
  env.E2E_CHECKOUT_PAGE = pathFromMaybeUrl(cat.checkout?.path || cat.checkout?.url || '');
  const list = cat.list;
  env.E2E_LIST_PAGE = list ? pathFromMaybeUrl(list.path || list.url || '') : '';
  env._catalog = {
    shop: cat.shop || null,
    cart: cat.cart || null,
    checkout: cat.checkout || null,
    list: list || null,
    fixtureRelated: cat.fixture_related && typeof cat.fixture_related === 'object' ? cat.fixture_related : {},
  };
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];
  env._resolvedProducts = env._resolvedProducts && typeof env._resolvedProducts === 'object'
    ? env._resolvedProducts
    : {};

  if (!env.E2E_LIST_PAGE) {
    env._roleSkips.push(
      makeSkip({
        check: 'list-page',
        reason: SKIP_REASONS.NO_LIST_PAGE,
        evidence: SKIP_EVIDENCE.WP_DATA,
      })
    );
  }
  if (!env.E2E_SHOP_PAGE) {
    env._roleSkips.push(
      makeSkip({
        check: 'shop-page',
        reason: SKIP_REASONS.NO_SHOP_PAGE,
        evidence: SKIP_EVIDENCE.WP_DATA,
      })
    );
  }
  env._popupSource = resolvePopupSource(env);
  if (env._popupSource.action === 'skip') {
    env._roleSkips.push(
      makeSkip({
        check: 'popup-source',
        reason: env._popupSource.reason || SKIP_REASONS.NO_POPUP_SOURCE,
        evidence: env._popupSource.evidence || SKIP_EVIDENCE.WP_DATA,
        detail: env._popupSource.detail,
      })
    );
  }

  const picked = pickRoleProducts(cat.products || []);
  for (const role of DONATION_ROLES) {
    const key = `E2E_PRODUCT_${role.toUpperCase()}`;
    const hit = picked[role];
    if (!hit) {
      env[key] = '';
      env._roleSkips.push(
        makeSkip({
          check: `role-${role}`,
          reason: role === 'shares' ? SKIP_REASONS.NO_PUBLISHED_SHARES : SKIP_REASONS.NO_PUBLISHED_PRODUCT,
          evidence: SKIP_EVIDENCE.WP_DATA,
          detail: String(role),
        })
      );
      continue;
    }
    env[key] = hit.path;
    env._resolvedProducts[role] = {
      id: Number(hit.id) || 0,
      slug: String(hit.slug || ''),
      title: String(hit.title || ''),
      path: hit.path,
      url: String(hit.url || ''),
      nav: hit.path,
      type: role,
      display: String(hit.display || ''),
      fromCatalog: true,
      relatedIds: Array.isArray(hit.related_ids) ? hit.related_ids.map((n) => Number(n) || 0).filter(Boolean) : undefined,
      upsellIds: Array.isArray(hit.upsell_ids) ? hit.upsell_ids.map((n) => Number(n) || 0).filter(Boolean) : undefined,
    };
  }
  return env;
}

/**
 * Değer zaten yol ise ( /… veya http ) pathname; slug tahmini yok.
 * @param {string} value
 * @returns {string}
 */
export function productNavPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const fromUrl = navTargetFromUrl(raw);
  if (fromUrl && !isBareHomeNav(fromUrl)) return fromUrl;
  return '';
}

/**
 * WP eval-file stdout (gürültülü olabilir) → katalog nesnesi.
 * @param {string} raw
 * @returns {object|null}
 */
export function parseCatalogJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
