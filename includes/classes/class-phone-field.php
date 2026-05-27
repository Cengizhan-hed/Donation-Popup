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
            /* Avrupa */
            'al' => array('name' => __('Arnavutluk', 'woo-donation-popup'), 'dial' => '355'),
            'ad' => array('name' => __('Andorra', 'woo-donation-popup'), 'dial' => '376'),
            'at' => array('name' => __('Avusturya', 'woo-donation-popup'), 'dial' => '43'),
            'by' => array('name' => __('Belarus', 'woo-donation-popup'), 'dial' => '375'),
            'be' => array('name' => __('Belçika', 'woo-donation-popup'), 'dial' => '32'),
            'ba' => array('name' => __('Bosna-Hersek', 'woo-donation-popup'), 'dial' => '387'),
            'bg' => array('name' => __('Bulgaristan', 'woo-donation-popup'), 'dial' => '359'),
            'hr' => array('name' => __('Hırvatistan', 'woo-donation-popup'), 'dial' => '385'),
            'cy' => array('name' => __('Kıbrıs', 'woo-donation-popup'), 'dial' => '357'),
            'cz' => array('name' => __('Çekya', 'woo-donation-popup'), 'dial' => '420'),
            'dk' => array('name' => __('Danimarka', 'woo-donation-popup'), 'dial' => '45'),
            'ee' => array('name' => __('Estonya', 'woo-donation-popup'), 'dial' => '372'),
            'fi' => array('name' => __('Finlandiya', 'woo-donation-popup'), 'dial' => '358'),
            'fr' => array('name' => __('Fransa', 'woo-donation-popup'), 'dial' => '33'),
            'de' => array('name' => __('Almanya', 'woo-donation-popup'), 'dial' => '49'),
            'gr' => array('name' => __('Yunanistan', 'woo-donation-popup'), 'dial' => '30'),
            'hu' => array('name' => __('Macaristan', 'woo-donation-popup'), 'dial' => '36'),
            'is' => array('name' => __('İzlanda', 'woo-donation-popup'), 'dial' => '354'),
            'ie' => array('name' => __('İrlanda', 'woo-donation-popup'), 'dial' => '353'),
            'it' => array('name' => __('İtalya', 'woo-donation-popup'), 'dial' => '39'),
            'xk' => array('name' => __('Kosova', 'woo-donation-popup'), 'dial' => '383'),
            'lv' => array('name' => __('Letonya', 'woo-donation-popup'), 'dial' => '371'),
            'li' => array('name' => __('Liechtenstein', 'woo-donation-popup'), 'dial' => '423'),
            'lt' => array('name' => __('Litvanya', 'woo-donation-popup'), 'dial' => '370'),
            'lu' => array('name' => __('Lüksemburg', 'woo-donation-popup'), 'dial' => '352'),
            'mt' => array('name' => __('Malta', 'woo-donation-popup'), 'dial' => '356'),
            'md' => array('name' => __('Moldova', 'woo-donation-popup'), 'dial' => '373'),
            'mc' => array('name' => __('Monako', 'woo-donation-popup'), 'dial' => '377'),
            'me' => array('name' => __('Karadağ', 'woo-donation-popup'), 'dial' => '382'),
            'nl' => array('name' => __('Hollanda', 'woo-donation-popup'), 'dial' => '31'),
            'mk' => array('name' => __('Kuzey Makedonya', 'woo-donation-popup'), 'dial' => '389'),
            'no' => array('name' => __('Norveç', 'woo-donation-popup'), 'dial' => '47'),
            'pl' => array('name' => __('Polonya', 'woo-donation-popup'), 'dial' => '48'),
            'pt' => array('name' => __('Portekiz', 'woo-donation-popup'), 'dial' => '351'),
            'ro' => array('name' => __('Romanya', 'woo-donation-popup'), 'dial' => '40'),
            'ru' => array('name' => __('Rusya', 'woo-donation-popup'), 'dial' => '7'),
            'sm' => array('name' => __('San Marino', 'woo-donation-popup'), 'dial' => '378'),
            'rs' => array('name' => __('Sırbistan', 'woo-donation-popup'), 'dial' => '381'),
            'sk' => array('name' => __('Slovakya', 'woo-donation-popup'), 'dial' => '421'),
            'si' => array('name' => __('Slovenya', 'woo-donation-popup'), 'dial' => '386'),
            'es' => array('name' => __('İspanya', 'woo-donation-popup'), 'dial' => '34'),
            'se' => array('name' => __('İsveç', 'woo-donation-popup'), 'dial' => '46'),
            'ch' => array('name' => __('İsviçre', 'woo-donation-popup'), 'dial' => '41'),
            'ua' => array('name' => __('Ukrayna', 'woo-donation-popup'), 'dial' => '380'),
            'gb' => array('name' => __('İngiltere', 'woo-donation-popup'), 'dial' => '44'),
            /* Asya */
            'af' => array('name' => __('Afganistan', 'woo-donation-popup'), 'dial' => '93'),
            'az' => array('name' => __('Azerbaycan', 'woo-donation-popup'), 'dial' => '994'),
            'bh' => array('name' => __('Bahreyn', 'woo-donation-popup'), 'dial' => '973'),
            'bd' => array('name' => __('Bangladeş', 'woo-donation-popup'), 'dial' => '880'),
            'bn' => array('name' => __('Brunei', 'woo-donation-popup'), 'dial' => '673'),
            'kh' => array('name' => __('Kamboçya', 'woo-donation-popup'), 'dial' => '855'),
            'cn' => array('name' => __('Çin', 'woo-donation-popup'), 'dial' => '86'),
            'ge' => array('name' => __('Gürcistan', 'woo-donation-popup'), 'dial' => '995'),
            'hk' => array('name' => __('Hong Kong', 'woo-donation-popup'), 'dial' => '852'),
            'in' => array('name' => __('Hindistan', 'woo-donation-popup'), 'dial' => '91'),
            'id' => array('name' => __('Endonezya', 'woo-donation-popup'), 'dial' => '62'),
            'ir' => array('name' => __('İran', 'woo-donation-popup'), 'dial' => '98'),
            'iq' => array('name' => __('Irak', 'woo-donation-popup'), 'dial' => '964'),
            'il' => array('name' => __('İsrail', 'woo-donation-popup'), 'dial' => '972'),
            'jp' => array('name' => __('Japonya', 'woo-donation-popup'), 'dial' => '81'),
            'jo' => array('name' => __('Ürdün', 'woo-donation-popup'), 'dial' => '962'),
            'kz' => array('name' => __('Kazakistan', 'woo-donation-popup'), 'dial' => '7'),
            'kg' => array('name' => __('Kırgızistan', 'woo-donation-popup'), 'dial' => '996'),
            'kw' => array('name' => __('Kuveyt', 'woo-donation-popup'), 'dial' => '965'),
            'lb' => array('name' => __('Lübnan', 'woo-donation-popup'), 'dial' => '961'),
            'my' => array('name' => __('Malezya', 'woo-donation-popup'), 'dial' => '60'),
            'mv' => array('name' => __('Maldivler', 'woo-donation-popup'), 'dial' => '960'),
            'mn' => array('name' => __('Moğolistan', 'woo-donation-popup'), 'dial' => '976'),
            'mm' => array('name' => __('Myanmar', 'woo-donation-popup'), 'dial' => '95'),
            'np' => array('name' => __('Nepal', 'woo-donation-popup'), 'dial' => '977'),
            'om' => array('name' => __('Umman', 'woo-donation-popup'), 'dial' => '968'),
            'pk' => array('name' => __('Pakistan', 'woo-donation-popup'), 'dial' => '92'),
            'ps' => array('name' => __('Filistin', 'woo-donation-popup'), 'dial' => '970'),
            'ph' => array('name' => __('Filipinler', 'woo-donation-popup'), 'dial' => '63'),
            'qa' => array('name' => __('Katar', 'woo-donation-popup'), 'dial' => '974'),
            'sa' => array('name' => __('Suudi Arabistan', 'woo-donation-popup'), 'dial' => '966'),
            'sg' => array('name' => __('Singapur', 'woo-donation-popup'), 'dial' => '65'),
            'kr' => array('name' => __('Güney Kore', 'woo-donation-popup'), 'dial' => '82'),
            'lk' => array('name' => __('Sri Lanka', 'woo-donation-popup'), 'dial' => '94'),
            'sy' => array('name' => __('Suriye', 'woo-donation-popup'), 'dial' => '963'),
            'tw' => array('name' => __('Tayvan', 'woo-donation-popup'), 'dial' => '886'),
            'tj' => array('name' => __('Tacikistan', 'woo-donation-popup'), 'dial' => '992'),
            'th' => array('name' => __('Tayland', 'woo-donation-popup'), 'dial' => '66'),
            'tm' => array('name' => __('Türkmenistan', 'woo-donation-popup'), 'dial' => '993'),
            'ae' => array('name' => __('Birleşik Arap Emirlikleri', 'woo-donation-popup'), 'dial' => '971'),
            'uz' => array('name' => __('Özbekistan', 'woo-donation-popup'), 'dial' => '998'),
            'vn' => array('name' => __('Vietnam', 'woo-donation-popup'), 'dial' => '84'),
            'ye' => array('name' => __('Yemen', 'woo-donation-popup'), 'dial' => '967'),
            'am' => array('name' => __('Ermenistan', 'woo-donation-popup'), 'dial' => '374'),
            /* Amerika & Okyanusya */
            'us' => array('name' => __('Amerika Birleşik Devletleri', 'woo-donation-popup'), 'dial' => '1'),
            'ca' => array('name' => __('Kanada', 'woo-donation-popup'), 'dial' => '1'),
            'mx' => array('name' => __('Meksika', 'woo-donation-popup'), 'dial' => '52'),
            'br' => array('name' => __('Brezilya', 'woo-donation-popup'), 'dial' => '55'),
            'ar' => array('name' => __('Arjantin', 'woo-donation-popup'), 'dial' => '54'),
            'au' => array('name' => __('Avustralya', 'woo-donation-popup'), 'dial' => '61'),
            'nz' => array('name' => __('Yeni Zelanda', 'woo-donation-popup'), 'dial' => '64'),
            /* Afrika (seçili) */
            'dz' => array('name' => __('Cezayir', 'woo-donation-popup'), 'dial' => '213'),
            'eg' => array('name' => __('Mısır', 'woo-donation-popup'), 'dial' => '20'),
            'ma' => array('name' => __('Fas', 'woo-donation-popup'), 'dial' => '212'),
            'tn' => array('name' => __('Tunus', 'woo-donation-popup'), 'dial' => '216'),
            'ly' => array('name' => __('Libya', 'woo-donation-popup'), 'dial' => '218'),
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
        );

        $countries = self::sort_countries_for_dropdown($countries);

        /**
         * Filter country list for phone dropdown.
         *
         * @param array<string, array{name:string,dial:string}> $countries Countries.
         */
        return apply_filters('wdp_phone_countries', $countries);
    }

    /**
     * Türkiye en üstte, diğerleri ada göre (Türkçe).
     *
     * @param array<string, array{name:string,dial:string}> $countries Countries.
     * @return array<string, array{name:string,dial:string}>
     */
    private static function sort_countries_for_dropdown(array $countries) {
        if (!isset($countries['tr'])) {
            uasort(
                $countries,
                static function ($a, $b) {
                    return strcasecmp((string) $a['name'], (string) $b['name']);
                }
            );
            return $countries;
        }

        $turkey = array( 'tr' => $countries['tr'] );
        unset($countries['tr']);
        uasort(
            $countries,
            static function ($a, $b) {
                return strcasecmp((string) $a['name'], (string) $b['name']);
            }
        );

        return array_merge($turkey, $countries);
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
     * National number length (digits after country code, without leading trunk 0).
     *
     * @return array<string, array{min:int,max:int}>
     */
    public static function get_national_length_rules() {
        $rules = array(
            /* Avrupa */
            'tr' => array( 'min' => 10, 'max' => 10 ),
            'al' => array( 'min' => 9, 'max' => 9 ),
            'ad' => array( 'min' => 6, 'max' => 9 ),
            'at' => array( 'min' => 10, 'max' => 13 ),
            'by' => array( 'min' => 9, 'max' => 9 ),
            'be' => array( 'min' => 9, 'max' => 9 ),
            'ba' => array( 'min' => 8, 'max' => 9 ),
            'bg' => array( 'min' => 9, 'max' => 9 ),
            'hr' => array( 'min' => 9, 'max' => 9 ),
            'cy' => array( 'min' => 8, 'max' => 8 ),
            'cz' => array( 'min' => 9, 'max' => 9 ),
            'dk' => array( 'min' => 8, 'max' => 8 ),
            'ee' => array( 'min' => 7, 'max' => 8 ),
            'fi' => array( 'min' => 9, 'max' => 10 ),
            'fr' => array( 'min' => 9, 'max' => 9 ),
            'de' => array( 'min' => 10, 'max' => 11 ),
            'gr' => array( 'min' => 10, 'max' => 10 ),
            'hu' => array( 'min' => 9, 'max' => 9 ),
            'is' => array( 'min' => 7, 'max' => 7 ),
            'ie' => array( 'min' => 9, 'max' => 9 ),
            'it' => array( 'min' => 9, 'max' => 10 ),
            'xk' => array( 'min' => 8, 'max' => 9 ),
            'lv' => array( 'min' => 8, 'max' => 8 ),
            'li' => array( 'min' => 7, 'max' => 7 ),
            'lt' => array( 'min' => 8, 'max' => 8 ),
            'lu' => array( 'min' => 9, 'max' => 9 ),
            'mt' => array( 'min' => 8, 'max' => 8 ),
            'md' => array( 'min' => 8, 'max' => 8 ),
            'mc' => array( 'min' => 8, 'max' => 9 ),
            'me' => array( 'min' => 8, 'max' => 8 ),
            'nl' => array( 'min' => 9, 'max' => 9 ),
            'mk' => array( 'min' => 8, 'max' => 8 ),
            'no' => array( 'min' => 8, 'max' => 8 ),
            'pl' => array( 'min' => 9, 'max' => 9 ),
            'pt' => array( 'min' => 9, 'max' => 9 ),
            'ro' => array( 'min' => 9, 'max' => 9 ),
            'ru' => array( 'min' => 10, 'max' => 10 ),
            'sm' => array( 'min' => 6, 'max' => 10 ),
            'rs' => array( 'min' => 8, 'max' => 9 ),
            'sk' => array( 'min' => 9, 'max' => 9 ),
            'si' => array( 'min' => 8, 'max' => 9 ),
            'es' => array( 'min' => 9, 'max' => 9 ),
            'se' => array( 'min' => 9, 'max' => 10 ),
            'ch' => array( 'min' => 9, 'max' => 9 ),
            'ua' => array( 'min' => 9, 'max' => 9 ),
            'gb' => array( 'min' => 10, 'max' => 10 ),
            /* Asya */
            'af' => array( 'min' => 9, 'max' => 9 ),
            'az' => array( 'min' => 9, 'max' => 9 ),
            'bh' => array( 'min' => 8, 'max' => 8 ),
            'bd' => array( 'min' => 10, 'max' => 10 ),
            'bn' => array( 'min' => 7, 'max' => 7 ),
            'kh' => array( 'min' => 8, 'max' => 9 ),
            'cn' => array( 'min' => 11, 'max' => 11 ),
            'ge' => array( 'min' => 9, 'max' => 9 ),
            'hk' => array( 'min' => 8, 'max' => 8 ),
            'in' => array( 'min' => 10, 'max' => 10 ),
            'id' => array( 'min' => 9, 'max' => 11 ),
            'ir' => array( 'min' => 10, 'max' => 10 ),
            'iq' => array( 'min' => 10, 'max' => 10 ),
            'il' => array( 'min' => 9, 'max' => 9 ),
            'jp' => array( 'min' => 10, 'max' => 10 ),
            'jo' => array( 'min' => 9, 'max' => 9 ),
            'kz' => array( 'min' => 10, 'max' => 10 ),
            'kg' => array( 'min' => 9, 'max' => 9 ),
            'kw' => array( 'min' => 8, 'max' => 8 ),
            'lb' => array( 'min' => 7, 'max' => 8 ),
            'my' => array( 'min' => 9, 'max' => 10 ),
            'mv' => array( 'min' => 7, 'max' => 7 ),
            'mn' => array( 'min' => 8, 'max' => 8 ),
            'mm' => array( 'min' => 8, 'max' => 10 ),
            'np' => array( 'min' => 10, 'max' => 10 ),
            'om' => array( 'min' => 8, 'max' => 8 ),
            'pk' => array( 'min' => 10, 'max' => 10 ),
            'ps' => array( 'min' => 9, 'max' => 9 ),
            'ph' => array( 'min' => 10, 'max' => 10 ),
            'qa' => array( 'min' => 8, 'max' => 8 ),
            'sa' => array( 'min' => 9, 'max' => 9 ),
            'sg' => array( 'min' => 8, 'max' => 8 ),
            'kr' => array( 'min' => 9, 'max' => 10 ),
            'lk' => array( 'min' => 9, 'max' => 9 ),
            'sy' => array( 'min' => 9, 'max' => 9 ),
            'tw' => array( 'min' => 9, 'max' => 9 ),
            'tj' => array( 'min' => 9, 'max' => 9 ),
            'th' => array( 'min' => 9, 'max' => 9 ),
            'tm' => array( 'min' => 8, 'max' => 8 ),
            'ae' => array( 'min' => 9, 'max' => 9 ),
            'uz' => array( 'min' => 9, 'max' => 9 ),
            'vn' => array( 'min' => 9, 'max' => 10 ),
            'ye' => array( 'min' => 9, 'max' => 9 ),
            'am' => array( 'min' => 8, 'max' => 8 ),
            /* Amerika & Okyanusya */
            'us' => array( 'min' => 10, 'max' => 10 ),
            'ca' => array( 'min' => 10, 'max' => 10 ),
            'mx' => array( 'min' => 10, 'max' => 10 ),
            'br' => array( 'min' => 10, 'max' => 11 ),
            'ar' => array( 'min' => 10, 'max' => 10 ),
            'au' => array( 'min' => 9, 'max' => 9 ),
            'nz' => array( 'min' => 8, 'max' => 10 ),
            /* Afrika */
            'dz' => array( 'min' => 9, 'max' => 9 ),
            'eg' => array( 'min' => 10, 'max' => 10 ),
            'ma' => array( 'min' => 9, 'max' => 9 ),
            'tn' => array( 'min' => 8, 'max' => 8 ),
            'ly' => array( 'min' => 9, 'max' => 9 ),
            'ke' => array( 'min' => 9, 'max' => 9 ),
            'ug' => array( 'min' => 9, 'max' => 9 ),
            'tz' => array( 'min' => 9, 'max' => 9 ),
            'et' => array( 'min' => 9, 'max' => 9 ),
            'so' => array( 'min' => 8, 'max' => 9 ),
            'dj' => array( 'min' => 8, 'max' => 8 ),
            'sd' => array( 'min' => 9, 'max' => 9 ),
            'td' => array( 'min' => 8, 'max' => 8 ),
            'bf' => array( 'min' => 8, 'max' => 8 ),
            'ml' => array( 'min' => 8, 'max' => 8 ),
            'ne' => array( 'min' => 8, 'max' => 8 ),
            'ng' => array( 'min' => 10, 'max' => 10 ),
            'sn' => array( 'min' => 9, 'max' => 9 ),
            'gh' => array( 'min' => 9, 'max' => 9 ),
            'za' => array( 'min' => 9, 'max' => 9 ),
        );

        /**
         * Filter national digit length rules per ISO2.
         *
         * @param array<string, array{min:int,max:int}> $rules Rules.
         */
        return apply_filters('wdp_phone_national_length_rules', $rules);
    }

    /**
     * Length rule for one country.
     *
     * @param string $iso ISO2.
     * @return array{min:int,max:int}
     */
    public static function get_national_length_for_iso($iso) {
        $iso   = is_string($iso) ? strtolower($iso) : '';
        $rules = self::get_national_length_rules();
        if ($iso && isset($rules[ $iso ])) {
            $row = $rules[ $iso ];
            $min = isset($row['min']) ? (int) $row['min'] : 7;
            $max = isset($row['max']) ? (int) $row['max'] : 12;
            if ($max < $min) {
                $max = $min;
            }
            return array(
                'min' => max(1, $min),
                'max' => max(1, $max),
            );
        }
        return array(
            'min' => 7,
            'max' => 12,
        );
    }

    /**
     * Compact list for frontend localization.
     *
     * @return array<int, array{iso:string,name:string,dial:string,nationalMin:int,nationalMax:int}>
     */
    public static function get_countries_for_js() {
        $out = array();
        foreach (self::get_countries() as $iso => $row) {
            $length = self::get_national_length_for_iso($iso);
            $out[]  = array(
                'iso'         => $iso,
                'name'        => $row['name'],
                'dial'        => $row['dial'],
                'nationalMin' => $length['min'],
                'nationalMax' => $length['max'],
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
