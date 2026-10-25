#!/usr/bin/env node
/**
 * verify:plugin-check — WordPress Plugin Check çalıştırır; baseline'da OLMAYAN yeni bulgu → kırmızı.
 * Baseline: tools/lint-baseline/baseline-plugin-check.json (dosya|kaynak|ileti başına SAYI; satır numarası yok,
 * böylece satır kayması yanlış alarm üretmez). Yerel WP / ağ yoksa plugin-check atlar → uyarı, yeşil.
 *   node scripts/plugin-check-gate.mjs                  kapı
 *   node scripts/plugin-check-gate.mjs --write-baseline mevcut bulguları taban yap
 *   node scripts/plugin-check-gate.mjs --no-run         build/lint/plugin-check.json'u yeniden çalıştırmadan kullan
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = path.join(ROOT, 'build/lint/plugin-check.json');
const BASELINE = path.join(ROOT, 'tools/lint-baseline/baseline-plugin-check.json');
const args = new Set(process.argv.slice(2));

if (!args.has('--no-run')) {
  const r = spawnSync('node', [path.join(ROOT, 'scripts/plugin-check.mjs')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(String(r.stderr || r.stdout || '').slice(0, 600));
    console.error('verify:plugin-check KIRMIZI: plugin-check çalışmadı');
    process.exit(1);
  }
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
if (report.skipped) {
  console.log(`verify:plugin-check atlandı (uyarı): ${report.reason}`);
  process.exit(0);
}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const key = (i) => `${i.file}|${i.source}|${norm(i.message)}`;
/** @type {Map<string, number>} */
const now = new Map();
for (const i of report.issues || []) now.set(key(i), (now.get(key(i)) || 0) + 1);

if (args.has('--write-baseline')) {
  const entries = [...now.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, count]) => ({ key: k, count }));
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(
    BASELINE,
    JSON.stringify({ tool: 'plugin-check', total: (report.issues || []).length, entries }, null, 1) + '\n'
  );
  console.log(`plugin-check baseline yazıldı: ${(report.issues || []).length} bulgu, ${entries.length} anahtar`);
  process.exit(0);
}

/** @type {Map<string, number>} */
const base = new Map();
if (fs.existsSync(BASELINE)) {
  for (const e of JSON.parse(fs.readFileSync(BASELINE, 'utf8')).entries || []) base.set(e.key, e.count);
}
const fresh = [];
for (const [k, c] of now) {
  const extra = c - (base.get(k) || 0);
  if (extra > 0) fresh.push(`${k} (+${extra})`);
}
if (fresh.length) {
  console.error(`verify:plugin-check KIRMIZI: ${fresh.length} yeni bulgu anahtarı`);
  for (const f of fresh.slice(0, 20)) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`verify:plugin-check temiz (${(report.issues || []).length} bulgu, hepsi baseline'da)`);
