<?php
if (!defined('ABSPATH')) {
    exit;
}

trait WDP_Utils_Legacy_Settings_Trait {
    /**
     * Eski kurulumlar: sadece button_text_donate kayıtlıysa popup buton metnine yansıtır.
     *
     * @param array $settings get_option('wdp_button_settings') ham dizisi.
     * @return array
     */
    public static function normalize_legacy_popup_button_text( array $settings ) {
        if (!array_key_exists('popup_button_text', $settings) && !empty($settings['button_text_donate'])) {
            $settings['popup_button_text'] = $settings['button_text_donate'];
        }
        return $settings;
    }

    /**
     * Eski tek "button_shadow_*" anahtarlarını shortcode ('sc') ve modal içi ('modal') çiftleriyle doldurur.
     *
     * @param array $settings Ayar dizisi.
     * @return array
     */
    public static function migrate_button_shadow_to_sc_modal( array $settings ) {
        if (!is_array($settings)) {
            return $settings;
        }
        if (array_key_exists('button_shadow_sc_enabled', $settings) || array_key_exists('button_shadow_modal_enabled', $settings)) {
            return $settings;
        }
        if (!array_key_exists('button_shadow_enabled', $settings)) {
            return $settings;
        }

        $base = array(
            'enabled'           => isset($settings['button_shadow_enabled']) ? (string) $settings['button_shadow_enabled'] : '0',
            'color'             => isset($settings['button_shadow_color']) ? $settings['button_shadow_color'] : '#94a3b8',
            'x'                 => isset($settings['button_shadow_x']) ? $settings['button_shadow_x'] : 0,
            'y'                 => isset($settings['button_shadow_y']) ? $settings['button_shadow_y'] : 8,
            'blur'              => isset($settings['button_shadow_blur']) ? $settings['button_shadow_blur'] : 20,
            'spread'            => isset($settings['button_shadow_spread']) ? $settings['button_shadow_spread'] : 0,
            'hover_enhanced'    => isset($settings['button_shadow_hover_enhanced']) ? (string) $settings['button_shadow_hover_enhanced'] : '0',
            'hover_blur'        => isset($settings['button_shadow_hover_blur']) ? $settings['button_shadow_hover_blur'] : 24,
            'hover_color'       => isset($settings['button_shadow_hover_color']) ? $settings['button_shadow_hover_color'] : '',
            'hover_x'           => isset($settings['button_shadow_hover_x']) ? $settings['button_shadow_hover_x'] : 0,
            'hover_y'           => isset($settings['button_shadow_hover_y']) ? $settings['button_shadow_hover_y'] : 10,
            'hover_spread'      => isset($settings['button_shadow_hover_spread']) ? $settings['button_shadow_hover_spread'] : 0,
        );

        foreach (array('sc', 'modal') as $slot) {
            $p = 'button_shadow_' . $slot . '_';
            $settings[ $p . 'enabled' ]          = $base['enabled'];
            $settings[ $p . 'color' ]           = $base['color'];
            $settings[ $p . 'x' ]              = $base['x'];
            $settings[ $p . 'y' ]              = $base['y'];
            $settings[ $p . 'blur' ]           = $base['blur'];
            $settings[ $p . 'spread' ]         = $base['spread'];
            $settings[ $p . 'hover_enhanced' ] = $base['hover_enhanced'];
            $settings[ $p . 'hover_blur' ]     = $base['hover_blur'];
            $settings[ $p . 'hover_color' ]    = $base['hover_color'];
            $settings[ $p . 'hover_x' ]        = $base['hover_x'];
            $settings[ $p . 'hover_y' ]        = $base['hover_y'];
            $settings[ $p . 'hover_spread' ]   = $base['hover_spread'];
        }

        return $settings;
    }
}
