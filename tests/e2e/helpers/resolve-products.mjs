/**
 * Profildeki ürün adından slug/ID çöz (WP-CLI; içerik değiştirmez).
 * Store API / sabit ID yok: WP post list kaynak.
 */
import { loadDeployEnvSilent, remote, wpCliPath } from './wp-remote.mjs';

/**
 * @param {string} name
 * @returns {Promise<{id:number,slug:string,title:string}|null>}
 */
export async function findProductByName(name) {
  const title = String(name || '').trim();
  if (!title) return null;
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return null;
  const flag = wpCliPath(loaded.env);
  const q = title.replace(/'/g, `'\\''`);
  const raw = remote(
    loaded.env,
    `wp post list --post_type=product --s='${q}' --fields=ID,post_name,post_title --format=json ${flag}`
  );
  let rows = [];
  try {
    rows = JSON.parse(raw || '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || !rows.length) return null;
  const exact = rows.find(
    (r) => String(r.post_title || '').trim().toLowerCase() === title.toLowerCase()
  );
  const row = exact || rows[0];
  return {
    id: Number(row.ID) || 0,
    slug: String(row.post_name || '').trim(),
    title: String(row.post_title || '').trim(),
  };
}

/**
 * @param {string} slug
 * @returns {Promise<{id:number,slug:string,title:string}|null>}
 */
export async function findProductBySlug(slug) {
  const s = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!s) return null;
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return null;
  const flag = wpCliPath(loaded.env);
  const q = s.replace(/'/g, `'\\''`);
  const raw = remote(
    loaded.env,
    `wp post list --post_type=product --name='${q}' --fields=ID,post_name,post_title --format=json ${flag}`
  );
  let rows = [];
  try {
    rows = JSON.parse(raw || '[]');
  } catch {
    return null;
  }
  const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!row) return null;
  return {
    id: Number(row.ID) || 0,
    slug: String(row.post_name || '').trim() || s,
    title: String(row.post_title || '').trim(),
  };
}

/**
 * @param {object} env loadE2EEnv çıktısı
 */
export async function fillMissingProductSlugs(env) {
  const profile = env._profile;
  if (!profile?.products) return env;
  /** @type {Record<string, {id:number,slug:string,title:string,skipReason?:string}>} */
  const resolved = env._resolvedProducts && typeof env._resolvedProducts === 'object'
    ? env._resolvedProducts
    : {};
  env._resolvedProducts = resolved;
  /** @type {Array<{check:string,description:string}>} */
  env._roleSkips = Array.isArray(env._roleSkips) ? env._roleSkips : [];

  const roles = ['fixed', 'custom', 'shares', 'campaign'];
  for (const role of roles) {
    const key = `E2E_PRODUCT_${role.toUpperCase()}`;
    const spec = profile.products[role];
    if (!spec) {
      env[key] = '';
      const note =
        profile.unavailableRoles?.[role] ||
        `${profile.id}: ${role} ürünü yok → atla`;
      env._roleSkips.push({
        check: `role-${role}`,
        description: note,
      });
      continue;
    }
    if (!env[key] && spec.slug) env[key] = spec.slug;
    if (!env[key] && spec.name) {
      const found = await findProductByName(spec.name);
      if (found?.slug) {
        env[key] = found.slug;
        spec.id = found.id || spec.id;
        spec.slug = found.slug;
        resolved[role] = found;
      }
    }
    if (env[key] && !resolved[role]) {
      const bySlug = await findProductBySlug(env[key]);
      if (bySlug) {
        spec.id = bySlug.id || spec.id;
        spec.slug = bySlug.slug || spec.slug;
        resolved[role] = bySlug;
      }
    }
    if (spec.id && resolved[role] && !resolved[role].id) {
      resolved[role].id = Number(spec.id) || 0;
    }
    if (!env[key]) {
      env._roleSkips.push({
        check: `role-${role}`,
        description: `${profile.id}: ${role} ürünü çözülemedi (ad=${spec.name || '—'}) → atla`,
      });
    }
  }

  const extras = ['customSadaqah', 'customZakat', 'fixedQurbani'];
  env._extraProducts = env._extraProducts || {};
  for (const extra of extras) {
    const spec = profile.products[extra];
    if (!spec?.name) continue;
    const found = await findProductByName(spec.name);
    env._extraProducts[extra] = found || {
      id: 0,
      slug: '',
      title: spec.name,
      missing: true,
    };
  }
  if (profile.hedefli?.name) {
    const found = await findProductByName(profile.hedefli.name);
    env._extraProducts.hedefli = found || {
      id: 0,
      slug: '',
      title: profile.hedefli.name,
      missing: true,
    };
  }

  if (!env.E2E_LIST_PAGE && profile.listPageId) {
    const loaded = loadDeployEnvSilent();
    if (loaded.ok) {
      const flag = wpCliPath(loaded.env);
      const id = Number(profile.listPageId) || 0;
      if (id) {
        try {
          const url = remote(
            loaded.env,
            `wp eval 'echo get_permalink(${id});' ${flag}`
          );
          if (url) {
            const u = new URL(String(url).trim());
            env.E2E_LIST_PAGE = u.pathname.replace(/\/$/, '') || '/';
          }
        } catch {
          /* liste yolu boş kalabilir */
        }
      }
    }
  }
  if (!env.E2E_SHOP_PAGE) {
    env.E2E_SHOP_PAGE = profile.shopPage || '/shop/';
  }
  const mapLog = {
    roles: Object.fromEntries(
      ['fixed', 'custom', 'shares', 'campaign'].map((r) => [
        r,
        env[`E2E_PRODUCT_${r.toUpperCase()}`] || (resolved[r] ? resolved[r].slug : '(yok)'),
      ])
    ),
    ids: Object.fromEntries(
      Object.entries(resolved).map(([k, v]) => [k, v.id])
    ),
    extras: Object.fromEntries(
      Object.entries(env._extraProducts || {}).map(([k, v]) => [
        k,
        v.missing ? `YOK:${v.title}` : `${v.title}#${v.id}`,
      ])
    ),
  };
  console.log(`[e2e] ürün eşlemesi ${profile.id}: ${JSON.stringify(mapLog)}`);
  return env;
}
