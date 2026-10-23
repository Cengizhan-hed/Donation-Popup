/**
 * Uzak: sayfa/ürün = WP-CLI katalog (permalink). Yerel: env / profil / fixture.
 * Store API slug tahmini yok.
 */
import { runEvalFile } from './wp-remote.mjs';
import { loadFixtures } from './fixtures.mjs';
import { isRemoteProfile } from './profile.mjs';
import {
  applyRemoteCatalog,
  parseCatalogJson,
  DONATION_ROLES,
  pickFixtureNavTarget,
  assertProductNavTarget,
  navTargetFromUrl,
  decideScenarioProduct,
} from './catalog-core.mjs';

/**
 * @returns {Promise<{ ok: true, catalog: object } | { ok: false, reason: string }>}
 */
export async function fetchRemoteCatalog() {
  if (String(process.env.WDP_UNIT_TEST || '') === '1') {
    return { ok: false, reason: 'birim test: uzak katalog yok' };
  }
  try {
    const raw = runEvalFile('tests/e2e/helpers/catalog-resolve.php');
    const catalog = parseCatalogJson(raw);
    if (!catalog) return { ok: false, reason: 'katalog JSON okunamadı' };
    return { ok: true, catalog };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    return { ok: false, reason: msg.slice(0, 120) };
  }
}

/**
 * @param {object} env loadE2EEnv çıktısı
 * @param {{ catalog?: object }} [opts]
 */
export async function fillMissingProductSlugs(env, opts = {}) {
  const profile = env._profile;
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];
  env._resolvedProducts =
    env._resolvedProducts && typeof env._resolvedProducts === 'object' ? env._resolvedProducts : {};

  if (isRemoteProfile(profile)) {
    const injected = opts.catalog;
    const fetched = injected ? { ok: true, catalog: injected } : await fetchRemoteCatalog();
    if (!fetched.ok) {
      env.E2E_SHOP_PAGE = '';
      env.E2E_LIST_PAGE = '';
      env.E2E_CART_PAGE = '';
      env.E2E_CHECKOUT_PAGE = '';
      for (const role of ['fixed', 'custom', 'shares', 'campaign']) {
        env[`E2E_PRODUCT_${role.toUpperCase()}`] = '';
      }
      env._roleSkips.push({
        check: 'catalog',
        description: `WP katalog okunamadı (${fetched.reason}) → sayfa/ürün senaryoları atlanır`,
      });
      console.log(`[e2e] ürün eşlemesi ${profile.id}: katalog yok`);
      return env;
    }
    applyRemoteCatalog(env, fetched.catalog);
    const fx = Object.prototype.hasOwnProperty.call(opts, 'fixtures')
      ? opts.fixtures
      : loadFixtures(env);
    overlayFixtureRoles(env, fx);
    const mapLog = {
      roles: Object.fromEntries(
        DONATION_ROLES.map((r) => [
          r,
          env._resolvedProducts[r]?.nav || env._resolvedProducts[r]?.path || '(yok)',
        ])
      ),
      ids: Object.fromEntries(
        Object.entries(env._resolvedProducts).map(([k, v]) => [k, v.id])
      ),
      fixture: Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [],
      shop: env.E2E_SHOP_PAGE || '(yok)',
      list: env.E2E_LIST_PAGE || '(yok)',
      cart: env.E2E_CART_PAGE || '(yok)',
    };
    console.log(`[e2e] ürün eşlemesi ${profile.id}: ${JSON.stringify(mapLog)}`);
    return env;
  }

  return fillLocalProductSlugs(env);
}

/**
 * Yerel: env / fixture. Uzak kuralı uygulanmaz.
 * @param {object} env
 */
function fillLocalProductSlugs(env) {
  const profile = env._profile;
  if (!profile) return env;

  const data = loadFixtures(env);
  function applyFixtureRole(role) {
    return applyOneFixtureRole(env, role, data?.roles?.[role]);
  }

  const roles = ['fixed', 'custom', 'shares', 'campaign'];
  for (const role of roles) {
    const key = `E2E_PRODUCT_${role.toUpperCase()}`;
    if (env[key]) continue;
    const spec = profile.products?.[role];
    if (!spec) {
      if (applyFixtureRole(role)) continue;
      env[key] = '';
      const note =
        profile.unavailableRoles?.[role] || `${profile.id}: ${role} ürünü yok → atla`;
      env._roleSkips.push({ check: `role-${role}`, description: note });
      continue;
    }
    if (spec.slug) env[key] = spec.slug;
    if (!env[key] && applyFixtureRole(role)) continue;
    if (!env[key]) {
      env._roleSkips.push({
        check: `role-${role}`,
        description: `${profile.id}: ${role} ürünü çözülemedi → atla`,
      });
    }
  }
  applyLocalPages(env, data);
  const mapLog = {
    roles: Object.fromEntries(
      roles.map((r) => [
        r,
        env._resolvedProducts[r]?.nav || env._resolvedProducts[r]?.path || env[`E2E_PRODUCT_${r.toUpperCase()}`] || '(yok)',
      ])
    ),
    ids: Object.fromEntries(
      Object.entries(env._resolvedProducts || {}).map(([k, v]) => [k, v.id])
    ),
    fixture: Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [],
    shop: env.E2E_SHOP_PAGE || '(yok)',
    list: env.E2E_LIST_PAGE || '(yok)',
    cart: env.E2E_CART_PAGE || '(yok)',
  };
  console.log(`[e2e] ürün eşlemesi ${profile.id}: ${JSON.stringify(mapLog)}`);
  return env;
}

/**
 * Yerel liste/mağaza/sepet/ödeme — fixtures-local.json pages (prepare-full).
 * @param {object} env
 * @param {object|null|undefined} data
 */
function applyLocalPages(env, data) {
  const pages = data?.pages && typeof data.pages === 'object' ? data.pages : {};
  const pick = (row, fallback) => {
    const pathName = String(row?.path || row?.url || fallback || '').trim();
    return pathName;
  };
  if (!env.E2E_LIST_PAGE) env.E2E_LIST_PAGE = pick(pages.list, '');
  if (!env.E2E_SHOP_PAGE) env.E2E_SHOP_PAGE = pick(pages.shop, '');
  if (!env.E2E_CART_PAGE) env.E2E_CART_PAGE = pick(pages.cart, '');
  if (!env.E2E_CHECKOUT_PAGE) env.E2E_CHECKOUT_PAGE = pick(pages.checkout, '');
}

/**
 * Katalogda yayımlanmış ürün yoksa private fixture (yönetici oturumu).
 * Liste/mağaza/popup senaryoları için skip kaydı düşer — private listede görünmez.
 * @param {object} env
 * @param {object|null|undefined} fixturesData
 */
export function overlayFixtureRoles(env, fixturesData) {
  if (!env || typeof env !== 'object') return env;
  env._fixtureRoles = Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [];
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];
  env._resolvedProducts =
    env._resolvedProducts && typeof env._resolvedProducts === 'object' ? env._resolvedProducts : {};
  const roles = fixturesData?.roles && typeof fixturesData.roles === 'object' ? fixturesData.roles : {};
  for (const role of DONATION_ROLES) {
    const existing = env._resolvedProducts[role];
    if (existing && existing.fromCatalog && !existing.fromFixture) continue;
    applyOneFixtureRole(env, role, roles[role]);
  }
  return env;
}

/**
 * @param {object} env
 * @param {string} role
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
function applyOneFixtureRole(env, role, row) {
  if (!row?.id) return false;
  const nav = pickFixtureNavTarget(row);
  assertProductNavTarget(nav, `fixture:${role}`);
  const key = `E2E_PRODUCT_${role.toUpperCase()}`;
  const slug = String(row.slug || '').trim();
  const url = String(row.url || '').trim();
  const published =
    row.published === true ||
    row.catalogVisible === true ||
    String(row.status || '').toLowerCase() === 'publish';
  env[key] = nav;
  env._resolvedProducts[role] = {
    id: Number(row.id) || 0,
    slug,
    title: String(row.name || ''),
    path: navTargetFromUrl(nav) || nav,
    url,
    nav,
    type: role,
    fromFixture: true,
    fromCatalog: published,
  };
  env._fixtureRoles = Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [];
  if (!env._fixtureRoles.includes(role)) env._fixtureRoles.push(role);
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];
  env._roleSkips = env._roleSkips.filter((s) => s.check !== `role-${role}`);
  if (!published) pushFixtureSurfaceSkips(env, role);
  return true;
}

/**
 * @param {object} env
 * @param {string} role
 */
function pushFixtureSurfaceSkips(env, role) {
  const entries = [
    ['loop-donate', `loop-donate-shop-${role}`],
    ['loop-donate', `loop-donate-list-${role}`],
    ['popup', `popup-${role}`],
  ];
  for (const [kind, check] of entries) {
    const d = decideScenarioProduct(env, role, kind);
    if (d.action !== 'skip') continue;
    if (env._roleSkips.some((s) => s.check === check)) continue;
    env._roleSkips.push({ check, description: d.reason });
  }
}
