#!/usr/bin/env node
/**
 * Statik güvenlik analizi (Faz 8): Psalm taint + Semgrep (yerel kurallar, telemetri yok).
 *
 *   npm run analyse:security                 # taban dışı YENİ bulgu varsa çıkış 1
 *   npm run analyse:security -- --write-baseline
 *   npm run analyse:security -- --only psalm|semgrep
 *
 * Taban: tools/security-baseline/baseline-security.json (parmak izi satır numarasından bağımsız).
 * Araç yoksa o parça atlanır (çıkış 0), tıpkı verify:lint gibi. Yalnız geliştirme; pakete girmez.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = process.env.WDP_SECURITY_BASELINE || path.join(ROOT, 'tools/security-baseline/baseline-security.json');
const PSALM = path.join(ROOT, 'vendor-dev/bin/psalm');
const SEMGREP_CANDIDATES = [path.join(ROOT, 'build/semgrep-venv/bin/semgrep'), process.env.WDP_SEMGREP_BIN || ''].filter(Boolean);
const RULES = ['p-php.yaml', 'p-security-audit.yaml'].map((f) => path.join(ROOT, 'tools/security-baseline/semgrep-rules', f));
const OUT = path.join(ROOT, 'build/lint');

const args = process.argv.slice(2);
const writeBaseline = args.includes('--write-baseline');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? String(args[onlyIdx + 1] || '') : '';
const want = (name) => !only || only === name;

/** @param {string} s */
function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** @param {string} s */
function hash(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
}

/**
 * @param {string} rel
 * @param {number} line 1 tabanlı
 */
function sourceLine(rel, line) {
  try {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    return norm(lines[line - 1] || '');
  } catch {
    return '';
  }
}

/** @type {{tool:string,rule:string,file:string,line:number,message:string,fp:string}[]} */
const findings = [];
const notes = [];

function runPsalm(cfg, extra = []) {
  const r = spawnSync(
    'php',
    [PSALM, `--config=${cfg}`, '--taint-analysis', '--no-progress', '--output-format=json', '--threads=1', ...extra],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }
  );
  let list;
  try {
    list = JSON.parse(String(r.stdout || '[]') || '[]');
  } catch {
    throw new Error(`Psalm çıktısı okunamadı: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  }
  return list;
}

if (want('psalm')) {
  if (!fs.existsSync(PSALM)) {
    notes.push('Psalm yok (vendor-dev/bin/psalm): atlandı. Kurulum: npm run test:install');
  } else {
    // 1) Kanarya: stub'lar çalışıyor mu? (bilinen kötü → bulgu VAR; bilinen iyi → YOK)
    const canary = runPsalm('tests/security/psalm-canary/psalm-canary.xml');
    const src = fs.readFileSync(path.join(ROOT, 'tests/security/psalm-canary/canary.php'), 'utf8').split('\n');
    const expectBad = [];
    src.forEach((l, i) => {
      const m = l.match(/BEKLENEN: (Tainted\w+)/);
      if (m) expectBad.push({ type: m[1], line: i + 1 });
    });
    const missing = expectBad.filter((e) => !canary.some((x) => x.type === e.type && x.line_from === e.line));
    const goodFuncs = [...src.join('\n').matchAll(/function (canary_good_\w+)[^{]*\{([\s\S]*?)\n\}/g)];
    const goodRanges = goodFuncs.map((m) => {
      const start = src.join('\n').slice(0, m.index).split('\n').length;
      return [start, start + m[0].split('\n').length - 1];
    });
    const falseHits = canary.filter((x) => goodRanges.some(([a, b]) => x.line_from >= a && x.line_from <= b));
    if (missing.length || falseHits.length) {
      console.error('analyse:security KIRMIZI: Psalm kanaryası başarısız (stub bozuk).');
      for (const m of missing) console.error(`  beklenen ${m.type} (canary.php:${m.line}) bulunamadı`);
      for (const f of falseHits) console.error(`  temiz kodda bulgu ${f.type} canary.php:${f.line_from}`);
      process.exit(1);
    }
    notes.push(`Psalm kanarya: ${expectBad.length} beklenen bulgu görüldü, temiz örneklerde bulgu yok`);

    // 2) Gerçek kod.
    for (const x of runPsalm('psalm-taint.xml')) {
      const file = x.file_name;
      const text = norm(x.snippet || sourceLine(file, x.line_from));
      findings.push({
        tool: 'psalm',
        rule: x.type,
        file,
        line: x.line_from,
        message: x.message,
        fp: `psalm|${x.type}|${file}|${hash(text + '|' + norm(x.selected_text))}`,
      });
    }
  }
}

if (want('semgrep')) {
  const bin = SEMGREP_CANDIDATES.find((c) => fs.existsSync(c));
  if (!bin || RULES.some((r) => !fs.existsSync(r))) {
    notes.push('Semgrep yok (build/semgrep-venv) ya da kural dosyası eksik: atlandı. Kurulum: npm run security:install');
  } else {
    const semArgs = [
      'scan',
      '--metrics=off',
      '--disable-version-check',
      '--json',
      '--quiet',
      ...RULES.flatMap((r) => ['--config', r]),
      ...['*.min.js', 'build', 'vendor', 'vendor-dev', 'node_modules', 'tests', 'design', 'research'].flatMap((e) => ['--exclude', e]),
      'woo-donation-popup.php',
      'uninstall.php',
      'src',
      'includes',
      'templates',
      'blocks',
      'assets/js',
    ];
    const r = spawnSync(bin, semArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      env: { ...process.env, SEMGREP_SEND_METRICS: 'off', SEMGREP_ENABLE_VERSION_CHECK: '0' },
    });
    let doc;
    try {
      doc = JSON.parse(String(r.stdout || '{}') || '{}');
    } catch {
      console.error(`analyse:security: Semgrep çıktısı okunamadı: ${(r.stderr || '').slice(0, 300)}`);
      process.exit(2);
    }
    for (const x of doc.results || []) {
      const rule = String(x.check_id).split('.').slice(-1)[0];
      const text = sourceLine(x.path, x.start.line);
      findings.push({
        tool: 'semgrep',
        rule,
        file: x.path,
        line: x.start.line,
        message: String(x.extra?.severity || ''),
        fp: `semgrep|${rule}|${x.path}|${hash(text)}`,
      });
    }
    for (const e of doc.errors || []) notes.push(`Semgrep uyarısı: ${String(e.message || e.type).slice(0, 120)}`);
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'security.json'), JSON.stringify({ generated: new Date().toISOString(), findings }, null, 1));

if (writeBaseline) {
  const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { entries: [] };
  const keepTools = new Set(['psalm', 'semgrep'].filter((t) => !want(t)));
  const kept = (prev.entries || []).filter((e) => keepTools.has(e.tool));
  const entries = [...kept, ...findings.map(({ tool, rule, file, fp }) => ({ tool, rule, file, fp }))];
  entries.sort((a, b) => a.fp.localeCompare(b.fp));
  fs.writeFileSync(BASELINE, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entries }, null, 1) + '\n');
  console.log(`analyse:security: taban yazıldı (${entries.length} kayıt) → tools/security-baseline/baseline-security.json`);
  process.exit(0);
}

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { entries: [] };
const known = new Set((base.entries || []).map((e) => e.fp));
const fresh = findings.filter((f) => !known.has(f.fp));
for (const n of notes) console.log(`  not: ${n}`);
console.log(`analyse:security: toplam ${findings.length}, taban ${findings.length - fresh.length}, YENİ ${fresh.length}`);
if (fresh.length) {
  for (const f of fresh) console.error(`  YENİ ${f.tool}/${f.rule} ${f.file}:${f.line} ${f.message}`);
  console.error('Kırmızı: yeni güvenlik bulgusu. Düzeltin; yanlış pozitifse gerekçeyle docs/GUVENLIK-DENETIMI.md + --write-baseline.');
  process.exit(1);
}
