/**
 * Aynı ortamda fixture meta yazan suite’ler için dosya kilidi.
 * Senaryo başına alınır. Cihazlar salt okurken paralel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_DIR } from './run-io.mjs';
import { resolveProfileId } from './profile.mjs';

let abortWait = false;

export function abortMutationLockWait() {
  abortWait = true;
}

export function resetMutationLockAbort() {
  abortWait = false;
}

/**
 * @param {string} envId
 * @param {() => Promise<unknown>} fn
 */
export async function withEnvMutationLock(envId, fn) {
  const id = resolveProfileId(envId) || 'local';
  fs.mkdirSync(CURRENT_DIR, { recursive: true });
  const lockPath = path.join(CURRENT_DIR, `.mut-${id}.lock`);
  const started = Date.now();
  let got = false;
  while (Date.now() - started < 600000) {
    if (abortWait) {
      throw new Error(`mutasyon kilidi iptal (${id})`);
    }
    try {
      fs.writeFileSync(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
      got = true;
      break;
    } catch (e) {
      if (e && e.code !== 'EEXIST') throw e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!got) {
    throw new Error(`mutasyon kilidi alınamadı (${id})`);
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch (e) {
      if (e && e.code !== 'ENOENT') {
        console.error(`[e2e:catch-fail] mutation-lock: ${e.message || e}`);
      }
    }
  }
}
