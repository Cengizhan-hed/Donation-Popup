/**
 * Ödeme URL’si (WooCommerce wc_get_checkout_url) ve çevrimdışı yöntem.
 * Hedef staging: çek/BACS geçici açılır, sonra eski haline döner.
 * Ikram: ödeme ayarı YAZILMAZ.
 */
import { wp, loadDeployEnvSilent } from './wp-remote.mjs';
import { getActiveProfile, peekActiveProfile } from './profile.mjs';

const OFFLINE = ['cheque', 'bacs', 'cod'];

/**
 * @returns {string}
 */
export function readCheckoutUrl() {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return '/checkout/';
  const raw = wp(
    `wp eval 'echo function_exists("wc_get_checkout_url") ? wc_get_checkout_url() : "";'`
  );
  return String(raw || '').trim() || '/checkout/';
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

/**
 * @param {'yes'|'no'} flag
 */
function setChequeEnabled(flag) {
  const v = flag === 'yes' ? 'yes' : 'no';
  wp(
    `wp eval '$s=get_option("woocommerce_cheque_settings"); if(!is_array($s))$s=array(); $s["enabled"]="${v}"; update_option("woocommerce_cheque_settings",$s); echo "ok";'`
  );
}

function readChequeEnabled() {
  const php =
    '$s=get_option("woocommerce_cheque_settings"); echo (is_array($s) && isset($s["enabled"]) && $s["enabled"]==="yes") ? "yes" : "no";';
  return String(wp(`wp eval '${php}'`) || '').trim() === 'yes' ? 'yes' : 'no';
}

/**
 * Hedef: çevrimdışı yöntem yoksa çek’i geçici aç.
 * Ikram / allowMetaMutation=false: yazma yok.
 * @returns {Promise<{
 *   checkoutUrl: string,
 *   offline: {id:string,title:string}|null,
 *   mutated: boolean,
 *   restore: () => void,
 *   skipOrderReason: string
 * }>}
 */
export async function prepareCheckoutEnv() {
  const profile = peekActiveProfile() || getActiveProfile();
  const checkoutUrl = readCheckoutUrl();
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

  if (existing) {
    return {
      checkoutUrl,
      offline: { id: existing.id, title: existing.title || existing.id },
      mutated: false,
      restore,
      skipOrderReason: '',
    };
  }

  if (!profile?.allowMetaMutation) {
    return {
      checkoutUrl,
      offline: null,
      mutated: false,
      restore,
      skipOrderReason: `${profile?.id || 'ortam'}: etkin çevrimdışı ödeme yöntemi yok; ödeme ayarı değiştirilmez — sipariş tamamlama atlandı`,
    };
  }

  const prev = readChequeEnabled();
  setChequeEnabled('yes');
  restoreFns.push(() => setChequeEnabled(prev));
  return {
    checkoutUrl,
    offline: { id: 'cheque', title: 'cheque' },
    mutated: true,
    restore,
    skipOrderReason: '',
  };
}
