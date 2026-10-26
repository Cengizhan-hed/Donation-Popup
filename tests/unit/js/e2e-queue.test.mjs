/**
 * E8Z: e2e kuyruğu — FIFO, ölü kilit temizliği, işçi sayısı hesabı. Yalnız yerel dosya sistemi (geçici dizin).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { computeWorkers, createQueue, pidAlive } from '../../../scripts/e2e-queue.mjs';

const QUEUE = path.resolve(import.meta.dirname, '../../../scripts/e2e-queue.mjs');
const GB = 1024 ** 3;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-queue-'));
}

function runQueued(dir, logFile, label, holdMs) {
  const code = `const fs=require('fs');fs.appendFileSync(${JSON.stringify(logFile)},'start-${label}:'+Date.now()+'\\n');setTimeout(()=>{fs.appendFileSync(${JSON.stringify(logFile)},'end-${label}:'+Date.now()+'\\n')},${holdMs});`;
  const child = spawn('node', [QUEUE, 'node', '-e', code], {
    env: { ...process.env, WDP_E2E_QUEUE_DIR: dir, WDP_E2E_QUEUE_POLL_MS: '50', WDP_E2E_WORKERS: '1' },
    stdio: 'ignore',
  });
  return new Promise((resolve) => child.on('exit', (c) => resolve(c)));
}

describe('e2e:queue', () => {
  it('iki süreç: ikincisi birincisi bitince başlar (tek Playwright süreci)', async () => {
    const dir = tmpDir();
    const log = path.join(dir, 'log.txt');
    const a = runQueued(dir, log, 'A', 700);
    await new Promise((r) => setTimeout(r, 250));
    const b = runQueued(dir, log, 'B', 100);
    const codes = await Promise.all([a, b]);
    assert.deepEqual(codes, [0, 0]);
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    const t = Object.fromEntries(lines.map((l) => l.split(':')));
    assert.ok(Number(t['start-B']) >= Number(t['end-A']), 'B, A bitmeden başlamamalı');
    assert.ok(!fs.existsSync(path.join(dir, 'queue.lock')), 'kilit bırakılmalı');
    assert.equal(fs.readdirSync(path.join(dir, 'queue')).length, 0, 'bilet kalmamalı');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('çıkış kodu alt komuttan aktarılır', () => {
    const dir = tmpDir();
    const r = spawnSync('node', [QUEUE, 'node', '-e', 'process.exit(3)'], {
      env: { ...process.env, WDP_E2E_QUEUE_DIR: dir, WDP_E2E_WORKERS: '1' },
      encoding: 'utf8',
    });
    assert.equal(r.status, 3);
    assert.match(r.stderr, /bekleme .* sn; workers=1/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ölü sürece ait kilit ve bilet temizlenir', async () => {
    const dir = tmpDir();
    const dead = spawnSync('node', ['-e', '0']);
    assert.equal(dead.status, 0);
    // Bitmiş bir sürecin pid'sini bulmak için kısa ömürlü çocuk
    const c = spawn('node', ['-e', 'setTimeout(()=>{},10)']);
    const deadPid = c.pid;
    await new Promise((r) => c.on('exit', r));
    assert.equal(pidAlive(deadPid), false);
    fs.mkdirSync(path.join(dir, 'queue'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'queue.lock'), JSON.stringify({ pid: deadPid }));
    fs.writeFileSync(path.join(dir, 'queue', `000000000000001-${String(deadPid).padStart(8, '0')}.ticket`), '{}');
    const q = createQueue({ dir, pollMs: 20 });
    const { waitedMs } = await q.acquire();
    assert.ok(waitedMs < 3000);
    const lock = JSON.parse(fs.readFileSync(path.join(dir, 'queue.lock'), 'utf8'));
    assert.equal(lock.pid, process.pid);
    q.release();
    assert.ok(!fs.existsSync(path.join(dir, 'queue.lock')));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('bozuk kilit dosyası da temizlenir', async () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'queue.lock'), 'bozuk');
    const q = createQueue({ dir, pollMs: 20 });
    await q.acquire();
    q.release();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('e2e:queue işçi sayısı', () => {
  it('boş bellek / 1.5 GB, çekirdekle sınırlı, en az 1', () => {
    assert.equal(computeWorkers({ freeBytes: 12 * GB, cpus: 4 }), 4);
    assert.equal(computeWorkers({ freeBytes: 6 * GB, cpus: 10 }), 4);
    assert.equal(computeWorkers({ freeBytes: 1 * GB, cpus: 8 }), 1);
  });
  it('takas > 2 GB ise yarıya iner', () => {
    assert.equal(computeWorkers({ freeBytes: 12 * GB, cpus: 8, swapUsedBytes: 3 * GB }), 4);
    assert.equal(computeWorkers({ freeBytes: 3 * GB, cpus: 8, swapUsedBytes: 3 * GB }), 1);
  });
});
