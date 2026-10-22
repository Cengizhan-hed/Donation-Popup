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
