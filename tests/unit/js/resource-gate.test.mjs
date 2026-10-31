/**
 * scripts/resource-gate.mjs: komut çıktısı ayrıştırma ve eşik değerlendirmesi (sahte değerler).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVmStat, parseSwapUsage, parseDfFree, evaluate, suggestWorkers, parseArgs } from '../../../scripts/resource-gate.mjs';

const GB = 1024 ** 3;
const VM = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               100000.
Pages active:                             500000.
Pages inactive:                           200000.
Pages speculative:                         50000.
Pages wired down:                         300000.
`;

test('vm_stat: kullanılabilir = free + inactive + speculative', () => {
  const r = parseVmStat(VM);
  assert.equal(r.pageSize, 16384);
  assert.equal(r.availableBytes, 350000 * 16384);
});

test('vm.swapusage ayrıştırma', () => {
  const r = parseSwapUsage('vm.swapusage: total = 4096.00M  used = 1536.50M  free = 2559.50M  (encrypted)');
  assert.equal(Math.round(r.usedBytes / 1024 ** 2), 1537);
  assert.equal(r.totalBytes, 4096 * 1024 ** 2);
});

test('df -k ayrıştırma (Available sütunu)', () => {
  const out = 'Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on\n/dev/disk3s5 239362496 179000000 26214400 88% 3362221 262144000 1% /System/Volumes/Data\n';
  assert.equal(parseDfFree(out), 26214400 * 1024);
});

test('eşikler: hepsi uygunsa 0, ihlalde neden listesi', () => {
  const ok = evaluate({ diskFreeBytes: 30 * GB, memAvailBytes: 6 * GB, swapUsedBytes: 0.5 * GB, cpus: 8 }, { minDiskGb: 20, minFreeMemGb: 4, maxSwapGb: 2 });
  assert.equal(ok.ok, true);
  const bad = evaluate({ diskFreeBytes: 10 * GB, memAvailBytes: 1 * GB, swapUsedBytes: 3 * GB, cpus: 8 }, { minDiskGb: 20, minFreeMemGb: 4, maxSwapGb: 2 });
  assert.equal(bad.ok, false);
  assert.equal(bad.reasons.length, 3);
  assert.equal(bad.workers, 1);
});

test('worker önerisi: takas yüksekse düşer, bellek ve CPU ile sınırlı', () => {
  assert.equal(suggestWorkers({ memAvailBytes: 16 * GB, swapUsedBytes: 0, cpus: 8 }), 4);
  assert.equal(suggestWorkers({ memAvailBytes: 16 * GB, swapUsedBytes: 1.2 * GB, cpus: 8 }), 3);
  assert.equal(suggestWorkers({ memAvailBytes: 16 * GB, swapUsedBytes: 2.5 * GB, cpus: 8 }), 1);
  assert.equal(suggestWorkers({ memAvailBytes: 3 * GB, swapUsedBytes: 0, cpus: 8 }), 2);
});

test('bayraklar ve env; bilinmeyen bayrak hata verir', () => {
  const t = parseArgs(['--min-disk-gb', '5', '--json'], { WDP_GATE_MIN_FREE_MEM_GB: '8' });
  assert.equal(t.minDiskGb, 5);
  assert.equal(t.minFreeMemGb, 8);
  assert.equal(t.maxSwapGb, 2);
  assert.equal(t.json, true);
  assert.throws(() => parseArgs(['--x']));
});
