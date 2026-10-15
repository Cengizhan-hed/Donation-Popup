#!/usr/bin/env node
/**
 * Güvenli accept: yalnızca son çalıştırmanın (run.json) ekranlarını baseline’a birleştirir.
 * İşlevsel hata varken veya run.json yokken reddeder.
 * Eski baseline → tests/e2e/__baseline_prev__/
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/env.mjs';
import {
  BASELINE_DIR,
  BASELINE_PREV_DIR,
  CURRENT_DIR,
  readRunManifest,
} from './helpers/run-io.mjs';

function pngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
}

function rmTree(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyPngs(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of pngs(from)) {
    fs.copyFileSync(path.join(from, name), path.join(to, name));
  }
}

const run = readRunManifest();
if (!run || !Array.isArray(run.screens) || !run.screens.length) {
  console.error(
    'Kabul reddedildi: build/e2e/current/run.json yok veya ekran listesi boş. Önce npm run e2e:quick veya ship:staging çalıştırın.'
  );
  process.exit(1);
}

const failed = Number(run.stats?.failed ?? 0);
if (failed > 0) {
  console.error(
    `Kabul reddedildi: son çalıştırmada ${failed} işlevsel hata var. Önce hataları düzeltin; bayat veya bozuk ekranlar baseline olmasın.`
  );
  process.exit(1);
}

const flaky = Array.isArray(run.flaky) ? run.flaky : [];
if (flaky.length) {
  const names = flaky.map((f) => f.check || '?').join(', ');
  console.warn(
    `\x1b[33mUyarı: son çalıştırmada kararsız (yeniden denemede geçen) senaryolar var — kabul devam ediyor: ${names}\x1b[0m`
  );
}

const screens = run.screens.map((n) => path.basename(String(n))).filter((n) => n.endsWith('.png'));
const missing = screens.filter((n) => !fs.existsSync(path.join(CURRENT_DIR, n)));
if (missing.length) {
  console.error(
    `Kabul reddedildi: run.json’daki bazı ekranlar current’da yok: ${missing.slice(0, 5).join(', ')}`
  );
  process.exit(1);
}

rmTree(BASELINE_PREV_DIR);
if (pngs(BASELINE_DIR).length) {
  copyPngs(BASELINE_DIR, BASELINE_PREV_DIR);
  console.log(
    `Eski baseline → ${path.relative(ROOT, BASELINE_PREV_DIR)}/ (${pngs(BASELINE_PREV_DIR).length} ekran)`
  );
}

fs.mkdirSync(BASELINE_DIR, { recursive: true });
const copied = [];
for (const name of screens) {
  fs.copyFileSync(path.join(CURRENT_DIR, name), path.join(BASELINE_DIR, name));
  copied.push(name);
}

console.log(`Birleştirildi: ${copied.length} ekran baseline’a kopyalandı (diğer baseline ekranları korundu).`);
for (const name of copied) {
  console.log(`  • ${name}`);
}
console.log(
  `Baseline toplam: ${pngs(BASELINE_DIR).length} ekran. Mod=${run.mode || '?'} sürüm=${run.pluginVersion || '?'}`
);
console.log('Kabul edildi. Sonraki ship:staging / e2e:quick bu referansa göre karşılaştırır.');
