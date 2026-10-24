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
 * Takma ad → profil id (tek yer). Bilinmeyen değer sanitize edilir.
 * staging|hedef|staging-hedef → staging-hedef; ikram|ikram-aid → ikram-aid; local → local.
 * @param {string|object|null|undefined} idOrAlias
 * @returns {string}
 */
export function resolveProfileId(idOrAlias) {
  if (idOrAlias && typeof idOrAlias === 'object') {
    const fromObj = String(idOrAlias.id || '').trim().toLowerCase();
    if (fromObj) {
      try {
        return String(loadProfile(fromObj).id || fromObj);
      } catch {
        return fromObj.replace(/[^a-z0-9._-]/g, '');
      }
    }
    return '';
  }
  const want = String(idOrAlias || '')
    .trim()
    .toLowerCase();
  if (!want) return '';
  try {
    return String(loadProfile(want).id || want);
  } catch {
    return want.replace(/[^a-z0-9._-]/g, '');
  }
}

/**
 * @param {string|object|null|undefined} a
 * @param {string|object|null|undefined} b
 */
export function sameProfileId(a, b) {
  const x = resolveProfileId(a);
  const y = resolveProfileId(b);
  return !!(x && y && x === y);
}

/**
 * @param {object} profile
 */
export function assertRemoteProfileSafe(profile) {
  if (!isRemoteProfile(profile)) return;
  if (profile.allowMetaMutation === true) {
    throw new Error('Uzak profilde allowMetaMutation açılamaz.');
  }
  resolveAllowedRemoteTarget(profile);
}

/**
 * 1A: profil ssh.alias/wpPath/siteUrl → izin listesi kaydı.
 * @param {string|object} idOrProfile
 * @returns {{ profile: object, target: object, alias: string, wpPath: string, siteUrl: string }}
 */
export function resolveAllowedRemoteTarget(idOrProfile) {
  const profile = typeof idOrProfile === 'string' ? loadProfile(idOrProfile) : idOrProfile;
  if (!profile || typeof profile !== 'object') {
    throw new Error('Profil yok.');
  }
  if (!isRemoteProfile(profile)) {
    throw new Error('Profil uzak değil.');
  }
  const alias = String(profile.ssh?.alias || '').trim();
  const listed = findTargetByAlias(alias) || findTargetById(profile.id);
  if (!listed) {
    throw new Error('SSH alias izin listesinde değil.');
  }
  if (alias !== listed.sshAlias) {
    throw new Error('eşleşmiyor');
  }
  const wpPath = String(profile.ssh?.wpPath || '').trim();
  if (wpPath && wpPath !== listed.wpPath) {
    throw new Error('eşleşmiyor');
  }
  const base = String(profile.baseUrl || profile.ssh?.siteUrl || '')
    .trim()
    .replace(/\/$/, '');
  if (base && base !== listed.siteUrl) {
    throw new Error('eşleşmiyor');
  }
  return {
    profile,
    target: listed,
    alias: listed.sshAlias,
    wpPath: listed.wpPath,
    siteUrl: listed.siteUrl,
  };
}

/**
 * @param {object} profile
 */
export function setActiveProfile(profile) {
  activeProfile = profile;
  if (profile?.id) process.env.WDP_E2E_PROFILE_ID = String(profile.id);
}

export function clearActiveProfile() {
  activeProfile = null;
}

/**
 * Birim test: etkin profil + WDP_E2E_PROFILE(_ID) yalıtımı. Dönüş: geri alıcı.
 * @param {object} [profile]
 * @returns {() => void}
 */
export function isolateUnitProfile(profile = { id: 'local', remote: false, allowedHosts: ['127.0.0.1'] }) {
  const prevId = process.env.WDP_E2E_PROFILE_ID;
  const prevProf = process.env.WDP_E2E_PROFILE;
  const prevActive = peekActiveProfile();
  setActiveProfile(profile);
  if (profile?.id) process.env.WDP_E2E_PROFILE_ID = String(profile.id);
  else delete process.env.WDP_E2E_PROFILE_ID;
  delete process.env.WDP_E2E_PROFILE;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (prevActive) setActiveProfile(prevActive);
    else clearActiveProfile();
    if (prevId === undefined) delete process.env.WDP_E2E_PROFILE_ID;
    else process.env.WDP_E2E_PROFILE_ID = prevId;
    if (prevProf === undefined) delete process.env.WDP_E2E_PROFILE;
    else process.env.WDP_E2E_PROFILE = prevProf;
  };
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

/** Yerel varsayılan (hızlı). */
export const DEFAULT_TIMEOUTS_LOCAL = Object.freeze({
  navigation: 20000,
  action: 8000,
  expect: 8000,
  settle: 4000,
});

/** Uzak varsayılan. Profil `timeouts` yoksa bunlar. */
export const DEFAULT_TIMEOUTS_REMOTE = Object.freeze({
  navigation: 45000,
  action: 15000,
  expect: 15000,
  settle: 8000,
});

/**
 * Profil `timeouts` ({ navigation, action, expect, settle } ms).
 * Alan yoksa veya geçersizse uzak/yerel varsayılan.
 * @param {object|null|undefined} profile
 * @returns {{ navigation: number, action: number, expect: number, settle: number }}
 */
export function resolveTimeouts(profile) {
  const remote = isRemoteProfile(profile);
  const defaults = remote ? DEFAULT_TIMEOUTS_REMOTE : DEFAULT_TIMEOUTS_LOCAL;
  const raw = profile && typeof profile.timeouts === 'object' && profile.timeouts ? profile.timeouts : {};
  const pick = (key, fallback) => {
    const n = Number(raw[key]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };
  return {
    navigation: pick('navigation', defaults.navigation),
    action: pick('action', defaults.action),
    expect: pick('expect', defaults.expect),
    settle: pick('settle', defaults.settle),
  };
}

/**
 * Etkin profil zaman aşımları. Profil yoksa yerel varsayılan.
 * @returns {{ navigation: number, action: number, expect: number, settle: number }}
 */
export function getActiveTimeouts() {
  return resolveTimeouts(peekActiveProfile());
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ navigation?: number, action?: number }} [timeouts]
 */
export function applyTimeoutsToPage(page, timeouts) {
  const t = timeouts && typeof timeouts === 'object' ? timeouts : getActiveTimeouts();
  const action = Number(t.action) > 0 ? Number(t.action) : getActiveTimeouts().action;
  const navigation = Number(t.navigation) > 0 ? Number(t.navigation) : getActiveTimeouts().navigation;
  page.setDefaultTimeout(action);
  page.setDefaultNavigationTimeout(navigation);
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
