import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { killTree } from '../../../tests/e2e/helpers/server-cleanup.mjs';

const HELPERS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../e2e/helpers');
const hasPhp = spawnSync('php', ['-v']).status === 0;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

async function waitFor(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** Koşucu betiği: kilit al, `php -S` başlat (detached), temizliğe kaydet, PID bildir, sonra `mode`a göre bit. */
function runnerSource(port, lockDir, docroot, mode) {
  return `
import { spawn } from 'node:child_process';
import { reservePort } from ${JSON.stringify(path.join(HELPERS, 'port-reserve.mjs'))};
import { registerServerCleanup } from ${JSON.stringify(path.join(HELPERS, 'server-cleanup.mjs'))};
const r = reservePort(${port}, { dir: ${JSON.stringify(lockDir)} });
if (!r.ok) { console.log('RESERVE_FAIL'); process.exit(3); }
const child = spawn('php', ['-S', '127.0.0.1:${port}', '-t', ${JSON.stringify(docroot)}], { detached: true, stdio: 'ignore' });
r.setChild(child.pid);
registerServerCleanup({ pid: () => (child.exitCode == null ? child.pid : null), release: () => r.release() });
console.log('PID ' + child.pid);
const mode = ${JSON.stringify(mode)};
if (mode === 'throw') setTimeout(() => { throw new Error('boom'); }, 700);
else if (mode === 'normal') setTimeout(() => process.exit(0), 700);
else setInterval(() => {}, 1000);
`;
}

async function launch(mode, port, lockDir, docroot, scratch) {
  const file = path.join(scratch, `runner-${mode}.mjs`);
  fs.writeFileSync(file, runnerSource(port, lockDir, docroot, mode));
  const proc = spawn(process.execPath, [file], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  proc.stdout.on('data', (d) => {
    out += d;
  });
  const exited = new Promise((r) => proc.once('exit', (code, sig) => r({ code, sig })));
  assert.ok(await waitFor(() => /PID \d+/.test(out)), 'koşucu PID bildirmedi');
  const pid = Number(/PID (\d+)/.exec(out)[1]);
  assert.ok(await waitFor(() => !!listening(port)), 'php dinlemiyor');
  return { proc, pid, exited };
}

function listening(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  return String(r.stdout || '').trim();
}

describe('yetim php -S temizliği', { skip: !hasPhp }, () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-cleanup-'));
  const docroot = path.join(scratch, 'www');
  fs.mkdirSync(docroot);
  fs.writeFileSync(path.join(docroot, 'index.php'), '<?php echo "ok";');

  for (const mode of ['normal', 'throw', 'sigterm', 'sigint']) {
    it(`${mode}: sunucu kapanır, port ve kilit serbest`, async () => {
      const port = await freePort();
      const lockDir = path.join(scratch, `locks-${mode}`);
      const { proc, pid, exited } = await launch(mode, port, lockDir, docroot, scratch);
      assert.equal(fs.existsSync(path.join(lockDir, `${port}.lock`)), true);
      if (mode === 'sigterm') proc.kill('SIGTERM');
      if (mode === 'sigint') proc.kill('SIGINT');
      await exited;
      assert.ok(await waitFor(() => !alive(pid)), `php PID ${pid} yaşıyor`);
      assert.equal(listening(port), '', 'port hâlâ dinleniyor');
      assert.equal(fs.existsSync(path.join(lockDir, `${port}.lock`)), false, 'kilit kaldı');
    });
  }

  it('art arda iki koşu aynı portta elle temizlik olmadan geçer', async () => {
    const port = await freePort();
    const lockDir = path.join(scratch, 'locks-seq');
    for (let i = 0; i < 2; i += 1) {
      const { proc, exited } = await launch('hang', port, lockDir, docroot, scratch);
      proc.kill('SIGTERM');
      await exited;
      assert.ok(await waitFor(() => listening(port) === ''));
    }
  });
});

describe('killTree', () => {
  it('geçersiz PID ve ESRCH sessiz', () => {
    killTree(0);
    killTree(1);
    killTree(2 ** 22 + 12345, 'SIGKILL', () => {
      const e = new Error('x');
      e.code = 'ESRCH';
      throw e;
    });
  });
  it('önce grubu dener', () => {
    const calls = [];
    killTree(4321, 'SIGTERM', (p, s) => calls.push([p, s]));
    assert.deepEqual(calls, [[-4321, 'SIGTERM']]);
  });
});
