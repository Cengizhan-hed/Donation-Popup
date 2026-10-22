/**
 * Uzak E2E sayfa/ürün çözümü: tek kaynak WP/Woo JSON (slug tahmini yok).
 * Env E2E_SHOP_PAGE / E2E_LIST_PAGE / E2E_PRODUCT_* uzak profilde kullanılmaz.
 */
export const PAGE_PRODUCT_ENV_KEYS = [
  'E2E_SHOP_PAGE',
  'E2E_LIST_PAGE',
  'E2E_PRODUCT_FIXED',
  'E2E_PRODUCT_CUSTOM',
  'E2E_PRODUCT_SHARES',
  'E2E_PRODUCT_CAMPAIGN',
];

export const DONATION_ROLES = ['fixed', 'custom', 'shares', 'campaign'];

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
 * WDP_Donation_Type::infer_from_meta ile aynı öncelik (shares → campaign → custom → fixed).
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
  };
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];
  env._resolvedProducts = env._resolvedProducts && typeof env._resolvedProducts === 'object'
    ? env._resolvedProducts
    : {};

  if (!env.E2E_LIST_PAGE) {
    env._roleSkips.push({
      check: 'list-page',
      description: 'Bağış listesi sayfası WP içeriğinde eklenti kısa kodu/bloğu bulunamadı → atla',
    });
  }
  if (!env.E2E_SHOP_PAGE) {
    env._roleSkips.push({
      check: 'shop-page',
      description: 'Mağaza sayfası WooCommerce wc_get_page_permalink(shop) boş → atla',
    });
  }

  const picked = pickRoleProducts(cat.products || []);
  for (const role of DONATION_ROLES) {
    const key = `E2E_PRODUCT_${role.toUpperCase()}`;
    const hit = picked[role];
    if (!hit) {
      env[key] = '';
      env._roleSkips.push({
        check: `role-${role}`,
        description: `${env._profile?.id || 'uzak'}: katalogda yayımlanmış ${role} ürünü yok → atla`,
      });
      continue;
    }
    env[key] = hit.path;
    env._resolvedProducts[role] = {
      id: Number(hit.id) || 0,
      slug: String(hit.slug || ''),
      title: String(hit.title || ''),
      path: hit.path,
      url: String(hit.url || ''),
      type: role,
      fromCatalog: true,
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
  const fromUrl = pathFromMaybeUrl(raw);
  if (fromUrl) return fromUrl;
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
