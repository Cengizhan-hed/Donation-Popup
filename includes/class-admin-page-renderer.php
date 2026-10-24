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
	public static function render_settings_page($render_modal_layout_tab, $render_normal_form_tab, $render_shareholder_tab, $render_progress_bar_tab, $render_success_screen_tab, $render_meta_tab, $render_category_colors_tab, $render_design_studio_tab = null) {
		echo '<div class="wrap wdp-admin-wrap">';
		echo '<header class="wdp-admin-hero">';
		echo '<div class="wdp-admin-hero__accent" aria-hidden="true"></div>';
		echo '<div class="wdp-admin-title-row">';
		echo '<div class="wdp-admin-hero__copy">';
		echo '<p class="wdp-admin-eyebrow">' . esc_html__('Donation Popup', 'woo-donation-popup') . '</p>';
		echo '<h1 class="wdp-admin-title">' . esc_html__('Donation Popup settings', 'woo-donation-popup') . '</h1>';
		echo '<p class="wdp-admin-subtitle">' . esc_html__('Manage product behavior, form look, and the success screen in one place — changes show up instantly in the live preview.', 'woo-donation-popup') . '</p>';
		echo '</div>';
		if (defined('WDP_VERSION')) {
			echo '<span class="wdp-admin-version" title="' . esc_attr__('Plugin version', 'woo-donation-popup') . '">';
			echo esc_html(sprintf(__('v%s', 'woo-donation-popup'), WDP_VERSION));
			echo '</span>';
		}
		echo '</div>';
		echo '</header>';

		echo '<div id="wdp-admin-notices" class="wdp-admin-notice notice" style="display:none;" role="status" aria-live="polite"></div>';
		echo '<div class="wdp-admin-shell">';
		echo '<nav class="nav-tab-wrapper wdp-nav-tab-wrapper" role="tablist" aria-label="' . esc_attr__('Donation popup settings tabs', 'woo-donation-popup') . '">';
		echo '<div class="wdp-nav-group" data-group="setup"><span class="wdp-nav-group__label">' . esc_html__('Setup', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-products" href="#products" class="nav-tab nav-tab-active" data-tab="products" role="tab" aria-controls="wdp-products-tab" aria-selected="true" tabindex="0">' . esc_html__('Products', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-placement" href="#placement" class="nav-tab" data-tab="placement" role="tab" aria-controls="wdp-placement-tab" aria-selected="false" tabindex="-1">' . esc_html__('Product page and list', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-design-studio" href="#design-studio" class="nav-tab" data-tab="design-studio" role="tab" aria-controls="wdp-design-studio-tab" aria-selected="false" tabindex="-1">' . esc_html__('Design', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="forms"><span class="wdp-nav-group__label">' . esc_html__('Forms', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-modal-layout" href="#modal-layout" class="nav-tab" data-tab="modal-layout" role="tab" aria-controls="wdp-modal-layout-tab" aria-selected="false" tabindex="-1">' . esc_html__('Popup', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-normal-form" href="#normal-form" class="nav-tab" data-tab="normal-form" role="tab" aria-controls="wdp-normal-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Normal', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-shareholder-form" href="#shareholder-form" class="nav-tab" data-tab="shareholder-form" role="tab" aria-controls="wdp-shareholder-form-tab" aria-selected="false" tabindex="-1">' . esc_html__('Share-based', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-progress-bar" href="#progress-bar" class="nav-tab" data-tab="progress-bar" role="tab" aria-controls="wdp-progress-bar-tab" aria-selected="false" tabindex="-1">' . esc_html__('Progress', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-success-screen" href="#success-screen" class="nav-tab" data-tab="success-screen" role="tab" aria-controls="wdp-success-screen-tab" aria-selected="false" tabindex="-1">' . esc_html__('Success', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '<div class="wdp-nav-group" data-group="integrations"><span class="wdp-nav-group__label">' . esc_html__('More', 'woo-donation-popup') . '</span>';
		echo '<a id="wdp-tab-meta" href="#meta" class="nav-tab" data-tab="meta" role="tab" aria-controls="wdp-meta-tab" aria-selected="false" tabindex="-1">' . esc_html__('Meta Pixel', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-category-colors" href="#category-colors" class="nav-tab" data-tab="category-colors" role="tab" aria-controls="wdp-category-colors-tab" aria-selected="false" tabindex="-1">' . esc_html__('Categories', 'woo-donation-popup') . '</a>';
		echo '<a id="wdp-tab-advanced" href="#advanced" class="nav-tab" data-tab="advanced" role="tab" aria-controls="wdp-advanced-tab" aria-selected="false" tabindex="-1">' . esc_html__('Advanced', 'woo-donation-popup') . '</a>';
		echo '</div>';
		echo '</nav>';

		self::render_products_tab();

		echo '<div id="wdp-placement-tab" class="wdp-tab-content" role="tabpanel" aria-hidden="true" hidden aria-labelledby="wdp-tab-placement">';
		WDP_Admin_Placement_Tab_Renderer::render_tab();
		echo '</div>';

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
		echo '<p class="wdp-tab-help__title">' . esc_html__('Data and removal', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Personal data export and erase requests (Tools → Export / erase personal data) include donor and shareholder fields on orders; on erase, values are anonymized as “[deleted]”.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		echo '<form id="wdp-advanced-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_advanced_settings">';
		echo '<table class="form-table" role="presentation"><tbody><tr>';
		echo '<th scope="row">' . esc_html__('Delete data when the plugin is removed', 'woo-donation-popup') . '</th><td>';
		echo '<label><input type="checkbox" name="delete_data_on_uninstall" id="wdp-delete-data-on-uninstall" value="1"' . checked($delete_on_uninstall, true, false) . ($delete_on_uninstall ? ' data-wdp-was-on="1"' : '') . ' /> ';
		echo esc_html__('Enabled', 'woo-donation-popup') . '</label>';
		echo '<p class="description">' . esc_html__('All product settings and plugin options are deleted. Orders and order records are not touched. This cannot be undone.', 'woo-donation-popup') . '</p>';
		echo '</td></tr></tbody></table>';

		echo '<p class="submit">';
		submit_button(__('Save advanced settings', 'woo-donation-popup'), 'primary', 'submit', false, array('id' => 'wdp-save-advanced-settings'));
		echo '<span class="spinner"></span>';
		echo '</p>';
		echo '</form>';

		echo '</div>';
	}

	/**
	 * Render products tab body (WP_List_Table overview; settings live on the product "Bağış" tab).
	 *
	 * @return void
	 */
	private static function render_products_tab() {
		$table = new WDP_Admin_Products_List_Table();
		$table->prepare_items();

		echo '<div id="wdp-products-tab" class="wdp-tab-content wdp-tab-active" role="tabpanel" aria-hidden="false" aria-labelledby="wdp-tab-products">';
		echo '<div class="wdp-settings-container wdp-products-overview">';
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('What can you do on this tab?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list">';
		echo '<li>' . esc_html__('See each product’s donation type, shortcode, and the amount raised on goal campaigns at a glance.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Click “Edit” to change settings; the “Donation” tab on the product edit screen opens and is saved with the product.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('The button shortcode opens a centered popup, the side panel shortcode opens a panel from the right, and the form shortcode shows an inline form.', 'woo-donation-popup') . '</li>';
		echo '</ul></div>';

		echo '<form method="post" action="' . esc_url(admin_url('admin.php?page=wdp-popup-settings')) . '" class="wdp-products-table-form">';
		echo '<input type="hidden" name="page" value="wdp-popup-settings" />';
		$table->search_box(__('Search products', 'woo-donation-popup'), 'wdp-product-search');
		$table->display();
		echo '</form>';
		echo '<p class="screen-reader-text" data-wdp-products-status role="status" aria-live="polite"></p>';
		echo '</div></div>';
	}
}
