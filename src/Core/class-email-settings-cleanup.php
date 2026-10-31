<?php
/**
 * 12.4 göç adımı: kaldırılan e-posta ayarlarının veritabanındaki eski kayıtlarını temizler.
 *
 * Yalnız eklentinin KENDİ tam anahtarları silinir (başka anahtara/kayda dokunulmaz); idempotenttir (ikinci çalıştırma
 * değişiklik yapmaz). Bağışçı verisi (sipariş meta'ları) ve dışa açık sözleşme anahtarları etkilenmez.
 *
 * - `donation_panel_settings`: `form.donor_email` ve `shares.email` alt anahtarları.
 * - Eski seçenekler: `wdp_button_settings[enable_donor_email]`, `wdp_shareholder_settings[shareholder_enable_email]`.
 * - Ürün meta'sı `_enable_email` (yalnız `product` / `product_variation`; parça parça, ürün kimliğine göre ilerler).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Email_Settings_Cleanup.
 */
final class Email_Settings_Cleanup {

	/**
	 * Kaldırılan ürün meta anahtarı.
	 */
	const META_KEY = '_enable_email';

	/**
	 * Bir turda işlenen ürün sayısı.
	 */
	const BATCH = 200;

	/**
	 * En çok tur (BATCH * MAX_PASSES üründen fazlası sonraki istekte sürer).
	 */
	const MAX_PASSES = 100;

	/**
	 * Ayar yazımında eşzamanlı değişiklik görülürse en çok yeniden deneme.
	 */
	const MAX_RETRIES = 3;

	/**
	 * Yazmadan hemen önce çağrılır (yalnız testlerde eşzamanlı kaydı benzetmek için).
	 *
	 * @var callable|null
	 */
	private $before_write;

	/**
	 * @param callable|null $before_write Test kancası.
	 */
	public function __construct( $before_write = null ) {
		$this->before_write = $before_write;
	}

	/**
	 * Adımı çalıştırır.
	 *
	 * @throws \RuntimeException Ürün meta temizliği tur sınırında bitmediyse (adım tamamlanmış sayılmaz, sonraki istekte sürer).
	 * @return array{settings: int, legacy: int, product_meta: int} Silinen kayıt sayıları.
	 */
	public function run() {
		return array(
			'settings'     => $this->clean_settings(),
			'legacy'       => $this->clean_legacy_options(),
			'product_meta' => $this->clean_product_meta(),
		);
	}

	/**
	 * Yeni ayar deposundaki kaldırılmış alt anahtarları siler.
	 *
	 * @return int Silinen anahtar sayısı.
	 */
	private function clean_settings() {
		// D2: oku → değiştir → yazmadan hemen önce yeniden oku; arada değiştiyse taze değerden yeniden hesapla (eşzamanlı
		// yönetici kaydı ezilmez; en çok MAX_RETRIES kez dener, sonra son taze değerden yazar).
		$count = 0;
		for ( $try = 0; $try <= self::MAX_RETRIES; $try++ ) {
			$stored = get_option( Settings::OPTION_NAME, null );
			if ( ! is_array( $stored ) ) {
				return 0;
			}
			$clean = $stored;
			$count = 0;
			foreach ( array(
				'form'   => 'donor_email',
				'shares' => 'email',
			) as $group => $key ) {
				if ( isset( $clean[ $group ] ) && is_array( $clean[ $group ] ) && array_key_exists( $key, $clean[ $group ] ) ) {
					unset( $clean[ $group ][ $key ] );
					++$count;
				}
			}
			if ( 0 === $count ) {
				return 0;
			}
			if ( is_callable( $this->before_write ) ) {
				call_user_func( $this->before_write );
			}
			if ( get_option( Settings::OPTION_NAME, null ) === $stored || self::MAX_RETRIES === $try ) {
				update_option( Settings::OPTION_NAME, $clean, true );
				return $count;
			}
		}
		return $count;
	}

	/**
	 * Eski seçeneklerdeki kaldırılmış anahtarları siler (seçeneğin kendisi kalır).
	 *
	 * @return int Silinen anahtar sayısı.
	 */
	private function clean_legacy_options() {
		$count = 0;
		foreach ( array(
			'wdp_button_settings'      => 'enable_donor_email',
			'wdp_shareholder_settings' => 'shareholder_enable_email',
		) as $option => $key ) {
			$value = get_option( $option, null );
			if ( is_array( $value ) && array_key_exists( $key, $value ) ) {
				unset( $value[ $key ] );
				update_option( $option, $value );
				++$count;
			}
		}
		return $count;
	}

	/**
	 * Ürün eklentinin kendi (önekli ya da bilinen) başka bir ürün meta anahtarını taşıyor mu?
	 *
	 * @param int $post_id Ürün/varyasyon.
	 * @return bool
	 */
	private function has_own_meta( $post_id ) {
		$meta = get_post_meta( $post_id );
		if ( ! is_array( $meta ) ) {
			return false;
		}
		foreach ( array_keys( $meta ) as $key ) {
			if ( self::META_KEY !== $key && ( 0 === strpos( (string) $key, '_wdp_' ) || in_array( $key, Uninstall::product_meta_keys(), true ) ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Ürün meta'sını ürün kimliğine göre parça parça siler.
	 *
	 * @return int Temizlenen ürün sayısı.
	 */
	private function clean_product_meta() {
		global $wpdb;
		if ( ! isset( $wpdb ) || ! is_object( $wpdb ) ) {
			return 0;
		}
		$cleaned = 0;
		$after   = 0;
		for ( $pass = 0; $pass < self::MAX_PASSES; $pass++ ) {
			$ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- özel toplu işlem (göç); WordPress API anahtara göre toplu tarama sunmaz.
				$wpdb->prepare(
					"SELECT DISTINCT pm.post_id FROM {$wpdb->postmeta} pm
					INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					WHERE pm.meta_key = %s AND pm.post_id > %d AND p.post_type IN ('product', 'product_variation')
					ORDER BY pm.post_id ASC LIMIT %d",
					self::META_KEY,
					$after,
					self::BATCH
				)
			);
			$ids = array_map( 'absint', (array) $ids );
			foreach ( $ids as $post_id ) {
				$after = max( $after, $post_id );
				// D1: `_enable_email` önek taşımayan genel bir ad; başka eklentinin meta'sına dokunmamak için yalnız eklentinin
				// kendi başka bir ürün meta anahtarını taşıyan (eklentinin kaydettiği) ürünlerde silinir. Diğerlerinde okuma zaten yok sayılıyor.
				if ( ! $this->has_own_meta( $post_id ) ) {
					continue;
				}
				delete_post_meta( $post_id, self::META_KEY );
				++$cleaned;
			}
			if ( count( $ids ) < self::BATCH ) {
				return $cleaned;
			}
		}
		throw new \RuntimeException( 'Email settings cleanup did not finish; it will continue on the next request.' );
	}
}
