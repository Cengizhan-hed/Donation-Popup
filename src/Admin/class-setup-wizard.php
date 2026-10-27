<?php
/**
 * Kurulum sihirbazı (E7): isteğe bağlı, atlanabilir, dört adım. Ürün OLUŞTURMAZ; mevcut ürüne yönlendirir.
 * Mağaza değerleri (para birimi, ülke) WooCommerce'ten okunur; koda gömülmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Setup_Wizard.
 */
final class Setup_Wizard {

	const ACTION       = 'donation_panel_wizard';
	const NONCE_ACTION = 'donation_panel_wizard';

	/**
	 * Amaç => modül varsayılanları (yalnız burada adı geçen modüller değişir).
	 *
	 * @return array<string, array<string, bool>>
	 */
	public static function goal_defaults() {
		return array(
			'simple'   => array(
				'campaign'      => false,
				'impact'        => false,
				'thanks'        => true,
				'donor_account' => false,
			),
			'campaign' => array(
				'campaign'      => true,
				'impact'        => true,
				'thanks'        => true,
				'donor_account' => false,
			),
			'regular'  => array(
				'campaign'      => true,
				'impact'        => false,
				'thanks'        => true,
				'donor_account' => true,
			),
		);
	}

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Settings $settings Ayarlar.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Gönderimi işler: yetki + nonce, sonra ayarları yazar ve ayar ekranına döner.
	 *
	 * @return void
	 */
	public function handle() {
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
		check_admin_referer( self::NONCE_ACTION );

		$result = isset( $_POST['wizard_result'] ) ? sanitize_key( wp_unslash( $_POST['wizard_result'] ) ) : 'skipped'; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- check_admin_referer yukarıda.
		$goal   = isset( $_POST['goal'] ) ? sanitize_key( wp_unslash( $_POST['goal'] ) ) : 'simple'; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$try    = ! empty( $_POST['try_new_form'] ); // phpcs:ignore WordPress.Security.NonceVerification.Missing

		$result = $this->apply( $result, $goal, $try );

		wp_safe_redirect( add_query_arg( 'wizard', $result, Admin_View::url( Admin_Bootstrap::SLUG_SETTINGS ) ) );
		exit;
	}

	/**
	 * Seçimleri ayara yazar (yetki/nonce çağıranda denetlenir).
	 *
	 * @param string $result `done` ya da başka (= atlandı).
	 * @param string $goal   Amaç kimliği.
	 * @param bool   $try_new_form Yeni formu dene.
	 * @return string `done` ya da `skipped`.
	 */
	public function apply( $result, $goal, $try_new_form ) {
		$patch = array( 'admin' => array( 'wizard' => 'skipped' ) );

		if ( 'done' === $result ) {
			$goals = self::goal_defaults();
			$goal  = isset( $goals[ $goal ] ) ? $goal : 'simple';

			$patch['admin']['wizard'] = 'done';
			$patch['modules']         = $goals[ $goal ];
			unset( $try_new_form );
		}

		$this->settings->update( $patch );
		return 'done' === $result ? 'done' : 'skipped';
	}

	/**
	 * Mağaza özeti (yalnız WooCommerce'ten okunan değerler).
	 *
	 * @return array<int, array{0: string, 1: string}>
	 */
	private function store_facts() {
		$facts = array();
		if ( function_exists( 'get_woocommerce_currency' ) ) {
			$symbol  = function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ) : '';
			$facts[] = array( __( 'Currency', 'woo-donation-popup' ), trim( get_woocommerce_currency() . ' ' . $symbol ) );
		}
		if ( function_exists( 'wc_get_base_location' ) ) {
			$base    = wc_get_base_location();
			$facts[] = array( __( 'Store country', 'woo-donation-popup' ), isset( $base['country'] ) ? (string) $base['country'] : '' );
		}
		$facts[] = array( __( 'Decimals and separators', 'woo-donation-popup' ), __( 'Follow your WooCommerce settings', 'woo-donation-popup' ) );
		$facts[] = array( __( 'Colors and fonts', 'woo-donation-popup' ), __( 'Inherited from your theme', 'woo-donation-popup' ) );
		return $facts;
	}

	/**
	 * Bağış ürünü sayısı (WooCommerce ürünleri; oluşturma yok).
	 *
	 * @return int
	 */
	private function donation_product_count() {
		return class_exists( '\\WDP_Donation_Scope' ) ? (int) \WDP_Donation_Scope::count() : 0;
	}

	/**
	 * Sihirbazı çizer.
	 *
	 * @return void
	 */
	public function render() {
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to open this page.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}

		$steps = array(
			__( 'Goal', 'woo-donation-popup' ),
			__( 'Defaults', 'woo-donation-popup' ),
			__( 'First product', 'woo-donation-popup' ),
			__( 'Done', 'woo-donation-popup' ),
		);

		echo '<div class="wrap dpa" id="dpa-wizard">';
		echo '<h1 class="dpa-title">' . esc_html__( 'Quick setup', 'woo-donation-popup' ) . '</h1>';
		echo '<p class="dpa-sub">' . esc_html__( 'Four short steps. You can change everything later in Settings.', 'woo-donation-popup' ) . '</p>';

		echo '<ol class="dpa-stepper" aria-label="' . esc_attr__( 'Progress', 'woo-donation-popup' ) . '">';
		foreach ( $steps as $i => $label ) {
			echo '<li data-dpa-stepper="' . (int) $i . '"' . ( 0 === $i ? ' class="cur" aria-current="step"' : '' ) . '><i></i><span>' . esc_html( $label ) . '</span></li>';
		}
		echo '</ol>';

		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dpa-form" data-dpa-wizard>';
		wp_nonce_field( self::NONCE_ACTION );
		echo '<input type="hidden" name="action" value="' . esc_attr( self::ACTION ) . '">';

		// Adım 1: amaç.
		echo '<section class="dpa-card dpa-step" data-dpa-step="0"><h2>' . esc_html__( 'What do you want to achieve?', 'woo-donation-popup' ) . '</h2>';
		echo '<p class="dpa-note">' . esc_html__( 'Pick the closest one. It only sets which optional features start switched on.', 'woo-donation-popup' ) . '</p><div class="dpa-opts">';
		$goal_labels = array(
			'simple'   => array( __( 'Simple donations', 'woo-donation-popup' ), __( 'A clean donate button and a thank-you screen. Nothing else.', 'woo-donation-popup' ) ),
			'campaign' => array( __( 'A fundraising campaign', 'woo-donation-popup' ), __( 'Adds a goal and progress bar, and short impact phrases next to amounts.', 'woo-donation-popup' ) ),
			'regular'  => array( __( 'Regular supporters', 'woo-donation-popup' ), __( 'Adds donor accounts so supporters can see their gifts and give again.', 'woo-donation-popup' ) ),
		);
		$first       = true;
		foreach ( $goal_labels as $value => $text ) {
			echo '<label class="dpa-pill"><input type="radio" name="goal" value="' . esc_attr( $value ) . '"' . ( $first ? ' checked' : '' ) . '><span><strong>' . esc_html( $text[0] ) . '</strong><small>' . esc_html( $text[1] ) . '</small></span></label>';
			$first = false;
		}
		echo '</div></section>';

		// Adım 2: akıllı varsayılanlar.
		echo '<section class="dpa-card dpa-step" data-dpa-step="1" hidden><h2>' . esc_html__( 'Smart defaults', 'woo-donation-popup' ) . '</h2>';
		echo '<p class="dpa-note">' . esc_html__( 'Donation Panel reads your WooCommerce settings as they are. There is nothing for you to do.', 'woo-donation-popup' ) . '</p><ul class="dpa-facts">';
		foreach ( $this->store_facts() as $fact ) {
			echo '<li><span class="dpa-tick" aria-hidden="true">&#10003;</span><span><strong>' . esc_html( $fact[0] ) . '</strong> ' . esc_html( $fact[1] ) . '</span></li>';
		}
		echo '</ul>';
		echo '<label class="dpa-pill"><input type="checkbox" name="try_new_form" value="1"><span><strong>' . esc_html__( 'Try the new donation form', 'woo-donation-popup' ) . '</strong><small>' . esc_html__( 'Optional. Off keeps the classic form, which is the safe default.', 'woo-donation-popup' ) . '</small></span></label>';
		echo '</section>';

		// Adım 3: ilk bağış ürünü (oluşturma yok).
		$count = $this->donation_product_count();
		echo '<section class="dpa-card dpa-step" data-dpa-step="2" hidden><h2>' . esc_html__( 'Your first donation product', 'woo-donation-popup' ) . '</h2>';
		echo '<p class="dpa-note">' . esc_html__( 'Donation Panel works on your existing WooCommerce products. This wizard does not create products.', 'woo-donation-popup' ) . '</p>';
		/* translators: %d: number of products that currently act as donation products. */
		echo '<p>' . esc_html( sprintf( _n( '%d product currently works as a donation product.', '%d products currently work as donation products.', $count, 'woo-donation-popup' ), $count ) ) . '</p>';
		echo '<p><a class="button" target="_blank" rel="noopener" href="' . esc_url( admin_url( 'edit.php?post_type=product' ) ) . '">' . esc_html__( 'Open your products', 'woo-donation-popup' ) . '</a></p>';
		echo '<p class="dpa-row__help">' . esc_html__( 'Open a product, then use the Donation tab in the product data box to turn it into a donation product.', 'woo-donation-popup' ) . '</p></section>';

		// Adım 4: bitti.
		echo '<section class="dpa-card dpa-step" data-dpa-step="3" hidden><h2>' . esc_html__( 'You are ready', 'woo-donation-popup' ) . '</h2>';
		echo '<p>' . esc_html__( 'We will save these choices. Place the button with the shortcode below, with the block, or let automatic placement do it.', 'woo-donation-popup' ) . '</p>';
		echo Admin_View::code( '[wdp_donation_button_panel]' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Admin_View kaçışlıdır.
		echo '<p class="dpa-row__help">' . esc_html__( 'On a product page the shortcode finds its own product. No ID needed.', 'woo-donation-popup' ) . '</p></section>';

		echo '<div class="dpa-wizard-nav">';
		echo '<button type="button" class="button" data-dpa-back hidden>' . esc_html__( 'Back', 'woo-donation-popup' ) . '</button>';
		echo '<button type="button" class="button button-primary" data-dpa-next>' . esc_html__( 'Continue', 'woo-donation-popup' ) . '</button>';
		echo '<button type="submit" name="wizard_result" value="done" class="button button-primary" data-dpa-finish hidden>' . esc_html__( 'Save and finish', 'woo-donation-popup' ) . '</button>';
		echo '<button type="submit" name="wizard_result" value="skipped" class="button-link dpa-skip" data-dpa-skip>' . esc_html__( 'Skip for now', 'woo-donation-popup' ) . '</button>';
		echo '</div></form></div>';
	}
}
