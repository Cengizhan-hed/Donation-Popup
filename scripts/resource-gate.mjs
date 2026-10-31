#!/usr/bin/env node
/**
 * Kaynak kapısı: yeni (ağır) ajan başlatmadan önce disk, bellek ve takas kontrolü.
 * Kullanım: node scripts/resource-gate.mjs [--min-disk-gb 20] [--min-free-mem-gb 4] [--max-swap-gb 2] [--json]
 * Env: WDP_GATE_MIN_DISK_GB, WDP_GATE_MIN_FREE_MEM_GB, WDP_GATE_MAX_SWAP_GB.
 * Çıkış 0 = başlayabilir, 1 = bekle (neden satırı). Bağımlılık yok; yalnız okur.
 */
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GB = 1024 ** 3;

/** `vm_stat` çıktısı → { pageSize, free, inactive, speculative, availableBytes }. */
export function parseVmStat(text) {
  const ps = /page size of (\d+) bytes/.exec(text);
  const pageSize = ps ? Number(ps[1]) : 4096;
  const pages = (label) => {
    const m = new RegExp('^' + label + ':\\s+(\\d+)', 'm').exec(text);
    return m ? Number(m[1]) : 0;
  };
  const free = pages('Pages free');
  const inactive = pages('Pages inactive');
  const speculative = pages('Pages speculative');
  return { pageSize, free, inactive, speculative, availableBytes: (free + inactive + speculative) * pageSize };
}

/** `sysctl vm.swapusage` çıktısı → { totalBytes, usedBytes, freeBytes }. */
export function parseSwapUsage(text) {
  const unit = { K: 1024, M: 1024 ** 2, G: GB, T: 1024 ** 4 };
  const get = (k) => {
    const m = new RegExp(k + '\\s*=\\s*([\\d.,]+)([KMGT])', 'i').exec(text);
    return m ? Number(m[1].replace(',', '.')) * unit[m[2].toUpperCase()] : 0;
  };
  return { totalBytes: get('total'), usedBytes: get('used'), freeBytes: get('free') };
}

/** `df -k <yol>` çıktısı → boş bayt (Available sütunu). */
export function parseDfFree(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return 0;
  const cols = lines[lines.length - 1].trim().split(/\s+/);
  const avail = Number(cols[3]);
  return Number.isFinite(avail) ? avail * 1024 : 0;
}

/** Eşik değerlendirmesi (saf). m: { diskFreeBytes, memAvailBytes, swapUsedBytes, cpus }. */
export function evaluate(m, t) {
  const reasons = [];
  const g = (b) => (b / GB).toFixed(1);
  if (m.diskFreeBytes < t.minDiskGb * GB) reasons.push(`boş disk ${g(m.diskFreeBytes)} GB < ${t.minDiskGb} GB`);
  if (m.memAvailBytes != null && m.memAvailBytes < t.minFreeMemGb * GB) reasons.push(`kullanılabilir bellek ${g(m.memAvailBytes)} GB < ${t.minFreeMemGb} GB`);
  if (m.swapUsedBytes != null && m.swapUsedBytes >= t.maxSwapGb * GB) reasons.push(`takas ${g(m.swapUsedBytes)} GB >= ${t.maxSwapGb} GB`);
  return { ok: reasons.length === 0, reasons, workers: suggestWorkers(m) };
}

/** Playwright worker önerisi: bellek (≈1.5 GB/worker) ve CPU ile sınırlı; takas yüksekse düşer. */
export function suggestWorkers(m) {
  const cpus = Math.max(1, m.cpus || 1);
  let w = Math.min(4, Math.max(1, Math.floor(cpus / 2)));
  if (m.memAvailBytes != null) w = Math.min(w, Math.max(1, Math.floor(m.memAvailBytes / (1.5 * GB))));
  if (m.swapUsedBytes != null) {
    if (m.swapUsedBytes >= 2 * GB) w = 1;
    else if (m.swapUsedBytes >= 1 * GB) w = Math.max(1, w - 1);
  }
  return w;
}

function sh(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
}

/** Gerçek ölçüm (macOS tam; diğer sistemlerde os.freemem ve takas bilinmez). */
export function measure(dir = process.cwd()) {
  const df = sh('df', ['-k', dir]);
  const m = { diskFreeBytes: df ? parseDfFree(df) : 0, memAvailBytes: os.freemem(), swapUsedBytes: null, cpus: os.cpus().length };
  if (process.platform === 'darwin') {
    const vm = sh('vm_stat', []);
    if (vm) m.memAvailBytes = parseVmStat(vm).availableBytes;
    const sw = sh('sysctl', ['vm.swapusage']);
    if (sw) m.swapUsedBytes = parseSwapUsage(sw).usedBytes;
  }
  return m;
}

export function parseArgs(argv, env = process.env) {
  const t = {
    minDiskGb: Number(env.WDP_GATE_MIN_DISK_GB ?? 20),
    minFreeMemGb: Number(env.WDP_GATE_MIN_FREE_MEM_GB ?? 4),
    maxSwapGb: Number(env.WDP_GATE_MAX_SWAP_GB ?? 2),
    json: false,
  };
  const map = { '--min-disk-gb': 'minDiskGb', '--min-free-mem-gb': 'minFreeMemGb', '--max-swap-gb': 'maxSwapGb' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') t.json = true;
    else if (map[argv[i]]) {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error(`${argv[i - 1]} için geçerli sayı gerekli`);
      t[map[argv[i - 1]]] = v;
    } else throw new Error('Bilinmeyen bayrak: ' + argv[i]);
  }
  return t;
}

function main() {
  let t;
  try { t = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  const m = measure();
  const r = evaluate(m, t);
  const g = (b) => (b == null ? '?' : (b / GB).toFixed(1));
  if (t.json) {
    console.log(JSON.stringify({ ok: r.ok, reasons: r.reasons, workers: r.workers, diskFreeGb: Number(g(m.diskFreeBytes)), memAvailGb: Number(g(m.memAvailBytes)), swapUsedGb: m.swapUsedBytes == null ? null : Number(g(m.swapUsedBytes)), thresholds: t }));
  } else {
    console.log(`disk ${g(m.diskFreeBytes)} GB, bellek ${g(m.memAvailBytes)} GB, takas ${g(m.swapUsedBytes)} GB`);
    console.log(r.ok ? `TAMAM: yeni ajan başlayabilir. Önerilen --workers=${r.workers}` : `BEKLE: ${r.reasons.join('; ')}. Önerilen --workers=${r.workers}`);
  }
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
