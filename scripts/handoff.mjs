#!/usr/bin/env node
/**
 * Teslim paketi → ~/Desktop/e2e-inceleme
 *
 *   npm run handoff
 *   npm run handoff -- --screens desktop-product-fixed,desktop-shop
 *   npm run handoff -- --shells
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop', 'e2e-inceleme');
const MAX_FILES = 20;
const RUN_JSON_MAX_AGE_MS = 60 * 60 * 1000;
const PERF_MAX_AGE_MS = 30 * 60 * 1000;

const CURRENT_DIR = path.join(ROOT, 'build/e2e/current');
const BASELINE_DIR = path.join(ROOT, 'tests/e2e/__baseline__');
const DIFF_DIR = path.join(ROOT, 'build/e2e/diff');
const REPORT_MD = path.join(ROOT, 'build/handoff/RAPOR.md');
const PERF_MD = path.join(ROOT, 'build/e2e/perf/report.md');
const RUN_JSON = path.join(CURRENT_DIR, 'run.json');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {string[]} */
  let screens = [];
  let shells = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--screens') {
      const v = String(argv[++i] || '');
      screens = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.endsWith('.png') ? s : `${s}.png`));
    } else if (a.startsWith('--screens=')) {
      screens = a
        .slice('--screens='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.endsWith('.png') ? s : `${s}.png`));
    } else if (a === '--shells') {
      shells = true;
    }
  }
  return { screens, shells };
}

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function loadSecretValues(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  /** @type {string[]} */
  const vals = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    if (v.length >= 6) vals.push(v);
  }
  return vals;
}

/**
 * @param {string} text
 * @param {string[]} secrets
 * @param {string} label
 */
function assertNoSecrets(text, secrets, label) {
  for (const s of secrets) {
    if (s && text.includes(s)) {
      console.error(
        `Güvenlik: gizli değer ${label} içinde geçiyor. Kopyalama durduruldu (değer yazılmadı).`
      );
      process.exit(1);
    }
  }
}

function rmTree(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * @param {string} name basename.png
 */
function stem(name) {
  return String(name).replace(/\.png$/i, '');
}

/**
 * @param {string} name
 * @returns {{ yeni?: string, eski?: string, fark?: string }}
 */
function resolveTriple(name) {
  const base = path.basename(name);
  const cur = path.join(CURRENT_DIR, base);
  const old = path.join(BASELINE_DIR, base);
  const diffCandidates = [
    path.join(DIFF_DIR, base.replace(/\.png$/i, '-diff.png')),
    path.join(DIFF_DIR, base),
    path.join(ROOT, 'build/e2e/report/diff', base.replace(/\.png$/i, '-diff.png')),
  ];
  /** @type {{ yeni?: string, eski?: string, fark?: string }} */
  const t = {};
  if (fs.existsSync(cur)) t.yeni = cur;
  if (fs.existsSync(old)) t.eski = old;
  for (const d of diffCandidates) {
    if (fs.existsSync(d)) {
      t.fark = d;
      break;
    }
  }
  return t;
}

/**
 * @param {object|null} run
 * @param {{ screens: string[], shells: boolean }} flags
 * @returns {string[]}
 */
function collectScreenNames(run, flags) {
  /** @type {Set<string>} */
  const set = new Set();
  for (const s of flags.screens) set.add(path.basename(s));

  if (run) {
    for (const s of run.changedScreens || []) set.add(path.basename(String(s)));
    for (const s of run.newBaselineScreens || []) set.add(path.basename(String(s)));
  }

  if (flags.shells) {
    const pool = [
      ...(run && Array.isArray(run.screens) ? run.screens : []),
      ...(fs.existsSync(CURRENT_DIR)
        ? fs.readdirSync(CURRENT_DIR).filter((f) => f.endsWith('.png'))
        : []),
    ];
    for (const s of pool) {
      const b = path.basename(String(s));
      if (/-(popup|panel)-/i.test(b)) set.add(b);
    }
  }

  return [...set].filter((n) => n.endsWith('.png')).sort();
}

function main() {
  const flags = parseArgs(process.argv.slice(2).filter((a) => a !== '--'));
  const secrets = [
    ...loadSecretValues(path.join(ROOT, '.env.e2e')),
    ...loadSecretValues(path.join(ROOT, '.env.deploy')),
  ];

  if (!fs.existsSync(REPORT_MD)) {
    console.error('build/handoff/RAPOR.md yok. Önce raporu yazın.');
    process.exit(1);
  }

  const reportText = fs.readFileSync(REPORT_MD, 'utf8');
  assertNoSecrets(reportText, secrets, 'build/handoff/RAPOR.md');

  /** @type {object|null} */
  let run = null;
  let runStale = false;
  let runMissing = false;
  if (!fs.existsSync(RUN_JSON)) {
    runMissing = true;
    console.warn('Uyarı: build/e2e/current/run.json yok — run.json ekranları kopyalanmayacak.');
  } else {
    const age = Date.now() - fs.statSync(RUN_JSON).mtimeMs;
    if (age > RUN_JSON_MAX_AGE_MS) {
      runStale = true;
      console.warn(
        `Uyarı: run.json ${(age / 60000).toFixed(0)} dk eski (>60) — Değişti/Yeni listesinden ekran kopyalanmayacak; --screens/--shells varsa onlar kopyalanır.`
      );
    } else {
      try {
        run = JSON.parse(fs.readFileSync(RUN_JSON, 'utf8'));
      } catch (e) {
        runMissing = true;
        console.warn('Uyarı: run.json okunamadı — ekran listesi boş sayıldı.');
      }
    }
  }

  // Stale/missing: sadece elle --screens / --shells (shells current'dan)
  const screenNames = collectScreenNames(runStale || runMissing ? null : run, flags);

  rmTree(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /** @type {string[]} */
  const copied = [];
  /** @type {string[]} */
  const skippedScreens = [];

  // 1) RAPOR
  const raporDest = path.join(OUT_DIR, 'RAPOR.md');
  fs.copyFileSync(REPORT_MD, raporDest);
  copied.push('RAPOR.md');

  // 2) git-durum.txt
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const log = execFileSync('git', ['log', '-3', '--oneline'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const diffStat = execFileSync('git', ['diff', '--stat'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const gitText =
    `Dal: ${branch}\n\n` +
    `Son 3 commit:\n${log || '(yok)'}\n\n` +
    `git status --short:\n${status || '(temiz)'}\n\n` +
    `git diff --stat:\n${diffStat || '(yok)'}\n`;
  assertNoSecrets(gitText, secrets, 'git-durum.txt');
  fs.writeFileSync(path.join(OUT_DIR, 'git-durum.txt'), gitText, 'utf8');
  copied.push('git-durum.txt');

  // 3) perf (son 30 dk)
  let perfCopied = false;
  if (fs.existsSync(PERF_MD)) {
    const age = Date.now() - fs.statSync(PERF_MD).mtimeMs;
    if (age <= PERF_MAX_AGE_MS) {
      fs.copyFileSync(PERF_MD, path.join(OUT_DIR, 'perf.md'));
      copied.push('perf.md');
      perfCopied = true;
    }
  }

  // 4) Ekran üçlüleri — kota: MAX_FILES toplam
  const reserved = copied.length;
  const room = Math.max(0, MAX_FILES - reserved);
  /** @type {Array<{ name: string, files: Array<{ src: string, dest: string }> }>} */
  const triples = [];
  for (const name of screenNames) {
    const t = resolveTriple(name);
    if (!t.yeni && !t.eski && !t.fark) continue;
    const st = stem(name);
    /** @type {Array<{ src: string, dest: string }>} */
    const files = [];
    if (t.yeni) files.push({ src: t.yeni, dest: `${st}__1-yeni.png` });
    if (t.eski) files.push({ src: t.eski, dest: `${st}__2-eski.png` });
    if (t.fark) files.push({ src: t.fark, dest: `${st}__3-fark.png` });
    triples.push({ name, files });
  }

  let used = 0;
  for (const tr of triples) {
    if (used + tr.files.length > room) {
      skippedScreens.push(tr.name);
      continue;
    }
    for (const f of tr.files) {
      fs.copyFileSync(f.src, path.join(OUT_DIR, f.dest));
      copied.push(f.dest);
      used += 1;
    }
  }

  if (skippedScreens.length) {
    const note =
      `\n\n## Atlanan ekranlar\n\n` +
      `Toplam dosya kotası (${MAX_FILES}) dolu; kopyalanmadı:\n` +
      skippedScreens.map((n) => `- ${n}`).join('\n') +
      `\n`;
    fs.appendFileSync(path.join(OUT_DIR, 'RAPOR.md'), note, 'utf8');
    console.warn(
      `Uyarı: ${skippedScreens.length} ekran kotası nedeniyle atlandı: ${skippedScreens.join(', ')}`
    );
  }

  if (!perfCopied && fs.existsSync(PERF_MD)) {
    console.warn('Uyarı: perf/report.md 30 dk’dan eski — perf.md eklenmedi.');
  }
  if (runStale) {
    console.warn('Uyarı: run.json bayat (>60 dk).');
  }
  if (runMissing) {
    console.warn('Uyarı: run.json yok veya okunamadı.');
  }

  console.log(`Teslim: ${OUT_DIR}`);
  console.log(`Dosyalar (${copied.length}):`);
  for (const f of copied) console.log(`  • ${f}`);

  if (process.platform === 'darwin') {
    spawnSync('open', [OUT_DIR], { stdio: 'ignore' });
  }

  console.log(`Teslim hazır: ${copied.length} dosya`);
}

main();
