#!/usr/bin/env node
/**
 * 6-C hazırlığı: PHP kaynaklarında "sadaka" geçişlerini kategorize eder.
 *  - rename (PHP sınıf/yöntem/işlev/sabit adı)  -> tools/rector/rename-map.json (Rector kuralları okur)
 *  - protect (DB seçenek/post meta/sipariş meta anahtarı, kanca adı, dizge)  -> DOKUNMA listesi
 * Çıktı: tools/rector/rename-map.json + build/lint/sadaka-inventory.md (özet). Kod değiştirmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = ['src', 'templates', 'blocks', 'woo-donation-popup.php', 'uninstall.php'];
const toNew = (s) => s.replace(/sadaka/g, 'addon').replace(/Sadaka/g, 'Addon').replace(/SADAKA/g, 'ADDON');

function walk(p, out = []) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return out;
  const st = fs.statSync(full);
  if (st.isDirectory()) fs.readdirSync(full).forEach((f) => walk(path.join(p, f), out));
  else if (p.endsWith('.php')) out.push(p);
  return out;
}

const map = { classes: {}, methods: [], functions: {}, constants: {}, files: {} };
const protect = { dbKeys: {}, hooks: {}, other: {} };
const HOOK_CALL = /(add_action|add_filter|do_action|apply_filters|remove_action|remove_filter|has_filter|has_action|do_action_ref_array)\s*\(\s*['"]([^'"]*sadaka[^'"]*)['"]/gi;

for (const file of SCOPE.flatMap((p) => walk(p))) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (/sadaka/i.test(path.basename(file))) map.files[file] = toNew(file);
  let cls = '';
  for (const line of src.split('\n')) {
    const mc = line.match(/^\s*(?:abstract\s+|final\s+)?(?:class|trait|interface)\s+(\w+)/);
    if (mc) cls = mc[1];
    if (mc && /sadaka/i.test(mc[1])) map.classes[mc[1]] = toNew(mc[1]);
    const mf = line.match(/^\s*(?:(?:public|protected|private|static|final|abstract)\s+)*function\s+&?(\w*sadaka\w*)/i);
    if (mf) {
      if (/^\s*(public|protected|private|static|final|abstract)/.test(line) || (cls && /^\s{1,}function/.test(line))) {
        map.methods.push({ class: cls, old: mf[1], new: toNew(mf[1]) });
      } else map.functions[mf[1]] = toNew(mf[1]);
    }
    const mk = line.match(/^\s*(?:(?:public|protected|private)\s+)?const\s+(\w*SADAKA\w*)/);
    if (mk) map.constants[mk[1]] = toNew(mk[1]);
    const md = line.match(/define\(\s*['"](\w*SADAKA\w*)['"]/);
    if (md) map.constants[md[1]] = toNew(md[1]);
  }
  for (const m of src.matchAll(HOOK_CALL)) protect.hooks[m[2]] = (protect.hooks[m[2]] || 0) + 1;
  for (const m of src.matchAll(/(['"])([\w.-]*sadaka[\w.-]*)\1/gi)) {
    const k = m[2];
    if (protect.hooks[k]) continue;
    const bucket = /^(_?wdp_|_?enable_|_sadaka|_?sadaka_)/i.test(k) && !/-/.test(k) ? 'dbKeys' : 'other';
    protect[bucket][k] = (protect[bucket][k] || 0) + 1;
  }
}
// kanca adlarını DB/other listelerinden çıkar (kanca ayrı sayılır)
for (const h of Object.keys(protect.hooks)) { delete protect.dbKeys[h]; delete protect.other[h]; }

fs.mkdirSync(path.join(ROOT, 'tools/rector'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/rector/rename-map.json'), JSON.stringify({ ...map, protect }, null, 2) + '\n');

const lines = ['# "sadaka" envanteri (6-C hazırlık)', '',
  `| Kategori | Sayı | Not |`, `|---|---|---|`,
  `| PHP sınıf (Rector yeniden adlandırır) | ${Object.keys(map.classes).length} | dosya adı ayrıca git mv |`,
  `| PHP yöntem | ${map.methods.length} | RenameMethodRector (sınıf bazlı) |`,
  `| PHP işlev | ${Object.keys(map.functions).length} | |`,
  `| PHP sabit | ${Object.keys(map.constants).length} | |`,
  `| Dosya adı | ${Object.keys(map.files).length} | elle git mv + require yolu |`,
  `| DOKUNMA: DB/meta anahtarı dizgesi | ${Object.keys(protect.dbKeys).length} | idempotent göç gerekir |`,
  `| DOKUNMA: kanca adı (genel API) | ${Object.keys(protect.hooks).length} | takma ad (eski+yeni) ile |`,
  `| DOKUNMA: diğer dizge (HTML sınıf/id, dizi anahtarı) | ${Object.keys(protect.other).length} | JS/CSS/E2E ile birlikte ayrı karar |`];
fs.mkdirSync(path.join(ROOT, 'build/lint'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build/lint/sadaka-inventory.md'), lines.join('\n') + '\n');
console.log(lines.slice(3).join('\n'));
