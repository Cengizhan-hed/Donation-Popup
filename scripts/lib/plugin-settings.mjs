/**
 * Eklentinin KENDİ ayarını (donation_panel_settings içindeki ALLOWLIST yollar) güvenle değiştirme mantığı.
 * Ağ yok (remote/local çalıştırıcı enjekte edilir). Yazma yalnız tests/e2e/helpers/plugin-settings.php içinde.
 * Canlı hedef kesin red; WooCommerce/tema/site seçenekleri yasak (açık kara liste + allowlist dışı = red).
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildGuardedEvalFileCommand } from './deploy-guards.mjs';
import { ROOT, parseJsonOutput } from './staging-tools.mjs';

export const PS_EVAL_FILE = 'tests/e2e/helpers/plugin-settings.php';
export const PS_OPTION_NAME = 'donation_panel_settings';
export const PS_BACKUP_DIR = 'build/e2e/plugin-settings-backup';
/** Yalnız bu üç ortam (canlı yok). */
export const PS_ENVS = ['local', 'staging-hedef', 'ikram-aid'];

export const MODULE_SLUGS = ['side_cart', 'campaign', 'impact', 'social_proof', 'thanks', 'tax_relief', 'donor_account'];

/** Yol → tür. PHP tarafındaki allowlist ile birebir (PHP yetkili; burası erken red + tablo için). */
export const ALLOWLIST = Object.freeze({
  ...Object.fromEntries(MODULE_SLUGS.map((s) => [`modules.${s}`, { type: 'bool' }])),
  'thanks.celebrate': { type: 'bool' },
  'thanks.share': { type: 'bool' },
  'thanks.message': { type: 'string' },
  'thanks.email': { type: 'bool' },
  'tax_relief.step_label': { type: 'string' },
  'tax_relief.title': { type: 'string' },
  'tax_relief.text': { type: 'string' },
  'tax_relief.checkbox_label': { type: 'string' },
});

/** Açıkça yasak seçenek adları/önekleri (allowlist zaten dışlar; mesaj ve test için). */
export const FORBIDDEN_RE = /^(wc_|woocommerce_|blog|siteurl|home$|active_plugins|template$|stylesheet$|admin_email|users_can_register|default_role)/i;

const TRUE_SET = new Set(['1', 'true', 'on', 'yes']);
const FALSE_SET = new Set(['0', 'false', 'off', 'no']);

/**
 * @param {string} envRaw
 * @returns {string} local | staging-hedef | ikram-aid
 */
export function resolvePsEnv(envRaw) {
  const want = String(envRaw || '').trim().toLowerCase();
  const map = { local: 'local', staging: 'staging-hedef', hedef: 'staging-hedef', 'staging-hedef': 'staging-hedef', ikram: 'ikram-aid', 'ikram-aid': 'ikram-aid' };
  const id = map[want];
  if (!id || !PS_ENVS.includes(id)) {
    throw new Error(`Geçersiz ortam "${want}". İzinli: ${PS_ENVS.join(', ')} (canlı hiçbir koşulda hedef olamaz).`);
  }
  return id;
}

/**
 * @param {string} p
 */
export function assertAllowedPath(p) {
  const key = String(p || '').trim();
  if (FORBIDDEN_RE.test(key)) throw new Error(`Yasak anahtar: ${key}`);
  if (!Object.prototype.hasOwnProperty.call(ALLOWLIST, key)) throw new Error(`Bilinmeyen/izinsiz anahtar: ${key}`);
  return key;
}

/**
 * @param {string} p
 * @param {unknown} raw
 */
export function normalizeValue(p, raw) {
  const spec = ALLOWLIST[assertAllowedPath(p)];
  if (spec.type === 'bool') {
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    if (TRUE_SET.has(s)) return true;
    if (FALSE_SET.has(s)) return false;
    throw new Error(`${p}: geçersiz mantıksal değer "${raw}" (1/0/true/false/on/off/yes/no)`);
  }
  const s = String(raw);
  if (spec.type === 'enum') {
    if (!spec.values.includes(s)) throw new Error(`${p}: geçersiz değer "${s}" (${spec.values.join('|')})`);
    return s;
  }
  // eslint-disable-next-line no-control-regex
  if (s.length > 500 || /[\u0000-\u001f]/.test(s)) throw new Error(`${p}: değer çok uzun ya da denetim karakteri içeriyor`);
  return s;
}

/**
 * "a.b=1,c.d=new" -> { 'a.b': true, ... }  (değerde virgül kullanılamaz)
 * @param {string} spec
 */
export function parseSetSpec(spec) {
  const out = {};
  const raw = String(spec || '').trim();
  if (!raw) throw new Error('--set boş.');
  for (const pair of raw.split(',')) {
    const i = pair.indexOf('=');
    if (i <= 0) throw new Error(`Geçersiz çift: "${pair}" (biçim yol=değer)`);
    const key = assertAllowedPath(pair.slice(0, i));
    out[key] = normalizeValue(key, pair.slice(i + 1));
  }
  return out;
}

/**
 * @param {string} wpPath
 * @param {{ evalB64: string, payload: object }} o
 */
export function buildPsCommand(wpPath, o) {
  return buildGuardedEvalFileCommand(wpPath, {
    tmpPrefix: 'wdp-ps',
    b64: o.evalB64,
    envFile: { envName: 'WDP_E2E_PS_PAYLOAD_FILE', b64: Buffer.from(JSON.stringify(o.payload), 'utf8').toString('base64'), suffix: '.json' },
  });
}

/** PHP dosyasında yalnız tek bir update_option(OPTION) olmalı; başka yazma çağrısı yok. */
export function assertPhpWriteSurface(src) {
  const writeRe = /\b(update_option|add_option|delete_option|update_post_meta|add_post_meta|delete_post_meta|update_user_meta|delete_user_meta|update_site_option|wp_insert_\w+|wp_update_\w+|wp_delete_\w+|wp_set_\w+|set_transient|delete_transient)\s*\(|\$wpdb\b|\bwp_cache_flush\b/g;
  const hits = [...String(src).matchAll(writeRe)].map((m) => m[0].replace(/\s*\($/, ''));
  const bad = hits.filter((h) => h !== 'update_option');
  const updates = (String(src).match(/\bupdate_option\s*\(\s*\$wdp_ps_option\b/g) || []).length;
  const allUpdates = hits.filter((h) => h === 'update_option').length;
  if (bad.length || allUpdates !== 1 || updates !== 1) return { ok: false, reason: `Yazma yüzeyi dar değil: ${[...new Set(bad)].join(',') || `update_option x${allUpdates}`}` };
  return { ok: true };
}

/** Değer tablosu biçimi (satır listesi). */
export function formatTable(changes) {
  const fmt = (e) => (e && e.present ? JSON.stringify(e.value) : '(yok)');
  return (changes || []).map((c) => `${c.path.padEnd(28)} ${fmt(c.before).padEnd(14)} -> ${fmt(c.after).padEnd(14)} ${c.changed ? 'DEĞİŞTİ' : 'aynı'}`);
}

/** Yedek dosya adı: <env>-<zaman>.json */
export function backupName(envId, now = new Date()) {
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${envId}-${ts}.json`;
}

/**
 * Yedek içeriği doğrular (restore girdisi).
 * @param {unknown} data
 * @param {string} envId
 */
export function validateBackup(data, envId) {
  const d = /** @type {any} */ (data);
  if (!d || d.option_name !== PS_OPTION_NAME || !d.previous || typeof d.previous !== 'object') throw new Error('Yedek biçimi geçersiz.');
  if (d.env !== envId) throw new Error(`Yedek "${d.env}" ortamına ait; "${envId}" ortamına uygulanamaz.`);
  const restore = {};
  for (const [p, e] of Object.entries(d.previous)) {
    assertAllowedPath(p);
    const entry = /** @type {any} */ (e);
    if (!entry || typeof entry.present !== 'boolean') throw new Error(`Yedek girdisi geçersiz: ${p}`);
    if (Array.isArray(d.requested) ? false : d.requested && typeof d.requested === 'object' && !(p in d.requested)) continue;
    restore[p] = entry.present ? { present: true, value: normalizeValue(p, entry.value) } : { present: false, value: null };
  }
  if (!Object.keys(restore).length) throw new Error('Yedek boş.');
  return restore;
}

/**
 * Ana akış. runEval(payload) -> parse edilmiş JSON (PHP çıktısı).
 * @param {{
 *   envId: string,
 *   op: 'show'|'set'|'restore',
 *   values?: Record<string, unknown>,
 *   dry?: boolean,
 *   restoreFile?: string,
 *   runEval: (payload: object) => any,
 *   readFile?: (p: string) => string,
 *   writeFile?: (p: string, data: string) => void,
 *   now?: Date,
 *   backupDirAbs?: string,
 * }} o
 */
export function runPluginSettings(o) {
  const envId = resolvePsEnv(o.envId);
  const backupDirAbs = o.backupDirAbs || path.join(ROOT, PS_BACKUP_DIR);
  const writeFile = o.writeFile || ((p, d) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, d, { mode: 0o600 });
  });
  const readFile = o.readFile || ((p) => fs.readFileSync(p, 'utf8'));

  if (o.op === 'show') {
    const res = o.runEval({ op: 'show' });
    return { ok: true, env: envId, previous: res.previous, option_exists: res.option_exists };
  }
  if (o.op === 'restore') {
    if (!o.restoreFile) throw new Error('--restore için yedek dosyası gerekli.');
    const restore = validateBackup(JSON.parse(readFile(o.restoreFile)), envId);
    const res = o.runEval({ op: 'restore', dry: !!o.dry, restore });
    return { ok: !!res.ok, env: envId, dry: !!o.dry, written: !!res.written, changes: res.changes, table: formatTable(res.changes) };
  }
  if (o.op !== 'set') throw new Error(`Geçersiz işlem: ${o.op}`);
  const values = {};
  for (const [k, v] of Object.entries(o.values || {})) values[assertAllowedPath(k)] = normalizeValue(k, v);
  if (!Object.keys(values).length) throw new Error('Değiştirilecek anahtar yok.');

  // 1) Salt okunur önceki değerler; 2) yedek (dry-run yazmaz); 3) yazma.
  const prev = o.runEval({ op: 'show' });
  let backupFile = null;
  if (!o.dry) {
    backupFile = path.join(backupDirAbs, backupName(envId, o.now));
    writeFile(
      backupFile,
      JSON.stringify({ option_name: PS_OPTION_NAME, env: envId, time: (o.now || new Date()).toISOString(), previous: prev.previous, requested: values }, null, 2)
    );
  }
  const res = o.runEval({ op: 'set', dry: !!o.dry, values });
  return { ok: !!res.ok, env: envId, dry: !!o.dry, written: !!res.written, backup: backupFile, changes: res.changes, table: formatTable(res.changes) };
}

export { parseJsonOutput };
