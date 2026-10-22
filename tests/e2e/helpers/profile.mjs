/**
 * E2E ortam profilleri (sır yok). Kimlik bilgileri yalnız .env.* dosyalarında.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';

const PROFILES_DIR = path.join(ROOT, 'tests/e2e/profiles');

/** @type {object|null} */
let activeProfile = null;

/**
 * @returns {string[]}
 */
export function listProfileIds() {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  return fs
    .readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

/**
 * @param {string} idOrAlias
 * @returns {object}
 */
export function loadProfile(idOrAlias) {
  const want = String(idOrAlias || '').trim().toLowerCase();
  if (!want) {
    throw new Error('Profil adı boş. Örn. --env hedef | --env ikram');
  }
  const files = listProfileIds();
  for (const id of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, `${id}.json`), 'utf8'));
    const aliases = [raw.id, ...(raw.aliases || [])].map((s) => String(s).toLowerCase());
    if (aliases.includes(want) || id.toLowerCase() === want) {
      return raw;
    }
  }
  throw new Error(`Bilinmeyen E2E profili: ${idOrAlias}. Var: ${files.join(', ')}`);
}

/**
 * @param {object} profile
 */
export function setActiveProfile(profile) {
  activeProfile = profile;
}

/**
 * @returns {object}
 */
export function getActiveProfile() {
  if (!activeProfile) {
    throw new Error('E2E profili yüklenmedi (loadE2EEnv / setActiveProfile).');
  }
  return activeProfile;
}

/**
 * @returns {object|null}
 */
export function peekActiveProfile() {
  return activeProfile;
}

/**
 * Uzak/yerel ayrımı profil JSON'una `remote` yazılmadan türetilir.
 * `profile.remote` boolean ise o kullanılır; yoksa `ssh.alias` doluysa uzak.
 * Yerel kanıt profili (`id: local`) her zaman yerel kalır.
 *
 * @param {object|null|undefined} profile
 * @returns {boolean}
 */
export function isRemoteProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (typeof profile.remote === 'boolean') return profile.remote;
  if (String(profile.ssh?.alias || '').trim()) return true;
  const id = String(profile.id || '').toLowerCase();
  if (id === 'local') return false;
  const hosts = Array.isArray(profile.allowedHosts) ? profile.allowedHosts : [];
  for (const h of hosts) {
    const x = String(h || '').toLowerCase();
    if (x && x !== '127.0.0.1' && x !== 'localhost') return true;
  }
  return false;
}

/**
 * @param {object} profile
 * @param {string} role custom|fixed|shares|campaign
 * @returns {object|null}
 */
export function productRole(profile, role) {
  const p = profile?.products?.[role];
  if (!p || p === null) return null;
  return p;
}

/**
 * @param {object} profile
 * @param {string} role
 */
export function hasProductRole(profile, role) {
  return !!productRole(profile, role);
}

/**
 * @param {string} text
 * @param {string} patternSource
 */
export function matchesProfilePattern(text, patternSource) {
  const src = String(patternSource || '').trim();
  if (!src) return false;
  try {
    return new RegExp(src, 'i').test(String(text || ''));
  } catch {
    return String(text || '').toLowerCase().includes(src.toLowerCase());
  }
}
