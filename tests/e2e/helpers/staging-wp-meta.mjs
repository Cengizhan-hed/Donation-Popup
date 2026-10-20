/**
 * Staging ürün meta okuma/yazma — deploy ile aynı SSH + wp-cli yolu.
 * .env.deploy değerleri asla loglanmaz / yazdırılmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { ROOT } from './env.mjs';
import { validateDeployEnv } from '../../../scripts/lib/deploy-guards.mjs';

/**
 * @returns {{ ok: true, env: Record<string,string> } | { ok: false, reason: string }}
 */
function loadDeployEnvSilent() {
  const envPath = path.join(ROOT, '.env.deploy');
  if (!fs.existsSync(envPath)) {
    return { ok: false, reason: 'missing .env.deploy' };
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const env = {
    DEPLOY_SSH_HOST: String(parsed.DEPLOY_SSH_HOST || '').trim(),
    DEPLOY_SSH_USER: String(parsed.DEPLOY_SSH_USER || '').trim(),
    DEPLOY_SSH_PORT: String(parsed.DEPLOY_SSH_PORT || '').trim(),
    DEPLOY_SSH_KEY: String(parsed.DEPLOY_SSH_KEY || '').trim(),
    DEPLOY_WP_PATH: String(parsed.DEPLOY_WP_PATH || '').trim(),
    DEPLOY_SITE_URL: String(parsed.DEPLOY_SITE_URL || '')
      .trim()
      .replace(/\/$/, ''),
  };
  const guard = validateDeployEnv(env);
  if (!guard.ok) {
    return { ok: false, reason: guard.reason || 'deploy env invalid' };
  }
  return { ok: true, env };
}

/**
 * @param {Record<string,string>} env
 * @param {string} remoteCmd
 */
function remote(env, remoteCmd) {
  const args = [
    '-i',
    env.DEPLOY_SSH_KEY,
    '-p',
    env.DEPLOY_SSH_PORT,
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    `${env.DEPLOY_SSH_USER}@${env.DEPLOY_SSH_HOST}`,
    remoteCmd,
  ];
  const res = spawnSync('ssh', args, { encoding: 'utf8', cwd: ROOT });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 300);
    throw new Error(`ssh/wp failed${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

/**
 * @param {number|string} productId
 * @param {string} metaKey
 * @returns {Promise<string>}
 */
export async function getProductMeta(productId, metaKey) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const wpPath = loaded.env.DEPLOY_WP_PATH.replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  return remote(
    loaded.env,
    `wp post meta get ${id} '${key}' --path='${wpPath}' 2>/dev/null || true`
  );
}

/**
 * @param {number|string} productId
 * @param {string} metaKey
 * @param {string} value Empty string → delete meta.
 * @returns {Promise<void>}
 */
export async function setProductMeta(productId, metaKey, value) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const wpPath = loaded.env.DEPLOY_WP_PATH.replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  if (value === '' || value === null || value === undefined) {
    remote(loaded.env, `wp post meta delete ${id} '${key}' --path='${wpPath}' 2>/dev/null || true`);
  } else {
    const val = String(value).replace(/'/g, `'\\''`);
    remote(loaded.env, `wp post meta update ${id} '${key}' '${val}' --path='${wpPath}'`);
  }
  // product_info / bağış / donor önbelleğini düşür (meta hook kaçarsa diye).
  remote(
    loaded.env,
    `wp eval 'if (class_exists("WDP_Utils")) { WDP_Utils::invalidate_product_donation_caches(${id}); } wp_cache_delete("wdp_donor_count_${id}", "wdp_donations"); wp_cache_delete("wdp_total_donation_${id}", "wdp_donations");' --path='${wpPath}' 2>/dev/null || true`
  );
}
