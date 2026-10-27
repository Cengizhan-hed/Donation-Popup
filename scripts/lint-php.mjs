#!/usr/bin/env node
/**
 * PHPCS çalıştırır; build/lint/phpcs.json|md yazar. Tek kural dosyası phpcs.xml.dist, baseline yok. Kodu düzeltmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  issuesFromPhpcs,
  summarizeIssues,
  summaryMarkdown,
  writeLintPair,
} from './lib/lint-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHPCS = path.join(ROOT, 'vendor-dev/bin/phpcs');
const OUT = path.join(ROOT, 'build/lint');

function failMissing() {
  console.error('PHPCS yok. Önce: node scripts/install-lint-tools.mjs');
  process.exit(2);
}

if (!fs.existsSync(PHPCS)) failMissing();

const extra = process.argv.slice(2);
const r = spawnSync(
  'php',
  [PHPCS, '-q', '--report=json', ...extra],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);
const raw = String(r.stdout || '').trim();
let parsed = {};
try {
  parsed = raw ? JSON.parse(raw) : {};
} catch {
  console.error((r.stderr || raw).slice(0, 800));
  process.exit(r.status === 0 ? 1 : r.status || 1);
}

const issues = issuesFromPhpcs(parsed, ROOT);
const summary = summarizeIssues(issues);
writeLintPair(OUT, 'phpcs', { summary, issues }, summaryMarkdown('PHPCS', summary));
console.log(
  `PHPCS ${summary.total} hata (${summary.fixable} phpcbf). Rapor: build/lint/phpcs.md`
);
for (const [cat, n] of Object.entries(summary.categories)) {
  if (n) console.log(`  ${cat}: ${n}`);
}
process.exit(0);
