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

		self::render_setup_guide($s, $matrix);

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
	 * FAZ 7.1 kurulum rehberi: önerilen yöntem, kartlar, durum.
	 *
	 * @param array  $s      Placement settings.
	 * @param string $matrix Form test URL.
	 * @return void
	 */
	private static function render_setup_guide(array $s, $matrix) {
		$ctx = class_exists('WDP_Builder_Detect')
			? WDP_Builder_Detect::detect_site_context()
			: array(
				'type'        => 'classic',
				'recommended' => 'auto',
				'reason'      => '',
				'label'       => __('Klasik tema', 'woo-donation-popup'),
			);

		$auto_on = isset($s['auto_place']) && (string) $s['auto_place'] === 'yes';
		$donation_count = 0;
		$manual_shortcode_count = 0;
		if (function_exists('wc_get_products')) {
			$products = wc_get_products(
				array(
					'status' => 'publish',
					'limit'  => 200,
					'return' => 'ids',
					'type'   => class_exists('WDP_Donation_Scope') ? WDP_Donation_Scope::supported_types() : array('simple'),
				)
			);
			if (is_array($products)) {
				foreach ($products as $pid) {
					$pid = absint($pid);
					if ($pid <= 0) {
						continue;
					}
					if (class_exists('WDP_Donation_Scope') && !WDP_Donation_Scope::is_donation_product($pid)) {
						continue;
					}
					$donation_count++;
					$excerpt = (string) get_post_field('post_excerpt', $pid);
					if (strpos($excerpt, '[wdp_') !== false) {
						$manual_shortcode_count++;
					}
				}
			}
		}

		echo '<h2 class="wdp-section-title">' . esc_html__('Kurulum rehberi', 'woo-donation-popup') . '</h2>';

		echo '<div class="wdp-setup-recommend notice notice-info" style="padding:12px 16px;margin:0 0 16px">';
		echo '<p style="margin:0 0 6px"><strong>' . esc_html__('Sitenizde önerilen yöntem', 'woo-donation-popup') . '</strong> ';
		echo '<span class="wdp-badge" style="display:inline-block;padding:2px 8px;border-radius:6px;background:#e8f1fa;color:#1d5fa8;font-size:12px">' . esc_html($ctx['label']) . '</span></p>';
		echo '<p style="margin:0">' . esc_html($ctx['reason']) . '</p>';
		echo '</div>';

		$methods = array(
			'auto' => array(
				'title' => __('Otomatik yerleşim', 'woo-donation-popup'),
				'when'  => __('Klasik veya blok temada ekstra şablon düzenlemeden form eklemek için.', 'woo-donation-popup'),
				'steps' => array(
					__('Yukarıdaki «Otomatik yerleştir» seçeneğini açın.', 'woo-donation-popup'),
					__('Konum ve görünüm (sayfa içi / modal / panel) seçin.', 'woo-donation-popup'),
					__('Kaydet’e basın ve bir bağış ürün sayfasını kontrol edin.', 'woo-donation-popup'),
				),
				'code'  => '',
			),
			'template_shortcode' => array(
				'title' => __('Ürün şablonuna tek kısa kod', 'woo-donation-popup'),
				'when'  => __('Avada Layout veya Elementor ürün şablonu kullandığınızda.', 'woo-donation-popup'),
				'steps' => ($ctx['type'] === 'avada')
					? array(
						__('Avada → Layouts menüsüne gidin.', 'woo-donation-popup'),
						__('Ürün (product) layout’unu açın.', 'woo-donation-popup'),
						__('Code Block ekleyip aşağıdaki kısa kodu yapıştırın.', 'woo-donation-popup'),
						__('Save ile kaydedin.', 'woo-donation-popup'),
					)
					: array(
						__('Elementor → Theme Builder → Single Product şablonunu açın.', 'woo-donation-popup'),
						__('Bağış (WooCommerce Donation) kategorisinden widget ekleyin.', 'woo-donation-popup'),
						__('Gutenberg kullanıyorsanız «Bağış formu» bloğunu ekleyin.', 'woo-donation-popup'),
						__('Şablonu yayınlayın.', 'woo-donation-popup'),
					),
				'code'  => '[wdp_donation_form]',
			),
			'per_product' => array(
				'title' => __('Ürün başına kısa kod (yalnızca istisnalar)', 'woo-donation-popup'),
				'when'  => __('Sadece birkaç ürünün farklı görünmesi gerektiğinde.', 'woo-donation-popup'),
				'steps' => array(
					__('Ürünler sekmesinden ürünü düzenleyin.', 'woo-donation-popup'),
					__('Kısa açıklamaya veya içeriğe kısa kodu yapıştırın.', 'woo-donation-popup'),
					__('Genel yerleşimi bu ürünler için kapalı tutun.', 'woo-donation-popup'),
				),
				'code'  => '[wdp_donation_button id="123"]',
			),
		);

		echo '<div class="wdp-setup-methods" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:0 0 20px">';
		foreach ($methods as $key => $method) {
			$is_rec = ($ctx['recommended'] === $key) || ($key === 'template_shortcode' && $ctx['recommended'] === 'template_shortcode');
			echo '<div class="wdp-setup-card" style="border:1px solid ' . ($is_rec ? '#1d5fa8' : '#d7dde5') . ';border-radius:10px;padding:16px;background:#fff">';
			if ($is_rec) {
				echo '<p style="margin:0 0 8px"><span class="wdp-badge" style="background:#1d5fa8;color:#fff;padding:2px 8px;border-radius:6px;font-size:12px">' . esc_html__('Önerilen', 'woo-donation-popup') . '</span></p>';
			}
			echo '<h3 style="margin:0 0 8px;font-size:15px">' . esc_html($method['title']) . '</h3>';
			echo '<p class="description" style="margin:0 0 10px">' . esc_html($method['when']) . '</p>';
			echo '<ol style="margin:0 0 12px;padding-left:18px">';
			foreach ($method['steps'] as $step) {
				echo '<li>' . esc_html($step) . '</li>';
			}
			echo '</ol>';
			if ($method['code'] !== '') {
				self::copy_row($method['code']);
			}
			if ($key === 'auto') {
				echo '<p><a href="#wdp_auto_place">' . esc_html__('Otomatik yerleşim ayarına git', 'woo-donation-popup') . '</a></p>';
			}
			echo '</div>';
		}
		echo '</div>';

		echo '<div class="wdp-setup-card" style="border:1px solid #d7dde5;border-radius:10px;padding:16px;margin:0 0 16px">';
		echo '<h3 style="margin:0 0 8px">' . esc_html__('Bağışlar sayfası', 'woo-donation-popup') . '</h3>';
		echo '<p class="description">' . esc_html__('Tüm bağış ürünlerini listelemek için bir sayfaya şu kısa kodu ekleyin. Elementor’da «Bağış Listesi» widget’ı, Gutenberg’de «Bağış listesi» bloğu da kullanılabilir.', 'woo-donation-popup') . '</p>';
		echo '<ul class="wdp-tab-help__list">';
		self::copy_row('[wdp_donations]');
		self::copy_row('[wdp_donations categories="kurban" columns="3"]');
		self::copy_row('[wdp_donations button="panel"]');
		self::copy_row('[wdp_donations limit="12" orderby="title"]');
		echo '</ul></div>';

		echo '<div class="wdp-setup-status" style="display:grid;gap:8px;margin:0 0 16px">';
		self::status_row($auto_on, $auto_on ? __('Otomatik yerleşim açık', 'woo-donation-popup') : __('Otomatik yerleşim kapalı', 'woo-donation-popup'));
		/* translators: %d: product count */
		self::status_row($manual_shortcode_count === 0, sprintf(__('Kısa açıklamasında elle eklenmiş kod olan %d ürün var', 'woo-donation-popup'), $manual_shortcode_count), $manual_shortcode_count > 0 ? admin_url('admin.php?page=wdp-popup-settings#products') : '');
		/* translators: %d: donation product count */
		self::status_row($donation_count > 0, sprintf(__('Bağış ürünü sayısı: %d', 'woo-donation-popup'), $donation_count));
		echo '</div>';

		if ($matrix !== '') {
			echo '<p><a class="button" href="' . esc_url($matrix) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Form test sayfasını aç', 'woo-donation-popup') . '</a></p>';
		}
	}

	/**
	 * @param bool   $ok   Green when true, yellow when false.
	 * @param string $text Label.
	 * @param string $link Optional link.
	 * @return void
	 */
	private static function status_row($ok, $text, $link = '') {
		$color = $ok ? '#15803d' : '#a16207';
		$bg    = $ok ? '#ecfdf3' : '#fffbeb';
		echo '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:' . esc_attr($bg) . ';color:' . esc_attr($color) . '">';
		echo '<span aria-hidden="true">' . ($ok ? '●' : '●') . '</span> ';
		echo '<span>' . esc_html($text) . '</span>';
		if ($link !== '') {
			echo ' <a href="' . esc_url($link) . '">' . esc_html__('Ürünler', 'woo-donation-popup') . '</a>';
		}
		echo '</div>';
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
