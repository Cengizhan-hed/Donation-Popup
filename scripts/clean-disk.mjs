#!/usr/bin/env node
/**
 * npm run clean:disk [-- --apply] [-- --auto]
 * Varsayılan --dry-run: ne silineceğini listeler. --apply siler.
 * --auto: yalnız boş disk <20 GB ise --apply çalışır. Kontrol çıkış kodu: 0 / 10 uyarı / 20 hata (disk:check).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { buildPlan, applyPlan, summarize, fmtSize } from './lib/disk-clean.mjs';
import { freeGB, classify } from './lib/disk-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
let apply = args.includes('--apply');

const gb = freeGB(ROOT);
const level = classify(gb);
console.log(`Boş disk: ${gb.toFixed(1)} GB`);
if (check) {
  if (level === 20) console.error('HATA: <10 GB — yeni ajan/tam paket başlatma. npm run clean:disk -- --apply');
  else if (level === 10) console.warn('UYARI: <20 GB — önce npm run clean:disk -- --apply');
  process.exit(level);
}
if (args.includes('--auto')) apply = level > 0;

function portBusy(port) {
  if (!port) return Promise.resolve(false);
  return new Promise((res) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); res(true); });
    s.once('error', () => res(false));
  });
}
const ports = new Set();
for (let p = 8800; p <= 9400; p++) ports.add(p);
const busy = new Set();
await Promise.all([...ports].map(async (p) => { if (await portBusy(p)) busy.add(p); }));

const plan = buildPlan(ROOT, { isPortBusy: (p) => busy.has(p) });
const { freed } = applyPlan(ROOT, plan, { dryRun: !apply });
for (const [rule, v] of Object.entries(summarize(plan))) console.log(`  ${rule.padEnd(15)} ${String(v.count).padStart(4)} öğe  ${fmtSize(v.size)}`);
if (!apply) for (const i of plan.slice(0, 40)) console.log('  -', path.relative(ROOT, i.p) || i.p, fmtSize(i.size));
console.log(`${apply ? 'SİLİNDİ' : 'SİLİNECEK (dry-run; --apply ile sil)'}: ${fmtSize(freed)}`);
