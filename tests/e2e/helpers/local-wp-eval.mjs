/**
 * Yerel WP eval-file (SSH yok). Yalnız WDP_LOCAL_WP_DIR.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './env-root.mjs';

/**
 * @param {string} relFile repo göreli PHP
 * @param {string[]} [extraArgs]
 * @param {{ timeout?: number }} [opts]
 * @returns {string} stdout
 */
export function runLocalEvalFile(relFile, extraArgs = [], opts = {}) {
  const extraEnv = opts.env && typeof opts.env === 'object' ? opts.env : {};
  const wpDir = String(extraEnv.WDP_LOCAL_WP_DIR || process.env.WDP_LOCAL_WP_DIR || '').trim();
  if (!wpDir) {
    throw new Error('yerel WP: WDP_LOCAL_WP_DIR yok');
  }
  const evalFile = path.join(ROOT, 'tests/local-wp/eval-file.php');
  const r = spawnSync(
    'php',
    ['-d', 'memory_limit=1024M', evalFile, relFile, ...extraArgs.map((a) => String(a))],
    {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, ...extraEnv, WDP_LOCAL_WP_DIR: wpDir },
      timeout: opts.timeout || 120000,
    }
  );
  if (r.status !== 0) {
    const out = String(r.stdout || '');
    if (out.includes('{') && out.includes('}')) {
      console.error(`[e2e:catch-fail] yerel eval ${relFile} exit=${r.status} (JSON var)`);
      return out;
    }
    throw new Error(`yerel eval ${relFile}: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return r.stdout || '';
}

/**
 * @param {string} text
 * @returns {object}
 */
export function parseLocalEvalJson(text) {
  const raw = String(text || '');
  const i = raw.indexOf('{');
  const j = raw.lastIndexOf('}');
  if (i < 0 || j < i) {
    throw new Error(`yerel eval JSON yok: ${raw.slice(0, 240)}`);
  }
  return JSON.parse(raw.slice(i, j + 1));
}
