/**
 * E2E fixture ürünleri. Sayfa/menü/ayar/kullanıcı oluşturulmaz.
 * Hepsi private + _wdp_e2e_test işaretli. Katalog ve gerçek sayfalar bozulmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { peekActiveProfile, isRemoteProfile, resolveProfileId } from './profile.mjs';
import { pickFixtureNavTarget, assertProductNavTarget } from './catalog-core.mjs';

export const FIXTURE_MARK_PREFIX = 'fixture';

/** amount-opts + bootstrap tek kaynak (custom fixture). */
export const AMOUNT_PRESET_FIXTURE_META = Object.freeze({
  _enable_amount_presets: 'yes',
  _amount_presets: '10,25,50,1234',
});

/** @type {Array<{ role: string, name: string, settings: Record<string,string> }>} */
export const FIXTURE_CATALOG = [
  {
    role: 'custom',
    name: 'WDP E2E Custom',
    settings: {
      _allow_custom_price: 'yes',
      _min_custom_price: '10',
      ...AMOUNT_PRESET_FIXTURE_META,
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
    name: 'WDP E2E Addon',
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
 * --repair yazacağı meta anahtarları (rol kataloğu + fiyat).
 * @param {string} [role]
 * @returns {string[]}
 */
export function repairKeysForRole(role) {
  const row = FIXTURE_CATALOG.find((c) => c.role === String(role || ''));
  const keys = new Set(
    row ? Object.keys(row.settings) : ['_price', '_regular_price', '_wdp_donation_product']
  );
  keys.add('_sale_price');
  return [...keys];
}

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

/**
 * `--env ikram` → `ikram-aid` (dosya `fixtures-ikram-aid.json`).
 * @param {string|object|null|undefined} envOrId
 */
export function resolveFixtureProfileId(envOrId) {
  if (envOrId && typeof envOrId === 'object') return resolveProfileId(profileIdOf(envOrId)) || profileIdOf(envOrId);
  const raw = String(envOrId || '').trim();
  if (!raw) return resolveProfileId(profileIdOf({})) || profileIdOf({});
  return resolveProfileId(raw) || raw.replace(/[^a-z0-9._-]/gi, '') || 'local';
}

export function loadFixtures(envOrId) {
  const id = resolveFixtureProfileId(envOrId);
  const file = fixturesPathFor(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`fixtures JSON okunamadı: ${file}`);
  }
}

export function normalizeFixtureMark(raw) {
  return String(raw || '')
    .replace(/^_wdp_e2e_test=/, '')
    .trim();
}

/**
 * Fixture dosyasındaki ürün satırları (doğrulama yok).
 * @param {object|null|undefined} data
 * @returns {Array<{ id: number, role: string, mark: string, type: string }>}
 */
export function fixtureProductRecords(data) {
  if (!data || !data.roles || typeof data.roles !== 'object') return [];
  const fallback = normalizeFixtureMark(data.runId || data.mark || '');
  const out = [];
  for (const [role, row] of Object.entries(data.roles)) {
    const id = Math.abs(Number.parseInt(String(row?.id), 10) || 0);
    const mark = normalizeFixtureMark(row?.mark || fallback);
    if (id <= 0 || !mark) continue;
    out.push({
      id,
      role: String(role),
      mark,
      type: String(row?.type || 'product'),
      published: row?.published === true,
      catalogVisible: row?.catalogVisible === true,
      status: String(row?.status || ''),
    });
  }
  return out;
}

/**
 * Fixture ürünü beklenen sayılır: id dosyada, uzakta `_wdp_e2e_test` = işaret, durum private.
 * Kanarya anlık görüntüsündeki `mark` zaten `_wdp_e2e_test` meta’sı (ek uzak komut yok).
 * @param {object|null|undefined} snapshot
 * @param {object|null|undefined} fixturesData
 * @returns {number[]}
 */
export function verifiedFixtureIds(snapshot, fixturesData) {
  const posts = Array.isArray(snapshot?.posts) ? snapshot.posts : [];
  const byId = new Map(posts.map((p) => [Number(p.id), p]));
  const ids = [];
  for (const rec of fixtureProductRecords(fixturesData)) {
    const post = byId.get(rec.id);
    if (!post) continue;
    if (normalizeFixtureMark(post.mark) !== rec.mark) continue;
    if (String(post.status || '') !== 'private') continue;
    ids.push(rec.id);
  }
  return ids;
}

export function isFixtureProductId(productId, env) {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  if (id <= 0) return false;
  const data = loadFixtures(env);
  return fixtureProductRecords(data).some((r) => r.id === id);
}

/**
 * İşaretli fixture ve yayımlı değil (uzakta private; listede görünmez).
 * @param {number|string} productId
 * @param {object} [env]
 */
export function isPrivateFixtureProductId(productId, env) {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  if (id <= 0) return false;
  const rec = fixtureProductRecords(loadFixtures(env)).find((r) => r.id === id);
  if (!rec) return false;
  if (rec.published === true || rec.catalogVisible === true) return false;
  const st = String(rec.status || '').toLowerCase();
  if (st === 'publish') return false;
  if (st === 'private') return true;
  const profile = peekActiveProfile();
  return isRemoteProfile(profile);
}

/** Mutasyon suite'lerinin ihtiyaç duyduğu fixture rolleri. */
export const MUTATION_FIXTURE_ROLES = [
  'custom',
  'fixed',
  'shares',
  'campaign',
  'sadaka',
  'goal-reached',
  'empty-price',
];

/**
 * Meta yazan test hedefi fixture listesinde değilse KIRMIZI.
 * @param {number|string} productId
 * @param {object} [env]
 * @param {string} [label]
 */
export function assertMutationTargetIsFixture(productId, env, label = '') {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  const tag = label ? ` ${label}` : '';
  if (id <= 0) {
    throw new Error(`mutasyon hedefi geçersiz id${tag}`);
  }
  if (!isFixtureProductId(id, env)) {
    throw new Error(`mutasyon hedefi fixture listesinde değil: id=${id}${tag}`);
  }
  return id;
}

/**
 * Koşu başı: uzak profilde fixture dosyası + roller; her id listede.
 * @param {object} env
 */
export function assertRunMutationTargetsAreFixtures(env) {
  const data = loadFixtures(env);
  const records = fixtureProductRecords(data);
  const remote = isRemoteProfile(env?._profile);
  if (!records.length) {
    if (remote) {
      throw new Error('e2e:bootstrap çalıştırın (uzak fixtures-<profil>.json yok veya boş)');
    }
    return { ok: true, skipped: 'no-fixtures-local' };
  }
  const missing = MUTATION_FIXTURE_ROLES.filter((role) => !data?.roles?.[role]?.id);
  if (missing.length) {
    throw new Error(`fixture rolü eksik: ${missing.join(', ')} — e2e:bootstrap çalıştırın`);
  }
  for (const rec of records) {
    assertMutationTargetIsFixture(rec.id, env, rec.role);
  }
  return { ok: true, ids: records.map((r) => r.id) };
}

/**
 * Görüntüleme kararı (saf): uzak + private → yönetici; yayımlı → ziyaretçi.
 * @param {{ profile?: object, product?: object, admin?: boolean }} [opts]
 * @returns {'admin'|'visitor'}
 */
export function decideDonationViewContext(opts = {}) {
  if (opts.admin === true) return 'admin';
  if (opts.admin === false) return 'visitor';
  const product = opts.product && typeof opts.product === 'object' ? opts.product : {};
  const status = String(product.status || '').toLowerCase();
  const published =
    product.published === true ||
    status === 'publish' ||
    (product.fromCatalog === true && product.fromFixture !== true && status !== 'private');
  const isPrivate =
    status === 'private' ||
    product.published === false ||
    (product.fromFixture === true && !published);
  if (isPrivate && isRemoteProfile(opts.profile)) return 'admin';
  if (published) return 'visitor';
  if (isPrivate) return 'admin';
  return 'visitor';
}

function productForView(extra = {}) {
  if (extra.product && typeof extra.product === 'object') return extra.product;
  const role = extra.role;
  const env = extra.env;
  if (env && role) {
    const data = loadFixtures(env);
    const fxRow = data?.roles?.[role];
    if (fxRow?.id) {
      const published =
        fxRow.published === true ||
        fxRow.catalogVisible === true ||
        String(fxRow.status || '').toLowerCase() === 'publish';
      return {
        id: fxRow.id,
        fromFixture: true,
        status: published ? 'publish' : 'private',
        published,
      };
    }
    const rec = env._resolvedProducts?.[role];
    if (rec) return rec;
  }
  return {};
}

/**
 * Form görüntüleme: yayımlı katalog → ziyaretçi; private fixture → yönetici.
 * Meta yazımı tarayıcıda değil PHP eval ile yapılır.
 * @param {import('@playwright/test').Browser} browser
 * @param {object} contextOpts
 * @param {() => Promise<import('@playwright/test').BrowserContext>} [createAdminContext]
 * @param {{ createVisitorContext?: () => Promise<import('@playwright/test').BrowserContext>, env?: object, role?: string, admin?: boolean, product?: object }} [extra]
 */
export async function mutationBrowserContext(browser, contextOpts, createAdminContext, extra = {}) {
  return donationViewContext(browser, contextOpts, {
    admin: extra.admin,
    env: extra.env,
    role: extra.role,
    product: extra.product,
    createAdminContext,
    createVisitorContext: extra.createVisitorContext,
  });
}

/**
 * Bağış formu görüntüleme: yayımlı ürün → ziyaretçi; private fixture → yönetici.
 * @param {import('@playwright/test').Browser} browser
 * @param {object} contextOpts
 * @param {{ admin?: boolean, env?: object, role?: string, product?: object, createAdminContext?: () => Promise<import('@playwright/test').BrowserContext>, createVisitorContext?: () => Promise<import('@playwright/test').BrowserContext> }} [opts]
 */
export async function donationViewContext(browser, contextOpts, opts = {}) {
  const who = decideDonationViewContext({
    profile: opts.env?._profile || peekActiveProfile(),
    product: productForView(opts),
    admin: opts.admin,
  });
  if (who === 'admin' && typeof opts.createAdminContext === 'function') {
    return opts.createAdminContext();
  }
  if (typeof opts.createVisitorContext === 'function') {
    return opts.createVisitorContext();
  }
  if (who === 'admin' && typeof opts.createAdminContext === 'function') {
    return opts.createAdminContext();
  }
  return browser.newContext(contextOpts);
}

/**
 * --repair: yalnız işaretli fixture id. İşaretsiz → RED.
 * @param {number|string} productId
 * @param {object|null|undefined} fixturesData
 * @param {string} [label]
 */
export function assertRepairTargetMarked(productId, fixturesData, label = '') {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  const tag = label ? ` ${label}` : '';
  if (id <= 0) {
    throw new Error(`REPAIR-RED: geçersiz id${tag}`);
  }
  const rec = fixtureProductRecords(fixturesData).find((r) => r.id === id);
  if (!rec) {
    throw new Error(`REPAIR-RED: işaretsiz ürün id=${id}${tag}`);
  }
  return rec;
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
  const id = Number(row.id);
  assertMutationTargetIsFixture(id, env, role);
  const nav = assertProductNavTarget(pickFixtureNavTarget(row), `fixture:${role}`);
  return {
    id,
    name: String(row.name || ''),
    slug: String(row.slug || ''),
    url: String(row.url || nav),
    path: nav,
  };
}
