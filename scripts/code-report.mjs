#!/usr/bin/env node
/**
 * KOD KARNESİ (12.0.0): kod kalitesi göstergelerini tek Markdown raporda toplar. Yalnız yerel; ağ/uzak yok.
 *
 *   node scripts/code-report.mjs [--out <dosya>] [--run-plugin-check] [--no-coverage]
 *   npm run code:report
 *
 * Çıktı: build/handoff/KOD-KARNESI.md (varsayılan). Ölçüm aracı yoksa satır "ölçülemedi + neden" yazar; uydurma sayı yok.
 * Araçlar yalnız geliştirme bağımlılığıdır (vendor-dev/, node_modules/); dağıtım paketine girmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argVal = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const OUT = path.resolve(ROOT, argVal('--out', 'build/handoff/KOD-KARNESI.md'));
const SKIP_COVERAGE = argv.includes('--no-coverage');

const LINT_DIR = path.join(ROOT, 'build/lint');
fs.mkdirSync(LINT_DIR, { recursive: true });

/** @param {string} cmd @param {string[]} args @param {object} [opts] */
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}
const bin = (p) => path.join(ROOT, p);
const have = (p) => fs.existsSync(bin(p));
/** @param {string} s */
const jsonOr = (s, fallback = null) => {
  try {
    return JSON.parse(String(s || '').trim() || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const fmt = (n) => Number(n).toLocaleString('tr-TR');

/** @type {{ title: string, rows: string[][] , notes?: string[] }[]} */
const sections = [];
const summaryRows = [];

// ---------- 1) PHPCS (WPCS tam, gevşetme yok)
{
  let value = 'ölçülemedi: vendor-dev/bin/phpcs yok (npm run test:install)';
  let detail = [];
  if (have('vendor-dev/bin/phpcs')) {
    const r = run('php', [bin('vendor-dev/bin/phpcs'), '-q', '--report=json', '--standard=phpcs.xml.dist']);
    const j = jsonOr(r.stdout);
    if (j && j.totals) {
      value = `${j.totals.errors} hata, ${j.totals.warnings} uyarı (${Object.keys(j.files || {}).length} dosyada; kural: phpcs.xml.dist, gevşetme yok)`;
      const byFile = Object.entries(j.files || {})
        .filter(([, v]) => v.errors + v.warnings > 0)
        .map(([f, v]) => `${path.relative(ROOT, f)}: ${v.errors + v.warnings}`);
      detail = byFile.slice(0, 10);
    } else {
      value = `ölçülemedi: PHPCS çıktısı okunamadı (${String(r.stderr || '').slice(0, 120)})`;
    }
  }
  summaryRows.push(['PHPCS (WordPress-Extra + PHPCompatibilityWP)', value]);
  if (detail.length) sections.push({ title: 'PHPCS bulguları (dosya: sayı)', rows: detail.map((d) => [d]) });
}

// ---------- 2) PHPStan
{
  const neon = fs.readFileSync(bin('phpstan.neon'), 'utf8');
  const level = (neon.match(/^\s*level:\s*(\w+)/m) || [])[1] || '?';
  let value = 'ölçülemedi: vendor-dev/bin/phpstan yok';
  const detail = [];
  if (have('vendor-dev/bin/phpstan')) {
    const r = run('php', [bin('vendor-dev/bin/phpstan'), 'analyse', '--memory-limit=2G', '--no-progress', '--error-format=json']);
    const j = jsonOr(r.stdout);
    if (j && j.totals) {
      value = `seviye ${level}, ${j.totals.file_errors} hata (${j.totals.errors} genel), baseline yok`;
      for (const [f, v] of Object.entries(j.files || {})) {
        for (const m of v.messages.slice(0, 3)) detail.push([`${path.relative(ROOT, f)}:${m.line} ${String(m.message).slice(0, 110)}`]);
      }
    } else {
      value = `seviye ${level}; ölçülemedi: PHPStan çıktısı okunamadı`;
    }
  }
  summaryRows.push(['PHPStan', value]);
  if (detail.length) sections.push({ title: 'PHPStan bulguları (ilk 10)', rows: detail.slice(0, 10) });
}

// ---------- 3) PHPUnit kapsamı
{
  let value;
  if (SKIP_COVERAGE) {
    value = 'atlandı (--no-coverage)';
  } else {
    const mods = run('php', ['-m']).stdout || '';
    const driver = /^pcov$/im.test(mods) ? 'pcov' : /^xdebug$/im.test(mods) ? 'xdebug' : '';
    if (!driver || !have('vendor-dev/bin/phpunit')) {
      value =
        'ölçülemedi: PHP kapsam sürücüsü (pcov/xdebug) kurulu değil. Sistem PHP\'sine dokunmamak için kurulmadı; ' +
        'kurulum: `pecl install pcov` (sonra `php -d extension=pcov`); kurulunca bu satır otomatik dolar.';
    } else {
      const args = [bin('vendor-dev/bin/phpunit'), '-c', 'phpunit.xml.dist', '--coverage-text', '--colors=never'];
      const r = run('php', driver === 'pcov' ? ['-d', 'pcov.enabled=1', '-d', 'pcov.directory=src', ...args] : args);
      const m = String(r.stdout || '').match(/Lines:\s+([\d.]+)%\s+\((\d+)\/(\d+)\)/);
      value = m ? `satır %${m[1]} (${m[2]}/${m[3]}), sürücü ${driver}` : `ölçülemedi: ${driver} çıktısı okunamadı`;
    }
  }
  summaryRows.push(['Test kapsamı — PHPUnit (PHP)', value]);
}

// ---------- 4) JS kapsamı (çalışma zamanı JS: assets/src + assets/js)
{
  let value;
  if (SKIP_COVERAGE) {
    value = 'atlandı (--no-coverage)';
  } else {
    const r = run('sh', [
      '-c',
      "WDP_UNIT_TEST=1 node --test --experimental-test-coverage --test-coverage-include='assets/src/**' --test-coverage-include='assets/js/**' tests/unit/js/*.test.mjs",
    ]);
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    const all = out.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
    const pass = out.match(/^# pass (\d+)/m);
    const fail = out.match(/^# fail (\d+)/m);
    value = all
      ? `satır %${all[1]}, dal %${all[2]}, işlev %${all[3]} (assets/src + assets/js; birim testler: ${pass ? pass[1] : '?'} geçti / ${fail ? fail[1] : '?'} kaldı)`
      : 'ölçülemedi: node --experimental-test-coverage çıktısı okunamadı';
  }
  summaryRows.push(['Test kapsamı — JS (node:test)', value]);
}

// ---------- 5) Kod tekrar oranı (jscpd)
{
  let value = 'ölçülemedi: node_modules/.bin/jscpd yok (npm ci)';
  if (have('node_modules/.bin/jscpd')) {
    const cfgPath = path.join(LINT_DIR, 'jscpd-report.config.json');
    const outDir = path.join(LINT_DIR, 'jscpd-report');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        path: ['src', 'assets/src', 'templates', 'blocks'].map((p) => bin(p)).filter((p) => fs.existsSync(p)),
        format: ['php', 'javascript', 'css'],
        ignore: ['**/build/**', '**/vendor/**', '**/*.min.*'],
        minLines: 6,
        minTokens: 70,
        reporters: ['json'],
        output: outDir,
        silent: true,
        gitignore: false,
      })
    );
    run(bin('node_modules/.bin/jscpd'), ['-c', cfgPath]);
    const j = jsonOr(fs.existsSync(path.join(outDir, 'jscpd-report.json')) ? fs.readFileSync(path.join(outDir, 'jscpd-report.json'), 'utf8') : '');
    const t = j && j.statistics && j.statistics.total;
    value = t
      ? `%${Number(t.percentage).toFixed(2)} (${fmt(t.duplicatedLines)} / ${fmt(t.lines)} satır, ${t.clones} kopya; php+js+css, ≥6 satır/70 belirteç)`
      : 'ölçülemedi: jscpd raporu okunamadı';
  }
  summaryRows.push(['Kod tekrarı (jscpd)', value]);
}

// ---------- 6) En uzun 10 dosya
{
  const roots = ['src', 'assets/src', 'assets/js', 'templates', 'blocks'];
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'build', 'vendor'].includes(e.name)) walk(p);
      } else if (/\.(php|js|mjs|css)$/.test(e.name) && !/\.min\./.test(e.name)) {
        files.push([path.relative(ROOT, p), fs.readFileSync(p, 'utf8').split('\n').length]);
      }
    }
  };
  for (const r of roots) walk(bin(r));
  for (const f of ['woo-donation-popup.php', 'uninstall.php']) if (have(f)) files.push([f, fs.readFileSync(bin(f), 'utf8').split('\n').length]);
  files.sort((a, b) => b[1] - a[1]);
  sections.push({ title: 'En uzun 10 dosya (çalışma zamanı kodu)', head: ['Dosya', 'Satır'], rows: files.slice(0, 10).map(([f, n]) => [f, fmt(n)]) });
  summaryRows.push(['En uzun dosya', files[0] ? `${files[0][0]} (${fmt(files[0][1])} satır)` : '—']);
}

// ---------- 7) En karmaşık 10 işlev (PHP: phpcs CyclomaticComplexity; JS: eslint complexity)
{
  const rows = [];
  const notes = [];
  if (have('vendor-dev/bin/phpcs')) {
    const rs = path.join(LINT_DIR, 'phpcs-complexity.xml');
    fs.writeFileSync(
      rs,
      `<?xml version="1.0"?>\n<ruleset name="metrics"><file>${bin('src')}</file><file>${bin('templates')}</file><file>${bin('blocks')}</file>` +
        `<arg name="extensions" value="php"/>` +
        `<rule ref="Generic.Metrics.CyclomaticComplexity"><properties><property name="complexity" value="1"/><property name="absoluteComplexity" value="100000"/></properties></rule></ruleset>\n`
    );
    const r = run('php', [bin('vendor-dev/bin/phpcs'), '-q', '--report=json', `--standard=${rs}`, '--no-cache']);
    const j = jsonOr(r.stdout);
    if (j && j.files) {
      for (const [f, v] of Object.entries(j.files)) {
        for (const m of v.messages) {
          const mm = String(m.message).match(/cyclomatic complexity \((\d+)\)/);
          if (!mm) continue;
          let name = '(adsız işlev)';
          try {
            const text = fs.readFileSync(f, 'utf8').split('\n');
            for (let i = m.line - 1; i < Math.min(text.length, m.line + 3); i += 1) {
              const nm = text[i].match(/function\s+&?(\w+)/);
              if (nm) { name = nm[1]; break; }
            }
          } catch { /* dosya okunamadı */ }
          rows.push(['PHP', `${path.relative(ROOT, f)}:${m.line}`, name, Number(mm[1])]);
        }
      }
    } else notes.push('PHP karmaşıklığı ölçülemedi (phpcs çıktısı okunamadı).');
  } else notes.push('PHP karmaşıklığı ölçülemedi: vendor-dev/bin/phpcs yok.');
  if (have('node_modules/.bin/eslint')) {
    const targets = ['assets/src', 'assets/js'].filter((p) => have(p));
    const r = run(bin('node_modules/.bin/eslint'), ['--no-config-lookup', '--rule', 'complexity: [warn, 1]', '--parser-options', 'ecmaVersion:latest', '--parser-options', 'sourceType:module', '-f', 'json', ...targets]);
    const j = jsonOr(r.stdout);
    if (Array.isArray(j)) {
      for (const f of j) {
        for (const m of f.messages) {
          const mm = String(m.message).match(/^(.*) has a complexity of (\d+)/);
          if (mm) rows.push(['JS', `${path.relative(ROOT, f.filePath)}:${m.line}`, mm[1], Number(mm[2])]);
        }
      }
    } else notes.push('JS karmaşıklığı ölçülemedi (eslint çıktısı okunamadı).');
  }
  rows.sort((a, b) => b[3] - a[3]);
  const top = rows.slice(0, 10);
  sections.push({
    title: 'En karmaşık 10 işlev (döngüsel karmaşıklık)',
    head: ['Dil', 'Konum', 'İşlev', 'Karmaşıklık'],
    rows: top.map((x) => [x[0], x[1], x[2], String(x[3])]),
    notes,
  });
  summaryRows.push(['En karmaşık işlev', top[0] ? `${top[0][2]} — ${top[0][3]} (${top[0][1]})` : notes.join(' ') || '—']);
}

// ---------- 8) Eski koddan kalan satır
{
  const r = run('node', [bin('scripts/legacy-lines.mjs'), '--json']);
  const j = jsonOr(r.stdout);
  const value = j
    ? `${fmt(j.total)} satır${j.total ? ` (${Object.entries(j.categories || {}).filter(([, n]) => n).map(([k, n]) => `${k}: ${fmt(n)}`).join(', ')})` : ''} — hedef 0`
    : 'ölçülemedi: scripts/legacy-lines.mjs çıktısı okunamadı';
  summaryRows.push(['Eski koddan kalan satır (includes/ vb.)', value]);
}

// ---------- 9) ESLint / Stylelint / Plugin Check özeti
{
  let es = 'ölçülemedi: eslint yok';
  if (have('node_modules/.bin/eslint')) {
    const targets = ['assets/src', 'assets/js', 'blocks'].filter((p) => have(p));
    const r = run(bin('node_modules/.bin/eslint'), ['-f', 'json', ...targets]);
    const j = jsonOr(r.stdout);
    if (Array.isArray(j)) {
      const errors = j.reduce((a, f) => a + f.errorCount, 0);
      const warns = j.reduce((a, f) => a + f.warningCount, 0);
      es = `${errors} hata, ${warns} uyarı (${targets.join(', ')}; proje eslint.config.mjs)`;
    } else es = `ölçülemedi: eslint çıktısı okunamadı (${String(r.stderr || '').slice(0, 100)})`;
  }
  summaryRows.push(['ESLint', es]);

  let sl = 'ölçülemedi: stylelint yok';
  if (have('node_modules/.bin/stylelint')) {
    const r = run(bin('node_modules/.bin/stylelint'), ['-f', 'json', '--allow-empty-input', 'assets/src/**/*.css', 'assets/css/**/*.css']);
    const j = jsonOr(r.stderr || r.stdout, null) || jsonOr(r.stdout);
    if (Array.isArray(j)) {
      const warns = j.reduce((a, f) => a + (f.warnings || []).length, 0);
      sl = `${warns} bulgu (assets/src + assets/css; proje .stylelintrc.json)`;
    } else sl = 'ölçülemedi: stylelint çıktısı okunamadı';
  }
  summaryRows.push(['Stylelint', sl]);

  const pcJson = path.join(LINT_DIR, 'plugin-check.json');
  if (argv.includes('--run-plugin-check')) {
    run('node', [bin('scripts/plugin-check.mjs')]);
  }
  let pc = 'çalıştırılmadı (yerel WP + WP-CLI gerekir; `npm run code:report -- --run-plugin-check`)';
  if (fs.existsSync(pcJson)) {
    const j = jsonOr(fs.readFileSync(pcJson, 'utf8'));
    const t = j && j.summary && j.summary.total;
    const when = new Date(fs.statSync(pcJson).mtime).toISOString().slice(0, 16).replace('T', ' ');
    pc = typeof t === 'number' ? `${t} bulgu (son rapor: ${when})` : `rapor okunamadı (${when})`;
  }
  summaryRows.push(['WordPress Plugin Check', pc]);
}

// ---------- Yaz
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
const md = [];
md.push('# Kod Karnesi', '', `Üretim: ${now} UTC — \`node scripts/code-report.mjs\` (yalnız yerel, geliştirme araçları; pakete girmez).`, '');
md.push('| Gösterge | Sonuç |', '|---|---|');
for (const [k, v] of summaryRows) md.push(`| ${k} | ${String(v).replace(/\|/g, '\\|')} |`);
md.push('');
for (const s of sections) {
  md.push(`## ${s.title}`, '');
  if (s.head) md.push(`| ${s.head.join(' | ')} |`, `|${s.head.map(() => '---').join('|')}|`);
  for (const row of s.rows) md.push(s.head ? `| ${row.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |` : `- ${row.join(' ')}`);
  for (const n of s.notes || []) md.push('', `> ${n}`);
  md.push('');
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join('\n'));
console.log(`KOD-KARNESI yazıldı: ${path.relative(ROOT, OUT) || OUT}`);
for (const [k, v] of summaryRows) console.log(`  ${k}: ${v}`);
