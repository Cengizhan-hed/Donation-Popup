/**
 * Aynı ortamda fixture meta yazan suite’ler için dosya kilidi.
 * Cihazlar salt okurken paralel; mutasyon sıraya girer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_DIR } from './run-io.mjs';

/**
 * @param {string} envId
 * @param {() => Promise<unknown>} fn
 */
export async function withEnvMutationLock(envId, fn) {
  const id = String(envId || 'local').replace(/[^a-z0-9._-]/gi, '') || 'local';
  fs.mkdirSync(CURRENT_DIR, { recursive: true });
  const lockPath = path.join(CURRENT_DIR, `.mut-${id}.lock`);
  const started = Date.now();
  let got = false;
  while (Date.now() - started < 600000) {
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
