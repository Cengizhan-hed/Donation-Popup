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
