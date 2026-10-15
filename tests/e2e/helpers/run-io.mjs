/**
 * E2E current/diff temizliği ve run.json manifesti.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

export const CURRENT_DIR = path.join(ROOT, 'build/e2e/current');
export const DIFF_DIR = path.join(ROOT, 'build/e2e/diff');
export const REPORT_DIR = path.join(ROOT, 'build/e2e');
export const RUN_JSON = path.join(CURRENT_DIR, 'run.json');
export const BASELINE_DIR = path.join(ROOT, 'tests/e2e/__baseline__');
export const BASELINE_PREV_DIR = path.join(ROOT, 'tests/e2e/__baseline_prev__');

/**
 * build/e2e/current ve build/e2e/diff silinip yeniden oluşturulur.
 * tests/e2e/__baseline__ dokunulmaz.
 */
export function cleanE2EOutputDirs() {
  for (const dir of [CURRENT_DIR, DIFF_DIR]) {
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
export function writeRunManifest(data) {
  fs.mkdirSync(CURRENT_DIR, { recursive: true });
  fs.writeFileSync(RUN_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * @returns {object|null}
 */
export function readRunManifest() {
  if (!fs.existsSync(RUN_JSON)) return null;
  try {
    return JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
  } catch (e) {
    return null;
  }
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
