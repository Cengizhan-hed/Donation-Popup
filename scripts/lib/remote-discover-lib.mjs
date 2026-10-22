/**
 * Uzak keşif: sabit salt okunur komut listesi, katalog, temizleyici.
 * Ağ yok; spawn yok. Uzak koşu scripts/remote-discover.mjs içinden geçer.
 */
import { createHash } from 'node:crypto';
import { wpPathFlag } from './deploy-guards.mjs';

export const CANARY_EVAL_FILE = 'tests/e2e/helpers/canary-snapshot.php';
export const WDP_SLUG = 'woo-donation-popup';

export const BLOCKED_ACTIVE_SLUGS = [
  'facebook-for-woocommerce',
  'official-facebook-pixel',
  'google-listings-and-ads',
  'google-site-kit',
];

export const WRITE_PHP_RE =
  /update_|delete_|wp_insert|wp_update|wp_delete|add_option|do_action|apply_filters|wp_schedule|spawn_cron/;

export const WRITE_TAIL_RE =
  /\boption\s+(update|delete|add|set)\b|\bpost\s+(create|update|delete)\b|(?:^|\s)user(?:\s|$)|(?<![a-z])db\s+query\b|\bplugin\s+(activate|deactivate|install|delete)\b/i;

export const CATEGORY_LABELS = {
  measurement: 'ölçüm/pixel/analitik',
  marketing: 'pazarlama/e-posta listesi',
  webhook: 'webhook/otomasyon',
  sms: 'SMS',
  smtp: 'e-posta gönderici/SMTP',
  payment: 'ödeme',
  abandoned_cart: 'terk edilmiş sepet',
  crm: 'CRM',
  cache_cdn: 'önbellek/CDN',
  unclassified: 'sınıflandırılmadı',
};

/** Bilinen giden-veri eklenti kataloğu (slug → kategori). */
export const PLUGIN_CATALOG = {
  'google-site-kit': 'measurement',
  'google-listings-and-ads': 'measurement',
  'google-analytics-for-woocommerce': 'measurement',
  'woocommerce-google-analytics-integration': 'measurement',
  'facebook-for-woocommerce': 'measurement',
  'official-facebook-pixel': 'measurement',
  'pixelyoursite': 'measurement',
  'pixel-caffeine': 'measurement',
  'pixel-manager-for-woocommerce': 'measurement',
  'duracelltomi-google-tag-manager': 'measurement',
  'gtm4wp': 'measurement',
  'hotjar': 'measurement',
  'google-analytics-dashboard-for-wp': 'measurement',
  'google-analytics-premium': 'measurement',
  'exactmetrics': 'measurement',
  'ga-google-analytics': 'measurement',
  'independent-analytics': 'measurement',
  'burst-statistics': 'measurement',
  'matomo': 'measurement',
  'plausible-analytics': 'measurement',
  'microsoft-clarity': 'measurement',
  'tiktok-for-business': 'measurement',
  'tiktok-for-woocommerce': 'measurement',
  'pinterest-for-woocommerce': 'measurement',
  'mailchimp-for-woocommerce': 'marketing',
  'mailchimp-for-wp': 'marketing',
  'klaviyo': 'marketing',
  'klaviyo-for-woocommerce': 'marketing',
  'omnisend-connect': 'marketing',
  'mailpoet': 'marketing',
  'newsletter': 'marketing',
  'creative-mail-by-constant-contact': 'marketing',
  'hubspot-for-woocommerce': 'marketing',
  'leadin': 'marketing',
  'activecampaign-subscription-forms': 'marketing',
  'convertkit': 'marketing',
  'mailin': 'marketing',
  'brevo': 'marketing',
  'wp-webhooks': 'webhook',
  'wp-webhooks-pro': 'webhook',
  'automatewoo': 'webhook',
  'woocommerce-zapier': 'webhook',
  'uncanny-automator': 'webhook',
  'wp-sms': 'sms',
  'woocommerce-order-sms': 'sms',
  'netgsm': 'sms',
  'iletimerkezi-sms': 'sms',
  'twilio-sms': 'sms',
  'wp-mail-smtp': 'smtp',
  'wp-mail-smtp-pro': 'smtp',
  'fluent-smtp': 'smtp',
  'easy-wp-smtp': 'smtp',
  'post-smtp': 'smtp',
  'smtp-mailer': 'smtp',
  'gmail-smtp': 'smtp',
  'sendgrid-email-delivery-simplified': 'smtp',
  'mailgun': 'smtp',
  'wp-ses': 'smtp',
  'wp-offload-ses': 'smtp',
  'woocommerce-payments': 'payment',
  'woocommerce-gateway-stripe': 'payment',
  'woocommerce-gateway-paypal': 'payment',
  'woocommerce-paypal-payments': 'payment',
  'woocommerce-gateway-cod': 'payment',
  'woocommerce-gateway-bacs': 'payment',
  'woocommerce-gateway-cheque': 'payment',
  'stripe': 'payment',
  'iyzico-woocommerce': 'payment',
  'paytr-sanal-pos-woocommerce': 'payment',
  'mollie-payments-for-woocommerce': 'payment',
  'klarna-payments-for-woocommerce': 'payment',
  'woocommerce-abandoned-cart': 'abandoned_cart',
  'woo-save-abandoned-carts': 'abandoned_cart',
  'cartbounty-abandoned-carts': 'abandoned_cart',
  'retainful-next-order-coupon': 'abandoned_cart',
  'fluent-crm': 'crm',
  'groundhogg': 'crm',
  'zero-bs-crm': 'crm',
  'jetpack-crm': 'crm',
  'sg-cachepress': 'cache_cdn',
  'litespeed-cache': 'cache_cdn',
  'w3-total-cache': 'cache_cdn',
  'wp-super-cache': 'cache_cdn',
  'wp-fastest-cache': 'cache_cdn',
  'wp-rocket': 'cache_cdn',
  'autoptimize': 'cache_cdn',
  'breeze': 'cache_cdn',
  'nitropack': 'cache_cdn',
  'redis-cache': 'cache_cdn',
  'cloudflare': 'cache_cdn',
  'wp-optimize': 'cache_cdn',
  'hummingbird-performance': 'cache_cdn',
  'cache-enabler': 'cache_cdn',
};

export const STATIC_SCAN_HOOKS = [
  'woocommerce_add_to_cart',
  'woocommerce_cart_item_set_quantity',
  'woocommerce_cart_updated',
  'woocommerce_before_calculate_totals',
  'init',
  'wp_loaded',
  'wp',
  'template_redirect',
  'wp_head',
  'wp_footer',
  'wp_enqueue_scripts',
  'woocommerce_after_single_product',
  'woocommerce_thankyou',
  'woocommerce_new_order',
  'woocommerce_order_status_changed',
  'shutdown',
];

export const OUTBOUND_CALL_TYPES = [
  'wp_remote_*',
  'wp_safe_remote_*',
  'WP_Http',
  'curl_*',
  'fsockopen',
  'stream_socket_client',
  'file_get_contents_http',
  'wp_mail',
  'WC_mailer',
  'send',
];

export const CRON_ORPHAN = 'sahipsiz — çalışınca hiçbir şey yapmaz';

export const STATIC_SCAN_LIMITATION =
  'Geri çağrı başka fonksiyonları çağırıyorsa yalnız bir seviye derinlik taranır; kancalar/cron/snippet tetiklenmez.';

function wdpWordChar(ch) {
  return /[A-Za-z0-9_]/.test(ch || '');
}

function countFnCalls(src, fn) {
  let n = 0;
  let p = 0;
  const s = String(src);
  while ((p = s.indexOf(fn, p)) !== -1) {
    const before = p > 0 ? s[p - 1] : '';
    if (wdpWordChar(before)) {
      p += fn.length;
      continue;
    }
    let i = p + fn.length;
    if (i < s.length && wdpWordChar(s[i])) {
      p += fn.length;
      continue;
    }
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (s[i] === '(') n += 1;
    p += fn.length;
  }
  return n;
}

function countPrefixCalls(src, prefix) {
  let n = 0;
  let p = 0;
  const s = String(src);
  while ((p = s.indexOf(prefix, p)) !== -1) {
    const before = p > 0 ? s[p - 1] : '';
    if (wdpWordChar(before)) {
      p += prefix.length;
      continue;
    }
    let i = p + prefix.length;
    while (i < s.length && wdpWordChar(s[i])) i += 1;
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (s[i] === '(') n += 1;
    p += prefix.length;
  }
  return n;
}

/** Sahte kaynaklarda giden çağrı türü + adet (PHP EVAL ile aynı iğneler). */
export function detectOutboundCalls(source) {
  const src = String(source || '');
  const counts = {};
  const add = (type, n) => {
    if (n > 0) counts[type] = n;
  };
  add('wp_remote_*', countPrefixCalls(src, 'wp_remote_'));
  add('wp_safe_remote_*', countPrefixCalls(src, 'wp_safe_remote_'));
  add('WP_Http', (src.match(/\bWP_Http\b/g) || []).length);
  add('curl_*', countPrefixCalls(src, 'curl_'));
  add('fsockopen', countFnCalls(src, 'fsockopen'));
  add('stream_socket_client', countFnCalls(src, 'stream_socket_client'));
  add('file_get_contents_http', (src.match(/file_get_contents\s*\(\s*['"]https?:/g) || []).length);
  add('wp_mail', countFnCalls(src, 'wp_mail'));
  add('WC_mailer', (src.match(/WC\s*\(\s*\)\s*->\s*mailer\s*\(/g) || []).length);
  add('send', (src.match(/->\s*send\s*\(/g) || []).length);
  return counts;
}

export function detectSnippetHooks(code) {
  const hooks = [];
  const re = /add_(?:action|filter)\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(String(code || ''))) !== null) hooks.push(m[1]);
  return [...new Set(hooks)];
}

export function scrubSnippetRow(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  let calls = s.calls && typeof s.calls === 'object' && !Array.isArray(s.calls) ? { ...s.calls } : {};
  let hooks = Array.isArray(s.hooks) ? s.hooks.map(String) : [];
  if (typeof s.code === 'string' && s.code) {
    const fromCode = detectOutboundCalls(s.code);
    for (const [k, v] of Object.entries(fromCode)) {
      calls[k] = Math.max(Number(calls[k] || 0), Number(v) || 0);
    }
    hooks = [...new Set([...hooks, ...detectSnippetHooks(s.code)])];
  }
  const callCount = Object.values(calls).reduce((a, b) => a + Number(b || 0), 0);
  return {
    id: Number(s.id) || 0,
    scope: String(s.scope || ''),
    priority: Number.isFinite(Number(s.priority)) ? Number(s.priority) : 10,
    active: s.active === true || s.active === 1 || s.active === '1' ? 1 : 0,
    hooks,
    calls,
    count: callCount,
  };
}

export function formatCallTypes(calls) {
  const entries = Object.entries(calls || {}).filter(([, n]) => Number(n) > 0);
  if (!entries.length) return '—';
  return entries.map(([t, n]) => `${t}×${n}`).join(', ');
}

export function sourceLabel(kind, slug) {
  const k = String(kind || '');
  const s = String(slug || '');
  if (k === 'snippet') return 'snippet';
  if (k === 'core') return 'core';
  if (k === 'theme') return s ? `theme:${s}` : 'theme';
  if (k === 'plugin' || k === 'mu-plugin') return s || k;
  return s ? `${k}:${s}` : k || '—';
}

export function cronOwnerLabel(owner) {
  const o = String(owner || '').trim();
  if (!o || o === 'sahipsiz') return CRON_ORPHAN;
  return o;
}

export function hasOutboundCallTypes(calls) {
  return Object.entries(calls || {}).some(
    ([k, n]) => OUTBOUND_CALL_TYPES.includes(k) && Number(n) > 0
  );
}

export function mailDoNotSend(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

const CLASSIFY_PATTERNS = [
  [/sms|twilio|netgsm|iletimerkezi|messagebird|vonage/, 'sms'],
  [/smtp|wp-mail-smtp|fluent-smtp|post-smtp|mailgun|sendgrid|ses/, 'smtp'],
  [/abandoned[-_]?cart|cartbounty|retainful|recart/, 'abandoned_cart'],
  [/pixel|analytics|gtm|tag-manager|hotjar|clarity|matomo|plausible|fathom/, 'measurement'],
  [/mailchimp|klaviyo|omnisend|mailpoet|hubspot|brevo|sendinblue|convertkit/, 'marketing'],
  [/zapier|webhook|automatewoo|automator|n8n/, 'webhook'],
  [/gateway|stripe|paypal|iyzico|paytr|mollie|klarna|adyen|razorpay|payoneer/, 'payment'],
  [/fluent-crm|groundhogg|civicrm|salesforce|zoho-crm/, 'crm'],
  [/cache|litespeed|cloudflare|rocket|cdn|redis|memcached|nitropack|hummingbird/, 'cache_cdn'],
];

export const EVAL_STACK = `
$th = wp_get_theme();
$child = (string) $th->get_stylesheet();
$parent = (string) $th->get_template();
$out = array(
  "php" => PHP_VERSION,
  "wp" => (string) get_bloginfo("version"),
  "wc" => defined("WC_VERSION") ? (string) WC_VERSION : "",
  "theme" => $child,
  "parent_theme" => $parent,
  "locale" => (string) get_locale(),
  "wplang" => (string) get_option("WPLANG"),
  "multisite" => is_multisite() ? 1 : 0
);
echo json_encode($out);
`;

export const EVAL_PLUGINS = `
if (!function_exists("get_plugins")) {
  require_once ABSPATH . "wp-admin/includes/plugin.php";
}
$list = array();
foreach (get_plugins() as $file => $data) {
  $slug = dirname((string) $file);
  if ($slug === "." || $slug === "") {
    $slug = basename((string) $file, ".php");
  }
  $list[] = array(
    "slug" => $slug,
    "status" => is_plugin_active($file) ? "active" : "inactive",
    "version" => isset($data["Version"]) ? (string) $data["Version"] : ""
  );
}
if (function_exists("get_mu_plugins")) {
  foreach (get_mu_plugins() as $file => $data) {
    $list[] = array(
      "slug" => basename((string) $file, ".php"),
      "status" => "must-use",
      "version" => isset($data["Version"]) ? (string) $data["Version"] : ""
    );
  }
}
if (function_exists("get_dropins")) {
  foreach (get_dropins() as $file => $data) {
    $list[] = array(
      "slug" => (string) $file,
      "status" => "dropin",
      "version" => isset($data["Version"]) ? (string) $data["Version"] : ""
    );
  }
}
echo json_encode(array("plugins" => $list));
`;

export const EVAL_HOOKS = `
function wdp_disc_cb_file($fn) {
  try {
    if (is_string($fn) && strpos($fn, "::") !== false) {
      $parts = explode("::", $fn, 2);
      $r = new ReflectionMethod($parts[0], $parts[1]);
      return (string) $r->getFileName();
    }
    if (is_string($fn) && function_exists($fn)) {
      $r = new ReflectionFunction($fn);
      return (string) $r->getFileName();
    }
    if ($fn instanceof Closure) {
      $r = new ReflectionFunction($fn);
      return (string) $r->getFileName();
    }
    if (is_array($fn) && isset($fn[0]) && isset($fn[1])) {
      $r = new ReflectionMethod($fn[0], $fn[1]);
      return (string) $r->getFileName();
    }
    if (is_object($fn)) {
      $r = new ReflectionMethod($fn, "__invoke");
      return (string) $r->getFileName();
    }
  } catch (Throwable $ex) {
    return "";
  }
  return "";
}
function wdp_disc_origin($file) {
  $file = str_replace("\\\\", "/", (string) $file);
  $mark = "/wp-content/plugins/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    return array("kind" => "plugin", "slug" => $slug);
  }
  $mark = "/wp-content/mu-plugins/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    $slug = explode(".", $slug)[0];
    return array("kind" => "mu-plugin", "slug" => $slug);
  }
  $mark = "/wp-content/themes/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    return array("kind" => "theme", "slug" => $slug);
  }
  return array("kind" => "core", "slug" => "core");
}
$hooks = array(
  "woocommerce_add_to_cart",
  "woocommerce_cart_item_set_quantity",
  "woocommerce_cart_updated",
  "woocommerce_before_calculate_totals",
  "init",
  "wp_loaded",
  "wp",
  "template_redirect",
  "wp_head",
  "wp_footer",
  "wp_enqueue_scripts",
  "woocommerce_after_single_product",
  "woocommerce_thankyou",
  "woocommerce_checkout_order_processed",
  "woocommerce_new_order",
  "woocommerce_order_status_changed",
  "shutdown",
  "wp_login"
);
global $wp_filter;
$out = array();
foreach ($hooks as $h) {
  $counts = array();
  $cb_lists = array();
  if (isset($wp_filter[$h])) {
    $f = $wp_filter[$h];
    if (is_object($f) && isset($f->callbacks)) {
      $cb_lists = $f->callbacks;
    } else if (is_array($f)) {
      $cb_lists = $f;
    }
  }
  foreach ((array) $cb_lists as $group) {
    foreach ((array) $group as $cb) {
      $fn = is_array($cb) && isset($cb["function"]) ? $cb["function"] : null;
      $file = wdp_disc_cb_file($fn);
      $o = wdp_disc_origin($file);
      $key = $o["kind"] . ":" . $o["slug"];
      if (!isset($counts[$key])) {
        $counts[$key] = array("kind" => $o["kind"], "slug" => $o["slug"], "count" => 0);
      }
      $counts[$key]["count"]++;
    }
  }
  $out[$h] = array_values($counts);
}
echo json_encode(array("hooks" => $out));
`;

export const EVAL_STATIC_OUTBOUND = `
function wdp_st_word($ch) {
  return ($ch >= "a" && $ch <= "z") || ($ch >= "A" && $ch <= "Z") || ($ch >= "0" && $ch <= "9") || $ch === "_";
}
function wdp_st_tight($src) {
  return str_replace(array(" ", "\\t", "\\n", "\\r"), "", (string) $src);
}
function wdp_st_count_fn($src, $fn) {
  $n = 0;
  $p = 0;
  $len = strlen($fn);
  $L = strlen($src);
  while (($p = strpos($src, $fn, $p)) !== false) {
    $before = $p > 0 ? $src[$p - 1] : "";
    if ($before !== "" && wdp_st_word($before)) { $p += $len; continue; }
    $i = $p + $len;
    if ($i < $L && wdp_st_word($src[$i])) { $p += $len; continue; }
    while ($i < $L && ($src[$i] === " " || $src[$i] === "\\t" || $src[$i] === "\\n" || $src[$i] === "\\r")) $i++;
    if ($i < $L && $src[$i] === "(") $n++;
    $p += $len;
  }
  return $n;
}
function wdp_st_count_prefix($src, $prefix) {
  $n = 0;
  $p = 0;
  $len = strlen($prefix);
  $L = strlen($src);
  while (($p = strpos($src, $prefix, $p)) !== false) {
    $before = $p > 0 ? $src[$p - 1] : "";
    if ($before !== "" && wdp_st_word($before)) { $p += $len; continue; }
    $i = $p + $len;
    while ($i < $L && wdp_st_word($src[$i])) $i++;
    while ($i < $L && ($src[$i] === " " || $src[$i] === "\\t" || $src[$i] === "\\n" || $src[$i] === "\\r")) $i++;
    if ($i < $L && $src[$i] === "(") $n++;
    $p += $len;
  }
  return $n;
}
function wdp_st_count_ident($src, $ident) {
  $n = 0;
  $p = 0;
  $len = strlen($ident);
  $L = strlen($src);
  while (($p = strpos($src, $ident, $p)) !== false) {
    $before = $p > 0 ? $src[$p - 1] : "";
    $after = $p + $len < $L ? $src[$p + $len] : "";
    $okB = ($before === "" || !wdp_st_word($before));
    $okA = ($after === "" || !wdp_st_word($after));
    if ($okB && $okA) $n++;
    $p += $len;
  }
  return $n;
}
function wdp_st_count_send($src) {
  $n = 0;
  $p = 0;
  $L = strlen($src);
  while (($p = strpos($src, "->", $p)) !== false) {
    $i = $p + 2;
    while ($i < $L && ($src[$i] === " " || $src[$i] === "\\t" || $src[$i] === "\\n" || $src[$i] === "\\r")) $i++;
    if (substr($src, $i, 4) === "send") {
      $j = $i + 4;
      if ($j >= $L || !wdp_st_word($src[$j])) {
        while ($j < $L && ($src[$j] === " " || $src[$j] === "\\t" || $src[$j] === "\\n" || $src[$j] === "\\r")) $j++;
        if ($j < $L && $src[$j] === "(") $n++;
      }
    }
    $p += 2;
  }
  return $n;
}
function wdp_st_count_fgc_http($src) {
  $n = 0;
  $p = 0;
  $fn = "file_get_contents";
  $len = strlen($fn);
  $L = strlen($src);
  while (($p = strpos($src, $fn, $p)) !== false) {
    $before = $p > 0 ? $src[$p - 1] : "";
    if ($before !== "" && wdp_st_word($before)) { $p += $len; continue; }
    $i = $p + $len;
    while ($i < $L && ($src[$i] === " " || $src[$i] === "\\t" || $src[$i] === "\\n" || $src[$i] === "\\r")) $i++;
    if ($i < $L && $src[$i] === "(") {
      $i++;
      while ($i < $L && ($src[$i] === " " || $src[$i] === "\\t" || $src[$i] === "\\n" || $src[$i] === "\\r")) $i++;
      $q = $i < $L ? $src[$i] : "";
      if ($q === "\\"" || ord($q) === 39) $i++;
      $rest = substr($src, $i, 8);
      if (strpos($rest, "http://") === 0 || strpos($rest, "https:") === 0) $n++;
    }
    $p += $len;
  }
  return $n;
}
function wdp_st_calls($src) {
  $src = (string) $src;
  $out = array();
  $n = wdp_st_count_prefix($src, "wp_remote_");
  if ($n) $out["wp_remote_*"] = $n;
  $n = wdp_st_count_prefix($src, "wp_safe_remote_");
  if ($n) $out["wp_safe_remote_*"] = $n;
  $n = wdp_st_count_ident($src, "WP_Http");
  if ($n) $out["WP_Http"] = $n;
  $n = wdp_st_count_prefix($src, "curl_");
  if ($n) $out["curl_*"] = $n;
  $n = wdp_st_count_fn($src, "fsockopen");
  if ($n) $out["fsockopen"] = $n;
  $n = wdp_st_count_fn($src, "stream_socket_client");
  if ($n) $out["stream_socket_client"] = $n;
  $n = wdp_st_count_fgc_http($src);
  if ($n) $out["file_get_contents_http"] = $n;
  $n = wdp_st_count_fn($src, "wp_mail");
  if ($n) $out["wp_mail"] = $n;
  $n = wdp_st_count_fn(wdp_st_tight($src), "WC()->mailer");
  if ($n) $out["WC_mailer"] = $n;
  $n = wdp_st_count_send($src);
  if ($n) $out["send"] = $n;
  return $out;
}
function wdp_st_merge($a, $b) {
  foreach ($b as $k => $v) {
    $a[$k] = isset($a[$k]) ? $a[$k] + (int) $v : (int) $v;
  }
  return $a;
}
function wdp_st_read($file, $start, $end) {
  $file = (string) $file;
  if ($file === "" || !is_file($file) || !is_readable($file)) return "";
  $lines = @file($file);
  if (!is_array($lines)) return "";
  $start = max(1, (int) $start);
  $end = max($start, (int) $end);
  return implode("", array_slice($lines, $start - 1, $end - $start + 1));
}
function wdp_st_meta($fn) {
  try {
    $r = null;
    if (is_string($fn) && strpos($fn, "::") !== false) {
      $parts = explode("::", $fn, 2);
      $r = new ReflectionMethod($parts[0], $parts[1]);
    } else if (is_string($fn) && function_exists($fn)) {
      $r = new ReflectionFunction($fn);
    } else if ($fn instanceof Closure) {
      $r = new ReflectionFunction($fn);
    } else if (is_array($fn) && isset($fn[0]) && isset($fn[1])) {
      $r = new ReflectionMethod($fn[0], $fn[1]);
    } else if (is_object($fn)) {
      $r = new ReflectionMethod($fn, "__invoke");
    }
    if (!$r) return array("file" => "", "start" => 0, "end" => 0);
    return array("file" => (string) $r->getFileName(), "start" => (int) $r->getStartLine(), "end" => (int) $r->getEndLine());
  } catch (Throwable $ex) {
    return array("file" => "", "start" => 0, "end" => 0);
  }
}
function wdp_st_origin($file) {
  $file = str_replace(chr(92), "/", (string) $file);
  if (strpos($file, "eval()") !== false) {
    return array("kind" => "snippet", "slug" => "snippet");
  }
  $mark = "/wp-content/plugins/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    if ($slug === "code-snippets" || $slug === "code-snippets-pro") {
      return array("kind" => "snippet", "slug" => "snippet");
    }
    return array("kind" => "plugin", "slug" => $slug);
  }
  $mark = "/wp-content/mu-plugins/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    $slug = explode(".", $slug)[0];
    return array("kind" => "mu-plugin", "slug" => $slug);
  }
  $mark = "/wp-content/themes/";
  $i = strpos($file, $mark);
  if ($i !== false) {
    $rest = substr($file, $i + strlen($mark));
    $slug = explode("/", $rest)[0];
    return array("kind" => "theme", "slug" => $slug);
  }
  return array("kind" => "core", "slug" => "core");
}
function wdp_st_skip_child($name) {
  $n = strtolower((string) $name);
  if (strpos($n, "wp_remote_") === 0) return 1;
  if (strpos($n, "wp_safe_remote_") === 0) return 1;
  if (strpos($n, "curl_") === 0) return 1;
  if ($n === "wp_mail" || $n === "fsockopen" || $n === "stream_socket_client" || $n === "file_get_contents") return 1;
  if ($n === "send" || $n === "mailer") return 1;
  return 0;
}
function wdp_st_called($src) {
  $names = array();
  $tokens = @token_get_all("<?php " . (string) $src);
  if (!is_array($tokens)) return $names;
  $skip = array("if"=>1,"elseif"=>1,"else"=>1,"while"=>1,"for"=>1,"foreach"=>1,"switch"=>1,"catch"=>1,"echo"=>1,"print"=>1,"isset"=>1,"empty"=>1,"unset"=>1,"return"=>1,"include"=>1,"require"=>1,"array"=>1,"list"=>1,"exit"=>1,"die"=>1,"function"=>1,"class"=>1,"new"=>1,"clone"=>1,"throw"=>1,"try"=>1,"match"=>1,"parent"=>1,"self"=>1,"static"=>1,"true"=>1,"false"=>1,"null"=>1,"and"=>1,"or"=>1,"xor"=>1);
  $n = count($tokens);
  for ($i = 0; $i < $n; $i++) {
    $t = $tokens[$i];
    if (!is_array($t) || $t[0] !== T_STRING) continue;
    $name = $t[1];
    if (isset($skip[strtolower($name)])) continue;
    $j = $i + 1;
    while ($j < $n && is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE) $j++;
    if ($j < $n && $tokens[$j] === "(") $names[] = $name;
  }
  return array_values(array_unique($names));
}
function wdp_st_child_src($name, $fn) {
  if (wdp_st_skip_child($name)) return "";
  try {
    if (function_exists($name)) {
      $r = new ReflectionFunction($name);
      return wdp_st_read((string) $r->getFileName(), $r->getStartLine(), $r->getEndLine());
    }
    if (is_array($fn) && isset($fn[0]) && method_exists($fn[0], $name)) {
      $r = new ReflectionMethod($fn[0], $name);
      return wdp_st_read((string) $r->getFileName(), $r->getStartLine(), $r->getEndLine());
    }
  } catch (Throwable $ex) {
    return "";
  }
  return "";
}
function wdp_st_scan_fn($fn) {
  $meta = wdp_st_meta($fn);
  $src = wdp_st_read($meta["file"], $meta["start"], $meta["end"]);
  $calls = wdp_st_calls($src);
  foreach (wdp_st_called($src) as $name) {
    $child = wdp_st_child_src($name, $fn);
    if ($child !== "") $calls = wdp_st_merge($calls, wdp_st_calls($child));
  }
  return array("origin" => wdp_st_origin($meta["file"]), "calls" => $calls);
}
function wdp_st_cbs($hook) {
  global $wp_filter;
  $list = array();
  if (!isset($wp_filter[$hook])) return $list;
  $f = $wp_filter[$hook];
  $cb_lists = array();
  if (is_object($f) && isset($f->callbacks)) $cb_lists = $f->callbacks;
  else if (is_array($f)) $cb_lists = $f;
  foreach ((array) $cb_lists as $group) {
    foreach ((array) $group as $cb) {
      $fn = is_array($cb) && isset($cb["function"]) ? $cb["function"] : null;
      $list[] = $fn;
    }
  }
  return $list;
}
function wdp_st_agg($fns) {
  $map = array();
  foreach ($fns as $fn) {
    $row = wdp_st_scan_fn($fn);
    $o = $row["origin"];
    $key = $o["kind"] . ":" . $o["slug"];
    if (!isset($map[$key])) {
      $map[$key] = array("kind" => $o["kind"], "slug" => $o["slug"], "calls" => array());
    }
    $map[$key]["calls"] = wdp_st_merge($map[$key]["calls"], $row["calls"]);
  }
  $rows = array();
  foreach ($map as $v) {
    $n = 0;
    foreach ($v["calls"] as $c) $n += (int) $c;
    $rows[] = array("kind" => $v["kind"], "slug" => $v["slug"], "calls" => $v["calls"], "count" => $n);
  }
  return $rows;
}
function wdp_st_snip_hooks($code) {
  $hooks = array();
  $code = (string) $code;
  foreach (array("add_" . "action", "add_" . "filter") as $fn) {
    $p = 0;
    $flen = strlen($fn);
    $L = strlen($code);
    while (($p = strpos($code, $fn, $p)) !== false) {
      $i = $p + $flen;
      while ($i < $L && ($code[$i] === " " || $code[$i] === "\\t" || $code[$i] === "\\n" || $code[$i] === "\\r")) $i++;
      if ($i < $L && $code[$i] === "(") {
        $i++;
        while ($i < $L && ($code[$i] === " " || $code[$i] === "\\t" || $code[$i] === "\\n" || $code[$i] === "\\r")) $i++;
        $q = $i < $L ? $code[$i] : "";
        if ($q === "\\"" || ord($q) === 39) {
          $i++;
          $start = $i;
          while ($i < $L && $code[$i] !== $q) $i++;
          $hooks[] = substr($code, $start, $i - $start);
        }
      }
      $p += $flen;
    }
  }
  return array_values(array_unique($hooks));
}
$scan_hooks = array(
  "woocommerce_add_to_cart",
  "woocommerce_cart_item_set_quantity",
  "woocommerce_cart_updated",
  "woocommerce_before_calculate_totals",
  "init",
  "wp_loaded",
  "wp",
  "template_redirect",
  "wp_head",
  "wp_footer",
  "wp_enqueue_scripts",
  "woocommerce_after_single_product",
  "woocommerce_thankyou",
  "woocommerce_new_order",
  "woocommerce_order_status_changed",
  "shutdown"
);
$hook_scan = array();
foreach ($scan_hooks as $h) {
  foreach (wdp_st_agg(wdp_st_cbs($h)) as $row) {
    $hook_scan[] = array("hook" => $h, "kind" => $row["kind"], "slug" => $row["slug"], "calls" => $row["calls"], "count" => $row["count"]);
  }
}
$snippets = array();
global $wpdb;
if (isset($wpdb) && isset($wpdb->prefix)) {
  $table = $wpdb->prefix . "snippets";
  $prev = $wpdb->suppress_errors(true);
  $like = $wpdb->esc_like($table);
  $found = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $like));
  if ($found) {
    $q = "SELECT id, scope, priority, active, code FROM " . $table . " WHERE active = 1";
    $rows = $wpdb->get_results($q, ARRAY_A);
    foreach ((array) $rows as $row) {
      $code = isset($row["code"]) ? (string) $row["code"] : "";
      $snippets[] = array(
        "id" => (int) $row["id"],
        "scope" => isset($row["scope"]) ? (string) $row["scope"] : "",
        "priority" => isset($row["priority"]) ? (int) $row["priority"] : 10,
        "active" => !empty($row["active"]) ? 1 : 0,
        "hooks" => wdp_st_snip_hooks($code),
        "calls" => wdp_st_calls($code)
      );
    }
  }
  $wpdb->suppress_errors($prev);
}
$cron = array();
$crons = function_exists("_get_cron_array") ? _get_cron_array() : array();
if (is_array($crons)) {
  $by = array();
  foreach ($crons as $ts => $hooksMap) {
    if (!is_array($hooksMap)) continue;
    foreach ($hooksMap as $hook => $evts) {
      $hook = (string) $hook;
      if (!isset($by[$hook])) {
        $by[$hook] = array("hook" => $hook, "next_run" => (int) $ts, "schedule" => "", "n" => 0);
      }
      $by[$hook]["n"] += is_array($evts) ? count($evts) : 1;
      if ((int) $ts < $by[$hook]["next_run"]) $by[$hook]["next_run"] = (int) $ts;
      if ($by[$hook]["schedule"] === "" && is_array($evts)) {
        foreach ($evts as $ev) {
          if (is_array($ev) && isset($ev["schedule"])) {
            $by[$hook]["schedule"] = (string) $ev["schedule"];
            break;
          }
        }
      }
    }
  }
  foreach ($by as $hook => $info) {
    $fns = wdp_st_cbs($hook);
    $calls = array();
    $owner = "sahipsiz";
    if ($fns) {
      $kinds = array();
      foreach ($fns as $fn) {
        $row = wdp_st_scan_fn($fn);
        $calls = wdp_st_merge($calls, $row["calls"]);
        $o = $row["origin"];
        $kinds[$o["kind"] . ":" . $o["slug"]] = $o;
      }
      $bits = array();
      foreach ($kinds as $o) $bits[] = $o["kind"] . ":" . $o["slug"];
      $owner = implode(",", $bits);
    }
    $ncall = 0;
    foreach ($calls as $c) $ncall += (int) $c;
    $cron[] = array(
      "hook" => $info["hook"],
      "owner" => $owner,
      "next_run" => $info["next_run"],
      "schedule" => $info["schedule"] === "" ? "once" : $info["schedule"],
      "calls" => $calls,
      "count" => $ncall
    );
  }
}
$pre_wp_mail = array();
foreach (wdp_st_cbs("pre_wp_mail") as $fn) {
  $o = wdp_st_origin(wdp_st_meta($fn)["file"]);
  $slug = ($o["kind"] === "plugin" || $o["kind"] === "mu-plugin") ? $o["slug"] : ($o["kind"] . ":" . $o["slug"]);
  if ($slug && !in_array($slug, $pre_wp_mail, true)) $pre_wp_mail[] = $slug;
}
echo json_encode(array(
  "hook_scan" => $hook_scan,
  "snippets" => $snippets,
  "cron" => $cron,
  "pre_wp_mail" => $pre_wp_mail,
  "scan_depth" => 1
));
`;

/**
 * Ödeme/sepet sayfa türü (içerik yazılmaz).
 * Sonuç: block | classic | classic-in-builder | unknown
 *
 * @param {{
 *   hasBlock?: boolean,
 *   hasShortcode?: boolean,
 *   contentHasShortNeedle?: boolean,
 *   builder?: boolean,
 *   blockDefault?: boolean,
 * }} flags
 */
export function classifyWooPageKind(flags = {}) {
  if (flags.hasBlock) return 'block';
  const classicMark = !!(flags.hasShortcode || flags.contentHasShortNeedle);
  if (classicMark && flags.builder) return 'classic-in-builder';
  if (classicMark) return 'classic';
  if (flags.blockDefault) return 'block';
  return 'unknown';
}

export const EVAL_WOO = `
$country = (string) get_option("woocommerce_default_country");
$cc = $country;
$colon = strpos($country, ":");
if ($colon !== false) {
  $cc = substr($country, 0, $colon);
}
function wdp_disc_page_kind($id, $blockName, $shortName) {
  $id = (int) $id;
  if ($id <= 0) {
    return array("status" => "missing", "kind" => "none");
  }
  $p = get_post($id);
  if (!$p) {
    return array("status" => "missing", "kind" => "none");
  }
  $c = (string) $p->post_content;
  $hasBlock = $blockName !== "" && function_exists("has_block") && has_block($blockName, $id);
  $hasShort = $shortName !== "" && function_exists("has_shortcode") && has_shortcode($c, $shortName);
  $needle = $shortName !== "" ? "[" . $shortName : "";
  $inContent = $needle !== "" && strpos($c, $needle) !== false;
  $builder = (strpos($c, "fusion_") !== false) || (stripos($c, "elementor") !== false);
  $blockDefault = false;
  $cls = implode(chr(92), array("Automattic", "WooCommerce", "Blocks", "Utils", "CartCheckoutUtils"));
  if (class_exists($cls)) {
    if ($shortName === "woocommerce_checkout" && method_exists($cls, "is_checkout_block_default")) {
      $blockDefault = $cls::is_checkout_block_default() ? true : false;
    }
    if ($shortName === "woocommerce_cart" && method_exists($cls, "is_cart_block_default")) {
      $blockDefault = $cls::is_cart_block_default() ? true : false;
    }
  }
  $kind = "unknown";
  if ($hasBlock) {
    $kind = "block";
  } else if (($hasShort || $inContent) && $builder) {
    $kind = "classic-in-builder";
  } else if ($hasShort || $inContent) {
    $kind = "classic";
  } else if ($blockDefault) {
    $kind = "block";
  }
  return array("status" => (string) $p->post_status, "kind" => $kind);
}
$out = array(
  "currency" => (string) get_option("woocommerce_currency"),
  "price_num_decimals" => (string) get_option("woocommerce_price_num_decimals"),
  "price_thousand_sep" => (string) get_option("woocommerce_price_thousand_sep"),
  "price_decimal_sep" => (string) get_option("woocommerce_price_decimal_sep"),
  "currency_pos" => (string) get_option("woocommerce_currency_pos"),
  "default_country" => $cc,
  "calc_taxes" => (string) get_option("woocommerce_calc_taxes"),
  "prices_include_tax" => (string) get_option("woocommerce_prices_include_tax"),
  "tax_display_shop" => (string) get_option("woocommerce_tax_display_shop"),
  "tax_display_cart" => (string) get_option("woocommerce_tax_display_cart"),
  "hpos" => (string) get_option("woocommerce_custom_orders_table_enabled"),
  "hpos_compat" => (string) get_option("woocommerce_custom_orders_table_data_sync_enabled"),
  "coming_soon" => (string) get_option("woocommerce_coming_soon"),
  "blog_public" => (string) get_option("blog_public"),
  "checkout_page" => wdp_disc_page_kind(get_option("woocommerce_checkout_page_id"), "woocommerce/checkout", "woocommerce_checkout"),
  "cart_page" => wdp_disc_page_kind(get_option("woocommerce_cart_page_id"), "woocommerce/cart", "woocommerce_cart"),
  "shop_page" => wdp_disc_page_kind(get_option("woocommerce_shop_page_id"), "", ""),
  "myaccount_page" => wdp_disc_page_kind(get_option("woocommerce_myaccount_page_id"), "", ""),
  "terms_page" => wdp_disc_page_kind(get_option("woocommerce_terms_page_id"), "", "")
);
echo json_encode($out);
`;

export const EVAL_GATEWAYS = `
$rows = array();
if (function_exists("WC")) {
  $woo = WC();
  if ($woo && method_exists($woo, "payment_gateways")) {
    $pgs = $woo->payment_gateways();
    if ($pgs && method_exists($pgs, "payment_gateways")) {
      foreach ($pgs->payment_gateways() as $id => $gw) {
        $enabled = "no";
        $title = "";
        if (is_object($gw)) {
          if (isset($gw->enabled) && (string) $gw->enabled === "yes") {
            $enabled = "yes";
          }
          if (isset($gw->method_title)) {
            $title = (string) $gw->method_title;
          }
        }
        $rows[] = array("id" => (string) $id, "method_title" => $title, "enabled" => $enabled);
      }
    }
  }
}
echo json_encode(array("gateways" => $rows));
`;

export const EVAL_OUTBOUND = `
if (!function_exists("get_plugins")) {
  require_once ABSPATH . "wp-admin/includes/plugin.php";
}
$mail = array("active" => 0, "plugin" => "", "mailer" => "", "do_not_send" => false);
if (function_exists("is_plugin_active") && is_plugin_active("wp-mail-smtp/wp_mail_smtp.php")) {
  $mail["active"] = 1;
  $mail["plugin"] = "wp-mail-smtp";
  $opt = get_option("wp_mail_smtp");
  if (is_array($opt) && isset($opt["mail"]) && is_array($opt["mail"]) && isset($opt["mail"]["mailer"])) {
    $mail["mailer"] = (string) $opt["mail"]["mailer"];
  }
  if (is_array($opt) && isset($opt["general"]) && is_array($opt["general"]) && !empty($opt["general"]["do_not_send"])) {
    $mail["do_not_send"] = true;
  }
}
if (!$mail["active"] && function_exists("is_plugin_active") && is_plugin_active("fluent-smtp/fluent-smtp.php")) {
  $mail["active"] = 1;
  $mail["plugin"] = "fluent-smtp";
  $opt = get_option("fluentmail-settings");
  if (is_array($opt) && isset($opt["connections"]) && is_array($opt["connections"])) {
    foreach ($opt["connections"] as $conn) {
      if (is_array($conn) && isset($conn["provider"])) {
        $mail["mailer"] = (string) $conn["provider"];
        break;
      }
    }
  }
}
if (!$mail["active"] && function_exists("is_plugin_active") && is_plugin_active("easy-wp-smtp/easy-wp-smtp.php")) {
  $mail["active"] = 1;
  $mail["plugin"] = "easy-wp-smtp";
  $opt = get_option("easy_wp_smtp");
  if (is_array($opt) && isset($opt["mail"]) && is_array($opt["mail"]) && isset($opt["mail"]["mailer"])) {
    $mail["mailer"] = (string) $opt["mail"]["mailer"];
  }
}
if (!$mail["active"] && function_exists("is_plugin_active") && is_plugin_active("post-smtp/postman-smtp.php")) {
  $mail["active"] = 1;
  $mail["plugin"] = "post-smtp";
  $opt = get_option("postman_options");
  if (is_array($opt) && isset($opt["transport_type"])) {
    $mail["mailer"] = (string) $opt["transport_type"];
  }
}
$wh_status = array();
$wh_topic = array();
$wh_total = 0;
if (class_exists("WC_Data_Store")) {
  try {
    $ds = WC_Data_Store::load("webhook");
    $ids = array();
    if ($ds && method_exists($ds, "get_webhooks_ids")) {
      $ids = $ds->get_webhooks_ids();
    }
    foreach ((array) $ids as $wid) {
      if (!class_exists("WC_Webhook")) {
        break;
      }
      $w = new WC_Webhook((int) $wid);
      $st = (string) $w->get_status();
      $tp = (string) $w->get_topic();
      $wh_status[$st] = isset($wh_status[$st]) ? $wh_status[$st] + 1 : 1;
      $wh_topic[$tp] = isset($wh_topic[$tp]) ? $wh_topic[$tp] + 1 : 1;
      $wh_total++;
    }
  } catch (Throwable $ex) {
    $wh_total = 0;
  }
}
if (defined("WPMS_DO_NOT_SEND") && WPMS_DO_NOT_SEND) {
  $mail["do_not_send"] = true;
}
$cron = array();
$crons = function_exists("_get_cron_array") ? _get_cron_array() : array();
if (is_array($crons)) {
  foreach ($crons as $hooks) {
    if (!is_array($hooks)) {
      continue;
    }
    foreach ($hooks as $hook => $evts) {
      $n = is_array($evts) ? count($evts) : 1;
      $cron[$hook] = isset($cron[$hook]) ? $cron[$hook] + $n : $n;
    }
  }
}
echo json_encode(array(
  "mail" => $mail,
  "webhooks" => array("total" => $wh_total, "by_status" => $wh_status, "by_topic" => $wh_topic),
  "cron" => $cron
));
`;

export const EVAL_COUNTS = `
$users = function_exists("count_users") ? count_users() : array();
$user_n = isset($users["total_users"]) ? (int) $users["total_users"] : 0;
function wdp_disc_sum_counts($obj) {
  $n = 0;
  if (is_object($obj)) {
    foreach (get_object_vars($obj) as $v) {
      $n += (int) $v;
    }
  }
  return $n;
}
$page_n = wdp_disc_sum_counts(wp_count_posts("page"));
$product_n = wdp_disc_sum_counts(wp_count_posts("product"));
$order_n = 0;
if (function_exists("wc_get_orders")) {
  $r = wc_get_orders(array("limit" => 1, "paginate" => true, "return" => "ids", "type" => "shop_order"));
  if (is_object($r) && isset($r->total)) {
    $order_n = (int) $r->total;
  }
} else {
  $order_n = wdp_disc_sum_counts(wp_count_posts("shop_order"));
}
$wdp_ver = defined("WDP_VERSION") ? (string) WDP_VERSION : "";
$wdp_n = 0;
global $wpdb;
if (isset($wpdb) && isset($wpdb->options)) {
  $like = $wpdb->esc_like("wdp_") . "%";
  $sql = "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s";
  $wdp_n = (int) $wpdb->get_var($wpdb->prepare($sql, $like));
}
echo json_encode(array(
  "orders" => $order_n,
  "products" => $product_n,
  "users" => $user_n,
  "pages" => $page_n,
  "wdp_version" => $wdp_ver,
  "wdp_option_count" => $wdp_n
));
`;

export const DISCOVER_STEPS = [
  { id: 'stack', kind: 'eval', php: EVAL_STACK },
  { id: 'plugins', kind: 'eval', php: EVAL_PLUGINS },
  { id: 'hooks', kind: 'eval', php: EVAL_HOOKS },
  { id: 'woo', kind: 'eval', php: EVAL_WOO },
  { id: 'gateways', kind: 'eval', php: EVAL_GATEWAYS },
  { id: 'outbound', kind: 'eval', php: EVAL_OUTBOUND },
  { id: 'static_outbound', kind: 'eval', php: EVAL_STATIC_OUTBOUND },
  { id: 'counts', kind: 'eval', php: EVAL_COUNTS },
  { id: 'canary', kind: 'eval-file', file: CANARY_EVAL_FILE },
];

export function compactPhp(php) {
  return String(php || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stepToWpTail(step) {
  if (step.kind === 'eval') return `eval '${compactPhp(step.php)}'`;
  if (step.kind === 'eval-file') return `eval-file ${step.file}`;
  if (step.kind === 'wp') return String(step.wp || '').trim();
  throw new Error(`bilinmeyen keşif adımı: ${step.kind}`);
}

export function getDiscoverWpTails() {
  return DISCOVER_STEPS.map(stepToWpTail);
}

/** Yazma taraması için eval gövdesini çıkar (PHP ayrı taranır). */
export function tailsForWriteScan(tails = getDiscoverWpTails()) {
  return tails.map((t) => {
    const s = String(t);
    if (s.startsWith("eval '") || s.startsWith('eval ')) return 'eval';
    if (s.startsWith('eval-file ')) return `eval-file ${s.slice('eval-file '.length).split(/\s+/)[0]}`;
    return s;
  });
}

export function getEvalSnippets() {
  return DISCOVER_STEPS.filter((s) => s.kind === 'eval').map((s) => s.php);
}

export function buildRemoteWpCommand(wpPath, tail) {
  return `wp ${tail} ${wpPathFlag(wpPath)}`;
}

export function canonicalEnv(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (['staging', 'hedef', 'staging-hedef'].includes(s)) return 'staging';
  if (['ikram', 'ikram-aid', 'ikramaid'].includes(s)) return 'ikram';
  if (['local', 'local-wp'].includes(s)) return 'local';
  throw new Error('Kullanım: npm run remote:discover -- --env staging|ikram');
}

export function profileKeyForEnv(envName) {
  if (envName === 'staging') return 'staging';
  if (envName === 'ikram') return 'ikram';
  return 'local';
}

export function blockedActivePlugins(plugins) {
  const list = Array.isArray(plugins) ? plugins : [];
  const blocked = BLOCKED_ACTIVE_SLUGS.filter((slug) =>
    list.some((p) => {
      const id = String(p.slug || p.name || '')
        .toLowerCase()
        .trim();
      const status = String(p.status || '')
        .toLowerCase()
        .trim();
      return id === slug && status === 'active';
    })
  );
  for (const slug of smsPluginsFromActive(list)) {
    if (!blocked.includes(slug)) blocked.push(slug);
  }
  return blocked;
}

export function blockedExitCode(plugins) {
  return blockedActivePlugins(plugins).length ? 3 : 0;
}

export function classifyPlugin(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .trim();
  if (!s) return 'unclassified';
  if (PLUGIN_CATALOG[s]) return PLUGIN_CATALOG[s];
  for (const [re, cat] of CLASSIFY_PATTERNS) {
    if (re.test(s)) return cat;
  }
  return 'unclassified';
}

export function classifyActivePlugins(plugins) {
  const active = (Array.isArray(plugins) ? plugins : []).filter(
    (p) => String(p.status || '').toLowerCase() === 'active'
  );
  const grouped = {};
  for (const key of Object.keys(CATEGORY_LABELS)) grouped[key] = [];
  for (const p of active) {
    const slug = String(p.slug || p.name || '').trim();
    if (!slug) continue;
    const cat = classifyPlugin(slug);
    grouped[cat].push({ slug, version: String(p.version || '') });
  }
  return grouped;
}

export function sha256(s) {
  return createHash('sha256').update(String(s)).digest('hex');
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /https?:\/\/[^\s"'<>\\]+/gi;
const KEY_PREFIX_RE = /\b(?:sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|rk_test_)[A-Za-z0-9]+\b/g;
const KEY_ASSIGN_RE =
  /\b(?:api[_-]?key|secret|token|password|passwd|authorization)\s*[:=]\s*\S+/gi;
const QUERY_RE = /[?&][A-Za-z0-9_\-]+=[^&\s"'<>]*/g;

export function sanitizeString(value) {
  let t = String(value);
  t = t.replace(EMAIL_RE, '[redacted-email]');
  t = t.replace(URL_RE, '[redacted-url]');
  t = t.replace(KEY_PREFIX_RE, '[redacted-key]');
  t = t.replace(KEY_ASSIGN_RE, '[redacted-key]');
  t = t.replace(QUERY_RE, '[redacted-query]');
  return t;
}

export function sanitizeDiscoveryOutput(value, key = '') {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) {
    return value.map((v, i) => sanitizeDiscoveryOutput(v, `${key}[]${i}`));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeDiscoveryOutput(v, k);
    }
    return out;
  }
  return value;
}

export function sanitizeCanarySnapshot(snap) {
  if (!snap || typeof snap !== 'object') return snap;
  const out = { ...snap };
  if (typeof out.siteurl === 'string' && /https?:\/\//i.test(out.siteurl)) {
    out.siteurl = sha256(out.siteurl);
  } else if (typeof out.siteurl === 'string') {
    out.siteurl = sanitizeString(out.siteurl);
  }
  if (out.options && typeof out.options === 'object') {
    const opts = {};
    for (const [k, v] of Object.entries(out.options)) {
      if (
        k === 'permalink_structure' &&
        typeof v === 'string' &&
        v &&
        !/^[a-f0-9]{64}$/i.test(v)
      ) {
        opts[k] = sha256(v);
      } else if (typeof v === 'string') {
        opts[k] = sanitizeString(v);
      } else {
        opts[k] = v;
      }
    }
    out.options = opts;
  }
  if (Array.isArray(out.posts)) {
    out.posts = out.posts.map((p) => ({
      id: p?.id,
      type: p?.type,
      status: p?.status,
      modified: p?.modified,
      mark: p?.mark,
    }));
  }
  delete out.admin_email;
  delete out.email;
  return out;
}

export function parseJsonBlob(raw) {
  const text = String(raw || '');
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start = -1;
  let endChar = '}';
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
    start = objStart;
    endChar = '}';
  } else if (arrStart >= 0) {
    start = arrStart;
    endChar = ']';
  }
  if (start < 0) {
    throw new Error(`JSON yok: ${text.slice(0, 120)}`);
  }
  const end = text.lastIndexOf(endChar);
  if (end < start) throw new Error(`JSON kapanış yok: ${text.slice(0, 120)}`);
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    throw new Error(`JSON ayrıştırılamadı: ${e.message}`);
  }
}

export function isSshConnectionError(res) {
  if (!res) return true;
  if (res.error && ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(res.error.code)) {
    return true;
  }
  const err = `${res.stderr || ''} ${res.stdout || ''} ${res.error && res.error.message ? res.error.message : ''}`;
  if (
    /connection (timed out|refused|reset)|could not resolve|no route to host|network is unreachable|connection closed by remote/i.test(
      err
    )
  ) {
    return true;
  }
  return Number(res.status) === 255;
}

/**
 * stderr'in ilk 300 karakteri (e-posta/URL/anahtar temiz) + çıkış kodu.
 * @param {{ status?: number|null, stderr?: string, stdout?: string }|null|undefined} res
 * @param {string} [prefix]
 */
export function formatGuardedSshFailure(res, prefix = 'ssh başarısız') {
  const code = res && res.status != null ? Number(res.status) : '?';
  const raw = String((res && res.stderr) || '').slice(0, 300);
  const clean = sanitizeString(raw).replace(/\s+/g, ' ').trim();
  return `${prefix} (çıkış ${code})${clean ? `: ${clean}` : ''}`;
}

/**
 * SSH. Bağlantı hatasında en fazla 1 tekrar.
 * @param {Function} spawn spawnGuarded uyumlu
 * @param {string} alias
 * @param {string} remoteCmd
 * @param {object} spawnOpts
 * @param {{ requireStdout?: boolean, siteUrl?: string, wpPath?: string, alias?: string }} [guardOpts]
 */
export function runGuardedSsh(spawn, alias, remoteCmd, spawnOpts, guardOpts) {
  const args = [
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=20',
    String(alias),
    remoteCmd,
  ];
  const bin = 'ssh';
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    last = spawn(bin, args, spawnOpts, guardOpts);
    if (last && last.status === 0) {
      if (guardOpts && guardOpts.requireStdout && !String(last.stdout || '').trim()) {
        const e = new Error(formatGuardedSshFailure(last));
        e.result = last;
        throw e;
      }
      return last;
    }
    if (attempt === 0 && isSshConnectionError(last)) continue;
    break;
  }
  const e = new Error(formatGuardedSshFailure(last));
  e.result = last;
  throw e;
}

export function smsPluginsFromActive(plugins) {
  const grouped = classifyActivePlugins(plugins);
  return (grouped.sms || []).map((p) => p.slug);
}

function asCountMap(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = Number(v) || 0;
  return out;
}

export function assembleReport({ envName, profileId, stepData, canaryRel }) {
  const plugins = Array.isArray(stepData.plugins?.plugins) ? stepData.plugins.plugins : [];
  const blocked = blockedActivePlugins(plugins);
  const classified = classifyActivePlugins(plugins);
  const stack = stepData.stack || {};
  const woo = stepData.woo || {};
  const gateways = Array.isArray(stepData.gateways?.gateways) ? stepData.gateways.gateways : [];
  const outbound = stepData.outbound || {};
  const counts = stepData.counts || {};
  const hooks = stepData.hooks?.hooks || {};
  const canary = stepData.canary || {};

  const pluginCounts = {
    active: plugins.filter((p) => p.status === 'active').length,
    inactive: plugins.filter((p) => p.status === 'inactive').length,
    must_use: plugins.filter((p) => p.status === 'must-use').length,
    dropin: plugins.filter((p) => p.status === 'dropin').length,
  };

  const staticRaw = stepData.static_outbound || {};
  const smsList = smsPluginsFromActive(plugins);
  const mailIn = outbound.mail || {};
  const mail = {
    active: Number(mailIn.active) ? 1 : 0,
    plugin: String(mailIn.plugin || ''),
    mailer: String(mailIn.mailer || ''),
    do_not_send: mailDoNotSend(mailIn.do_not_send),
  };
  const hookScan = (Array.isArray(staticRaw.hook_scan) ? staticRaw.hook_scan : []).map((row) => {
    const calls = row.calls && typeof row.calls === 'object' && !Array.isArray(row.calls) ? row.calls : {};
    const count = Number(row.count) || Object.values(calls).reduce((a, b) => a + Number(b || 0), 0);
    return {
      hook: String(row.hook || ''),
      source: sourceLabel(row.kind, row.slug),
      calls,
      count,
    };
  });
  const snippets = (Array.isArray(staticRaw.snippets) ? staticRaw.snippets : []).map(scrubSnippetRow);
  const cronStatic = (Array.isArray(staticRaw.cron) ? staticRaw.cron : []).map((row) => {
    const calls = row.calls && typeof row.calls === 'object' && !Array.isArray(row.calls) ? row.calls : {};
    return {
      hook: String(row.hook || ''),
      owner: cronOwnerLabel(row.owner),
      next_run: Number(row.next_run) || 0,
      schedule: String(row.schedule || ''),
      calls,
      count: Number(row.count) || Object.values(calls).reduce((a, b) => a + Number(b || 0), 0),
    };
  });
  const cronOutbound = cronStatic.filter((r) => hasOutboundCallTypes(r.calls));
  const preWpMail = Array.isArray(staticRaw.pre_wp_mail)
    ? staticRaw.pre_wp_mail.map(String).filter(Boolean)
    : [];
  const warnings = [];
  if (
    mail.active &&
    mail.plugin === 'wp-mail-smtp' &&
    mail.do_not_send === false &&
    ['mail', 'smtp'].includes(String(mail.mailer).toLowerCase())
  ) {
    warnings.push(`WP Mail SMTP aktif, Do Not Send=false, mailer=${mail.mailer} (uyarı, engel değil)`);
  }

  const report = {
    env: envName,
    profile_id: profileId || '',
    generated_at: new Date().toISOString(),
    blocked: blocked.map((slug) => `REMOTE-BLOCKED: ${slug} aktif`),
    stack: {
      wp: stack.wp || '',
      woocommerce: stack.wc || '',
      php: stack.php || '',
      theme: stack.theme || '',
      parent_theme: stack.parent_theme || '',
      locale: stack.locale || '',
      wplang: stack.wplang || '',
      multisite: Number(stack.multisite) === 1,
    },
    plugins: plugins.map((p) => ({
      slug: p.slug,
      status: p.status,
      version: p.version || '',
    })),
    plugin_counts: pluginCounts,
    classified_active: classified,
    hooks,
    woocommerce: {
      currency: woo.currency || '',
      price_num_decimals: woo.price_num_decimals || '',
      price_thousand_sep: woo.price_thousand_sep || '',
      price_decimal_sep: woo.price_decimal_sep || '',
      currency_pos: woo.currency_pos || '',
      default_country: woo.default_country || '',
      calc_taxes: woo.calc_taxes || '',
      prices_include_tax: woo.prices_include_tax || '',
      tax_display_shop: woo.tax_display_shop || '',
      tax_display_cart: woo.tax_display_cart || '',
      hpos: woo.hpos || '',
      hpos_compat: woo.hpos_compat || '',
      coming_soon: woo.coming_soon || '',
      blog_public: woo.blog_public || '',
      pages: {
        checkout: woo.checkout_page || { status: 'missing', kind: 'none' },
        cart: woo.cart_page || { status: 'missing', kind: 'none' },
        shop: woo.shop_page || { status: 'missing', kind: 'none' },
        myaccount: woo.myaccount_page || { status: 'missing', kind: 'none' },
        terms: woo.terms_page || { status: 'missing', kind: 'none' },
      },
    },
    gateways: gateways.map((g) => ({
      id: g.id,
      method_title: g.method_title,
      enabled: g.enabled,
    })),
    outbound: {
      mail,
      sms_plugins: smsList,
      webhooks: {
        total: Number(outbound.webhooks?.total || 0),
        by_status: asCountMap(outbound.webhooks?.by_status),
        by_topic: asCountMap(outbound.webhooks?.by_topic),
      },
      cron: outbound.cron && !Array.isArray(outbound.cron) ? outbound.cron : {},
    },
    outbound_static: {
      limitation: STATIC_SCAN_LIMITATION,
      hooks: hookScan,
      snippets,
      cron: cronStatic,
      cron_outbound: cronOutbound,
      mail: {
        do_not_send: mail.do_not_send,
        mailer: mail.mailer,
        plugin: mail.plugin,
        pre_wp_mail: preWpMail,
      },
      sms: smsList.length ? smsList : 'pasif',
      warnings,
    },
    wdp: {
      version: counts.wdp_version || '',
      option_count: Number(counts.wdp_option_count || 0),
      installed: plugins.some((p) => p.slug === WDP_SLUG),
    },
    counts: {
      orders: Number(counts.orders || 0),
      products: Number(counts.products || 0),
      users: Number(counts.users || 0),
      pages: Number(counts.pages || 0),
    },
    canary: {
      file: canaryRel || '',
      user_count: Number(canary.user_count || 0),
      page_count: Number(canary.page_count || 0),
      product_count: Number(canary.product_count || 0),
      attachment_count: Number(canary.attachment_count || 0),
      post_id_count: Array.isArray(canary.posts) ? canary.posts.length : 0,
    },
  };

  return sanitizeDiscoveryOutput(report);
}

function mdTable(headers, rows) {
  const h = `| ${headers.join(' | ')} |`;
  const s = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map((c) => String(c ?? '')).join(' | ')} |`).join('\n');
  return `${h}\n${s}\n${body}`;
}

export function renderMarkdown(report) {
  const r = report || {};
  const st = r.stack || {};
  const woo = r.woocommerce || {};
  const blocked =
    Array.isArray(r.blocked) && r.blocked.length ? r.blocked.join(', ') : 'yok';
  const pages = woo.pages || {};
  const classified = r.classified_active || {};
  const classRows = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const items = classified[key] || [];
    const slugs = items.map((x) => x.slug).join(', ') || '—';
    return [label, String(items.length), slugs];
  });
  const hookRows = Object.entries(r.hooks || {}).map(([hook, list]) => {
    const bits = (Array.isArray(list) ? list : []).map((x) => `${x.kind}:${x.slug}×${x.count}`);
    return [hook, bits.join(', ') || '—'];
  });
  const cron = r.outbound?.cron || {};
  const cronRows = Object.entries(cron)
    .sort((a, b) => b[1] - a[1])
    .map(([hook, n]) => [hook, String(n)]);
  const stOut = r.outbound_static || {};
  const hookScanRows = (stOut.hooks || []).map((x) => [
    x.hook,
    x.source,
    formatCallTypes(x.calls),
    String(x.count ?? 0),
  ]);
  const snippetRows = (stOut.snippets || []).map((x) => [
    String(x.id ?? ''),
    x.scope || '—',
    String(x.priority ?? ''),
    Number(x.active) ? 'evet' : 'hayır',
    (x.hooks || []).join(', ') || '—',
    formatCallTypes(x.calls),
  ]);
  const cronStaticRows = (stOut.cron || []).map((x) => [
    x.hook,
    x.owner || CRON_ORPHAN,
    String(x.next_run ?? ''),
    x.schedule || '—',
    formatCallTypes(x.calls),
  ]);
  const cronOutRows = (stOut.cron_outbound || []).map((x) => [
    x.hook,
    x.owner || CRON_ORPHAN,
    formatCallTypes(x.calls),
  ]);
  const smsVal = Array.isArray(stOut.sms) ? stOut.sms.join(', ') : stOut.sms || 'pasif';
  const pluginRows = (r.plugins || []).map((p) => [p.slug, p.status, p.version || '']);
  const gwRows = (r.gateways || []).map((g) => [g.id, g.method_title || '', g.enabled || '']);
  const pageRows = Object.entries(pages).map(([name, info]) => [
    name,
    info?.status || 'missing',
    info?.kind || 'none',
  ]);

  const lines = [
    `# Uzak keşif: ${r.env || ''}`,
    '',
    `Üretilme: ${r.generated_at || ''} · profil \`${r.profile_id || ''}\``,
    '',
    '## Yığın',
    mdTable(
      ['Öğe', 'Değer'],
      [
        ['WP', st.wp],
        ['WooCommerce', st.woocommerce || 'yok'],
        ['PHP', st.php],
        ['Tema', st.theme],
        ['Üst tema', st.parent_theme],
        ['Locale', st.locale],
        ['WPLANG', st.wplang || '—'],
        ['Multisite', st.multisite ? 'evet' : 'hayır'],
      ]
    ),
    '',
    '## Engellenen ölçüm eklentileri',
    blocked,
    '',
    '## Eklentiler',
    mdTable(['slug', 'durum', 'sürüm'], pluginRows.length ? pluginRows : [['—', '—', '—']]),
    '',
    '## Giden veri sınıflandırması (aktif)',
    mdTable(['kategori', 'adet', 'slug'], classRows),
    '',
    '## Kanca kaynakları (slug × adet; tetiklenmedi)',
    mdTable(['kanca', 'kaynaklar'], hookRows.length ? hookRows : [['—', '—']]),
    '',
    '## WooCommerce',
    mdTable(
      ['ayar', 'değer'],
      [
        ['currency', woo.currency],
        ['price_num_decimals', woo.price_num_decimals],
        ['price_thousand_sep', woo.price_thousand_sep],
        ['price_decimal_sep', woo.price_decimal_sep],
        ['currency_pos', woo.currency_pos],
        ['default_country', woo.default_country],
        ['calc_taxes', woo.calc_taxes],
        ['prices_include_tax', woo.prices_include_tax],
        ['tax_display_shop', woo.tax_display_shop],
        ['tax_display_cart', woo.tax_display_cart],
        ['HPOS', woo.hpos || '—'],
        ['HPOS uyumluluk', woo.hpos_compat || '—'],
        ['coming_soon', woo.coming_soon || '—'],
        ['blog_public', woo.blog_public || '—'],
      ]
    ),
    '',
    '## Woo sayfaları (yalnız durum/tür)',
    mdTable(['sayfa', 'durum', 'tür'], pageRows),
    '',
    '## Ödeme yöntemleri',
    mdTable(['id', 'method_title', 'enabled'], gwRows.length ? gwRows : [['—', '—', '—']]),
    '',
    '## Giden iletişim',
    mdTable(
      ['öğe', 'değer'],
      [
        ['wp_mail eklenti', r.outbound?.mail?.active ? r.outbound.mail.plugin : 'yok'],
        ['mailer türü', r.outbound?.mail?.mailer || '—'],
        ['Do Not Send', r.outbound?.mail?.do_not_send === true ? 'true' : 'false'],
        ['SMS eklentileri', (r.outbound?.sms_plugins || []).join(', ') || 'yok'],
        ['webhook toplam', String(r.outbound?.webhooks?.total ?? 0)],
        ['webhook durum sayıları', JSON.stringify(r.outbound?.webhooks?.by_status || {})],
        ['webhook konu sayıları', JSON.stringify(r.outbound?.webhooks?.by_topic || {})],
      ]
    ),
    '',
    '## wp-cron (hook adı × adet)',
    cronRows.length
      ? mdTable(['hook', 'adet'], cronRows)
      : '_kayıt yok_',
    '',
    '## Giden veri statik denetimi',
    stOut.limitation || STATIC_SCAN_LIMITATION,
    '',
    '### Kanca geri çağrıları',
    hookScanRows.length
      ? mdTable(['kanca', 'kaynak', 'çağrı türleri', 'adet'], hookScanRows)
      : '_kayıt yok_',
    '',
    '### Code Snippets (yalnız id)',
    snippetRows.length
      ? mdTable(['id', 'scope', 'priority', 'etkin', 'kancalar', 'çağrı türleri'], snippetRows)
      : '_aktif snippet yok_',
    '',
    '### wp-cron',
    cronStaticRows.length
      ? mdTable(['hook', 'sahip', 'sonraki', 'sıklık', 'çağrı türleri'], cronStaticRows)
      : '_kayıt yok_',
    '',
    '### wp-cron (giden e-posta/SMS/istek)',
    cronOutRows.length
      ? mdTable(['hook', 'sahip', 'çağrı türleri'], cronOutRows)
      : '_yok_',
    '',
    '### WP Mail SMTP',
    mdTable(
      ['öğe', 'değer'],
      [
        ['Do Not Send', stOut.mail?.do_not_send === true ? 'true' : 'false'],
        ['mailer', stOut.mail?.mailer || '—'],
        ['pre_wp_mail', (stOut.mail?.pre_wp_mail || []).join(', ') || '—'],
      ]
    ),
    '',
    '### SMS',
    smsVal,
    '',
    (stOut.warnings || []).length
      ? `Uyarı: ${(stOut.warnings || []).join('; ')}`
      : 'Uyarı: yok',
    '',
    '## woo-donation-popup',
    mdTable(
      ['öğe', 'değer'],
      [
        ['kurulu', r.wdp?.installed ? 'evet' : 'hayır'],
        ['sürüm', r.wdp?.version || 'yok'],
        ['wdp_* option sayısı', String(r.wdp?.option_count ?? 0)],
      ]
    ),
    '',
    '## Sayılar',
    mdTable(
      ['öğe', 'adet'],
      [
        ['sipariş', r.counts?.orders],
        ['ürün', r.counts?.products],
        ['kullanıcı', r.counts?.users],
        ['sayfa', r.counts?.pages],
      ]
    ),
    '',
    '## Kanarya',
    mdTable(
      ['öğe', 'değer'],
      [
        ['dosya', r.canary?.file || ''],
        ['kullanıcı', r.canary?.user_count],
        ['sayfa', r.canary?.page_count],
        ['ürün', r.canary?.product_count],
        ['ek', r.canary?.attachment_count],
        ['kayıt id adedi', r.canary?.post_id_count],
      ]
    ),
    '',
  ];
  return lines.join('\n');
}

export function formatSummary(report) {
  const r = report || {};
  const st = r.stack || {};
  const woo = r.woocommerce || {};
  const blocked =
    Array.isArray(r.blocked) && r.blocked.length ? r.blocked.join('; ') : 'yok';
  const pc = r.plugin_counts || {};
  const mail = r.outbound?.mail || {};
  const lines = [
    `Keşif: ${r.env || ''} (profil ${r.profile_id || '—'})`,
    `WP ${st.wp || '?'} / WC ${st.woocommerce || 'yok'} / PHP ${st.php || '?'} | tema ${st.theme || '?'} (üst: ${st.parent_theme || '—'}) | ${st.locale || ''} | çoklu-site: ${st.multisite ? 'evet' : 'hayır'}`,
    `Eklenti: ${pc.active || 0} aktif / ${pc.inactive || 0} pasif / ${pc.must_use || 0} must-use / ${pc.dropin || 0} dropin`,
    `Engellenen: ${blocked}`,
    `Woo: ${woo.currency || '—'} ondalık ${woo.price_num_decimals || '—'} HPOS ${woo.hpos || '—'} sepet ${woo.pages?.cart?.kind || '—'} ödeme ${woo.pages?.checkout?.kind || '—'}`,
    `Ödeme: ${(r.gateways || []).length} yöntem (${(r.gateways || []).filter((g) => g.enabled === 'yes').length} açık)`,
    `Giden: SMTP ${mail.active ? `${mail.plugin}/${mail.mailer || '?'}${mail.do_not_send ? '/DoNotSend' : ''}` : 'yok'} | SMS ${Array.isArray(r.outbound_static?.sms) ? r.outbound_static.sms.join(',') : r.outbound_static?.sms || (r.outbound?.sms_plugins || []).join(',') || 'pasif'} | webhook ${r.outbound?.webhooks?.total ?? 0} | cron ${Object.keys(r.outbound?.cron || {}).length} kanca`,
    `wdp: ${r.wdp?.installed ? r.wdp.version || 'kurulu' : 'yok'}, option=${r.wdp?.option_count ?? 0}`,
    `Sayılar: sipariş ${r.counts?.orders ?? 0} / ürün ${r.counts?.products ?? 0} / kullanıcı ${r.counts?.users ?? 0} / sayfa ${r.counts?.pages ?? 0}`,
    `Kanarya: ${r.canary?.file || '—'}`,
  ];
  return lines.slice(0, 10).join('\n');
}
