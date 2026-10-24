/**
 * Dağıtım dışlama listesi — tek kaynak: .distignore (+ paketleyici prune).
 * deploy:ikram rsync ve package-wp-plugin.sh aynı kümeyi kullanır.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_EXCLUDES = [
  'node_modules/',
  '.git/',
  '.claude/',
  'CLAUDE.md',
  '.cursor/',
  '.vscode/',
  'build/',
  '.DS_Store',
  '*.zip',
  '.env',
  '.env.*',
  'docs/',
  'tests/',
  'scripts/',
  'vendor/',
  'vendor-dev/',
];

/**
 * @param {string} root repo kökü
 * @returns {string[]}
 */
export function parseDistignore(root) {
  const file = path.join(root, '.distignore');
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(file)) return DEFAULT_EXCLUDES.slice();
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const pattern = line.replace(/^\s+|\s+$/g, '');
    if (!pattern || pattern.startsWith('#')) continue;
    out.push(pattern);
  }
  return out.length ? out : DEFAULT_EXCLUDES.slice();
}

/**
 * rsync --exclude argümanları (değerler ayrı; komut satırına gömülmez).
 * @param {string} root
 * @returns {string[]}
 */
export function rsyncExcludeArgs(root) {
  const extra = ['*.md', 'package.json', 'composer.json', 'phpunit.xml.dist'];
  const seen = new Set();
  /** @type {string[]} */
  const args = [];
  for (const p of [...parseDistignore(root), ...extra]) {
    if (seen.has(p)) continue;
    seen.add(p);
    args.push('--exclude', p);
  }
  return args;
}
