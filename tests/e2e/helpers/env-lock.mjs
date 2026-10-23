/**
 * Ortam koşu kilidi: aynı profilde aynı anda iki koşu yok.
 * Farklı ortamlar paralel olabilir. Ölü pid temizlenir.
 * run-full çocukları ebeveyn kilidini paylaşır (WDP_E2E_ENV_LOCK_*).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { lockFilePath, requireProfileId } from './e2e-paths.mjs';

/** @type {string|null} */
let lockDirOverride = null;
/** @type {Set<string>} */
const ownedLocks = new Set();
let exitHook = false;

function installExitHook() {
  if (exitHook) return;
  exitHook = true;
  process.on('exit', () => {
    for (const file of ownedLocks) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* süreç kapanırken kilit dosyası kalabilir */
      }
    }
  });
}

export function setLockDirForTest(dir) {
  lockDirOverride = dir ? String(dir) : null;
}

export function resetLockTestHooks() {
  lockDirOverride = null;
}

export function isPidAlive(pid) {
  const n = Math.abs(Number.parseInt(String(pid), 10) || 0);
  if (n <= 1) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (e) {
    return !!(e && e.code === 'EPERM');
  }
}

function lockPath(envId) {
  if (lockDirOverride) {
    return path.join(lockDirOverride, `${requireProfileId(envId)}.lock`);
  }
  return lockFilePath(envId);
}

function readLock(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      pid: Math.abs(Number.parseInt(String(parsed.pid), 10) || 0),
      startedAt: String(parsed.startedAt || ''),
      command: String(parsed.command || ''),
      runId: String(parsed.runId || ''),
    };
  } catch {
    return null;
  }
}

function sharedOwnerPid() {
  if (String(process.env.WDP_E2E_ENV_LOCK_SHARED || '') !== '1') return 0;
  return Math.abs(Number.parseInt(String(process.env.WDP_E2E_ENV_LOCK_PID || ''), 10) || 0);
}

/**
 * @param {string} envId
 * @param {{ command?: string, runId?: string, shared?: boolean }} [opts]
 * @returns {{ path: string, shared: boolean, pid: number, envId: string }}
 */
export function acquireEnvLock(envId, opts = {}) {
  const id = requireProfileId(envId);
  const file = lockPath(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const owner = opts.shared === true ? process.pid : sharedOwnerPid();
  const wantShared = opts.shared === true || owner > 0;

  if (fs.existsSync(file)) {
    const cur = readLock(file);
    if (cur && isPidAlive(cur.pid)) {
      const childShare =
        wantShared &&
        cur.pid !== process.pid &&
        (cur.pid === owner || cur.pid === process.ppid);
      if (childShare) {
        return { path: file, shared: true, pid: cur.pid, envId: id };
      }
      throw new Error(
        `ENV-LOCK: ${id} zaten çalışıyor (pid=${cur.pid} command=${cur.command || '?'})`
      );
    }
    try {
      fs.unlinkSync(file);
    } catch (e) {
      if (!e || e.code !== 'ENOENT') throw e;
    }
  }

  const payload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    command: String(opts.command || ''),
    runId: String(opts.runId || ''),
    root: ROOT,
  };
  try {
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', { flag: 'wx' });
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      const cur = readLock(file);
      if (cur && isPidAlive(cur.pid)) {
        throw new Error(`ENV-LOCK: ${id} zaten çalışıyor (pid=${cur.pid})`);
      }
      throw new Error(`ENV-LOCK: ${id} alınamadı (${e.message || e})`);
    }
    throw e;
  }
  process.env.WDP_E2E_ENV_LOCK_SHARED = '1';
  process.env.WDP_E2E_ENV_LOCK_PID = String(process.pid);
  process.env.WDP_E2E_PROFILE_ID = id;
  ownedLocks.add(file);
  installExitHook();
  return { path: file, shared: false, pid: process.pid, envId: id };
}

/**
 * @param {{ path: string, shared?: boolean }|null|undefined} handle
 */
export function releaseEnvLock(handle) {
  if (!handle || handle.shared) return;
  ownedLocks.delete(handle.path);
  try {
    fs.unlinkSync(handle.path);
  } catch (e) {
    if (!e || e.code !== 'ENOENT') throw e;
  }
}

/**
 * @param {string} envId
 * @param {() => Promise<unknown>|unknown} fn
 * @param {{ command?: string, runId?: string }} [opts]
 */
export async function withEnvRunLock(envId, fn, opts = {}) {
  const handle = acquireEnvLock(envId, opts);
  try {
    return await fn(handle);
  } finally {
    releaseEnvLock(handle);
  }
}
