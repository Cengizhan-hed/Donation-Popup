<?php
/**
 * Admin page renderer.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders admin settings page shell and product tab.
 */
class WDP_Admin_Page_Renderer {
	/**
	 * Render full settings page.
	 *
	 * @param array    $products                 Products.
	 * @param callable $render_product_row       Product row renderer.
	 * @param callable $render_modal_layout_tab  Modal layout tab renderer.
	 * @param callable $render_normal_form_tab   Normal form tab renderer.
	 * @param callable $render_shareholder_tab   Shareholder tab renderer.
	 * @param callable $render_progress_bar_tab  Progress bar tab renderer.
	 * @param callable $render_success_screen_tab Success tab renderer.
	 * @return void
	 */
	public static function render_settings_page($products, $render_product_row, $render_modal_layout_tab, $render_normal_form_tab, $render_shareholder_tab, $render_progress_bar_tab, $render_success_screen_tab) {
		echo '<div class="wrap wdp-admin-wrap">';
		echo '<div class="wdp-admin-title-row">';
		echo '<h1 class="wdp-admin-title">' . esc_html__('Bağış Popup Ayarları', 'woo-donation-popup') . '</h1>';
		if (defined('WDP_VERSION')) {
			echo '<span class="wdp-admin-version" title="' . esc_attr__('Eklenti sürümü', 'woo-donation-popup') . '">';
			echo esc_html(sprintf(__('Sürüm %s', 'woo-donation-popup'), WDP_VERSION));
			echo '</span>';
		}
		echo '</div>';
		echo '<p class="wdp-admin-subtitle">' . esc_html__('Bağış popup akışını tek ekrandan yönetin: ürün bazlı davranış, form görünümleri ve başarı ekranı ayarları.', 'woo-donation-popup') . '</p>';

		echo '<div id="wdp-admin-notices" class="wdp-admin-notice notice" style="display:none;" role="status" aria-live="polite"></div>';
		echo '<div class="wdp-admin-shell">';
		echo '<nav class="nav-tab-wrapper wdp-nav-tab-wrapper" role="tablist" aria-label="' . esc_attr__('Bağış popup ayar sekmeleri', 'woo-donation-popup') . '">';
		echo '<a id="wdp-tab-products" href="#products" class="nav-tab nav-tab-active" data-tab="products" role="tab" aria-controls="wdp-products-tab" aria-selected="true" tabindex="0">' . esc_html__('Ürün Ayarları', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-modal-layout" href="#modal-layout" class="nav-tab" data-tab="modal-layout" role="tab" aria-controls="wdp-modal-layout-tab" aria-selected="false" tabindex="-1">' . esc_html__('Modal & Form Görünümü', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-normal-form" href="#normal-form" class="nav-tab" data-tab="normal-form" role="tab" aria-controls="wdp-normal-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Normal Form', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-shareholder-form" href="#shareholder-form" class="nav-tab" data-tab="shareholder-form" role="tab" aria-controls="wdp-shareholder-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Hisseli Form', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-progress-bar" href="#progress-bar" class="nav-tab" data-tab="progress-bar" role="tab" aria-controls="wdp-progress-bar-tab" aria-selected="false" tabindex="-1">' . esc_html__('Progress Bar Form', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-success-screen" href="#success-screen" class="nav-tab" data-tab="success-screen" role="tab" aria-controls="wdp-success-screen-tab" aria-selected="false" tabindex="-1">' . esc_html__('Başarı & Mini Sepet', 'woo-donation-popup') . '</a>';
		echo '</nav>';

		self::render_products_tab($products, $render_product_row);

		echo '<div id="wdp-modal-layout-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true">';
		call_user_func($render_modal_layout_tab);
		echo '</div>';

		echo '<div id="wdp-normal-form-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true">';
		call_user_func($render_normal_form_tab);
		echo '</div>';

		echo '<div id="wdp-shareholder-form-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true">';
		call_user_func($render_shareholder_tab);
		echo '</div>';

		echo '<div id="wdp-progress-bar-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true">';
		call_user_func($render_progress_bar_tab);
		echo '</div>';

		echo '<div id="wdp-success-screen-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true">';
		call_user_func($render_success_screen_tab);
		echo '</div>';

		echo '</div>';
		echo '</div>';
	}

	/**
	 * Render products tab body.
	 *
	 * @param array    $products           Products.
	 * @param callable $render_product_row Product row renderer.
	 * @return void
	 */
	private static function render_products_tab($products, $render_product_row) {
		echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active" role="tabpanel" aria-hidden="false">';
		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-products-toolbar"><div class="wdp-products-search"><span class="dashicons dashicons-search" aria-hidden="true"></span><input type="search" id="wdp-product-search" placeholder="' . esc_attr__('Ürün ara...', 'woo-donation-popup') . '" /></div></div>';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Her ürün için aynı anda yalnızca bir form modu seçilir: Çoklu Hisse, Özel Fiyat veya Progress Bar — biri açıkken diğerleri kapanır.', 'woo-donation-popup') . '</li><li>' . esc_html__('Buton ve Form shortcode’larını sayfaya veya bileşene yapıştırarak o ürünün popup’ını gösterirsiniz.', 'woo-donation-popup') . '</li><li>' . esc_html__('Kaydet tek kart için; Tüm Değişiklikleri Kaydet tüm ürünleri sırayla yazar.', 'woo-donation-popup') . '</li></ul></div>';

		if (empty($products)) {
			echo '<div class="wdp-products-grid"><div class="wdp-products-empty"><p>' . __('Hiç ürün bulunamadı.', 'woo-donation-popup') . '</p></div></div>';
		} else {
			$products_by_category   = array();
			$uncategorized_products = array();
			foreach ($products as $product) {
				$product_id = $product->get_id();
				$term_ids   = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'ids'));
				if (!is_wp_error($term_ids) && !empty($term_ids)) {
					foreach ($term_ids as $term_id) {
						if (!isset($products_by_category[$term_id])) {
							$products_by_category[$term_id] = array();
						}
						$products_by_category[$term_id][] = $product;
					}
				} else {
					$uncategorized_products[] = $product;
				}
			}

			$categories = get_terms(
				array(
					'taxonomy'   => 'product_cat',
					'hide_empty' => false,
					'orderby'    => 'menu_order',
					'order'      => 'ASC',
				)
			);

			echo '<div class="wdp-products-by-category">';
			if (!is_wp_error($categories) && !empty($categories)) {
				foreach ($categories as $category) {
					$term_id = $category->term_id;
					if (empty($products_by_category[$term_id])) {
						continue;
					}
					$category_products = $products_by_category[$term_id];
					$category_count    = count($category_products);
					echo '<section class="wdp-category-section" data-category-id="' . esc_attr($term_id) . '">';
					echo '<header class="wdp-category-header"><h2 class="wdp-category-title">' . esc_html($category->name) . '</h2><span class="wdp-category-count">' . sprintf(_n('%d ürün', '%d ürün', $category_count, 'woo-donation-popup'), $category_count) . '</span></header>';
					if (!empty($category->description)) {
						echo '<div class="wdp-category-description">' . esc_html($category->description) . '</div>';
					}
					echo '<div class="wdp-products-grid">';
					foreach ($category_products as $product) {
						call_user_func($render_product_row, $product);
					}
					echo '</div></section>';
				}
			}
			if (!empty($uncategorized_products)) {
				$uncategorized_count = count($uncategorized_products);
				echo '<section class="wdp-category-section wdp-category-uncategorized" data-category-id="uncategorized"><header class="wdp-category-header"><h2 class="wdp-category-title">' . esc_html__('Kategorisiz Ürünler', 'woo-donation-popup') . '</h2><span class="wdp-category-count">' . sprintf(_n('%d ürün', '%d ürün', $uncategorized_count, 'woo-donation-popup'), $uncategorized_count) . '</span></header><div class="wdp-products-grid">';
				foreach ($uncategorized_products as $product) {
					call_user_func($render_product_row, $product);
				}
				echo '</div></section>';
			}
			echo '</div>';
		}

		echo '<div class="wdp-bulk-actions"><p class="wdp-bulk-actions__hint">' . esc_html__('Kaydetmediğiniz değişiklikler sayfa yenilenince kaybolur.', 'woo-donation-popup') . '</p><div class="wdp-bulk-actions__buttons"><button type="button" id="wdp-save-all" class="button button-primary button-large wdp-btn-save-all">' . esc_html__('Tüm Değişiklikleri Kaydet', 'woo-donation-popup') . '</button><span class="spinner"></span></div></div>';
		echo '</div></div>';
	}
}
