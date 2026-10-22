/**
 * E2E ortam profilleri (sır yok). Kimlik bilgileri yalnız .env.* dosyalarında.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { findTargetByAlias, findTargetById } from '../../../scripts/lib/deploy-guards.mjs';

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
      assertRemoteProfileSafe(raw);
      return raw;
    }
  }
  throw new Error(`Bilinmeyen E2E profili: ${idOrAlias}. Var: ${files.join(', ')}`);
}

/**
 * Uzak profil: SSH alias varsa allowMetaMutation yasak; üçlü izin listesiyle birebir.
 * @param {object} profile
 */
export function isRemoteProfile(profile) {
  return Boolean(profile?.ssh?.alias);
}

/**
 * @param {object} profile
 */
export function assertRemoteProfileSafe(profile) {
  if (!isRemoteProfile(profile)) return;
  if (profile.allowMetaMutation === true) {
    throw new Error('Uzak profilde allowMetaMutation açılamaz.');
  }
  const alias = String(profile.ssh?.alias || '').trim();
  const listed = findTargetByAlias(alias) || findTargetById(profile.id);
  if (!listed) {
    throw new Error('Profil SSH alias izin listesinde değil.');
  }
  if (alias !== listed.sshAlias) {
    throw new Error('eşleşmiyor');
  }
  const wpPath = String(profile.ssh?.wpPath || '').trim();
  if (wpPath && wpPath !== listed.wpPath) {
    throw new Error('eşleşmiyor');
  }
  const base = String(profile.baseUrl || '').trim().replace(/\/$/, '');
  if (base && base !== listed.siteUrl) {
    throw new Error('eşleşmiyor');
  }
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
