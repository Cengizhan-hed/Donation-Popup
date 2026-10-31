/**
 * staging-snippet / staging-progress-report ortak mantığı. Ağ yok (remote enjekte edilir).
 * Hedef yalnız ALLOWED_DEPLOY_TARGETS içindeki `staging-hedef` (staging30) olabilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_DEPLOY_TARGETS,
  buildGuardedEvalFileCommand,
  pathInsideAllowedRoot,
  validateRemoteSiteUrl,
  wpPathFlag,
} from './deploy-guards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const SNIPPET_NAME = 'WDP-K8-curcy-bridge (test)';
export const SNIPPET_DESC = 'Donation Panel K8 test snippet - Claude 2026-10-25';
export const SNIPPET_SOURCE_FILE = 'docs/site-snippets/curcy-bridge.php';
export const SNIPPET_EVAL_FILE = 'tests/e2e/helpers/snippet-manage.php';
export const REPORT_EVAL_FILE = 'tests/e2e/helpers/progress-report.php';
export const SNIPPET_OPS = ['install', 'remove', 'status'];

const STAGING_TARGET = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');

/** Yazma çağrıları: salt okunur rapor dosyasında yasak (staging-wp.mjs ile aynı küme + genişletilmiş). */
export const WRITE_CALL_RE =
  /\b(?:wp_delete_\w*|wp_trash_\w*|wp_untrash_\w*|wp_update_\w*|wp_insert_\w*|update_option|add_option|delete_option|update_post_meta|add_post_meta|delete_post_meta|update_user_meta|delete_transient|set_transient|wc_update_\w*)\b|\$wpdb\s*->\s*(?:query|insert|update|delete|replace)\b|->\s*(?:save|delete|set_status|update_status|update_meta_data|add_meta_data)\s*\(/i;

/**
 * Ortam yalnız staging30 olabilir (klasör yoluna + site adresine göre).
 * @param {Record<string,string>} env
 * @param {{ id?: string }|undefined} target
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assertStagingTarget(env, target) {
  if (!STAGING_TARGET) return { ok: false, reason: 'staging-hedef izin listesinde yok.' };
  if (target && target.id && target.id !== STAGING_TARGET.id) {
    return { ok: false, reason: 'Yalnız staging-hedef profili.' };
  }
  if (String(env.DEPLOY_SSH_ALIAS || '').trim() !== STAGING_TARGET.sshAlias) {
    return { ok: false, reason: 'SSH alias staging-hedef değil.' };
  }
  const wpPath = String(env.DEPLOY_WP_PATH || '').trim();
  if (!wpPath || !pathInsideAllowedRoot(wpPath, STAGING_TARGET.allowedRoot)) {
    return { ok: false, reason: 'WP yolu staging klasörü dışında.' };
  }
  if (String(env.DEPLOY_SITE_URL || '').replace(/\/$/, '') !== STAGING_TARGET.siteUrl) {
    return { ok: false, reason: 'Site adresi staging değil.' };
  }
  return { ok: true };
}

/** @param {string} src */
export function assertReadOnlyReportSource(src) {
  const m = String(src).match(WRITE_CALL_RE);
  return m ? { ok: false, reason: `Salt okunur rapor dosyası yazma çağrısı içeriyor: ${m[0]}` } : { ok: true };
}

/**
 * @param {string} wpPath
 * @param {'install'|'remove'|'status'} op
 * @param {{ evalB64: string, codeB64?: string }} payload
 */
export function buildSnippetCommand(wpPath, op, payload) {
  if (!SNIPPET_OPS.includes(op)) throw new Error(`Geçersiz işlem: ${op}`);
  /** @type {Parameters<typeof buildGuardedEvalFileCommand>[1]} */
  const opts = {
    tmpPrefix: 'wdp-snip',
    b64: payload.evalB64,
    extraEnv: {
      WDP_E2E_SNIPPET_OP: op,
      WDP_E2E_SNIPPET_NAME: SNIPPET_NAME,
      WDP_E2E_SNIPPET_DESC: SNIPPET_DESC,
    },
  };
  if (op === 'install') {
    if (!payload.codeB64) throw new Error('install için kod gerekli.');
    opts.envFile = { envName: 'WDP_E2E_SNIPPET_CODE_FILE', b64: payload.codeB64, suffix: '.php' };
  }
  return buildGuardedEvalFileCommand(wpPath, opts);
}

/** @param {string} wpPath @param {string} evalB64 */
export function buildReportCommand(wpPath, evalB64) {
  return buildGuardedEvalFileCommand(wpPath, { tmpPrefix: 'wdp-prog', b64: evalB64 });
}

/** Son geçerli JSON satırı (uyarılar/notice satırları atlanır). */
export function parseJsonOutput(out) {
  const lines = String(out || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith('{')) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        /* sonraki satır */
      }
    }
  }
  throw new Error('JSON çıktı alınamadı.');
}

/**
 * Site adresini doğrula (uzak `siteurl` = profil).
 * @param {(cmd: string) => string} remoteFn
 * @param {Record<string,string>} env
 */
export function verifyRemoteSite(remoteFn, env) {
  const t = assertStagingTarget(env, undefined);
  if (!t.ok) throw new Error(t.reason);
  const siteCheck = remoteFn(`wp option get siteurl ${wpPathFlag(env.DEPLOY_WP_PATH)}`);
  const g = validateRemoteSiteUrl(siteCheck, env.DEPLOY_SITE_URL);
  if (!g.ok) throw new Error(g.reason);
}

/**
 * @param {Record<string,string>} env
 * @param {'install'|'remove'|'status'} op
 * @param {{ remoteFn: (cmd: string) => string, readFile?: (rel: string) => Buffer }} deps
 */
export function runSnippetOp(env, op, deps) {
  const readFile = deps.readFile || ((rel) => fs.readFileSync(path.join(ROOT, rel)));
  verifyRemoteSite(deps.remoteFn, env);
  const evalB64 = readFile(SNIPPET_EVAL_FILE).toString('base64');
  let codeB64;
  if (op === 'install') {
    const code = readFile(SNIPPET_SOURCE_FILE).toString('utf8');
    if (!/^\s*<\?php/.test(code)) throw new Error('Snippet kaynağı <?php ile başlamıyor.');
    codeB64 = Buffer.from(code, 'utf8').toString('base64');
  }
  const out = deps.remoteFn(buildSnippetCommand(env.DEPLOY_WP_PATH, op, { evalB64, codeB64 }));
  return parseJsonOutput(out);
}

/**
 * @param {Record<string,string>} env
 * @param {{ remoteFn: (cmd: string) => string, readFile?: (rel: string) => Buffer }} deps
 */
export function runProgressReport(env, deps) {
  const readFile = deps.readFile || ((rel) => fs.readFileSync(path.join(ROOT, rel)));
  const buf = readFile(REPORT_EVAL_FILE);
  const ro = assertReadOnlyReportSource(buf.toString('utf8'));
  if (!ro.ok) throw new Error(ro.reason);
  verifyRemoteSite(deps.remoteFn, env);
  const out = deps.remoteFn(buildReportCommand(env.DEPLOY_WP_PATH, buf.toString('base64')));
  return parseJsonOutput(out);
}
