/**
 * git diff --name-only + tests/e2e/area-map.json → e2e:quick alan kümesi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './env-root.mjs';

const MAP_FILE = path.join(ROOT, 'tests/e2e/area-map.json');

/**
 * @param {string} file
 * @param {string} pattern
 */
export function pathMatches(file, pattern) {
  const f = String(file || '').replace(/\\/g, '/');
  const p = String(pattern || '').replace(/\\/g, '/');
  if (!p) return false;
  if (f === p) return true;
  if (f.startsWith(p.endsWith('/') ? p : `${p}/`)) return true;
  if (p.endsWith('/')) return f.startsWith(p);
  return false;
}

/**
 * @returns {string[]} repo-relative paths
 */
export function changedFilesVsHead() {
  const argsList = [
    ['diff', '--name-only', 'HEAD'],
    ['diff', '--name-only', '--cached'],
    ['ls-files', '--others', '--exclude-standard'],
  ];
  /** @type {Set<string>} */
  const files = new Set();
  for (const args of argsList) {
    const res = spawnSync('git', args, { encoding: 'utf8', cwd: ROOT });
    if (res.status !== 0) continue;
    for (const line of String(res.stdout || '').split(/\r?\n/)) {
      const t = line.trim();
      if (t) files.add(t.replace(/\\/g, '/'));
    }
  }
  return [...files].sort();
}

/**
 * @param {string[]} files
 * @param {object} [map]
 * @returns {{ areas: string[], unmatched: string[], matched: string[] }}
 */
export function areasForFiles(files, map) {
  const json = map || JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const fallback = Array.isArray(json.unmappedFallback) ? json.unmappedFallback : ['core'];
  const paths = Array.isArray(json.paths) ? json.paths : [];
  /** @type {Set<string>} */
  const areas = new Set();
  const unmatched = [];
  const matched = [];
    const skip = /^(docs\/|CLAUDE\.md$|build\/|\.cursor\/|\.env|\.gitignore$)/;
  for (const file of files) {
    if (skip.test(file)) continue;
    let hit = false;
    for (const row of paths) {
      if (pathMatches(file, row.match)) {
        hit = true;
        matched.push(file);
        for (const a of row.areas || []) areas.add(a);
      }
    }
    if (!hit) unmatched.push(file);
  }
  if (unmatched.length) {
    for (const a of fallback) areas.add(a);
  }
  if (!areas.size && (matched.length || unmatched.length)) {
    for (const a of fallback) areas.add(a);
  }
  return { areas: [...areas], unmatched, matched };
}

/**
 * @param {string[]|null|undefined} explicit
 * @returns {{ areas: string[]|null, files: string[], unmatched: string[], reason: string }}
 */
export function resolveQuickAreas(explicit) {
  if (explicit && explicit.length) {
    return { areas: explicit, files: [], unmatched: [], reason: '--areas' };
  }
  const files = changedFilesVsHead();
  if (!files.length) {
    return {
      areas: ['core', 'shell', 'mobile-a11y'],
      files,
      unmatched: [],
      reason: 'değişiklik yok → çekirdek duman',
    };
  }
  const r = areasForFiles(files);
  if (!r.areas.length) {
    return {
      areas: ['core', 'shell', 'sadaka', 'mobile-a11y', 'checkout-flow'],
      files,
      unmatched: r.unmatched,
      reason: 'eşleme boş → geniş küme',
    };
  }
  const reason = r.unmatched.length
    ? `eşlemesiz ${r.unmatched.length} dosya → geniş küme eklendi`
    : 'alan eşlemesi';
  return { areas: r.areas, files, unmatched: r.unmatched, reason };
}

/**
 * @param {string[]|null} areas
 * @param {string} testId
 */
export function areaIncludes(areas, testId) {
  if (!areas || !areas.length) return true;
  if (areas.includes('all')) return true;
  return areas.includes(testId);
}
