<?php
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Assets_Inline_Styles_Trait {
    private static function get_button_icons() {
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
     * Get button texts from settings
     *
     * @return array Button texts.
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
            'shareholder_copy_button_text' => '📋 Kopyasını Oluştur',
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
     * Derive validated box-shadow for plugin buttons (#hex only, solid shadow color).
     *
     * @param int    $x      X offset (px).
     * @param int    $y      Y offset (px).
     * @param int    $blur   Blur (px).
     * @param int    $spread Spread (px).
     * @param string $color_hex Hex color string.
     * @return string
     */
    private static function wdp_compile_solid_box_shadow_fragment($x, $y, $blur, $spread, $color_hex) {
        $hex = sanitize_hex_color($color_hex);
        if (!$hex) {
            return '';
        }
        return sprintf(
            '%dpx %dpx %dpx %dpx %s',
            (int) $x,
            (int) $y,
            max(0, (int) $blur),
            (int) $spread,
            strtolower($hex)
        );
    }

    /**
     * Tek bir gölge yuvası (--wdp-plugin-btn-shadow-{slot}[ -hover ]) için CSS değişkeni parçası.
     *
     * @param array  $settings  Ayar dizisi (button_shadow_{slot}_* anahtarları).
     * @param string $slot      Örn. 'sc', 'modal'.
     * @param string $varsuffix CSS kökündeki suffix: '--wdp-plugin-btn-shadow-sc'.
     * @return string           Boş ya da ';' ile bitecek parça (--...: value).
     */
    private static function wdp_inline_button_shadow_fragment_for_slot(array $settings, $slot, $varsuffix) {
        $pre = 'button_shadow_' . $slot . '_';
        if (empty($settings[ $pre . 'enabled' ]) || '1' !== $settings[ $pre . 'enabled' ]) {
            return '';
        }

        $x = max(-24, min(24, (int) (isset($settings[ $pre . 'x' ]) ? $settings[ $pre . 'x' ] : 0)));
        $y = max(-24, min(24, (int) (isset($settings[ $pre . 'y' ]) ? $settings[ $pre . 'y' ] : 8)));
        $blur = max(0, min(48, (int) (isset($settings[ $pre . 'blur' ]) ? $settings[ $pre . 'blur' ] : 20)));
        $spread = max(-8, min(12, (int) (isset($settings[ $pre . 'spread' ]) ? $settings[ $pre . 'spread' ] : 0)));

        $base_color = isset($settings[ $pre . 'color' ]) ? sanitize_hex_color($settings[ $pre . 'color' ]) : '';
        if (!$base_color) {
            $base_color = '#94a3b8';
        }

        $idle = self::wdp_compile_solid_box_shadow_fragment($x, $y, $blur, $spread, $base_color);
        if ('' === $idle) {
            return '';
        }

        /* $varsuffix sabit whitelist (sc|modal); gölge değeri sayısal px + hex. */
        $out = $varsuffix . ':' . esc_attr($idle) . ';';

        $hover_ok = !empty($settings[ $pre . 'hover_enhanced' ]) && '1' === $settings[ $pre . 'hover_enhanced' ];
        if ($hover_ok) {
            $hx = max(-24, min(24, (int) (isset($settings[ $pre . 'hover_x' ]) ? $settings[ $pre . 'hover_x' ] : 0)));
            $hy = max(-24, min(24, (int) (isset($settings[ $pre . 'hover_y' ]) ? $settings[ $pre . 'hover_y' ] : 10)));
            $h_blur = max(0, min(48, (int) (isset($settings[ $pre . 'hover_blur' ]) ? $settings[ $pre . 'hover_blur' ] : 24)));
            $h_spread = max(-8, min(12, (int) (isset($settings[ $pre . 'hover_spread' ]) ? $settings[ $pre . 'hover_spread' ] : 0)));
            $h_color_raw = isset($settings[ $pre . 'hover_color' ]) ? $settings[ $pre . 'hover_color' ] : '';
            $h_color = sanitize_hex_color($h_color_raw);
            if (!$h_color) {
                $h_color = $base_color;
            }
            $hover_shadow = self::wdp_compile_solid_box_shadow_fragment($hx, $hy, $h_blur, $h_spread, $h_color);
            if ('' !== $hover_shadow) {
                $out .= $varsuffix . '-hover:' . esc_attr($hover_shadow) . ';';
            }
        }

        return $out;
    }

    /**
     * Inline :root block: shortcode tetikleyici (sc) ve popup içi (modal) kutular için ayrı gölgelenme.
     *
     * @param array $settings Parsed wdp_button_settings.
     * @return string
     */
    private static function get_inline_plugin_button_shadow_root_css(array $settings) {
        $parts = '';

        // Geriye uyumluluk / ham veri için eski tek slot → migrate get_button_customization_css içinde uygulanır.
        $parts .= self::wdp_inline_button_shadow_fragment_for_slot($settings, 'sc', '--wdp-plugin-btn-shadow-sc');
        $parts .= self::wdp_inline_button_shadow_fragment_for_slot($settings, 'modal', '--wdp-plugin-btn-shadow-modal');

        if ('' === $parts) {
            return '';
        }

        return ':root{' . $parts . "}\n";
    }
    
    /**
     * Get button customization CSS variables
     *
     * @return string CSS variables.
     */
    private static function get_button_customization_css() {
        // Normal form ayarlarını al
        $button_settings = get_option('wdp_button_settings', array());

        $button_settings = WDP_Utils::normalize_legacy_popup_button_text(is_array($button_settings) ? $button_settings : array());
        $button_settings = WDP_Utils::migrate_button_shadow_to_sc_modal($button_settings);

        // Varsayılan değerler
        $defaults = array(
            'button_primary_color' => '#1e73be',
            'button_primary_hover' => '#185d98',
            'button_border_radius' => '20',
            'modal_background_color' => '#ffffff',
            'modal_border_radius' => '20',
            'input_border_color' => '#d1d5db',
            'input_border_radius' => '20',
            'title_color' => '#1f2937',
            'title_font_size' => '27',
            'title_font_size_mobile' => '22',
            'close_button_color' => '#6b7280',
            'button_checkout_color' => '#48bb78',
            'button_checkout_hover' => '#38a169',
            'popup_button_text' => 'Bağış Yap',
            'popup_button_color' => '#1e73be',
            'popup_button_hover' => '#185d98',
            'popup_button_text_color' => '#ffffff',
            'popup_button_font_size' => '18',
            'popup_button_font_weight' => '700',
            'popup_button_font_family' => 'inherit',
            'popup_button_custom_font' => '',
            'popup_button_size' => 'large',
            /* Yalnızca shortcode tetikleyici: small | medium | large | xlarge */
            'shortcode_button_size' => 'medium',
            'popup_button_custom_min_width' => '140',
            'popup_button_custom_min_height' => '48',
            'popup_button_custom_padding_x' => '24',
            'popup_button_border_radius' => '20',
            'popup_button_border_size' => '0',
            'label_color' => '#374151',
            'label_font_size' => 14,
            'label_font_weight' => '600',
            'placeholder_color' => '#6b7280',
            'form_gap' => 16,
            // Shortcode tetikleyici gölgesi
            'button_shadow_sc_enabled' => '0',
            'button_shadow_sc_color' => '#94a3b8',
            'button_shadow_sc_x' => '0',
            'button_shadow_sc_y' => '8',
            'button_shadow_sc_blur' => '20',
            'button_shadow_sc_spread' => '0',
            'button_shadow_sc_hover_enhanced' => '0',
            'button_shadow_sc_hover_blur' => '24',
            'button_shadow_sc_hover_color' => '#64748b',
            'button_shadow_sc_hover_x' => '0',
            'button_shadow_sc_hover_y' => '10',
            'button_shadow_sc_hover_spread' => '0',
            // Popup içi / gömülü form butonları gölgesi
            'button_shadow_modal_enabled' => '0',
            'button_shadow_modal_color' => '#94a3b8',
            'button_shadow_modal_x' => '0',
            'button_shadow_modal_y' => '8',
            'button_shadow_modal_blur' => '20',
            'button_shadow_modal_spread' => '0',
            'button_shadow_modal_hover_enhanced' => '0',
            'button_shadow_modal_hover_blur' => '24',
            'button_shadow_modal_hover_color' => '#64748b',
            'button_shadow_modal_hover_x' => '0',
            'button_shadow_modal_hover_y' => '10',
            'button_shadow_modal_hover_spread' => '0',
        );
        
        $settings = wp_parse_args($button_settings, $defaults);
        $settings = self::sanitize_css_settings($settings, $defaults, array(
            'button_border_radius',
            'modal_border_radius',
            'input_border_radius',
            'title_font_size',
            'title_font_size_mobile',
            'popup_button_font_size',
            'popup_button_border_radius',
            'popup_button_border_size',
            'popup_button_custom_min_width',
            'popup_button_custom_min_height',
            'popup_button_custom_padding_x',
            'label_font_size',
            'form_gap',
        ));
        
        // CSS değişkenlerini oluştur
        /*
         * :root — shortcode tetikleyici buton modal sarmalayıcısının dışında kaldığı için
         * tüm --wdp-* özelleştirme değişkenleri burada da tanımlanır (inheritance).
         * .hdf-donation-modal-wrapper — popup / gömülü form içi öncelik aynı kalır.
         */
        $css = ":root,\n.hdf-donation-modal-wrapper {\n";
        
        // Popup butonu değişkenleri
        $popup_button_color = !empty($settings['popup_button_color']) ? $settings['popup_button_color'] : '#1e73be';
        $popup_button_hover = !empty($settings['popup_button_hover']) ? $settings['popup_button_hover'] : '#185d98';
        if (isset($settings['popup_button_color'])) {
            $css .= "  --wdp-primary: " . esc_attr($popup_button_color) . ";\n";
        } else {
            $css .= "  --wdp-primary: #1e73be;\n";
        }
        if (isset($settings['popup_button_hover'])) {
            $css .= "  --wdp-primary-hover: " . esc_attr($popup_button_hover) . ";\n";
        } else {
            $css .= "  --wdp-primary-hover: #185d98;\n";
        }
        if (isset($settings['popup_button_font_size'])) {
            $css .= "  --wdp-popup-button-font-size: " . esc_attr($settings['popup_button_font_size']) . "px;\n";
        } else {
            $css .= "  --wdp-popup-button-font-size: 18px;\n";
        }
        if (isset($settings['popup_button_font_weight'])) {
            $css .= "  --wdp-popup-button-font-weight: " . esc_attr($settings['popup_button_font_weight']) . ";\n";
        } else {
            $css .= "  --wdp-popup-button-font-weight: 800;\n";
        }
        $css .= "  --wdp-button-font-family: inherit;\n";
        $css .= "  --wdp-button-font-weight: 800;\n";
        // Popup buton font-family
        if (isset($settings['popup_button_font_family'])) {
            if ($settings['popup_button_font_family'] === 'custom' && !empty($settings['popup_button_custom_font'])) {
                $css .= "  --wdp-popup-button-font-family: " . esc_attr($settings['popup_button_custom_font']) . ";\n";
            } elseif ($settings['popup_button_font_family'] !== 'inherit' && $settings['popup_button_font_family'] !== 'custom') {
                $css .= "  --wdp-popup-button-font-family: " . esc_attr($settings['popup_button_font_family']) . ", sans-serif;\n";
            } else {
                $css .= "  --wdp-popup-button-font-family: inherit;\n";
            }
        } else {
            $css .= "  --wdp-popup-button-font-family: inherit;\n";
        }
        // Popup buton border radius
        if (isset($settings['popup_button_border_radius'])) {
            $css .= "  --wdp-popup-button-radius: " . esc_attr($settings['popup_button_border_radius']) . "px;\n";
        } else {
            $css .= "  --wdp-popup-button-radius: 20px;\n";
        }
        if (isset($settings['popup_button_border_size'])) {
            $css .= "  --wdp-popup-button-border-size: " . esc_attr($settings['popup_button_border_size']) . "px;\n";
        } else {
            $css .= "  --wdp-popup-button-border-size: 0px;\n";
        }

        $popup_button_size = isset($settings['popup_button_size']) ? $settings['popup_button_size'] : 'large';
        $popup_size_presets = array(
            'small' => array('min_width' => 112, 'min_height' => 42, 'padding_x' => 18),
            'medium' => array('min_width' => 126, 'min_height' => 46, 'padding_x' => 21),
            'large' => array('min_width' => 140, 'min_height' => 48, 'padding_x' => 24),
            'xlarge' => array('min_width' => 156, 'min_height' => 54, 'padding_x' => 30),
        );

        $popup_button_min_width = 140;
        $popup_button_min_height = 48;
        $popup_button_padding_x = 24;

        if ($popup_button_size === 'custom') {
            $popup_button_min_width = isset($settings['popup_button_custom_min_width']) ? max(80, min(420, (int) $settings['popup_button_custom_min_width'])) : 140;
            $popup_button_min_height = isset($settings['popup_button_custom_min_height']) ? max(36, min(100, (int) $settings['popup_button_custom_min_height'])) : 48;
            $popup_button_padding_x = isset($settings['popup_button_custom_padding_x']) ? max(8, min(64, (int) $settings['popup_button_custom_padding_x'])) : 24;
        } elseif (isset($popup_size_presets[$popup_button_size])) {
            $popup_button_min_width = (int) $popup_size_presets[$popup_button_size]['min_width'];
            $popup_button_min_height = (int) $popup_size_presets[$popup_button_size]['min_height'];
            $popup_button_padding_x = (int) $popup_size_presets[$popup_button_size]['padding_x'];
        }

        // Shortcode tetikleyici boyutu (yalnızca --wdp-sc-trigger-*; popup içi butonlara uygulanmaz).
        $sc_size = isset($settings['shortcode_button_size']) ? strtolower((string) $settings['shortcode_button_size']) : '';
        if (!in_array($sc_size, array('small', 'medium', 'large', 'xlarge'), true)) {
            $legacy_sc = isset($settings['popup_button_size']) ? strtolower((string) $settings['popup_button_size']) : '';
            $sc_size = in_array($legacy_sc, array('small', 'medium', 'large', 'xlarge'), true) ? $legacy_sc : 'medium';
        }
        $base_popup_fs = isset($settings['popup_button_font_size']) ? max(12, min(32, (int) $settings['popup_button_font_size'])) : 18;
        $sc_tier = array(
            'small' => array('min_h' => 40, 'min_w' => 108, 'pad_x' => 14, 'pad_y' => 7, 'fs_add' => -2),
            'medium' => array('min_h' => 46, 'min_w' => 126, 'pad_x' => 20, 'pad_y' => 10, 'fs_add' => 0),
            'large' => array('min_h' => 52, 'min_w' => 140, 'pad_x' => 24, 'pad_y' => 12, 'fs_add' => 1),
            'xlarge' => array('min_h' => 56, 'min_w' => 152, 'pad_x' => 28, 'pad_y' => 14, 'fs_add' => 2),
        );
        $sc = $sc_tier[ $sc_size ];
        $sc_fs = max(12, min(22, $base_popup_fs + (int) $sc['fs_add'] ));
        $css .= "  --wdp-sc-trigger-min-height: " . (int) $sc['min_h'] . "px;\n";
        $css .= "  --wdp-sc-trigger-min-width: " . (int) $sc['min_w'] . "px;\n";
        $css .= "  --wdp-sc-trigger-padding-inline: " . (int) $sc['pad_x'] . "px;\n";
        $css .= "  --wdp-sc-trigger-padding-block: " . (int) $sc['pad_y'] . "px;\n";
        $css .= "  --wdp-sc-trigger-font-size: " . $sc_fs . "px;\n";

        $css .= "  --wdp-popup-button-min-width: " . $popup_button_min_width . "px;\n";
        $css .= "  --wdp-popup-button-min-height: " . $popup_button_min_height . "px;\n";
        $css .= "  --wdp-popup-button-padding-inline: " . $popup_button_padding_x . "px;\n";
        $css .= "  --wdp-popup-button-bg: " . esc_attr($popup_button_color) . ";\n";
        $css .= "  --wdp-popup-button-bg-hover: " . esc_attr($popup_button_hover) . ";\n";
        $css .= "  --wdp-popup-button-border-color: " . esc_attr($popup_button_color) . ";\n";
        $css .= "  --wdp-popup-button-border-hover-color: " . esc_attr($popup_button_hover) . ";\n";
        $sc_text = !empty($settings['popup_button_text_color']) ? sanitize_hex_color($settings['popup_button_text_color']) : '';
        if (!$sc_text) {
            $sc_text = '#ffffff';
        }
        $css .= "  --wdp-shortcode-trigger-text: " . esc_attr($sc_text) . ";\n";

        
        // Normal form değişkenleri
        $css .= "  --wdp-button-primary: " . esc_attr($settings['button_primary_color']) . ";\n";
        $css .= "  --wdp-button-primary-hover: " . esc_attr($settings['button_primary_hover']) . ";\n";
        $css .= "  --wdp-button-radius: " . esc_attr($settings['button_border_radius']) . "px;\n";
        $css .= "  --wdp-modal-bg: " . esc_attr($settings['modal_background_color']) . ";\n";
        $css .= "  --wdp-modal-radius: " . esc_attr($settings['modal_border_radius']) . "px;\n";
        $css .= "  --wdp-input-border: " . esc_attr($settings['input_border_color']) . ";\n";
        $css .= "  --wdp-input-radius: " . esc_attr($settings['input_border_radius']) . "px;\n";
        $css .= "  --wdp-title-color: " . esc_attr($settings['title_color']) . ";\n";
        $css .= "  --wdp-title-size: " . esc_attr($settings['title_font_size']) . "px;\n";
        if (!empty($settings['title_font_size_mobile'])) {
            $css .= "  --wdp-title-size-mobile: " . esc_attr($settings['title_font_size_mobile']) . "px;\n";
        }
        $css .= "  --wdp-close-color: " . esc_attr($settings['close_button_color']) . ";\n";
        $css .= "  --wdp-label-color: " . esc_attr($settings['label_color']) . ";\n";
        $css .= "  --wdp-label-font-size: " . esc_attr($settings['label_font_size']) . "px;\n";
        $css .= "  --wdp-label-font-weight: " . esc_attr($settings['label_font_weight']) . ";\n";
        $css .= "  --wdp-placeholder-color: " . esc_attr($settings['placeholder_color']) . ";\n";
        $css .= "  --wdp-form-gap: " . esc_attr($settings['form_gap']) . "px;\n";
        /* Dikey form ritmi: admin form_gap ile orantılı; eski 6px üst sınırı kaldırıldı (parçalanmış düzen) */
        $css .= "  --wdp-form-stack-gap: clamp(8px, calc(var(--wdp-form-gap) * 0.75), 18px);\n";
        // Progress bar ayarlarını al
        $progress_settings = get_option('wdp_progress_bar_settings', array());
        $progress_defaults = array(
            'container_bg' => '#f8fafc',
            'container_border' => '#e2e8f0',
            'track_bg' => '#e2e8f0',
            'fill_color' => '#2563eb',
            'preview_bg' => '#64748b',
            'percentage_bg' => '#ffffff',
            'percentage_text' => '#1e293b',
        );
        $progress_merged = wp_parse_args($progress_settings, $progress_defaults);
        $progress_fill_hex = WDP_Utils::resolve_progress_bar_fill_color($progress_merged);
        $progress_settings = self::sanitize_css_settings(
            array_merge($progress_merged, array('fill_color' => $progress_fill_hex)),
            $progress_defaults
        );

        $css .= "  --wdp-progress-container-bg: " . esc_attr($progress_settings['container_bg']) . ";\n";
        $css .= "  --wdp-progress-container-border: " . esc_attr($progress_settings['container_border']) . ";\n";
        $css .= "  --wdp-progress-track-bg: " . esc_attr($progress_settings['track_bg']) . ";\n";
        $css .= "  --wdp-progress-fill: " . esc_attr($progress_fill_hex) . ";\n";
        $css .= "  --wdp-progress-preview-bg: " . esc_attr($progress_settings['preview_bg']) . ";\n";
        $css .= "  --wdp-progress-percentage-bg: " . esc_attr($progress_settings['percentage_bg']) . ";\n";
        $css .= "  --wdp-progress-percentage-text: " . esc_attr($progress_settings['percentage_text']) . ";\n";
        
        // Ödeme Yap butonu renkleri
        if (isset($settings['button_checkout_color'])) {
            $css .= "  --wdp-accent: " . esc_attr($settings['button_checkout_color']) . ";\n";
        } else {
            $css .= "  --wdp-accent: #48bb78;\n";
        }
        if (isset($settings['button_checkout_hover'])) {
            $css .= "  --wdp-accent-hover: " . esc_attr($settings['button_checkout_hover']) . ";\n";
        } else {
            $css .= "  --wdp-accent-hover: #38a169;\n";
        }
        
        // Hisseli form ayarlarını al
        $shareholder_settings = get_option('wdp_shareholder_settings', array());
        $shareholder_defaults = array(
            'shareholder_card_bg' => '#ffffff',
            'shareholder_card_border' => '#f0f2f5',
            'shareholder_card_radius' => '20',
            'shareholder_card_shadow' => '0 1px 3px rgba(0, 0, 0, 0.05)',
            'shareholder_header_bg' => '#2a7cc4',
            'shareholder_header_color' => '#ffffff',
            'shareholder_header_bg_hover' => '#3189cf',
            'shareholder_content_padding' => '12',
            'shareholders_area_bg' => '#fafbfc',
            'shareholders_area_border' => '#e1e5e9',
            'shareholders_area_radius' => '20',
            'shareholders_scrollbar_color' => '#4a90e2',
            'share_counter_border' => '#d1d5db',
            'share_counter_bg' => '#ffffff',
            'share_counter_button_color' => '#888888',
        );
        $shareholder_settings = self::sanitize_css_settings(
            wp_parse_args($shareholder_settings, $shareholder_defaults),
            $shareholder_defaults,
            array('shareholder_card_radius', 'shareholder_content_padding', 'shareholders_area_radius')
        );
        
        // Hisseli form değişkenleri
        $css .= "  --wdp-shareholder-card-bg: " . esc_attr($shareholder_settings['shareholder_card_bg']) . ";\n";
        $css .= "  --wdp-shareholder-card-border: " . esc_attr($shareholder_settings['shareholder_card_border']) . ";\n";
        $css .= "  --wdp-shareholder-card-radius: " . esc_attr($shareholder_settings['shareholder_card_radius']) . "px;\n";
        $css .= "  --wdp-shareholder-card-shadow: " . esc_attr($shareholder_settings['shareholder_card_shadow']) . ";\n";
        $shareholder_header_bg = isset($shareholder_settings['shareholder_header_bg'])
            ? strtolower(trim((string) $shareholder_settings['shareholder_header_bg']))
            : '#184a75';
        if ($shareholder_header_bg === '#f9fafb' || $shareholder_header_bg === '#fafbfc' || $shareholder_header_bg === '#184a75') {
            $shareholder_header_bg = '#2a7cc4';
        }
        $shareholder_header_color = isset($shareholder_settings['shareholder_header_color'])
            ? strtolower(trim((string) $shareholder_settings['shareholder_header_color']))
            : '#ffffff';
        if ($shareholder_header_color === '#1f2937' || $shareholder_header_color === '#374151') {
            $shareholder_header_color = '#ffffff';
        }
        $shareholder_header_hover = isset($shareholder_settings['shareholder_header_bg_hover'])
            ? (string) $shareholder_settings['shareholder_header_bg_hover']
            : '#1f5688';
        $css .= "  --wdp-shareholder-header-bg: " . esc_attr($shareholder_header_bg) . ";\n";
        $css .= "  --wdp-shareholder-header-color: " . esc_attr($shareholder_header_color) . ";\n";
        $css .= "  --wdp-shareholder-header-bg-hover: " . esc_attr($shareholder_header_hover) . ";\n";
        $css .= "  --wdp-shareholder-content-padding: " . esc_attr($shareholder_settings['shareholder_content_padding']) . "px;\n";
        $shareholders_area_bg = WDP_Utils::coerce_solid_hex_background(
            isset($shareholder_settings['shareholders_area_bg']) ? $shareholder_settings['shareholders_area_bg'] : '#fafbfc',
            '#fafbfc'
        );
        $css .= "  --wdp-shareholders-area-bg: " . esc_attr($shareholders_area_bg) . ";\n";
        $css .= "  --wdp-shareholders-area-border: " . esc_attr($shareholder_settings['shareholders_area_border']) . ";\n";
        $css .= "  --wdp-shareholders-area-radius: " . esc_attr($shareholder_settings['shareholders_area_radius']) . "px;\n";
        $css .= "  --wdp-shareholders-scrollbar-color: " . esc_attr($shareholder_settings['shareholders_scrollbar_color']) . ";\n";
        $css .= "  --wdp-share-counter-border: " . esc_attr($shareholder_settings['share_counter_border']) . ";\n";
        $css .= "  --wdp-share-counter-bg: " . esc_attr($shareholder_settings['share_counter_bg']) . ";\n";
        $css .= "  --wdp-share-counter-button-color: " . esc_attr($shareholder_settings['share_counter_button_color']) . ";\n";
        
        // Başarı ekranı ayarlarını al
        $success_settings = get_option('wdp_success_settings', array());
        $success_defaults = array(
            'success_button_color' => '#1e73be',
            'success_button_hover' => '#185d98',
            'success_button_radius' => '20',
            'success_message_bg' => 'rgba(72, 187, 120, 0.1)',
            'success_message_color' => '#48bb78',
            'success_message_border' => 'rgba(72, 187, 120, 0.2)',
            'success_message_radius' => '20',
            'mini_cart_bg' => '#f9fafb',
            'mini_cart_border' => '#e5e7eb',
            'mini_cart_radius' => '20',
            'cart_item_name_color' => '#1f2937',
            'cart_item_price_color' => '#1e73be',
        );
        $success_settings = self::sanitize_css_settings(
            wp_parse_args($success_settings, $success_defaults),
            $success_defaults,
            array('success_button_radius', 'success_message_radius', 'mini_cart_radius')
        );
        
        // Başarı ekranı değişkenleri
        $css .= "  --wdp-success-button-color: " . esc_attr($success_settings['success_button_color']) . ";\n";
        $css .= "  --wdp-success-button-hover: " . esc_attr($success_settings['success_button_hover']) . ";\n";
        $css .= "  --wdp-success-button-radius: " . esc_attr($success_settings['success_button_radius']) . "px;\n";
        $css .= "  --wdp-success-message-bg: " . esc_attr($success_settings['success_message_bg']) . ";\n";
        $css .= "  --wdp-success-message-color: " . esc_attr($success_settings['success_message_color']) . ";\n";
        $css .= "  --wdp-success-message-border: " . esc_attr($success_settings['success_message_border']) . ";\n";
        $css .= "  --wdp-success-message-radius: " . esc_attr($success_settings['success_message_radius']) . "px;\n";
        $css .= "  --wdp-mini-cart-bg: " . esc_attr($success_settings['mini_cart_bg']) . ";\n";
        $css .= "  --wdp-mini-cart-border: " . esc_attr($success_settings['mini_cart_border']) . ";\n";
        $css .= "  --wdp-mini-cart-radius: " . esc_attr($success_settings['mini_cart_radius']) . "px;\n";
        $css .= "  --wdp-cart-item-name-color: " . esc_attr($success_settings['cart_item_name_color']) . ";\n";
        $css .= "  --wdp-cart-item-price-color: " . esc_attr($success_settings['cart_item_price_color']) . ";\n";
        
        // Modal görünüm ayarlarını al
        $modal_layout_settings = get_option('wdp_modal_layout_settings', array());
        $modal_layout_defaults = array(
            'side_panel_width_desktop_percent' => '50',
            'side_panel_width_desktop_min_px'  => '400',
            'side_panel_width_desktop_max_px'  => '720',
            'side_panel_width_tablet_percent'  => '55',
            'side_panel_width_tablet_min_px'   => '380',
            'side_panel_width_tablet_max_px'   => '600',
            'side_panel_width_mobile_percent'  => '92',
            'side_panel_width_mobile_min_px'   => '0',
            'side_panel_width_mobile_max_px'   => '100',
            // Desktop
            'popup_modal_width_desktop' => '540',
            'inpage_form_width_desktop' => '480',
            'modal_padding_top_desktop' => '32',
            'modal_padding_right_desktop' => '24',
            'modal_padding_bottom_desktop' => '24',
            'modal_padding_left_desktop' => '24',
            // Mobile
            'popup_modal_width_mobile' => '540',
            'inpage_form_width_mobile' => '480',
            'modal_padding_top_mobile' => '28',
            'modal_padding_right_mobile' => '20',
            'modal_padding_bottom_mobile' => '20',
            'modal_padding_left_mobile' => '20',
        );
        $modal_layout_settings = self::sanitize_css_settings(
            wp_parse_args($modal_layout_settings, $modal_layout_defaults),
            $modal_layout_defaults,
            array(
                'side_panel_width_desktop_percent',
                'side_panel_width_desktop_min_px',
                'side_panel_width_desktop_max_px',
                'side_panel_width_tablet_percent',
                'side_panel_width_tablet_min_px',
                'side_panel_width_tablet_max_px',
                'side_panel_width_mobile_percent',
                'side_panel_width_mobile_min_px',
                'side_panel_width_mobile_max_px',
                'popup_modal_width_desktop',
                'inpage_form_width_desktop',
                'modal_padding_top_desktop',
                'modal_padding_right_desktop',
                'modal_padding_bottom_desktop',
                'modal_padding_left_desktop',
                'popup_modal_width_mobile',
                'inpage_form_width_mobile',
                'modal_padding_top_mobile',
                'modal_padding_right_mobile',
                'modal_padding_bottom_mobile',
                'modal_padding_left_mobile',
            )
        );
        
        $sp_mobile_max = absint($modal_layout_settings['side_panel_width_mobile_max_px']);
        $sp_tablet_max = absint($modal_layout_settings['side_panel_width_tablet_max_px']);
        $sp_desktop_max = absint($modal_layout_settings['side_panel_width_desktop_max_px']);
        $css .= "  --wdp-sp-width-pct-mobile: " . esc_attr($modal_layout_settings['side_panel_width_mobile_percent']) . "vw;\n";
        $css .= "  --wdp-sp-width-min-mobile: " . esc_attr($modal_layout_settings['side_panel_width_mobile_min_px']) . "px;\n";
        $css .= "  --wdp-sp-width-max-mobile: " . esc_attr($sp_mobile_max >= 100 ? '100vw' : $sp_mobile_max . 'px') . ";\n";
        $css .= "  --wdp-sp-width-pct-tablet: " . esc_attr($modal_layout_settings['side_panel_width_tablet_percent']) . "vw;\n";
        $css .= "  --wdp-sp-width-min-tablet: " . esc_attr($modal_layout_settings['side_panel_width_tablet_min_px']) . "px;\n";
        $css .= "  --wdp-sp-width-max-tablet: " . esc_attr($sp_tablet_max >= 100 ? '100vw' : $sp_tablet_max . 'px') . ";\n";
        $css .= "  --wdp-sp-width-pct-desktop: " . esc_attr($modal_layout_settings['side_panel_width_desktop_percent']) . "vw;\n";
        $css .= "  --wdp-sp-width-min-desktop: " . esc_attr($modal_layout_settings['side_panel_width_desktop_min_px']) . "px;\n";
        $css .= "  --wdp-sp-width-max-desktop: " . esc_attr($sp_desktop_max >= 100 ? '100vw' : $sp_desktop_max . 'px') . ";\n";

        // Modal görünüm değişkenleri - Desktop
        $css .= "  --wdp-popup-modal-width-desktop: " . esc_attr($modal_layout_settings['popup_modal_width_desktop']) . "px;\n";
        $css .= "  --wdp-inpage-form-width-desktop: " . esc_attr($modal_layout_settings['inpage_form_width_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-top-desktop: " . esc_attr($modal_layout_settings['modal_padding_top_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-right-desktop: " . esc_attr($modal_layout_settings['modal_padding_right_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-bottom-desktop: " . esc_attr($modal_layout_settings['modal_padding_bottom_desktop']) . "px;\n";
        $css .= "  --wdp-modal-padding-left-desktop: " . esc_attr($modal_layout_settings['modal_padding_left_desktop']) . "px;\n";
        // Modal görünüm değişkenleri - Mobile
        $css .= "  --wdp-popup-modal-width-mobile: " . esc_attr($modal_layout_settings['popup_modal_width_mobile']) . "px;\n";
        $css .= "  --wdp-inpage-form-width-mobile: " . esc_attr($modal_layout_settings['inpage_form_width_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-top-mobile: " . esc_attr($modal_layout_settings['modal_padding_top_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-right-mobile: " . esc_attr($modal_layout_settings['modal_padding_right_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-bottom-mobile: " . esc_attr($modal_layout_settings['modal_padding_bottom_mobile']) . "px;\n";
        $css .= "  --wdp-modal-padding-left-mobile: " . esc_attr($modal_layout_settings['modal_padding_left_mobile']) . "px;\n";
        
        $css .= "}\n";

        // Mobil için tipografi ve modal görünüm değişkenlerini override et
        // CRITICAL: Desktop CSS değişkenlerini mobile değişkenleriyle override et
        // Bu sayede desktop kuralları (media query dışında) mobilde mobile değişkenlerini kullanacak
        // Breakpoint: --wdp-breakpoint-md (600px) ile uyumlu
        $css .= "@media (max-width: 600px) {\n";
        $css .= "  :root,\n  .hdf-donation-modal-wrapper {\n";
        $css .= "    --wdp-title-size: var(--wdp-title-size-mobile, " . esc_attr($settings['title_font_size']) . "px);\n";
        // Mobile modal görünüm değişkenlerini override et - desktop değişkenlerini mobile ile değiştir
        $css .= "    --wdp-popup-modal-width-desktop: var(--wdp-popup-modal-width-mobile);\n";
        $css .= "    --wdp-inpage-form-width-desktop: var(--wdp-inpage-form-width-mobile);\n";
        $css .= "    --wdp-modal-padding-top-desktop: var(--wdp-modal-padding-top-mobile);\n";
        $css .= "    --wdp-modal-padding-right-desktop: var(--wdp-modal-padding-right-mobile);\n";
        $css .= "    --wdp-modal-padding-bottom-desktop: var(--wdp-modal-padding-bottom-mobile);\n";
        $css .= "    --wdp-modal-padding-left-desktop: var(--wdp-modal-padding-left-mobile);\n";
        $css .= "  }\n";
        $css .= "}\n";

        $css .= self::get_inline_plugin_button_shadow_root_css($settings);
        
        return $css;
    }
    
    /**
     * Get inline CSS for modal visibility
     *
     * @return string Inline CSS.
     */
    private static function get_inline_css() {
        // Buton özelleştirme CSS'ini ekle
        $button_css = self::get_button_customization_css();
        
        return $button_css . "
        /* CRITICAL: Prevent font flash - apply font-size immediately before CSS loads */
        /* IMPORTANT: Respect dynamic title size set via --wdp-title-size */
        .hdf-donation-modal-wrapper .wdp-modal-title,
        .hdf-donation-modal-wrapper .wdp-form-title,
        .hdf-donation-modal-wrapper.wdp-modal .wdp-modal-content h2,
        .hdf-donation-modal-wrapper.wdp-donation-form .wdp-modal-content h2,
        .hdf-donation-modal-wrapper.wdp-modal .wdp-modal-content .wdp-form-title,
        .hdf-donation-modal-wrapper.wdp-donation-form .wdp-modal-content .wdp-form-title,
        .hdf-donation-modal-wrapper.wdp-modal .wdp-modal-content h2.wdp-form-title,
        .hdf-donation-modal-wrapper.wdp-donation-form .wdp-modal-content h2.wdp-form-title {
            font-size: var(--wdp-title-size, 27px);
            line-height: 1.2;
        }
        /* Modal kapalıyken kesinlikle sayfa düzenini etkilememeli */
        .hdf-donation-modal-wrapper.wdp-modal:not(.show) { 
            position: static; 
            z-index: auto; 
            left: auto; 
            top: auto; 
            right: auto; 
            bottom: auto; 
            width: 0; 
            height: 0; 
            min-width: 0; 
            min-height: 0; 
            max-width: 0; 
            max-height: 0; 
            visibility: hidden; 
            opacity: 0; 
            pointer-events: none; 
            clip: rect(0, 0, 0, 0); 
            clip-path: inset(100%); 
        }
        /* Modal açıkken normal görünüm */
        .hdf-donation-modal-wrapper.wdp-modal.show { 
            position: fixed; 
            z-index: 999999; 
            left: 0; 
            top: 0; 
            right: 0; 
            bottom: 0; 
            width: 100vw; 
            height: 100vh; 
            clip: auto; 
            clip-path: none; 
        }
        .hdf-donation-modal-wrapper .wdp-modal-content { 
            z-index: 1000000; 
        }
        .hdf-donation-modal-wrapper .wdp-modal-close { 
            z-index: 1000001; 
        }
        .hdf-donation-modal-wrapper.wdp-modal * { 
            box-sizing: border-box; 
        }
        .hdf-donation-modal-wrapper .wdp-modal-content * { 
            box-sizing: border-box; 
        }
        .hdf-donation-modal-wrapper.wdp-donation-form * { 
            box-sizing: border-box; 
        }
        @media (max-width: 600px) {
            .hdf-donation-modal-wrapper.wdp-modal.show .wdp-modal-content { 
                width: 95%; 
                max-width: 95%; 
                margin: 10px auto; 
            }
        }
        ";
    }

    /**
     * Get critical CSS for inline rendering (above-the-fold content)
     * PERFORMANCE: Minimal CSS for faster initial render
     * 
     * @return string Critical CSS
     */
    private static function get_critical_css() {
        // PERFORMANCE: Critical CSS - only essential styles for initial render
        // Minimize size for faster page load
        return "
        /* PERFORMANCE: Critical CSS - Modal visibility only */
        .hdf-donation-modal-wrapper.wdp-modal:not(.show) {
            display: none;
            visibility: hidden;
            opacity: 0;
            pointer-events: none;
        }
        .hdf-donation-modal-wrapper.wdp-modal.show {
            display: flex;
            position: fixed;
            z-index: 2147483645;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            visibility: visible;
            opacity: 1;
        }
        .hdf-donation-modal-wrapper.wdp-modal .wdp-modal-content.wdp-modal-content {
            z-index: 2147483646;
            position: relative;
        }
        body.wdp-modal-open.wdp-modal-open {
            overflow: hidden;
        }
        ";
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
