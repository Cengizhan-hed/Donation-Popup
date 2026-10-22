/**
 * Aktif ortamın SSH + WP-CLI köprüsü.
 * Uzak hedef = profil + izin listesi; .env.deploy* hedef anahtarları yok sayılır.
 * Sır değerleri asla loglanmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ROOT } from './env-root.mjs';
import {
  applyAllowlistOverEnv,
  buildGuardedEvalFileCommand,
  wpPathFlag,
  shellQuoteWpPath,
} from '../../../scripts/lib/deploy-guards.mjs';
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
 * Profil + izin listesi → uzak hedef. Env hedef anahtarları yok sayılır.
 *
 * @param {object} profile
 * @param {Record<string,string>} [parsed]
 * @param {string} [envFileName]
 * @returns {{ ok: true, env: Record<string,string>, target: object, warning: string } | { ok: false, reason: string }}
 */
export function mergeDeployEnvFromProfile(profile, parsed = {}, envFileName = '.env.deploy') {
  if (!profile || !isRemoteProfile(profile)) {
    return { ok: false, reason: 'E2E profili yüklenmedi veya uzak değil.' };
  }
  let resolved;
  try {
    resolved = resolveAllowedRemoteTarget(profile);
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
  const applied = applyAllowlistOverEnv(parsed, resolved.target, envFileName);
  return {
    ok: true,
    env: applied.env,
    target: applied.target,
    warning: applied.warning,
  };
}

/**
 * @param {{ parsed?: Record<string,string>, envFileName?: string, profile?: object, skipGate?: boolean }} [opts]
 * @returns {{ ok: true, env: Record<string,string>, warning?: string } | { ok: false, reason: string }}
 */
export function loadDeployEnvSilent(opts = {}) {
  if (!opts.skipGate) {
    try {
      assertRemoteAllowed();
    } catch (e) {
      return { ok: false, reason: e && e.message ? e.message : String(e) };
    }
  }
  const profile = opts.profile || peekActiveProfile();
  let parsed = opts.parsed;
  const fileName = opts.envFileName || path.basename(activeDeployFile);
  if (parsed === undefined) {
    const envPath = path.join(ROOT, activeDeployFile);
    parsed = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
  }
  const merged = mergeDeployEnvFromProfile(profile, parsed, fileName);
  if (!merged.ok) return merged;
  if (merged.warning) console.warn(merged.warning);
  return merged;
}

/**
 * @param {Record<string,string>} env
 */
export function sshArgs(env) {
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  if (!alias) {
    throw new Error('SSH alias yok (profil tek kaynak).');
  }
  return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', alias];
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
 * Mantıksal wpPath için `--path="$HOME/…"` ($HOME açılır; tırnak ~'yi yutmaz).
 * @param {Record<string,string>|string} envOrPath
 */
export function wpCliPath(envOrPath) {
  const raw = typeof envOrPath === 'string' ? envOrPath : String(envOrPath?.DEPLOY_WP_PATH || '').trim();
  return wpPathFlag(raw);
}

export { wpPathFlag, shellQuoteWpPath };

/**
 * @param {string} wpEvalOrCmd WP-CLI after --path
 */
export function wp(wpCliTail) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`wp-remote: ${loaded.reason}`);
  }
  return remote(loaded.env, `${wpCliTail} ${wpCliPath(loaded.env)}`);
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
  const wpPath = String(loaded.env.DEPLOY_WP_PATH || '').trim();
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
  const flag = wpCliPath(loaded.env);
  remote(
    loaded.env,
    `(wp sg purge ${flag} 2>/dev/null || true; wp cache flush ${flag} 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' ${flag} 2>/dev/null || true)`
  );
}
