<?php
/**
 * Bağış Popup Ayarları sayfa kabuğu, sekme navigasyonu ve ürünler sekmesi.
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
	 * @param callable $render_meta_tab           Meta Pixel tab renderer.
	 * @param callable $render_category_colors_tab Category title colors tab renderer.
	 * @param callable $render_design_studio_tab   Design studio tab renderer.
	 * @return void
	 */
	public static function render_settings_page($products, $render_product_row, $render_modal_layout_tab, $render_normal_form_tab, $render_shareholder_tab, $render_progress_bar_tab, $render_success_screen_tab, $render_meta_tab, $render_category_colors_tab, $render_design_studio_tab = null) {
		echo '<div class="wrap wdp-admin-wrap">';
		echo '<header class="wdp-admin-hero">';
		echo '<div class="wdp-admin-hero__accent" aria-hidden="true"></div>';
		echo '<div class="wdp-admin-title-row">';
		echo '<div class="wdp-admin-hero__copy">';
		echo '<p class="wdp-admin-eyebrow">' . esc_html__('Donation Popup', 'woo-donation-popup') . '</p>';
		echo '<h1 class="wdp-admin-title">' . esc_html__('Bağış Popup Ayarları', 'woo-donation-popup') . '</h1>';
		echo '<p class="wdp-admin-subtitle">' . esc_html__('Ürün davranışını, form görünümünü ve başarı ekranını tek yerden yönetin — değişiklikler canlı önizlemede anında görünür.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		if (defined('WDP_VERSION')) {
			echo '<span class="wdp-admin-version" title="' . esc_attr__('Eklenti sürümü', 'woo-donation-popup') . '">';
			echo esc_html(sprintf(__('v%s', 'woo-donation-popup'), WDP_VERSION));
			echo '</span>';
		}
		echo '</div>';
		echo '</header>';

		echo '<div id="wdp-admin-notices" class="wdp-admin-notice notice" style="display:none;" role="status" aria-live="polite"></div>';
		echo '<div class="wdp-admin-shell">';
		echo '<nav class="nav-tab-wrapper wdp-nav-tab-wrapper" role="tablist" aria-label="' . esc_attr__('Bağış popup ayar sekmeleri', 'woo-donation-popup') . '">';
		echo '<div class="wdp-nav-group" data-group="setup"><span class="wdp-nav-group__label">' . esc_html__('Kurulum', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-products" href="#products" class="nav-tab nav-tab-active" data-tab="products" role="tab" aria-controls="wdp-products-tab" aria-selected="true" tabindex="0">' . esc_html__('Ürünler', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-design-studio" href="#design-studio" class="nav-tab" data-tab="design-studio" role="tab" aria-controls="wdp-design-studio-tab" aria-selected="false" tabindex="-1">' . esc_html__('Tasarım', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="forms"><span class="wdp-nav-group__label">' . esc_html__('Formlar', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-modal-layout" href="#modal-layout" class="nav-tab" data-tab="modal-layout" role="tab" aria-controls="wdp-modal-layout-tab" aria-selected="false" tabindex="-1">' . esc_html__('Modal', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-normal-form" href="#normal-form" class="nav-tab" data-tab="normal-form" role="tab" aria-controls="wdp-normal-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Normal', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-shareholder-form" href="#shareholder-form" class="nav-tab" data-tab="shareholder-form" role="tab" aria-controls="wdp-shareholder-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Hisseli', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-progress-bar" href="#progress-bar" class="nav-tab" data-tab="progress-bar" role="tab" aria-controls="wdp-progress-bar-tab" aria-selected="false" tabindex="-1">' . esc_html__('Progress', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-success-screen" href="#success-screen" class="nav-tab" data-tab="success-screen" role="tab" aria-controls="wdp-success-screen-tab" aria-selected="false" tabindex="-1">' . esc_html__('Başarı', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="integrations"><span class="wdp-nav-group__label">' . esc_html__('Ek', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-meta" href="#meta" class="nav-tab" data-tab="meta" role="tab" aria-controls="wdp-meta-tab" aria-selected="false" tabindex="-1">' . esc_html__('Meta Pixel', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-category-colors" href="#category-colors" class="nav-tab" data-tab="category-colors" role="tab" aria-controls="wdp-category-colors-tab" aria-selected="false" tabindex="-1">' . esc_html__('Kategoriler', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-advanced" href="#advanced" class="nav-tab" data-tab="advanced" role="tab" aria-controls="wdp-advanced-tab" aria-selected="false" tabindex="-1">' . esc_html__('Gelişmiş', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '</nav>';

		self::render_products_tab($products, $render_product_row);

		echo '<div id="wdp-design-studio-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-design-studio">';
		if (is_callable($render_design_studio_tab)) {
			call_user_func($render_design_studio_tab);
		} elseif (class_exists('WDP_Admin_Design_Studio_Renderer')) {
			WDP_Admin_Design_Studio_Renderer::render_tab();
		}
		echo '</div>';

		echo '<div id="wdp-modal-layout-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-modal-layout">';
		call_user_func($render_modal_layout_tab);
		echo '</div>';

		echo '<div id="wdp-normal-form-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-normal-form">';
		call_user_func($render_normal_form_tab);
		echo '</div>';

		echo '<div id="wdp-shareholder-form-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-shareholder-form">';
		call_user_func($render_shareholder_tab);
		echo '</div>';

		echo '<div id="wdp-progress-bar-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-progress-bar">';
		call_user_func($render_progress_bar_tab);
		echo '</div>';

		echo '<div id="wdp-success-screen-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-success-screen">';
		call_user_func($render_success_screen_tab);
		echo '</div>';

		echo '<div id="wdp-meta-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-meta">';
		call_user_func($render_meta_tab);
		echo '</div>';

		echo '<div id="wdp-category-colors-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-category-colors">';
		call_user_func($render_category_colors_tab);
		echo '</div>';

		echo '<div id="wdp-advanced-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-advanced">';
		self::render_advanced_tab();
		echo '</div>';

		echo '</div>';
		echo '</div>';
	}

	/**
	 * Advanced tab: data retention on uninstall.
	 *
	 * @return void
	 */
	private static function render_advanced_tab() {
		$delete_on_uninstall = '1' === (string) get_option('wdp_delete_data_on_uninstall', '0');

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note">';
		echo '<p class="wdp-tab-help__title">' . esc_html__('Veri ve kaldırma', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Kişisel veri dışa aktarma ve silme talepleri (Araçlar → Kişisel verileri dışa aktar / sil) siparişlerdeki bağışçı ve hissedar alanlarını kapsar; silmede değerler “[deleted]” ile anonimleştirilir.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		echo '<form id="wdp-advanced-settings-form" class="wdp-admin-settings-form" method="post">';
		echo '<table class="form-table" role="presentation"><tbody><tr>';
		echo '<th scope="row">' . esc_html__('Eklenti kaldırılınca tüm verilerini sil', 'woo-donation-popup') . '</th><td>';
		echo '<label><input type="checkbox" name="delete_data_on_uninstall" value="1"' . checked($delete_on_uninstall, true, false) . ' /> ';
		echo esc_html__('Etkin', 'woo-donation-popup') . '</label>';
		echo '<p class="description">' . esc_html__('Açıksa eklenti silindiğinde wdp_ ile başlayan ayarlar, geçici veriler (transient) ve ürün meta verileri kaldırılır. Siparişlerdeki bağış verilerine dokunulmaz. Varsayılan: kapalı.', 'woo-donation-popup') . '</p>';
		echo '</td></tr></tbody></table>';

		echo '<p class="submit">';
		submit_button(__('Gelişmiş ayarları kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-advanced-settings'));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
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
		echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active" role="tabpanel" aria-hidden="false" aria-labelledby="wdp-tab-products">';
		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-products-toolbar"><div class="wdp-products-search"><span class="dashicons dashicons-search" aria-hidden="true"></span><input type="search" id="wdp-product-search" placeholder="' . esc_attr__('Ürün ara...', 'woo-donation-popup') . '" /></div></div>';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list"><li>' . esc_html__('Her ürün için aynı anda yalnızca bir form modu seçilir: Çoklu Hisse, Özel Fiyat veya Progress Bar — biri açıkken diğerleri kapanır.', 'woo-donation-popup') . '</li><li>' . esc_html__('Buton shortcode ortada popup, Sağ Panel shortcode sağdan panel, Form shortcode sayfa içi form açar — hangisini nereye yapıştırırsanız o çalışır.', 'woo-donation-popup') . '</li><li>' . esc_html__('Kaydet tek kart için; Tüm Değişiklikleri Kaydet tüm ürünleri sırayla yazar.', 'woo-donation-popup') . '</li></ul></div>';

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
