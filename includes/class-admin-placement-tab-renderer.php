<?php
/**
 * Ayarlar → Ürün sayfası ve liste sekmesi: kapsam, WooCommerce sayfaları, schema ve kurulum rehberi.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders and (via AJAX) saves wdp_placement_settings.
 */
class WDP_Admin_Placement_Tab_Renderer {

	/**
	 * @return void
	 */
	public static function render_tab() {
		$s     = WDP_Placement_Settings::get();
		$count = class_exists('WDP_Donation_Scope') ? WDP_Donation_Scope::count() : 0;
		$cats  = self::product_categories();
		$rank  = defined('RANK_MATH_VERSION') || class_exists('RankMath');
		$matrix = wp_nonce_url(home_url('/?wdp_form_matrix=1'), 'wdp_form_matrix', 'wdp_matrix_nonce');

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Ürün sayfası ve liste', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list">';
		echo '<li>' . esc_html__('Hangi ürünlerin bağış ürünü sayılacağını ve WooCommerce mağaza / ürün sayfalarında “Bağış Yap” davranışını buradan yönetirsiniz.', 'woo-donation-popup') . '</li>';
		echo '</ul></div>';

		echo '<form id="wdp-placement-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_placement_settings">';

		echo '<h2 class="wdp-section-title">' . esc_html__('Bağış ürünleri', 'woo-donation-popup') . '</h2>';
		echo '<p class="description">' . esc_html(sprintf(
			/* translators: %d: live count */
			__('Şu an %d ürün bağış ürünü.', 'woo-donation-popup'),
			$count
		)) . '</p>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'donation_scope',
			$s['donation_scope'],
			__('Kapsam', 'woo-donation-popup'),
			__('Hangi basit ürünlerin bağış formu kullandığı.', 'woo-donation-popup'),
			array(
				'all'        => __('Tüm basit ürünler', 'woo-donation-popup'),
				'categories' => __('Seçili kategoriler (alt kategoriler dahil)', 'woo-donation-popup'),
				'marked'     => __('Yalnızca işaretli ürünler', 'woo-donation-popup'),
			)
		);
		echo '<tr><th scope="row"><label for="wdp_donation_categories">' . esc_html__('Kategoriler', 'woo-donation-popup') . '</label></th><td>';
		echo '<select id="wdp_donation_categories" name="donation_categories[]" multiple size="6" style="min-width:240px">';
		foreach ($cats as $id => $name) {
			echo '<option value="' . esc_attr((string) $id) . '"' . selected(in_array((int) $id, (array) $s['donation_categories'], true), true, false) . '>' . esc_html($name) . '</option>';
		}
		echo '</select>';
		echo '<p class="description">' . esc_html__('Kapsam “seçili kategoriler” iken kullanılır. Alt kategoriler otomatik dahildir.', 'woo-donation-popup') . '</p>';
		echo '</td></tr>';
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__('WooCommerce sayfaları', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'auto_place',
			$s['auto_place'],
			__('WooCommerce sayfalarında “Sepete Ekle” yerine “Bağış Yap”', 'woo-donation-popup'),
			__('Açıkken mağaza ve ürün sayfalarındaki sepete ekle alanı bağış butonu veya formuna dönüşür.', 'woo-donation-popup'),
			array(
				'yes' => __('Açık', 'woo-donation-popup'),
				'no'  => __('Kapalı', 'woo-donation-popup'),
			)
		);
		self::select_row(
			'display',
			$s['display'],
			__('Ürün sayfasında gösterim', 'woo-donation-popup'),
			'',
			array(
				'inline'       => __('Sayfa içi form', 'woo-donation-popup'),
				'button_popup' => __('Buton + ortada açılan', 'woo-donation-popup'),
				'button_panel' => __('Buton + sağ panel', 'woo-donation-popup'),
			)
		);
		self::select_row(
			'loop_button',
			$s['loop_button'],
			__('Mağaza ve kategori sayfalarında buton', 'woo-donation-popup'),
			'',
			array(
				'link'  => __('Ürün sayfasına git', 'woo-donation-popup'),
				'popup' => __('Ortada açılan', 'woo-donation-popup'),
				'panel' => __('Sağ panel', 'woo-donation-popup'),
			)
		);
		self::select_row(
			'hide_price',
			$s['hide_price'],
			__('Fiyat gösterimi', 'woo-donation-popup'),
			__('Sepet, ödeme ve e-postalardaki fiyatlar değişmez.', 'woo-donation-popup'),
			array(
				'yes' => __('Sabit ve hisseli üründe göster, diğerlerinde gizle', 'woo-donation-popup'),
				'no'  => __('Her zaman göster', 'woo-donation-popup'),
			)
		);
		self::select_row(
			'show_form_title',
			$s['show_form_title'],
			__('Form başlığını göster', 'woo-donation-popup'),
			__('Ürün sayfasında zaten başlık olduğu için varsayılan kapalıdır.', 'woo-donation-popup'),
			array(
				'yes' => __('Evet', 'woo-donation-popup'),
				'no'  => __('Hayır', 'woo-donation-popup'),
			)
		);
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__('Yapılandırılmış veri (schema)', 'woo-donation-popup') . '</h2>';
		if ($rank) {
			echo '<p class="description">' . esc_html__('Rank Math algılandı, uyum açık.', 'woo-donation-popup') . '</p>';
		}
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'schema',
			$s['schema'],
			__('Product işaretlemesi', 'woo-donation-popup'),
			__('Otomatik: fiyatı olmayan bağışçı-belirler ve kampanya ürünlerinde Product markup basılmaz. Yoast / SEOPress / AIOSEO için wdp_product_schema filtresi sunulur.', 'woo-donation-popup'),
			array(
				'auto' => __('Otomatik', 'woo-donation-popup'),
				'off'  => __('Kapalı', 'woo-donation-popup'),
			)
		);
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__('Kurulum rehberi', 'woo-donation-popup') . '</h2>';
		echo '<ol class="wdp-tab-help__list">';
		echo '<li><strong>' . esc_html__('WooCommerce sayfalarını kullanıyorum', 'woo-donation-popup') . '</strong><br>';
		echo esc_html__('Yukarıdaki ayarı Açık bırakın. Başka bir şey yapmanız gerekmez; Mağaza sayfası ve ürün sayfaları otomatik olarak bağış sayfasına dönüşür.', 'woo-donation-popup');
		echo '</li>';
		echo '<li><strong>' . esc_html__('Ürün sayfam özel tasarım (Avada Layout, Elementor Pro şablonu)', 'woo-donation-popup') . '</strong><br>';
		echo esc_html__('Şablonda WooCommerce’in Sepete Ekle elemanı varsa otomatik olarak Bağış Yap’a dönüşür. Yoksa şablona bir kez şu kısa kodu ekleyin:', 'woo-donation-popup');
		echo ' ';
		self::copy_inline('[wdp_donation_button_panel]');
		echo '<br>' . esc_html__('Avada: Layouts → ürün layout’u → Code Block → yapıştır → Save.', 'woo-donation-popup');
		echo '</li>';
		echo '<li><strong>' . esc_html__('Kendi bağış sayfamı yapıyorum', 'woo-donation-popup') . '</strong><br>';
		echo esc_html__('Liste için:', 'woo-donation-popup') . ' ';
		self::copy_inline('[wdp_donations]');
		echo ' ' . esc_html__('(Elementor’da “Bağış Listesi” widget’ı, Gutenberg’de “Bağış listesi” bloğu). Tek ürün için:', 'woo-donation-popup') . ' ';
		self::copy_inline('[wdp_donation_button_panel slug="urun-kisa-adi"]');
		echo '</li>';
		echo '</ol>';
		echo '<p><a class="button" href="' . esc_url($matrix) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Form test sayfasını aç', 'woo-donation-popup') . '</a></p>';

		echo '<p class="submit">';
		submit_button(__('Yerleşim ayarlarını kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-placement-settings'));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';
	}

	/**
	 * @param string               $key     Field.
	 * @param string               $value   Value.
	 * @param string               $label   Label.
	 * @param string               $help    Description.
	 * @param array<string,string> $options Options.
	 * @return void
	 */
	private static function select_row($key, $value, $label, $help, array $options) {
		echo '<tr><th scope="row"><label for="wdp_' . esc_attr($key) . '">' . esc_html($label) . '</label></th><td>';
		echo '<select name="' . esc_attr($key) . '" id="wdp_' . esc_attr($key) . '">';
		foreach ($options as $opt => $text) {
			echo '<option value="' . esc_attr($opt) . '"' . selected($value, $opt, false) . '>' . esc_html($text) . '</option>';
		}
		echo '</select>';
		if ($help !== '') {
			echo '<p class="description">' . esc_html($help) . '</p>';
		}
		echo '</td></tr>';
	}

	/**
	 * @param string $code Shortcode.
	 * @return void
	 */
	private static function copy_inline($code) {
		echo '<code>' . esc_html($code) . '</code> ';
		echo '<button type="button" class="button button-small" data-wdp-copy="' . esc_attr($code) . '">' . esc_html__('Kopyala', 'woo-donation-popup') . '</button>';
	}

	/**
	 * @return array<int, string>
	 */
	private static function product_categories() {
		if (!function_exists('get_terms')) {
			return array();
		}
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
			)
		);
		if (is_wp_error($terms) || !is_array($terms)) {
			return array();
		}
		$out = array();
		foreach ($terms as $term) {
			$out[ (int) $term->term_id ] = $term->name;
		}
		return $out;
	}
}
