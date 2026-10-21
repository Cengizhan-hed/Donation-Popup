/**
 * WooCommerce Coming soon: görünürlüğü değiştirmeden paylaşım çerezi.
 * Option yazılmaz. Anahtar loglanmaz.
 */
import { wp } from './wp-remote.mjs';

/**
 * @param {object} profile
 * @param {Record<string,string>} env
 * @returns {Promise<{ enabled: boolean, method: string }>}
 */
export async function readComingSoonState(profile, env) {
  if (!profile?.comingSoon) {
    return { enabled: false, method: 'off' };
  }
  let enabled = false;
  try {
    const raw = wp(`wp option get woocommerce_coming_soon`);
    enabled = /^(yes|1|true)$/i.test(String(raw).trim());
  } catch {
    enabled = true;
  }
  return { enabled, method: enabled ? 'share-cookie' : 'not-enabled' };
}

/**
 * Paylaşım anahtarını oku (yazmaz). Env anahtarı varsa onu kullan.
 * @param {Record<string,string>} env
 * @returns {string}
 */
export function readShareKey(env) {
  const fromEnv = String(env.E2E_COMING_SOON_SHARE_KEY || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const k = String(wp(`wp option get woocommerce_share_key`) || '').trim();
    if (k && env) env.E2E_COMING_SOON_SHARE_KEY = k;
    return k;
  } catch {
    return '';
  }
}

/**
 * URL sorgu parametresi (görünürlük option yazılmaz).
 * @param {Record<string,string>} env
 * @param {object} profile
 */
export function comingSoonQuery(env, profile) {
  if (!profile?.comingSoon) return {};
  const key = readShareKey(env);
  return key ? { 'woo-share': key } : {};
}

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {object} profile
 * @param {Record<string,string>} env
 */
export async function applyComingSoonBypass(context, profile, env) {
  if (!profile?.comingSoon) return { applied: false, method: 'off' };
  const key = readShareKey(env);
  if (!key) {
    throw new Error(
      'Coming soon açık ama paylaşım anahtarı yok (E2E_COMING_SOON_SHARE_KEY veya woocommerce_share_key). Görünürlük değiştirilmez.'
    );
  }
  let host = '';
  try {
    host = new URL(env.E2E_BASE_URL).hostname;
  } catch {
    host = String(profile.allowedHosts?.[0] || '');
  }
  await context.addCookies([
    {
      name: 'woo-share',
      value: key,
      domain: host.replace(/^www\./, ''),
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
  return { applied: true, method: 'woo-share-cookie' };
}

/**
 * İlk gezinmede ?woo-share= ekle (çerez yedek).
 * @param {string} url
 * @param {Record<string,string>} env
 * @param {object} profile
 */
export function withComingSoonShare(url, env, profile) {
  if (!profile?.comingSoon) return url;
  const key = String(env.E2E_COMING_SOON_SHARE_KEY || '').trim() || readShareKey(env);
  if (!key) return url;
  const u = new URL(url);
  if (!u.searchParams.get('woo-share')) u.searchParams.set('woo-share', key);
  return u.toString();
}
