#!/usr/bin/env node
/** Rector kuru çalıştırma (dosya yazmaz). Özet: değişecek dosya sayısı + uygulanan kural sayıları. WDP_RECTOR_RENAME=1 ile 6-C adlandırma kuralları. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'vendor-dev/bin/rector');
if (!fs.existsSync(BIN)) {
  console.log('rector:dry atlandı (rector yok). Kurulum: node scripts/install-lint-tools.mjs');
  process.exit(0);
}
fs.mkdirSync(path.join(ROOT, 'build/lint'), { recursive: true });
const r = spawnSync('php', [BIN, 'process', '--dry-run', '--no-progress-bar', '--clear-cache', '--output-format=json', '--memory-limit=1G'], {
  cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
if (!String(r.stdout).trim().startsWith("{")) {
  console.log("rector:dry: kural kümesi boş (beklenen). 6-C için WDP_RECTOR_RENAME=1 npm run rector:dry");
  process.exit(0);
}
let j;
try { j = JSON.parse(r.stdout); } catch { console.error('rector çıktısı okunamadı: ' + String(r.stderr || r.stdout).slice(0, 400)); process.exit(1); }
const rules = {};
for (const f of j.file_diffs || []) for (const a of f.applied_rectors || []) rules[a] = (rules[a] || 0) + 1;
fs.writeFileSync(path.join(ROOT, 'build/lint/rector.json'), JSON.stringify({ totals: j.totals, rules }, null, 1));
console.log(`rector:dry ${(j.file_diffs || []).length} dosya değişirdi, ${(j.totals || {}).errors || 0} hata` + (process.env.WDP_RECTOR_RENAME === '1' ? ' (6-C adlandırma kuralları açık)' : ' (kural kümesi boş: beklenen 0)'));
for (const [k, v] of Object.entries(rules)) console.log(`  ${k.split('\\').pop()}: ${v}`);
