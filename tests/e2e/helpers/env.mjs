/**
 * Load and validate .env.e2e from the project root.
 * Never log secret values — only key names on failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');

const REQUIRED = [
  'E2E_BASE_URL',
  'E2E_USER',
  'E2E_PASS',
  'E2E_PRODUCT_FIXED',
  'E2E_PRODUCT_CUSTOM',
  'E2E_PRODUCT_SHARES',
  'E2E_PRODUCT_CAMPAIGN',
  'E2E_LIST_PAGE',
  'E2E_SHOP_PAGE',
];

/**
 * @returns {Record<string, string>}
 */
export function loadE2EEnv() {
  const envPath = path.join(ROOT, '.env.e2e');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.e2e (copy .env.e2e.example and fill values).');
  }

  // dotenv.parse keeps single-quoted values (needed for E2E_PASS with special chars).
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const env = { ...parsed };

  const missing = REQUIRED.filter((key) => {
    const v = env[key];
    return v === undefined || String(v).trim() === '';
  });
  if (missing.length) {
    throw new Error('Missing E2E env key(s): ' + missing.join(', '));
  }

  const base = String(env.E2E_BASE_URL).trim();
  const allowProd = String(env.E2E_ALLOW_PROD || process.env.E2E_ALLOW_PROD || '').trim() === '1';
  if (!base.toLowerCase().includes('staging') && !allowProd) {
    throw new Error(
      'E2E_BASE_URL must contain "staging" (or set E2E_ALLOW_PROD=1). Refusing to run.'
    );
  }

  let loginPath = String(env.E2E_LOGIN_PATH || '').trim();
  if (!loginPath) {
    loginPath = '/wp-login.php';
  }
  if (!loginPath.startsWith('/')) {
    loginPath = `/${loginPath}`;
  }

  return {
    E2E_BASE_URL: base.replace(/\/$/, ''),
    E2E_USER: String(env.E2E_USER).trim(),
    E2E_PASS: String(env.E2E_PASS),
    E2E_LOGIN_PATH: loginPath,
    E2E_PRODUCT_FIXED: String(env.E2E_PRODUCT_FIXED).trim(),
    E2E_PRODUCT_CUSTOM: String(env.E2E_PRODUCT_CUSTOM).trim(),
    E2E_PRODUCT_SHARES: String(env.E2E_PRODUCT_SHARES).trim(),
    E2E_PRODUCT_CAMPAIGN: String(env.E2E_PRODUCT_CAMPAIGN).trim(),
    E2E_LIST_PAGE: String(env.E2E_LIST_PAGE).trim(),
    E2E_SHOP_PAGE: String(env.E2E_SHOP_PAGE).trim(),
    // İsteğe bağlı: ekran görüntüsünde maskelenecek ek CSS seçiciler (virgülle)
    E2E_MASK_SELECTORS: String(env.E2E_MASK_SELECTORS || '').trim(),
    // Görsel fark eşiği (%); üstü "Değişti"
    E2E_DIFF_THRESHOLD: (() => {
      const n = Number.parseFloat(String(env.E2E_DIFF_THRESHOLD || '0.5'));
      return Number.isFinite(n) && n >= 0 ? n : 0.5;
    })(),
  };
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
  return url.toString();
}

export function productPaths(env) {
  return {
    fixed: env.E2E_PRODUCT_FIXED,
    custom: env.E2E_PRODUCT_CUSTOM,
    shares: env.E2E_PRODUCT_SHARES,
    campaign: env.E2E_PRODUCT_CAMPAIGN,
  };
}
