#!/usr/bin/env node
/**
 * ESLint (js) / Stylelint (css) — yalnız geliştirme; pakete girmez. Kullanım:
 *   node scripts/lint-front.mjs <js|css> [--dev] [--gate] [--files f1 f2 ...]
 * Taban (baseline) YOK: tek bulgu bile kırmızıdır (çıkış 1). Kapsam: js = ürün kaynağı (assets/src, blocks);
 * --dev ile tests/tools/scripts de taranır (teknik borç raporu için; verify'a bağlı değil).
 * css = assets/src/**.css + assets/critical/**.css. Derleme çıktısı ve dev/design araç yapılandırmasında hariç.
 * --gate yalnız geriye dönük uyum için kabul edilir (davranış aynı).
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2];
const args = process.argv.slice(3);
if (!['js', 'css'].includes(kind)) {
  console.error('Kullanım: lint-front.mjs <js|css> [--gate] [--files ...]');
  process.exit(2);
}
const fi = args.indexOf('--files');
const files = fi >= 0 ? args.slice(fi + 1).filter((a) => !a.startsWith('--')) : [];
const bin = path.join(ROOT, 'node_modules/.bin', kind === 'js' ? 'eslint' : 'stylelint');

const dev = args.includes('--dev');
const jsScope = dev ? ['assets/src', 'blocks', 'tests', 'tools', 'scripts'] : ['assets/src', 'blocks'];
const defaults = kind === 'js' ? jsScope : ['assets/src/**/*.css', 'assets/critical/**/*.css'];
const targets = files.length ? files.map((f) => path.relative(ROOT, path.resolve(f))) : defaults;
const extra = kind === 'js' ? ['--no-warn-ignored'] : ['--allow-empty-input'];
const r = spawnSync(bin, ['-f', 'json', ...extra, ...targets], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
if (r.error) {
  console.error(`lint:${kind} çalışmadı: ${r.error.message} (kurulum: npm ci)`);
  process.exit(1);
}
const raw = (kind === 'js' ? r.stdout : r.stderr || r.stdout) || '';
let res;
try {
  res = JSON.parse(raw.trim() || '[]');
} catch {
  console.error(`lint:${kind} çıktısı okunamadı: ${(r.stderr || raw).slice(0, 300)}`);
  process.exit(1);
}

const issues = [];
for (const f of res) {
  const file = path.relative(ROOT, f.filePath || f.source || '');
  const rows = kind === 'js' ? f.messages : f.warnings || [];
  for (const m of rows) {
    issues.push({ file, rule: m.ruleId || m.rule || 'parse', message: m.message || m.text, line: m.line || 0 });
  }
}

console.log(`lint:${kind} ${issues.length} bulgu` + (files.length ? ` (${files.length} dosya)` : ''));
if (issues.length) {
  for (const i of issues.slice(0, 25)) console.error(`  ${i.file}:${i.line} ${i.rule} ${i.message}`);
  process.exit(1);
}
