#!/usr/bin/env node
/**
 * Faz 6 aday listesi üretici (yalnız geliştirme). Ham çıktıyı ÖZETLER.
 *   node scripts/dev-audit.mjs dup    # jscpd -> kopya JS/CSS blokları
 *   node scripts/dev-audit.mjs dead   # phpstan + shipmonk/dead-code-detector -> ölü PHP üyeleri
 * Sonuç: FAZ6_LIST_FILE (ortam değişkeni) ya da ANA depo build/handoff/FAZ6-HEDEF-LISTESI.md içindeki
 * kendi bölümü (işaretçiler arası) yeniden yazılır. Karar listesidir; kod silmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const LIST =
  process.env.FAZ6_LIST_FILE ||
  (fs.existsSync(path.resolve(ROOT, '../Donation Popup/build/handoff'))
    ? path.resolve(ROOT, '../Donation Popup/build/handoff/FAZ6-HEDEF-LISTESI.md')
    : path.join(ROOT, 'build/handoff/FAZ6-HEDEF-LISTESI.md'));
fs.mkdirSync(path.join(ROOT, 'build/lint'), { recursive: true });

function section(name, body) {
  const a = `<!-- ${name}:BAŞLA -->`;
  const b = `<!-- ${name}:BİTTİ -->`;
  let doc = fs.existsSync(LIST) ? fs.readFileSync(LIST, 'utf8') : '# Faz 6 hedef listesi (araç çıktısı; karar toplu verilir)\n';
  const block = `${a}\n${body}\n${b}`;
  const i = doc.indexOf(a);
  const j = doc.indexOf(b);
  doc = i >= 0 && j > i ? doc.slice(0, i) + block + doc.slice(j + b.length) : `${doc.trimEnd()}\n\n${block}\n`;
  fs.mkdirSync(path.dirname(LIST), { recursive: true });
  fs.writeFileSync(LIST, doc);
}

if (mode === 'dup') {
  const bin = path.join(ROOT, 'node_modules/.bin/jscpd');
  if (!fs.existsSync(bin)) { console.log('dup:js atlandı (jscpd yok)'); process.exit(0); }
  spawnSync(bin, [], { cwd: ROOT, encoding: 'utf8' });
  const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/lint/jscpd/jscpd-report.json'), 'utf8'));
  const st = rep.statistics.total;
  const pairs = new Map();
  for (const d of rep.duplicates) {
    const a = d.firstFile, b = d.secondFile;
    const key = `${d.format}|${a.name}|${b.name}`;
    const e = pairs.get(key) || { format: d.format, a: a.name, b: b.name, n: 0, lines: 0, spans: [] };
    e.n += 1; e.lines += d.lines;
    e.spans.push(`${a.start}-${a.end} ↔ ${b.start}-${b.end}`);
    pairs.set(key, e);
  }
  const rows = [...pairs.values()].sort((x, y) => y.lines - x.lines);
  const perFmt = {};
  for (const r of rows) perFmt[r.format] = (perFmt[r.format] || 0) + r.n;
  const out = [
    '## Kopya kod (jscpd) — JS/CSS',
    '',
    `Toplam: ${st.clones} kopya blok, ${st.duplicatedLines} satır (%${st.percentage.toFixed(2)}), ${st.sources} dosya. Tür: ` +
      Object.entries(perFmt).map(([k, v]) => `${k} ${v}`).join(', ') + `. Ham rapor: build/lint/jscpd/ (yerel).`,
    '',
    '| Tür | Dosya A | Dosya B | Blok | Satır | Aralıklar (A ↔ B) |',
    '|---|---|---|---|---|---|',
    ...rows.slice(0, 40).map((r) => `| ${r.format} | assets/${r.a} | assets/${r.b} | ${r.n} | ${r.lines} | ${r.spans.slice(0, 3).join('; ')}${r.spans.length > 3 ? ' …' : ''} |`),
    rows.length > 40 ? `\n(+${rows.length - 40} küçük çift daha; tam liste için npm run dup:js sonrası build/lint/jscpd)` : '',
  ].join('\n');
  section('JSCPD', out);
  console.log(`dup:js ${st.clones} blok, ${st.duplicatedLines} satır (%${st.percentage.toFixed(2)}); liste: ${path.relative(ROOT, LIST) || LIST}`);
} else if (mode === 'dead') {
  const stan = path.join(ROOT, 'vendor-dev/bin/phpstan');
  if (!fs.existsSync(stan) || !fs.existsSync(path.join(ROOT, 'vendor-dev/shipmonk'))) { console.log('dead:php atlandı (phpstan/shipmonk yok)'); process.exit(0); }
  const r = spawnSync('php', [stan, 'analyse', '-c', 'phpstan.dead.neon', '--memory-limit=2G', '--error-format=json', '--no-progress'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  let res;
  try { res = JSON.parse(r.stdout); } catch { console.error('dead:php çıktısı okunamadı: ' + String(r.stderr).slice(0, 300)); process.exit(1); }
  const items = [];
  for (const [abs, info] of Object.entries(res.files || {})) {
    for (const m of info.messages) {
      if (!String(m.identifier || '').startsWith('shipmonk.dead')) continue;
      const file = path.relative(ROOT, abs);
      const kind = m.identifier.replace('shipmonk.dead', '').toLowerCase() || 'üye';
      const sym = (m.message.match(/^Unused\s+(.+)$/) || [])[1] || m.message.slice(0, 70);
      items.push({ file, line: m.line, kind, sym });
    }
  }
  const byKind = {};
  const byFile = new Map();
  for (const i of items) {
    byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    (byFile.get(i.file) || byFile.set(i.file, []).get(i.file)).push(i);
  }
  const files = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  const out = [
    '## Ölü kod adayları (PHPStan + shipmonk/dead-code-detector)',
    '',
    `Toplam ${items.length} aday (` + Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ') + `), ${files.length} dosya.`,
    '**Olası ölü:** WordPress kanca geri çağrıları (`[ $this, \'ad\' ]`, `\'ad\'` dizgesi) ve şablonlardan çağrılanlar tanınmaz → silmeden önce `grep` ile elle doğrula.',
    '',
    '| Dosya | Tür | Satır | Sembol |',
    '|---|---|---|---|',
    ...files.flatMap(([f, arr]) => arr.map((i) => `| ${f} | ${i.kind} | ${i.line} | ${i.sym} |`)),
  ].join('\n');
  section('DEADCODE', out);
  console.log(`dead:php ${items.length} aday (${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(', ')}); liste: ${LIST}`);
} else {
  console.error('Kullanım: dev-audit.mjs <dup|dead>');
  process.exit(2);
}
