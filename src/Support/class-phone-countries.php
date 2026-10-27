<?php
/**
 * Ülke listesi (arama kodlarıyla), mağaza ülkesinden varsayılan ülke ve telefon ulusal numara uzunluk kuralları.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Phone_Field
 */
class Phone_Countries {

	/**
	 * Supported countries (iso2 => name, dial digits without +).
	 *
	 * @return array<string, array{name:string,dial:string}>
	 */
	public static function get_countries() {
		$countries = array(
			'tr' => array(
				'name' => __( 'Turkey', 'woo-donation-popup' ),
				'dial' => '90',
			),
			/* Avrupa */
			'al' => array(
				'name' => __( 'Albania', 'woo-donation-popup' ),
				'dial' => '355',
			),
			'ad' => array(
				'name' => __( 'Andorra', 'woo-donation-popup' ),
				'dial' => '376',
			),
			'at' => array(
				'name' => __( 'Austria', 'woo-donation-popup' ),
				'dial' => '43',
			),
			'by' => array(
				'name' => __( 'Belarus', 'woo-donation-popup' ),
				'dial' => '375',
			),
			'be' => array(
				'name' => __( 'Belgium', 'woo-donation-popup' ),
				'dial' => '32',
			),
			'ba' => array(
				'name' => __( 'Bosnia and Herzegovina', 'woo-donation-popup' ),
				'dial' => '387',
			),
			'bg' => array(
				'name' => __( 'Bulgaria', 'woo-donation-popup' ),
				'dial' => '359',
			),
			'hr' => array(
				'name' => __( 'Croatia', 'woo-donation-popup' ),
				'dial' => '385',
			),
			'cy' => array(
				'name' => __( 'Cyprus', 'woo-donation-popup' ),
				'dial' => '357',
			),
			'cz' => array(
				'name' => __( 'Czechia', 'woo-donation-popup' ),
				'dial' => '420',
			),
			'dk' => array(
				'name' => __( 'Denmark', 'woo-donation-popup' ),
				'dial' => '45',
			),
			'ee' => array(
				'name' => __( 'Estonia', 'woo-donation-popup' ),
				'dial' => '372',
			),
			'fi' => array(
				'name' => __( 'Finland', 'woo-donation-popup' ),
				'dial' => '358',
			),
			'fr' => array(
				'name' => __( 'France', 'woo-donation-popup' ),
				'dial' => '33',
			),
			'de' => array(
				'name' => __( 'Germany', 'woo-donation-popup' ),
				'dial' => '49',
			),
			'gr' => array(
				'name' => __( 'Greece', 'woo-donation-popup' ),
				'dial' => '30',
			),
			'hu' => array(
				'name' => __( 'Hungary', 'woo-donation-popup' ),
				'dial' => '36',
			),
			'is' => array(
				'name' => __( 'Iceland', 'woo-donation-popup' ),
				'dial' => '354',
			),
			'ie' => array(
				'name' => __( 'Ireland', 'woo-donation-popup' ),
				'dial' => '353',
			),
			'it' => array(
				'name' => __( 'Italy', 'woo-donation-popup' ),
				'dial' => '39',
			),
			'xk' => array(
				'name' => __( 'Kosovo', 'woo-donation-popup' ),
				'dial' => '383',
			),
			'lv' => array(
				'name' => __( 'Latvia', 'woo-donation-popup' ),
				'dial' => '371',
			),
			'li' => array(
				'name' => __( 'Liechtenstein', 'woo-donation-popup' ),
				'dial' => '423',
			),
			'lt' => array(
				'name' => __( 'Lithuania', 'woo-donation-popup' ),
				'dial' => '370',
			),
			'lu' => array(
				'name' => __( 'Luxembourg', 'woo-donation-popup' ),
				'dial' => '352',
			),
			'mt' => array(
				'name' => __( 'Malta', 'woo-donation-popup' ),
				'dial' => '356',
			),
			'md' => array(
				'name' => __( 'Moldova', 'woo-donation-popup' ),
				'dial' => '373',
			),
			'mc' => array(
				'name' => __( 'Monaco', 'woo-donation-popup' ),
				'dial' => '377',
			),
			'me' => array(
				'name' => __( 'Montenegro', 'woo-donation-popup' ),
				'dial' => '382',
			),
			'nl' => array(
				'name' => __( 'Netherlands', 'woo-donation-popup' ),
				'dial' => '31',
			),
			'mk' => array(
				'name' => __( 'North Macedonia', 'woo-donation-popup' ),
				'dial' => '389',
			),
			'no' => array(
				'name' => __( 'Norway', 'woo-donation-popup' ),
				'dial' => '47',
			),
			'pl' => array(
				'name' => __( 'Poland', 'woo-donation-popup' ),
				'dial' => '48',
			),
			'pt' => array(
				'name' => __( 'Portugal', 'woo-donation-popup' ),
				'dial' => '351',
			),
			'ro' => array(
				'name' => __( 'Romania', 'woo-donation-popup' ),
				'dial' => '40',
			),
			'ru' => array(
				'name' => __( 'Russia', 'woo-donation-popup' ),
				'dial' => '7',
			),
			'sm' => array(
				'name' => __( 'San Marino', 'woo-donation-popup' ),
				'dial' => '378',
			),
			'rs' => array(
				'name' => __( 'Serbia', 'woo-donation-popup' ),
				'dial' => '381',
			),
			'sk' => array(
				'name' => __( 'Slovakia', 'woo-donation-popup' ),
				'dial' => '421',
			),
			'si' => array(
				'name' => __( 'Slovenia', 'woo-donation-popup' ),
				'dial' => '386',
			),
			'es' => array(
				'name' => __( 'Spain', 'woo-donation-popup' ),
				'dial' => '34',
			),
			'se' => array(
				'name' => __( 'Sweden', 'woo-donation-popup' ),
				'dial' => '46',
			),
			'ch' => array(
				'name' => __( 'Switzerland', 'woo-donation-popup' ),
				'dial' => '41',
			),
			'ua' => array(
				'name' => __( 'Ukraine', 'woo-donation-popup' ),
				'dial' => '380',
			),
			'gb' => array(
				'name' => __( 'United Kingdom', 'woo-donation-popup' ),
				'dial' => '44',
			),
			/* Asya */
			'af' => array(
				'name' => __( 'Afghanistan', 'woo-donation-popup' ),
				'dial' => '93',
			),
			'az' => array(
				'name' => __( 'Azerbaijan', 'woo-donation-popup' ),
				'dial' => '994',
			),
			'bh' => array(
				'name' => __( 'Bahrain', 'woo-donation-popup' ),
				'dial' => '973',
			),
			'bd' => array(
				'name' => __( 'Bangladesh', 'woo-donation-popup' ),
				'dial' => '880',
			),
			'bn' => array(
				'name' => __( 'Brunei', 'woo-donation-popup' ),
				'dial' => '673',
			),
			'kh' => array(
				'name' => __( 'Cambodia', 'woo-donation-popup' ),
				'dial' => '855',
			),
			'cn' => array(
				'name' => __( 'China', 'woo-donation-popup' ),
				'dial' => '86',
			),
			'ge' => array(
				'name' => __( 'Georgia', 'woo-donation-popup' ),
				'dial' => '995',
			),
			'hk' => array(
				'name' => __( 'Hong Kong', 'woo-donation-popup' ),
				'dial' => '852',
			),
			'in' => array(
				'name' => __( 'India', 'woo-donation-popup' ),
				'dial' => '91',
			),
			'id' => array(
				'name' => __( 'Indonesia', 'woo-donation-popup' ),
				'dial' => '62',
			),
			'ir' => array(
				'name' => __( 'Iran', 'woo-donation-popup' ),
				'dial' => '98',
			),
			'iq' => array(
				'name' => __( 'Iraq', 'woo-donation-popup' ),
				'dial' => '964',
			),
			'jp' => array(
				'name' => __( 'Japan', 'woo-donation-popup' ),
				'dial' => '81',
			),
			'jo' => array(
				'name' => __( 'Jordan', 'woo-donation-popup' ),
				'dial' => '962',
			),
			'kz' => array(
				'name' => __( 'Kazakhstan', 'woo-donation-popup' ),
				'dial' => '7',
			),
			'kg' => array(
				'name' => __( 'Kyrgyzstan', 'woo-donation-popup' ),
				'dial' => '996',
			),
			'kw' => array(
				'name' => __( 'Kuwait', 'woo-donation-popup' ),
				'dial' => '965',
			),
			'lb' => array(
				'name' => __( 'Lebanon', 'woo-donation-popup' ),
				'dial' => '961',
			),
			'my' => array(
				'name' => __( 'Malaysia', 'woo-donation-popup' ),
				'dial' => '60',
			),
			'mv' => array(
				'name' => __( 'Maldives', 'woo-donation-popup' ),
				'dial' => '960',
			),
			'mn' => array(
				'name' => __( 'Mongolia', 'woo-donation-popup' ),
				'dial' => '976',
			),
			'mm' => array(
				'name' => __( 'Myanmar', 'woo-donation-popup' ),
				'dial' => '95',
			),
			'np' => array(
				'name' => __( 'Nepal', 'woo-donation-popup' ),
				'dial' => '977',
			),
			'om' => array(
				'name' => __( 'Oman', 'woo-donation-popup' ),
				'dial' => '968',
			),
			'pk' => array(
				'name' => __( 'Pakistan', 'woo-donation-popup' ),
				'dial' => '92',
			),
			'ps' => array(
				'name' => __( 'Palestine', 'woo-donation-popup' ),
				'dial' => '970',
			),
			'ph' => array(
				'name' => __( 'Philippines', 'woo-donation-popup' ),
				'dial' => '63',
			),
			'qa' => array(
				'name' => __( 'Qatar', 'woo-donation-popup' ),
				'dial' => '974',
			),
			'sa' => array(
				'name' => __( 'Saudi Arabia', 'woo-donation-popup' ),
				'dial' => '966',
			),
			'sg' => array(
				'name' => __( 'Singapore', 'woo-donation-popup' ),
				'dial' => '65',
			),
			'kr' => array(
				'name' => __( 'South Korea', 'woo-donation-popup' ),
				'dial' => '82',
			),
			'lk' => array(
				'name' => __( 'Sri Lanka', 'woo-donation-popup' ),
				'dial' => '94',
			),
			'sy' => array(
				'name' => __( 'Syria', 'woo-donation-popup' ),
				'dial' => '963',
			),
			'tw' => array(
				'name' => __( 'Taiwan', 'woo-donation-popup' ),
				'dial' => '886',
			),
			'tj' => array(
				'name' => __( 'Tajikistan', 'woo-donation-popup' ),
				'dial' => '992',
			),
			'th' => array(
				'name' => __( 'Thailand', 'woo-donation-popup' ),
				'dial' => '66',
			),
			'tm' => array(
				'name' => __( 'Turkmenistan', 'woo-donation-popup' ),
				'dial' => '993',
			),
			'ae' => array(
				'name' => __( 'United Arab Emirates', 'woo-donation-popup' ),
				'dial' => '971',
			),
			'uz' => array(
				'name' => __( 'Uzbekistan', 'woo-donation-popup' ),
				'dial' => '998',
			),
			'vn' => array(
				'name' => __( 'Vietnam', 'woo-donation-popup' ),
				'dial' => '84',
			),
			'ye' => array(
				'name' => __( 'Yemen', 'woo-donation-popup' ),
				'dial' => '967',
			),
			'am' => array(
				'name' => __( 'Armenia', 'woo-donation-popup' ),
				'dial' => '374',
			),
			/* Amerika & Okyanusya */
			'us' => array(
				'name' => __( 'United States', 'woo-donation-popup' ),
				'dial' => '1',
			),
			'ca' => array(
				'name' => __( 'Canada', 'woo-donation-popup' ),
				'dial' => '1',
			),
			'mx' => array(
				'name' => __( 'Mexico', 'woo-donation-popup' ),
				'dial' => '52',
			),
			'br' => array(
				'name' => __( 'Brazil', 'woo-donation-popup' ),
				'dial' => '55',
			),
			'ar' => array(
				'name' => __( 'Argentina', 'woo-donation-popup' ),
				'dial' => '54',
			),
			'au' => array(
				'name' => __( 'Australia', 'woo-donation-popup' ),
				'dial' => '61',
			),
			'nz' => array(
				'name' => __( 'New Zealand', 'woo-donation-popup' ),
				'dial' => '64',
			),
			/* Afrika (seçili) */
			'dz' => array(
				'name' => __( 'Algeria', 'woo-donation-popup' ),
				'dial' => '213',
			),
			'eg' => array(
				'name' => __( 'Egypt', 'woo-donation-popup' ),
				'dial' => '20',
			),
			'ma' => array(
				'name' => __( 'Morocco', 'woo-donation-popup' ),
				'dial' => '212',
			),
			'tn' => array(
				'name' => __( 'Tunisia', 'woo-donation-popup' ),
				'dial' => '216',
			),
			'ly' => array(
				'name' => __( 'Libya', 'woo-donation-popup' ),
				'dial' => '218',
			),
			'ke' => array(
				'name' => __( 'Kenya', 'woo-donation-popup' ),
				'dial' => '254',
			),
			'ug' => array(
				'name' => __( 'Uganda', 'woo-donation-popup' ),
				'dial' => '256',
			),
			'tz' => array(
				'name' => __( 'Tanzania', 'woo-donation-popup' ),
				'dial' => '255',
			),
			'et' => array(
				'name' => __( 'Ethiopia', 'woo-donation-popup' ),
				'dial' => '251',
			),
			'so' => array(
				'name' => __( 'Somalia', 'woo-donation-popup' ),
				'dial' => '252',
			),
			'dj' => array(
				'name' => __( 'Djibouti', 'woo-donation-popup' ),
				'dial' => '253',
			),
			'sd' => array(
				'name' => __( 'Sudan', 'woo-donation-popup' ),
				'dial' => '249',
			),
			'td' => array(
				'name' => __( 'Chad', 'woo-donation-popup' ),
				'dial' => '235',
			),
			'bf' => array(
				'name' => __( 'Burkina Faso', 'woo-donation-popup' ),
				'dial' => '226',
			),
			'ml' => array(
				'name' => __( 'Mali', 'woo-donation-popup' ),
				'dial' => '223',
			),
			'ne' => array(
				'name' => __( 'Niger', 'woo-donation-popup' ),
				'dial' => '227',
			),
			'ng' => array(
				'name' => __( 'Nigeria', 'woo-donation-popup' ),
				'dial' => '234',
			),
			'sn' => array(
				'name' => __( 'Senegal', 'woo-donation-popup' ),
				'dial' => '221',
			),
			'gh' => array(
				'name' => __( 'Ghana', 'woo-donation-popup' ),
				'dial' => '233',
			),
			'za' => array(
				'name' => __( 'South Africa', 'woo-donation-popup' ),
				'dial' => '27',
			),
		);

		$countries = self::merge_woocommerce_countries( $countries );

		/**
		 * Telefon listesinden çıkarılacak ülkeler (ISO2 dizisi). Varsayılan boş: eklenti ülke dışlamaz.
		 *
		 * @param string[] $excluded Çıkarılacak ISO2 kodları.
		 */
		$excluded = apply_filters( 'wdp_phone_excluded_countries', array() ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		if ( is_array( $excluded ) ) { // @phpstan-ignore function.alreadyNarrowedType
			foreach ( $excluded as $code ) {
				unset( $countries[ strtolower( (string) $code ) ] );
			}
		}

		$countries = self::sort_countries_for_dropdown( $countries, self::get_store_country_iso() );

		/**
		 * Filter country list for phone dropdown.
		 *
		 * @param array<string, array{name:string,dial:string}> $countries Countries.
		 */
		return apply_filters( 'wdp_phone_countries', $countries ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
	}

	/**
	 * WooCommerce ülke nesnesi (yoksa null).
	 *
	 * @return object|null
	 */
	private static function wc_countries() {
		if ( ! function_exists( 'WC' ) ) {
			return null;
		}
		$wc = WC();
		// @phpstan-ignore-next-line
		if ( ! is_object( $wc ) || ! isset( $wc->countries ) || ! is_object( $wc->countries ) ) {
			return null;
		}
		return $wc->countries;
	}

	/**
	 * Mağaza ülkesi (WooCommerce temel ülke), küçük harf ISO2; yoksa boş.
	 *
	 * @return string
	 */
	public static function get_store_country_iso() {
		$wc = self::wc_countries();
		if ( ! $wc || ! method_exists( $wc, 'get_base_country' ) ) {
			return '';
		}
		$iso = strtolower( (string) $wc->get_base_country() );
		return strlen( $iso ) === 2 ? $iso : '';
	}

	/**
	 * Eklentinin listesinde olmayan WooCommerce ülkelerini (WooCommerce adı + arama kodu) ekler; mevcut
	 * girişlerin adı WooCommerce'in yerelleştirilmiş adıyla değiştirilir (site diline uyar).
	 *
	 * @param array<string, array{name:string,dial:string}> $countries Countries.
	 * @return array<string, array{name:string,dial:string}>
	 */
	private static function merge_woocommerce_countries( array $countries ) {
		$wc = self::wc_countries();
		if ( ! $wc || ! method_exists( $wc, 'get_countries' ) ) {
			return $countries;
		}
		$names = $wc->get_countries();
		if ( ! is_array( $names ) ) {
			return $countries;
		}
		foreach ( $names as $code => $name ) {
			$iso = strtolower( (string) $code );
			if ( 2 !== strlen( $iso ) || ! is_string( $name ) || '' === $name ) {
				continue;
			}
			if ( isset( $countries[ $iso ] ) ) {
				$countries[ $iso ]['name'] = $name;
				continue;
			}
			$dial = '';
			if ( method_exists( $wc, 'get_country_calling_code' ) ) {
				$calling = $wc->get_country_calling_code( (string) $code );
				if ( is_array( $calling ) ) {
					$calling = reset( $calling );
				}
				$dial = preg_replace( '/\D+/', '', (string) $calling );
			}
			if ( '' === $dial ) {
				continue;
			}
			$countries[ $iso ] = array(
				'name' => $name,
				'dial' => $dial,
			);
		}
		return $countries;
	}

	/**
	 * Mağaza ülkesi en üstte, diğerleri site dilinin harf sırasıyla.
	 *
	 * @param array<string, array{name:string,dial:string}> $countries Countries.
	 * @param string                                         $first     En üstte olacak ISO2 (boşsa yok).
	 * @return array<string, array{name:string,dial:string}>
	 */
	private static function sort_countries_for_dropdown( array $countries, $first = '' ) {
		$locale  = function_exists( 'get_locale' ) ? (string) get_locale() : 'en_US';
		$compare = static function ( $a, $b ) use ( $locale ) {
			$an = (string) $a['name'];
			$bn = (string) $b['name'];
			if ( class_exists( 'Collator' ) ) {
				static $collators = array();
				if ( ! isset( $collators[ $locale ] ) ) {
					$collators[ $locale ] = new \Collator( '' !== $locale ? $locale : 'en_US' );
				}
				if ( $collators[ $locale ] instanceof \Collator ) {
					return $collators[ $locale ]->compare( $an, $bn );
				}
			}
			return strcasecmp( $an, $bn );
		};

		$first = strtolower( (string) $first );
		if ( '' === $first || ! isset( $countries[ $first ] ) ) {
			uasort( $countries, $compare );
			return $countries;
		}

		$top = array( $first => $countries[ $first ] );
		unset( $countries[ $first ] );
		uasort( $countries, $compare );

		return array_merge( $top, $countries );
	}

	/**
	 * Default ISO2 country code: WooCommerce mağaza ülkesi (filtreyle değiştirilebilir); desteklenmiyorsa listenin ilki.
	 *
	 * @return string
	 */
	public static function get_default_country_iso() {
		$countries = self::get_countries();
		$store     = self::get_store_country_iso();
		$raw       = apply_filters( 'wdp_phone_default_country', $store ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		$iso       = is_string( $raw ) ? strtolower( $raw ) : '';
		if ( strlen( $iso ) === 2 && isset( $countries[ $iso ] ) ) {
			return $iso;
		}
		if ( '' !== $store && isset( $countries[ $store ] ) ) {
			return $store;
		}
		$keys = array_keys( $countries );
		return $keys ? (string) $keys[0] : '';
	}

	/**
	 * National number length (digits after country code, without leading trunk 0).
	 *
	 * @return array<string, array{min:int,max:int}>
	 */
	public static function get_national_length_rules() {
		$rules = array(
			/* Avrupa */
			'tr' => array(
				'min' => 10,
				'max' => 10,
			),
			'al' => array(
				'min' => 9,
				'max' => 9,
			),
			'ad' => array(
				'min' => 6,
				'max' => 9,
			),
			'at' => array(
				'min' => 10,
				'max' => 13,
			),
			'by' => array(
				'min' => 9,
				'max' => 9,
			),
			'be' => array(
				'min' => 9,
				'max' => 9,
			),
			'ba' => array(
				'min' => 8,
				'max' => 9,
			),
			'bg' => array(
				'min' => 9,
				'max' => 9,
			),
			'hr' => array(
				'min' => 9,
				'max' => 9,
			),
			'cy' => array(
				'min' => 8,
				'max' => 8,
			),
			'cz' => array(
				'min' => 9,
				'max' => 9,
			),
			'dk' => array(
				'min' => 8,
				'max' => 8,
			),
			'ee' => array(
				'min' => 7,
				'max' => 8,
			),
			'fi' => array(
				'min' => 9,
				'max' => 10,
			),
			'fr' => array(
				'min' => 9,
				'max' => 9,
			),
			'de' => array(
				'min' => 10,
				'max' => 11,
			),
			'gr' => array(
				'min' => 10,
				'max' => 10,
			),
			'hu' => array(
				'min' => 9,
				'max' => 9,
			),
			'is' => array(
				'min' => 7,
				'max' => 7,
			),
			'ie' => array(
				'min' => 9,
				'max' => 9,
			),
			'it' => array(
				'min' => 9,
				'max' => 10,
			),
			'xk' => array(
				'min' => 8,
				'max' => 9,
			),
			'lv' => array(
				'min' => 8,
				'max' => 8,
			),
			'li' => array(
				'min' => 7,
				'max' => 7,
			),
			'lt' => array(
				'min' => 8,
				'max' => 8,
			),
			'lu' => array(
				'min' => 9,
				'max' => 9,
			),
			'mt' => array(
				'min' => 8,
				'max' => 8,
			),
			'md' => array(
				'min' => 8,
				'max' => 8,
			),
			'mc' => array(
				'min' => 8,
				'max' => 9,
			),
			'me' => array(
				'min' => 8,
				'max' => 8,
			),
			'nl' => array(
				'min' => 9,
				'max' => 9,
			),
			'mk' => array(
				'min' => 8,
				'max' => 8,
			),
			'no' => array(
				'min' => 8,
				'max' => 8,
			),
			'pl' => array(
				'min' => 9,
				'max' => 9,
			),
			'pt' => array(
				'min' => 9,
				'max' => 9,
			),
			'ro' => array(
				'min' => 9,
				'max' => 9,
			),
			'ru' => array(
				'min' => 10,
				'max' => 10,
			),
			'sm' => array(
				'min' => 6,
				'max' => 10,
			),
			'rs' => array(
				'min' => 8,
				'max' => 9,
			),
			'sk' => array(
				'min' => 9,
				'max' => 9,
			),
			'si' => array(
				'min' => 8,
				'max' => 9,
			),
			'es' => array(
				'min' => 9,
				'max' => 9,
			),
			'se' => array(
				'min' => 9,
				'max' => 10,
			),
			'ch' => array(
				'min' => 9,
				'max' => 9,
			),
			'ua' => array(
				'min' => 9,
				'max' => 9,
			),
			'gb' => array(
				'min' => 10,
				'max' => 10,
			),
			/* Asya */
			'af' => array(
				'min' => 9,
				'max' => 9,
			),
			'az' => array(
				'min' => 9,
				'max' => 9,
			),
			'bh' => array(
				'min' => 8,
				'max' => 8,
			),
			'bd' => array(
				'min' => 10,
				'max' => 10,
			),
			'bn' => array(
				'min' => 7,
				'max' => 7,
			),
			'kh' => array(
				'min' => 8,
				'max' => 9,
			),
			'cn' => array(
				'min' => 11,
				'max' => 11,
			),
			'ge' => array(
				'min' => 9,
				'max' => 9,
			),
			'hk' => array(
				'min' => 8,
				'max' => 8,
			),
			'in' => array(
				'min' => 10,
				'max' => 10,
			),
			'id' => array(
				'min' => 9,
				'max' => 11,
			),
			'ir' => array(
				'min' => 10,
				'max' => 10,
			),
			'iq' => array(
				'min' => 10,
				'max' => 10,
			),
			'jp' => array(
				'min' => 10,
				'max' => 10,
			),
			'jo' => array(
				'min' => 9,
				'max' => 9,
			),
			'kz' => array(
				'min' => 10,
				'max' => 10,
			),
			'kg' => array(
				'min' => 9,
				'max' => 9,
			),
			'kw' => array(
				'min' => 8,
				'max' => 8,
			),
			'lb' => array(
				'min' => 7,
				'max' => 8,
			),
			'my' => array(
				'min' => 9,
				'max' => 10,
			),
			'mv' => array(
				'min' => 7,
				'max' => 7,
			),
			'mn' => array(
				'min' => 8,
				'max' => 8,
			),
			'mm' => array(
				'min' => 8,
				'max' => 10,
			),
			'np' => array(
				'min' => 10,
				'max' => 10,
			),
			'om' => array(
				'min' => 8,
				'max' => 8,
			),
			'pk' => array(
				'min' => 10,
				'max' => 10,
			),
			'ps' => array(
				'min' => 9,
				'max' => 9,
			),
			'ph' => array(
				'min' => 10,
				'max' => 10,
			),
			'qa' => array(
				'min' => 8,
				'max' => 8,
			),
			'sa' => array(
				'min' => 9,
				'max' => 9,
			),
			'sg' => array(
				'min' => 8,
				'max' => 8,
			),
			'kr' => array(
				'min' => 9,
				'max' => 10,
			),
			'lk' => array(
				'min' => 9,
				'max' => 9,
			),
			'sy' => array(
				'min' => 9,
				'max' => 9,
			),
			'tw' => array(
				'min' => 9,
				'max' => 9,
			),
			'tj' => array(
				'min' => 9,
				'max' => 9,
			),
			'th' => array(
				'min' => 9,
				'max' => 9,
			),
			'tm' => array(
				'min' => 8,
				'max' => 8,
			),
			'ae' => array(
				'min' => 9,
				'max' => 9,
			),
			'uz' => array(
				'min' => 9,
				'max' => 9,
			),
			'vn' => array(
				'min' => 9,
				'max' => 10,
			),
			'ye' => array(
				'min' => 9,
				'max' => 9,
			),
			'am' => array(
				'min' => 8,
				'max' => 8,
			),
			/* Amerika & Okyanusya */
			'us' => array(
				'min' => 10,
				'max' => 10,
			),
			'ca' => array(
				'min' => 10,
				'max' => 10,
			),
			'mx' => array(
				'min' => 10,
				'max' => 10,
			),
			'br' => array(
				'min' => 10,
				'max' => 11,
			),
			'ar' => array(
				'min' => 10,
				'max' => 10,
			),
			'au' => array(
				'min' => 9,
				'max' => 9,
			),
			'nz' => array(
				'min' => 8,
				'max' => 10,
			),
			/* Afrika */
			'dz' => array(
				'min' => 9,
				'max' => 9,
			),
			'eg' => array(
				'min' => 10,
				'max' => 10,
			),
			'ma' => array(
				'min' => 9,
				'max' => 9,
			),
			'tn' => array(
				'min' => 8,
				'max' => 8,
			),
			'ly' => array(
				'min' => 9,
				'max' => 9,
			),
			'ke' => array(
				'min' => 9,
				'max' => 9,
			),
			'ug' => array(
				'min' => 9,
				'max' => 9,
			),
			'tz' => array(
				'min' => 9,
				'max' => 9,
			),
			'et' => array(
				'min' => 9,
				'max' => 9,
			),
			'so' => array(
				'min' => 8,
				'max' => 9,
			),
			'dj' => array(
				'min' => 8,
				'max' => 8,
			),
			'sd' => array(
				'min' => 9,
				'max' => 9,
			),
			'td' => array(
				'min' => 8,
				'max' => 8,
			),
			'bf' => array(
				'min' => 8,
				'max' => 8,
			),
			'ml' => array(
				'min' => 8,
				'max' => 8,
			),
			'ne' => array(
				'min' => 8,
				'max' => 8,
			),
			'ng' => array(
				'min' => 10,
				'max' => 10,
			),
			'sn' => array(
				'min' => 9,
				'max' => 9,
			),
			'gh' => array(
				'min' => 9,
				'max' => 9,
			),
			'za' => array(
				'min' => 9,
				'max' => 9,
			),
		);

		/**
		 * Filter national digit length rules per ISO2.
		 *
		 * @param array<string, array{min:int,max:int}> $rules Rules.
		 */
		return apply_filters( 'wdp_phone_national_length_rules', $rules ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
	}

	/**
	 * Length rule for one country.
	 *
	 * @param string $iso ISO2.
	 * @return array{min:int,max:int}
	 */
	public static function get_national_length_for_iso( $iso ) {
		$iso   = is_string( $iso ) ? strtolower( $iso ) : '';
		$rules = self::get_national_length_rules();
		if ( $iso && isset( $rules[ $iso ] ) ) {
			$row = $rules[ $iso ];
			$min = isset( $row['min'] ) ? (int) $row['min'] : 7;
			$max = isset( $row['max'] ) ? (int) $row['max'] : 12;
			if ( $max < $min ) {
				$max = $min;
			}
			return array(
				'min' => max( 1, $min ),
				'max' => max( 1, $max ),
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
		foreach ( self::get_countries() as $iso => $row ) {
			$length = self::get_national_length_for_iso( $iso );
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
}
