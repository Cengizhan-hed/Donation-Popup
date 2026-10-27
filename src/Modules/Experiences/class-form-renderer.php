<?php
/**
 * Form çıktısı: tek çekirdek form + seçilen kap sarmalayıcısı, şablonlar `Template_Loader` ile.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Domain\Button_Settings;
use DonationPanel\Frontend\Template_Loader;

defined( 'ABSPATH' ) || exit;

/**
 * Form_Renderer.
 */
class Form_Renderer {

	/**
	 * Şablon yükleyici.
	 *
	 * @var Template_Loader
	 */
	private $loader;

	/**
	 * Kurucu.
	 *
	 * @param Template_Loader $loader Şablon yükleyici.
	 */
	public function __construct( Template_Loader $loader ) {
		$this->loader = $loader;
	}

	/**
	 * Yalnız form çekirdeği (kap yok).
	 *
	 * @param array<string, mixed> $model   Form modeli.
	 * @param string               $dom_key Benzersiz kimlik öneki.
	 * @param bool                 $close   Başlıkta kapat düğmesi (katman kaplarında true).
	 * @return string
	 */
	public function render_form( array $model, $dom_key, $close = false ) {
		return $this->loader->render_to_string(
			'experiences/form.php',
			array(
				'model'   => $model,
				'dom_key' => sanitize_key( (string) $dom_key ),
				'close'   => (bool) $close,
			)
		);
	}

	/**
	 * Kap + form (sunucu tarafında tam çıktı).
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @param string               $kind  Kap adı (popup, side_panel, inline, bottom_sheet).
	 * @param array<string, mixed> $args  `button_text`, `rest_url`, `nonce`, `checkout_url`.
	 * @return string
	 */
	public function render( array $model, $kind, array $args = array() ) {
		if ( empty( $model['product_id'] ) ) {
			return '';
		}

		$container = Experience_Container::make( $kind );
		$dom_key   = 'dp-' . (int) $model['product_id'] . '-' . $container->slug() . '-' . self::next_instance();
		$args      = array_merge(
			array(
				'button_text'       => __( 'Donate', 'woo-donation-popup' ),
				'button_full_width' => self::button_full_width(),
				'rest_url'          => '',
				'nonce'             => '',
				'checkout_url'      => '',
			),
			$args
		);

		return $this->loader->render_to_string(
			$container->template(),
			array(
				'model'     => $model,
				'container' => $container,
				'dom_key'   => $dom_key,
				'args'      => $args,
				'form_html' => $this->render_form( $model, $dom_key, $container->is_layer() ),
			)
		);
	}

	/**
	 * Açma düğmesi tam genişlikte mi (yönetici ayarı "Formlar ve Görünüm → düğme tam genişlik").
	 *
	 * @return bool
	 */
	private static function button_full_width() {
		$button = Button_Settings::get();
		return isset( $button['popup_button_full_width'] ) && '1' === (string) $button['popup_button_full_width'];
	}

	/**
	 * Aynı sayfada benzersiz kimlikler için sayaç.
	 *
	 * @return int
	 */
	private static function next_instance() {
		static $counter = 0;
		++$counter;
		return $counter;
	}
}
