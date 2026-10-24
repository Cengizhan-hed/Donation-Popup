#!/usr/bin/env node
/** lint-staged: yalnız verilen PHP dosyalarında PHPCS (baseline dışı yeni hata -> çıkış 1). */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { issuesFromPhpcs, issueFingerprint } from './lib/lint-report.mjs';
import { loadPhpcsBaseline, baselineFingerprints } from './lib/lint-baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.slice(2).map((f) => path.relative(ROOT, path.resolve(f)));
if (!files.length) process.exit(0);
const r = spawnSync('php', [path.join(ROOT, 'vendor-dev/bin/phpcs'), '-q', '--report=json', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
let issues = [];
try {
  issues = issuesFromPhpcs(JSON.parse(String(r.stdout || '{}') || '{}'), ROOT);
} catch {
  process.exit(r.status === 0 ? 0 : 1);
}
const base = baselineFingerprints(loadPhpcsBaseline(ROOT));
const fresh = issues.filter((i) => !base.has(issueFingerprint(i)));
if (fresh.length) {
  for (const i of fresh.slice(0, 15)) console.error(`${i.file}:${i.line} ${i.source} ${i.message}`);
  console.error(`lint-staged: baseline dışı ${fresh.length} PHPCS hatası (npm run lint:php:fix deneyin)`);
  process.exit(1);
}
