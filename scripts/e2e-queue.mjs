#!/usr/bin/env node
/**
 * E8Z: Playwright tek kuyruk. Aynı anda en fazla 1 Playwright tabanlı e2e süreci.
 *
 *   npm run e2e:queue -- npm run e2e:experiences -- --env local
 *
 * Mekanizma (dosya tabanlı; build/e2e/queue.lock + build/e2e/queue/<sıra>-<pid>.ticket):
 *  - Her çağrı bir FIFO bilet yazar (ad = zaman damgası + pid). Yalnız en baştaki bilet kilidi almayı dener.
 *  - Kilit `queue.lock` dosyasıdır, `wx` (özel oluşturma) ile alınır: iki süreç aynı anda alamaz.
 *  - Ölü sürece ait kilit/bilet (kill -0 ESRCH) baştaki süreç tarafından temizlenir.
 *  - WDP_E2E_WORKERS: scripts/resource-gate.mjs --workers varsa o; yoksa boş bellek/1.5 GB, en çok CPU, takas > 2 GB ise yarısı.
 * Mevcut run-*.mjs koşucuları değişmez; kuyruk bir sarmalayıcıdır. Yalnız yerel kullanım içindir.
 * Test için dizin: WDP_E2E_QUEUE_DIR.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GB = 1024 ** 3;

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Saf: boş bellek / takas / çekirdek -> işçi sayısı. */
export function computeWorkers({ freeBytes, cpus, swapUsedBytes = 0 }) {
  let w = Math.floor(freeBytes / (1.5 * GB));
  w = Math.min(w, Math.max(1, cpus));
  if (swapUsedBytes > 2 * GB) w = Math.floor(w / 2);
  return Math.max(1, w);
}

function darwinFree() {
  const r = spawnSync('vm_stat', { encoding: 'utf8' });
  if (r.status !== 0) return os.freemem();
  const page = Number((r.stdout.match(/page size of (\d+)/) || [])[1]) || 16384;
  const n = (label) => Number((r.stdout.match(new RegExp(`${label}:\\s+(\\d+)`)) || [])[1]) || 0;
  return (n('Pages free') + n('Pages inactive') + n('Pages speculative')) * page;
}

function swapUsed() {
  try {
    if (process.platform === 'darwin') {
      const r = spawnSync('sysctl', ['-n', 'vm.swapusage'], { encoding: 'utf8' });
      const m = r.stdout.match(/used = ([\d.]+)([MG])/);
      if (m) return Number(m[1]) * (m[2] === 'G' ? GB : GB / 1024);
    } else if (fs.existsSync('/proc/meminfo')) {
      const t = fs.readFileSync('/proc/meminfo', 'utf8');
      const kb = (k) => Number((t.match(new RegExp(`${k}:\\s+(\\d+)`)) || [])[1]) || 0;
      return (kb('SwapTotal') - kb('SwapFree')) * 1024;
    }
  } catch {
    /* ölçülemedi */
  }
  return 0;
}

export function resolveWorkers(root = ROOT) {
  const gate = path.join(root, 'scripts/resource-gate.mjs');
  if (fs.existsSync(gate)) {
    const r = spawnSync('node', [gate, '--workers'], { cwd: root, encoding: 'utf8', timeout: 20000 });
    if (r.status === 0) {
      const m = r.stdout.match(/workers\D{0,10}(\d+)/i) || r.stdout.match(/(\d+)\s*$/m);
      if (m && Number(m[1]) >= 1) return { workers: Number(m[1]), source: 'resource-gate' };
    }
  }
  const free = process.platform === 'darwin' ? darwinFree() : os.freemem();
  return { workers: computeWorkers({ freeBytes: free, cpus: os.cpus().length, swapUsedBytes: swapUsed() }), source: 'kendi hesap' };
}

/** Kuyruk nesnesi (test için dizin ve canlılık işlevi verilebilir). */
export function createQueue({ dir, pollMs = 500, alive = pidAlive, onWait = () => {} }) {
  const ticketsDir = path.join(dir, 'queue');
  const lockPath = path.join(dir, 'queue.lock');
  fs.mkdirSync(ticketsDir, { recursive: true });
  const me = process.pid;
  const ticketName = `${String(Date.now()).padStart(15, '0')}-${String(me).padStart(8, '0')}`;
  const ticketPath = path.join(ticketsDir, `${ticketName}.ticket`);
  let held = false;
  let enqueuedAt = 0;

  const listTickets = () => fs.readdirSync(ticketsDir).filter((f) => f.endsWith('.ticket')).sort();
  const pidOf = (name) => Number(name.split('-')[1]?.replace('.ticket', ''));

  function cleanup() {
    try {
      if (held) fs.rmSync(lockPath, { force: true });
    } catch {
      /* yut */
    }
    try {
      fs.rmSync(ticketPath, { force: true });
    } catch {
      /* yut */
    }
    held = false;
  }

  async function acquire() {
    enqueuedAt = Date.now();
    fs.writeFileSync(ticketPath, JSON.stringify({ pid: me, at: new Date().toISOString(), cmd: process.argv.slice(2).join(' ').slice(0, 200) }));
    let lastPos = -1;
    for (;;) {
      // Ölü bilet temizliği
      const tickets = listTickets();
      for (const t of tickets) {
        if (t !== `${ticketName}.ticket` && !alive(pidOf(t))) fs.rmSync(path.join(ticketsDir, t), { force: true });
      }
      const live = listTickets();
      const pos = live.indexOf(`${ticketName}.ticket`);
      if (pos === 0) {
        try {
          fs.writeFileSync(lockPath, JSON.stringify({ pid: me, at: new Date().toISOString() }), { flag: 'wx' });
          held = true;
          return { waitedMs: Date.now() - enqueuedAt };
        } catch (e) {
          if (e.code !== 'EEXIST') throw e;
          const lk = readJson(lockPath);
          if (!lk || !alive(lk.pid)) {
            // Ölü (ya da bozuk) kilit: yalnız baştaki süreç buraya gelir, güvenle sil.
            fs.rmSync(lockPath, { force: true });
            continue;
          }
        }
      }
      if (pos !== lastPos) {
        lastPos = pos;
        onWait(pos, live.length);
      }
      await sleep(pollMs);
    }
  }

  return { acquire, release: cleanup, ticketPath, lockPath };
}

async function main() {
  const cmd = process.argv.slice(2);
  if (!cmd.length) {
    console.error('Kullanım: npm run e2e:queue -- <komut…>   örn. npm run e2e:queue -- npm run e2e:experiences -- --env local');
    process.exit(2);
  }
  const dir = process.env.WDP_E2E_QUEUE_DIR || path.join(ROOT, 'build/e2e');
  fs.mkdirSync(dir, { recursive: true });
  const q = createQueue({
    dir,
    pollMs: Number(process.env.WDP_E2E_QUEUE_POLL_MS) || 500,
    onWait: (pos, total) => console.error(`[e2e:queue] sırada: ${pos < 0 ? '?' : pos + 1}/${total} (önde ${Math.max(0, pos)} iş bekliyor)`),
  });
  let child = null;
  const bye = (code) => {
    q.release();
    process.exit(code);
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
      if (child) child.kill(sig);
      else bye(130);
    });
  }
  process.on('exit', () => q.release());
  const { waitedMs } = await q.acquire();
  const { workers, source } = process.env.WDP_E2E_WORKERS ? { workers: Number(process.env.WDP_E2E_WORKERS), source: 'ortam' } : resolveWorkers();
  console.error(`[e2e:queue] sıra geldi; bekleme ${(waitedMs / 1000).toFixed(1)} sn; workers=${workers} (${source})`);
  child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: 'inherit', env: { ...process.env, WDP_E2E_WORKERS: String(workers) } });
  child.on('exit', (code, signal) => bye(code ?? (signal ? 1 : 0)));
  child.on('error', (e) => {
    console.error(`[e2e:queue] komut başlatılamadı: ${e.message}`);
    bye(127);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
