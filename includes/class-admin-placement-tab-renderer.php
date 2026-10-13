<?php
/**
 * Ayarlar → Ürün sayfası ve liste sekmesi: kapsam, yerleşim, döngü, schema ve kurulum örnekleri.
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
		echo '<li>' . esc_html__('Hangi ürünlerin bağış ürünü sayılacağını, ürün sayfasına formun nasıl yerleşeceğini ve mağaza döngüsündeki butonu buradan yönetirsiniz.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Avada Layout gibi WooCommerce kancalarını çalıştırmayan şablonlarda otomatik yerleşim devreye girmez; şablona bir kez kimliksiz kısa kod ekleyin.', 'woo-donation-popup') . '</li>';
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

		echo '<h2 class="wdp-section-title">' . esc_html__('Ürün sayfası', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row('auto_place', $s['auto_place'], __('Otomatik yerleşim', 'woo-donation-popup'), __('Klasik WooCommerce şablonlarında sepete ekle alanının yerine (veya yanına) formu basar.', 'woo-donation-popup'), array('yes' => __('Açık', 'woo-donation-popup'), 'no' => __('Kapalı', 'woo-donation-popup')));
		self::select_row(
			'position',
			$s['position'],
			__('Konum', 'woo-donation-popup'),
			'',
			array(
				'replace_cart'  => __('Sepete ekle yerine', 'woo-donation-popup'),
				'after_excerpt' => __('Kısa açıklamadan sonra', 'woo-donation-popup'),
				'below_summary' => __('Özetin altında', 'woo-donation-popup'),
			)
		);
		self::select_row(
			'display',
			$s['display'],
			__('Görünüm', 'woo-donation-popup'),
			'',
			array(
				'inline'        => __('Sayfa içi form', 'woo-donation-popup'),
				'button_popup'  => __('Buton + ortada pencere', 'woo-donation-popup'),
				'button_panel'  => __('Buton + sağ panel', 'woo-donation-popup'),
			)
		);
		self::select_row('hide_price', $s['hide_price'], __('Fiyatı gizle', 'woo-donation-popup'), __('Yalnızca tekil ürün özeti ve döngü. Sepet, ödeme ve e-posta fiyatları değişmez.', 'woo-donation-popup'), array('yes' => __('Evet', 'woo-donation-popup'), 'no' => __('Hayır', 'woo-donation-popup')));
		self::select_row('show_form_title', $s['show_form_title'], __('Form başlığını göster', 'woo-donation-popup'), __('Ürün sayfasında zaten H1 olduğu için varsayılan kapalıdır.', 'woo-donation-popup'), array('yes' => __('Evet', 'woo-donation-popup'), 'no' => __('Hayır', 'woo-donation-popup')));
		echo '</tbody></table>';

		echo '<h2 class="wdp-section-title">' . esc_html__('Mağaza ve kategori sayfaları', 'woo-donation-popup') . '</h2>';
		echo '<table class="form-table" role="presentation"><tbody>';
		self::select_row(
			'loop_button',
			$s['loop_button'],
			__('Döngü butonu', 'woo-donation-popup'),
			__('Mağaza, kategori ve ilgili ürün kartlarındaki sepete ekle bağlantısı.', 'woo-donation-popup'),
			array(
				'link'  => __('Ürün sayfasına git', 'woo-donation-popup'),
				'popup' => __('Ortada pencere', 'woo-donation-popup'),
				'panel' => __('Sağ panel', 'woo-donation-popup'),
				'off'   => __('Dokunma', 'woo-donation-popup'),
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
		echo '<ul class="wdp-tab-help__list">';
		self::copy_row('[wdp_donations]');
		self::copy_row('[wdp_donations categories="kurban" columns="3" button="panel"]');
		self::copy_row('[wdp_donation_form]');
		self::copy_row('[wdp_donation_button_panel]');
		echo '</ul>';
		echo '<p>' . esc_html__('Avada Layout: tekil ürün şablonundaki Code Block’a kimliksiz [wdp_donation_form] veya [wdp_donation_button_panel] yapıştırın.', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Elementor: Bağış (WooCommerce Donation) kategorisindeki widget’ı ekleyin. Gutenberg: Bağış formu veya Bağış listesi bloğu.', 'woo-donation-popup') . '</p>';
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
	private static function copy_row($code) {
		echo '<li><code>' . esc_html($code) . '</code> ';
		echo '<button type="button" class="button button-small" data-wdp-copy="' . esc_attr($code) . '">' . esc_html__('Kopyala', 'woo-donation-popup') . '</button></li>';
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
