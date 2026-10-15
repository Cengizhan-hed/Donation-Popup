/**
 * E2E senaryo teşhisi: aktif senaryo kaydı, zaman çizelgesi, debug JSON, trace yolları.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

export const TRACES_DIR = path.join(ROOT, 'build/e2e/traces');

/** @type {Map<string, { name: string, step: string, startedAt: number }>} */
const activeScenarios = new Map();

/**
 * @param {string} name
 * @param {string} [step]
 */
export function scenarioBegin(name, step = 'start') {
  activeScenarios.set(name, { name, step, startedAt: Date.now() });
}

/**
 * @param {string} name
 * @param {string} step
 */
export function scenarioStep(name, step) {
  const cur = activeScenarios.get(name);
  if (cur) cur.step = step;
  else activeScenarios.set(name, { name, step, startedAt: Date.now() });
}

/**
 * @param {string} name
 */
export function scenarioEnd(name) {
  activeScenarios.delete(name);
}

/**
 * @returns {Array<{ name: string, step: string, ageMs: number }>}
 */
export function listActiveScenarios() {
  const now = Date.now();
  return [...activeScenarios.values()].map((s) => ({
    name: s.name,
    step: s.step,
    ageMs: now - s.startedAt,
  }));
}

/**
 * @param {string} name
 */
export function createTimeline(name) {
  const t0 = Date.now();
  /** @type {Array<{ label: string, ms: number, at: string }>} */
  const steps = [];
  scenarioBegin(name, 'start');
  return {
    name,
    /** @param {string} label */
    mark(label) {
      steps.push({ label, ms: Date.now() - t0, at: new Date().toISOString() });
      scenarioStep(name, label);
    },
    end() {
      scenarioEnd(name);
    },
    toJSON() {
      return { name, totalMs: Date.now() - t0, steps: steps.slice() };
    },
  };
}

/**
 * @param {string} runLabel
 * @param {string} scenario
 */
export function tracePaths(runLabel, scenario) {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  const base = `${safeName(runLabel)}-${safeName(scenario)}`;
  return {
    zip: path.join(TRACES_DIR, `${base}.zip`),
    json: path.join(TRACES_DIR, `${base}.json`),
    firstAttemptJson: path.join(TRACES_DIR, `${base}-attempt1.json`),
  };
}

/**
 * @param {string} s
 */
function safeName(s) {
  return String(s || 'run').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * @param {string} file
 * @param {object} data
 */
export function writeDebugJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<object>}
 */
export async function collectPageCacheAndNonce(page) {
  const fromDom = await page
    .evaluate(() => {
      const ajax = window.wdp_ajax || {};
      return {
        ajaxUrl: ajax.ajax_url || '',
        nonce: ajax.nonce || '',
        nonces: ajax.nonces || {},
        documentHidden: !!document.hidden,
        readyState: document.readyState,
      };
    })
    .catch(() => ({}));

  return {
    ...fromDom,
    // document yanıt başlıkları page meta’dan (capture tarafında doldurulur)
  };
}

/**
 * Document navigasyon yanıtlarından önbellek başlıklarını tut.
 * @param {import('@playwright/test').Page} page
 * @returns {{ get: () => object|null, dispose: () => void }}
 */
export function attachDocumentCacheProbe(page) {
  /** @type {object|null} */
  let last = null;
  const onResponse = (res) => {
    try {
      if (res.request().resourceType() !== 'document') return;
      const h = res.headers();
      last = {
        url: res.url().slice(0, 200),
        status: res.status(),
        'cache-control': h['cache-control'] || h['Cache-Control'] || '',
        age: h.age || h.Age || '',
        'x-cache': h['x-cache'] || h['X-Cache'] || '',
        'x-proxy-cache': h['x-proxy-cache'] || h['X-Proxy-Cache'] || '',
        'cf-cache-status': h['cf-cache-status'] || h['CF-Cache-Status'] || '',
        'x-sg-cache': h['x-sg-cache'] || h['X-SG-Cache'] || '',
      };
    } catch (e) {
      /* ignore */
    }
  };
  page.on('response', onResponse);
  return {
    get: () => last,
    dispose: () => page.off('response', onResponse),
  };
}
