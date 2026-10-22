/**
 * Uzak keşif: sabit salt okunur komut listesi, katalog, temizleyici.
 * Ağ yok; spawn yok. Uzak koşu scripts/remote-discover.mjs içinden geçer.
 */
import { createHash } from 'node:crypto';

export const CANARY_EVAL_FILE = 'tests/e2e/helpers/canary-snapshot.php';
export const WDP_SLUG = 'woo-donation-popup';

export const BLOCKED_ACTIVE_SLUGS = [
  'facebook-for-woocommerce',
  'official-facebook-pixel',
  'google-listings-and-ads',
  'google-site-kit',
];

export const WRITE_PHP_RE =
  /update_|delete_|wp_insert|wp_update|wp_delete|add_option|do_action|apply_filters/;

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
  "template_redirect",
  "wp",
  "wp_head",
  "wp_footer",
  "woocommerce_after_single_product",
  "woocommerce_thankyou",
  "woocommerce_checkout_order_processed",
  "woocommerce_new_order",
  "woocommerce_order_status_changed",
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
$mail = array("active" => 0, "plugin" => "", "mailer" => "");
if (function_exists("is_plugin_active") && is_plugin_active("wp-mail-smtp/wp_mail_smtp.php")) {
  $mail["active"] = 1;
  $mail["plugin"] = "wp-mail-smtp";
  $opt = get_option("wp_mail_smtp");
  if (is_array($opt) && isset($opt["mail"]) && is_array($opt["mail"]) && isset($opt["mail"]["mailer"])) {
    $mail["mailer"] = (string) $opt["mail"]["mailer"];
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
  const p = String(wpPath || '').replace(/'/g, `'\\''`);
  return `wp ${tail} --path='${p}'`;
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
  return BLOCKED_ACTIVE_SLUGS.filter((slug) =>
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
 * SSH. Bağlantı hatasında en fazla 1 tekrar.
 * @param {Function} spawn spawnGuarded uyumlu
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
    if (last && last.status === 0) return last;
    if (attempt === 0 && isSshConnectionError(last)) continue;
    break;
  }
  const err = ((last && (last.stderr || last.stdout)) || '').trim().slice(0, 400);
  const e = new Error(`ssh başarısız${err ? `: ${err}` : ''}`);
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
      mail: outbound.mail || { active: 0, plugin: '', mailer: '' },
      sms_plugins: smsPluginsFromActive(plugins),
      webhooks: {
        total: Number(outbound.webhooks?.total || 0),
        by_status: asCountMap(outbound.webhooks?.by_status),
        by_topic: asCountMap(outbound.webhooks?.by_topic),
      },
      cron: outbound.cron && !Array.isArray(outbound.cron) ? outbound.cron : {},
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
    `Giden: SMTP ${mail.active ? `${mail.plugin}/${mail.mailer || '?'}` : 'yok'} | SMS ${(r.outbound?.sms_plugins || []).join(',') || 'yok'} | webhook ${r.outbound?.webhooks?.total ?? 0} | cron ${Object.keys(r.outbound?.cron || {}).length} kanca`,
    `wdp: ${r.wdp?.installed ? r.wdp.version || 'kurulu' : 'yok'}, option=${r.wdp?.option_count ?? 0}`,
    `Sayılar: sipariş ${r.counts?.orders ?? 0} / ürün ${r.counts?.products ?? 0} / kullanıcı ${r.counts?.users ?? 0} / sayfa ${r.counts?.pages ?? 0}`,
    `Kanarya: ${r.canary?.file || '—'}`,
  ];
  return lines.slice(0, 10).join('\n');
}
