#!/usr/bin/env node
/**
 * Write golden-tr-source.json + text-as-key-report.md from token-scan.php.
 *
 *   node tools/i18n/extract-golden.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');
const SCAN = path.join(ROOT, 'tools/i18n/token-scan.php');
const OUT_JSON = path.join(ROOT, 'tools/i18n/golden/golden-tr-source.json');
const OUT_MD = path.join(ROOT, 'tools/i18n/golden/text-as-key-report.md');

export function functionCounts(calls) {
  const map = {};
  for (const c of calls) {
    const fn = c.function || '?';
    map[fn] = (map[fn] || 0) + 1;
  }
  return map;
}

export function renderTextAsKeyReport(traps) {
  const lines = [
    '# Metin = anahtar tuzakları',
    '',
    'Çevrilmiş gettext sonucunun `===` / `==` / `in_array` / `switch` ile karşılaştırıldığı veya dizi anahtarı olarak kullanıldığı yerler.',
    'Dönüşüm bu satırları önce makine-kararlı değere çevirmeli.',
    '',
    `Toplam: ${traps.length}`,
    '',
  ];
  if (!traps.length) {
    lines.push('_Tuzak bulunamadı._', '');
    return lines.join('\n');
  }
  lines.push('| Dosya:satır | İşlev | Tür | Not | msgid |');
  lines.push('|-------------|-------|-----|-----|-------|');
  for (const t of traps) {
    const loc = `${t.file}:${t.line}`;
    const msg = JSON.stringify(t.msgid ?? '').replace(/\|/g, '\\|');
    lines.push(`| \`${loc}\` | \`${t.function}\` | ${t.kind} | ${t.note} | ${msg} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const r = spawnSync('php', [SCAN, ROOT], { encoding: 'utf8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`token-scan: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
    process.exit(1);
  }
  const data = JSON.parse(r.stdout);
  const golden = {
    generated_at: data.generated_at,
    call_count: data.call_count,
    file_count: data.file_count,
    functions: functionCounts(data.calls || []),
    calls: data.calls || [],
  };
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(golden, null, 2) + '\n', 'utf8');
  fs.writeFileSync(OUT_MD, renderTextAsKeyReport(data.text_as_key || []), 'utf8');
  console.log(
    `golden-tr-source.json: ${golden.call_count} çağrı; text-as-key: ${(data.text_as_key || []).length}`
  );
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main();
}
