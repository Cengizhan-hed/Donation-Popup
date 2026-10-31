// Koşucunun KENDİ başlattığı PHP sunucularını her çıkış yolunda kapatır (yetim `php -S` kalmaz).
// Kapsam: normal bitiş ('exit'), SIGINT/SIGTERM/SIGHUP, uncaughtException/unhandledRejection.
// Yalnız kayıtlı PID'ler (ve onların süreç grubu) kapatılır; ad eşleşmeli öldürme yok.
// Kilit dosyası (port-reserve release) aynı anda bırakılır.

/** @type {Set<{ pid: () => number | null | undefined, release: () => void }>} */
const entries = new Set();
let installed = false;
let cleaning = false;

/**
 * PID'nin süreç grubunu (detached çocuk grup lideridir; php -S işçileri dahil), olmazsa yalnız PID'yi öldürür.
 * @param {number} pid
 * @param {string} [sig]
 * @param {(pid: number, sig: string) => void} [killFn]
 */
export function killTree(pid, sig = 'SIGKILL', killFn = (p, s) => process.kill(p, s)) {
  if (!Number.isInteger(pid) || pid <= 1) return;
  try {
    killFn(-pid, sig);
    return;
  } catch (e) {
    if (e && e.code !== 'ESRCH' && e.code !== 'EPERM') throw e;
  }
  try {
    killFn(pid, sig);
  } catch (e) {
    if (e && e.code !== 'ESRCH') throw e;
  }
}

/** Kayıtlı tüm sunucuları eşzamanlı (sync) kapatır ve kilitleri bırakır. */
export function cleanupAllSync() {
  if (cleaning) return;
  cleaning = true;
  try {
    for (const e of [...entries]) {
      try {
        const pid = e.pid();
        if (pid) killTree(pid, 'SIGKILL');
      } catch {
        /* sıradakine geç */
      }
      try {
        e.release();
      } catch {
        /* kilit zaten yok */
      }
      entries.delete(e);
    }
  } finally {
    cleaning = false;
  }
}

function install() {
  if (installed) return;
  installed = true;
  process.on('exit', cleanupAllSync);
  const codes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  for (const [sig, code] of Object.entries(codes)) {
    process.on(sig, () => {
      cleanupAllSync();
      process.exit(code);
    });
  }
  process.on('uncaughtException', (err) => {
    cleanupAllSync();
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    cleanupAllSync();
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

/**
 * @param {{ pid: () => number | null | undefined, release: () => void }} entry
 * @returns {() => void} kaydı kaldırır (normal stop() sonrası)
 */
export function registerServerCleanup(entry) {
  install();
  entries.add(entry);
  return () => {
    entries.delete(entry);
  };
}

export function registeredCount() {
  return entries.size;
}
