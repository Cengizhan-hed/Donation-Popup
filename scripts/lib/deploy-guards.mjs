/**
 * Kurulum kilitleri (ağ gerektirmeyen kontroller).
 *
 * İzinli ship hedefleri YALNIZ bu listedekiler (ALLOWED_DEPLOY_TARGETS).
 * Yeni Hedef staging adresi YALNIZ kullanıcı verince bu listeye eklenir — tek yer burası.
 *
 * 2026-10-22: staging28.hedefdernegi.org ÇIKARILDI (ortam bozuldu; yeni adres bekleniyor).
 * Kara liste: hedefdernegi.org (canlı) — path veya URL sapması durur.
 *
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 * (REMOTE_FREEZE varken ikram da çalışmaz.)
 */

/** Ikram Aid yayına alınmadan önce bu izin KALDIRILACAK. */
export const IKRAM_ALLOW_REMOVAL_NOTE =
  'ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK';

export const RETIRED_HEDEF_STAGING_NOTE =
  'Hedef staging (staging28.hedefdernegi.org) izin listesinden çıkarıldı (2026-10-22 olayı). Yeni adres kullanıcı verene kadar deploy yok.';

/**
 * Canlı Hedef: alt alan adı staging* değilse reddet.
 * www.hedefdernegi.org ve hedefdernegi.org kara listede.
 */
export const LIVE_HOST_BLOCKLIST = [
  /(^|\.)hedefdernegi\.org$/i,
];

/** Eski Hedef staging — yeni adres verilene kadar kesin reddedilir. */
export const RETIRED_HEDEF_STAGING_HOSTS = ['staging28.hedefdernegi.org'];

/**
 * Yeni hedef eklemek için TEK yer. Adres izin listesine yalnız kullanıcı verince eklenir.
 *
 * ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 */
export const ALLOWED_DEPLOY_TARGETS = [
  {
    id: 'ikram-aid',
    hosts: [/(^|\.)ikramaid\.uk$/i],
    urlIncludes: ['ikramaid.uk'],
    pathIncludes: ['ikramaid.uk'],
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
 * @param {string} hostOrUrl
 */
export function isLiveHedefHost(hostOrUrl) {
  const raw = String(hostOrUrl || '').trim().toLowerCase();
  if (!raw) return false;
  if (/\bstaging\d*\./i.test(raw) || raw.includes('staging')) return false;
  const host = extractHost(raw) || raw.replace(/^www\./, '');
  return host === 'hedefdernegi.org' || /(^|\.)hedefdernegi\.org$/.test(host);
}

/**
 * @param {string} hostOrUrl
 */
export function isRetiredHedefStaging(hostOrUrl) {
  const raw = String(hostOrUrl || '').trim().toLowerCase();
  if (!raw) return false;
  return RETIRED_HEDEF_STAGING_HOSTS.some((h) => raw.includes(h));
}

/**
 * @param {string} siteUrl
 * @param {string} wpPath
 */
export function matchAllowedTarget(siteUrl, wpPath) {
  const url = String(siteUrl || '').trim().replace(/\/$/, '').toLowerCase();
  const p = String(wpPath || '').trim().toLowerCase();
  if (isLiveHedefHost(url) || isLiveHedefHost(p) || /\/www\/hedefdernegi\.org\//i.test(p)) {
    return { ok: false, reason: 'Kara liste: hedefdernegi.org (canlı) kesin engelli.' };
  }
  if (isRetiredHedefStaging(url) || isRetiredHedefStaging(p)) {
    return { ok: false, reason: RETIRED_HEDEF_STAGING_NOTE };
  }
  for (const t of ALLOWED_DEPLOY_TARGETS) {
    const urlOk = t.urlIncludes.some((s) => url.includes(s));
    const pathOk = t.pathIncludes.some((s) => p.includes(String(s).toLowerCase()));
    if (urlOk && pathOk) {
      return { ok: true, target: t };
    }
  }
  return {
    ok: false,
    reason:
      'DEPLOY_SITE_URL / DEPLOY_WP_PATH izin listesinde değil. İzinli: ikramaid.uk (Hedef staging adresi kullanıcı verene kadar yok).',
  };
}

/**
 * @param {Record<string, string>} env
 * @returns {{ ok: true, target?: object } | { ok: false, reason: string }}
 */
export function validateDeployEnv(env) {
  const pathVal = String(env.DEPLOY_WP_PATH || '').trim();
  const siteUrl = String(env.DEPLOY_SITE_URL || '').trim().replace(/\/$/, '');
  const alias = String(env.DEPLOY_SSH_ALIAS || '').trim();
  const host = String(env.DEPLOY_SSH_HOST || '').trim();
  const user = String(env.DEPLOY_SSH_USER || '').trim();
  const port = String(env.DEPLOY_SSH_PORT || '').trim();
  const key = String(env.DEPLOY_SSH_KEY || '').trim();

  if (!pathVal || !siteUrl) {
    return {
      ok: false,
      reason: 'Eksik .env.deploy anahtarı: DEPLOY_WP_PATH, DEPLOY_SITE_URL gerekli.',
    };
  }

  if (!alias) {
    if (!host || !user || !port || !key) {
      return {
        ok: false,
        reason:
          'Eksik SSH: DEPLOY_SSH_ALIAS veya DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_PORT, DEPLOY_SSH_KEY gerekli.',
      };
    }
  }

  if (!pathVal.startsWith('/') && !pathVal.startsWith('~/') && !pathVal.startsWith('$HOME')) {
    return {
      ok: false,
      reason: 'DEPLOY_WP_PATH mutlak yol veya ~/… olmalı.',
    };
  }

  const allowed = matchAllowedTarget(siteUrl, pathVal);
  if (!allowed.ok) return allowed;

  return { ok: true, target: allowed.target };
}

/**
 * E2E taban URL: izin listesi + canlı kara liste.
 * @param {string} baseUrl
 * @param {string[]} [allowedHosts]
 */
export function validateE2EBaseUrl(baseUrl, allowedHosts = []) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return { ok: false, reason: 'E2E_BASE_URL boş.' };
  if (isLiveHedefHost(raw)) {
    return { ok: false, reason: 'Kara liste: hedefdernegi.org (canlı) E2E için kesin engelli.' };
  }
  if (isRetiredHedefStaging(raw)) {
    return { ok: false, reason: RETIRED_HEDEF_STAGING_NOTE };
  }
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { ok: false, reason: 'E2E_BASE_URL geçerli bir URL değil.' };
  }
  const allowed = (allowedHosts || []).map((h) => String(h).toLowerCase().replace(/^www\./, ''));
  if (allowed.length && !allowed.includes(host)) {
    return {
      ok: false,
      reason: `E2E_BASE_URL host profil izin listesinde değil (${allowed.join(', ')}).`,
    };
  }
  const urlOk = matchAllowedTarget(raw, raw);
  if (!urlOk.ok) {
    return {
      ok: false,
      reason: urlOk.reason || 'E2E_BASE_URL izin listesinde değil. İzinli: ikramaid.uk.',
    };
  }
  return { ok: true };
}

/**
 * Uzak siteurl ile yapılandırılan URL birebir aynı mı?
 * @param {string} remoteSiteUrl
 * @param {string} expectedSiteUrl
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateRemoteSiteUrl(remoteSiteUrl, expectedSiteUrl) {
  const remote = String(remoteSiteUrl || '').trim().replace(/\/$/, '');
  const expected = String(expectedSiteUrl || '').trim().replace(/\/$/, '');
  if (!remote || !expected) {
    return { ok: false, reason: 'Uzak veya beklenen site URL boş.' };
  }
  if (isLiveHedefHost(remote) || isLiveHedefHost(expected)) {
    return { ok: false, reason: 'Kara liste: hedefdernegi.org (canlı) kesin engelli.' };
  }
  if (isRetiredHedefStaging(remote) || isRetiredHedefStaging(expected)) {
    return { ok: false, reason: RETIRED_HEDEF_STAGING_NOTE };
  }
  if (remote !== expected) {
    return {
      ok: false,
      reason: `Uzak siteurl yapılandırılan DEPLOY_SITE_URL ile eşleşmiyor.`,
    };
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
