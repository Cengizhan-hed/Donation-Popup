<?php
/**
 * Kart formlarının TARAYICI DÜZEYİ ön alması (12.3): bu istekte çizilen liste/mağaza/kategori kartlarının (form açan
 * düğmeler) formları için sayfa sonunda (etkisiz `<template>` içinde) `<link rel="prefetch">` basılır; list betiği
 * `load` olayında bunları etkinleştirir ve tarayıcı toplu ucu (`/experiences?ids=…`) en düşük öncelikle alıp kendi HTTP
 * önbelleğinde (yanıt `private`, kısa ömür) tutar.
 * Dokunma niyetinde istemci AYNI adresi ister → önbellekten gelir (ağ yok). Eklenti betiği yüklemede iş yapmaz
 * (JS `fetch()` başlatma maliyeti yok). Adreste nonce/kişisel veri yok: sayfa önbelleğine uygundur.
 *
 * Yalnız ilk FIRST_IDS kart (sayfa sırası = üstten); kalanlar kaydırınca istemcide toplu alınır. Filtre
 * `donation_panel_prefetch_forms` false ise hiçbir şey basılmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

defined( 'ABSPATH' ) || exit;

/**
 * Prefetch_Links.
 */
class Prefetch_Links {

	/** Bağlantıyla önceden alınan en çok kart (bir toplu istek). */
	const FIRST_IDS = 12;

	/**
	 * Kap türü => sıralı benzersiz ürün kimlikleri.
	 *
	 * @var array<string, int[]>
	 */
	private static $ids = array();

	/**
	 * @var bool
	 */
	private static $hooked = false;

	/**
	 * Çizilen kartı kaydeder (form açan düğme).
	 *
	 * @param int    $product_id Ürün.
	 * @param string $kind       Kap türü (popup | side_panel | bottom_sheet).
	 * @return void
	 */
	public static function add( $product_id, $kind ) {
		$product_id = absint( $product_id );
		$kind       = in_array( $kind, array( 'popup', 'side_panel', 'bottom_sheet' ), true ) ? $kind : 'popup';
		if ( $product_id < 1 ) {
			return;
		}
		if ( ! isset( self::$ids[ $kind ] ) ) {
			self::$ids[ $kind ] = array();
		}
		if ( ! in_array( $product_id, self::$ids[ $kind ], true ) ) {
			self::$ids[ $kind ][] = $product_id;
		}
		if ( ! self::$hooked && function_exists( 'add_action' ) ) {
			self::$hooked = true;
			add_action( 'wp_footer', array( __CLASS__, 'print_links' ), 1 );
		}
	}

	/**
	 * Liste HTML'indeki (önbellekten gelse de) form açan kart düğmelerini kaydeder.
	 *
	 * @param string $html Liste HTML'i.
	 * @param string $kind Kap türü.
	 * @return void
	 */
	public static function add_from_html( $html, $kind ) {
		if ( preg_match_all( '/\bdata-wdp-form="(\d+)"/', (string) $html, $m ) ) {
			foreach ( $m[1] as $id ) {
				self::add( (int) $id, $kind );
			}
		}
	}

	/**
	 * Toplu uç adresleri (kap türü başına bir; ilk FIRST_IDS kart).
	 *
	 * @return string[]
	 */
	public static function urls() {
		/** This filter is documented in src/Modules/EntryPoints/class-experience-controller.php */
		if ( ! apply_filters( 'donation_panel_prefetch_forms', true ) ) {
			return array();
		}
		$out = array();
		foreach ( self::$ids as $kind => $ids ) {
			$ids = array_slice( $ids, 0, self::FIRST_IDS );
			if ( empty( $ids ) ) {
				continue;
			}
			$out[] = add_query_arg(
				array(
					'ids'  => implode( ',', $ids ),
					'kind' => $kind,
				),
				rest_url( 'donation-panel/v1/experiences' )
			);
		}
		return $out;
	}

	/**
	 * `wp_footer`: ön alma bağlantıları (gövdede geçerli; görünmez, yerleşmez).
	 *
	 * @return void
	 */
	public static function print_links() {
		$urls = self::urls();
		if ( empty( $urls ) ) {
			return;
		}
		// Bağlantılar etkisiz bir <template> içinde gelir: tarayıcı sayfa yüklenirken ALMAZ (ilk yük baytı/bant yok);
		// list betiği `load` olayında bunları <head>'e taşır, ön alma sayfa yüklendikten sonra en düşük öncelikle başlar.
		echo '<template data-dp-prefetch-links>';
		foreach ( $urls as $url ) {
			echo '<link rel="prefetch" href="' . esc_url( $url ) . '" data-dp-prefetch>'; // phpcs:ignore WordPress.WP.EnqueuedResources -- Kaynak değil, REST ön alma ipucu.
		}
		echo "</template>\n";
	}

	/**
	 * Testler için durum sıfırlama.
	 *
	 * @return void
	 */
	public static function reset() {
		self::$ids = array();
	}
}
