/**
 * Mailpit yardımcısı (YALNIZ yerel e2e). Uzak profilde kullanılamaz.
 * - ensureMailpit(): çalışıyorsa yeniden kullanır, değilse başlatır; stop() yalnız kendi başlattığını durdurur.
 * - clearMailbox(): yalnız Mailpit kutusunu boşaltır.
 * - waitForMessages(): API ile bekleme + okuma.
 * Portlar: WDP_MAILPIT_SMTP_PORT (1025), WDP_MAILPIT_HTTP_PORT (8025).
 */
import { spawn } from 'node:child_process';

export const SMTP_PORT = Number(process.env.WDP_MAILPIT_SMTP_PORT || 1025) || 1025;
export const HTTP_PORT = Number(process.env.WDP_MAILPIT_HTTP_PORT || 8025) || 8025;
export const API = `http://127.0.0.1:${HTTP_PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @return {Promise<boolean>} */
export async function mailpitUp() {
  try {
    const r = await fetch(`${API}/api/v1/info`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * @return {Promise<{stop: () => Promise<void>, started: boolean}>}
 */
export async function ensureMailpit() {
  if (await mailpitUp()) {
    return { started: false, stop: async () => {} };
  }
  const child = spawn('mailpit', ['--smtp', `127.0.0.1:${SMTP_PORT}`, '--listen', `127.0.0.1:${HTTP_PORT}`], {
    stdio: 'ignore',
    detached: false,
  });
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  for (let i = 0; i < 40; i++) {
    if (await mailpitUp()) break;
    if (exited) throw new Error('mailpit başlamadı (port dolu olabilir)');
    await sleep(250);
  }
  if (!(await mailpitUp())) {
    child.kill('SIGKILL');
    throw new Error('mailpit zaman aşımı');
  }
  return {
    started: true,
    async stop() {
      if (exited) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          if (!exited) child.kill('SIGKILL');
          resolve();
        }, 3000);
        child.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    },
  };
}

/** Yalnız Mailpit kutusunu boşaltır. */
export async function clearMailbox() {
  const r = await fetch(`${API}/api/v1/messages`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`mailpit kutu boşaltma ${r.status}`);
}

/** @return {Promise<Array<Record<string, any>>>} */
export async function listMessages() {
  const r = await fetch(`${API}/api/v1/messages?limit=200`);
  if (!r.ok) throw new Error(`mailpit liste ${r.status}`);
  const j = await r.json();
  return j.messages || [];
}

/**
 * @param {string} id
 * @return {Promise<Record<string, any>>} Ayrıntı (Subject, To, From, Text, HTML).
 */
export async function getMessage(id) {
  const r = await fetch(`${API}/api/v1/message/${id}`);
  if (!r.ok) throw new Error(`mailpit ileti ${r.status}`);
  return r.json();
}

/**
 * En az `min` ileti gelene (ve `settleMs` boyunca yeni gelmeyene) kadar bekler; ayrıntılarıyla döndürür.
 *
 * @param {{min?: number, timeoutMs?: number, settleMs?: number}} [opts]
 * @return {Promise<Array<Record<string, any>>>}
 */
export async function waitForMessages(opts = {}) {
  const { min = 1, timeoutMs = 30000, settleMs = 1500 } = opts;
  const end = Date.now() + timeoutMs;
  let last = -1;
  let stableSince = Date.now();
  while (Date.now() < end) {
    const list = await listMessages();
    if (list.length !== last) {
      last = list.length;
      stableSince = Date.now();
    }
    if (list.length >= min && Date.now() - stableSince >= settleMs) {
      return Promise.all(list.map((m) => getMessage(m.ID)));
    }
    await sleep(300);
  }
  throw new Error(`mailpit: ${min} ileti beklendi, ${last} geldi`);
}

/** @param {Record<string, any>} msg @return {string[]} Alıcı adresleri. */
export function recipients(msg) {
  return (msg.To || []).map((t) => String(t.Address || '').toLowerCase());
}

/** @param {string} id @return {string} Mailpit HTML önizleme adresi. */
export function htmlViewUrl(id) {
  return `${API}/view/${id}.html`;
}
