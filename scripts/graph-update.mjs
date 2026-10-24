#!/usr/bin/env node
/**
 * Kod haritası (Graphify) — YALNIZ KOD MODU: bulut yok, LLM arka ucu kapalı (GRAPHIFY_BACKEND=none),
 * API anahtarı ortam değişkenleri çocuk sürece geçirilmez. Çıktı: build/graph/ (git dışı).
 *
 *   node scripts/install-graphify.mjs   (bir kez: tools/graphify-venv)
 *   npm run graph:update
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'tools/graphify-venv/bin/graphify');
const SRC = path.join(ROOT, 'build/graph/src');
const OUT = path.join(ROOT, 'build/graph');

if (!fs.existsSync(BIN)) {
  console.error('Graphify yok: python3 -m venv tools/graphify-venv && tools/graphify-venv/bin/pip install graphifyy');
  process.exit(1);
}
fs.rmSync(SRC, { recursive: true, force: true });
fs.mkdirSync(path.join(SRC, 'assets/js'), { recursive: true });
fs.mkdirSync(path.join(SRC, 'assets/css'), { recursive: true });
const cp = (rel) => {
  const from = path.join(ROOT, rel);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(SRC, rel), { recursive: true });
};
['includes', 'templates', 'blocks', 'woo-donation-popup.php', 'uninstall.php', 'assets/js/src', 'assets/js/admin', 'assets/css/src'].forEach(cp);
for (const f of fs.readdirSync(path.join(ROOT, 'assets/js'))) {
  if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'assets/js', f), path.join(SRC, 'assets/js', f));
}

const env = { ...process.env, GRAPHIFY_BACKEND: 'none' };
for (const k of Object.keys(env)) {
  if (/(_API_KEY|_API_TOKEN|ANTHROPIC|OPENAI|GEMINI|DEEPSEEK|MOONSHOT|KIMI|OLLAMA)/i.test(k) && k !== 'GRAPHIFY_BACKEND') delete env[k];
}
const r = spawnSync(BIN, ['update', SRC], { env, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
const outDir = path.join(SRC, 'graphify-out');
for (const f of ['graph.json', 'GRAPH_REPORT.md', 'graph.html']) {
  if (fs.existsSync(path.join(outDir, f))) fs.copyFileSync(path.join(outDir, f), path.join(OUT, f));
}
console.log(`kod haritası: ${path.relative(ROOT, OUT)}/graph.json, GRAPH_REPORT.md`);
