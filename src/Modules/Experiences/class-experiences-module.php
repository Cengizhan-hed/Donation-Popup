<?php
/**
 * Yeni nesil form deneyimi modülü: tek form çekirdeği + 4 kap, REST ve tembel varlıklar.
 *
 * Tek form deneyimi: modül varsayılan açıktır (`modules.experiences` ya da `donation_panel_module_enabled` ile kapanır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Interface;
use DonationPanel\Frontend\Assets;
use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Http\Rest\Direct_Donation_Controller;
use DonationPanel\Modules\EntryPoints\Product_Resolver;
use DonationPanel\WooCommerce\Cart;
use DonationPanel\WooCommerce\Direct\Direct_Cleanup;

defined( 'ABSPATH' ) || exit;

/**
 * Experiences_Module.
 */
final class Experiences_Module implements Module_Interface {

	/**
	 * Modül slug'ı.
	 */
	const SLUG = 'experiences';

	/**
	 * Kısa kod adı (yeni; eski kısa kodlar değişmez).
	 */
	const SHORTCODE = 'donation_panel_experience';

	/**
	 * Bağımlılık kabı.
	 *
	 * @var Container|null
	 */
	private $container;

	/**
	 * Sayfada form çizildi mi (varlıklar yalnız o zaman kuyruğa girer).
	 *
	 * @var bool
	 */
	private $rendered = false;

	/**
	 * Sepet köprüsü (Store API uzantısı + REST ekleme).
	 *
	 * @var Cart|null
	 */
	private $cart;

	/**
	 * Kancaları kaydeder.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function register( Container $container ) {
		$this->container = $container;

		$container->get( Assets::class )->define( self::SLUG, 'assets/build/experiences/index.js', 'assets/build/experiences/index.css', array( 'ui-controls', 'ui-fields' ) );
		// Compact kart form paketinin stilini taşımaz (katmanlar, tutar kartları, adımlar): yalnız ortak alan parçaları;
		// vergi beyanı stili yalnız gereken kartta (yalnız CSS parçası).
		$container->get( Assets::class )->define( Compact_Card::ASSET, 'assets/build/compact/index.js', 'assets/build/compact/index.css', array( 'ui-controls', 'ui-fields' ) );
		$container->get( Assets::class )->define( Compact_Card::ASSET_TAX, '', 'assets/build/compact-tax/index.css', array( 'ui-controls', 'ui-fields' ) );

		$this->cart = new Cart();
		$this->cart->register();

		add_filter( 'donation_panel_rest_controllers', array( $this, 'add_rest_controller' ) );
		// Liste/mağaza kartı sayfasında form betiği sayfa yüklemesinde yok: REST'le gelen formla birlikte adresi bildirilir.
		add_filter( 'donation_panel_experience_assets', array( $this, 'rest_assets' ), 5, 2 );
		// Doğrudan (sepetsiz) bağış: yarım siparişleri temizleyen olay işleyicisi (zamanlama ilk siparişte kurulur).
		Direct_Cleanup::register();
		add_action( 'init', array( $this, 'register_shortcode' ) );
	}

	/**
	 * Kısa kodu kaydeder.
	 *
	 * @return void
	 */
	public function register_shortcode() {
		add_shortcode( self::SHORTCODE, array( $this, 'shortcode' ) );
	}

	/**
	 * REST'le gelen formların paketi: form deneyimi betiği (`experiences`). Liste/mağaza kartı sayfası bu betiği sayfa
	 * yüklemesinde almaz (ilk yük baytı yok); istemci yalnız bu sunucu yanıtındaki, eklentinin kendi derleme yolundaki aynı
	 * kökenli adresi kabul eder (DOM özniteliğinden adres okunmaz). Stil sayfada zaten vardır.
	 *
	 * @param array<string, mixed>             $assets Paketler.
	 * @param array<int, array<string, mixed>> $models Ürün => form modeli.
	 * @return array<string, mixed>
	 */
	public function rest_assets( $assets, $models ) {
		$assets = (array) $assets;
		$ids    = array_map( 'intval', array_keys( (array) $models ) );
		if ( empty( $ids ) || ! $this->container ) {
			return $assets;
		}
		$registry = $this->container->get( Assets::class );
		$script   = $registry->script_url( self::SLUG );
		if ( '' !== $script ) {
			$assets[ self::SLUG ] = array(
				'ids'    => $ids,
				'script' => $script,
				'style'  => '',
			);
			// Derleme klasörü: istemci betik adreslerini eklentinin kendi klasörüyle sınırlar.
			$assets['base'] = $registry->build_base_url();
			// Telefon paketi (tembel): adres sunucudan gelir; istemci ilk etkileşimde yükler.
			$phone = $registry->script_url( Assets::PHONE );
			if ( '' !== $phone ) {
				$assets[ Assets::PHONE ] = array(
					'ids'    => $ids,
					'script' => $phone,
					'style'  => '',
				);
			}
		}
		return $assets;
	}

	/**
	 * REST denetleyicisini listeye ekler.
	 *
	 * @param array<int, mixed> $controllers Denetleyiciler.
	 * @return array<int, mixed>
	 */
	public function add_rest_controller( $controllers ) {
		$controllers   = (array) $controllers;
		$limiter       = $this->container->get( Rate_Limiter::class );
		$controllers[] = new Form_Controller( $limiter, $this->renderer() );
		$controllers[] = new Cart_Controller( $limiter, $this->cart ? $this->cart : new Cart() );
		$controllers[] = new Direct_Donation_Controller( $limiter );
		return $controllers;
	}

	/**
	 * Kısa kod: `[donation_panel_experience id="" kind="popup|side_panel|inline|bottom_sheet" button_text=""]`.
	 * `id` yoksa bulunduğu ürünü kendisi bulur.
	 *
	 * @param array<string, mixed>|string $atts Öznitelikler.
	 * @return string
	 */
	public function shortcode( $atts ) {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return '';
		}
		$atts = shortcode_atts(
			array(
				'id'          => '',
				'kind'        => 'popup',
				'button_text' => '',
			),
			(array) $atts,
			self::SHORTCODE
		);

		$product = Product_Resolver::resolve( array( 'id' => $atts['id'] ) );
		if ( ! $product ) {
			return '';
		}
		$model = Form_Context::for_product( $product );
		if ( empty( $model ) ) {
			return '';
		}

		$args = array(
			'rest_url'     => esc_url_raw( rest_url( 'donation-panel/v1/' ) ),
			// Sayfa HTML'inde nonce YOK (önbellek/kullanıcıya özel içerik yok, CLAUDE.md §24): ilk etkileşimde REST'ten alınır.
			'nonce'        => '',
			'checkout_url' => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
		);
		if ( '' !== trim( (string) $atts['button_text'] ) ) {
			$args['button_text'] = sanitize_text_field( (string) $atts['button_text'] );
		}

		if ( Compact_Card::LAYOUT === sanitize_key( (string) $atts['kind'] ) ) {
			$compact = $this->compact( $model, $args );
			if ( null !== $compact ) {
				return $compact;
			}
			$atts['kind'] = 'inline'; // Hisseli bağış kartın sabit yüksekliğine sığmaz: bugünkü sayfa içi form.
		}

		$html = $this->renderer()->render( $model, (string) $atts['kind'], $args );
		if ( '' !== $html ) {
			$this->rendered = true;
			$assets         = $this->container->get( Assets::class );
			$assets->enqueue( self::SLUG );
			// Stilsiz kare yok (CLAUDE.md §25): form/düğme ve katman CSS'i çıktının hemen önünde, sayfa başına bir kez.
			$html = $assets->inline_styles() . $html;
		}
		return $html;
	}

	/**
	 * Compact kart: form/katman CSS'i (`experiences`) + kartın kendi betiği ve stili (`compact`), çıktının hemen önünde satır içi.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param array<string, mixed> $args  REST/ödeme adresleri.
	 * @return string|null Kart HTML'i; bu bağış türü kartta çizilemiyorsa null.
	 */
	private function compact( array $model, array $args ) {
		if ( ! Compact_Card::supports( $model ) ) {
			return null;
		}
		$html = ( new Compact_Card( $this->container->get( Template_Loader::class ) ) )->render( $model, $args );
		if ( '' === $html ) {
			return null;
		}
		$this->rendered = true;
		$assets         = $this->container->get( Assets::class );
		$assets->enqueue( Compact_Card::ASSET );
		foreach ( Compact_Card::extra_styles( $model ) as $donation_panel_part ) {
			$assets->require_style( $donation_panel_part );
		}
		return $assets->inline_styles() . $html;
	}

	/**
	 * Form çıktısı üretici.
	 *
	 * @return Form_Renderer
	 */
	private function renderer() {
		return new Form_Renderer( $this->container->get( Template_Loader::class ) );
	}

	/**
	 * Sayfada form çizildi mi.
	 *
	 * @return bool
	 */
	public function has_rendered() {
		return $this->rendered;
	}
}
