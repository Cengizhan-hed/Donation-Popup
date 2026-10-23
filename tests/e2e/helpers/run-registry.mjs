/**
 * Koşu kayıt defteri: ortam başına + koşu başına.
 * build/e2e/registry/<profilId>/<runId>.json
 * Defter yoksa/boşsa temizlik hiçbir şey silmez.
 * İşaret = bu koşunun run_id'si (sabit "1" değil).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { peekActiveProfile, resolveProfileId, sameProfileId } from './profile.mjs';
import {
  activeProfileId,
  hashSiteUrl,
  registryDir as defaultRegistryDir,
  registryFilePath as defaultRegistryFilePath,
  registryPointerPath as defaultPointerPath,
  requireProfileId,
  safeProfileId,
} from './e2e-paths.mjs';

export const REGISTRY_ENV_MISMATCH = 'REGISTRY-ENV-MISMATCH';
export const E2E_META_KEY = '_wdp_e2e_test';

/** Eski tek dosya (okunmaz; yalnız tarama/uyarı). */
export const REGISTRY_PATH = path.join(ROOT, 'build/e2e/run-registry.json');

export const BLACKLISTED_TYPES = new Set([
  'page',
  'attachment',
  'nav_menu_item',
  'wp_template',
  'wp_template_part',
  'wp_global_styles',
  'wp_navigation',
  'elementor_library',
  'wp_block',
]);

/** @type {string|null} */
let registryRootOverride = null;

export function setRegistryRootForTest(dir) {
  registryRootOverride = dir ? String(dir) : null;
}

export function resetRegistryTestHooks() {
  registryRootOverride = null;
}

function envDir(envId) {
  const id = requireProfileId(envId);
  if (registryRootOverride) return path.join(registryRootOverride, id);
  return defaultRegistryDir(id);
}

function pointerPath(envId) {
  if (registryRootOverride) return path.join(envDir(envId), 'CURRENT');
  return defaultPointerPath(envId);
}

function filePath(envId, runId) {
  if (registryRootOverride) {
    const id = String(runId || '').replace(/[^A-Za-z0-9._:-]/g, '');
    if (!id) throw new Error('registryFilePath: runId yok');
    return path.join(envDir(envId), `${id}.json`);
  }
  return defaultRegistryFilePath(envId, runId);
}

function siteUrlFromProfile() {
  const p = peekActiveProfile();
  return String(p?.baseUrl || p?.ssh?.siteUrl || '')
    .trim()
    .replace(/\/+$/, '');
}

/**
 * @returns {{ runId: string, envId: string, siteUrlHash: string, startedAt: string, created: object[], mutated: object[], fixtures: object[] }}
 */
export function emptyRegistry() {
  return {
    runId: '',
    envId: '',
    siteUrlHash: '',
    startedAt: '',
    created: [],
    mutated: [],
    fixtures: [],
  };
}

function asId(raw) {
  return Math.abs(Number.parseInt(String(raw), 10) || 0);
}

function normalizeFixtureRec(rec) {
  const id = asId(rec?.id);
  if (id <= 0) return null;
  return {
    id,
    type: String(rec.type || 'product'),
    mark: String(rec.mark || ''),
    role: String(rec.role || ''),
    source: 'fixture',
  };
}

/**
 * Koşu sıfırlanırken kalıcı fixture kayıtları.
 * @param {object} [prev]
 * @param {{ clearFixtures?: boolean, fixtures?: object[], fixtureRecords?: object[] }} [opts]
 */
export function preservedFixtures(prev, opts = {}) {
  if (opts.clearFixtures) return [];
  if (Array.isArray(opts.fixtures)) {
    return opts.fixtures.map(normalizeFixtureRec).filter(Boolean);
  }
  if (Array.isArray(opts.fixtureRecords)) {
    return opts.fixtureRecords.map(normalizeFixtureRec).filter(Boolean);
  }
  const seen = new Set();
  const out = [];
  const add = (rec) => {
    const row = normalizeFixtureRec(rec);
    if (!row || seen.has(row.id)) return;
    seen.add(row.id);
    out.push(row);
  };
  for (const rec of prev?.fixtures || []) add(rec);
  for (const rec of prev?.created || []) {
    if (rec?.source === 'fixture' || rec?.persistent) add(rec);
  }
  return out;
}

/**
 * Saf: sıfırlanmış defter (disk yok).
 * @param {object} [prev]
 * @param {string} runId
 * @param {{ clearFixtures?: boolean, fixtures?: object[], fixtureRecords?: object[], now?: string, envId?: string, siteUrl?: string, siteUrlHash?: string }} [opts]
 */
export function nextRegistryAfterReset(prev, runId, opts = {}) {
  const id = String(runId || '');
  if (!isRunIdOk(id)) {
    throw new Error(`resetRegistry: geçersiz runId (${id})`);
  }
  const envId = safeProfileId(opts.envId || activeProfileId());
  const hash = opts.siteUrlHash
    ? String(opts.siteUrlHash)
    : hashSiteUrl(opts.siteUrl || siteUrlFromProfile());
  return {
    runId: id,
    envId,
    siteUrlHash: hash,
    startedAt: String(opts.now || new Date().toISOString()),
    created: [],
    mutated: [],
    fixtures: preservedFixtures(prev, opts),
  };
}

/**
 * Temizlik: fixture ürünleri listeden çıkarılır (yalnız --remove-fixtures siler).
 * @param {object} [registry]
 * @param {number[]} [fixtureIds]
 */
export function createdForCleanup(registry, fixtureIds = []) {
  const skip = new Set();
  for (const rec of registry?.fixtures || []) {
    const id = asId(rec?.id);
    if (id) skip.add(id);
  }
  for (const raw of fixtureIds) {
    const id = asId(raw);
    if (id) skip.add(id);
  }
  return (registry?.created || []).filter((x) => {
    if (x?.source === 'fixture' || x?.persistent) return false;
    return !skip.has(asId(x?.id));
  });
}

export function isRunIdOk(runId) {
  const s = String(runId || '');
  if (!s || s === '1') return false;
  return /^[A-Za-z0-9._:-]{4,80}$/.test(s);
}

function normalizeLoaded(parsed) {
  return {
    runId: String(parsed.runId || ''),
    envId: String(parsed.envId || ''),
    siteUrlHash: String(parsed.siteUrlHash || ''),
    startedAt: String(parsed.startedAt || ''),
    created: Array.isArray(parsed.created) ? parsed.created : [],
    mutated: Array.isArray(parsed.mutated) ? parsed.mutated : [],
    fixtures: Array.isArray(parsed.fixtures) ? parsed.fixtures : [],
  };
}

/**
 * Defter envId etkin profil ile aynı değilse DUR.
 * @param {object} [registry]
 * @param {string} [envId]
 */
export function assertRegistryMatchesActiveEnv(registry, envId) {
  const want = resolveProfileId(envId || activeProfileId());
  const got = resolveProfileId(registry?.envId);
  if (got && want && !sameProfileId(got, want)) {
    throw new Error(`${REGISTRY_ENV_MISMATCH}: defter envId=${got} etkin=${want}`);
  }
  return registry;
}

/**
 * Temizlik / uzak yazma: ID’ler başka ortamın olamaz.
 * @param {object} [registry]
 * @param {string} [envId]
 */
export function assertRegistryEnvForMutation(registry, envId) {
  assertRegistryMatchesActiveEnv(registry, envId);
  const want = resolveProfileId(envId || activeProfileId());
  const got = resolveProfileId(registry?.envId);
  const hasIds =
    (registry?.created?.length || 0) + (registry?.mutated?.length || 0) > 0;
  if (hasIds && !want) {
    throw new Error(`${REGISTRY_ENV_MISMATCH}: etkin profil yok`);
  }
  if (hasIds && !got) {
    throw new Error(`${REGISTRY_ENV_MISMATCH}: defterde envId yok (etkin=${want})`);
  }
  if (hasIds && got && want && !sameProfileId(got, want)) {
    throw new Error(`${REGISTRY_ENV_MISMATCH}: defter envId=${got} etkin=${want}`);
  }
  return registry;
}

/**
 * @param {object} data
 * @param {string} [envId]
 */
export function saveRegistry(data, envId) {
  const id = requireProfileId(envId || data.envId);
  const runId = String(data.runId || '');
  if (!isRunIdOk(runId)) {
    throw new Error('saveRegistry: geçersiz runId');
  }
  const file = filePath(id, runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = normalizeLoaded({ ...data, envId: data.envId || id });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.writeFileSync(pointerPath(id), `${runId}\n`, 'utf8');
}

function readPointer(envId) {
  const file = pointerPath(envId);
  if (!fs.existsSync(file)) return '';
  return String(fs.readFileSync(file, 'utf8') || '')
    .trim()
    .split(/\r?\n/)[0];
}

/**
 * @param {string} [envId]
 * @returns {{ runId: string, envId: string, siteUrlHash: string, startedAt: string, created: object[], mutated: object[], fixtures: object[] }}
 */
export function loadRegistry(envId) {
  const id = safeProfileId(envId) || activeProfileId();
  if (!id) return emptyRegistry();
  const runId = readPointer(id);
  if (!runId) return emptyRegistry();
  const file = filePath(id, runId);
  if (!fs.existsSync(file)) return emptyRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeLoaded(parsed);
  } catch {
    throw new Error(`run-registry okunamadı: ${file}`);
  }
}

/**
 * @param {string} [runId]
 * @param {{ clearFixtures?: boolean, fixtures?: object[], fixtureRecords?: object[], envId?: string, siteUrl?: string, reuseExisting?: boolean }} [opts]
 */
export function resetRegistry(runId = `run-${Date.now()}`, opts = {}) {
  const envId = requireProfileId(opts.envId || activeProfileId());
  const id = String(runId || process.env.WDP_E2E_RUN_ID || `run-${Date.now()}`);
  if (opts.reuseExisting) {
    const existing = loadRegistry(envId);
    if (existing.runId === id && safeProfileId(existing.envId) === envId) {
      assertRegistryMatchesActiveEnv(existing, envId);
      return existing;
    }
  }
  const data = nextRegistryAfterReset(loadRegistry(envId), id, {
    ...opts,
    envId,
    siteUrl: opts.siteUrl || siteUrlFromProfile(),
  });
  saveRegistry(data, envId);
  process.env.WDP_E2E_RUN_ID = data.runId;
  process.env.WDP_E2E_PROFILE_ID = envId;
  return data;
}

/**
 * Kalıcı fixture listesini dosyadaki kayıtlarla değiştirir.
 * @param {object[]} records
 */
export function setRegistryFixtures(records) {
  const r = loadRegistry();
  r.fixtures = (Array.isArray(records) ? records : []).map(normalizeFixtureRec).filter(Boolean);
  saveRegistry(r);
  return r.fixtures;
}

/**
 * @param {{ id: number|string, type: string, mark?: string }} rec
 */
export function registerCreated(rec) {
  const id = Math.abs(Number.parseInt(String(rec.id), 10) || 0);
  const type = String(rec.type || '').trim();
  if (id <= 0 || !type) {
    throw new Error('registerCreated: id ve type zorunlu');
  }
  if (BLACKLISTED_TYPES.has(type) || type === 'page') {
    throw new Error(`registerCreated: post_type=${type} kayıt defterine alınmaz`);
  }
  const r = loadRegistry();
  assertRegistryMatchesActiveEnv(r);
  if (!isRunIdOk(r.runId)) {
    throw new Error('registerCreated: kayıt defteri runId yok — resetRegistry çağırın');
  }
  const source = rec.source === 'fixture' || rec.persistent ? 'fixture' : 'run';
  const row = {
    id,
    type,
    mark: rec.mark || `${E2E_META_KEY}=${r.runId}`,
    source,
    at: new Date().toISOString(),
  };
  if (rec.role) row.role = String(rec.role);
  r.created.push(row);
  if (source === 'fixture') {
    r.fixtures = Array.isArray(r.fixtures) ? r.fixtures : [];
    const idx = r.fixtures.findIndex((x) => Number(x.id) === id);
    const fx = normalizeFixtureRec({ ...row, role: rec.role });
    if (idx >= 0) r.fixtures[idx] = fx;
    else r.fixtures.push(fx);
  }
  saveRegistry(r);
  return id;
}

/**
 * @param {{ id: number|string, type: string, keys?: string[] }} rec
 */
export function registerMutated(rec) {
  const id = Math.abs(Number.parseInt(String(rec.id), 10) || 0);
  const type = String(rec.type || '').trim();
  if (id <= 0 || !type) {
    throw new Error('registerMutated: id ve type zorunlu');
  }
  const r = loadRegistry();
  assertRegistryMatchesActiveEnv(r);
  if (!isRunIdOk(r.runId)) {
    throw new Error('registerMutated: kayıt defteri runId yok — resetRegistry çağırın');
  }
  r.mutated.push({
    id,
    type,
    keys: Array.isArray(rec.keys) ? rec.keys.map(String) : [],
    at: new Date().toISOString(),
  });
  saveRegistry(r);
  return id;
}

/**
 * @param {number|string} id
 * @param {string} [expectedType]
 */
export function registryHas(id, expectedType) {
  const nid = Math.abs(Number.parseInt(String(id), 10) || 0);
  const r = loadRegistry();
  return r.created.some(
    (x) => Number(x.id) === nid && (!expectedType || String(x.type) === expectedType)
  );
}

/**
 * @returns {number[]}
 */
export function registryIds(type) {
  const r = loadRegistry();
  return r.created
    .filter((x) => !type || String(x.type) === type)
    .map((x) => Number(x.id))
    .filter((n) => n > 0);
}
