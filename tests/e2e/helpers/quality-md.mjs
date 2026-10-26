/**
 * ozet.json -> okunur tablo (kapı x tema x cihaz, Lighthouse, bütçe). `node tests/e2e/helpers/quality-md.mjs` ozet.md yazar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {object} s ozet.json içeriği.
 * @return {string} Markdown.
 */
export function qualityMarkdown(s) {
  const out = [];
  const groups = new Map();
  for (const r of s.browser || []) {
    const k = `${r.gate}|${r.theme}|${r.device}`;
    const g = groups.get(k) || { gate: r.gate, theme: r.theme, device: r.device, pass: 0, fail: 0 };
    r.ok ? (g.pass += 1) : (g.fail += 1);
    groups.set(k, g);
  }
  out.push('## Tarayıcı kapıları (kapı × tema × cihaz: geçen/kalan)', '', '| kapı | tema | iphone | android | desktop |', '|---|---|---|---|---|');
  const rows = new Map();
  for (const g of groups.values()) {
    const k = `${g.gate}|${g.theme}`;
    const row = rows.get(k) || { gate: g.gate, theme: g.theme };
    row[g.device] = `${g.pass}/${g.fail}`;
    rows.set(k, row);
  }
  for (const r of [...rows.values()].sort((a, b) => (a.gate + a.theme).localeCompare(b.gate + b.theme))) {
    out.push(`| ${r.gate} | ${r.theme} | ${r.iphone || '-'} | ${r.android || '-'} | ${r.desktop || '-'} |`);
  }
  out.push('', '## Lighthouse (mobil, simüle yavaş 4G; 3 koşu medyan; kontrol = eklenti pasif aynı sayfa)', '', '| tema | motor | sayfa | perf | kontrol | erişilebilirlik | LCP ms (kontrol) | CLS | durum |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of s.lighthouse || []) {
    out.push(`| ${r.theme} | ${r.engine} | ${r.page} | ${r.performance} | ${r.controlPerformance} | ${r.accessibility} | ${r.lcpMs} (${r.controlLcpMs}) | ${r.cls} | ${r.perfStatus}${r.a11yFails.length ? ' · ' + r.a11yFails.join(',') : ''} |`);
  }
  out.push('', '## Boyut bütçesi (gzip KB; ilk yük yolu: bütçe JS ≤ 60, CSS ≤ 30; ertelenen JS etkileşim/boşta yüklenir)', '', '| tema | sayfa | modüller | JS | ertelenen JS | CSS | durum |', '|---|---|---|---|---|---|---|');
  for (const r of s.budget || []) {
    out.push(`| ${r.theme} | ${r.page} | ${r.modules} | ${r.jsGzipKb} | ${r.jsDeferredGzipKb ?? 0} | ${r.cssGzipKb} | ${r.ok ? 'tamam' : 'AŞIM'}${r.moduleOffenders.length ? ' · kapalı modül varlığı: ' + r.moduleOffenders.join(',') : ''} |`);
  }
  return `${out.join('\n')}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../build/quality');
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'ozet.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'ozet.md'), qualityMarkdown(s));
  console.log(qualityMarkdown(s));
}
