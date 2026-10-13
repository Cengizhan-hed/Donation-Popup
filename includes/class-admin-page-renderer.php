<?php
/**
 * Bağış Popup Ayarları sayfa kabuğu, sekme navigasyonu ve ürünler sekmesi.
 * Stage 2C: 6 sekme (Ürünler, Yerleşim, Görünüm, Formlar ve metinler, Entegrasyonlar, Gelişmiş).
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
	 * Render full settings page (6 tabs).
	 *
	 * @return void
	 */
	public static function render_settings_page() {
		echo '<div class="wrap wdp-admin-wrap">';
		echo '<header class="wdp-admin-hero">';
		echo '<div class="wdp-admin-hero__accent" aria-hidden="true"></div>';
		echo '<div class="wdp-admin-title-row">';
		echo '<div class="wdp-admin-hero__copy">';
		echo '<p class="wdp-admin-eyebrow">' . esc_html__('Donation Popup', 'woo-donation-popup') . '</p>';
		echo '<h1 class="wdp-admin-title">' . esc_html__('Bağış Popup Ayarları', 'woo-donation-popup') . '</h1>';
		echo '<p class="wdp-admin-subtitle">' . esc_html__('Ürünler, yerleşim, görünüm ve form metinlerini tek yerden yönetin.', 'woo-donation-popup') . '</p>';
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
		echo '<a id="wdp-tab-placement" href="#placement" class="nav-tab" data-tab="placement" role="tab" aria-controls="wdp-placement-tab" aria-selected="false" tabindex="-1">' . esc_html__('Ürün sayfası ve liste', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="design"><span class="wdp-nav-group__label">' . esc_html__('Tasarım', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-appearance" href="#appearance" class="nav-tab" data-tab="appearance" role="tab" aria-controls="wdp-appearance-tab" aria-selected="false" tabindex="-1">' . esc_html__('Görünüm', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-forms-texts" href="#forms-texts" class="nav-tab" data-tab="forms-texts" role="tab" aria-controls="wdp-forms-texts-tab" aria-selected="false" tabindex="-1">' . esc_html__('Formlar ve metinler', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="more"><span class="wdp-nav-group__label">' . esc_html__('Diğer', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-integrations" href="#integrations" class="nav-tab" data-tab="integrations" role="tab" aria-controls="wdp-integrations-tab" aria-selected="false" tabindex="-1">' . esc_html__('Entegrasyonlar', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-advanced" href="#advanced" class="nav-tab" data-tab="advanced" role="tab" aria-controls="wdp-advanced-tab" aria-selected="false" tabindex="-1">' . esc_html__('Gelişmiş', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '</nav>';

		self::render_products_tab();

		echo '<div id="wdp-placement-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-placement">';
		WDP_Admin_Placement_Tab_Renderer::render_tab();
		echo '</div>';

		echo '<div id="wdp-appearance-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-appearance">';
		WDP_Admin_Appearance_Tab_Renderer::render_tab();
		echo '</div>';

		echo '<div id="wdp-forms-texts-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-forms-texts">';
		WDP_Admin_Forms_Texts_Tab_Renderer::render_tab();
		echo '</div>';

		echo '<div id="wdp-integrations-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-integrations">';
		if (class_exists('WDP_Admin_Meta_Tracking_Tab_Renderer')) {
			WDP_Admin_Meta_Tracking_Tab_Renderer::render();
		}
		echo '</div>';

		echo '<div id="wdp-advanced-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-advanced">';
		self::render_advanced_tab();
		echo '</div>';

		echo '</div>';
		echo '</div>';
	}

	/**
	 * Advanced tab: data retention, cache, form test, debug.
	 *
	 * @return void
	 */
	private static function render_advanced_tab() {
		$delete_on_uninstall = '1' === (string) get_option('wdp_delete_data_on_uninstall', '0');
		$debug_log           = '1' === (string) get_option('wdp_debug_log_enabled', '0');
		$matrix              = class_exists('WDP_Form_Matrix') ? WDP_Form_Matrix::admin_url() : '';

		echo '<div class="wdp-settings-container">';
		echo '<div class="wdp-tab-help" role="note">';
		echo '<p class="wdp-tab-help__title">' . esc_html__('Gelişmiş', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Veri saklama, önbellek ve hata ayıklama. Günlük işlemler için diğer sekmeleri kullanın.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		echo '<form id="wdp-advanced-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_advanced_settings">';
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row">' . esc_html__('Eklenti kaldırılınca tüm verilerini sil', 'woo-donation-popup') . '</th><td>';
		echo '<label><input type="checkbox" name="delete_data_on_uninstall" value="1"' . checked($delete_on_uninstall, true, false) . ' /> ';
		echo esc_html__('Etkin', 'woo-donation-popup') . '</label>';
		echo '<p class="description">' . esc_html__('Açıksa eklenti silindiğinde wdp_ ayarları ve ürün meta verileri kaldırılır. Sipariş verisine dokunulmaz.', 'woo-donation-popup') . '</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">' . esc_html__('Hata ayıklama günlüğü', 'woo-donation-popup') . '</th><td>';
		echo '<label><input type="checkbox" name="debug_log_enabled" value="1"' . checked($debug_log, true, false) . ' /> ';
		echo esc_html__('Etkin', 'woo-donation-popup') . '</label></td></tr>';
		echo '</tbody></table>';

		if ($matrix !== '') {
			echo '<p><a class="button" href="' . esc_url($matrix) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Form test sayfasını aç', 'woo-donation-popup') . '</a></p>';
		}
		echo '<p><button type="button" class="button" id="wdp-clear-asset-cache">' . esc_html__('Önbelleği temizle', 'woo-donation-popup') . '</button> ';
		echo '<button type="button" class="button" id="wdp-recalc-progress">' . esc_html__('İlerleme toplamlarını yeniden hesapla', 'woo-donation-popup') . '</button></p>';

		echo '<p class="submit">';
		submit_button(__('Kaydet', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-advanced-settings'));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';
		echo '</div>';
	}

	/**
	 * Render products tab body.
	 *
	 * @return void
	 */
	private static function render_products_tab() {
		$table = new WDP_Admin_Products_List_Table();
		$table->prepare_items();

		echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active" role="tabpanel" aria-hidden="false" aria-labelledby="wdp-tab-products">';
		echo '<div class="wdp-settings-container wdp-products-overview">';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list">';
		echo '<li>' . esc_html__('Her ürünün bağış tipini, kısa kodunu ve hedefli kampanyalarda toplanan tutarı tek bakışta görürsünüz.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Ayarları değiştirmek için "Düzenle"ye tıklayın; ürün düzenleme ekranındaki "Bağış" sekmesi açılır.', 'woo-donation-popup') . '</li>';
		echo '</ul></div>';

		echo '<form method="post" action="' . esc_url(admin_url('admin.php?page=wdp-popup-settings')) . '" class="wdp-products-table-form">';
		echo '<input type="hidden" name="page" value="wdp-popup-settings" />';
		$table->search_box(__('Ürün ara', 'woo-donation-popup'), 'wdp-product-search');
		$table->display();
		echo '</form>';
		echo '<p class="screen-reader-text" data-wdp-products-status role="status" aria-live="polite"></p>';
		echo '</div></div>';
	}
}
