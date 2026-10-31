import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { reservePort, pickFreePort, stopOwnListener } from '../../../tests/e2e/helpers/port-reserve.mjs';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-ports-'));
const noListen = () => [];

/** Ölü PID: kısa ömürlü süreç başlatıp bitmesini bekle. */
async function deadPid() {
  const c = spawn(process.execPath, ['-e', '0']);
  await new Promise((r) => c.once('exit', r));
  return c.pid;
}

describe('port rezervasyonu', () => {
  it('iki eszamanli talep farkli port alir', () => {
    const dir = tmpDir();
    // Biri 9500'u tutarken ikinci talep (farklı "süreç" PID'i) 9501'e gider.
    const a = pickFreePort(9500, { dir, listenPidsFn: noListen, pid: process.pid });
    const b = pickFreePort(9500, { dir, listenPidsFn: noListen, pid: process.ppid });
    assert.equal(a.port, 9500);
    assert.equal(b.port, 9501);
    assert.notEqual(a.port, b.port);
    a.release();
    b.release();
    assert.equal(fs.existsSync(path.join(dir, '9500.lock')), false);
  });

  it('canli baskasi kilidi tutuyorsa reddeder ve kimseyi oldurmez', () => {
    const dir = tmpDir();
    const killed = [];
    const a = reservePort(9510, { dir, listenPidsFn: noListen });
    assert.equal(a.ok, true);
    const b = reservePort(9510, { dir, listenPidsFn: () => [4242], killFn: (p) => killed.push(p), pid: process.ppid });
    assert.equal(b.ok, false);
    assert.deepEqual(killed, []);
    a.release();
  });

  it('kilitsiz ama baskasi dinliyorsa reddeder, PID oldurulmez', () => {
    const dir = tmpDir();
    const killed = [];
    const r = reservePort(9520, { dir, listenPidsFn: () => [4242], killFn: (p) => killed.push(p) });
    assert.equal(r.ok, false);
    assert.match(r.reason, /kapatılmaz/);
    assert.deepEqual(killed, []);
    assert.equal(fs.existsSync(path.join(dir, '9520.lock')), false);
  });

  it('bayat kilit (sahip olu) temizlenir; yalniz kendi yetim cocugu kapatilir', async () => {
    const dir = tmpDir();
    const dead = await deadPid();
    fs.writeFileSync(path.join(dir, '9530.lock'), JSON.stringify({ pid: dead, at: Date.now(), childPid: 7001 }));
    const killed = [];
    // Port 7001 (kendi yetimimiz) ve 7002 (yabancı) dinliyor: yalnız 7001 kapatılır.
    let calls = 0;
    const listen = () => (calls++ === 0 ? [7001, 7002] : [7002]);
    const r = reservePort(9530, { dir, listenPidsFn: listen, killFn: (p) => killed.push(p) });
    assert.deepEqual(killed, [7001]);
    assert.equal(r.ok, false); // 7002 hâlâ dinliyor: dokunma
    // Yetim yoksa bayat kilit sessizce alınır
    fs.writeFileSync(path.join(dir, '9531.lock'), JSON.stringify({ pid: dead, at: Date.now(), childPid: null }));
    const r2 = reservePort(9531, { dir, listenPidsFn: noListen, killFn: (p) => killed.push(p) });
    assert.equal(r2.ok, true);
    assert.deepEqual(killed, [7001]);
    r2.release();
  });

  it('sahibi CANLI olan 7 saatlik kilit bayat sayilmaz; sunucusu kapatilmaz', () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, '9550.lock'),
      JSON.stringify({ pid: process.pid, at: Date.now() - 7 * 3600 * 1000, childPid: 7003 })
    );
    const killed = [];
    const r = reservePort(9550, { dir, pid: process.ppid, listenPidsFn: () => [7003], killFn: (p) => killed.push(p) });
    assert.equal(r.ok, false);
    assert.deepEqual(killed, []);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '9550.lock'), 'utf8')).pid, process.pid);
  });

  it('canli sahip 25 saat ama port dinleniyor: yine bayat degil, kapatma yok', () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, '9551.lock'),
      JSON.stringify({ pid: process.pid, at: Date.now() - 25 * 3600 * 1000, childPid: 7004 })
    );
    const killed = [];
    const r = reservePort(9551, { dir, pid: process.ppid, listenPidsFn: () => [7004], killFn: (p) => killed.push(p) });
    assert.equal(r.ok, false);
    assert.deepEqual(killed, []);
  });

  it('canli sahip 25 saat ve dinleyici yok: kilit devralinir, kimse oldurulmez', () => {
    const dir = tmpDir();
    fs.writeFileSync(
      path.join(dir, '9552.lock'),
      JSON.stringify({ pid: process.pid, at: Date.now() - 25 * 3600 * 1000, childPid: 7005 })
    );
    const killed = [];
    const r = reservePort(9552, { dir, pid: process.ppid, listenPidsFn: noListen, killFn: (p) => killed.push(p) });
    assert.equal(r.ok, true);
    assert.deepEqual(killed, []);
    r.release();
  });

  it('bayat kilit yarisi: arada baska koşu taze kilit alirsa o kazanir, devralan geri cekilir', async () => {
    const dir = tmpDir();
    const dead = await deadPid();
    const lock = path.join(dir, '9560.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: dead, at: Date.now(), childPid: 7009 }));
    let b = null;
    let hook = true;
    // A kilidi rename ile devraldiktan sonra (orphan listen cagrisi) B bos dosyayi `wx` ile alir.
    const listenA = () => {
      if (hook) {
        hook = false;
        b = reservePort(9560, { dir, pid: process.ppid, listenPidsFn: noListen });
      }
      return [];
    };
    const a = reservePort(9560, { dir, pid: process.pid, listenPidsFn: listenA });
    const winners = [a, b].filter((x) => x && x.ok);
    assert.equal(winners.length, 1, 'tam bir kazanan');
    const cur = JSON.parse(fs.readFileSync(lock, 'utf8'));
    assert.equal(cur.pid, winners[0] === a ? process.pid : process.ppid);
    assert.deepEqual(
      fs.readdirSync(dir).filter((f) => f.includes('.stale.')),
      []
    );
    for (const w of winners) w.release();
  });

  it('bayat devralma artik dosya birakmaz', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '9561.lock'), JSON.stringify({ pid: 999999999, at: Date.now(), childPid: null }));
    const r = reservePort(9561, { dir, listenPidsFn: noListen });
    assert.equal(r.ok, true);
    assert.deepEqual(
      fs.readdirSync(dir).filter((f) => f.includes('.stale.')),
      []
    );
    r.release();
  });

  it('release yalniz kendi kilidini siler', () => {
    const dir = tmpDir();
    const a = reservePort(9540, { dir, listenPidsFn: noListen });
    fs.writeFileSync(path.join(dir, '9540.lock'), JSON.stringify({ pid: process.ppid, at: Date.now(), childPid: null }));
    a.release();
    assert.equal(fs.existsSync(path.join(dir, '9540.lock')), true);
  });

  it('stopOwnListener yalniz verilen PID icin sinyal gonderir', async () => {
    const sent = [];
    let alive = true;
    const listen = () => (alive ? [111, 222] : [222]);
    await stopOwnListener(9550, 111, {
      listenPidsFn: listen,
      killFn: (p, s) => {
        sent.push([p, s]);
        alive = false;
      },
    });
    assert.deepEqual(sent, [[111, 'SIGTERM']]);
    await stopOwnListener(9550, null, { listenPidsFn: listen, killFn: (p) => sent.push([p]) });
    assert.equal(sent.length, 1);
  });
});
