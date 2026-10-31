/**
 * staging30 Curcy kur aracı mantığı (backup/set/restore/status/expected-total). Ağ yok (remote enjekte edilir).
 * Yazma yalnız tests/e2e/helpers/curcy-rates.php içinde (Curcy parametre seçeneğinin tek anahtarı).
 * Curcy anlamı: oran = "1 ana birim (TRY) kaç birim bu para birimi"; EUR=0.02 => 1 TRY = 0.02 EUR.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildGuardedEvalFileCommand } from './deploy-guards.mjs';
import { ROOT, assertReadOnlyReportSource, parseJsonOutput, verifyRemoteSite } from './staging-tools.mjs';

export const CURCY_EVAL_FILE = 'tests/e2e/helpers/curcy-rates.php';
export const EXPECTED_EVAL_FILE = 'tests/e2e/helpers/expected-total.php';
export const BACKUP_FILE = 'build/handoff/curcy-rates-backup.json';
export const CURCY_OPS = ['backup', 'set', 'restore', 'status'];
export const OPTION_NAME = 'woo_multi_currency_params';

/** "EUR=0.02,USD=0.022" -> { EUR:'0.02', USD:'0.022' } (yalnız pozitif ondalık, 3 harfli kod). */
export function parseRates(spec) {
  const out = {};
  for (const pair of String(spec || '').split(',')) {
    const m = pair.trim().match(/^([A-Z]{3})=([0-9]+(?:\.[0-9]+)?)$/);
    if (!m || !(Number(m[2]) > 0)) throw new Error(`Geçersiz kur: "${pair}" (biçim EUR=0.02,USD=0.022)`);
    out[m[1]] = m[2];
  }
  if (!Object.keys(out).length) throw new Error('En az bir kur gerekli.');
  return out;
}

/**
 * @param {string} wpPath
 * @param {'backup'|'set'|'restore'|'status'} op
 * @param {{ evalB64: string, rates?: Record<string,string>, restoreB64?: string }} payload
 */
export function buildCurcyCommand(wpPath, op, payload) {
  if (!CURCY_OPS.includes(op)) throw new Error(`Geçersiz işlem: ${op}`);
  const extraEnv = { WDP_E2E_CURCY_OP: op };
  if (op === 'set') {
    const rates = payload.rates || {};
    extraEnv.WDP_E2E_CURCY_RATES = Object.entries(rates).map(([k, v]) => `${k}=${v}`).join(',');
    parseRates(extraEnv.WDP_E2E_CURCY_RATES);
  }
  const opts = { tmpPrefix: 'wdp-curcy', b64: payload.evalB64, extraEnv };
  if (op === 'restore') {
    if (!payload.restoreB64) throw new Error('restore için yedek gerekli.');
    opts.envFile = { envName: 'WDP_E2E_CURCY_RESTORE_FILE', b64: payload.restoreB64, suffix: '.json' };
  }
  return buildGuardedEvalFileCommand(wpPath, opts);
}

/** Değer içermeyen özet (ekrana yalnız bu yazılır). */
export function safeSummary(res) {
  const { value, rates, rates_after: ratesAfter, ...rest } = res || {};
  void value;
  return { ...rest, ...(rates ? { currencies: Object.keys(rates) } : {}), ...(ratesAfter ? { currencies: Object.keys(ratesAfter) } : {}) };
}

/**
 * @param {Record<string,string>} env
 * @param {'backup'|'set'|'restore'|'status'} op
 * @param {{ remoteFn: (cmd: string) => string, readFile?: (rel: string) => Buffer, writeFile?: (rel: string, data: string) => void,
 *   exists?: (rel: string) => boolean, rates?: Record<string,string>, force?: boolean }} deps
 */
export function runCurcyOp(env, op, deps) {
  const abs = (rel) => path.join(ROOT, rel);
  const readFile = deps.readFile || ((rel) => fs.readFileSync(abs(rel)));
  const exists = deps.exists || ((rel) => fs.existsSync(abs(rel)));
  const writeFile = deps.writeFile || ((rel, data) => {
    fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
    fs.writeFileSync(abs(rel), data, { mode: 0o600 });
  });
  verifyRemoteSite(deps.remoteFn, env);
  const evalB64 = readFile(CURCY_EVAL_FILE).toString('base64');
  const run = (o, extra = {}) => parseJsonOutput(deps.remoteFn(buildCurcyCommand(env.DEPLOY_WP_PATH, o, { evalB64, ...extra })));

  if (op === 'backup') {
    if (exists(BACKUP_FILE) && !deps.force) throw new Error('Yedek zaten var; üzerine yazılmaz (bilerek: --force).');
    const res = run('backup');
    if (!res.ok || !res.value) throw new Error(`Yedek alınamadı: ${res.error || 'bilinmiyor'}`);
    writeFile(BACKUP_FILE, JSON.stringify({ option_name: res.option_name, sha256: res.sha256, value: res.value }));
    return safeSummary(res);
  }
  if (op === 'status') {
    const res = run('status');
    const out = safeSummary(res);
    if (exists(BACKUP_FILE)) {
      const b = JSON.parse(readFile(BACKUP_FILE).toString('utf8'));
      out.backup_sha256 = b.sha256;
      out.matches_backup = b.sha256 === res.sha256;
    } else out.backup_sha256 = null;
    return out;
  }
  if (!exists(BACKUP_FILE)) throw new Error('Yedek yok: önce `backup` çalıştır.');
  if (op === 'set') {
    if (!deps.rates) throw new Error('--rates gerekli.');
    return safeSummary(run('set', { rates: deps.rates }));
  }
  // restore
  const raw = readFile(BACKUP_FILE).toString('utf8');
  const b = JSON.parse(raw);
  const res = run('restore', { restoreB64: Buffer.from(raw, 'utf8').toString('base64') });
  const out = safeSummary(res);
  out.matches_backup = res.ok === true && res.sha256 === b.sha256 && res.restored_ok === true;
  if (!out.matches_backup) throw new Error(`Geri yükleme sha256 doğrulaması başarısız: ${JSON.stringify(out)}`);
  return out;
}

/** sha256 yardımcı (testler). */
export function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** Salt okunur beklenen toplam + progress-report ile fark tablosu. */
export function runExpectedTotal(env, deps) {
  const readFile = deps.readFile || ((rel) => fs.readFileSync(path.join(ROOT, rel)));
  const buf = readFile(EXPECTED_EVAL_FILE);
  const ro = assertReadOnlyReportSource(buf.toString('utf8'));
  if (!ro.ok) throw new Error(ro.reason);
  verifyRemoteSite(deps.remoteFn, env);
  const out = parseJsonOutput(
    deps.remoteFn(buildGuardedEvalFileCommand(env.DEPLOY_WP_PATH, { tmpPrefix: 'wdp-exp', b64: buf.toString('base64') }))
  );
  const progress = deps.progress || null;
  const table = Object.entries(out.by_currency || {}).map(([cur, r]) => ({
    currency: cur,
    orders: r.orders,
    amount_sum: r.amount_sum,
    expected_base: r.expected_base,
    rate_src: r.rate_src,
    plugin_converted: progress && progress.by_order_currency && progress.by_order_currency[cur] ? progress.by_order_currency[cur].converted_sum : null,
  }));
  return {
    base_currency: out.base_currency,
    expected_total: out.expected_total,
    plugin_shown_stored: out.plugin_shown,
    progress_converted_total: progress ? progress.converted_total_base : null,
    diff_expected_vs_shown: Math.round((out.expected_total - out.plugin_shown) * 100) / 100,
    diff_expected_vs_progress: progress ? Math.round((out.expected_total - progress.converted_total_base) * 100) / 100 : null,
    table,
  };
}
