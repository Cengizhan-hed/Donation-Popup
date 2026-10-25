<?php
/**
 * Teşekkür / kutlama modülü: WooCommerce "sipariş alındı" sayfasına bağış özeti, kutlama ve paylaşım ekler.
 *
 * İSTEĞE BAĞLI, VARSAYILAN KAPALI (kapalıyken dosya yüklenmez; Woo sayfası olduğu gibi kalır). Sayfa/menü OLUŞTURMAZ;
 * yalnız WooCommerce standart `woocommerce_before_thankyou` kancasına çıktı ekler (Woo sipariş anahtarını zaten doğrular).
 * Kişi bilgisi içermez. Etki ifadesi için Impact modülünü yalnız OKUR.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Thanks;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Core\Settings;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Modules\Impact\Impact_Map;

defined( 'ABSPATH' ) || exit;

/**
 * Thanks_Module.
 */
final class Thanks_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'thanks';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		$this->container = $container;
		$container->get( Assets::class )->define( 'thanks', 'assets/build/thanks/index.js', 'assets/build/thanks/index.css' );

		add_action( 'woocommerce_before_thankyou', array( $this, 'render' ), 5 );
	}

	/**
	 * Özeti basar (sipariş yoksa, başarısızsa ya da bağış satırı yoksa hiçbir şey basmaz).
	 *
	 * @param mixed $order_id Sipariş kimliği.
	 * @return void
	 */
	public function render( $order_id ) {
		$html = $this->html_for_order( $order_id );
		if ( '' === $html ) {
			return;
		}
		$this->container->get( Assets::class )->enqueue( 'thanks' );
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Şablon kendi çıktısını kaçışlar.
	}

	/**
	 * Sipariş için HTML.
	 *
	 * @param mixed $order_id Sipariş kimliği.
	 * @return string
	 */
	public function html_for_order( $order_id ) {
		if ( ! function_exists( 'wc_get_order' ) ) {
			return '';
		}
		$order = wc_get_order( absint( $order_id ) );
		if ( ! $order || $order->has_status( array( 'failed', 'cancelled' ) ) ) {
			return '';
		}
		$summary = Thanks_Summary::build( $order );
		if ( ! $summary ) {
			return '';
		}

		$settings = $this->container->get( Settings::class );
		$first    = (int) $summary['lines'][0]['product_id'];
		$url      = $first > 0 && function_exists( 'get_permalink' ) ? (string) get_permalink( $first ) : '';
		$url      = '' !== $url ? $url : home_url( '/' );

		$args = array(
			'summary'      => $summary,
			'order_number' => (string) $order->get_order_number(),
			'impact'       => $this->impact_text( $summary, $settings ),
			'message'      => trim( (string) $settings->get( 'thanks.message', '' ) ),
			'celebrate'    => (bool) $settings->get( 'thanks.celebrate', true ),
			'share'        => (bool) $settings->get( 'thanks.share', true ),
			'share_text'   => Thanks_Summary::share_text( $summary ),
			'share_url'    => $url,
			'again_url'    => $first > 0 ? $url : '',
		);

		return $this->container->get( Template_Loader::class )->render_to_string( 'thanks/summary.php', $args );
	}

	/**
	 * Etki ifadesi (Impact modülü açıksa, tek bağış satırında ve para birimi mağaza birimiyse; yalnız okuma).
	 *
	 * @param array<string, mixed> $summary  Özet.
	 * @param Settings             $settings Ayarlar.
	 * @return string
	 */
	private function impact_text( array $summary, Settings $settings ) {
		if ( 1 !== count( $summary['lines'] ) || ! $settings->module_enabled( 'impact', Settings::engine_is_new() ) ) {
			return '';
		}
		$store_currency = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
		if ( '' === $store_currency || $store_currency !== $summary['currency'] ) {
			return '';
		}
		$line  = $summary['lines'][0];
		$tiers = Impact_Map::tiers_for_product( (int) $line['product_id'], (string) $settings->get( 'impact.map', '' ) );
		if ( ! $tiers ) {
			return '';
		}
		$described = Impact_Map::describe( (float) $line['amount'], $tiers );
		return null === $described ? '' : (string) $described['text'];
	}
}
