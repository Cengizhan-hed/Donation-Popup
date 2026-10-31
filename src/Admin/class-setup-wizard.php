<?php
/**
 * Kurulum sihirbazı: beş adım (Sayfalar, Görünüm, Bağış formu, Modüller, Bitir). İsteğe bağlı ve atlanabilir.
 * Her adımın seçimi REST ile kaydedilir ve ilerleme kalıcıdır (kaldığı adımdan devam eder).
 * Ürün, sayfa ya da WooCommerce ayarı OLUŞTURMAZ/DEĞİŞTİRMEZ; mağaza değerleri WooCommerce'ten okunur.
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

	const STEP_COUNT = 5;

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Ayar deposu.
	 *
	 * @var Settings_Store
	 */
	private $store;

	/**
	 * Kurucu.
	 *
	 * @param Settings       $settings Ayarlar.
	 * @param Settings_Store $store    Ayar deposu.
	 */
	public function __construct( Settings $settings, Settings_Store $store ) {
		$this->settings = $settings;
		$this->store    = $store;
	}

	/**
	 * Adım etiketleri.
	 *
	 * @return string[]
	 */
	public static function step_labels() {
		return array(
			1 => __( 'Pages', 'woo-donation-popup' ),
			2 => __( 'Appearance', 'woo-donation-popup' ),
			3 => __( 'Donation form', 'woo-donation-popup' ),
			4 => __( 'Modules', 'woo-donation-popup' ),
			5 => __( 'Finish', 'woo-donation-popup' ),
		);
	}

	/**
	 * Kayıtlı adım (1..5).
	 *
	 * @return int
	 */
	public function current_step() {
		return max( 1, min( self::STEP_COUNT, (int) $this->settings->get( 'admin.wizard_step', 1 ) ) );
	}

	/**
	 * Adım başlığı ve açıklaması.
	 *
	 * @return array<int, array{0: string, 1: string}>
	 */
	private function step_text() {
		return array(
			1 => array( __( 'Is your store ready?', 'woo-donation-popup' ), __( 'Donation Panel reads your WooCommerce settings as they are. Nothing is created or changed here.', 'woo-donation-popup' ) ),
			2 => array( __( 'How should the donation form open?', 'woo-donation-popup' ), __( 'Choose how the form looks when a donor taps "Donate". You can still change it for each product later.', 'woo-donation-popup' ) ),
			3 => array( __( 'What should the form ask?', 'woo-donation-popup' ), __( 'Keep it short: fewer fields mean more completed gifts. You can change this any time.', 'woo-donation-popup' ) ),
			4 => array( __( 'Which extras do you want?', 'woo-donation-popup' ), __( 'Modules that are off load nothing, so they never slow your site down.', 'woo-donation-popup' ) ),
			5 => array( __( 'You are ready', 'woo-donation-popup' ), __( 'Your choices are saved. Place the donate button with the shortcode below, with the block, or let automatic placement do it.', 'woo-donation-popup' ) ),
		);
	}

	/**
	 * Adım gövdesi.
	 *
	 * @param int $step Adım.
	 * @return string
	 */
	private function step_body( $step ) {
		$fields = Field_Registry::fields();
		switch ( $step ) {
			case 1:
				$list = '<ul class="dpa-statuses">';
				foreach ( ( new Status( $this->settings ) )->items() as $item ) {
					$list .= Admin_View::status_row( $item['ok'], $item['text'], $item['url'], $item['link'] );
				}
				return $list . '</ul><p class="dpa-row__help">' . esc_html__( 'Donation Panel works on your existing WooCommerce products. Open a product and use its Donation tab to turn it into a donation product.', 'woo-donation-popup' ) . '</p>';
			case 2:
				$html   = Admin_View::cards( 'display.mode', $fields['display.mode']['options'], (string) $this->store->get( 'display.mode' ), $fields['display.mode']['label'] );
				$colors = (string) $this->store->get( 'design.colors' );
				// Palet okunamıyorsa (ve sihirbaz henüz bitmediyse) "Özel renkler" varsayılan önerilir; kullanıcı değiştirebilir.
				if ( 'none' === \DonationPanel\Frontend\Theme_Colors::source_status() ) {
					$html .= Admin_View::colors_note( 'none', array(), false );
					if ( 'done' !== (string) $this->settings->get( 'admin.wizard', '' ) ) {
						$colors = 'custom';
					}
				}
				$html .= '<fieldset class="dpa-radios"><legend class="dpa-radios__legend">' . esc_html__( 'Colors', 'woo-donation-popup' ) . '</legend>';
				$html .= '<label class="dpa-radio" for="dpa-w-colors-theme"><input type="radio" name="design.colors" id="dpa-w-colors-theme" value="theme" data-dpa-field="design.colors"' . checked( $colors, 'theme', false ) . '><span><b>' . esc_html__( 'Use my theme colors', 'woo-donation-popup' ) . '</b><small>' . esc_html__( 'The form follows your site colors and font automatically', 'woo-donation-popup' ) . '</small></span></label>';
				$html .= '<label class="dpa-radio" for="dpa-w-colors-custom"><input type="radio" name="design.colors" id="dpa-w-colors-custom" value="custom" data-dpa-field="design.colors"' . checked( $colors, 'custom', false ) . '><span><b>' . esc_html__( 'Choose my own colors', 'woo-donation-popup' ) . '</b><small>' . esc_html__( 'Main color and button color', 'woo-donation-popup' ) . '</small></span></label></fieldset>';
				$theme = \DonationPanel\Frontend\Theme_Colors::resolve( \DonationPanel\Frontend\Theme_Colors::site_palette() );
				$html .= '<div data-dpa-when="design.colors=custom">' . Admin_View::field( 'design.brand', Admin_View::with_color_source( $fields['design.brand'], $theme['primary'] ), $this->store->get( 'design.brand' ) ) . Admin_View::field( 'design.accent', Admin_View::with_color_source( $fields['design.accent'], $theme['action'] ), $this->store->get( 'design.accent' ) ) . '</div>';
				return $html;
			case 3:
				$html = '';
				foreach ( array( 'form.presets_enabled', 'form.presets', 'form.dedication', 'form.anonymous' ) as $id ) {
					$html .= Admin_View::field( $id, $fields[ $id ], $this->store->get( $id ) );
				}
				return $html;
			case 4:
				$html = '<div class="dpa-mods">';
				foreach ( Settings_Store::module_definitions() as $slug => $def ) {
					$html .= Admin_View::module_row( $slug, $def[0], $def[1], $this->store->module_enabled( $slug ) );
				}
				return $html . '</div>';
		}
		return Admin_View::code( '[wdp_donation_button_panel]' ) . '<p class="dpa-row__help">' . esc_html__( 'On a product page the shortcode finds its own product. No ID needed.', 'woo-donation-popup' ) . '</p>';
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
		$labels = self::step_labels();
		$text   = $this->step_text();
		$cur    = $this->current_step();

		// "Temamın renklerini kullan" önizlemesi: tema paletinden seçilen ana/eylem rengi (WordPress standart paleti).
		$theme_colors = \DonationPanel\Frontend\Theme_Colors::variables( \DonationPanel\Frontend\Theme_Colors::site_palette() );
		$theme_attrs  = '';
		if ( isset( $theme_colors['--dp-color-primary'] ) ) {
			$theme_attrs .= ' data-dpa-theme-brand="' . esc_attr( $theme_colors['--dp-color-primary'] ) . '"';
		}
		if ( isset( $theme_colors['--dp-accent'] ) ) {
			$theme_attrs .= ' data-dpa-theme-accent="' . esc_attr( $theme_colors['--dp-accent'] ) . '"';
		}

		$html  = '<div class="wrap dpa dpa-wizard" id="dpa-wizard" data-dpa-page="wizard"' . $theme_attrs . ' data-dpa-step="' . (int) $cur . '" data-dpa-steps="' . (int) self::STEP_COUNT . '" data-dpa-overview="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_OVERVIEW ) ) . '">';
		$html .= '<h1 class="screen-reader-text">' . esc_html__( 'Quick setup', 'woo-donation-popup' ) . '</h1>';
		$html .= '<ol class="dpa-stepper" aria-label="' . esc_attr__( 'Setup progress', 'woo-donation-popup' ) . '">';
		foreach ( $labels as $n => $label ) {
			$html .= '<li class="dpa-stepper__item" data-dpa-stepper="' . (int) $n . '"><span class="dpa-stepper__dot" aria-hidden="true">' . (int) $n . '</span><span class="dpa-stepper__label">' . esc_html( $label ) . '</span></li>';
		}
		$html .= '</ol><div class="dpa-notices" data-dpa-notices role="status" aria-live="polite"></div>';

		$html .= '<div class="dpa-wizard__card"><div class="dpa-wizard__main">';
		foreach ( $labels as $n => $label ) {
			$html .= '<section class="dpa-step" data-dpa-wstep="' . (int) $n . '"' . ( $n === $cur ? '' : ' hidden' ) . ' aria-labelledby="dpa-ws-h' . (int) $n . '"><h2 class="dpa-step__title" id="dpa-ws-h' . (int) $n . '">' . esc_html( $text[ $n ][0] ) . '</h2><p class="dpa-step__sub">' . esc_html( $text[ $n ][1] ) . '</p>' . $this->step_body( $n ) . '</section>';
		}
		$html .= '<div class="dpa-wizard__nav"><button type="button" class="dpa-btn dpa-btn--ghost" data-dpa-back>' . esc_html__( 'Back', 'woo-donation-popup' ) . '</button>'
			. '<button type="button" class="dpa-link" data-dpa-skip>' . esc_html__( 'Skip for now', 'woo-donation-popup' ) . '</button>'
			. '<button type="button" class="dpa-btn dpa-btn--accent" data-dpa-next>' . esc_html__( 'Continue', 'woo-donation-popup' ) . '</button>'
			. '<button type="button" class="dpa-btn dpa-btn--accent" data-dpa-finish hidden>' . esc_html__( 'Finish', 'woo-donation-popup' ) . '</button></div>';
		$html .= '</div>';

		$html .= '<aside class="dpa-wizard__preview" aria-label="' . esc_attr__( 'Live preview', 'woo-donation-popup' ) . '"><span class="dpa-eyebrow">' . esc_html__( 'LIVE PREVIEW', 'woo-donation-popup' ) . '</span>'
			. '<div class="dpa-phone" aria-hidden="true" data-dpa-phone><div class="dpa-phone__sheet"><span class="dpa-phone__grip"></span><span class="dpa-phone__title"></span><span class="dpa-phone__bar"><i></i></span>'
			. '<span class="dpa-phone__chips"><i></i><i></i><i class="is-on"></i><i></i></span><span class="dpa-phone__cta"></span></div></div></aside>';
		$html .= '</div></div>';

		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Admin_View ve esc_* kullanıldı.
	}
}
