/**
 * Kurulum kilitleri (ağ gerektirmeyen kontroller).
 *
 * İzinli uzak hedefler YALNIZ ALLOWED_DEPLOY_TARGETS (tek yer).
 * Kilit host adına değil KLASÖR YOLUNA göredir: aynı SSH kullanıcısı
 * canlı köke de gidebilir; yol izinli kökün dışında ise RED.
 *
 * Kara liste (canlı): hedefdernegi.org, www.hedefdernegi.org, ~/www/hedefdernegi.org // live-scan:blacklist-def
 * İzinli Hedef geçişi yalnız staging30.hedefdernegi.org biçiminde.
 *
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 */

/** Ikram Aid yayına alınmadan önce bu izin KALDIRILACAK. */
export const IKRAM_ALLOW_REMOVAL_NOTE =
  'ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK';

/** live-scan:blacklist-def — canlı Hedef host/yol kara listesi (yalnız tarama işareti). */
export const LIVE_SCAN_BLACKLIST_MARK = 'live-scan:blacklist-def';
export const LIVE_SCAN_ALLOW_REJECT_TEST = 'live-scan:allow-reject-test';

/** İzinli Hedef staging host (başka hedefdernegi.org geçişi yok). */ // live-scan:blacklist-def
export const ALLOWED_HEDEF_HOST = 'staging30.hedefdernegi.org';

/**
 * Canlı Hedef kara listesi. live-scan:blacklist-def
 * www.hedefdernegi.org ve hedefdernegi.org her koşulda engelli. live-scan:blacklist-def
 */
export const LIVE_HOST_BLOCKLIST = [
  /(^|\.)hedefdernegi\.org$/i, // live-scan:blacklist-def
];

/**
 * Yeni hedef eklemek için TEK yer.
 *
 * ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 *
 * @typedef {{ id: string, sshAlias: string, wpPath: string, siteUrl: string, allowedRoot: string }} RemoteTarget
 * @type {RemoteTarget[]}
 */
export const ALLOWED_DEPLOY_TARGETS = [
  {
    id: 'staging-hedef',
    sshAlias: 'hedef-staging',
    wpPath: '~/www/staging30.hedefdernegi.org/public_html',
    siteUrl: 'https://staging30.hedefdernegi.org',
    allowedRoot: '~/www/staging30.hedefdernegi.org/',
  },
  {
    id: 'ikram-aid',
    sshAlias: 'ikramaid',
    wpPath: '~/www/ikramaid.uk/public_html',
    siteUrl: 'https://ikramaid.uk',
    allowedRoot: '~/www/ikramaid.uk/',
    // ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK
    removalNote: IKRAM_ALLOW_REMOVAL_NOTE,
  },
];

/**
 * @param {string} hostOrUrl
 */
export function extractHost(hostOrUrl) {
  const raw = String(hostOrUrl || '').trim().toLowerCase();
  if (!raw) return '';
  let host = raw;
  try {
    if (/^https?:\/\//i.test(raw)) host = new URL(raw).hostname;
  } catch {
    host = raw.replace(/^https?:\/\//i, '').split('/')[0];
  }
  return host.replace(/^www\./, '').split('/')[0];
}

/**
 * hedefdernegi.org geçişi yalnız staging30.hedefdernegi.org olarak kalırsa güvenli. // live-scan:blacklist-def
 * `~/www/hedefdernegi.org/staging` gibi "staging" alt yolları CANLI sayılır. // live-scan:blacklist-def
 * @param {string} text
 */
export function hasBlockedHedefMention(text) {
  const raw = String(text || '');
  if (!/hedefdernegi\.org/i.test(raw)) return false; // live-scan:blacklist-def
  const stripped = raw.replace(/staging30\.hedefdernegi\.org/gi, '');
  return /hedefdernegi\.org/i.test(stripped); // live-scan:blacklist-def
}

/**
 * @param {string} hostOrUrl
 */
export function isLiveHedefHost(hostOrUrl) {
  return hasBlockedHedefMention(hostOrUrl);
}

/**
 * @param {string} raw
 * @returns {{ ok: true, path: string } | { ok: false, reason: string }}
 */
export function inspectRemotePath(raw) {
  const s = String(raw || '').trim();
  if (!s) return { ok: false, reason: 'Yol boş.' };
  if (s.includes('..')) {
    return { ok: false, reason: 'Yol `..` içeremez.' };
  }
  if (/[*?[]/.test(s)) {
    return { ok: false, reason: 'Yol glob içeremez.' };
  }
  if (/\$\(|`|\$\{/.test(s)) {
    return { ok: false, reason: 'Yol değişken genişletme içeremez.' };
  }
  return { ok: true, path: s };
}

/**
 * `~`, `$HOME`, `/home/<user>`, `//`, sondaki `/` normalize.
 * @param {string} raw
 */
export function normalizeRemotePath(raw) {
  let s = String(raw || '').trim().replace(/\\/g, '/');
  if (!s) return '';
  s = s.replace(/\$HOME(?=\/|$)/g, '~');
  s = s.replace(/^\/home\/[^/]+(?=\/|$)/, '~');
  s = s.replace(/\/+/g, '/');
  if (s === '~') return '~';
  if (s.endsWith('/') && s !== '~/') s = s.replace(/\/+$/, '');
  return s;
}

/**
 * @param {string} rawPath
 * @param {string} allowedRoot
 */
export function pathInsideAllowedRoot(rawPath, allowedRoot) {
  const inspected = inspectRemotePath(rawPath);
  if (!inspected.ok) return false;
  const p = normalizeRemotePath(inspected.path);
  const root = normalizeRemotePath(allowedRoot);
  if (!p || !root) return false;
  if (p === root) return true;
  const prefix = root.endsWith('/') ? root : `${root}/`;
  return p.startsWith(prefix) || `${p}/` === prefix;
}

/**
 * @param {string} alias
 * @returns {RemoteTarget | undefined}
 */
export function findTargetByAlias(alias) {
  const a = String(alias || '').trim();
  if (!a) return undefined;
  return ALLOWED_DEPLOY_TARGETS.find((t) => t.sshAlias === a);
}

/**
 * @param {string} id
 * @returns {RemoteTarget | undefined}
 */
export function findTargetById(id) {
  const want = String(id || '').trim();
  if (!want) return undefined;
  return ALLOWED_DEPLOY_TARGETS.find((t) => t.id === want);
}

/**
 * Uzak komut / argüman metninden yol adayları.
 * @param {string} text
 * @returns {string[]}
 */
export function extractPathsFromText(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const out = [];
  const re =
    /(?:^|[\s"'=]|--path=)(\$HOME\/[^\s"'`;|&]+|~\/[^\s"'`;|&]+|\/home\/[^\s"'`;|&]+)/g;
  let m;
  while ((m = re.exec(raw))) {
    out.push(m[1].replace(/[\\/,;.]+$/, ''));
  }
  const pathFlag = /--path(?:=|\s+)(?:'([^']+)'|"([^"]+)"|(\S+))/g;
  let f;
  while ((f = pathFlag.exec(raw))) {
    const p = f[1] || f[2] || f[3] || '';
    if (p) out.push(p);
  }
  return out;
}

/**
 * @param {string} cmd
 */
export function isWpCliRemoteCommand(cmd) {
  const s = String(cmd || '');
  return /(?:^|[\s;|&])wp\s+/.test(s) || /^\s*wp\s+/.test(s);
}

/**
 * @param {string} cmd
 * @param {string} expectedWpPath
 */
export function wpCliHasExactPath(cmd, expectedWpPath) {
  const s = String(cmd || '');
  const want = String(expectedWpPath || '').trim();
  const m = s.match(/--path(?:=|\s+)(?:'([^']+)'|"([^"]+)"|(\S+))/);
  if (!m) return false;
  const got = String(m[1] || m[2] || m[3] || '').trim();
  if (!got) return false;
  if (got === want) return true;
  const inspected = inspectRemotePath(got);
  if (!inspected.ok) return false;
  return normalizeRemotePath(got) === normalizeRemotePath(want);
}

function deny(reason) {
  return { ok: false, reason };
}

/**
 * Kabuk parçalarını `&&` `||` `;` `|` satır sonuna göre ayır.
 * @param {string} cmd
 * @returns {string[]}
 */
export function splitRemoteCommandSegments(cmd) {
  return String(cmd || '')
    .split(/\n|&&|\|\||;(?![^']*')|\|(?!\|)/)
    .map((s) => s.replace(/^\(+/, '').replace(/\)+$/, '').trim())
    .filter(Boolean);
}

/**
 * @param {string} raw
 */
function unquoteShellArg(raw) {
  const t = String(raw || '').trim();
  if (t.length >= 2 && ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * `cd` hedefi: göreli, `~`, `-`, `$HOME`, boş, `..` → RED.
 * Değişken/`$(dirname …)` (wp --path ile sınırlı) izinli.
 * @param {string} arg
 * @param {string} allowedRoot
 */
function inspectCdTarget(arg, allowedRoot) {
  const raw = String(arg || '').trim();
  if (!raw || raw === '-' || raw === '~' || raw === '$HOME' || raw === '~/' || raw === '$HOME/') {
    return deny('cd hedefi izinli kök dışında (cd, cd ~, cd -, cd $HOME yasak).');
  }
  const first = unquoteShellArg(raw.split(/\s+/)[0] || raw);
  if (!first || first === '-' || first === '~' || first === '$HOME' || first === '~/' || first === '$HOME/') {
    return deny('cd hedefi izinli kök dışında (cd, cd ~, cd -, cd $HOME yasak).');
  }
  if (first.includes('..')) {
    return deny('Yol `..` içeremez.');
  }
  if (first.startsWith('$') || first.startsWith('"') || /\$\{|\$\(/.test(first)) {
    return { ok: true };
  }
  const looksAbs = first.startsWith('/') || first.startsWith('~/') || first.startsWith('$HOME');
  if (!looksAbs) {
    return deny('göreli cd yasak.');
  }
  if (!pathInsideAllowedRoot(first, allowedRoot)) {
    return deny('Yol izinli kökün dışında.');
  }
  return { ok: true };
}

/**
 * Mutlak / `~` / `$HOME` adayını izinli köke göre denetle.
 * `/tmp/wdp-*` (eval-file mktemp) istisna.
 * @param {string} rawPath
 * @param {string} allowedRoot
 */
function inspectAbsoluteOrHomePath(rawPath, allowedRoot) {
  const p = unquoteShellArg(rawPath);
  if (!p) return { ok: true };
  if (/^\/tmp\/wdp-/.test(p) || p === '/tmp' || /^\/tmp\/wdp-/.test(String(rawPath))) {
    return { ok: true };
  }
  if (p.startsWith('$') || /\$\{|\$\(/.test(p)) return { ok: true };
  const looks =
    p.startsWith('/') || p.startsWith('~/') || p === '~' || p.startsWith('$HOME') || p.startsWith('/home/');
  if (!looks) return { ok: true };
  if (p === '~' || p === '$HOME' || p === '/' || p === '/home' || p === '/home/') {
    return deny('Yol izinli kökün dışında.');
  }
  const inspected = inspectRemotePath(p);
  if (!inspected.ok) return inspected;
  if (!pathInsideAllowedRoot(p, allowedRoot)) {
    return deny('Yol izinli kökün dışında.');
  }
  return { ok: true };
}

/**
 * Uzak komut metni: `..`, cd, pushd/popd, ln -s, find /, ls ~, ls /.
 *
 * @param {string} cmd
 * @param {string} allowedRoot
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function inspectRemoteCommand(cmd, allowedRoot) {
  const s = String(cmd || '');
  if (!s) return { ok: true };

  if (/(?:^|[/'"`\s=])\.\.(?:[/'"`\s]|$)/.test(s) || s.includes('/..') || s.includes('../')) {
    return deny('Yol `..` içeremez.');
  }
  if (/(?:^|[\s;|&`(])(?:pushd|popd)(?:\s|$)/.test(s)) {
    return deny('pushd/popd yasak.');
  }
  if (/(?:^|[\s;|&`(])ln\s+-[^\n]*s/.test(s)) {
    return deny('ln -s yasak.');
  }
  if (/(?:^|[\s;|&`(])find\s+(?:-[A-Za-z0-9=]+\s+)*\//.test(s)) {
    return deny('find / yasak.');
  }

  const lsHome = /(?:^|[\s;|&`(])ls(?:\s+-[A-Za-z0-9]+)*\s+(~|\$HOME|\/)(?=\s|$)/;
  if (lsHome.test(s)) {
    return deny('ls ~ veya ls / yasak.');
  }

  const segments = splitRemoteCommandSegments(s);
  for (const seg of segments) {
    const cdMatch = seg.match(/^(?:\(+\s*)?cd(?:\s+(.*))?$/);
    if (cdMatch) {
      const r = inspectCdTarget(cdMatch[1] || '', allowedRoot);
      if (!r.ok) return r;
    }

    const lsMatch = seg.match(/^(?:\(+\s*)?ls(?:\s+-[A-Za-z0-9]+)*\s+(\S[\s\S]*)$/);
    if (lsMatch) {
      const arg = unquoteShellArg(String(lsMatch[1]).trim().split(/\s+/)[0] || '');
      if (arg === '~' || arg === '$HOME' || arg === '/' || arg === '/home') {
        return deny('ls ~ veya ls / yasak.');
      }
      const abs = inspectAbsoluteOrHomePath(arg, allowedRoot);
      if (!abs.ok) return abs;
    }
  }

  return { ok: true };
}

/**
 * Betiklerin ürettiği gerçek uzak komut kalıpları (ağ yok; dry-run üretimi).
 * @param {RemoteTarget} target
 * @returns {string[]}
 */
export function plannedRemoteCommands(target) {
  const t = target || {};
  const wp = String(t.wpPath || '').replace(/'/g, `'\\''`);
  const root = String(t.allowedRoot || '').replace(/\/$/, '');
  const backupRoot = `${root}/wdp-backups`;
  const deployRoot = `${root}/wdp-deploy`;
  const slug = 'woo-donation-popup';
  const backupZip = `${backupRoot}/${slug}-pre-x.zip`;
  const list = [
    `wp option get siteurl --path='${wp}'`,
    `wp eval 'echo 1;' --path='${wp}'`,
    `echo ${t.wpPath}`,
    `mkdir -p '${backupRoot}' '${deployRoot}'`,
    `ls -1t '${backupRoot}' 2>/dev/null | head -n 1`,
    `wp plugin get ${slug} --field=version --path='${wp}'`,
    `wp plugin activate ${slug} --path='${wp}'`,
    `wp plugin path ${slug} --dir --path='${wp}' 2>/dev/null || echo '${wp}/wp-content/plugins/${slug}'`,
    `(wp sg purge --path='${wp}' 2>/dev/null || wp cache flush --path='${wp}')`,
    `LOG='${wp}/wp-content/debug.log'; if [ -f "$LOG" ]; then tail -n 80 "$LOG"; else echo "debug.log yok"; fi`,
    [
      `TMP=$(mktemp /tmp/wdp-disc-XXXX.php)`,
      `echo 'YmFzZTY0' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" --path='${wp}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n'),
    [
      `TMP=$(mktemp /tmp/wdp-read-XXXX.php)`,
      `echo 'YmFzZTY0' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" --path='${wp}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n'),
    [
      `TMP=$(mktemp /tmp/wdp-canary-XXXX.php)`,
      `echo 'YmFzZTY0' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" --path='${wp}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n'),
    [
      `TMP=$(mktemp /tmp/wdp-cleanup-XXXX.php)`,
      `echo 'YmFzZTY0' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" cleanup --path='${wp}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n'),
    [
      `PLUGIN_DIR=$(wp plugin path ${slug} --path='${wp}' 2>/dev/null || true)`,
      `if [ -n "$PLUGIN_DIR" ] && [ -d "$PLUGIN_DIR" ]; then`,
      `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr '${backupZip}' "$(basename "$PLUGIN_DIR")")`,
      `  ls -1t '${backupRoot}' 2>/dev/null | tail -n +4 | while read -r f; do rm -f '${backupRoot}'/"$f"; done`,
      `fi`,
    ].join('\n'),
    [
      `DIR='${wp}/wp-content/plugins/${slug}'`,
      `echo "plugin_dir=$DIR"`,
      `if [ -d "$DIR" ]; then echo "is_dir=1"; else echo "is_dir=0"; fi`,
      `if [ -f "$DIR/${slug}.php" ]; then echo "has_main=1"; else echo "has_main=0"; fi`,
      `echo -n "file_count="`,
      `if [ -d "$DIR" ]; then find "$DIR" -type f | wc -l | tr -d ' '; else echo 0; fi`,
    ].join('\n'),
    `wp eval 'if (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); }' --path='${wp}'`,
    `(wp sg purge --path='${wp}' 2>/dev/null || true; wp cache flush --path='${wp}' 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' --path='${wp}')`,
    `wp plugin install '${deployRoot}/${slug}-x.zip' --force --activate --path='${wp}'`,
    `rm -f '${deployRoot}/${slug}-x.zip'`,
  ];
  return list;
}

/**
 * Alias + wpPath + siteUrl üçlüsü ve komut içi yollar.
 *
 * @param {{
 *   alias?: string,
 *   wpPath?: string,
 *   siteUrl?: string,
 *   remoteCommand?: string,
 *   rsyncDest?: string,
 * }} opts
 * @returns {{ ok: true, target: RemoteTarget } | { ok: false, reason: string }}
 */
export function checkRemoteTarget(opts = {}) {
  const alias = String(opts.alias || '').trim();
  const wpPath = String(opts.wpPath || '').trim();
  const siteUrl = String(opts.siteUrl || '').trim().replace(/\/$/, '');
  const remoteCommand = String(opts.remoteCommand || '');
  const rsyncDest = String(opts.rsyncDest || '').trim();

  const hay = [alias, wpPath, siteUrl, remoteCommand, rsyncDest].join(' ');
  if (hasBlockedHedefMention(hay)) {
    return deny('Kara liste: hedefdernegi.org (canlı) kesin engelli.'); // live-scan:blacklist-def
  }

  const target = findTargetByAlias(alias);
  if (!target) {
    return deny('SSH alias izin listesinde değil.');
  }

  if (wpPath && wpPath !== target.wpPath) {
    return deny('eşleşmiyor');
  }
  if (siteUrl && siteUrl !== target.siteUrl) {
    return deny('eşleşmiyor');
  }

  const effectiveWp = wpPath || target.wpPath;
  const effectiveUrl = siteUrl || target.siteUrl;
  if (effectiveWp !== target.wpPath || effectiveUrl !== target.siteUrl) {
    return deny('eşleşmiyor');
  }

  const pathCandidates = [
    effectiveWp,
    ...extractPathsFromText(remoteCommand),
    ...extractPathsFromText(rsyncDest),
  ];
  if (rsyncDest) {
    const destPath = rsyncDest.includes(':') ? rsyncDest.slice(rsyncDest.indexOf(':') + 1) : rsyncDest;
    if (destPath) pathCandidates.push(destPath);
  }

  for (const cand of pathCandidates) {
    const inspected = inspectRemotePath(cand);
    if (!inspected.ok) return inspected;
    if (hasBlockedHedefMention(cand)) {
      return deny('Kara liste: hedefdernegi.org (canlı) kesin engelli.'); // live-scan:blacklist-def
    }
    if (!pathInsideAllowedRoot(cand, target.allowedRoot)) {
      return deny('Yol izinli kökün dışında.');
    }
  }

  if (remoteCommand) {
    const cmdInspect = inspectRemoteCommand(remoteCommand, target.allowedRoot);
    if (!cmdInspect.ok) return cmdInspect;
  }

  if (remoteCommand && isWpCliRemoteCommand(remoteCommand)) {
    if (!wpCliHasExactPath(remoteCommand, target.wpPath)) {
      return deny('WP-CLI --path izinli wpPath ile açıkça verilmeli.');
    }
  }

  return { ok: true, target };
}

/**
 * @param {Parameters<typeof checkRemoteTarget>[0]} opts
 */
export function assertRemoteTarget(opts = {}) {
  const r = checkRemoteTarget(opts);
  if (!r.ok) {
    throw new Error(r.reason || 'Uzak hedef reddedildi.');
  }
  return r;
}

/**
 * @param {string} siteUrl
 * @param {string} wpPath
 */
export function matchAllowedTarget(siteUrl, wpPath) {
  const url = String(siteUrl || '').trim().replace(/\/$/, '');
  const p = String(wpPath || '').trim();
  if (hasBlockedHedefMention(url) || hasBlockedHedefMention(p)) {
    return deny('Kara liste: hedefdernegi.org (canlı) kesin engelli.'); // live-scan:blacklist-def
  }
  const hit = ALLOWED_DEPLOY_TARGETS.find((t) => t.siteUrl === url && t.wpPath === p);
  if (hit) return { ok: true, target: hit };
  const byUrl = ALLOWED_DEPLOY_TARGETS.find((t) => t.siteUrl === url);
  if (byUrl && !p) return { ok: true, target: byUrl };
  return deny('DEPLOY_SITE_URL / DEPLOY_WP_PATH izin listesinde değil.');
}

/**
 * .env.deploy* değerleri varsa listedeki kayıtla birebir aynı olmalı (değer yazılmaz).
 * @param {Record<string, string>} env
 * @returns {{ ok: true, target: RemoteTarget } | { ok: false, reason: string }}
 */
export function validateDeployEnv(env) {
  const pathVal = String(env.DEPLOY_WP_PATH || '').trim();
  const siteUrl = String(env.DEPLOY_SITE_URL || '').trim().replace(/\/$/, '');
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();

  if (!alias) {
    return deny('DEPLOY_SSH_ALIAS gerekli.');
  }

  const checked = checkRemoteTarget({
    alias,
    wpPath: pathVal || undefined,
    siteUrl: siteUrl || undefined,
  });
  if (!checked.ok) return checked;

  if (pathVal && !pathVal.startsWith('/') && !pathVal.startsWith('~/') && !pathVal.startsWith('$HOME')) {
    return deny('DEPLOY_WP_PATH mutlak yol veya ~/… olmalı.');
  }

  return { ok: true, target: checked.target };
}

/**
 * E2E taban URL: izin listesi + canlı kara liste.
 * @param {string} baseUrl
 * @param {string[]} [allowedHosts]
 */
export function validateE2EBaseUrl(baseUrl, allowedHosts = []) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return deny('E2E_BASE_URL boş.');
  if (hasBlockedHedefMention(raw)) {
    return deny('Kara liste: hedefdernegi.org (canlı) E2E için kesin engelli.'); // live-scan:blacklist-def
  }
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return deny('E2E_BASE_URL geçerli bir URL değil.');
  }
  const hostBare = host.replace(/^www\./, '');
  const allowed = (allowedHosts || []).map((h) => String(h).toLowerCase().replace(/^www\./, ''));
  if (allowed.length && !allowed.includes(hostBare)) {
    return deny('E2E_BASE_URL host profil izin listesinde değil.');
  }
  const local = hostBare === '127.0.0.1' || hostBare === 'localhost';
  if (local) return { ok: true };
  const urlNorm = raw.replace(/\/$/, '');
  const listed = ALLOWED_DEPLOY_TARGETS.some((t) => t.siteUrl === urlNorm);
  if (!listed) {
    return deny('E2E_BASE_URL izin listesinde değil.');
  }
  return { ok: true };
}

/**
 * Uzak siteurl ile yapılandırılan URL birebir aynı mı?
 * @param {string} remoteSiteUrl
 * @param {string} expectedSiteUrl
 */
export function validateRemoteSiteUrl(remoteSiteUrl, expectedSiteUrl) {
  const remote = String(remoteSiteUrl || '').trim().replace(/\/$/, '');
  const expected = String(expectedSiteUrl || '').trim().replace(/\/$/, '');
  if (!remote || !expected) {
    return deny('Uzak veya beklenen site URL boş.');
  }
  if (hasBlockedHedefMention(remote) || hasBlockedHedefMention(expected)) {
    return deny('Kara liste: hedefdernegi.org (canlı) kesin engelli.'); // live-scan:blacklist-def
  }
  if (remote !== expected) {
    return deny('eşleşmiyor');
  }
  return { ok: true };
}

/**
 * woo-donation-popup.php içinden Version satırını oku.
 * @param {string} pluginPhpSource
 * @returns {string}
 */
export function parsePluginVersion(pluginPhpSource) {
  const text = String(pluginPhpSource || '');
  const m = text.match(/^\s*\*\s*Version:\s*([0-9]+\.[0-9]+\.[0-9]+)/m);
  if (m) return m[1];
  const d = text.match(/define\(\s*'WDP_VERSION'\s*,\s*'([^']+)'\s*\)/);
  return d ? d[1] : '';
}
