/**
 * Aktif ortamın SSH + WP-CLI köprüsü.
 * .env.deploy / .env.deploy.ikram değerleri asla loglanmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { ROOT } from './env-root.mjs';
import { validateDeployEnv } from '../../../scripts/lib/deploy-guards.mjs';
import { peekActiveProfile } from './profile.mjs';

/** @type {string} */
let activeDeployFile = '.env.deploy';

/**
 * @param {string} rel
 */
export function setActiveDeployEnvFile(rel) {
  activeDeployFile = rel || '.env.deploy';
}

/**
 * @returns {{ ok: true, env: Record<string,string> } | { ok: false, reason: string }}
 */
export function loadDeployEnvSilent() {
  const envPath = path.join(ROOT, activeDeployFile);
  if (!fs.existsSync(envPath)) {
    return { ok: false, reason: `missing ${activeDeployFile}` };
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const profile = peekActiveProfile();
  const env = {
    DEPLOY_SSH_ALIAS: String(parsed.DEPLOY_SSH_ALIAS || profile?.ssh?.alias || '').trim(),
    DEPLOY_SSH_HOST: String(parsed.DEPLOY_SSH_HOST || '').trim(),
    DEPLOY_SSH_USER: String(parsed.DEPLOY_SSH_USER || '').trim(),
    DEPLOY_SSH_PORT: String(parsed.DEPLOY_SSH_PORT || '').trim(),
    DEPLOY_SSH_KEY: String(parsed.DEPLOY_SSH_KEY || '').trim(),
    DEPLOY_WP_PATH: String(parsed.DEPLOY_WP_PATH || profile?.ssh?.wpPath || '').trim(),
    DEPLOY_SITE_URL: String(parsed.DEPLOY_SITE_URL || profile?.baseUrl || '')
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
 */
export function sshArgs(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (alias) {
    return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', alias];
  }
  return [
    '-i',
    env.DEPLOY_SSH_KEY,
    '-p',
    env.DEPLOY_SSH_PORT,
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    `${env.DEPLOY_SSH_USER}@${env.DEPLOY_SSH_HOST}`,
  ];
}

/**
 * @param {Record<string,string>} env
 * @param {string} remoteCmd
 */
export function remote(env, remoteCmd) {
  const args = [...sshArgs(env), remoteCmd];
  const res = spawnSync('ssh', args, { encoding: 'utf8', cwd: ROOT, timeout: 45000 });
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim().slice(0, 300);
    throw new Error(`ssh/wp failed${err ? `: ${err}` : ''}`);
  }
  return (res.stdout || '').trim();
}

/**
 * @param {Record<string,string>} env
 */
export function resolveWpPath(env) {
  const raw = String(env.DEPLOY_WP_PATH || '').trim();
  if (raw.startsWith('~/') || raw.startsWith('$HOME')) {
    return remote(env, `echo ${raw.replace(/'/g, `'\\''`)}`);
  }
  return raw;
}

/**
 * @param {string} wpEvalOrCmd WP-CLI after --path
 */
export function wp(wpCliTail) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`wp-remote: ${loaded.reason}`);
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  return remote(loaded.env, `${wpCliTail} --path='${wpPath}'`);
}

/**
 * SiteGround + object cache + bağış listesi önbelleği.
 * @param {Record<string,string>} [env]
 */
export function purgeCaches(env) {
  const loaded = env ? { ok: true, env } : loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`wp-remote: ${loaded.reason}`);
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  remote(
    loaded.env,
    `(wp sg purge --path='${wpPath}' 2>/dev/null || true; wp cache flush --path='${wpPath}' 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' --path='${wpPath}' 2>/dev/null || true)`
  );
}
