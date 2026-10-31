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

import { gzipSync } from 'node:zlib';

/** Ikram Aid yayına alınmadan önce bu izin KALDIRILACAK. */
/**
 * Kurulum sonrası göç adımı (wp eval gövdesi, tek tırnak içine güvenle girer).
 * 12.0.0+: DonationPanel\\Core\\Version_Migrations (wdp_db_version) + Core\\Migrations (donation_panel_migrations,
 * Release_12_Upgrade dâhil). Yeni sınıf yoksa (12 öncesi sürüm) eski WDP_Migrations'a düşer; ikisi de yoksa sessizce geçer.
 */
export const MIGRATE_EVAL_PHP = String.raw`$vm="DonationPanel\\Core\\Version_Migrations"; $pl="DonationPanel\\Core\\Plugin"; $mg="DonationPanel\\Core\\Migrations"; if (class_exists($vm)) { $vm::maybe_run(); } elseif (class_exists("WDP_Migrations")) { WDP_Migrations::maybe_run(); } if (class_exists($pl) && $pl::instance() && class_exists($mg)) { $pl::instance()->container()->get($mg)->run(); }`;

/** Bağış listesi önbelleği (yeni sınıf: DonationPanel\\Modules\\EntryPoints\\Donations_List). */
export const CACHE_BUMP_EVAL_PHP = String.raw`$dl="DonationPanel\\Modules\\EntryPoints\\Donations_List"; if (class_exists($dl)) { $dl::reset_bump_guard(); $dl::bump_cache(); }`;

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
  const s = unquoteShellWpPath(String(raw || '').trim());
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
 * Kabukta ~ / $HOME açılsın. `--path=~/` kelime ortasında ~ açılmaz;
 * `"$HOME/…"` çift tırnakta $HOME açılır (kilit $HOME→~ normalize eder).
 * Tilde veya $HOME köklü yol → "$HOME/…"  |  mutlak → tek tırnak.
 * @param {string} wpPath
 */
export function shellQuoteWpPath(wpPath) {
  const raw = String(wpPath || '').trim();
  if (!raw) return "''";
  const escSingle = (s) => String(s).replace(/'/g, `'\\''`);
  const escD = (s) => String(s).replace(/["\\]/g, '\\$&');
  if (raw === '~' || raw === '$HOME' || raw === '~/' || raw === '$HOME/') return '"$HOME"';
  if (raw.startsWith('~/')) return `"$HOME/${escD(raw.slice(2))}"`;
  if (raw.startsWith('$HOME/')) return `"$HOME/${escD(raw.slice('$HOME/'.length))}"`;
  return `'${escSingle(raw)}'`;
}

/**
 * @param {string} wpPath
 */
export function wpPathFlag(wpPath) {
  return `--path=${shellQuoteWpPath(wpPath)}`;
}

/**
 * --path=~/'www/x' / --path="$HOME"/'www/x' / --path='/abs' → mantıksal yol.
 * @param {string} raw
 */
export function unquoteShellWpPath(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  const tildeQ = s.match(/^~\/'(.*)'$/);
  if (tildeQ) s = `~/${tildeQ[1].replace(/'\\''/g, "'")}`;
  else {
    const homeSlash = s.match(/^"\$HOME"\/'(.*)'$/);
    const homeConcat = s.match(/^"\$HOME"'(.*)'$/);
    if (homeSlash) s = `$HOME/${homeSlash[1].replace(/'\\''/g, "'")}`;
    else if (homeConcat) {
      const rest = homeConcat[1].replace(/'\\''/g, "'");
      s = rest.startsWith('/') ? `$HOME${rest}` : `$HOME/${rest}`;
    } else if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
      s = s.slice(1, -1).replace(/'\\''/g, "'");
    } else if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1);
    }
  }
  if (s === '$HOME' || s === '$HOME/') return '~';
  if (s.startsWith('$HOME/')) return `~/${s.slice('$HOME/'.length)}`;
  return s;
}

/** --path= değerini (tırnaklı ~/'…' biçimi dahil) yakala. */
export const WP_PATH_FLAG_VALUE_RE =
  /--path(?:=|\s+)(~\/'[^']+'|"\$HOME"\/'[^']+'|"\$HOME"'[^']+'|"[^"]+"|'[^']+'|\S+)/;

/**
 * Uzak komut / argüman metninden yol adayları.
 * @param {string} text
 * @returns {string[]}
 */
export function extractPathsFromText(text) {
  const raw = stripQuotedBase64Blobs(String(text || ''));
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  const add = (p) => {
    const n = unquoteShellWpPath(String(p || '').trim());
    if (!n || n === '~' || n === '~/' || n === '$HOME' || n === '$HOME/' || n === '/home') return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  const pathFlag = new RegExp(WP_PATH_FLAG_VALUE_RE.source, 'g');
  let f;
  while ((f = pathFlag.exec(raw))) {
    add(f[1] || '');
  }

  const quotedHome = /(?:~\/|"\$HOME"\/|"\$HOME")'([^']+)'/g;
  let q;
  while ((q = quotedHome.exec(raw))) {
    if (q[0].startsWith('~/')) add(`~/${q[1]}`);
    else add(`$HOME/${String(q[1] || '').replace(/^\//, '')}`);
  }

  const re =
    /(?:^|[\s"'=]|--path=)(\$HOME\/[^\s"'`;|&]+|~\/[^\s"'`;|&]+|\/home\/[^\s"'`;|&]+)/g;
  let m;
  while ((m = re.exec(raw))) {
    add(String(m[1] || '').replace(/[\\/,;.]+$/, ''));
  }
  return out;
}

/**
 * Salt okunur sunucu cron ipucu: yalnız evet/hayır yazar, crontab satırı ASLA yazılmaz.
 * (`crontab -l` çıktısı doğrudan grep -q'ya gider; ekrana düşmez.)
 * Guard yalnız TAM bu dizgeyi WP-CLI --path kuralından muaf tutar (isCronCrontabHintCommand).
 */
export const CRON_CRONTAB_HINT_COMMAND =
  "if crontab -l 2>/dev/null | grep -qE 'wp-cron\\.php|wp cron event run'; then echo crontab_wp_cron=yes; else echo crontab_wp_cron=no; fi";

/**
 * Tam sabit dizge eşleşmesi (kırpma/normalleştirme yok).
 * @param {string} cmd
 */
export function isCronCrontabHintCommand(cmd) {
  return typeof cmd === 'string' && cmd === CRON_CRONTAB_HINT_COMMAND;
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
  const m = s.match(WP_PATH_FLAG_VALUE_RE);
  if (!m) return false;
  const got = unquoteShellWpPath(m[1] || '');
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

/** `base64 -d` boş/başarısız → eval-file çağrılmaz. */
export const EVAL_FILE_EMPTY_EXIT = 97;

/**
 * Tek tırnaklı uzun base64 gövdelerini yol taramasından çıkar
 * (`/home/` alt dizgisi yanlış pozitif üretmesin).
 * @param {string} text
 */
export function stripQuotedBase64Blobs(text) {
  return String(text || '').replace(/'([A-Za-z0-9+/=\n]{32,})'/g, "''");
}

/**
 * Ham base64 (dosya içeriği) → gzip+base64. Uzak `fold -w 76` MIME satırları
 * OpenSSL `base64 -d`'nin uzun satırda sessiz 0 bayt üretmesini önler.
 * @param {string} b64
 */
export function gzipBase64Payload(b64) {
  const raw = Buffer.from(String(b64 || ''), 'base64');
  return gzipSync(raw).toString('base64');
}

/**
 * @param {string} gzB64
 * @param {string} destRef  örn. `"$TMP"`
 * @param {string[]} rmRefs
 * @returns {string[]}
 */
function decodeGzipPayloadLines(gzB64, destRef, rmRefs) {
  const rm = rmRefs.join(' ');
  return [
    `printf '%s\\n' '${gzB64}' | fold -w 76 | base64 -d | gzip -dc > ${destRef} || { rm -f ${rm}; exit ${EVAL_FILE_EMPTY_EXIT}; }`,
    `[ -s ${destRef} ] || { rm -f ${rm}; exit ${EVAL_FILE_EMPTY_EXIT}; }`,
  ];
}

/**
 * WP-CLI `eval-file` `--foo` bayrağını komut parametresi sanır (unknown --explain).
 * PHP dosyasına giden argüman konumsal olmalı; `--flag` varsa `--` sonrası.
 * @param {string} [extraArgs]
 * @returns {string} başında boşluk, yoksa ''
 */
export function evalFileScriptArgs(extraArgs) {
  const extra = String(extraArgs || '').trim();
  if (!extra) return '';
  if (extra === '--' || extra.startsWith('-- ')) return ` ${extra}`;
  if (/(?:^|\s)--[A-Za-z]/.test(extra)) return ` -- ${extra}`;
  return ` ${extra}`;
}

/**
 * Yalnız `WDP_E2E_*` anahtarları. WP-CLI bayrağı yerine ortam değişkeni.
 * @param {Record<string, string>|null|undefined} extraEnv
 * @returns {string} `KEY='val' ` veya ''
 */
export function evalFileEnvPrefix(extraEnv) {
  if (!extraEnv || typeof extraEnv !== 'object') return '';
  const parts = [];
  for (const [k, v] of Object.entries(extraEnv)) {
    if (!/^WDP_E2E_[A-Z0-9_]+$/.test(k)) {
      throw new Error(`eval-file: izinli olmayan env anahtarı ${k}`);
    }
    parts.push(`${k}='${String(v).replace(/'/g, `'\\''`)}'`);
  }
  return parts.length ? `${parts.join(' ')} ` : '';
}

/**
 * Salt okunur uzak eval-file kalıbı: `wp --path=<wpPath> eval-file …`
 * Payload gzip+base64; `base64 -d` boş/başarısızsa çıkış 97.
 * @param {string} wpPath
 * @param {{ tmpPrefix?: string, extraArgs?: string, extraEnv?: Record<string,string>, b64?: string, envFile?: { envName: string, b64: string, suffix?: string } }} [opts]
 */
export function buildGuardedEvalFileCommand(wpPath, opts = {}) {
  const prefix = String(opts.tmpPrefix || 'wdp-eval').replace(/[^a-z0-9-]/gi, '') || 'wdp-eval';
  const extra = evalFileScriptArgs(opts.extraArgs);
  const envPrefix = evalFileEnvPrefix(opts.extraEnv);
  const b64 = opts.b64 == null ? 'YmFzZTY0' : String(opts.b64);
  const flag = wpPathFlag(wpPath);
  const phpGz = gzipBase64Payload(b64);
  const envFile = opts.envFile;
  const hasEnv =
    envFile &&
    String(envFile.envName || '') &&
    envFile.b64 != null &&
    String(envFile.b64) !== '';
  /** @type {string[]} */
  const lines = [`TMP=$(mktemp /tmp/${prefix}-XXXX.php)`];
  /** @type {string[]} */
  const rmRefs = ['"$TMP"'];
  if (hasEnv) {
    const suffix = String(envFile.suffix || '.json').replace(/[^a-z0-9._-]/gi, '') || '.json';
    lines.push(`ENVF=$(mktemp /tmp/${prefix}-XXXX${suffix})`);
    rmRefs.push('"$ENVF"');
  }
  lines.push(...decodeGzipPayloadLines(phpGz, '"$TMP"', rmRefs));
  let wpPrefix = '';
  if (hasEnv) {
    const envName = String(envFile.envName).replace(/[^A-Z0-9_]/g, '');
    const envGz = gzipBase64Payload(String(envFile.b64));
    lines.push(...decodeGzipPayloadLines(envGz, '"$ENVF"', rmRefs));
    wpPrefix = `${envName}="$ENVF" `;
  }
  lines.push(
    `${envPrefix}${wpPrefix}wp ${flag} eval-file "$TMP"${extra}`,
    `EC=$?`,
    `rm -f ${rmRefs.join(' ')}`,
    `exit $EC`
  );
  return lines.join('\n');
}

/**
 * Betiklerin ürettiği gerçek uzak komut kalıpları (ağ yok; dry-run üretimi).
 * @param {RemoteTarget} target
 * @returns {string[]}
 */
export function plannedRemoteCommands(target) {
  const t = target || {};
  const flag = wpPathFlag(t.wpPath);
  const root = String(t.allowedRoot || '').replace(/\/$/, '');
  const backupRoot = `${root}/wdp-backups`;
  const deployRoot = `${root}/wdp-deploy`;
  const slug = 'woo-donation-popup';
  const pluginDir = `${t.wpPath}/wp-content/plugins/${slug}`;
  const debugLog = `${t.wpPath}/wp-content/debug.log`;
  const backupZip = `${backupRoot}/${slug}-pre-x.zip`;
  const qBackup = shellQuoteWpPath(backupRoot);
  const qDeploy = shellQuoteWpPath(deployRoot);
  const qPlugin = shellQuoteWpPath(pluginDir);
  const qLog = shellQuoteWpPath(debugLog);
  const qZip = shellQuoteWpPath(`${deployRoot}/${slug}-x.zip`);
  const qBackupZip = shellQuoteWpPath(backupZip);
  const list = [
    `wp option get siteurl ${flag}`,
    `wp eval 'echo 1;' ${flag}`,
    `echo ${shellQuoteWpPath(t.wpPath)}`,
    `mkdir -p ${qBackup} ${qDeploy}`,
    `ls -1t ${qBackup} 2>/dev/null | head -n 1`,
    `wp plugin get ${slug} --field=version ${flag}`,
    `wp plugin activate ${slug} ${flag}`,
    `wp plugin path ${slug} --dir ${flag} 2>/dev/null || echo ${qPlugin}`,
    `(wp sg purge ${flag} 2>/dev/null || wp cache flush ${flag})`,
    `LOG=${qLog}; if [ -f "$LOG" ]; then tail -n 80 "$LOG"; else echo "debug.log yok"; fi`,
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-disc' }),
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-read' }),
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-canary' }),
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-mig' }),
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-eval' }),
    buildGuardedEvalFileCommand(t.wpPath, { tmpPrefix: 'wdp-cleanup', extraArgs: 'cleanup' }),
    [
      `PLUGIN_DIR=$(wp plugin path ${slug} ${flag} 2>/dev/null || true)`,
      `if [ -n "$PLUGIN_DIR" ] && [ -d "$PLUGIN_DIR" ]; then`,
      `  (cd "$(dirname "$PLUGIN_DIR")" && zip -qr ${qBackupZip} "$(basename "$PLUGIN_DIR")")`,
      `  ls -1t ${qBackup} 2>/dev/null | tail -n +4 | while read -r f; do rm -f ${qBackup}/"$f"; done`,
      `fi`,
    ].join('\n'),
    [
      `DIR=${qPlugin}`,
      `echo "plugin_dir=$DIR"`,
      `if [ -d "$DIR" ]; then echo "is_dir=1"; else echo "is_dir=0"; fi`,
      `if [ -f "$DIR/${slug}.php" ]; then echo "has_main=1"; else echo "has_main=0"; fi`,
      `echo -n "file_count="`,
      `if [ -d "$DIR" ]; then find "$DIR" -type f | wc -l | tr -d ' '; else echo 0; fi`,
    ].join('\n'),
    `wp eval '${MIGRATE_EVAL_PHP}' ${flag}`,
    `(wp sg purge ${flag} 2>/dev/null || true; wp cache flush ${flag} 2>/dev/null || true; wp eval 'if (function_exists("wp_cache_flush")) { wp_cache_flush(); } ${CACHE_BUMP_EVAL_PHP}' ${flag})`,
    `wp plugin install ${qZip} --force --activate ${flag}`,
    `rm -f ${qZip}`,
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

  // Tek istisna: tam sabit salt-okur cron ipucu (başka kabuk komutu geçmez).
  if (remoteCommand && !isCronCrontabHintCommand(remoteCommand) && isWpCliRemoteCommand(remoteCommand)) {
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

/** .env.deploy* / .env.e2e* içinde uzak hedef için kullanılmayan anahtarlar. */
export const REMOTE_TARGET_ENV_KEYS = Object.freeze([
  'DEPLOY_SITE_URL',
  'DEPLOY_WP_PATH',
  'DEPLOY_SSH_ALIAS',
  'DEPLOY_SSH_HOST',
  'DEPLOY_SSH_USER',
  'DEPLOY_SSH_PORT',
  'DEPLOY_SSH_KEY',
  'E2E_BASE_URL',
]);

/**
 * @param {RemoteTarget} target
 * @returns {Record<string, string>}
 */
export function envTargetFromAllowlist(target) {
  const t = target || {};
  return {
    DEPLOY_SSH_ALIAS: String(t.sshAlias || '').trim(),
    DEPLOY_WP_PATH: String(t.wpPath || '').trim(),
    DEPLOY_SITE_URL: String(t.siteUrl || '').trim().replace(/\/$/, ''),
    DEPLOY_SSH_HOST: '',
    DEPLOY_SSH_USER: '',
    DEPLOY_SSH_PORT: '',
    DEPLOY_SSH_KEY: '',
  };
}

/**
 * Uyarı metni değer içermez (URL/yol/alias yazılmaz).
 * @param {string} fileName
 * @param {boolean} [blacklisted]
 */
export function formatIgnoredTargetWarning(fileName, blacklisted = false) {
  const name = String(fileName || '.env').replace(/^.*[/\\]/, '') || '.env';
  if (blacklisted) {
    return `UYARI: ${name} içindeki hedef anahtarları KARA LİSTE (kullanılmıyor; profil tek kaynak)`;
  }
  return `UYARI: ${name} içindeki hedef anahtarları kullanılmıyor (profil tek kaynak)`;
}

/**
 * Env hedef anahtarlarını incele; asla kullanma. Değer döndürmez.
 *
 * @param {Record<string, string>} parsed
 * @param {string} fileName
 * @param {RemoteTarget} listed
 * @returns {{ hasTargetKeys: boolean, differs: boolean, blacklisted: boolean, warning: string }}
 */
export function inspectEnvTargetKeys(parsed, fileName, listed) {
  const env = parsed && typeof parsed === 'object' ? parsed : {};
  /** @type {Record<string, string>} */
  const present = {};
  for (const k of REMOTE_TARGET_ENV_KEYS) {
    const v = String(env[k] ?? '').trim();
    if (v) present[k] = v;
  }
  const hay = Object.values(present).join('\n');
  const blacklisted = hasBlockedHedefMention(hay);
  const envAlias = present.DEPLOY_SSH_ALIAS || '';
  const envWp = present.DEPLOY_WP_PATH || '';
  const listedUrl = String(listed?.siteUrl || '')
    .trim()
    .replace(/\/$/, '');
  const deployUrl = String(present.DEPLOY_SITE_URL || '').replace(/\/$/, '');
  const e2eUrl = String(present.E2E_BASE_URL || '').replace(/\/$/, '');
  const connectionOverride = Boolean(
    present.DEPLOY_SSH_HOST ||
      present.DEPLOY_SSH_USER ||
      present.DEPLOY_SSH_PORT ||
      present.DEPLOY_SSH_KEY
  );
  const differs = Boolean(
    (envAlias && envAlias !== listed?.sshAlias) ||
      (envWp && envWp !== listed?.wpPath) ||
      (deployUrl && deployUrl !== listedUrl) ||
      (e2eUrl && e2eUrl !== listedUrl) ||
      connectionOverride
  );
  const hasTargetKeys = Object.keys(present).length > 0;
  let warning = '';
  if (blacklisted) warning = formatIgnoredTargetWarning(fileName, true);
  else if (hasTargetKeys && differs) warning = formatIgnoredTargetWarning(fileName, false);
  return {
    hasTargetKeys,
    differs: Boolean(differs || blacklisted),
    blacklisted,
    warning,
  };
}

/**
 * Uzak hedef = izin listesi. Env hedef anahtarları yok sayılır.
 *
 * @param {Record<string, string>} parsed
 * @param {RemoteTarget} listed
 * @param {string} fileName
 * @returns {{ env: Record<string, string>, target: RemoteTarget, warning: string, blacklisted: boolean }}
 */
export function applyAllowlistOverEnv(parsed, listed, fileName) {
  if (!listed || !listed.sshAlias) {
    throw new Error('SSH alias izin listesinde değil.');
  }
  const inspect = inspectEnvTargetKeys(parsed, fileName, listed);
  return {
    env: envTargetFromAllowlist(listed),
    target: listed,
    warning: inspect.warning,
    blacklisted: inspect.blacklisted,
  };
}

/**
 * .env.deploy* hedef anahtarları kullanılmaz (profil + izin listesi tek kaynak).
 * Alias izinliyse path/url farklı olsa da listedeki hedef döner; uyarı değer yazmaz.
 * @param {Record<string, string>} env
 * @returns {{ ok: true, target: RemoteTarget, env: Record<string, string>, warning: string } | { ok: false, reason: string }}
 */
export function validateDeployEnv(env) {
  const alias = String(env?.DEPLOY_SSH_ALIAS || '').trim();
  if (!alias) {
    return deny('DEPLOY_SSH_ALIAS gerekli.');
  }
  const listed = findTargetByAlias(alias);
  if (!listed) {
    return deny('SSH alias izin listesinde değil.');
  }
  const applied = applyAllowlistOverEnv(env, listed, '.env.deploy');
  return {
    ok: true,
    target: applied.target,
    env: applied.env,
    warning: applied.warning,
  };
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
