<?php
/**
 * Meta Pixel eşlik ayarları sekmesi form alanları.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders Meta tracking settings form.
 */
class WDP_Admin_Meta_Tracking_Tab_Renderer {

	/**
	 * Echo tab panel markup.
	 *
	 * @return void
	 */
	public static function render() {
		$s = class_exists('WDP_Meta_Tracking') ? WDP_Meta_Tracking::get_settings() : array();

		$on = static function ($key) use ($s) {
			return isset($s[ $key ]) && '1' === (string) $s[ $key ];
		};

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note">';
		echo '<p class="wdp-tab-help__title">' . esc_html__('Meta Pixel (WDP)', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Bu bölüm mevcut site pikselini (ör. WooCommerce / Meta entegrasyonu) kullanır; varsayılan olarak ikinci bir piksel veya PageView eklemez. ViewContent ve AddToCart bu eklentiden gönderilir; InitiateCheckout ve Purchase varsayılan olarak WooCommerce / Meta entegrasyonuna bırakılır.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		$wc_meta_purchase = class_exists('WDP_Meta_Tracking') && WDP_Meta_Tracking::is_woocommerce_meta_purchase_integration_active();

		echo '<form id="wdp-meta-tracking-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_meta_tracking_settings">';
		self::row_toggle('meta_enabled', __('Meta izlemeyi etkinleştir', 'woo-donation-popup'), $on('enabled'));
		$consent_api = class_exists('WDP_Meta_Tracking') && WDP_Meta_Tracking::is_consent_api_available();
		self::row_toggle(
			'meta_require_consent',
			__('Çerez izni gerektir', 'woo-donation-popup'),
			$on('require_consent'),
			$consent_api
				? __('Açıkken Pixel ve olaylar yalnızca pazarlama (marketing) izni verildiğinde çalışır. WP Consent API algılandı; izin sonradan verilirse Pixel o anda başlatılır.', 'woo-donation-popup')
				: __('Açıkken Pixel ve olaylar yalnızca pazarlama izni varsa çalışır. WP Consent API yüklü değil: izin durumu “wdp_meta_pixel_has_consent” filtresiyle bildirilmelidir (varsayılan: izin yok). Kapalıysa eski davranış korunur.', 'woo-donation-popup')
		);
		self::row_toggle('meta_view_content', __('Form açıldığında ViewContent gönder', 'woo-donation-popup'), $on('view_content'));
		self::row_toggle('meta_add_to_cart', __('Sepete eklendikten sonra AddToCart gönder', 'woo-donation-popup'), $on('add_to_cart'));
		self::row_toggle(
			'meta_purchase',
			__('Bağış eklentisinden Purchase gönder', 'woo-donation-popup'),
			$on('purchase'),
			$wc_meta_purchase
				? __('WooCommerce / Meta entegrasyonu algılandı (ör. facebook-for-woocommerce). Varsayılan kapalı tutun; aksi halde teşekkür sayfasında iki Purchase oluşabilir. Yalnızca WooCommerce Purchase göndermiyorsa etkinleştirin.', 'woo-donation-popup')
				: __('Teşekkür / sipariş alındı sayfasında bu eklentiden Purchase gönderir. WooCommerce / Meta zaten Purchase gönderiyorsa kapalı bırakın.', 'woo-donation-popup')
		);
		self::row_toggle('meta_custom_debug', __('Özel hata ayıklama olayları (DonationFormOpen vb.)', 'woo-donation-popup'), $on('custom_debug'));
		self::row_toggle('meta_debug', __('Konsol hata ayıklama günlüğü (kişisel veri yok)', 'woo-donation-popup'), $on('debug'));
		self::row_toggle('meta_load_base_pixel', __('Temel Meta pikselini bu eklentiden yükle (varsayılan kapalı)', 'woo-donation-popup'), $on('load_base_pixel'));
		self::row_toggle('meta_initiate_checkout', __('Eklentiden InitiateCheckout gönder (varsayılan kapalı; WooCommerce ile çakışabilir)', 'woo-donation-popup'), $on('initiate_checkout'));
		self::row_toggle('meta_purchase_include_on_hold', __('Purchase: on-hold siparişlere de izin ver (havale vb.)', 'woo-donation-popup'), $on('purchase_include_on_hold'));

		$pixel_val = isset($s['optional_pixel_id']) ? esc_attr((string) $s['optional_pixel_id']) : '';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="optional_pixel_id">' . esc_html__('İsteğe bağlı Pixel ID', 'woo-donation-popup') . '</label></th><td>';
		echo '<input type="text" id="optional_pixel_id" name="optional_pixel_id" class="regular-text" value="' . $pixel_val . '" inputmode="numeric" pattern="[0-9]*" autocomplete="off" />';
		echo '<p class="description">' . esc_html__('Yalnızca “temel pikseli yükle” açıksa kullanılır. Site zaten piksel yüklüyorsa boş bırakın.', 'woo-donation-popup') . '</p>';
		echo '</td></tr></tbody></table>';

		echo '<p class="submit">';
		submit_button(__('Meta ayarlarını kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array( 'id' => 'wdp-save-meta-tracking-settings' ));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';
	}

	/**
	 * One checkbox row.
	 *
	 * @param string      $name        Input name.
	 * @param string      $label       Label.
	 * @param bool        $checked     Checked.
	 * @param string|null $description Optional help under the control.
	 * @return void
	 */
	private static function row_toggle($name, $label, $checked, $description = null) {
		echo '<table class="form-table" role="presentation"><tbody><tr>';
		echo '<th scope="row">' . esc_html($label) . '</th><td>';
		echo '<label><input type="checkbox" name="' . esc_attr($name) . '" value="1"' . checked($checked, true, false) . ' /> ';
		echo esc_html__('Etkin', 'woo-donation-popup') . '</label>';
		if (null !== $description && '' !== $description) {
			echo '<p class="description">' . esc_html($description) . '</p>';
		}
		echo '</td></tr></tbody></table>';
	}
}
