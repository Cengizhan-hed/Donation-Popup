/**
 * .env.e2e / .env.e2e.ikram yükle + profil birleştir.
 * Uzak hedef (E2E_BASE_URL) env’den gelmez; sır değerleri loglanmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ROOT } from './env-root.mjs';
import { loadProfile, setActiveProfile, productRole, isRemoteProfile, resolveAllowedRemoteTarget, peekActiveProfile } from './profile.mjs';
import { classifyRemoteHost } from './network-guard.mjs';
import { setActiveDeployEnvFile } from './wp-remote.mjs';
import { inspectEnvTargetKeys, validateE2EBaseUrl } from '../../../scripts/lib/deploy-guards.mjs';
import { inspectEnvPageProductKeys } from './catalog-core.mjs';

export { ROOT };

const PRODUCT_KEYS = [
  ['E2E_PRODUCT_FIXED', 'fixed'],
  ['E2E_PRODUCT_CUSTOM', 'custom'],
  ['E2E_PRODUCT_SHARES', 'shares'],
  ['E2E_PRODUCT_CAMPAIGN', 'campaign'],
];

/**
 * @param {string[]} argv
 */
export function parseE2ECli(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envId = String(process.env.E2E_ENV || '').trim();
  let device = '';
  let areas = null;
  let all = false;
  let openReport = false;
  let noSideCart = false;
  let noClean = false;
  let child = false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env' || x === '--profile') envId = String(a[++i] || envId);
    else if (x.startsWith('--env=')) envId = x.slice('--env='.length);
    else if (x === '--device') device = String(a[++i] || '');
    else if (x.startsWith('--device=')) device = x.slice('--device='.length);
    else if (x === '--areas') areas = String(a[++i] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    else if (x.startsWith('--areas='))
      areas = x
        .slice('--areas='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (x === '--all') all = true;
    else if (x === '--open-report') openReport = true;
    else if (x === '--no-side-cart') noSideCart = true;
    else if (x === '--no-clean') noClean = true;
    else if (x === '--child') child = true;
  }
  return { envId, device, areas, all, openReport, noSideCart, noClean, child };
}

/**
 * @param {{ envId?: string }} [opts]
 * @returns {Record<string, string> & { _profile: object }}
 */
export function loadE2EEnv(opts = {}) {
  const envId = opts.envId || parseE2ECli().envId || process.env.E2E_ENV || 'hedef';
  const profile = loadProfile(envId);
  setActiveProfile(profile);
  if (profile.deployEnvFile) setActiveDeployEnvFile(profile.deployEnvFile);

  const envPath = path.join(ROOT, profile.envFile || '.env.e2e');
  const hasEnvFile = fs.existsSync(envPath);
  const parsed =
    opts.parsed !== undefined
      ? opts.parsed
      : hasEnvFile
        ? dotenv.parse(fs.readFileSync(envPath))
        : {};
  const env = { ...parsed };
  const remote = isRemoteProfile(profile);
  const envFileName = path.basename(profile.envFile || '.env.e2e');

  if (opts.parsed === undefined && !hasEnvFile && !remote) {
    throw new Error(`Missing ${profile.envFile} (copy ${profile.envFile}.example and fill values).`);
  }

  const missing = [];
  const user = String(env.E2E_USER || '').trim();
  const pass = env.E2E_PASS;
  const wpCliAuth = !!profile.wpCliAuth;
  if (!wpCliAuth && (!user || pass === undefined || String(pass) === '')) {
    missing.push('E2E_USER', 'E2E_PASS');
  }

  let base = '';
  if (remote) {
    const resolved = resolveAllowedRemoteTarget(profile);
    const inspect = inspectEnvTargetKeys(parsed, envFileName, resolved.target);
    if (inspect.warning) console.warn(inspect.warning);
    base = resolved.siteUrl;
    if (profile.allowMetaMutation === true) {
      throw new Error('Uzak profilde allowMetaMutation açılamaz.');
    }
  } else {
    base = String(env.E2E_BASE_URL || profile.baseUrl || '').trim().replace(/\/$/, '');
    if (!base) missing.push('E2E_BASE_URL');
  }
  if (missing.length) {
    throw new Error('Missing E2E env key(s): ' + missing.join(', '));
  }

  const urlGuard = validateE2EBaseUrl(base, profile.allowedHosts || []);
  if (!urlGuard.ok) {
    throw new Error(urlGuard.reason);
  }

  let loginPath = String(env.E2E_LOGIN_PATH || '').trim();
  if (!loginPath) loginPath = '/wp-login.php';
  if (!loginPath.startsWith('/')) loginPath = `/${loginPath}`;

  const products = {};
  let listPage = '';
  let shopPage = '';
  if (remote) {
    const pageInspect = inspectEnvPageProductKeys(parsed, envFileName);
    if (pageInspect.warning) console.warn(pageInspect.warning);
    for (const [key] of PRODUCT_KEYS) products[key] = '';
  } else {
    for (const [key, role] of PRODUCT_KEYS) {
      const fromEnv = String(env[key] || '').trim();
      const fromProfile = productRole(profile, role);
      const slug = fromEnv || String(fromProfile?.slug || '').trim();
      products[key] = slug;
    }
    listPage =
      String(env.E2E_LIST_PAGE || '').trim() || String(profile.listPage || '').trim();
    shopPage =
      String(env.E2E_SHOP_PAGE || '').trim() || String(profile.shopPage || '').trim();
  }

  const out = {
    E2E_BASE_URL: base,
    E2E_USER: user,
    E2E_PASS: pass === undefined || pass === null ? '' : String(pass),
    E2E_LOGIN_PATH: loginPath,
    E2E_PRODUCT_FIXED: products.E2E_PRODUCT_FIXED,
    E2E_PRODUCT_CUSTOM: products.E2E_PRODUCT_CUSTOM,
    E2E_PRODUCT_SHARES: products.E2E_PRODUCT_SHARES,
    E2E_PRODUCT_CAMPAIGN: products.E2E_PRODUCT_CAMPAIGN,
    E2E_LIST_PAGE: listPage,
    E2E_SHOP_PAGE: shopPage,
    E2E_CART_PAGE: '',
    E2E_CHECKOUT_PAGE: '',
    E2E_MASK_SELECTORS: String(env.E2E_MASK_SELECTORS || '').trim(),
    E2E_COMING_SOON_SHARE_KEY: String(env.E2E_COMING_SOON_SHARE_KEY || '').trim(),
    E2E_DIFF_THRESHOLD: (() => {
      const n = Number.parseFloat(String(env.E2E_DIFF_THRESHOLD || '0.5'));
      return Number.isFinite(n) && n >= 0 ? n : 0.5;
    })(),
    E2E_SHELL_DIFF_THRESHOLD: (() => {
      const n = Number.parseFloat(String(env.E2E_SHELL_DIFF_THRESHOLD || '0.1'));
      return Number.isFinite(n) && n >= 0 ? n : 0.1;
    })(),
    E2E_PROFILE_ID: profile.id,
    _profile: profile,
  };
  return out;
}

/**
 * @param {string} base
 * @param {string} pathOrUrl
 * @param {Record<string, string|number|boolean>} [extraParams]
 */
export function withCacheBust(base, pathOrUrl, extraParams = {}) {
  const ts = Date.now();
  let url;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    url = new URL(pathOrUrl);
  } else {
    const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    url = new URL(p, base.endsWith('/') ? base : base + '/');
  }
  url.searchParams.set('wdp_e2e', String(ts));
  for (const [k, v] of Object.entries(extraParams || {})) {
    if (v === undefined || v === null || v === false || v === '') continue;
    url.searchParams.set(k, v === true ? '1' : String(v));
  }
  let profile = null;
  try {
    profile = peekActiveProfile();
  } catch {
    profile = null;
  }
  if (isRemoteProfile(profile)) {
    const kind = classifyRemoteHost(url.hostname, {
      allowedHosts: profile.allowedHosts || [],
      siteHost: (() => {
        try {
          return new URL(String(base || '')).hostname;
        } catch {
          return '';
        }
      })(),
    });
    if (kind === 'live' || kind === 'retired' || kind === 'foreign') {
      throw new Error(`uzak navigasyon host profil dışı (${kind})`);
    }
  }
  return url.toString();
}

export function productPaths(env) {
  /** @type {Record<string,string>} */
  const out = {};
  const map = {
    fixed: env.E2E_PRODUCT_FIXED,
    custom: env.E2E_PRODUCT_CUSTOM,
    shares: env.E2E_PRODUCT_SHARES,
    campaign: env.E2E_PRODUCT_CAMPAIGN,
  };
  for (const [role, slug] of Object.entries(map)) {
    if (slug && String(slug).trim()) out[role] = String(slug).trim();
  }
  return out;
}
