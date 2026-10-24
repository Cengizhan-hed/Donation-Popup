#!/usr/bin/env node
/**
 * ESLint (js) / Stylelint (css) — yalnız geliştirme. Kullanım:
 *   node scripts/lint-front.mjs <js|css> [--write-baseline] [--gate] [--files f1 f2 ...]
 * Varsayılan: özet yazar (çıkış 0). --gate: baseline'a göre YENİ hata varsa çıkış 1 (eski hata kapı değildir).
 * Parmak izi = dosya|kural|ileti (satırsız); baseline kural+dosya başına sayı tutar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2];
const args = process.argv.slice(3);
if (!['js', 'css'].includes(kind)) {
  console.error('Kullanım: lint-front.mjs <js|css> [--write-baseline] [--gate] [--files ...]');
  process.exit(2);
}
const gate = args.includes('--gate') || args.includes('--files');
const write = args.includes('--write-baseline');
const fi = args.indexOf('--files');
const files = fi >= 0 ? args.slice(fi + 1).filter((a) => !a.startsWith('--')) : [];
const bin = path.join(ROOT, 'node_modules/.bin', kind === 'js' ? 'eslint' : 'stylelint');
const baseFile = path.join(ROOT, 'tools/lint-baseline', kind === 'js' ? 'baseline-eslint.json' : 'baseline-stylelint.json');

if (!fs.existsSync(bin)) {
  console.log(`lint:${kind} atlandı (araç yok). Kurulum: npm install`);
  process.exit(0);
}

const targets = files.length ? files.map((f) => path.relative(ROOT, path.resolve(f))) : kind === 'js' ? ['assets/js'] : ['assets/css/**/*.css'];
const cmd = kind === 'js' ? ['-f', 'json', ...targets] : ['-f', 'json', '--allow-empty-input', ...targets.map((t) => (t.includes('*') ? t : t))];
const r = spawnSync(bin, cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const raw = (kind === 'js' ? r.stdout : r.stderr || r.stdout) || '';
let res;
try {
  res = JSON.parse(raw.trim() || '[]');
} catch {
  console.error(`lint:${kind} çıktısı okunamadı: ${(r.stderr || raw).slice(0, 300)}`);
  process.exit(1);
}

/** @type {Array<{file:string,rule:string,message:string,line:number,severity:string}>} */
const issues = [];
for (const f of res) {
  const file = path.relative(ROOT, f.filePath || f.source || '');
  if (kind === 'js') {
    for (const m of f.messages) issues.push({ file, rule: m.ruleId || 'parse', message: m.message, line: m.line || 0 });
  } else {
    for (const m of f.warnings || []) issues.push({ file, rule: m.rule || 'parse', message: m.text.replace(/\s*\(.*\)$/, ''), line: m.line || 0 });
  }
}
const fp = (i) => `${i.file}|${i.rule}|${i.message}`;
const counts = new Map();
for (const i of issues) counts.set(fp(i), (counts.get(fp(i)) || 0) + 1);

const byRule = {};
for (const i of issues) byRule[i.rule] = (byRule[i.rule] || 0) + 1;

if (write) {
  fs.mkdirSync(path.dirname(baseFile), { recursive: true });
  fs.writeFileSync(baseFile, JSON.stringify({ tool: kind === 'js' ? 'eslint' : 'stylelint', total: issues.length, counts: Object.fromEntries([...counts].sort()) }, null, 1) + '\n');
  console.log(`lint:${kind} baseline yazıldı (${issues.length} eski hata)`);
}

console.log(`lint:${kind} ${issues.length} bulgu` + (files.length ? ` (${files.length} dosya)` : ''));
if (!gate) {
  for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${rule}: ${n}`);
  fs.mkdirSync(path.join(ROOT, 'build/lint'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `build/lint/${kind}.json`), JSON.stringify({ byRule, issues }, null, 1));
  process.exit(0);
}

let base = { counts: {} };
try {
  base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
} catch {
  /* baseline yok: tüm bulgular yeni sayılır */
}
const fresh = [];
const seen = new Map();
for (const i of issues) {
  const k = fp(i);
  const n = (seen.get(k) || 0) + 1;
  seen.set(k, n);
  if (n > (base.counts[k] || 0)) fresh.push(i);
}
if (fresh.length) {
  console.error(`lint:${kind} YENİ hata ${fresh.length}:`);
  for (const i of fresh.slice(0, 15)) console.error(`  ${i.file}:${i.line} ${i.rule} ${i.message}`);
  process.exit(1);
}
console.log(`lint:${kind} kapı temiz (yeni hata 0)`);
