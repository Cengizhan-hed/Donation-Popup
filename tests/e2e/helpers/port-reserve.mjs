// e2e PHP sunucu portu rezervasyonu: port başına kilit dosyası `<ana depo>/build/e2e/ports/<port>.lock`.
// Amaç: farklı ajan/worktree koşuları aynı portta birbirinin sunucusunu KAPATMASIN.
// Kurallar: yalnız KENDİ başlattığımız PID kapatılır; başka süreçle dolu port için kapatma yok (boş port seç/hata).
// pkill/killall/ad eşleşmeli öldürme yok. Bayat kilit: yalnız sahip PID ölü, ya da sahip canlı + kilit > 24 sa + port dinleyicisi yok. Canlı sahibin sunucusu ASLA kapatılmaz.
// Bayat kilit devralma atomik: rename (tek kazanan) + içerik doğrulama + `wx` ile yeniden alma + kazanan doğrulama.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './env-root.mjs';
import { pidAlive } from './file-lock.mjs';

/**
 * Worktree'ler arasında paylaşılan kilit klasörü (ana deponun build/e2e/ports). Git yoksa/yanıtsızsa ROOT.
 * WDP_PORT_LOCK_DIR ile geçersiz kılınır.
 * @returns {string}
 */
export function defaultPortLockDir() {
  const env = String(process.env.WDP_PORT_LOCK_DIR || '').trim();
  if (env) return env;
  try {
    const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 5000,
    });
    const common = String(r.stdout || '').trim();
    if (r.status === 0 && common) return path.join(path.dirname(common), 'build/e2e/ports');
  } catch {
    /* ROOT'a düş */
  }
  return path.join(ROOT, 'build/e2e/ports');
}

/**
 * @param {number} port
 * @returns {number[]}
 */
export function listenPids(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  return String(r.stdout || '')
    .trim()
    .split(/\s+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 1);
}

/** @param {string} file @returns {string | null} */
function readRaw(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** @param {string | null} raw */
function parseLock(raw) {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {string} file */
function readLock(file) {
  return parseLock(readRaw(file));
}

/**
 * Bayatlık: sahip ÖLÜ (PID yok) ya da sahip canlı ama kilit çok eski (longMs) VE port dinleyicisi yok.
 * Canlı sahibin sunucusu dinliyorsa kilit asla bayat sayılmaz. Yarım yazılmış kilit: 5 sn sonra bayat.
 */
function lockIsStale(cur, file, longMs, port, listen) {
  if (cur && Number.isInteger(cur.pid)) {
    if (!pidAlive(cur.pid)) return true;
    const age = Date.now() - Number(cur.at || 0);
    return age > longMs && listen(port).length === 0;
  }
  try {
    return Date.now() - fs.statSync(file).mtimeMs > 5000;
  } catch {
    return false;
  }
}

/**
 * @typedef {{
 *   ok: true, port: number, file: string,
 *   setChild: (pid: number | null) => void,
 *   release: () => void,
 * } | { ok: false, port: number, reason: string, holderPid?: number }} Reservation
 */

/**
 * Port için kilidi almayı dener; asla başkasının sürecini kapatmaz.
 * - Kilit canlı başka PID'de → ok:false.
 * - Kilit bayat (sahip ölü) ve kaydedilmiş çocuk PID hâlâ bu portu dinliyorsa → o KENDİ yetim sunucumuz: yalnız o PID kapatılır.
 * - Kilit yok/bayat ama port başka bir süreç tarafından dinleniyorsa → ok:false (kapatma yok).
 * @param {number} port
 * @param {{ dir?: string, longMs?: number, listenPidsFn?: (p: number) => number[], killFn?: (pid: number, sig: string) => void, pid?: number }} [opts]
 * @returns {Reservation}
 */
export function reservePort(port, opts = {}) {
  const dir = opts.dir || defaultPortLockDir();
  const longMs = opts.longMs ?? 24 * 3600 * 1000;
  const listen = opts.listenPidsFn || listenPids;
  const kill = opts.killFn || ((pid, sig) => process.kill(pid, sig));
  const me = opts.pid || process.pid;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${port}.lock`);

  const mine = JSON.stringify({ pid: me, at: Date.now(), childPid: null });
  let acquired = false;
  for (let attempt = 0; attempt < 5 && !acquired; attempt += 1) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, mine);
      fs.closeSync(fd);
      acquired = true;
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw e;
      const raw = readRaw(file);
      if (raw === null) continue; // arada silindi: yeniden dene
      const cur = parseLock(raw);
      if (!lockIsStale(cur, file, longMs, port, listen)) {
        return { ok: false, port, reason: `port ${port} başka bir koşu tarafından rezerve (PID ${cur?.pid ?? '?'})`, holderPid: cur?.pid };
      }
      // Atomik devralma: kilidi benzersiz ada rename et (yalnız bir koşu başarır); sonra içeriği doğrula.
      const aside = `${file}.stale.${me}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      try {
        fs.renameSync(file, aside);
      } catch (err) {
        if (err && err.code === 'ENOENT') continue; // başkası önce devraldı
        throw err;
      }
      const taken = readRaw(aside);
      if (taken !== raw) {
        // Okuma ile rename arasında kilit değişti (başkası taze kilit almış): geri koy, silme.
        try {
          fs.linkSync(aside, file);
        } catch {
          /* dosya yeniden oluşmuş: taze kilit sahibi kazandı */
        }
        fs.rmSync(aside, { force: true });
        continue;
      }
      // Yalnız ölü sahibin KENDİ yetim çocuğu hâlâ bu portu dinliyorsa kapat (canlı sahibin sunucusuna dokunulmaz).
      const orphan = Number(cur?.childPid);
      if (!pidAlive(Number(cur?.pid)) && Number.isInteger(orphan) && orphan > 1 && listen(port).includes(orphan)) {
        try {
          kill(orphan, 'SIGTERM');
        } catch (err2) {
          if (err2 && err2.code !== 'ESRCH') throw err2;
        }
      }
      fs.rmSync(aside, { force: true });
    }
  }
  // Kazananı doğrula: dosyada bizim PID'imiz yoksa kilit bizim değil.
  if (!acquired || readLock(file)?.pid !== me) return { ok: false, port, reason: `port ${port} kilidi alınamadı` };

  const foreign = listen(port);
  if (foreign.length) {
    // Dinleyen biri var ve kilidi biz yeni aldık: sahibi bilinmiyor → dokunma.
    fs.rmSync(file, { force: true });
    return { ok: false, port, reason: `port ${port} başka bir süreç tarafından dinleniyor (PID ${foreign.join(',')}); kapatılmaz`, holderPid: foreign[0] };
  }

  let released = false;
  return {
    ok: true,
    port,
    file,
    setChild(childPid) {
      const cur = readLock(file);
      if (!cur || cur.pid !== me) return;
      fs.writeFileSync(file, JSON.stringify({ ...cur, childPid: childPid ?? null }));
    },
    release() {
      if (released) return;
      released = true;
      const cur = readLock(file);
      if (cur && cur.pid === me) fs.rmSync(file, { force: true });
    },
  };
}

/**
 * `preferred` doluysa sıradaki boş portu rezerve eder (en fazla `span` deneme).
 * @param {number} preferred
 * @param {Parameters<typeof reservePort>[1] & { span?: number }} [opts]
 * @returns {Extract<Reservation, { ok: true }>}
 */
export function pickFreePort(preferred, opts = {}) {
  const span = opts.span ?? 50;
  for (let i = 0; i < span; i += 1) {
    const r = reservePort(preferred + i, opts);
    if (r.ok) return r;
  }
  throw new Error(`boş port bulunamadı (${preferred}..${preferred + span - 1})`);
}

/**
 * YALNIZ verilen (kendi başlattığımız) PID'yi kapatır; port hâlâ başkasınca dinleniyorsa dokunmaz.
 * @param {number} port
 * @param {number | null | undefined} ownPid
 * @param {{ timeoutMs?: number, listenPidsFn?: (p: number) => number[], killFn?: (pid: number, sig: string) => void }} [opts]
 */
export async function stopOwnListener(port, ownPid, opts = {}) {
  const listen = opts.listenPidsFn || listenPids;
  const kill = opts.killFn || ((pid, sig) => process.kill(pid, sig));
  const timeoutMs = opts.timeoutMs ?? 3000;
  if (!Number.isInteger(ownPid) || ownPid <= 1) return;
  const t0 = Date.now();
  const send = (sig) => {
    try {
      kill(ownPid, sig);
    } catch (e) {
      if (e && e.code !== 'ESRCH') throw e;
    }
  };
  send('SIGTERM');
  while (Date.now() - t0 < timeoutMs) {
    if (!listen(port).includes(ownPid) && !pidAlive(ownPid)) return;
    if (!listen(port).includes(ownPid)) return;
    if (Date.now() - t0 > 1500) send('SIGKILL');
    await new Promise((r) => setTimeout(r, 40));
  }
  if (listen(port).includes(ownPid)) throw new Error(`kendi PHP sunucum (PID ${ownPid}) port ${port} üzerinde kapanmadı`);
}
