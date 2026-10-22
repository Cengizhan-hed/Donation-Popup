/**
 * Canlı Hedef yol/host taraması. `npm run verify` zincirine bağlı.
 *
 * git ls-files (izlenen) + izlenmeyen-ama-yok-sayılmayan dosyalarda
 * `hedefdernegi.org` yalnız şu biçimlerde geçebilir: // live-scan:blacklist-def
 *   1) staging30.hedefdernegi.org
 *   2) kara liste tanımı (satırda live-scan:blacklist-def)
 *   3) birim test reddetme örneği (satırda live-scan:allow-reject-test)
 *
 * `~/www/` yolları yalnız ALLOWED_DEPLOY_TARGETS.allowedRoot ile geçer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_DEPLOY_TARGETS,
  LIVE_SCAN_ALLOW_REJECT_TEST,
  LIVE_SCAN_BLACKLIST_MARK,
} from './deploy-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../..');

const SKIP_DIR_NAMES = new Set(['node_modules', 'vendor', 'build', 'docs']);
const SKIP_EXT = new Set(['.md']);

function isSkippedRel(rel) {
  const n = rel.replace(/\\/g, '/');
  if (n.startsWith('docs/') || n === 'docs') return true;
  const parts = n.split('/');
  if (parts.some((p) => SKIP_DIR_NAMES.has(p))) return true;
  if (SKIP_EXT.has(path.extname(n).toLowerCase())) return true;
  return false;
}

/**
 * @param {string} root
 * @returns {string[]} repo-relative paths
 */
export function listScanFiles(root = REPO_ROOT) {
  const tracked = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
  });
  const others = spawnSync('git', ['ls-files', '-z', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'buffer',
  });
  const names = [];
  for (const buf of [tracked.stdout, others.stdout]) {
    if (!buf) continue;
    const parts = String(buf).split('\0').filter(Boolean);
    names.push(...parts);
  }
  const uniq = [...new Set(names.map((n) => n.replace(/\\/g, '/')))];
  return uniq.filter((rel) => !isSkippedRel(rel));
}

function lineAllowed(line) {
  return (
    line.includes(LIVE_SCAN_BLACKLIST_MARK) || line.includes(LIVE_SCAN_ALLOW_REJECT_TEST)
  );
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function leftoverHedefMentions(line) {
  const stripped = String(line || '').replace(/staging30\.hedefdernegi\.org/gi, '');
  const hits = [];
  const re = /hedefdernegi\.org/gi;
  let m;
  while ((m = re.exec(stripped))) {
    hits.push(m[0]);
  }
  return hits;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function leftoverWwwPaths(line) {
  const re = /~\/www\/[^\s'"`]+/g;
  const out = [];
  let m;
  while ((m = re.exec(String(line || '')))) {
    const raw = m[0];
    if (raw.includes('..')) {
      out.push(raw);
      continue;
    }
    const allowed = ALLOWED_DEPLOY_TARGETS.some((t) => {
      const root = String(t.allowedRoot || '');
      const prefix = root.endsWith('/') ? root : `${root}/`;
      return raw === root || raw === prefix.slice(0, -1) || raw.startsWith(prefix);
    });
    if (!allowed) out.push(raw);
  }
  return out;
}

/**
 * @param {string} rel
 * @param {string} text
 * @returns {Array<{ file: string, line: number, reason: string }>}
 */
export function scanText(rel, text) {
  const hits = [];
  const lines = String(text || '').split(/\n/);
  lines.forEach((line, i) => {
    if (lineAllowed(line)) return;
    for (const _ of leftoverHedefMentions(line)) {
      hits.push({
        file: rel,
        line: i + 1,
        reason: 'hedefdernegi.org (staging30 dışında)', // live-scan:blacklist-def
      });
    }
    for (const p of leftoverWwwPaths(line)) {
      hits.push({
        file: rel,
        line: i + 1,
        reason: `~/www/ izinli kök dışında (${p.split('/').slice(0, 4).join('/')})`,
      });
    }
  });
  return hits;
}

/**
 * scripts/ ve tests/e2e/ altında doğrudan ssh/scp/sftp/rsync spawn.
 * @param {string} [root]
 * @returns {Array<{ file: string, line: number, text: string }>}
 */
export function scanDirectRemoteSpawns(root = REPO_ROOT) {
  const dirs = [path.join(root, 'scripts'), path.join(root, 'tests', 'e2e')];
  const re =
    /\b(?:spawnSync|spawn|execSync|exec)\s*\(\s*['"`](ssh|scp|sftp|rsync)['"`]/;
  const hits = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name === 'vendor') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(mjs|js|cjs|ts)$/.test(ent.name)) continue;
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (rel.endsWith('remote-guard.mjs')) continue;
      const text = fs.readFileSync(full, 'utf8');
      text.split(/\n/).forEach((line, i) => {
        if (re.test(line)) {
          hits.push({ file: rel, line: i + 1, text: line.trim() });
        }
      });
    }
  }

  for (const d of dirs) walk(d);
  return hits;
}

/**
 * @param {string} [root]
 */
export function scanLiveTargets(root = REPO_ROOT) {
  const files = listScanFiles(root);
  const hits = [];
  for (const rel of files) {
    const full = path.join(root, rel);
    let text = '';
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      if (st.size > 2_000_000) continue;
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    hits.push(...scanText(rel, text));
  }
  return hits;
}

function cliMain() {
  const hits = scanLiveTargets(REPO_ROOT);
  if (!hits.length) {
    console.log('live-target-scan: temiz');
    process.exit(0);
  }
  console.error('live-target-scan: ihlal');
  for (const h of hits) {
    console.error(`${h.file}:${h.line}: ${h.reason}`);
  }
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cliMain();
}
