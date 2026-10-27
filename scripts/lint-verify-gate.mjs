#!/usr/bin/env node
/**
 * verify kapısı: değişen satırlarda (git diff -U0) her PHPCS/PHPStan hatası → kırmızı (baseline yok).
 * Tam tarama yok; hedef +20 sn altı. Araç yoksa atlar (çıkış 0).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { issuesFromPhpcs, issuesFromPhpstan } from './lib/lint-report.mjs';
import { changedPhpLines, SCOPE_PATHS } from './lib/lint-baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHPCS = path.join(ROOT, 'vendor-dev/bin/phpcs');
const PHPSTAN = path.join(ROOT, 'vendor-dev/bin/phpstan');

if (!fs.existsSync(PHPCS) || !fs.existsSync(PHPSTAN)) {
  console.log('verify:lint atlandı (vendor-dev yok). Kurulum: node scripts/install-lint-tools.mjs');
  process.exit(0);
}

const started = Date.now();
const diff = changedPhpLines(ROOT);
if (!diff.files.length) {
  console.log(`verify:lint temiz (değişen PHP yok, ${Date.now() - started} ms, taban ${diff.base})`);
  process.exit(0);
}

// Tek kural dosyası (phpcs.xml.dist), baseline YOK: değişen satırdaki her PHPCS hatası kırmızı.
function runPhpcs(files) {
  if (!files.length) return [];
  const args = [PHPCS, '-q', '--report=json', '--standard=phpcs.xml.dist'];
  const res = spawnSync('php', [...args, ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  try {
    return issuesFromPhpcs(JSON.parse(String(res.stdout || '{}') || '{}'), ROOT);
  } catch {
    if (res.status && res.status !== 1 && res.status !== 2) {
      console.error('verify:lint PHPCS çalışmadı');
      process.exit(1);
    }
    return [];
  }
}
const phpcsIssues = runPhpcs(diff.files).filter((i) => {
  const set = diff.lines.get(i.file);
  return set && set.has(Number(i.line));
});

const stanArgs = [
  PHPSTAN,
  'analyse',
  '-c',
  'phpstan.neon',
  '--memory-limit=1G',
  '--error-format=json',
  '--no-progress',
  // Tüm proje analiz edilir (yalnız değişen dosyalar: trait/sınıf çaprazlarında yanlış 'onlyWritten' üretir); sonuç değişen satırlara süzülür.
];
const stan = spawnSync('php', stanArgs, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
let stanIssues = [];
try {
  stanIssues = issuesFromPhpstan(JSON.parse(String(stan.stdout || '{}') || '{}'), ROOT);
} catch {
  if (stan.status && stan.status !== 1) {
    console.error('verify:lint PHPStan çalışmadı');
    process.exit(1);
  }
}

const stanNew = [];
const stanWarn = [];
for (const issue of stanIssues) {
  const set = diff.lines.get(issue.file);
  if (set && set.has(Number(issue.line))) stanNew.push(issue);
  else if (set) stanWarn.push(issue);
}

const red = [...phpcsIssues, ...stanNew];
const warn = [...stanWarn];
const ms = Date.now() - started;

if (warn.length) {
  console.log(`verify:lint uyarı: değişen satırda ${warn.length} mevcut (baseline) hata — kırmızı değil`);
}
if (red.length) {
  console.error(`verify:lint KIRMIZI: ${red.length} yeni hata (değişen satır, ${ms} ms)`);
  for (const e of red.slice(0, 20)) {
    console.error(`  ${e.file}:${e.line} ${e.source} ${e.message}`.slice(0, 220));
  }
  process.exit(1);
}

void SCOPE_PATHS;
console.log(
  `verify:lint temiz (${diff.files.length} dosya, ${ms} ms, taban ${String(diff.base).slice(0, 8)})`
);
process.exit(0);
