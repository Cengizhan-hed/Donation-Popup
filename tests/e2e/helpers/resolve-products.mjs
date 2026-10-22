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
    const mapLog = {
      roles: Object.fromEntries(
        ['fixed', 'custom', 'shares', 'campaign'].map((r) => [
          r,
          env._resolvedProducts[r]?.path || '(yok)',
        ])
      ),
      ids: Object.fromEntries(
        Object.entries(env._resolvedProducts).map(([k, v]) => [k, v.id])
      ),
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

  function applyFixtureRole(role) {
    const data = loadFixtures(env);
    const row = data?.roles?.[role];
    if (!row?.id) return false;
    const key = `E2E_PRODUCT_${role.toUpperCase()}`;
    const slug = String(row.slug || '').trim();
    const path = String(row.path || '').trim();
    const url = String(row.url || '').trim();
    if (path) env[key] = path;
    else if (slug) env[key] = slug;
    else if (url) env[key] = url;
    env._resolvedProducts[role] = {
      id: Number(row.id) || 0,
      slug,
      title: String(row.name || ''),
      path,
      url,
      fromFixture: true,
    };
    env._fixtureRoles = Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [];
    if (!env._fixtureRoles.includes(role)) env._fixtureRoles.push(role);
    return true;
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
  return env;
}
