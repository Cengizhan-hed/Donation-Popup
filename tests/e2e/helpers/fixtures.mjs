/**
 * E2E fixture ürünleri. Sayfa/menü/ayar/kullanıcı oluşturulmaz.
 * Hepsi private + _wdp_e2e_test işaretli. Katalog ve gerçek sayfalar bozulmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { peekActiveProfile } from './profile.mjs';

export const FIXTURE_MARK_PREFIX = 'fixture';

/** @type {Array<{ role: string, name: string, settings: Record<string,string> }>} */
export const FIXTURE_CATALOG = [
  {
    role: 'custom',
    name: 'WDP E2E Custom',
    settings: {
      _allow_custom_price: 'yes',
      _min_custom_price: '10',
      _wdp_donation_product: 'yes',
      _regular_price: '',
      _price: '',
    },
  },
  {
    role: 'fixed',
    name: 'WDP E2E Fixed',
    settings: {
      _wdp_donation_product: 'yes',
      _regular_price: '100',
      _price: '100',
    },
  },
  {
    role: 'shares',
    name: 'WDP E2E Shares',
    settings: {
      _wdp_donation_product: 'yes',
      _allow_multiple_shares: 'yes',
      _max_shares: '7',
      _regular_price: '1400',
      _price: '1400',
    },
  },
  {
    role: 'campaign',
    name: 'WDP E2E Campaign',
    settings: {
      _wdp_donation_product: 'yes',
      _enable_progress_bar: 'yes',
      _progress_bar_limit: '500',
      _wdp_total_donation_amount: '100',
      _goal_reached_action: 'continue',
      _regular_price: '50',
      _price: '50',
    },
  },
  {
    role: 'sadaka',
    name: 'WDP E2E Sadaka',
    settings: {
      _wdp_donation_product: 'yes',
      _allow_custom_price: 'yes',
      _min_custom_price: '10',
      _regular_price: '',
      _price: '',
    },
  },
  {
    role: 'goal-reached',
    name: 'WDP E2E Goal Reached',
    settings: {
      _wdp_donation_product: 'yes',
      _enable_progress_bar: 'yes',
      _progress_bar_limit: '100',
      _wdp_total_donation_amount: '100',
      _goal_reached_action: 'message',
      _regular_price: '25',
      _price: '25',
    },
  },
  {
    role: 'empty-price',
    name: 'WDP E2E Empty Price',
    settings: {
      _wdp_donation_product: 'yes',
      _allow_custom_price: 'yes',
      _min_custom_price: '5',
      _regular_price: '',
      _price: '',
    },
  },
];

/**
 * Dry-run / RAPOR: uzak yazmadan ne oluşturulacağını listeler.
 * @param {string} envId
 * @param {string} runId
 * @param {{ remove?: boolean, dryRun?: boolean }} [opts]
 */
export function describeBootstrapPlan(envId, runId, opts = {}) {
  const mark = `_wdp_e2e_test=${runId}`;
  return {
    dryRun: opts.dryRun !== false,
    env: envId,
    would: opts.remove ? 'remove' : 'create',
    remoteWrite: false,
    runId,
    mark,
    status: 'private',
    catalogVisible: false,
    searchVisible: false,
    createsPages: false,
    createsMenus: false,
    createsCategories: false,
    uploadsMedia: false,
    changesSiteSettings: false,
    registry: true,
    products: FIXTURE_CATALOG.map((c) => ({
      role: c.role,
      name: c.name,
      status: 'private',
      mark,
      catalogVisible: false,
      searchVisible: false,
    })),
  };
}

export function fixturesPathFor(envId) {
  const id = String(envId || 'local').replace(/[^a-z0-9._-]/gi, '');
  return path.join(ROOT, 'build/e2e', `fixtures-${id}.json`);
}

export function profileIdOf(env) {
  return String(env?._profile?.id || peekActiveProfile()?.id || env?.E2E_PROFILE_ID || 'local');
}

export function loadFixtures(envOrId) {
  const id = typeof envOrId === 'string' ? envOrId : profileIdOf(envOrId || {});
  const file = fixturesPathFor(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`fixtures JSON okunamadı: ${file}`);
  }
}

export function isFixtureProductId(productId, env) {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  if (id <= 0) return false;
  const data = loadFixtures(env);
  if (!data || !data.roles) return false;
  return Object.values(data.roles).some((r) => Number(r?.id) === id);
}

/**
 * Mutasyon testleri için fixture ürün. Yoksa açık FAIL.
 * @param {object} env
 * @param {string} role
 */
export function requireFixtureRole(env, role) {
  const data = loadFixtures(env);
  const row = data?.roles?.[role];
  if (!row || !row.id) {
    throw new Error(
      `e2e:bootstrap çalıştırın (fixture rolü yok: ${role}; dosya build/e2e/fixtures-<env>.json)`
    );
  }
  return {
    id: Number(row.id),
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    url: String(row.url || ''),
    path: String(row.path || ''),
  };
}
