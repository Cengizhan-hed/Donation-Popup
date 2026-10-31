#!/usr/bin/env node
/**
 * 12.4 Stripe anahtar sızıntısı taraması (yalnız yerel; DEĞER YAZDIRMAZ, yalnız dosya + eşleşme sayısı).
 *
 *   node tests/e2e/stripe-leak-scan.mjs [--base <git ref>]
 *
 * Taranan: `git diff <base>` (çalışma ağacı dahil) + izlenmeyen yeni dosyalar, build/handoff/RAPOR-124-stripe*,
 * stripe listen / PHP sunucu günlükleri, test-results, işçi WP'nin wc-logs ve debug.log'u.
 * Desen: (sk|pk|rk)_(test|live)_…, whsec_… — çıkış kodu: eşleşme varsa 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SECRET_RE } from './helpers/stripe-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const base = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'ikram-ortam';

/** @param {string} text @return {number} */
const count = (text) => (String(text).match(SECRET_RE) || []).length;

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    out.push(dir);
    return;
  }
  for (const name of fs.readdirSync(dir)) walk(path.join(dir, name), out);
}

const rows = [];
const diff = spawnSync('git', ['diff', base, '--', '.', ':(exclude)package-lock.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
rows.push({ source: `git diff ${base}`, matches: count(diff.stdout) });
const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
let untrackedHits = 0;
for (const f of untracked) {
  const abs = path.join(ROOT, f);
  if (fs.existsSync(abs) && fs.statSync(abs).size < 20 * 1024 * 1024) untrackedHits += count(fs.readFileSync(abs, 'utf8'));
}
rows.push({ source: `izlenmeyen dosyalar (${untracked.length})`, matches: untrackedHits });

const files = [];
walk(path.join(ROOT, 'build/handoff/RAPOR-124-stripe.md'), files);
walk(path.join(ROOT, 'build/handoff/RAPOR-124-stripe'), files);
walk(path.join(ROOT, 'test-results'), files);
const matrix = path.join(ROOT, 'build/e2e/matrix');
if (fs.existsSync(matrix)) {
  for (const name of fs.readdirSync(matrix)) {
    if (/^(stripe-listen|php)-\d+\.log$/.test(name)) files.push(path.join(matrix, name));
  }
  const workers = path.join(matrix, '_workers');
  if (fs.existsSync(workers)) {
    for (const w of fs.readdirSync(workers).filter((n) => n.startsWith('stripe-'))) {
      walk(path.join(workers, w, 'wordpress/wp-content/uploads/wc-logs'), files);
      walk(path.join(workers, w, 'wordpress/wp-content/debug.log'), files);
      walk(path.join(workers, w, 'wordpress/wp-content/uploads/wdp-stripe-e2e.jsonl'), files);
    }
  }
}
for (const f of files) {
  if (fs.statSync(f).size > 50 * 1024 * 1024 || /\.(png|jpe?g|webp|zip)$/i.test(f)) continue;
  rows.push({ source: path.relative(ROOT, f), matches: count(fs.readFileSync(f, 'utf8')) });
}
const total = rows.reduce((a, r) => a + r.matches, 0);
const hits = rows.filter((r) => r.matches > 0);
console.log(JSON.stringify({ scanned: rows.length, total, hits: hits.map((r) => `${r.source}: ${r.matches}`) }, null, 2));
process.exit(total > 0 ? 1 : 0);
