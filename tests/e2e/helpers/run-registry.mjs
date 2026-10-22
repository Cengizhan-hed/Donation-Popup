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
 * @returns {{ runId: string, startedAt: string, created: object[], mutated: object[] }}
 */
export function emptyRegistry() {
  return { runId: '', startedAt: '', created: [], mutated: [] };
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
 * @returns {{ runId: string, startedAt: string, created: object[], mutated: object[] }}
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
    };
  } catch {
    throw new Error(`run-registry.json okunamadı: ${REGISTRY_PATH}`);
  }
}

/**
 * @param {string} [runId]
 */
export function resetRegistry(runId = `run-${Date.now()}`) {
  const id = String(runId);
  if (!isRunIdOk(id)) {
    throw new Error(`resetRegistry: geçersiz runId (${id})`);
  }
  const data = {
    runId: id,
    startedAt: new Date().toISOString(),
    created: [],
    mutated: [],
  };
  saveRegistry(data);
  return data;
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
  r.created.push({
    id,
    type,
    mark: rec.mark || `${E2E_META_KEY}=${r.runId}`,
    at: new Date().toISOString(),
  });
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
