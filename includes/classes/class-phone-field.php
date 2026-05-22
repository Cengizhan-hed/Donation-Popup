<?php
/**
 * Central phone field markup and country list for donation forms.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Phone_Field
 */
class WDP_Phone_Field {

    /**
     * Supported countries (iso2 => name, dial digits without +).
     *
     * @return array<string, array{name:string,dial:string}>
     */
    public static function get_countries() {
        $countries = array(
            'tr' => array('name' => __('Türkiye', 'woo-donation-popup'), 'dial' => '90'),
            'de' => array('name' => __('Almanya', 'woo-donation-popup'), 'dial' => '49'),
            'nl' => array('name' => __('Hollanda', 'woo-donation-popup'), 'dial' => '31'),
            'be' => array('name' => __('Belçika', 'woo-donation-popup'), 'dial' => '32'),
            'fr' => array('name' => __('Fransa', 'woo-donation-popup'), 'dial' => '33'),
            'at' => array('name' => __('Avusturya', 'woo-donation-popup'), 'dial' => '43'),
            'ch' => array('name' => __('İsviçre', 'woo-donation-popup'), 'dial' => '41'),
            'gb' => array('name' => __('İngiltere', 'woo-donation-popup'), 'dial' => '44'),
            'us' => array('name' => __('Amerika Birleşik Devletleri', 'woo-donation-popup'), 'dial' => '1'),
            'ca' => array('name' => __('Kanada', 'woo-donation-popup'), 'dial' => '1'),
            'az' => array('name' => __('Azerbaycan', 'woo-donation-popup'), 'dial' => '994'),
            'ke' => array('name' => __('Kenya', 'woo-donation-popup'), 'dial' => '254'),
            'ug' => array('name' => __('Uganda', 'woo-donation-popup'), 'dial' => '256'),
            'tz' => array('name' => __('Tanzanya', 'woo-donation-popup'), 'dial' => '255'),
            'et' => array('name' => __('Etiyopya', 'woo-donation-popup'), 'dial' => '251'),
            'so' => array('name' => __('Somali', 'woo-donation-popup'), 'dial' => '252'),
            'dj' => array('name' => __('Cibuti', 'woo-donation-popup'), 'dial' => '253'),
            'sd' => array('name' => __('Sudan', 'woo-donation-popup'), 'dial' => '249'),
            'td' => array('name' => __('Çad', 'woo-donation-popup'), 'dial' => '235'),
            'bf' => array('name' => __('Burkina Faso', 'woo-donation-popup'), 'dial' => '226'),
            'ml' => array('name' => __('Mali', 'woo-donation-popup'), 'dial' => '223'),
            'ne' => array('name' => __('Nijer', 'woo-donation-popup'), 'dial' => '227'),
            'ng' => array('name' => __('Nijerya', 'woo-donation-popup'), 'dial' => '234'),
            'sn' => array('name' => __('Senegal', 'woo-donation-popup'), 'dial' => '221'),
            'gh' => array('name' => __('Gana', 'woo-donation-popup'), 'dial' => '233'),
            'za' => array('name' => __('Güney Afrika', 'woo-donation-popup'), 'dial' => '27'),
            'sa' => array('name' => __('Suudi Arabistan', 'woo-donation-popup'), 'dial' => '966'),
            'qa' => array('name' => __('Katar', 'woo-donation-popup'), 'dial' => '974'),
            'kw' => array('name' => __('Kuveyt', 'woo-donation-popup'), 'dial' => '965'),
            'ae' => array('name' => __('Birleşik Arap Emirlikleri', 'woo-donation-popup'), 'dial' => '971'),
        );

        /**
         * Filter country list for phone dropdown.
         *
         * @param array<string, array{name:string,dial:string}> $countries Countries.
         */
        return apply_filters('wdp_phone_countries', $countries);
    }

    /**
     * Default ISO2 country code.
     *
     * @return string
     */
    public static function get_default_country_iso() {
        $raw = apply_filters('wdp_phone_default_country', 'tr');
        if (!is_string($raw) || strlen($raw) !== 2) {
            return 'tr';
        }
        $iso = strtolower($raw);
        $countries = self::get_countries();
        return isset($countries[ $iso ]) ? $iso : 'tr';
    }

    /**
     * Compact list for frontend localization.
     *
     * @return array<int, array{iso:string,name:string,dial:string}>
     */
    public static function get_countries_for_js() {
        $out = array();
        foreach (self::get_countries() as $iso => $row) {
            $out[] = array(
                'iso'  => $iso,
                'name' => $row['name'],
                'dial' => $row['dial'],
            );
        }
        return $out;
    }

    /**
     * Render phone field HTML (country code + national number).
     *
     * @param array $args Field arguments.
     * @return string Safe HTML.
     */
    public static function render($args = array()) {
        $defaults = array(
            'name'         => 'donation_phone',
            'id'           => '',
            'required'     => true,
            'placeholder'  => __('Telefon Numarası *', 'woo-donation-popup'),
            'class'        => 'wdp-field-stack__input',
            'autocomplete' => 'tel',
            'inputmode'    => 'tel',
        );
        $args = wp_parse_args($args, $defaults);

        $default_iso = self::get_default_country_iso();
        $countries   = self::get_countries();
        $dial        = isset($countries[ $default_iso ]['dial']) ? $countries[ $default_iso ]['dial'] : '90';

        $name = preg_replace('/[^a-z0-9_\-]/i', '', (string) $args['name']);
        $id   = $args['id'] ? sanitize_html_class((string) $args['id']) : '';
        $class_parts = array_filter(array_map('sanitize_html_class', preg_split('/\s+/', trim((string) $args['class']))));
        if (!in_array('wdp-phone-field__number', $class_parts, true)) {
            $class_parts[] = 'wdp-phone-field__number';
        }
        $class = implode(' ', $class_parts);

        $required_attr = !empty($args['required']) ? ' required' : '';
        $id_attr       = $id ? ' id="' . esc_attr($id) . '"' : '';

        ob_start();
        ?>
        <div class="wdp-phone-field" data-wdp-phone-field data-default-country="<?php echo esc_attr($default_iso); ?>" data-dial-code="<?php echo esc_attr($dial); ?>">
            <div class="wdp-phone-field__inner">
                <div class="wdp-phone-field__code-wrap">
                    <button type="button" class="wdp-phone-field__code-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="<?php echo esc_attr__('Ülke kodu seç', 'woo-donation-popup'); ?>">
                        <span class="wdp-phone-field__code-label">+<?php echo esc_html($dial); ?></span>
                        <span class="wdp-phone-field__chevron" aria-hidden="true"></span>
                    </button>
                </div>
                <span class="wdp-phone-field__divider" aria-hidden="true"></span>
                <input
                    type="tel"
                    class="<?php echo esc_attr(trim($class)); ?>"
                    name="<?php echo esc_attr($name); ?>"
                    <?php echo $id_attr; ?>
                    placeholder="<?php echo esc_attr($args['placeholder']); ?>"
                    autocomplete="<?php echo esc_attr($args['autocomplete']); ?>"
                    inputmode="<?php echo esc_attr($args['inputmode']); ?>"
                    <?php echo $required_attr; ?>
                />
            </div>
        </div>
        <?php
        return trim(ob_get_clean());
    }
}
