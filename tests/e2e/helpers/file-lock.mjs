// Küçük, bağımlılıksız dosya kilidi (eşzamanlı e2e koşularının ortak kurulum adımı için).
// `wx` bayrağıyla atomik oluşturma; içerik: süreç kimliği + zaman. Bayat kilit: ölü PID veya yaş > staleMs.
import fs from 'node:fs';

/** @param {number} ms */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** @param {number} pid */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return Boolean(e) && e.code === 'EPERM';
  }
}

/** @param {string} file @param {number} staleMs */
function isStale(file, staleMs) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return false; // okunamadı: yeni oluşturuldu ya da silindi; yeniden dene
  }
  let info = null;
  try {
    info = JSON.parse(raw);
  } catch {
    info = null;
  }
  if (info && Number.isInteger(info.pid)) {
    if (!pidAlive(info.pid)) return true;
    return Date.now() - Number(info.at || 0) > staleMs;
  }
  // Yarım yazılmış kilit: yaşına bak
  try {
    return Date.now() - fs.statSync(file).mtimeMs > 5000;
  } catch {
    return false;
  }
}

/**
 * Kilidi alır, fn'i çalıştırır, her durumda (hata/SIGINT/SIGTERM dahil) bırakır. Eşzamanlı.
 * @template T
 * @param {string} file
 * @param {() => T} fn
 * @param {{ timeoutMs?: number, staleMs?: number, pollMs?: number, label?: string, log?: (m: string) => void }} [opts]
 * @returns {T}
 */
export function withFileLockSync(file, fn, opts = {}) {
  const {
    timeoutMs = 600000,
    staleMs = 900000,
    pollMs = 200,
    label = file,
    log = (m) => process.stderr.write(`${m}\n`),
  } = opts;
  const started = Date.now();
  let announced = false;
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      fs.closeSync(fd);
      break;
    } catch (e) {
      if (!e || e.code !== 'EEXIST') throw e;
      if (isStale(file, staleMs)) {
        fs.rmSync(file, { force: true });
        continue;
      }
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          `Kilit zaman aşımı (${Math.round(timeoutMs / 1000)} sn): ${label} başka bir koşu tarafından tutuluyor (${file}). Koşu gerçekten yoksa dosyayı silin.`,
        );
      }
      if (!announced) {
        announced = true;
        log(`[kilit] ${label}: başka bir koşunun bitmesi bekleniyor…`);
      }
      sleepSync(pollMs);
    }
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (cur.pid !== process.pid) return;
    } catch {
      return;
    }
    fs.rmSync(file, { force: true });
  };
  const onInt = () => {
    release();
    process.exit(130);
  };
  const onTerm = () => {
    release();
    process.exit(143);
  };
  process.on('exit', release);
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  try {
    return fn();
  } finally {
    release();
    process.removeListener('exit', release);
    process.removeListener('SIGINT', onInt);
    process.removeListener('SIGTERM', onTerm);
  }
}
