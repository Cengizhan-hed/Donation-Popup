<?php
/**
 * Ayarlar sayfası denetleyicisi; ürün listesi ve sekme AJAX kaydetme uçları.
 *
 * @package WooCommerce\Donation_Popup
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Woo_Donation_Popup_Admin {
	/**
	 * Store settings in a non-autoload option to keep front bootstrap lean.
	 *
	 * @param string $option_name Option key.
	 * @param mixed  $value       Option value.
	 * @return bool
	 */
	private function update_non_autoload_option( $option_name, $value ) {
		if ( false === get_option( $option_name, false ) ) {
			return add_option( $option_name, $value, '', 'no' );
		}

		return update_option( $option_name, $value, false );
	}

	/**
	 * Ön yüz CSS/JS query string ve object cache anahtarlarını tazelemek için (CDN / SG vb.).
	 */
	private function bump_wdp_asset_cache_version() {
		update_option( 'wdp_cache_version', time() );
		if ( class_exists( 'WDP_Assets' ) && method_exists( 'WDP_Assets', 'purge_known_page_caches' ) ) {
			WDP_Assets::purge_known_page_caches();
		}
	}

	/**
	 * Constructor
	 */
	public function __construct() {
		WDP_Admin_Hooks::register( $this );
	}

	/**
	 * Admin menüsüne "Popup Ayarları" sayfasını ekle
	 */
	public function add_admin_menu() {
		add_submenu_page(
			'woocommerce', // WooCommerce menüsü altına ekle
			__( 'Donation Popup settings', 'woo-donation-popup' ),
			__( 'Donation Popup settings', 'woo-donation-popup' ),
			'manage_woocommerce', // WooCommerce yönetme yetkisi olan kullanıcılar görebilir
			'wdp-popup-settings',
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Admin sayfası için stil ve script dosyalarını ekle
	 */
	public function enqueue_admin_assets( $hook ) {
		WDP_Admin_Assets::enqueue( $hook );
	}

	/**
	 * Ayarlar sayfasını render et
	 */
	public function render_settings_page() {
		WDP_Admin_Page_Renderer::render_settings_page(
			function () {
				$this->render_modal_layout_customization_tab(); },
			function () {
				$this->render_normal_form_customization_tab(); },
			function () {
				$this->render_shareholder_form_customization_tab(); },
			function () {
				$this->render_progress_bar_customization_tab(); },
			function () {
				$this->render_success_screen_customization_tab(); },
			function () {
				$this->render_design_studio_tab(); }
		);
	}

	/**
	 * Tasarım Stüdyosu sekmesi.
	 *
	 * @return void
	 */
	private function render_design_studio_tab() {
		WDP_Admin_Design_Studio_Renderer::render_tab();
	}

	/**
	 * Ürün sayfası ve liste ayarlarını kaydet (AJAX).
	 *
	 * @return void
	 */
	public function save_placement_settings() {
		try {
			$this->guard_admin_settings_ajax();
			WDP_Placement_Settings::save( $this->get_admin_request_data() );
			$this->bump_wdp_asset_cache_version();
			$this->send_admin_settings_success( __( 'Product page and list settings saved.', 'woo-donation-popup' ) );
		} catch ( \Throwable $e ) {
			if ( function_exists( 'wdp_debug_log' ) ) {
				wdp_debug_log( 'WDP placement save: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
			}
			$this->send_admin_settings_error( __( 'Something went wrong. Please try again.', 'woo-donation-popup' ) );
		}
	}

	/**
	 * Normal form özelleştirme tab'ını render et
	 */
	private function render_normal_form_customization_tab() {
		WDP_Admin_Form_Tabs_Renderer::render_normal_form_tab();
	}

	/**
	 * Hisseli form özelleştirme tab'ını render et
	 */
	private function render_shareholder_form_customization_tab() {
		WDP_Admin_Form_Tabs_Renderer::render_shareholder_form_tab();
	}

	/**
	 * Başarı ekranı özelleştirme tab'ını render et
	 */
	private function render_success_screen_customization_tab() {
		WDP_Admin_Form_Tabs_Renderer::render_success_screen_tab();
	}

	/**
	 * Progress bar özelleştirme tab'ını render et
	 */
	private function render_progress_bar_customization_tab() {
		WDP_Admin_Layout_Tabs_Renderer::render_progress_bar_tab();
	}

	/**
	 * Normal form özelleştirme ayarlarını kaydet (AJAX)
	 */
	public function save_normal_form_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();
		$existing     = get_option( 'wdp_button_settings', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}

		// Bu sekmedeki checkbox’lar POST’ta yoksa kapalı; diğer sekmelerin bayrakları korunur.
		foreach ( array(
			'enable_multi_step',
			'enable_amount_presets',
			'popup_button_full_width',
			'button_shadow_sc_enabled',
			'button_shadow_sc_hover_enhanced',
			'button_shadow_modal_enabled',
			'button_shadow_modal_hover_enhanced',
		) as $checkbox_key ) {
			if ( ! isset( $request_data[ $checkbox_key ] ) ) {
				$request_data[ $checkbox_key ] = '0';
			}
		}

		$merged_request = array_merge( $existing, $request_data );
		$settings       = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings( $merged_request );

		// 10.29.0: geçersiz hızlı tutar listesi / önerilen tutar kaydedilmez; mevcut ayar korunur.
		if ( WDP_Admin_Settings_Normalizer::$last_validation_error !== '' ) {
			$this->send_admin_settings_error( WDP_Admin_Settings_Normalizer::$last_validation_error );
			return;
		}

		$this->update_non_autoload_option( 'wdp_button_settings', $settings );
		$this->bump_wdp_asset_cache_version();

		$this->send_admin_settings_success( __( 'Standard form settings saved successfully.', 'woo-donation-popup' ) );
	}

	/**
	 * Tasarım Stüdyosu ayarlarını kaydet (AJAX) — mevcut button settings üzerine merge.
	 */
	public function save_design_studio_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();
		$existing     = get_option( 'wdp_button_settings', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		// Unchecked checkboxes are absent from POST — force off for studio fields.
		foreach ( array( 'enable_field_icons', 'trust_strip_enabled', 'enable_donor_email', 'enable_dedication', 'enable_anonymous', 'enable_privacy_notice' ) as $checkbox_key ) {
			if ( ! isset( $request_data[ $checkbox_key ] ) ) {
				$request_data[ $checkbox_key ] = '0';
			}
		}
		$merged_request = array_merge( $existing, $request_data );
		$settings       = WDP_Admin_Settings_Normalizer::normalize_normal_form_settings( $merged_request );
		if ( WDP_Admin_Settings_Normalizer::$last_validation_error !== '' ) {
			$this->send_admin_settings_error( WDP_Admin_Settings_Normalizer::$last_validation_error );
			return;
		}

		// Global marka rengi → otomatik palet (butonlar + progress + başarı).
		$brand = '';
		if ( ! empty( $request_data['brand_color'] ) ) {
			$brand = sanitize_hex_color( $request_data['brand_color'] );
		}
		if ( ! $brand && ! empty( $settings['brand_color'] ) ) {
			$brand = sanitize_hex_color( $settings['brand_color'] );
		}
		if ( $brand && class_exists( 'WDP_Color_Palette' ) ) {
			$settings = WDP_Color_Palette::apply_to_button_settings( $settings, $brand );

			$progress = get_option( 'wdp_progress_bar_settings', array() );
			if ( ! is_array( $progress ) ) {
				$progress = array();
			}
			$progress = WDP_Color_Palette::apply_to_progress_settings( $progress, $brand );
			$this->update_non_autoload_option( 'wdp_progress_bar_settings', $progress );

			$success = get_option( 'wdp_success_settings', array() );
			if ( ! is_array( $success ) ) {
				$success = array();
			}
			$success = WDP_Color_Palette::apply_to_success_settings( $success, $brand );
			$this->update_non_autoload_option( 'wdp_success_settings', $success );

			$share = get_option( 'wdp_shareholder_settings', array() );
			if ( ! is_array( $share ) ) {
				$share = array();
			}
			$share = WDP_Color_Palette::apply_to_shareholder_settings( $share, $brand );
			$this->update_non_autoload_option( 'wdp_shareholder_settings', $share );
		}

		$this->update_non_autoload_option( 'wdp_button_settings', $settings );
		$this->bump_wdp_asset_cache_version();
		$this->send_admin_settings_success( __( 'Design Studio settings saved.', 'woo-donation-popup' ) );
	}

	/**
	 * Hisseli form özelleştirme ayarlarını kaydet (AJAX)
	 */
	public function save_shareholder_form_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();
		$existing     = get_option( 'wdp_shareholder_settings', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		foreach ( array( 'shareholder_enable_copy_button', 'shareholder_enable_email' ) as $checkbox_key ) {
			if ( ! isset( $request_data[ $checkbox_key ] ) ) {
				$request_data[ $checkbox_key ] = '0';
			}
		}
		$settings = WDP_Admin_Settings_Normalizer::normalize_shareholder_settings( array_merge( $existing, $request_data ) );

		$this->update_non_autoload_option( 'wdp_shareholder_settings', $settings );
		$this->bump_wdp_asset_cache_version();

		$this->send_admin_settings_success( __( 'Share-based form settings saved successfully.', 'woo-donation-popup' ) );
	}

	/**
	 * Başarı ekranı özelleştirme ayarlarını kaydet (AJAX)
	 */
	public function save_success_screen_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();
		$existing     = get_option( 'wdp_success_settings', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		$settings = WDP_Admin_Settings_Normalizer::normalize_success_screen_settings( array_merge( $existing, $request_data ) );

		$this->update_non_autoload_option( 'wdp_success_settings', $settings );
		$this->bump_wdp_asset_cache_version();

		$this->send_admin_settings_success( __( 'Success screen settings saved successfully.', 'woo-donation-popup' ) );
	}

	/**
	 * Progress bar özelleştirme ayarlarını kaydet (AJAX)
	 */
	public function save_progress_bar_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();
		$existing     = get_option( 'wdp_progress_bar_settings', array() );
		if ( ! is_array( $existing ) ) {
			$existing = array();
		}
		$settings = WDP_Admin_Settings_Normalizer::normalize_progress_bar_settings( array_merge( $existing, $request_data ) );

		$this->update_non_autoload_option( 'wdp_progress_bar_settings', $settings );
		$this->bump_wdp_asset_cache_version();

		$this->send_admin_settings_success( __( 'Progress bar settings saved successfully.', 'woo-donation-popup' ) );
	}

	/**
	 * Gelişmiş ayarlar (kaldırmada veri silme) kaydet (AJAX).
	 *
	 * @return void
	 */
	public function save_advanced_settings() {
		$this->guard_admin_settings_ajax();
		$request_data = $this->get_admin_request_data();

		$delete_on_uninstall = isset( $request_data['delete_data_on_uninstall'] ) && '1' === (string) $request_data['delete_data_on_uninstall'];
		$currently_on        = '1' === (string) get_option( 'wdp_delete_data_on_uninstall', '0' );
		if ( $delete_on_uninstall && ! $currently_on ) {
			$confirmed = isset( $request_data['confirm_delete_data'] ) && '1' === (string) $request_data['confirm_delete_data'];
			if ( ! $confirmed ) {
				$this->send_admin_settings_error( __( 'This cannot be undone. It is not saved without confirmation.', 'woo-donation-popup' ) );
				return;
			}
		}
		$this->update_non_autoload_option( 'wdp_delete_data_on_uninstall', $delete_on_uninstall ? '1' : '0' );

		$this->send_admin_settings_success( __( 'Advanced settings saved.', 'woo-donation-popup' ) );
	}

	/**
	 * Modal görünüm ayarları tab'ını render et
	 */
	private function render_modal_layout_customization_tab() {
		WDP_Admin_Layout_Tabs_Renderer::render_modal_layout_tab();
	}

	/**
	 * Modal görünüm ayarlarını kaydet (AJAX)
	 */
	public function save_modal_layout_settings() {
		try {
			$this->guard_admin_settings_ajax();
			$request_data = $this->get_admin_request_data();
			$existing     = get_option( 'wdp_modal_layout_settings', array() );
			if ( ! is_array( $existing ) ) {
				$existing = array();
			}

			$settings = WDP_Admin_Settings_Normalizer::normalize_modal_layout_settings( array_merge( $existing, $request_data ) );

			$saved = $this->update_non_autoload_option( 'wdp_modal_layout_settings', $settings );

			if ( $saved === false ) {
				$this->send_admin_settings_error( __( 'An error occurred while saving settings.', 'woo-donation-popup' ) );
			}

			$this->bump_wdp_asset_cache_version();

			$this->send_admin_settings_success( __( 'Popup layout settings saved successfully.', 'woo-donation-popup' ) );

		} catch ( Exception $e ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( 'WDP modal layout save error: ' . $e->getMessage() );
			}
			$this->send_admin_settings_error( __( 'Something went wrong. Please try again.', 'woo-donation-popup' ) );
		}
	}

	/**
	 * Guard admin settings AJAX requests.
	 *
	 * @return void
	 */
	private function guard_admin_settings_ajax() {
		check_ajax_referer( 'wdp_admin_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			$this->send_admin_settings_error( __( 'You do not have permission to do this.', 'woo-donation-popup' ) );
		}
	}

	/**
	 * Send standard admin settings success response.
	 *
	 * @param string $message Success message.
	 * @return void
	 */
	private function send_admin_settings_success( $message ) {
		wp_send_json_success( array( 'message' => $message ) );
		wp_die();
	}

	/**
	 * Send standard admin settings error response.
	 *
	 * @param string $message Error message.
	 * @return void
	 */
	private function send_admin_settings_error( $message ) {
		wp_send_json_error( array( 'message' => $message ) );
		wp_die();
	}

	/**
	 * Return unslashed request data for admin AJAX save handlers.
	 *
	 * @return array
	 */
	private function get_admin_request_data() {
		if ( ! isset( $_POST ) || ! is_array( $_POST ) ) {
			return array();
		}

		return wp_unslash( $_POST );
	}

	/**
	 * Apply a style preset to all related option groups.
	 *
	 * @return void
	 */
	public function apply_style_preset() {
		$this->guard_admin_settings_ajax();
		$id = isset( $_POST['preset_id'] ) ? sanitize_key( wp_unslash( $_POST['preset_id'] ) ) : '';
		if ( $id === '' || ! class_exists( 'WDP_Style_Presets' ) ) {
			$this->send_admin_settings_error( __( 'Invalid style pack.', 'woo-donation-popup' ) );
		}
		if ( ! WDP_Style_Presets::apply_to_options( $id ) ) {
			$this->send_admin_settings_error( __( 'The style pack could not be applied.', 'woo-donation-popup' ) );
		}
		$this->bump_wdp_asset_cache_version();
		$pack            = WDP_Style_Presets::get( $id );
		$button_settings = get_option( 'wdp_button_settings', array() );
		$brand_color     = ( is_array( $button_settings ) && ! empty( $button_settings['brand_color'] ) )
			? (string) $button_settings['brand_color']
			: '';
		wp_send_json_success(
			array(
				'message'     => __( 'The style pack was applied and saved.', 'woo-donation-popup' ),
				'preset_id'   => $id,
				'reload'      => false,
				'pack'        => is_array( $pack ) ? $pack : array(),
				'brand_color' => $brand_color,
			)
		);
		wp_die();
	}

	/**
	 * Export current visual settings as JSON pack.
	 *
	 * @return void
	 */
	public function export_style_preset() {
		$this->guard_admin_settings_ajax();
		if ( ! class_exists( 'WDP_Style_Presets' ) ) {
			$this->send_admin_settings_error( __( 'Style packs could not be loaded.', 'woo-donation-popup' ) );
		}
		$label = isset( $_POST['label'] ) ? sanitize_text_field( wp_unslash( $_POST['label'] ) ) : '';
		$pack  = WDP_Style_Presets::export_current( $label );
		wp_send_json_success( array( 'pack' => $pack ) );
		wp_die();
	}

	/**
	 * Import style pack JSON and apply.
	 *
	 * @return void
	 */
	public function import_style_preset() {
		$this->guard_admin_settings_ajax();
		if ( ! class_exists( 'WDP_Style_Presets' ) ) {
			$this->send_admin_settings_error( __( 'Style packs could not be loaded.', 'woo-donation-popup' ) );
		}
		$raw  = isset( $_POST['pack_json'] ) ? wp_unslash( $_POST['pack_json'] ) : '';
		$pack = json_decode( is_string( $raw ) ? $raw : '', true );
		if ( ! is_array( $pack ) ) {
			$this->send_admin_settings_error( __( 'Invalid JSON pack.', 'woo-donation-popup' ) );
		}
		$id = WDP_Style_Presets::import_pack( $pack, true );
		if ( is_wp_error( $id ) ) {
			$this->send_admin_settings_error( $id->get_error_message() );
		}
		wp_send_json_success(
			array(
				'message'   => __( 'The pack was imported and applied.', 'woo-donation-popup' ),
				'preset_id' => $id,
				'reload'    => false,
			)
		);
		wp_die();
	}
}
