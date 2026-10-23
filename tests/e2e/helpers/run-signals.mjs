/**
 * e2e:full / capture SIGTERM-SIGINT: tarayıcı kapat, kilit bırak, süreç çıksın.
 */
import { abortMutationLockWait } from './mutation-lock.mjs';

/**
 * @param {{ close?: () => Promise<unknown> }[]} handles
 * @param {() => void} [extra]
 * @returns {() => void} kaldırıcı
 */
export function installRunSignalHandlers(handles = [], extra) {
  const stop = () => {
    abortMutationLockWait();
    if (typeof extra === 'function') extra();
    for (const h of handles) {
      if (!h || typeof h.close !== 'function') continue;
      Promise.resolve(h.close()).catch((e) => {
        console.error(`[e2e:catch-fail] signal close: ${e && e.message ? e.message : e}`);
      });
    }
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return () => {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  };
}

/**
 * @param {import('node:child_process').ChildProcess} child
 * @param {number} timeoutMs
 */
export function killChildTree(child, timeoutMs = 8000) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch (e) {
    console.error(`[e2e:catch-fail] SIGTERM: ${e && e.message ? e.message : e}`);
  }
  setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      try {
        child.kill('SIGKILL');
      } catch (e) {
        console.error(`[e2e:catch-fail] SIGKILL: ${e && e.message ? e.message : e}`);
      }
    }
  }, timeoutMs);
}
