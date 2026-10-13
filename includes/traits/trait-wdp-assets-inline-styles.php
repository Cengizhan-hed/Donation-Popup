<?php
/**
 * Admin ayarlarından dinamik inline CSS ve JS yapılandırma verisi üretir.
 *
 * @package WooCommerce\Donation_Popup
 */
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Assets_Inline_Styles_Trait {
    private static function get_button_icons() {
        if (class_exists('WDP_Icon_Library')) {
            return WDP_Icon_Library::get_button_icons_for_js();
        }
        if (!class_exists('WDP_Templates')) {
            return array();
        }

        return array(
            'cart'     => WDP_Templates::get_form_button_icon_cart_svg(),
            'checkout' => WDP_Templates::get_form_button_icon_checkout_svg(),
            'continue' => WDP_Templates::get_form_button_icon_continue_svg(),
        );
    }

    /**
     * Ayarlardan buton metinlerini okur (başarı ekranı dahil).
     *
     * @return array Buton metinleri.
     */
    private static function get_button_texts() {
        // Buton ayarlarını al
        $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
            get_option('wdp_button_settings', array())
        );
        
        // Varsayılan değerler (popup_button_text: şablon + JS için tek bağış butonu metni kaynağı)
        $defaults = array(
            'popup_button_text'       => __('Bağış Yap', 'woo-donation-popup'),
            'button_text_donate'      => __('Bağış Yap', 'woo-donation-popup'),
            'button_text_add_to_cart' => __('Sepete Ekle', 'woo-donation-popup'),
            'button_text_go_checkout' => __('Ödemeye Git', 'woo-donation-popup'),
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        
        $result = array(
            'donate'      => self::sanitize_plain_text($settings['popup_button_text'], __('Bağış Yap', 'woo-donation-popup')),
            'add_to_cart' => self::sanitize_plain_text($settings['button_text_add_to_cart'], __('Sepete Ekle', 'woo-donation-popup')),
            'go_checkout' => self::sanitize_plain_text($settings['button_text_go_checkout'], __('Ödemeye Git', 'woo-donation-popup')),
        );
        
        // Başarı ekranı buton metinleri (başarı ekranı ayarlarından al)
        $success_settings = get_option('wdp_success_settings', array());
        if (isset($success_settings['success_text_view_cart'])) {
            $result['success_view_cart'] = self::sanitize_plain_text($success_settings['success_text_view_cart'], __('Sepete Git', 'woo-donation-popup'));
        } else {
            $result['success_view_cart'] = __('Sepete Git', 'woo-donation-popup');
        }
        
        if (isset($success_settings['success_text_go_checkout'])) {
            $result['success_go_checkout'] = self::sanitize_plain_text($success_settings['success_text_go_checkout'], __('Bağışı Tamamla', 'woo-donation-popup'));
        } else {
            $result['success_go_checkout'] = __('Bağışı Tamamla', 'woo-donation-popup');
        }
        
        if (isset($success_settings['success_text_new_donation'])) {
            $result['success_new_donation'] = self::sanitize_plain_text($success_settings['success_text_new_donation'], __('Bağış eklemeye devam edin', 'woo-donation-popup'));
        } else {
            $result['success_new_donation'] = __('Bağış eklemeye devam edin', 'woo-donation-popup');
        }
        
        return $result;
    }

    /**
     * Get shareholder text customization settings for JS
     *
     * @return array
     */
    private static function get_shareholder_texts() {
        $settings = get_option('wdp_shareholder_settings', array());
        $defaults = array(
            'shareholder_header_text'      => 'Hissedar Bilgileri',
            'shareholder_name_placeholder' => 'Ad Soyad *',
            'shareholder_phone_placeholder'=> 'Telefon Numarası *',
            'shareholder_note_placeholder' => 'Not (isteğe bağlı)',
            'shareholder_copy_button_text' => 'Kopyasını Oluştur',
            'shareholder_enable_copy_button' => '1',
            'shareholder_layout'           => 'single',
            'shareholder_density'          => 'normal',
            'shareholder_enable_email'     => '0',
            'shareholder_email_placeholder'=> 'E-posta (isteğe bağlı)',
            'shareholder_progress_status_label' => 'Hissedar Form Durumu',
        );

        $settings = wp_parse_args($settings, $defaults);

        return array(
            'header'            => self::sanitize_plain_text($settings['shareholder_header_text'], $defaults['shareholder_header_text']),
            'name_placeholder'  => self::sanitize_plain_text($settings['shareholder_name_placeholder'], $defaults['shareholder_name_placeholder']),
            'phone_placeholder' => self::sanitize_plain_text($settings['shareholder_phone_placeholder'], $defaults['shareholder_phone_placeholder']),
            'note_placeholder'  => self::sanitize_plain_text($settings['shareholder_note_placeholder'], $defaults['shareholder_note_placeholder']),
            'copy_button'       => self::sanitize_plain_text($settings['shareholder_copy_button_text'], $defaults['shareholder_copy_button_text']),
            'enable_copy_button'=> !empty($settings['shareholder_enable_copy_button']) && $settings['shareholder_enable_copy_button'] !== '0',
            'layout'            => self::sanitize_choice($settings['shareholder_layout'], array('single', 'two-column'), 'single'),
            'density'           => self::sanitize_choice($settings['shareholder_density'], array('compact', 'normal', 'spacious'), 'normal'),
            'enable_email'      => !empty($settings['shareholder_enable_email']) && $settings['shareholder_enable_email'] !== '0',
            'email_placeholder' => self::sanitize_plain_text($settings['shareholder_email_placeholder'], $defaults['shareholder_email_placeholder']),
            'progress_status_label' => self::sanitize_plain_text($settings['shareholder_progress_status_label'], $defaults['shareholder_progress_status_label']),
        );
    }

    /**
     * Sanitize plain runtime text values.
     *
     * @param mixed $value Raw value.
     * @param string $fallback Fallback value.
     * @return string
     */
    private static function sanitize_plain_text($value, $fallback = '') {
        if (!is_scalar($value)) {
            return (string) $fallback;
        }

        $text = sanitize_text_field((string) $value);
        return $text !== '' ? $text : (string) $fallback;
    }

    /**
     * Sanitize enum-like values by whitelist.
     *
     * @param mixed $value Raw value.
     * @param array $allowed Allowed values.
     * @param string $fallback Fallback value.
     * @return string
     */
    private static function sanitize_choice($value, $allowed, $fallback) {
        if (!is_scalar($value)) {
            return $fallback;
        }
        $value = trim((string) $value);
        return in_array($value, $allowed, true) ? $value : $fallback;
    }

    /**
     * Sanitize CSS scalar value to avoid style injection.
     *
     * @param mixed $value Raw value.
     * @param string $fallback Fallback value.
     * @return string
     */
    private static function sanitize_css_value($value, $fallback = '') {
        if (!is_scalar($value)) {
            return (string) $fallback;
        }
        $value = trim(wp_strip_all_tags((string) $value));
        if ($value === '' || preg_match('/[{};<>`]/', $value)) {
            return (string) $fallback;
        }
        return $value;
    }

    /**
     * Sanitize integer values intended for px-based CSS variables.
     *
     * @param mixed $value Raw value.
     * @param int $fallback Fallback integer.
     * @param int $min Minimum allowed value.
     * @param int $max Maximum allowed value.
     * @return string
     */
    private static function sanitize_css_int($value, $fallback = 0, $min = 0, $max = 4000) {
        if (!is_scalar($value) || !is_numeric($value)) {
            return (string) $fallback;
        }
        $int_value = (int) $value;
        if ($int_value < $min || $int_value > $max) {
            return (string) $fallback;
        }
        return (string) $int_value;
    }

    /**
     * Sanitize known CSS settings map.
     *
     * @param array $settings User settings.
     * @param array $defaults Defaults map.
     * @param array $numeric_keys Keys that must be integers.
     * @return array
     */
    private static function sanitize_css_settings($settings, $defaults, $numeric_keys = array()) {
        $sanitized = array();
        foreach ($defaults as $key => $default_value) {
            $raw_value = isset($settings[$key]) ? $settings[$key] : $default_value;
            if (in_array($key, $numeric_keys, true)) {
                $sanitized[$key] = self::sanitize_css_int($raw_value, (int) $default_value);
                continue;
            }
            $sanitized[$key] = self::sanitize_css_value($raw_value, (string) $default_value);
        }
        return $sanitized;
    }

    /**
     * Stage 2C: button shadows removed — kept as no-op for any lingering callers.
     *
     * @param mixed ...$args Unused.
     * @return string
     */
    private static function wdp_compile_solid_box_shadow_fragment(...$args) {
        return '';
    }

    /**
     * @param array  $settings Unused.
     * @param string $slot Unused.
     * @param string $varsuffix Unused.
     * @return string
     */
    private static function wdp_inline_button_shadow_fragment_for_slot(array $settings, $slot, $varsuffix) {
        return '';
    }

    /**
     * @param array $settings Unused.
     * @return string
     */
    private static function get_inline_plugin_button_shadow_root_css(array $settings) {
        return '';
    }

    /**
     * Map density setting to control/button heights.
     *
     * @param string $density compact|normal|spacious (legacy) or tight|normal|comfortable.
     * @return array{control:int,button:int}
     */
    private static function resolve_density_heights($density) {
        $density = is_string($density) ? $density : 'normal';
        if (in_array($density, array('compact', 'tight'), true)) {
            return array('control' => 44, 'button' => 48);
        }
        if (in_array($density, array('spacious', 'comfortable', 'rahat'), true)) {
            return array('control' => 52, 'button' => 56);
        }
        return array('control' => 48, 'button' => 52);
    }

    /**
     * Title size token from S/M/L or legacy px.
     *
     * @param mixed $size Setting value.
     * @return int
     */
    private static function resolve_title_size_px($size) {
        if ($size === 'S' || $size === 's' || (string) $size === '18') {
            return 18;
        }
        if ($size === 'L' || $size === 'l' || (int) $size >= 26) {
            return 24;
        }
        if (is_numeric($size)) {
            $n = (int) $size;
            if ($n <= 20) {
                return 18;
            }
            if ($n >= 26) {
                return 24;
            }
        }
        return 22;
    }

    /**
     * Snap shell width to allowed presets.
     *
     * @param mixed $value Raw width.
     * @param array $allowed Allowed ints.
     * @param int   $fallback Default.
     * @return int
     */
    private static function snap_shell_width($value, array $allowed, $fallback) {
        $n = is_numeric($value) ? (int) $value : $fallback;
        $best = $fallback;
        $dist = PHP_INT_MAX;
        foreach ($allowed as $opt) {
            $d = abs($n - (int) $opt);
            if ($d < $dist) {
                $dist = $d;
                $best = (int) $opt;
            }
        }
        return $best;
    }

    /**
     * Darken hex by percent (0–100) for color-mix fallbacks.
     *
     * @param string $hex Primary hex.
     * @param int    $percent Mix toward black.
     * @return string
     */
    private static function darken_hex($hex, $percent) {
        $hex = sanitize_hex_color($hex);
        if (!$hex) {
            return '#1a5697';
        }
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $t = max(0, min(100, (int) $percent)) / 100;
        $r = (int) round($r * (1 - $t));
        $g = (int) round($g * (1 - $t));
        $b = (int) round($b * (1 - $t));
        return sprintf('#%02x%02x%02x', $r, $g, $b);
    }

    /**
     * Stage 2C: emit only design tokens on .wdp-root (target ≤1 KB).
     *
     * @return string CSS variables.
     */
    private static function get_button_customization_css() {
        $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
            get_option('wdp_button_settings', array())
        );
        if (!is_array($button_settings)) {
            $button_settings = array();
        }

        $brand = '';
        if (!empty($button_settings['brand_color'])) {
            $brand = sanitize_hex_color($button_settings['brand_color']);
        }
        if (!$brand && !empty($button_settings['button_primary_color'])) {
            $brand = sanitize_hex_color($button_settings['button_primary_color']);
        }
        if (!$brand) {
            $brand = '#1d5fa8';
        }

        $on_primary = '#ffffff';
        $hover = self::darken_hex($brand, 8);
        $active = self::darken_hex($brand, 12);
        if (class_exists('WDP_Color_Palette')) {
            $palette = WDP_Color_Palette::from_hex($brand);
            $brand = $palette['primary'];
            $hover = !empty($palette['primary_hover']) ? $palette['primary_hover'] : $hover;
            $active = !empty($palette['primary_dark']) ? $palette['primary_dark'] : $active;
            $on_primary = !empty($palette['on_primary']) ? $palette['on_primary'] : $on_primary;
        }

        $radius = isset($button_settings['ui_border_radius']) ? (int) $button_settings['ui_border_radius'] : 10;
        $radius = max(0, min(24, $radius));
        $radius_sm = max(0, (int) round($radius * 0.6));
        $radius_lg = max($radius, (int) round($radius * 1.6));

        $density = isset($button_settings['form_density']) ? (string) $button_settings['form_density'] : 'normal';
        $heights = self::resolve_density_heights($density);

        $font = 'inherit';
        if (!empty($button_settings['body_font_family']) && $button_settings['body_font_family'] === 'system') {
            $font = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
        } elseif (!empty($button_settings['font_source']) && $button_settings['font_source'] === 'system') {
            $font = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
        }

        $title_px = self::resolve_title_size_px(
            isset($button_settings['title_size']) ? $button_settings['title_size'] : (isset($button_settings['title_font_size']) ? $button_settings['title_font_size'] : 22)
        );

        $modal_layout = get_option('wdp_modal_layout_settings', array());
        if (!is_array($modal_layout)) {
            $modal_layout = array();
        }
        $modal_w = self::snap_shell_width(
            isset($button_settings['shell_modal_width']) ? $button_settings['shell_modal_width'] : (isset($modal_layout['popup_modal_width_desktop']) ? $modal_layout['popup_modal_width_desktop'] : 520),
            array(480, 520, 600),
            520
        );
        $panel_w = self::snap_shell_width(
            isset($button_settings['shell_panel_width']) ? $button_settings['shell_panel_width'] : (isset($modal_layout['side_panel_width_desktop_max_px']) ? $modal_layout['side_panel_width_desktop_max_px'] : 480),
            array(420, 480, 560),
            480
        );

        $soft = sprintf('rgba(%d,%d,%d,0.08)', hexdec(substr(ltrim($brand, '#'), 0, 2)), hexdec(substr(ltrim($brand, '#'), 2, 2)), hexdec(substr(ltrim($brand, '#'), 4, 2)));

        $css = ".wdp-root,.hdf-donation-modal-wrapper{";
        $css .= "--wdp-primary:" . esc_attr($brand) . ";";
        $css .= "--wdp-primary-hover:" . esc_attr($hover) . ";";
        $css .= "--wdp-primary-active:" . esc_attr($active) . ";";
        $css .= "--wdp-primary-soft:" . esc_attr($soft) . ";";
        $css .= "--wdp-on-primary:" . esc_attr($on_primary) . ";";
        $css .= "--wdp-button-primary:" . esc_attr($brand) . ";";
        $css .= "--wdp-button-primary-hover:" . esc_attr($hover) . ";";
        $css .= "--wdp-radius-sm:" . (int) $radius_sm . "px;";
        $css .= "--wdp-radius-md:" . (int) $radius . "px;";
        $css .= "--wdp-radius-lg:" . (int) $radius_lg . "px;";
        $css .= "--wdp-radius-ui:" . (int) $radius . "px;";
        $css .= "--wdp-control-h:" . (int) $heights['control'] . "px;";
        $css .= "--wdp-button-h:" . (int) $heights['button'] . "px;";
        $css .= "--wdp-form-cta-height:" . (int) $heights['button'] . "px;";
        $css .= "--wdp-font:" . esc_attr($font) . ";";
        $css .= "--wdp-fs-title:" . (int) $title_px . "px;";
        $css .= "--wdp-shell-w-modal:" . (int) $modal_w . "px;";
        $css .= "--wdp-shell-w-panel:" . (int) $panel_w . "px;";
        $css .= "}\n";

        return $css;
    }

    /**
     * Token CSS + minimal critical modal visibility.
     *
     * @return string Inline CSS.
     */
    private static function get_inline_css() {
        return self::get_button_customization_css() . self::get_critical_css();
    }

    /**
     * Minimal critical CSS for modal show/hide before bundle paints.
     *
     * @return string Critical CSS
     */
    private static function get_critical_css() {
        return '.hdf-donation-modal-wrapper.wdp-modal:not(.show){display:none!important;visibility:hidden;pointer-events:none}'
            . '.hdf-donation-modal-wrapper.wdp-modal.show{display:flex;position:fixed;inset:0;z-index:100000;width:100vw;height:100dvh;height:100vh}'
            . 'body.wdp-modal-open{overflow:hidden}';
    }

    /**
     * Attach inline CSS once per request.
     */
    private static function maybe_enqueue_inline_style() {
        if (self::$inline_style_attached) {
            return;
        }

        $inline_css = self::get_inline_css();
        
        // PERFORMANCE: Critical CSS'i head'e ekle (inline, blocking)
        $critical_css = self::get_critical_css();
        add_action('wp_head', function() use ($critical_css) {
            echo '<style id="wdp-critical-css">' . $critical_css . '</style>' . "\n";
        }, 1);
        
        // Inline CSS'i ekle (non-critical, async)
        wp_add_inline_style('wdp-donation-modal-css', $inline_css);
        
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $settings_hash = md5(serialize(get_option('wdp_button_settings', array())));
            add_action('wp_head', function() use ($settings_hash) {
                echo "<!-- WDP Button Settings Hash: " . esc_attr($settings_hash) . " -->\n";
            }, 999);
        }
        
        self::$inline_style_attached = true;
    }
}
