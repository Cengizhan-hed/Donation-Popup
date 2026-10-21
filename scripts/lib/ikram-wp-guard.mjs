/**
 * ikram:wp komut kara/izin listesi (ağ yok).
 * Yıkıcı WP-CLI (db drop, site empty, user/post delete, …) reddedilir.
 */

export const IKRAM_WP_SLUG = 'woo-donation-popup';
export const IKRAM_WP_ALIAS = 'ikramaid';
export const CLEANUP_EVAL_FILE = 'tests/e2e/helpers/cleanup-e2e.php';

const BLOCKED = [
  /\bdb\s+(drop|reset|clean|repair|query)\b/i,
  /\bsite\s+empty\b/i,
  /\buser\s+delete\b/i,
  /\bpost\s+delete\b/i,
  /\bplugin\s+(delete|uninstall|install)\b/i,
  /\btheme\s+(delete|install|activate)\b/i,
  /\boption\s+(update|delete|patch|add)\b/i,
  /\bsearch-replace\b/i,
  /\bterm\s+delete\b/i,
  /\bcomment\s+delete\b/i,
  /\bmedia\s+delete\b/i,
  /\bwc\s+\S+\s+delete\b/i,
  /\bcore\s+(update|download|install)\b/i,
];

const ALLOWED_HEADS = [
  'plugin list',
  'plugin get',
  'plugin status',
  'plugin path',
  'option get',
  'post list',
  'post get',
  'wc',
  'cache flush',
  'sg purge',
  'eval',
  'eval-file',
];

const EVAL_INLINE_BLOCK =
  /\b(wp_delete_|DROP\s+|DELETE\s+FROM|update_option|delete_option|wp_update_user|wp_insert_user|wp_delete_user)\b/i;

/**
 * @param {string} tail `plugin list` veya `wp plugin list`
 * @returns {string} `wp ...` (başındaki wp yinelenmez)
 */
export function normalizeWpTail(tail) {
  let s = String(tail || '').trim();
  if (!s) return '';
  if (/^wp\s+/i.test(s)) s = s.replace(/^wp\s+/i, '');
  return s;
}

/**
 * @param {string} tail wp sonrası (plugin list …)
 * @returns {{ ok: true, kind: string } | { ok: false, reason: string }}
 */
export function allowIkramWpCommand(tail) {
  const cmd = normalizeWpTail(tail);
  if (!cmd) return { ok: false, reason: 'WP-CLI komutu boş.' };

  for (const re of BLOCKED) {
    if (re.test(cmd)) {
      return { ok: false, reason: `Kara liste: yıkıcı WP-CLI (${cmd.split(/\s+/).slice(0, 3).join(' ')})` };
    }
  }

  const headOk = ALLOWED_HEADS.some((h) => cmd === h || cmd.startsWith(`${h} `) || cmd.startsWith(`${h}\t`));
  if (!headOk) {
    return {
      ok: false,
      reason: `İzin listesinde değil. İzinli: plugin list/get/status/path, option get, post list/get, wc …, cache flush, sg purge, eval (temizlik/teşhis), eval-file (${CLEANUP_EVAL_FILE}).`,
    };
  }

  if (cmd === 'eval' || cmd.startsWith('eval ')) {
    if (EVAL_INLINE_BLOCK.test(cmd)) {
      return { ok: false, reason: 'eval içinde yıkıcı PHP reddedildi. Temizlik için eval-file kullanın.' };
    }
    return { ok: true, kind: 'eval' };
  }

  if (cmd === 'eval-file' || cmd.startsWith('eval-file ')) {
    const rest = cmd.slice('eval-file'.length).trim();
    const fileTok = rest.split(/\s+/)[0] || '';
    const norm = fileTok.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!norm.endsWith(CLEANUP_EVAL_FILE) && norm !== CLEANUP_EVAL_FILE) {
      return {
        ok: false,
        reason: `eval-file yalnız ${CLEANUP_EVAL_FILE} için izinli.`,
      };
    }
    return { ok: true, kind: 'eval-file' };
  }

  return { ok: true, kind: 'wp' };
}

/**
 * wp plugin path çıktısı dosya ise dizin yap; slug klasörüne zorla.
 * @param {string} raw
 * @param {string} [slug]
 */
export function normalizeRemotePluginDir(raw, slug = IKRAM_WP_SLUG) {
  let p = String(raw || '').trim().replace(/[\r\n]+/g, '').replace(/\/+$/, '');
  if (!p) return '';
  if (/\.php$/i.test(p)) {
    p = p.replace(/\/[^/]+\.php$/i, '');
  }
  const base = p.split('/').filter(Boolean).pop() || '';
  if (base === 'plugins') {
    p = `${p}/${slug}`;
  } else if (base !== slug) {
    if (p.endsWith(`/plugins/${slug}`) || p.endsWith(`/${slug}`)) {
      /* already */
    } else if (p.includes('/wp-content/plugins/')) {
      p = p.replace(/\/wp-content\/plugins\/.*$/, `/wp-content/plugins/${slug}`);
    }
  }
  return p.replace(/\/+$/, '');
}
