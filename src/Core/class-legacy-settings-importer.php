<?php
/**
 * Eski `wdp_*` seçeneklerini yeni ayar deposuna idempotent biçimde içe alır.
 *
 * Eski seçenekler yalnız OKUNUR; hiçbiri silinmez/değiştirilir. Yeni depoda değeri zaten
 * saklı olan anahtar ezilmez (ikinci çalıştırma değişiklik yapmaz).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Legacy_Settings_Importer.
 */
class Legacy_Settings_Importer {

	/**
	 * Ayar deposu.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Settings $settings Ayar deposu.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Yeni yol => eski seçenek adı (düz değerli seçenekler). Modül göçleri bu listeye eklenir.
	 *
	 * @return array<string, string>
	 */
	public static function map() {
		return array(
			'general.delete_data_on_uninstall' => 'wdp_delete_data_on_uninstall',
		);
	}

	/**
	 * İçe alır.
	 *
	 * @return int Yeni yazılan anahtar sayısı.
	 */
	public function import() {
		$stored = get_option( Settings::OPTION_NAME, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$patch  = array();
		$count  = 0;

		foreach ( self::map() as $path => $legacy_option ) {
			list( $group, $key ) = explode( '.', $path, 2 );
			if ( isset( $stored[ $group ] ) && is_array( $stored[ $group ] ) && array_key_exists( $key, $stored[ $group ] ) ) {
				continue;
			}

			$sentinel = new \stdClass();
			$legacy   = get_option( $legacy_option, $sentinel );
			if ( $legacy === $sentinel ) {
				continue;
			}

			$patch[ $group ][ $key ] = $legacy;
			++$count;
		}

		if ( $count > 0 ) {
			$this->settings->flush();
			$this->settings->update( $patch );
		}

		return $count;
	}
}
