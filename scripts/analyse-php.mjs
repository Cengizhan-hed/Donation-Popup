#!/usr/bin/env node
/**
 * PHPStan çalıştırır; build/lint/phpstan.json|md yazar. Tek phpstan.neon, baseline yok. Kodu düzeltmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  issuesFromPhpstan,
  summarizeIssues,
  summaryMarkdown,
  writeLintPair,
} from './lib/lint-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'vendor-dev/bin/phpstan');
const OUT = path.join(ROOT, 'build/lint');

if (!fs.existsSync(BIN)) {
  console.error('PHPStan yok. Önce: node scripts/install-lint-tools.mjs');
  process.exit(2);
}

const extra = process.argv.slice(2);
const args = [
  BIN,
  'analyse',
  '--memory-limit=2G',
  '--error-format=json',
  '--no-progress',
  ...extra,
];

const r = spawnSync('php', args, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const raw = String(r.stdout || '').trim();
let parsed = {};
try {
  parsed = raw ? JSON.parse(raw) : {};
} catch {
  console.error((r.stderr || raw).slice(0, 1200));
  process.exit(r.status === 0 ? 1 : r.status || 1);
}

const issues = issuesFromPhpstan(parsed, ROOT);
const summary = summarizeIssues(issues);
writeLintPair(OUT, 'phpstan', { summary, issues }, summaryMarkdown('PHPStan', summary));

console.log(`PHPStan ${summary.total} hata. Rapor: build/lint/phpstan.md`);
for (const [cat, n] of Object.entries(summary.categories)) {
  if (n) console.log(`  ${cat}: ${n}`);
}
process.exit(0);
