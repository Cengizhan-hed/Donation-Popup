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
		echo '<a id="wdp-tab-placement" href="#placement" class="nav-tab" data-tab="placement" role="tab" aria-controls="wdp-placement-tab" aria-selected="false" tabindex="-1">' . esc_html__('Ürün sayfası ve liste', 'woo-donation-popup') . '</a>';
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
		echo '<p class="wdp-tab-help__title">' . esc_html__('Veri ve kaldırma', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Kişisel veri dışa aktarma ve silme talepleri (Araçlar → Kişisel verileri dışa aktar / sil) siparişlerdeki bağışçı ve hissedar alanlarını kapsar; silmede değerler “[deleted]” ile anonimleştirilir.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		echo '<form id="wdp-advanced-settings-form" class="wdp-admin-settings-form" method="post" data-wdp-ajax-action="wdp_save_advanced_settings">';
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

		self::render_sadaka_links_table();
		echo '</div>';
	}

	/**
	 * Alt bağış bağlantıları (geçiş denetimi + güncel durum).
	 *
	 * @return void
	 */
	private static function render_sadaka_links_table() {
		$audit_key = class_exists('WDP_Sadaka_Product_Visibility')
			? WDP_Sadaka_Product_Visibility::AUDIT_OPTION
			: 'wdp_sadaka_links_audit';
		$audit = get_option($audit_key, array());
		$rows  = (is_array($audit) && isset($audit['rows']) && is_array($audit['rows'])) ? $audit['rows'] : array();

		$reason_labels = array(
			'self_ref'             => __('Ana ürün kendi ID’sini gösteriyordu', 'woo-donation-popup'),
			'enable_off'           => __('“Alt bağış ekle” kapalıyken dolu kalmıştı', 'woo-donation-popup'),
			'missing'              => __('Hedef ürün bulunamadı', 'woo-donation-popup'),
			'not_simple_or_status' => __('Hedef basit / yayımlanmış ürün değil', 'woo-donation-popup'),
			'missing_or_invalid'   => __('Genel varsayılan geçersiz', 'woo-donation-popup'),
		);

		echo '<div class="wdp-tab-help" role="note" style="margin-top:24px;">';
		echo '<p class="wdp-tab-help__title">' . esc_html__('Alt bağış bağlantıları', 'woo-donation-popup') . '</p>';
		echo '<p>' . esc_html__('Ana ürün → alt bağış ürünü eşlemeleri. 10.28.4 geçişi kurallara uymayan kayıtları temizler; ayrıntı wdp_migration_log seçeneğinde de tutulur.', 'woo-donation-popup') . '</p>';
		echo '</div>';

		if (empty($rows)) {
			echo '<p class="description">' . esc_html__('Henüz denetim kaydı yok. Eklenti 10.28.4’e güncellenince veya geçiş yeniden çalışınca burada listelenir.', 'woo-donation-popup') . '</p>';
			return;
		}

		echo '<table class="widefat striped wdp-sadaka-links-table" style="max-width:960px;">';
		echo '<thead><tr>';
		echo '<th>' . esc_html__('Ana ürün', 'woo-donation-popup') . '</th>';
		echo '<th>' . esc_html__('Alt bağış ürünü', 'woo-donation-popup') . '</th>';
		echo '<th>' . esc_html__('Durum', 'woo-donation-popup') . '</th>';
		echo '</tr></thead><tbody>';
		foreach ($rows as $row) {
			if (!is_array($row)) {
				continue;
			}
			$parent = isset($row['parent_label']) ? (string) $row['parent_label'] : '';
			$sadaka = isset($row['sadaka_label']) ? (string) $row['sadaka_label'] : '';
			$status = isset($row['status']) ? (string) $row['status'] : '';
			$reason = isset($row['reason']) ? (string) $row['reason'] : '';
			if ($status === 'valid') {
				$status_text = __('Geçerli', 'woo-donation-popup');
			} elseif ($status === 'cleaned') {
				$why         = isset($reason_labels[ $reason ]) ? $reason_labels[ $reason ] : $reason;
				$status_text = __('Temizlendi', 'woo-donation-popup') . ($why !== '' ? ' — ' . $why : '');
			} else {
				$why         = isset($reason_labels[ $reason ]) ? $reason_labels[ $reason ] : $reason;
				$status_text = __('Geçersiz', 'woo-donation-popup') . ($why !== '' ? ' — ' . $why : '');
			}
			echo '<tr>';
			echo '<td>' . esc_html($parent) . '</td>';
			echo '<td>' . esc_html($sadaka) . '</td>';
			echo '<td>' . esc_html($status_text) . '</td>';
			echo '</tr>';
		}
		echo '</tbody></table>';

		$log = get_option('wdp_migration_log', array());
		if (is_array($log) && !empty($log)) {
			$last = end($log);
			if (is_array($last) && isset($last['version'], $last['message']) && (string) $last['version'] === '10.28.4') {
				echo '<p class="description" style="margin-top:8px;">';
				echo esc_html(sprintf(
					/* translators: %s: migration summary */
					__('Son geçiş özeti: %s', 'woo-donation-popup'),
					(string) $last['message']
				));
				echo '</p>';
			}
		}
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
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Bu sekmede ne yaparsınız?', 'woo-donation-popup') . '</p><ul class="wdp-tab-help__list">';
		echo '<li>' . esc_html__('Her ürünün bağış tipini, kısa kodunu ve hedefli kampanyalarda toplanan tutarı tek bakışta görürsünüz.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Ayarları değiştirmek için "Düzenle"ye tıklayın; ürün düzenleme ekranındaki "Bağış" sekmesi açılır ve ürünle birlikte kaydedilir.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Buton kısa kodu ortada açılan pencere, Sağ panel kısa kodu sağdan panel, Form kısa kodu sayfa içi form gösterir.', 'woo-donation-popup') . '</li>';
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
