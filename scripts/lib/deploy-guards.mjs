/**
 * Staging kurulum kilitleri (ağ gerektirmeyen kontroller).
 * Canlı yol veya staging içermeyen URL reddedilir.
 */

/**
 * @param {Record<string, string>} env
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateDeployEnv(env) {
  const path = String(env.DEPLOY_WP_PATH || '').trim();
  const siteUrl = String(env.DEPLOY_SITE_URL || '').trim().replace(/\/$/, '');
  const host = String(env.DEPLOY_SSH_HOST || '').trim();
  const user = String(env.DEPLOY_SSH_USER || '').trim();
  const port = String(env.DEPLOY_SSH_PORT || '').trim();
  const key = String(env.DEPLOY_SSH_KEY || '').trim();

  if (!host || !user || !port || !key || !path || !siteUrl) {
    return {
      ok: false,
      reason:
        'Eksik .env.deploy anahtarı: DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_PORT, DEPLOY_SSH_KEY, DEPLOY_WP_PATH, DEPLOY_SITE_URL gerekli.',
    };
  }

  const pathLower = path.toLowerCase();
  const urlLower = siteUrl.toLowerCase();
  if (!pathLower.includes('staging') || !urlLower.includes('staging')) {
    return {
      ok: false,
      reason:
        'DEPLOY_WP_PATH ve DEPLOY_SITE_URL içinde "staging" geçmeli. Canlıya kurulum desteklenmez.',
    };
  }

  if (!path.startsWith('/')) {
    return {
      ok: false,
      reason: 'DEPLOY_WP_PATH mutlak yol olmalı (ör. /home/customer/www/staging…/public_html). ~ kullanmayın.',
    };
  }

  if (path.includes('/www/hedefdernegi.org/')) {
    return {
      ok: false,
      reason:
        'DEPLOY_WP_PATH canlı site yolunu içeriyor (/www/hedefdernegi.org/). Yalnızca staging yoluna izin verilir.',
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
  if (remote !== expected) {
    return {
      ok: false,
      reason: `Uzak siteurl yapılandırılan DEPLOY_SITE_URL ile eşleşmiyor (beklenen staging adresi).`,
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
