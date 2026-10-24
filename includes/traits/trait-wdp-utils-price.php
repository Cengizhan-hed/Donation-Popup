<?php
/**
 * Para birimi sembolü ve wc_price tabanlı HTML/düz metin fiyat formatlama.
 *
 * @package WooCommerce\Donation_Popup
 */
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Utils_Price_Trait {
    /** HTML entity içeren metni düz metne çevirir (ör. &#8378; → ₺). */
    public static function decode_text_entities($text) {
        $text = (string) $text;
        if ($text === '') {
            return '';
        }

        $charset = function_exists('get_bloginfo') ? (string) get_bloginfo('charset') : 'UTF-8';
        if ($charset === '') {
            $charset = 'UTF-8';
        }

        return html_entity_decode($text, ENT_QUOTES | ENT_HTML5, $charset);
    }

    /**
     * Düz metin / esc_html için güvenli para birimi sembolü.
     *
     * @param string $symbol Boşsa WooCommerce varsayılanı kullanılır.
     * @return string
     */
    public static function get_display_currency_symbol($symbol = '') {
        if ($symbol === '' && function_exists('get_woocommerce_currency_symbol')) {
            $symbol = get_woocommerce_currency_symbol();
        }
        if ($symbol === '') {
            $symbol = function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : '';
        }

        return self::decode_text_entities($symbol);
    }

    /**
     * WooCommerce sayı/sembol ayarları (JS localize + biçimleme).
     *
     * @return array{code:string,symbol:string,decimals:int,thousandSeparator:string,decimalSeparator:string,symbolPosition:string}
     */
    public static function get_js_currency_settings() {
        $code = function_exists('get_woocommerce_currency') ? (string) get_woocommerce_currency() : '';
        $symbol = self::get_display_currency_symbol(
            function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol($code) : ''
        );
        return array(
            'code'               => $code,
            'symbol'             => $symbol,
            'decimals'           => function_exists('wc_get_price_decimals') ? (int) wc_get_price_decimals() : 2,
            'thousandSeparator'  => function_exists('wc_get_price_thousand_separator') ? (string) wc_get_price_thousand_separator() : ',',
            'decimalSeparator'   => function_exists('wc_get_price_decimal_separator') ? (string) wc_get_price_decimal_separator() : '.',
            'symbolPosition'     => function_exists('get_option') ? (string) get_option('woocommerce_currency_pos', 'left') : 'left',
        );
    }

    /**
     * Kart / form birim fiyatı: WooCommerce "vergi dahil/hariç göster" ayarına uyar.
     *
     * @param WC_Product $product Product.
     * @return string HTML (or '').
     */
    public static function format_product_display_price($product) {
        if (!is_object($product) || !method_exists($product, 'get_price')) {
            return '';
        }
        $amount = function_exists('wc_get_price_to_display')
            ? wc_get_price_to_display($product)
            : $product->get_price();
        if ($amount === '' || $amount === null) {
            return '';
        }
        return self::format_price_html($amount);
    }

    public static function format_price_html($amount, array $args = array()) {
        if ($amount === '' || $amount === null) {
            return '';
        }
        if (!function_exists('wc_price')) {
            return '';
        }
        $numeric = floatval($amount);
        if (!is_finite($numeric)) {
            return '';
        }
        $args = array_merge(
            array(
                'trim_zeros' => true,
            ),
            $args
        );

        $html = wp_kses_post(wc_price($numeric, $args));

        return self::decode_text_entities($html);
    }

    /**
     * Placeholder / düz metin için fiyat (HTML etiketleri yok).
     *
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_price_plain($amount) {
        $raw = wp_strip_all_tags(self::format_price_html($amount));
        if ($raw === '') {
            return '';
        }

        // wc_price() bazı para birimi sembollerini HTML entity olarak döndürebilir (örn: &#8378;).
        // Mini-cart tarafında düz metin beklediğimiz için entity'leri Unicode karaktere çözüyoruz.
        $charset = function_exists('get_bloginfo') ? (string) get_bloginfo('charset') : 'UTF-8';
        if ($charset === '') {
            $charset = 'UTF-8';
        }

        return html_entity_decode($raw, ENT_QUOTES | ENT_HTML5, $charset);
    }

    /**
     * WooCommerce sayı biçimi (sembol yok; ondalık kırpılmaz).
     * wc_price sayı kısmı / JS formatPrice ile aynı ayarlar.
     *
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_localized_amount($amount) {
        if ($amount === '' || $amount === null) {
            return '';
        }
        $numeric = floatval($amount);
        if (!is_finite($numeric)) {
            return '';
        }
        $dp        = function_exists('wc_get_price_decimals') ? absint(wc_get_price_decimals()) : 2;
        $dec       = function_exists('wc_get_price_decimal_separator') ? (string) wc_get_price_decimal_separator() : '.';
        $thousands = function_exists('wc_get_price_thousand_separator') ? (string) wc_get_price_thousand_separator() : ',';
        return number_format($numeric, $dp, $dec, $thousands);
    }

    /**
     * Tutar alanı yer tutucusu: "min: " + format_localized_amount (açık/hata/AJAX aynı metin).
     *
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_min_placeholder($amount) {
        $n = self::format_localized_amount($amount);
        return $n === '' ? '' : ('min: ' . $n);
    }

    /**
     * @param float|string $amount Ham tutar.
     * @return string
     */
    public static function format_amount_for_min_placeholder($amount) {
        return self::format_localized_amount($amount);
    }

    /**
     * Bağışçı tutarı: binlik yalnız doğru gruplamada (1–3 + her grup 3).
     * Gruplama uymayan ayırıcı ondalık olarak okunabiliyorsa ve mağaza ondalığı
     * ≥ kesir basamağı ise ondalık; 0 ondalıkta ondalık görünümlü girdi belirsiz
     * (red, 100× yok). Binlik=ondalık (aynı karakter): gruplama → binlik, değilse ondalık
     * (0 dp belirsiz). Woo ayarları; sabit locale yok.
     *
     * @param mixed $raw      Ham girdi (yapıştırma: sembol/boşluk temizlenir).
     * @param array $settings İsteğe bağlı {decimals,thousandSeparator,decimalSeparator}.
     * @return array{ok:bool,amount:float,status:string,error:string}
     */
    public static function parse_donor_amount($raw, $settings = null) {
        if (is_int($raw) || is_float($raw)) {
            if (!is_finite((float) $raw) || (float) $raw < 0) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            return self::donor_amount_result(true, (float) $raw, 'ok', '');
        }
        if ($raw === null) {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }

        $cfg       = self::normalize_parse_currency_settings($settings);
        $thousand  = $cfg['thousandSeparator'];
        $decimal   = $cfg['decimalSeparator'];
        $decimals  = $cfg['decimals'];
        $s         = self::normalize_amount_input((string) $raw, $thousand, $decimal);
        if ($s === '' || $s === '-' || $s === $thousand || $s === $decimal || $s === '.' || $s === ',') {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }

        $sign = 1.0;
        if (isset($s[0]) && $s[0] === '-') {
            $sign = -1.0;
            $s    = substr($s, 1);
        }
        if ($s === '' || strpos($s, '-') !== false) {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }
        if ($sign < 0) {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }

        if (preg_match('/^\d+$/', $s)) {
            return self::donor_amount_result(true, (float) $s, 'ok', '');
        }

        if ($thousand !== '' && $thousand === $decimal) {
            return self::parse_donor_amount_same_separator($s, $thousand, $decimals);
        }

        $has_t = $thousand !== '' && strpos($s, $thousand) !== false;
        $has_d = $decimal !== '' && strpos($s, $decimal) !== false;

        if ($has_t && $has_d) {
            $d_first = strpos($s, $decimal);
            $d_last  = strrpos($s, $decimal);
            if ($d_first !== $d_last) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            if (strpos($s, $thousand) > $d_last) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            $int_part = substr($s, 0, $d_last);
            $frac     = substr($s, $d_last + strlen($decimal));
            if ($int_part === '' || $frac === '' || !preg_match('/^\d+$/', $frac)) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            if ($decimals <= 0) {
                return self::donor_amount_ambiguous($cfg);
            }
            if (strlen($frac) > $decimals) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            if (strpos($int_part, $thousand) !== false && !self::is_valid_thousand_grouping($int_part, $thousand)) {
                return self::donor_amount_ambiguous($cfg);
            }
            if (strpos($int_part, $decimal) !== false) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            $int_norm = str_replace($thousand, '', $int_part);
            if (!preg_match('/^\d+$/', $int_norm)) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            return self::donor_amount_result(true, (float) ($int_norm . '.' . $frac), 'ok', '');
        }

        if ($has_d && ! $has_t) {
            $d_first = strpos($s, $decimal);
            $d_last  = strrpos($s, $decimal);
            if ($d_first !== $d_last) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            $int_part = substr($s, 0, $d_last);
            $frac     = substr($s, $d_last + strlen($decimal));
            if ($int_part === '' || $frac === '' || !preg_match('/^\d+$/', $int_part) || !preg_match('/^\d+$/', $frac)) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            if ($decimals <= 0) {
                return self::donor_amount_ambiguous($cfg);
            }
            if (strlen($frac) > $decimals) {
                return self::donor_amount_result(false, 0.0, 'invalid', '');
            }
            return self::donor_amount_result(true, (float) ($int_part . '.' . $frac), 'ok', '');
        }

        if ($has_t && ! $has_d) {
            if (self::is_valid_thousand_grouping($s, $thousand)) {
                $n = (float) str_replace($thousand, '', $s);
                return self::donor_amount_result(true, $n, 'ok', '');
            }
            return self::donor_amount_ambiguous($cfg);
        }

        return self::donor_amount_result(false, 0.0, 'invalid', '');
    }

    /**
     * Belirsiz tutar görünür mesajı (yerelleştirilebilir; örnek mağaza biçiminde).
     *
     * @param array|null $settings Currency settings.
     * @return string
     */
    public static function get_ambiguous_amount_message($settings = null) {
        $cfg     = self::normalize_parse_currency_settings($settings);
        $example = self::format_localized_amount_with_settings(10, $cfg);
        if ($example === '') {
            $example = '10';
        }
        if ($cfg['decimals'] <= 0) {
            return sprintf(
                /* translators: %s: example whole amount in store format */
                __('Lütfen tutarı tam sayı olarak yazın, örn. %s', 'woo-donation-popup'),
                $example
            );
        }
        return sprintf(
            /* translators: %s: example amount in store format */
            __('Lütfen tutarı şu biçimde yazın, örn. %s', 'woo-donation-popup'),
            $example
        );
    }

    /**
     * @param array|null $settings Optional overrides.
     * @return array{decimals:int,thousandSeparator:string,decimalSeparator:string}
     */
    private static function normalize_parse_currency_settings($settings) {
        $base = self::get_js_currency_settings();
        $src  = is_array($settings) ? $settings : array();
        $dec  = isset($src['decimals']) ? (int) $src['decimals'] : (int) $base['decimals'];
        if ($dec < 0) {
            $dec = 0;
        }
        $thousand = array_key_exists('thousandSeparator', $src)
            ? (string) $src['thousandSeparator']
            : (string) $base['thousandSeparator'];
        $decimal  = array_key_exists('decimalSeparator', $src)
            ? (string) $src['decimalSeparator']
            : (string) $base['decimalSeparator'];
        return array(
            'decimals'           => $dec,
            'thousandSeparator'  => $thousand,
            'decimalSeparator'   => $decimal,
        );
    }

    /**
     * Sembol/harf/boşluk temizliği (yapıştırma: "₺1.250", "1 250").
     *
     * @param string $raw      Raw.
     * @param string $thousand Thousand sep.
     * @param string $decimal  Decimal sep.
     * @return string
     */
    public static function normalize_amount_input($raw, $thousand = '.', $decimal = ',') {
        $s = trim((string) $raw);
        if ($s === '') {
            return '';
        }
        $s = preg_replace('/[\s\x{00A0}\x{202F}\x{2009}\x{2007}\x{2060}]+/u', '', $s);
        if (!is_string($s)) {
            return '';
        }
        $keep = preg_quote($thousand . $decimal . '.,', '/');
        $s    = preg_replace('/[^0-9' . $keep . '\-]/u', '', $s);
        return is_string($s) ? $s : '';
    }

    /**
     * @param string $int_part Integer part still containing separators.
     * @param string $sep      Thousand separator.
     * @return bool
     */
    private static function is_valid_thousand_grouping($int_part, $sep) {
        if ($sep === '' || strpos($int_part, $sep) === false) {
            return false;
        }
        $parts = explode($sep, $int_part);
        if (count($parts) < 2) {
            return false;
        }
        if (!preg_match('/^\d{1,3}$/', $parts[0])) {
            return false;
        }
        $n = count($parts);
        for ($i = 1; $i < $n; $i++) {
            if (!preg_match('/^\d{3}$/', $parts[ $i ])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Binlik ve ondalık aynı karakter (staging30: ikisi de ".").
     *
     * @param string $s        Normalized digits+sep.
     * @param string $sep      Shared separator.
     * @param int    $decimals Store decimals.
     * @return array{ok:bool,amount:float,status:string,error:string}
     */
    private static function parse_donor_amount_same_separator($s, $sep, $decimals) {
        $cfg = array(
            'decimals'          => $decimals,
            'thousandSeparator' => $sep,
            'decimalSeparator'  => $sep,
        );
        if (self::is_valid_thousand_grouping($s, $sep)) {
            return self::donor_amount_result(true, (float) str_replace($sep, '', $s), 'ok', '');
        }
        $first = strpos($s, $sep);
        $last  = strrpos($s, $sep);
        if ($first === false || $first !== $last || $first <= 0) {
            return $decimals <= 0
                ? self::donor_amount_ambiguous($cfg)
                : self::donor_amount_result(false, 0.0, 'invalid', '');
        }
        $int_part = substr($s, 0, $last);
        $frac     = substr($s, $last + strlen($sep));
        if ($int_part === '' || $frac === '' || !preg_match('/^\d+$/', $int_part) || !preg_match('/^\d+$/', $frac)) {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }
        if ($decimals <= 0) {
            return self::donor_amount_ambiguous($cfg);
        }
        if (strlen($frac) > $decimals) {
            return self::donor_amount_result(false, 0.0, 'invalid', '');
        }
        return self::donor_amount_result(true, (float) ($int_part . '.' . $frac), 'ok', '');
    }

    /**
     * @param array $cfg Normalized settings.
     * @return array{ok:bool,amount:float,status:string,error:string}
     */
    private static function donor_amount_ambiguous(array $cfg) {
        return self::donor_amount_result(false, 0.0, 'ambiguous', self::get_ambiguous_amount_message($cfg));
    }

    /**
     * @param bool   $ok     Ok.
     * @param float  $amount Amount.
     * @param string $status Status.
     * @param string $error  Error.
     * @return array{ok:bool,amount:float,status:string,error:string}
     */
    private static function donor_amount_result($ok, $amount, $status, $error) {
        $msg = (string) $error;
        if (! $ok && $msg === '') {
            $msg = $status === 'ambiguous'
                ? self::get_ambiguous_amount_message()
                : __('Geçersiz fiyat değeri.', 'woo-donation-popup');
        }
        return array(
            'ok'     => (bool) $ok,
            'amount' => (float) $amount,
            'status' => (string) $status,
            'error'  => $msg,
        );
    }

    /**
     * @param float|int $amount Amount.
     * @param array     $cfg    {decimals,thousandSeparator,decimalSeparator}.
     * @return string
     */
    private static function format_localized_amount_with_settings($amount, array $cfg) {
        $numeric = (float) $amount;
        if (!is_finite($numeric)) {
            return '';
        }
        $dp        = isset($cfg['decimals']) ? absint($cfg['decimals']) : 0;
        $dec       = isset($cfg['decimalSeparator']) ? (string) $cfg['decimalSeparator'] : ',';
        $thousands = isset($cfg['thousandSeparator']) ? (string) $cfg['thousandSeparator'] : '.';
        return number_format($numeric, $dp, $dec, $thousands);
    }

    /**
     * WooCommerce sembol konumu: left|left_space|right|right_space.
     *
     * @return string
     */
    public static function currency_position() {
        $pos     = self::get_js_currency_settings()['symbolPosition'];
        $allowed = array('left', 'left_space', 'right', 'right_space');
        return in_array($pos, $allowed, true) ? $pos : 'left';
    }

    /**
     * Tutar kabuğu CSS sınıfı (sembol konumu).
     *
     * @return string
     */
    public static function currency_position_class() {
        return 'wdp-currency-pos-' . self::currency_position();
    }
}
