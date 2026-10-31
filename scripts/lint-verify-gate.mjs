#!/usr/bin/env node
/**
 * verify kapısı: PHPCS değişen satırlarda (git diff -U0), PHPStan TÜM projede (seviye phpstan.neon) → her hata kırmızı (baseline yok).
 * Araç yoksa ya da çalışmazsa KIRMIZI (çıkış 1); sessiz atlama yok.
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
  console.error('verify:lint KIRMIZI: PHPCS/PHPStan bulunamadı (vendor-dev/bin). Kurulum: node scripts/install-lint-tools.mjs');
  process.exit(1);
}

const started = Date.now();
const diff = changedPhpLines(ROOT);

// Tek kural dosyası (phpcs.xml.dist), baseline YOK: değişen satırdaki her PHPCS hatası kırmızı.
function runPhpcs(files) {
  if (!files.length) return [];
  const args = [PHPCS, '-q', '--report=json', '--standard=phpcs.xml.dist'];
  const res = spawnSync('php', [...args, ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  try {
    return issuesFromPhpcs(JSON.parse(String(res.stdout || '').trim()), ROOT);
  } catch {
    console.error(`verify:lint KIRMIZI: PHPCS çalışmadı (çıktı okunamadı, kod ${res.status}): ${String(res.stderr || '').slice(0, 300)}`);
    process.exit(1);
  }
}
const phpcsIssues = runPhpcs(diff.files).filter((i) => {
  const set = diff.lines.get(i.file);
  return set && set.has(Number(i.line));
});

const stanArgs = [PHPSTAN, 'analyse', '-c', 'phpstan.neon', '--memory-limit=1G', '--error-format=json', '--no-progress'];
// Tüm proje analiz edilir; her hata (değişen satır olsun olmasın) kırmızı.
const stan = spawnSync('php', stanArgs, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
let stanDoc;
try {
  stanDoc = JSON.parse(String(stan.stdout || '').trim());
} catch {
  console.error(`verify:lint KIRMIZI: PHPStan çalışmadı (çıktı okunamadı, kod ${stan.status}): ${String(stan.stderr || '').slice(0, 300)}`);
  process.exit(1);
}
if (!stanDoc || typeof stanDoc.totals !== 'object') {
  console.error('verify:lint KIRMIZI: PHPStan çıktısı geçersiz (totals yok)');
  process.exit(1);
}
const stanNew = issuesFromPhpstan(stanDoc, ROOT);
const stanTotal = Number(stanDoc.totals.errors || 0) + Number(stanDoc.totals.file_errors || 0);
if (!stanNew.length && stanTotal > 0) {
  stanNew.push({ file: 'phpstan', line: 0, source: 'phpstan', message: `genel hata (errors=${stanDoc.totals.errors}, file_errors=${stanDoc.totals.file_errors})` });
}

const red = [...phpcsIssues, ...stanNew];
const ms = Date.now() - started;

if (red.length) {
  console.error(`verify:lint KIRMIZI: ${red.length} hata (${ms} ms)`);
  for (const e of red.slice(0, 20)) {
    console.error(`  ${e.file}:${e.line} ${e.source} ${e.message}`.slice(0, 220));
  }
  process.exit(1);
}

void SCOPE_PATHS;
console.log(
  `verify:lint temiz (PHPCS ${diff.files.length} değişen dosya; PHPStan tüm proje 0 hata; ${ms} ms, taban ${String(diff.base).slice(0, 8)})`
);
process.exit(0);
