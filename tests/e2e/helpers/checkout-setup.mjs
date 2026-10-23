/**
 * Ödeme URL’si (WooCommerce wc_get_checkout_url) ve çevrimdışı yöntem.
 * Uzak ortam: YAZMA YOK (cheque/bacs ayarı değiştirilmez, sipariş oluşturulmaz).
 * Sipariş tamamlama yalnız yerel WordPress (test:local-wp).
 */
import { wp, loadDeployEnvSilent } from './wp-remote.mjs';
import { getActiveProfile, peekActiveProfile, isRemoteProfile } from './profile.mjs';
import { parseLocalEvalJson, runLocalEvalFile } from './local-wp-eval.mjs';

function localPageUrl(kind, fallback) {
  if (!process.env.WDP_LOCAL_WP_DIR) return fallback;
  try {
    const data = parseLocalEvalJson(runLocalEvalFile('tests/local-wp/product-meta.php', ['pages-info']));
    const href = String(data?.[kind]?.url || '').trim();
    if (!href) return fallback;
    try {
      return new URL(href).pathname || fallback;
    } catch {
      return href.startsWith('/') ? href : fallback;
    }
  } catch (e) {
    console.error(`[e2e:catch-fail] localPageUrl ${kind}: ${e && e.message ? e.message : e}`);
    return fallback;
  }
}

const OFFLINE = ['cheque', 'bacs', 'cod'];

/**
 * @returns {string}
 */
export function readCheckoutUrl() {
  const profile = peekActiveProfile();
  if (!isRemoteProfile(profile)) return localPageUrl('checkout', '/checkout/');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return '/checkout/';
  const raw = wp(
    `wp eval 'echo function_exists("wc_get_checkout_url") ? wc_get_checkout_url() : "";'`
  );
  return String(raw || '').trim() || '/checkout/';
}

/**
 * @returns {string}
 */
export function readCartUrl() {
  const profile = peekActiveProfile();
  if (!isRemoteProfile(profile)) return localPageUrl('cart', '/cart/');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return '/cart/';
  const raw = wp(
    `wp eval 'echo function_exists("wc_get_cart_url") ? wc_get_cart_url() : "";'`
  );
  return String(raw || '').trim() || '/cart/';
}

/**
 * @param {string} checkoutUrl
 * @param {string} baseUrl
 */
export function checkoutPathFromUrl(checkoutUrl, baseUrl) {
  const raw = String(checkoutUrl || '').trim();
  if (!raw) return '/checkout/';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return `${u.pathname}${u.search}` || '/checkout/';
    }
  } catch {
    /* relative */
  }
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw, String(baseUrl || '').replace(/\/?$/, '/'));
    return `${u.pathname}${u.search}` || '/checkout/';
  } catch {
    return '/checkout/';
  }
}

/**
 * @returns {{ id: string, title: string, enabled: boolean }[]}
 */
export function listPaymentGateways() {
  const profile = peekActiveProfile();
  if (!isRemoteProfile(profile)) {
    return [{ id: 'cheque', title: 'Check payments', enabled: true }];
  }
  const php =
    'if(!function_exists("WC")){echo "[]"; return;} WC()->payment_gateways(); $g=WC()->payment_gateways()->payment_gateways(); $o=array(); foreach((array)$g as $id=>$gw){ $o[]=array("id"=>$id,"title"=>(string)$gw->get_title(),"enabled"=>$gw->enabled==="yes"); } echo wp_json_encode($o);';
  const raw = wp(`wp eval '${php}'`);
  const line = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  try {
    const parsed = JSON.parse(line || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {{id:string,enabled:boolean}[]} gateways
 */
export function pickOfflineGateway(gateways) {
  const list = Array.isArray(gateways) ? gateways : [];
  return list.find((g) => OFFLINE.includes(String(g.id || '')) && g.enabled) || null;
}

function setChequeEnabled() {
  throw new Error(
    'checkout-setup: uzak ortamda woocommerce_cheque_settings yazılmaz (2026-10-22). Sipariş testleri yalnız yerel WP.'
  );
}

/**
 * Hedef: çevrimdışı yöntem yoksa çek’i geçici aç.
 * Ikram / allowMetaMutation=false: yazma yok.
 * @returns {Promise<{
 *   checkoutUrl: string,
 *   cartUrl: string,
 *   offline: {id:string,title:string}|null,
 *   mutated: boolean,
 *   restore: () => void,
 *   skipOrderReason: string
 * }>}
 */
export async function prepareCheckoutEnv() {
  const profile = peekActiveProfile() || getActiveProfile();
  const checkoutUrl = readCheckoutUrl();
  const cartUrl = readCartUrl();
  const gateways = listPaymentGateways();
  const existing = pickOfflineGateway(gateways);
  /** @type {Array<() => void>} */
  const restoreFns = [];

  const restore = () => {
    for (const fn of restoreFns.reverse()) {
      try {
        fn();
      } catch (e) {
        console.error(`[e2e:catch-fail] checkout-restore: ${e && e.message ? e.message : e}`);
      }
    }
  };

  const remote = isRemoteProfile(profile);
  return {
    checkoutUrl,
    cartUrl,
    offline: existing ? { id: existing.id, title: existing.title || existing.id } : null,
    mutated: false,
    restore,
    skipOrderReason: remote
      ? 'uzak ortamda sipariş oluşturulmaz (yalnız yerel WordPress). Ödeme sayfası salt okunur (checkout-view-only).'
      : existing
        ? ''
        : 'Sipariş tamamlama atlandı (çevrimdışı yöntem yok)',
  };
}
