import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withFileLockSync } from '../../../tests/e2e/helpers/file-lock.mjs';

const LOCK_MOD = fileURLToPath(new URL('../../../tests/e2e/helpers/file-lock.mjs', import.meta.url));
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-lock-')), 'x.lock');
const quiet = { log: () => {} };

describe('withFileLockSync', () => {
  it('kilidi alir, calistirir ve birakir', () => {
    const f = tmp();
    const out = withFileLockSync(f, () => {
      assert.ok(fs.existsSync(f));
      return 7;
    }, quiet);
    assert.equal(out, 7);
    assert.equal(fs.existsSync(f), false);
  });

  it('hata olsa da kilidi birakir', () => {
    const f = tmp();
    assert.throws(() => withFileLockSync(f, () => { throw new Error('x'); }, quiet), /x/);
    assert.equal(fs.existsSync(f), false);
  });

  it('olu PID kilidini bayat sayip temizler', () => {
    const f = tmp();
    fs.writeFileSync(f, JSON.stringify({ pid: 2147483646, at: Date.now() }));
    assert.equal(withFileLockSync(f, () => 'ok', quiet), 'ok');
  });

  it('eski zaman damgali canli PID kilidini bayat sayar', () => {
    const f = tmp();
    fs.writeFileSync(f, JSON.stringify({ pid: process.pid, at: Date.now() - 10000 }));
    assert.equal(withFileLockSync(f, () => 'ok', { ...quiet, staleMs: 1000 }), 'ok');
  });

  it('tutulan kilitte zaman asimi net mesajla hata verir', () => {
    const f = tmp();
    fs.writeFileSync(f, JSON.stringify({ pid: process.pid, at: Date.now() }));
    assert.throws(
      () => withFileLockSync(f, () => 1, { ...quiet, timeoutMs: 300, pollMs: 50, label: 'deneme' }),
      /Kilit zaman a.ımı.*deneme/,
    );
    assert.ok(fs.existsSync(f), 'baskasinin kilidi silinmemeli');
  });

  it('paralel iki surec: ikincisi bekler, bolumler ust uste binmez', async () => {
    const f = tmp();
    const log = `${f}.log`;
    const code = `
      import { withFileLockSync } from ${JSON.stringify(LOCK_MOD)};
      import fs from 'node:fs';
      withFileLockSync(${JSON.stringify(f)}, () => {
        fs.appendFileSync(${JSON.stringify(log)}, 'in:' + process.argv[1] + '\\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
        fs.appendFileSync(${JSON.stringify(log)}, 'out:' + process.argv[1] + '\\n');
      }, { log: () => {} });
    `;
    const run = (id) =>
      new Promise((resolve, reject) => {
        const p = spawn(process.execPath, ['--input-type=module', '-e', code, id], { stdio: 'inherit' });
        p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`cikis ${c}`))));
      });
    await Promise.all([run('a'), run('b')]);
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.equal(lines.length, 4);
    assert.equal(lines[0].replace('in:', ''), lines[1].replace('out:', ''));
    assert.equal(fs.existsSync(f), false);
  });
});
