<?php
/**
 * 12.0.0 yükseltme adımı: eski çekirdeğin (motor seçimi, eski AJAX sayaçları) artıklarını temizler ve kampanya
 * devir alanlarını kurar. İdempotenttir (ikinci çalıştırmada değişiklik yok) ve bağışçı verisine dokunmaz.
 *
 * - `donation_panel_settings` içindeki `experiences` grubu (motor seçimi) silinir; tek deneyim vardır.
 * - `wdp_upgrade_new_default` seçeneği ve eski AJAX kullanım sayaçları (`wdp_deprecated_ajax_*`) silinir.
 * - Saklı kampanya toplamı olan her ürün için `_wdp_carried_amount` (= mevcut saklı toplam) ve
 *   `_wdp_campaign_start` (= göç anı, Unix zaman damgası) KURULUR; `_wdp_total_donation_amount` DEĞİŞMEZ.
 *   Alanlar yoksa kurulur, varsa dokunulmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Release_12_Upgrade.
 */
final class Release_12_Upgrade {

	/**
	 * Devreden tutar ürün meta anahtarı.
	 */
	const META_CARRIED = '_wdp_carried_amount';

	/**
	 * Kampanya başlangıcı (göç anı) ürün meta anahtarı.
	 */
	const META_CAMPAIGN_START = '_wdp_campaign_start';

	/**
	 * Saklı toplam anahtarı (değişmez).
	 */
	const META_TOTAL = '_wdp_total_donation_amount';

	/**
	 * Adımı çalıştırır.
	 *
	 * @return array{settings_cleaned: int, options_deleted: int, carried: int} Yapılan değişiklik sayıları.
	 */
	public function run() {
		return array(
			'settings_cleaned' => $this->clean_settings(),
			'options_deleted'  => $this->delete_obsolete_options(),
			'carried'          => $this->seed_carried_amounts(),
		);
	}

	/**
	 * Ayar deposundan motor seçimini siler.
	 *
	 * @return int Silindiyse 1.
	 */
	private function clean_settings() {
		$stored = get_option( Settings::OPTION_NAME, null );
		if ( ! is_array( $stored ) || ! array_key_exists( 'experiences', $stored ) ) {
			return 0;
		}
		unset( $stored['experiences'] );
		update_option( Settings::OPTION_NAME, $stored, false );
		return 1;
	}

	/**
	 * Eski çekirdeğe ait seçenekleri ve geçici verileri siler.
	 *
	 * @return int Silinen kayıt sayısı.
	 */
	private function delete_obsolete_options() {
		$count = 0;
		if ( false !== get_option( 'wdp_upgrade_new_default', false ) ) {
			delete_option( 'wdp_upgrade_new_default' );
			++$count;
		}

		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			return $count;
		}
		foreach ( array( 'wdp_deprecated_ajax_', '_transient_wdp_product_info_', '_transient_timeout_wdp_product_info_' ) as $prefix ) {
			$deleted = $wpdb->query(
				$wpdb->prepare(
					"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
					$wpdb->esc_like( $prefix ) . '%'
				)
			);
			$count  += is_numeric( $deleted ) ? (int) $deleted : 0;
		}
		return $count;
	}

	/**
	 * Saklı toplamı olan ürünlere devir alanlarını kurar (toplam değişmez).
	 *
	 * @return int Alanları kurulan ürün sayısı.
	 */
	private function seed_carried_amounts() {
		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			return 0;
		}
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.post_id, pm.meta_value FROM {$wpdb->postmeta} pm
				INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				WHERE pm.meta_key = %s AND p.post_type = 'product'",
				self::META_TOTAL
			)
		);
		if ( ! is_array( $rows ) ) {
			return 0;
		}

		$now    = time();
		$seeded = 0;
		foreach ( $rows as $row ) {
			$product_id = (int) $row->post_id;
			$raw        = (string) $row->meta_value;
			if ( $product_id <= 0 || '' === $raw || ! is_numeric( $raw ) ) {
				continue;
			}
			$changed = false;
			if ( '' === (string) get_post_meta( $product_id, self::META_CARRIED, true ) ) {
				update_post_meta( $product_id, self::META_CARRIED, max( 0.0, (float) $raw ) );
				$changed = true;
			}
			if ( '' === (string) get_post_meta( $product_id, self::META_CAMPAIGN_START, true ) ) {
				update_post_meta( $product_id, self::META_CAMPAIGN_START, $now );
				$changed = true;
			}
			if ( $changed ) {
				++$seeded;
			}
		}
		return $seeded;
	}
}
