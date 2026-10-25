<?php
/**
 * Sade ayar ekranı (E7): WordPress Settings API + nonce + yetki. Yalnız Core ayarına (`donation_panel_settings`) yazar.
 *
 * Eski ekranın ayarları (tasarım, form alanları, ürün yerleşimi) eski ekranda kalır; bu ekran onlara bağlantı verir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Settings_Page.
 */
final class Settings_Page {

	const OPTION_GROUP = 'donation_panel';

	/**
	 * Modül ayrıntı alanları (grup => anahtar => tip).
	 */
	const DETAIL_FIELDS = array(
		'thanks'     => array(
			'celebrate' => 'bool',
			'share'     => 'bool',
			'message'   => 'text',
		),
		'tax_relief' => array(
			'step_label'     => 'string',
			'title'          => 'string',
			'text'           => 'text',
			'checkbox_label' => 'string',
		),
		'impact'     => array(
			'map' => 'text',
		),
	);

	/**
	 * Modül kayıt defteri.
	 *
	 * @var Module_Registry
	 */
	private $registry;

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Settings        $settings Ayarlar.
	 * @param Module_Registry $registry Modül kayıt defteri.
	 */
	public function __construct( Settings $settings, Module_Registry $registry ) {
		$this->settings = $settings;
		$this->registry = $registry;
	}

	/**
	 * Anahtarla açılıp kapanan modüller: slug => [ etiket, açıklama ].
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public static function module_definitions() {
		return array(
			'campaign'      => array(
				__( 'Campaign card and progress', 'woo-donation-popup' ),
				__( 'Shows the goal, the amount raised and the number of donors for a campaign.', 'woo-donation-popup' ),
			),
			'impact'        => array(
				__( 'Impact phrases', 'woo-donation-popup' ),
				__( 'Short equivalents next to amounts, such as "1 food parcel".', 'woo-donation-popup' ),
			),
			'social_proof'  => array(
				__( 'Social proof', 'woo-donation-popup' ),
				__( 'Totals only, built from real donations. No personal information is ever shown.', 'woo-donation-popup' ),
			),
			'thanks'        => array(
				__( 'Thank-you screen', 'woo-donation-popup' ),
				__( 'A warm confirmation after the order, with an optional share button.', 'woo-donation-popup' ),
			),
			'tax_relief'    => array(
				__( 'Tax relief declaration', 'woo-donation-popup' ),
				__( 'Asks the donor one question. If they say yes, their name and address are saved on the order.', 'woo-donation-popup' ),
			),
			'donor_account' => array(
				__( 'Donor account', 'woo-donation-popup' ),
				__( 'Optional sign-in, a "My donations" panel and a quick way to give again.', 'woo-donation-popup' ),
			),
			'side_cart'     => array(
				__( 'Side cart', 'woo-donation-popup' ),
				__( 'A slide-in cart so donors can review their gift without leaving the page.', 'woo-donation-popup' ),
			),
		);
	}

	/**
	 * Kancaları bağlar.
	 *
	 * @return void
	 */
	public function register() {
		register_setting(
			self::OPTION_GROUP,
			Settings::OPTION_NAME,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => Settings::defaults(),
				'show_in_rest'      => false,
			)
		);
		add_filter( 'option_page_capability_' . self::OPTION_GROUP, array( $this, 'capability' ) );
	}

	/**
	 * Settings API yetkisi (varsayılan `manage_options` yerine mağaza yöneticisi).
	 *
	 * @return string
	 */
	public function capability() {
		return Admin_Bootstrap::CAPABILITY;
	}

	/**
	 * Kayıt temizleyicisi. Form (`_form` işaretli) gelirse alanlar tek tek doğrulanır; işaretsiz (kod yoluyla)
	 * gelen dizi yalnız şemaya göre normalize edilir. Form dışı anahtarlar (sürüm, başka modül bayrakları) korunur.
	 *
	 * @param mixed $input Ham değer.
	 * @return array<string, mixed>
	 */
	public function sanitize( $input ) {
		$stored  = get_option( Settings::OPTION_NAME, array() );
		$current = Settings::normalize( is_array( $stored ) ? $stored : array() );
		if ( ! is_array( $input ) ) {
			return $current;
		}
		if ( empty( $input['_form'] ) ) {
			return Settings::normalize( $input );
		}
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			return $current;
		}

		$input = wp_unslash( $input );

		foreach ( array_keys( self::module_definitions() ) as $slug ) {
			$current['modules'][ $slug ] = ! empty( $input['modules'][ $slug ] );
		}

		$engine = isset( $input['experiences']['engine'] ) ? sanitize_key( (string) $input['experiences']['engine'] ) : '';
		if ( in_array( $engine, Settings::ENGINES, true ) ) {
			$current['experiences']['engine'] = $engine;
		}

		$ui = isset( $input['admin']['ui'] ) ? sanitize_key( (string) $input['admin']['ui'] ) : '';
		if ( in_array( $ui, Settings::ADMIN_UIS, true ) ) {
			$current['admin']['ui'] = $ui;
		}

		$current['general']['delete_data_on_uninstall'] = ! empty( $input['general']['delete_data_on_uninstall'] );

		foreach ( self::DETAIL_FIELDS as $group => $fields ) {
			foreach ( $fields as $key => $type ) {
				if ( 'bool' === $type ) {
					$current[ $group ][ $key ] = ! empty( $input[ $group ][ $key ] );
				} elseif ( isset( $input[ $group ][ $key ] ) ) {
					$current[ $group ][ $key ] = $input[ $group ][ $key ];
				}
			}
		}

		return Settings::normalize( $current );
	}

	/**
	 * Sekme tanımları: kimlik => etiket.
	 *
	 * @return array<string, string>
	 */
	private function tabs() {
		return array(
			'general'  => __( 'General', 'woo-donation-popup' ),
			'modules'  => __( 'Modules', 'woo-donation-popup' ),
			'details'  => __( 'Texts', 'woo-donation-popup' ),
			'advanced' => __( 'Advanced', 'woo-donation-popup' ),
		);
	}

	/**
	 * Ekranı çizer.
	 *
	 * @return void
	 */
	public function render() {
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to open this page.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}

		$tabs = $this->tabs();
		echo '<div class="wrap dpa" id="dpa-settings">';
		echo '<h1 class="dpa-title">' . esc_html__( 'Donation Panel', 'woo-donation-popup' ) . '</h1>';
		echo '<p class="dpa-sub">' . esc_html__( 'A few clear settings. Every setting says what it does underneath.', 'woo-donation-popup' ) . '</p>';
		settings_errors();
		$this->render_wizard_prompt();

		echo '<form method="post" action="' . esc_url( admin_url( 'options.php' ) ) . '" class="dpa-form" data-dpa-form>';
		settings_fields( self::OPTION_GROUP );
		echo '<input type="hidden" name="' . esc_attr( Settings::OPTION_NAME ) . '[_form]" value="1">';

		echo '<div class="dpa-split"><div class="dpa-main">';
		echo '<div class="dpa-tabs" role="tablist" aria-label="' . esc_attr__( 'Settings sections', 'woo-donation-popup' ) . '">';
		$first = true;
		foreach ( $tabs as $id => $label ) {
			echo '<button type="button" role="tab" class="dpa-tab" id="dpa-tab-' . esc_attr( $id ) . '" aria-controls="dpa-panel-' . esc_attr( $id ) . '" aria-selected="' . ( $first ? 'true' : 'false' ) . '" tabindex="' . ( $first ? '0' : '-1' ) . '" data-dpa-tab="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</button>';
			$first = false;
		}
		echo '</div>';

		foreach ( array_keys( $tabs ) as $id ) {
			echo '<section class="dpa-card dpa-panel" role="tabpanel" id="dpa-panel-' . esc_attr( $id ) . '" aria-labelledby="dpa-tab-' . esc_attr( $id ) . '" data-dpa-panel="' . esc_attr( $id ) . '"><h2 class="screen-reader-text">' . esc_html( $tabs[ $id ] ) . '</h2>';
			// Her render_* çıktısı Admin_View yardımcılarından gelir ve kaçışlıdır.
			echo $this->{'panel_' . $id}(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo '</section>';
		}
		echo '</div>';

		echo '<aside class="dpa-aside" aria-label="' . esc_attr__( 'Preview', 'woo-donation-popup' ) . '">';
		echo $this->preview(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '</aside></div>';

		echo '<div class="dpa-savebar"><span class="dpa-savebar__msg" data-dpa-msg role="status" aria-live="polite" data-unsaved="' . esc_attr__( 'You have unsaved changes', 'woo-donation-popup' ) . '"></span>';
		echo '<button type="submit" class="button button-primary button-hero dpa-save">' . esc_html__( 'Save changes', 'woo-donation-popup' ) . '</button></div>';
		echo '</form></div>';
	}

	/**
	 * Sihirbaz hiç yapılmadıysa tek satırlık davet.
	 *
	 * @return void
	 */
	private function render_wizard_prompt() {
		if ( '' !== (string) $this->settings->get( 'admin.wizard', '' ) ) {
			return;
		}
		echo '<div class="dpa-card dpa-prompt"><div><strong>' . esc_html__( 'New here? Quick setup takes about two minutes.', 'woo-donation-popup' ) . '</strong><p class="dpa-row__help">' . esc_html__( 'It picks sensible defaults for what you want to achieve. Nothing is created and you can change everything later.', 'woo-donation-popup' ) . '</p></div><div class="dpa-prompt__actions">';
		echo '<a class="button button-primary" href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_WIZARD ) ) . '">' . esc_html__( 'Start quick setup', 'woo-donation-popup' ) . '</a> ';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="dpa-inline">';
		wp_nonce_field( Setup_Wizard::NONCE_ACTION );
		echo '<input type="hidden" name="action" value="' . esc_attr( Setup_Wizard::ACTION ) . '"><input type="hidden" name="wizard_result" value="skipped"><button type="submit" class="button">' . esc_html__( 'Skip', 'woo-donation-popup' ) . '</button></form>';
		echo '</div></div>';
	}

	/**
	 * Alan adı.
	 *
	 * @param string $group Grup.
	 * @param string $key   Anahtar.
	 * @return string
	 */
	private static function field( $group, $key ) {
		return Settings::OPTION_NAME . '[' . $group . '][' . $key . ']';
	}

	/**
	 * Genel sekmesi.
	 *
	 * @return string
	 */
	private function panel_general() {
		$engine = (string) $this->settings->get( 'experiences.engine', 'legacy' );

		$html  = Admin_View::row(
			__( 'Donation form experience', 'woo-donation-popup' ),
			__( 'The classic form is the safe default. The new form adds donation types and a calmer, mobile-first layout. On phones the form always opens as a bottom sheet.', 'woo-donation-popup' ),
			Admin_View::select(
				self::field( 'experiences', 'engine' ),
				'dpa-engine',
				array(
					'legacy' => __( 'Classic form (default)', 'woo-donation-popup' ),
					'new'    => __( 'New form', 'woo-donation-popup' ),
				),
				$engine
			),
			'dpa-engine'
		);
		$html .= Admin_View::row(
			__( 'Where the donate button appears', 'woo-donation-popup' ),
			__( 'Automatic placement uses the standard WooCommerce spots on product pages. A shortcode and a block always work anywhere. Nothing to set up here.', 'woo-donation-popup' ),
			Admin_View::badge( __( 'Automatic, shortcode and block', 'woo-donation-popup' ), 'success' ) . ' <a href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_GUIDE ) ) . '">' . esc_html__( 'Read the guide', 'woo-donation-popup' ) . '</a>'
		);

		$has_adapter = (bool) has_filter( 'donation_panel_convert_amount' );
		$html       .= Admin_View::row(
			__( 'Currency', 'woo-donation-popup' ),
			__( 'Amounts, decimals and separators come from WooCommerce. If you use a multi-currency plugin, an adapter snippet converts amounts; the guide explains how.', 'woo-donation-popup' ),
			Admin_View::badge( $has_adapter ? __( 'Currency adapter active', 'woo-donation-popup' ) : __( 'WooCommerce active currency only', 'woo-donation-popup' ), $has_adapter ? 'info' : 'neutral' )
		);

		$html .= Admin_View::row(
			__( 'Design and form fields', 'woo-donation-popup' ),
			__( 'Colors, form fields, product placement and the product list stay in the classic settings screen. Nothing was removed.', 'woo-donation-popup' ),
			'<a class="button" href="' . esc_url( Admin_View::url( 'wdp-popup-settings' ) ) . '">' . esc_html__( 'Open classic settings', 'woo-donation-popup' ) . '</a>'
		);
		return $html;
	}

	/**
	 * Modüller sekmesi.
	 *
	 * @return string
	 */
	private function panel_modules() {
		$html = '<p class="dpa-note">' . esc_html__( 'Modules that are off load nothing, so they never slow your site down.', 'woo-donation-popup' ) . '</p>';
		foreach ( self::module_definitions() as $slug => $def ) {
			$id    = 'dpa-mod-' . $slug;
			$html .= Admin_View::row(
				$def[0],
				$def[1],
				Admin_View::switch_control( Settings::OPTION_NAME . '[modules][' . $slug . ']', $id, $this->registry->is_enabled( $slug ), $slug ),
				$id
			);
		}
		return $html;
	}

	/**
	 * Metinler sekmesi (modül ayrıntıları).
	 *
	 * @return string
	 */
	private function panel_details() {
		$s     = $this->settings;
		$html  = '<p class="dpa-note">' . esc_html__( 'Leave a field empty to use the built-in wording. The built-in wording is translated for you.', 'woo-donation-popup' ) . '</p>';
		$html .= Admin_View::row(
			__( 'Thank-you message', 'woo-donation-popup' ),
			__( 'Shown on the thank-you screen after a donation.', 'woo-donation-popup' ),
			Admin_View::textarea( self::field( 'thanks', 'message' ), 'dpa-thanks-message', (string) $s->get( 'thanks.message', '' ), 3 ),
			'dpa-thanks-message'
		);
		$html .= Admin_View::row(
			__( 'Celebration animation', 'woo-donation-popup' ),
			__( 'A short, gentle animation. It switches off by itself for visitors who prefer reduced motion.', 'woo-donation-popup' ),
			Admin_View::switch_control( self::field( 'thanks', 'celebrate' ), 'dpa-celebrate', (bool) $s->get( 'thanks.celebrate', true ) ),
			'dpa-celebrate'
		);
		$html .= Admin_View::row(
			__( 'Share button', 'woo-donation-popup' ),
			__( 'Lets donors share the campaign after giving.', 'woo-donation-popup' ),
			Admin_View::switch_control( self::field( 'thanks', 'share' ), 'dpa-share', (bool) $s->get( 'thanks.share', true ) ),
			'dpa-share'
		);
		$html .= Admin_View::row(
			__( 'Impact phrases', 'woo-donation-popup' ),
			__( 'One per line: amount = phrase. Add "singular|plural" for two forms. Example: 25 = 1 food parcel|food parcels', 'woo-donation-popup' ),
			Admin_View::textarea( self::field( 'impact', 'map' ), 'dpa-impact-map', (string) $s->get( 'impact.map', '' ), 4 ),
			'dpa-impact-map'
		);
		$html .= Admin_View::row(
			__( 'Tax relief: step title', 'woo-donation-popup' ),
			__( 'Short label for the step.', 'woo-donation-popup' ),
			Admin_View::text( self::field( 'tax_relief', 'step_label' ), 'dpa-tax-step', (string) $s->get( 'tax_relief.step_label', '' ) ),
			'dpa-tax-step'
		);
		$html .= Admin_View::row(
			__( 'Tax relief: heading', 'woo-donation-popup' ),
			__( 'The question heading the donor sees.', 'woo-donation-popup' ),
			Admin_View::text( self::field( 'tax_relief', 'title' ), 'dpa-tax-title', (string) $s->get( 'tax_relief.title', '' ) ),
			'dpa-tax-title'
		);
		$html .= Admin_View::row(
			__( 'Tax relief: explanation', 'woo-donation-popup' ),
			__( 'A sentence or two explaining the declaration. Link to your privacy page from your site, not here.', 'woo-donation-popup' ),
			Admin_View::textarea( self::field( 'tax_relief', 'text' ), 'dpa-tax-text', (string) $s->get( 'tax_relief.text', '' ), 3 ),
			'dpa-tax-text'
		);
		$html .= Admin_View::row(
			__( 'Tax relief: checkbox wording', 'woo-donation-popup' ),
			__( 'The sentence next to the tick box. It is never ticked in advance.', 'woo-donation-popup' ),
			Admin_View::text( self::field( 'tax_relief', 'checkbox_label' ), 'dpa-tax-check', (string) $s->get( 'tax_relief.checkbox_label', '' ) ),
			'dpa-tax-check'
		);
		return $html;
	}

	/**
	 * Gelişmiş sekmesi.
	 *
	 * @return string
	 */
	private function panel_advanced() {
		$html  = Admin_View::row(
			__( 'Settings screen', 'woo-donation-popup' ),
			__( 'Switch back to the classic settings screen at any time. Your settings are kept either way.', 'woo-donation-popup' ),
			Admin_View::select(
				self::field( 'admin', 'ui' ),
				'dpa-ui',
				array(
					'new'    => __( 'This simple screen', 'woo-donation-popup' ),
					'legacy' => __( 'Classic screen', 'woo-donation-popup' ),
				),
				'new'
			),
			'dpa-ui'
		);
		$html .= Admin_View::row(
			__( 'Quick setup', 'woo-donation-popup' ),
			__( 'Run the short setup again. It only changes the options you confirm.', 'woo-donation-popup' ),
			'<a class="button" href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_WIZARD ) ) . '">' . esc_html__( 'Open quick setup', 'woo-donation-popup' ) . '</a>'
		);
		$html .= Admin_View::row(
			__( 'Delete data when the plugin is deleted', 'woo-donation-popup' ),
			__( 'When off, your orders and donation records are always kept.', 'woo-donation-popup' ),
			Admin_View::switch_control( self::field( 'general', 'delete_data_on_uninstall' ), 'dpa-delete-data', (bool) $this->settings->get( 'general.delete_data_on_uninstall', false ) ),
			'dpa-delete-data'
		);
		return $html;
	}

	/**
	 * Canlı önizleme: gerçek ayarları değil, seçimlerin etkisini gösterir (kişi verisi yok).
	 *
	 * @return string
	 */
	private function preview() {
		$amounts = array( 25, 50, 100 );
		$chips   = '';
		foreach ( $amounts as $i => $amount ) {
			$label  = function_exists( 'wc_price' ) ? wp_strip_all_tags( (string) wc_price( $amount ) ) : (string) $amount;
			$chips .= '<span class="dpa-chip' . ( 1 === $i ? ' is-on' : '' ) . '">' . esc_html( html_entity_decode( $label, ENT_QUOTES, 'UTF-8' ) ) . '</span>';
		}

		$html  = '<p class="dpa-eyebrow">' . esc_html__( 'Preview', 'woo-donation-popup' ) . '</p>';
		$html .= '<div class="dpa-preview" aria-hidden="true">';
		$html .= '<div class="dpa-pv-block" data-dpa-preview="campaign"><div class="dpa-pv-bar"><i></i></div><small>' . esc_html__( 'Goal, amount raised and donors', 'woo-donation-popup' ) . '</small></div>';
		$html .= '<div class="dpa-pv-chips">' . $chips . '</div>';
		$html .= '<div class="dpa-pv-block" data-dpa-preview="impact"><small>' . esc_html__( 'Your gift provides 2 food parcels', 'woo-donation-popup' ) . '</small></div>';
		$html .= '<div class="dpa-pv-block" data-dpa-preview="tax_relief"><small>&#9744; ' . esc_html__( 'I would like to make a tax relief declaration', 'woo-donation-popup' ) . '</small></div>';
		$html .= '<div class="dpa-pv-block" data-dpa-preview="donor_account"><small>' . esc_html__( 'Sign in to see My donations', 'woo-donation-popup' ) . '</small></div>';
		$html .= '<div class="dpa-pv-btn">' . esc_html__( 'Donate', 'woo-donation-popup' ) . '</div>';
		$html .= '<div class="dpa-pv-block" data-dpa-preview="social_proof"><small>' . esc_html__( 'Totals from real donations', 'woo-donation-popup' ) . '</small></div>';
		$html .= '</div><p class="dpa-row__help">' . esc_html__( 'A simplified sketch. Colors and fonts come from your theme. Mobile always uses a bottom sheet.', 'woo-donation-popup' ) . '</p>';
		return $html;
	}
}
