/**
 * Aktif ortamın SSH + WP-CLI köprüsü.
 * .env.deploy / .env.deploy.ikram değerleri asla loglanmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ROOT } from './env-root.mjs';
import { findTargetByAlias, validateDeployEnv, buildGuardedEvalFileCommand } from '../../../scripts/lib/deploy-guards.mjs';
import { assertRemoteAllowed, spawnGuarded } from '../../../scripts/lib/remote-guard.mjs';
import { peekActiveProfile, isRemoteProfile, resolveAllowedRemoteTarget } from './profile.mjs';

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
  try {
    assertRemoteAllowed();
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
  const profile = peekActiveProfile();
  let fromProfile = null;
  if (profile && isRemoteProfile(profile)) {
    try {
      fromProfile = resolveAllowedRemoteTarget(profile);
    } catch (e) {
      return { ok: false, reason: e && e.message ? e.message : String(e) };
    }
  }

  const envPath = path.join(ROOT, activeDeployFile);
  const hasEnvFile = fs.existsSync(envPath);
  if (!hasEnvFile && !fromProfile) {
    return { ok: false, reason: `missing ${activeDeployFile}` };
  }
  const parsed = hasEnvFile ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const alias = String(parsed.DEPLOY_SSH_ALIAS || fromProfile?.alias || profile?.ssh?.alias || '').trim();
  const listed = findTargetByAlias(alias) || fromProfile?.target;
  const envWp = String(parsed.DEPLOY_WP_PATH || '').trim();
  const envUrl = String(parsed.DEPLOY_SITE_URL || '').trim().replace(/\/$/, '');
  if (listed) {
    if (envWp && envWp !== listed.wpPath) {
      return { ok: false, reason: 'eşleşmiyor' };
    }
    if (envUrl && envUrl !== listed.siteUrl) {
      return { ok: false, reason: 'eşleşmiyor' };
    }
  }
  const env = {
    DEPLOY_SSH_ALIAS: alias,
    DEPLOY_SSH_HOST: String(parsed.DEPLOY_SSH_HOST || '').trim(),
    DEPLOY_SSH_USER: String(parsed.DEPLOY_SSH_USER || '').trim(),
    DEPLOY_SSH_PORT: String(parsed.DEPLOY_SSH_PORT || '').trim(),
    DEPLOY_SSH_KEY: String(parsed.DEPLOY_SSH_KEY || '').trim(),
    DEPLOY_WP_PATH: envWp || listed?.wpPath || fromProfile?.wpPath || String(profile?.ssh?.wpPath || '').trim(),
    DEPLOY_SITE_URL:
      envUrl || listed?.siteUrl || fromProfile?.siteUrl || String(profile?.baseUrl || '').trim().replace(/\/$/, ''),
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
  const res = spawnGuarded(
    'ssh',
    args,
    { encoding: 'utf8', cwd: ROOT, timeout: 45000 },
    {
      alias: env?.DEPLOY_SSH_ALIAS,
      siteUrl: env?.DEPLOY_SITE_URL,
      wpPath: env?.DEPLOY_WP_PATH,
    }
  );
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
/**
 * Uzak wp eval-file (yerel dosya base64). extraEnv anahtarları yalnız WDP_E2E_*.
 * @param {string} relFile
 * @param {Record<string,string>} [extraEnv]
 * @param {string} [extraArgs]
 */
export function runEvalFile(relFile, extraEnv = {}, extraArgs = '') {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`wp-remote: ${loaded.reason}`);
  const local = path.join(ROOT, relFile);
  if (!fs.existsSync(local)) throw new Error(`wp-remote: dosya yok ${relFile}`);
  const wpPath = resolveWpPath(loaded.env);
  const b64 = fs.readFileSync(local).toString('base64');
  const envParts = [];
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (!/^WDP_E2E_[A-Z0-9_]+$/.test(k)) {
      throw new Error(`wp-remote: izinli olmayan env anahtarı ${k}`);
    }
    envParts.push(`${k}='${String(v).replace(/'/g, `'\\''`)}'`);
  }
  const prefix = envParts.length ? `${envParts.join(' ')} ` : '';
  const cmd = buildGuardedEvalFileCommand(wpPath, {
    tmpPrefix: 'wdp-eval',
    extraArgs,
    b64,
  });
  const withEnv = prefix ? cmd.replace(`wp --path=`, `${prefix}wp --path=`) : cmd;
  return remote(loaded.env, withEnv);
}

export function purgeCaches(env) {
  const loaded = env ? { ok: true, env } : loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`wp-remote: ${loaded.reason}`);
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  remote(
    loaded.env,
    `(wp sg purge --path='${wpPath}' 2>/dev/null || true; wp cache flush --path='${wpPath}' 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' --path='${wpPath}' 2>/dev/null || true)`
  );
}
