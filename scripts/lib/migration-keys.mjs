/**
 * Eklenti kaynak ağacından seçenek / meta anahtarları ve göç eşleme tablosu.
 */
import fs from 'node:fs';
import path from 'node:path';

export const SKIP_DIRS = new Set([
  'node_modules',
  'vendor',
  'build',
  '.git',
  '.cursor',
  'tests',
  'coverage',
]);

const CORE_OPTION_PREFIX = new Set([
  'wp_',
  'widget_',
  'theme_mods_',
  'cron_',
  'recently_',
  'woocommerce_',
  'siteurl',
  'home',
]);

const OPTION_CALL_RE =
  /\b(?:get_option|update_option|add_option|delete_option)\s*\(\s*(?:(?:self|[A-Za-z_][\w]*)::[A-Z0-9_]+|['"]([^'"]+)['"])/g;

const META_CALL_RE =
  /\b(?:get_post_meta|update_post_meta|add_post_meta|delete_post_meta)\s*\(\s*[^,]+,\s*['"]([^'"]+)['"]/g;

const CONST_OPTION_RE =
  /const\s+(OPTION|OPTION_KEY|BACKUP_OPTION|BACKUP_RESTORED_OPTION|PREVIOUS_OPTION|LOG_OPTION|NOTICE_OPTION|LOCK)\s*=\s*['"]([^'"]+)['"]/g;

const QUOTED_WDP_RE = /['"]((?:wdp_|_wdp_|_transient_wdp_|_transient_timeout_wdp_)[a-z0-9_]+)['"]/g;

const CORE_OPTION_DROP =
  /^(siteurl|home|blogname|blogdescription|admin_email|cron|users_can_register|gmt_offset|timezone_string|date_format|time_format|permalink_structure|rewrite_rules|active_plugins|uninstall_plugins|template|stylesheet|current_theme|html_type|page_on_front|page_for_posts|show_on_front|blog_public|upload_path|upload_url_path|start_of_week|use_balanceTags|use_smilies|require_name_email|comments_notify|posts_per_rss|rss_use_excerpt)$|^(widget_|default_|WDP_|mailserver_)/;

const QUOTED_META_RE =
  /['"](_(?:allow|min|max|enable|amount|progress|sadaka|addon|theme|layout|goal|impact|trust|urgency|social|dedication|product_note|cover|wdp|faq|regular|price)_[a-z0-9_]*)['"]/gi;

const GET_OPTION_DEFAULT_RE =
  /get_option\s*\(\s*['"]([^'"]+)['"]\s*,\s*(false|true|null|-?\d+|['"][^'"]*['"]|array\(\s*\))/g;

const PICK_DEFAULT_RE =
  /pick_(?:hex|text|int|flag)\s*\(\s*\$request\s*,\s*\$existing\s*,\s*['"]([^'"]+)['"]\s*,\s*('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|-?\d+)/g;

export const WRITE_FN_RE =
  /\b(wp_delete_\w+|wp_trash_\w+|wp_untrash_\w+|wp_update_post|wp_insert_post|wp_update_user|wp_insert_user|wp_delete_user|wp_delete_attachment|update_option|add_option|delete_option|update_post_meta|add_post_meta|delete_post_meta|delete_post_meta_by_key|update_site_option|delete_site_option|add_site_option)\b/;

/**
 * @param {string} dir
 * @param {string[]} [exts]
 * @returns {string[]}
 */
export function walkSourceFiles(dir, exts = ['.php', '.js', '.mjs']) {
  /** @type {string[]} */
  const out = [];
  if (!dir || !fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        stack.push(full);
        continue;
      }
      if (exts.includes(path.extname(ent.name))) out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} source
 * @returns {{ options: string[], meta: string[], defaults: Record<string, unknown>, fieldDefaults: Record<string, unknown> }}
 */
export function extractKeysFromText(source) {
  const options = new Set();
  const meta = new Set();
  /** @type {Record<string, unknown>} */
  const defaults = {};
  /** @type {Record<string, unknown>} */
  const fieldDefaults = {};
  const text = String(source || '');

  for (const re of [OPTION_CALL_RE, QUOTED_WDP_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[1]) options.add(m[1]);
    }
  }

  CONST_OPTION_RE.lastIndex = 0;
  let cm;
  while ((cm = CONST_OPTION_RE.exec(text))) {
    options.add(cm[2]);
  }

  META_CALL_RE.lastIndex = 0;
  let mm;
  while ((mm = META_CALL_RE.exec(text))) {
    meta.add(mm[1]);
  }
  QUOTED_META_RE.lastIndex = 0;
  while ((mm = QUOTED_META_RE.exec(text))) {
    meta.add(mm[1]);
  }

  GET_OPTION_DEFAULT_RE.lastIndex = 0;
  let dm;
  while ((dm = GET_OPTION_DEFAULT_RE.exec(text))) {
    defaults[dm[1]] = parsePhpLiteral(dm[2]);
  }

  PICK_DEFAULT_RE.lastIndex = 0;
  let pm;
  while ((pm = PICK_DEFAULT_RE.exec(text))) {
    fieldDefaults[pm[1]] = parsePhpLiteral(pm[2]);
  }

  return {
    options: [...options].filter((k) => k && !CORE_OPTION_DROP.test(k)).sort(),
    meta: [...meta].sort(),
    defaults,
    fieldDefaults,
  };
}

/**
 * @param {string} lit
 */
export function parsePhpLiteral(lit) {
  const s = String(lit || '').trim();
  if (s === 'false') return false;
  if (s === 'true') return true;
  if (s === 'null') return null;
  if (s === 'array()') return {};
  if (/^-?\d+$/.test(s)) return Number(s);
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  return s;
}

/**
 * @param {string|string[]} roots
 */
export function extractKeysFromTrees(roots) {
  const list = Array.isArray(roots) ? roots : [roots];
  const options = new Set();
  const meta = new Set();
  /** @type {Record<string, unknown>} */
  const defaults = {};
  /** @type {Record<string, unknown>} */
  const fieldDefaults = {};
  /** @type {string[]} */
  const files = [];
  for (const root of list) {
    if (!root) continue;
    for (const file of walkSourceFiles(root)) {
      files.push(file);
      let text = '';
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const extracted = extractKeysFromText(text);
      extracted.options.forEach((k) => options.add(k));
      extracted.meta.forEach((k) => meta.add(k));
      Object.assign(defaults, extracted.defaults);
      Object.assign(fieldDefaults, extracted.fieldDefaults);
    }
  }
  return {
    options: [...options].sort(),
    meta: [...meta].sort(),
    defaults,
    fieldDefaults,
    files: files.length,
  };
}

/**
 * @param {string[]} optionKeys
 * @returns {string[]}
 */
export function optionPrefixes(optionKeys) {
  const set = new Set(['wdp_']);
  for (const k of optionKeys || []) {
    const key = String(k);
    if (!key || key.startsWith('_transient')) continue;
    if (CORE_OPTION_PREFIX.has(key) || [...CORE_OPTION_PREFIX].some((p) => key.startsWith(p) && p.endsWith('_'))) {
      continue;
    }
    const m = key.match(/^([a-z][a-z0-9]*_)/i);
    if (m) set.add(m[1].toLowerCase());
  }
  for (const drop of ['the_', 'get_', 'add_', 'set_', 'and_', 'for_', 'default_', 'widget_']) set.delete(drop);
  return [...set].sort();
}

/**
 * @param {string[]} metaKeys
 * @returns {string[]}
 */
export function metaPrefixes(metaKeys) {
  const set = new Set(['wdp_', '_wdp_']);
  for (const k of metaKeys || []) {
    const key = String(k);
    if (!key.startsWith('_') && !key.startsWith('wdp_')) continue;
    const m = key.match(/^(_?[a-z]+_)/i);
    if (m && m[1] !== '_price_' && m[1] !== '_regular_') set.add(m[1]);
  }
  return [...set].sort();
}

/**
 * class-migrations.php içinden TAŞINDI eşlemesi.
 * @param {string} phpSource
 * @returns {Record<string, string>}
 */
export function extractRemapTable(phpSource) {
  const text = String(phpSource || '');
  /** @type {Record<string, string>} */
  const consts = {};
  const constRe = /const\s+([A-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = constRe.exec(text))) {
    consts[m[1]] = m[2];
  }
  /** @type {Record<string, string>} */
  const map = {};
  if (consts.BACKUP_OPTION && consts.BACKUP_RESTORED_OPTION) {
    map[consts.BACKUP_OPTION] = consts.BACKUP_RESTORED_OPTION;
  }

  const resolve = (expr) => {
    const lit = expr.match(/^['"]([^'"]+)['"]$/);
    if (lit) return lit[1];
    const self = expr.match(/^(?:self|[A-Za-z_][\w]*)::([A-Z0-9_]+)$/);
    if (self && consts[self[1]]) return consts[self[1]];
    return '';
  };

  const delRe = /delete_option\s*\(\s*([^)]+?)\s*\)/g;
  const addRe = /(?:update_option|add_option)\s*\(\s*([^,]+)\s*,/g;
  const deleted = [];
  const added = [];
  while ((m = delRe.exec(text))) deleted.push(resolve(m[1].trim()));
  while ((m = addRe.exec(text))) added.push(resolve(m[1].trim()));
  for (const oldKey of deleted) {
    if (!oldKey) continue;
    const candidate = added.find((n) => n && n !== oldKey && (n.includes(oldKey) || oldKey.includes(n.replace(/_restored$/, ''))));
    if (candidate) map[oldKey] = candidate;
  }
  return map;
}

/**
 * @param {string} phpSource
 * @returns {string[]}
 */
export function findWriteFunctions(phpSource) {
  const text = String(phpSource || '');
  const hits = new Set();
  WRITE_FN_RE.lastIndex = 0;
  let m;
  const re = new RegExp(WRITE_FN_RE.source, 'g');
  while ((m = re.exec(text))) hits.add(m[1]);
  return [...hits].sort();
}

/**
 * @param {object} extracted
 */
export function buildKeyset(extracted) {
  const options = extracted.options || [];
  const meta = extracted.meta || [];
  return {
    options,
    meta,
    optionPrefixes: optionPrefixes(options),
    metaPrefixes: metaPrefixes(meta),
    defaults: extracted.defaults || {},
    fieldDefaults: extracted.fieldDefaults || {},
  };
}
