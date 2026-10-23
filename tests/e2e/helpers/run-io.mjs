/**
 * E2E current/diff temizliği ve run.json manifesti.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import {
  currentProfileDir,
  debugDirFor,
  diffDirFor,
  outputProfileId,
  reportDirFor,
  runJsonFor,
  tracesDirFor,
} from './e2e-paths.mjs';

export const CURRENT_DIR = path.join(ROOT, 'build/e2e/current');
export const DIFF_DIR = path.join(ROOT, 'build/e2e/diff');
export const REPORT_DIR = path.join(ROOT, 'build/e2e');
export const RUN_JSON = path.join(CURRENT_DIR, 'run.json');
export const BASELINE_ROOT = path.join(ROOT, 'tests/e2e/__baseline__');
/** @deprecated kök; ortam+cihaz için baselineDirFor kullan */
export const BASELINE_DIR = BASELINE_ROOT;
export const BASELINE_PREV_DIR = path.join(ROOT, 'tests/e2e/__baseline_prev__');

export { reportDirFor, runJsonFor, debugDirFor, tracesDirFor };

/**
 * @param {string} envId
 * @param {string} deviceId
 */
export function baselineDirFor(envId, deviceId) {
  const env = String(envId || 'staging-hedef');
  const device = String(deviceId || 'desktop');
  return path.join(BASELINE_ROOT, env, device);
}

/**
 * @param {string} envId
 * @param {string} deviceId
 */
export function currentDirFor(envId, deviceId) {
  return path.join(CURRENT_DIR, outputProfileId(envId), String(deviceId || 'desktop'));
}

/**
 * Yalnız bu profilin current/diff/debug/traces/report klasörleri.
 * tests/e2e/__baseline__ ve diğer ortamların çıktısı dokunulmaz.
 * @param {string} [profileId]
 */
export function cleanE2EOutputDirs(profileId) {
  const id = outputProfileId(profileId);
  const dirs = [
    currentProfileDir(id),
    diffDirFor(id),
    debugDirFor(id),
    tracesDirFor(id),
    reportDirFor(id),
  ];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @returns {string|null}
 */
export function readLocalPluginVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch (e) {
    return null;
  }
}

/**
 * @param {object} data
 */
export function writeRunManifest(data, dest = RUN_JSON) {
  const file = dest || RUN_JSON;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * @returns {object|null}
 */
export function readRunManifest(profileId) {
  const candidates = [];
  if (profileId) candidates.push(runJsonFor(profileId));
  candidates.push(RUN_JSON);
  if (fs.existsSync(CURRENT_DIR)) {
    for (const name of fs.readdirSync(CURRENT_DIR)) {
      const nested = path.join(CURRENT_DIR, name, 'run.json');
      if (!candidates.includes(nested)) candidates.push(nested);
    }
  }
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * @param {Array<{label?: string, secs?: number}>|null|undefined} sections
 * @param {number} [n]
 * @returns {Array<{label: string, secs: number}>}
 */
export function slowestSections(sections, n = 5) {
  const limit = Number(n);
  const take = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5;
  return (Array.isArray(sections) ? sections : [])
    .map((s) => ({
      label: String(s && s.label != null ? s.label : ''),
      secs: Number(s && s.secs),
    }))
    .filter((s) => s.label && Number.isFinite(s.secs))
    .sort((a, b) => b.secs - a.secs)
    .slice(0, take);
}

/**
 * @param {string[]} shotPaths Absolute or relative PNG paths from capture.
 * @returns {string[]} basename .png list
 */
export function normalizeScreenNames(shotPaths) {
  const out = [];
  for (const p of shotPaths || []) {
    const base = path.basename(String(p));
    if (base.endsWith('.png') && !out.includes(base)) out.push(base);
  }
  return out.sort();
}
