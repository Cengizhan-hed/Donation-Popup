#!/usr/bin/env node
/**
 * verify:plugin-check — WordPress Plugin Check çalıştırır; her bulgu → kırmızı (taban/baseline YOK).
 * Tek açık istisna: `trademarked_term` (eklenti klasör adı "woo-donation-popup" "woo" ile başlıyor). Klasör adı/text domain
 * değişmez kararı (CLAUDE.md §1, 2026-10-24); WordPress.org dizinine gönderimde ad kullanıcıyla birlikte yeniden belirlenir.
 * Plugin Check ZORUNLU: wp-cli/yerel WP yoksa ya da çalışmazsa kırmızı (atlama yok).
 *   node scripts/plugin-check-gate.mjs            kapı
 *   node scripts/plugin-check-gate.mjs --no-run   build/lint/plugin-check.json'u yeniden çalıştırmadan kullan
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'build/lint/plugin-check.json');
const args = new Set(process.argv.slice(2));
const ACCEPTED_SOURCES = new Set(['trademarked_term']);

if (!args.has('--no-run')) {
  const r = spawnSync('node', [path.join(ROOT, 'scripts/plugin-check.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(String(r.stderr || r.stdout || '').slice(0, 600));
    console.error('verify:plugin-check KIRMIZI: plugin-check çalışmadı');
    process.exit(1);
  }
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
if (report.skipped || report.failed) {
  console.error(`verify:plugin-check KIRMIZI: Plugin Check çalışmadı (zorunlu): ${report.reason}`);
  console.error('Kurulum: node scripts/install-lint-tools.mjs');
  process.exit(1);
}

const issues = report.issues || [];
const real = issues.filter((i) => !ACCEPTED_SOURCES.has(i.source));
if (real.length) {
  console.error(`verify:plugin-check KIRMIZI: ${real.length} bulgu`);
  for (const i of real.slice(0, 20)) console.error(`  ${i.file}:${i.line} ${i.source} ${String(i.message).slice(0, 140)}`);
  process.exit(1);
}
console.log(`verify:plugin-check temiz (${issues.length - real.length} kabul edilmiş ad-kısıtı bulgusu: trademarked_term)`);
