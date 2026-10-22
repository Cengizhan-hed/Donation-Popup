/**
 * Koşu kayıt defteri: bu koşuda oluşturulan ID’ler.
 * Defter yoksa/boşsa temizlik hiçbir şey silmez.
 * İşaret = bu koşunun run_id'si (sabit "1" değil).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';

export const REGISTRY_PATH = path.join(ROOT, 'build/e2e/run-registry.json');
export const E2E_META_KEY = '_wdp_e2e_test';

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

/**
 * @returns {{ runId: string, startedAt: string, created: object[], mutated: object[], fixtures: object[] }}
 */
export function emptyRegistry() {
  return { runId: '', startedAt: '', created: [], mutated: [], fixtures: [] };
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
 * @param {{ clearFixtures?: boolean, fixtures?: object[], fixtureRecords?: object[], now?: string }} [opts]
 */
export function nextRegistryAfterReset(prev, runId, opts = {}) {
  const id = String(runId || '');
  if (!isRunIdOk(id)) {
    throw new Error(`resetRegistry: geçersiz runId (${id})`);
  }
  return {
    runId: id,
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

/**
 * @param {object} data
 */
export function saveRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * @returns {{ runId: string, startedAt: string, created: object[], mutated: object[], fixtures: object[] }}
 */
export function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return emptyRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return {
      runId: String(parsed.runId || ''),
      startedAt: String(parsed.startedAt || ''),
      created: Array.isArray(parsed.created) ? parsed.created : [],
      mutated: Array.isArray(parsed.mutated) ? parsed.mutated : [],
      fixtures: Array.isArray(parsed.fixtures) ? parsed.fixtures : [],
    };
  } catch {
    throw new Error(`run-registry.json okunamadı: ${REGISTRY_PATH}`);
  }
}

/**
 * @param {string} [runId]
 * @param {{ clearFixtures?: boolean, fixtures?: object[], fixtureRecords?: object[] }} [opts]
 */
export function resetRegistry(runId = `run-${Date.now()}`, opts = {}) {
  const data = nextRegistryAfterReset(loadRegistry(), runId, opts);
  saveRegistry(data);
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
