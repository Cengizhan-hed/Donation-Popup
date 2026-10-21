#!/usr/bin/env node
/**
 * Güvenli accept: yalnızca son çalıştırmanın Değişti + Yeni ekranlarını baseline’a yazar.
 * ` --env <profil> --device <iphone|android|desktop> ` — yoksa run.json’dan okunur.
 * İşlevsel hata varken veya run.json yokken reddeder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseE2ECli } from './helpers/env.mjs';
import {
  BASELINE_PREV_DIR,
  CURRENT_DIR,
  baselineDirFor,
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

function basenames(list) {
  return (Array.isArray(list) ? list : [])
    .map((n) => path.basename(String(n)))
    .filter((n) => n.endsWith('.png'));
}

const flags = parseE2ECli(process.argv.slice(2));
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

const envId = flags.envId && flags.envId !== 'hedef'
  ? flags.envId
  : run.env || run.profileId || 'staging-hedef';
const deviceId = flags.device || run.device || 'desktop';
const baselineDir = run.baselineDir
  ? path.resolve(ROOT, run.baselineDir)
  : baselineDirFor(envId, deviceId);
const currentDir = run.currentDir ? path.resolve(ROOT, run.currentDir) : CURRENT_DIR;

const changed = basenames(run.changedScreens);
const neu = basenames(run.newBaselineScreens);
const toCopy = [...new Set([...changed, ...neu])];

if (!toCopy.length) {
  console.log(
    'Kabul: kopyalanacak ekran yok (Değişti=0, Yeni=0). Baseline’daki "Aynı" ekranlara dokunulmadı.'
  );
  console.log(
    `Baseline toplam: ${pngs(baselineDir).length} ekran. Mod=${run.mode || '?'} env=${envId} cihaz=${deviceId} sürüm=${run.pluginVersion || '?'}`
  );
  process.exit(0);
}

const missing = toCopy.filter((n) => !fs.existsSync(path.join(currentDir, n)));
if (missing.length) {
  console.error(
    `Kabul reddedildi: run.json’daki bazı ekranlar current’da yok: ${missing.slice(0, 5).join(', ')}`
  );
  process.exit(1);
}

rmTree(BASELINE_PREV_DIR);
if (pngs(baselineDir).length) {
  copyPngs(baselineDir, BASELINE_PREV_DIR);
  console.log(
    `Eski baseline → ${path.relative(ROOT, BASELINE_PREV_DIR)}/ (${pngs(BASELINE_PREV_DIR).length} ekran)`
  );
}

fs.mkdirSync(baselineDir, { recursive: true });
const copiedChanged = [];
const copiedNew = [];
for (const name of toCopy) {
  fs.copyFileSync(path.join(currentDir, name), path.join(baselineDir, name));
  if (changed.includes(name)) copiedChanged.push(name);
  else copiedNew.push(name);
}

console.log(
  `Birleştirildi: ${toCopy.length} ekran (Değişti=${copiedChanged.length}, Yeni=${copiedNew.length}). Aynı olanlara dokunulmadı.`
);
if (copiedChanged.length) {
  console.log('Değişti:');
  for (const name of copiedChanged) console.log(`  • ${name}`);
}
if (copiedNew.length) {
  console.log('Yeni:');
  for (const name of copiedNew) console.log(`  • ${name}`);
}
console.log(
  `Baseline toplam: ${pngs(baselineDir).length} ekran. Mod=${run.mode || '?'} env=${envId} cihaz=${deviceId} sürüm=${run.pluginVersion || '?'}`
);
console.log('Kabul edildi. Sonraki koşu bu referansa göre karşılaştırır.');
