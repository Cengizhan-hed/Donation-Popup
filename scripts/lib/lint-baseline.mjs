/**
 * PHPCS baseline + git diff -U0 değişen satır kapısı.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { issueFingerprint } from './lint-report.mjs';

export const SCOPE_PATHS = ['src', 'templates', 'blocks', 'woo-donation-popup.php', 'uninstall.php'];

/**
 * @param {string} root
 */
export function phpcsBaselinePath(root) {
  return path.join(root, 'tools/lint-baseline/baseline-phpcs.json');
}

/**
 * @param {string} root
 */
export function loadPhpcsBaseline(root) {
  const file = phpcsBaselinePath(root);
  if (!fs.existsSync(file)) return { generated: '', tool: 'phpcs', errors: [] };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(raw.fingerprints)) {
    return {
      generated: String(raw.generated || ''),
      tool: 'phpcs',
      errors: [],
      fingerprints: raw.fingerprints,
    };
  }
  return {
    generated: String(raw.generated || ''),
    tool: 'phpcs',
    errors: Array.isArray(raw.errors) ? raw.errors : [],
  };
}

/**
 * @param {{ errors?: Array<{ file: string, source: string, message: string }>, fingerprints?: string[] }} baseline
 */
export function baselineFingerprints(baseline) {
  const set = new Set();
  if (baseline && Array.isArray(baseline.fingerprints)) {
    for (const fp of baseline.fingerprints) set.add(String(fp));
    return set;
  }
  const errors = baseline && Array.isArray(baseline.errors) ? baseline.errors : [];
  for (const e of errors) set.add(issueFingerprint(e));
  return set;
}

/**
 * @param {string} root
 * @param {string} [baseRef]
 * @returns {{ files: string[], lines: Map<string, Set<number>>, raw: string }}
 */
export function changedPhpLines(root, baseRef = '') {
  const base = baseRef || detectBaseRef(root);
  const r = spawnSync(
    'git',
    ['diff', '-U0', '--no-color', '--relative', base, '--', ...SCOPE_PATHS],
    { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  if (r.error) {
    // Varsayılan 1 MB tamponu aşan diff sessizce atlanıyordu; artık hata açıkça yükseltilir.
    throw new Error(`git diff okunamadı (${r.error.message})`);
  }
  const raw = `${r.stdout || ''}${r.stderr || ''}`;
  const lines = new Map();
  let current = '';
  for (const line of (r.stdout || '').split(/\n/)) {
    const fileHit = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileHit) {
      current = fileHit[1].replace(/\\/g, '/');
      if (!lines.has(current)) lines.set(current, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const set = lines.get(current) || new Set();
      for (let i = 0; i < Math.max(count, 0); i += 1) set.add(start + i);
      lines.set(current, set);
    }
  }
  const files = [...lines.keys()].filter((f) => f.endsWith('.php') || f.endsWith('.inc'));
  return { files, lines, raw, base };
}

/**
 * @param {string} root
 */
export function detectBaseRef(root) {
  const tries = ['main', 'origin/main', 'master'];
  for (const ref of tries) {
    const r = spawnSync('git', ['merge-base', 'HEAD', ref], { cwd: root, encoding: 'utf8' });
    if (r.status === 0 && String(r.stdout || '').trim()) {
      return String(r.stdout).trim();
    }
  }
  const empty = spawnSync('git', ['hash-object', '-t', 'tree', '/dev/null'], {
    cwd: root,
    encoding: 'utf8',
  });
  return String(empty.stdout || '').trim() || 'HEAD';
}

/**
 * Yeni hata = değişen satırda ve baseline parmak izinde yok.
 * @param {Array<{ file: string, line: number, source: string, message: string }>} issues
 * @param {Map<string, Set<number>>} changedLines
 * @param {Set<string>} baseline
 */
export function newErrorsOnChangedLines(issues, changedLines, baseline) {
  /** @type {typeof issues} */
  const neu = [];
  /** @type {typeof issues} */
  const existingOnChanged = [];
  for (const issue of issues) {
    const file = String(issue.file || '').replace(/\\/g, '/');
    const set = changedLines.get(file);
    if (!set || !set.has(Number(issue.line))) continue;
    if (baseline.has(issueFingerprint(issue))) {
      existingOnChanged.push(issue);
    } else {
      neu.push(issue);
    }
  }
  return { neu, existingOnChanged };
}

/**
 * @param {string} root
 * @param {Array<{ file: string, line: number, source: string, message: string, fixable?: boolean }>} issues
 */
export function writePhpcsBaseline(root, issues) {
  const fps = [...new Set(issues.map((i) => issueFingerprint(i)))].sort();
  const payload = {
    generated: new Date().toISOString(),
    tool: 'phpcs',
    count: issues.length,
    fingerprints: fps,
  };
  const dest = phpcsBaselinePath(root);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(payload));
  const buildCopy = path.join(root, 'build/lint/baseline-phpcs.json');
  fs.mkdirSync(path.dirname(buildCopy), { recursive: true });
  fs.writeFileSync(buildCopy, JSON.stringify(payload));
  return dest;
}
