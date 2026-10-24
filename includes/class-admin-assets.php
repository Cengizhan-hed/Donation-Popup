<?php
/**
 * Admin sayfasında CSS/JS yükler ve wdp_admin localize verisini enjekte eder.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Handles admin enqueue logic for plugin page.
 */
class WDP_Admin_Assets {
	/**
	 * Plugin settings page hook.
	 */
	const PAGE_HOOK = 'woocommerce_page_wdp-popup-settings';

	/**
	 * Enqueue admin assets.
	 *
	 * @param string $hook Current admin page hook.
	 * @return void
	 */
	public static function enqueue($hook) {
		if ($hook === 'post.php' || $hook === 'post-new.php') {
			$screen = function_exists('get_current_screen') ? get_current_screen() : null;
			if ($screen && $screen->post_type === 'product' && current_user_can('manage_woocommerce')) {
				wp_enqueue_style('wp-color-picker');
				self::enqueue_products_assets(array('wp-color-picker'), array('wp-color-picker'));
			}
			return;
		}

		if ($hook !== self::PAGE_HOOK) {
			return;
		}

		$css_path = WDP_PLUGIN_DIR . 'assets/css/admin-style.css';
		$js_path  = WDP_PLUGIN_DIR . 'assets/js/admin-script.js';
		$css_ver  = WDP_VERSION . '.' . (string) (file_exists($css_path) ? filemtime($css_path) : 0);
		$js_ver   = WDP_VERSION . '.' . (string) (file_exists($js_path) ? filemtime($js_path) : 0);

		wp_enqueue_style('dashicons');
		wp_enqueue_style(
			'wdp-admin-css',
			WDP_PLUGIN_URL . 'assets/css/admin-style.css',
			array(),
			$css_ver
		);

		// jQuery'den bağımsız sekme kontrolü — ana admin script kırılsa bile sekmeler çalışır.
		wp_register_script('wdp-admin-tabs', false, array(), $js_ver, true);
		wp_enqueue_script('wdp-admin-tabs');
		wp_add_inline_script('wdp-admin-tabs', self::get_tabs_inline_script());

		wp_enqueue_media();
		wp_enqueue_script(
			'wdp-admin-js',
			WDP_PLUGIN_URL . 'assets/js/admin-script.js',
			array('jquery', 'wdp-admin-tabs'),
			$js_ver,
			true
		);

		$style_packs = class_exists('WDP_Style_Presets') ? WDP_Style_Presets::get_packs_for_js() : array();
		$icon_builtins = class_exists('WDP_Icon_Library') ? WDP_Icon_Library::get_builtins_for_admin() : array();

		wp_localize_script(
			'wdp-admin-js',
			'wdp_admin',
			array(
				'ajax_url'        => admin_url('admin-ajax.php'),
				'nonce'           => wp_create_nonce('wdp_admin_nonce'),
				'save_success'    => __('Settings saved successfully.', 'woo-donation-popup'),
				'save_error'      => __('An error occurred while saving settings.', 'woo-donation-popup'),
				'currency_symbol' => html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8'),
				'price_format'    => html_entity_decode(get_woocommerce_price_format(), ENT_QUOTES, 'UTF-8'),
				'style_packs'     => $style_packs,
				'icon_builtins'   => $icon_builtins,
				'i18n'            => array(
					'preset_applied'         => __('The pack was applied to the form fields. Don’t forget to save.', 'woo-donation-popup'),
					'media_title'            => __('Select icon', 'woo-donation-popup'),
					'media_button'           => __('Use', 'woo-donation-popup'),
					'unsaved_tab'            => __('You have unsaved changes. Are you sure you want to leave this tab?', 'woo-donation-popup'),
					'confirm_leave_tab'      => __('You have unsaved changes. Are you sure you want to leave this tab?', 'woo-donation-popup'),
					'confirm_uninstall_data' => __('All product settings and plugin options will be deleted. Orders and order records are not affected. This cannot be undone. Have you made a backup?', 'woo-donation-popup'),
					'unsaved_changes'        => __('You have unsaved changes.', 'woo-donation-popup'),
					'select_pack_first'      => __('Select a style pack first.', 'woo-donation-popup'),
					'pack_downloaded'        => __('Pack downloaded as JSON.', 'woo-donation-popup'),
				),
			)
		);

		self::enqueue_products_assets(array('wdp-admin-css'));
	}

	/**
	 * Products table (settings page) + product "Bağış" tab assets.
	 *
	 * @param string[] $style_deps  Style dependencies.
	 * @param string[] $script_deps Script dependencies.
	 * @return void
	 */
	private static function enqueue_products_assets(array $style_deps = array(), array $script_deps = array()) {
		$css_rel = 'assets/css/admin/products.css';
		$js_rel  = 'assets/js/admin/products.js';

		// Alt bağış ürün seçici (wc-product-search / selectWoo).
		wp_enqueue_script('wc-enhanced-select');
		wp_enqueue_style('woocommerce_admin_styles');
		$script_deps[] = 'wc-enhanced-select';

		wp_enqueue_style('wdp-admin-products', WDP_PLUGIN_URL . $css_rel, $style_deps, self::asset_version($css_rel));
		wp_enqueue_script('wdp-admin-products', WDP_PLUGIN_URL . $js_rel, $script_deps, self::asset_version($js_rel), true);

		wp_localize_script(
			'wdp-admin-products',
			'wdpProductsAdmin',
			array(
				'ajaxUrl' => admin_url('admin-ajax.php'),
				'nonce'   => wp_create_nonce('wdp_admin_nonce'),
				'tabKey'  => WDP_Admin_Product_Data_Tab::TAB_KEY,
				'i18n'    => array(
					'copied'        => __('Copied', 'woo-donation-popup'),
					'copyFailed'    => __('Could not copy; select the text and copy it manually.', 'woo-donation-popup'),
					'recalculating' => __('Recalculating the total…', 'woo-donation-popup'),
					'error'         => __('The action could not be completed. Please try again.', 'woo-donation-popup'),
					'rowAdded'      => __('Row added.', 'woo-donation-popup'),
					'rowRemoved'    => __('Row removed.', 'woo-donation-popup'),
					'moved'         => __('Order updated.', 'woo-donation-popup'),
				),
			)
		);
	}

	/**
	 * @param string $relative_path Path from plugin root.
	 * @return string
	 */
	private static function asset_version($relative_path) {
		$path = WDP_PLUGIN_DIR . $relative_path;
		return WDP_VERSION . '.' . (string) (file_exists($path) ? filemtime($path) : 0);
	}

	/**
	 * Vanilla JS tab switcher (no jQuery).
	 *
	 * @return string
	 */
	private static function get_tabs_inline_script() {
		$confirm = wp_json_encode(
			__('You have unsaved changes. Are you sure you want to leave this tab?', 'woo-donation-popup'),
			JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
		);
		$js      = <<<'JS'
(function () {
  function getTabKeys() {
    var wrap = document.querySelector(".wdp-admin-wrap");
    if (!wrap) return [];
    var nodes = wrap.querySelectorAll(".wdp-nav-tab-wrapper .nav-tab[data-tab]");
    var keys = [];
    for (var i = 0; i < nodes.length; i++) {
      var key = String(nodes[i].getAttribute("data-tab") || "").trim();
      if (!key) continue;
      if (!document.getElementById("wdp-" + key + "-tab")) continue;
      if (keys.indexOf(key) === -1) keys.push(key);
    }
    return keys;
  }

  function isValidTab(tabKey) {
    return getTabKeys().indexOf(tabKey) !== -1;
  }

  function normalizeHash(raw) {
    var key = String(raw || "").replace(/^#/, "");
    if (!key) return null;
    if (isValidTab(key)) return key;
    var m = key.match(/^wdp-(.+)-tab$/);
    if (m && isValidTab(m[1])) return m[1];
    return null;
  }

  function currentTabKey() {
    var active = document.querySelector(".wdp-nav-tab-wrapper .nav-tab-active");
    return active ? String(active.getAttribute("data-tab") || "") : "";
  }

  function confirmLeaveDirty(nextKey) {
    if (!document.querySelector(".wdp-admin-settings-form.is-dirty")) return true;
    if (currentTabKey() === nextKey) return true;
    var unsaved = (window.wdp_admin && window.wdp_admin.i18n && window.wdp_admin.i18n.unsaved_tab) ? window.wdp_admin.i18n.unsaved_tab : __WDP_UNSAVED_CONFIRM__;
    return window.confirm(unsaved);
  }

  function activateTab(tabKey, opts) {
    opts = opts || {};
    if (!isValidTab(tabKey)) return false;
    if (!opts.skipDirtyCheck && !confirmLeaveDirty(tabKey)) return false;
    var wrap = document.querySelector(".wdp-admin-wrap");
    if (!wrap) return false;

    var tabs = wrap.querySelectorAll(".wdp-nav-tab-wrapper .nav-tab");
    var panels = wrap.querySelectorAll(".wdp-tab-content");
    var targetTab = wrap.querySelector('.wdp-nav-tab-wrapper .nav-tab[data-tab="' + tabKey + '"]');
    var targetPanel = document.getElementById("wdp-" + tabKey + "-tab");
    if (!targetPanel) return false;

    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove("nav-tab-active");
      tabs[i].setAttribute("aria-selected", "false");
      tabs[i].setAttribute("tabindex", "-1");
    }
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.remove("wdp-tab-active");
      panels[j].setAttribute("aria-hidden", "true");
      panels[j].setAttribute("hidden", "hidden");
      panels[j].style.display = "none";
    }

    if (targetTab) {
      targetTab.classList.add("nav-tab-active");
      targetTab.setAttribute("aria-selected", "true");
      targetTab.setAttribute("tabindex", "0");
    }
    targetPanel.classList.add("wdp-tab-active");
    targetPanel.setAttribute("aria-hidden", "false");
    targetPanel.removeAttribute("hidden");
    targetPanel.style.display = "block";

    if (!opts.skipHistory) {
      try {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", "#" + tabKey);
        } else {
          window.location.hash = tabKey;
        }
      } catch (e) {}
    }
    return true;
  }

  window.wdpAdminActivateTab = activateTab;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var wrap = document.querySelector(".wdp-admin-wrap");
    if (!wrap) return;

    wrap.addEventListener("click", function (event) {
      var tab = event.target.closest ? event.target.closest(".wdp-nav-tab-wrapper .nav-tab") : null;
      if (!tab || !wrap.contains(tab)) return;
      event.preventDefault();
      event.stopPropagation();
      activateTab(tab.getAttribute("data-tab") || "");
    });

    wrap.addEventListener("keydown", function (event) {
      var tab = event.target.closest ? event.target.closest(".wdp-nav-tab-wrapper .nav-tab") : null;
      if (!tab || !wrap.contains(tab)) return;
      var keys = getTabKeys();
      var tabs = [];
      for (var t = 0; t < keys.length; t++) {
        var el = wrap.querySelector('.wdp-nav-tab-wrapper .nav-tab[data-tab="' + keys[t] + '"]');
        if (el) tabs.push(el);
      }
      var idx = tabs.indexOf(tab);
      if (idx < 0) return;
      var next = idx;
      if (event.key === "ArrowRight") next = (idx + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateTab(tab.getAttribute("data-tab") || "");
        return;
      } else {
        return;
      }
      event.preventDefault();
      tabs[next].focus();
      activateTab(tabs[next].getAttribute("data-tab") || "");
    });

    var initial = normalizeHash(window.location.hash) || (getTabKeys()[0] || "products");
    activateTab(initial, { skipHistory: !window.location.hash, skipDirtyCheck: true });

    window.addEventListener("hashchange", function () {
      var key = normalizeHash(window.location.hash);
      if (!key) return;
      if (!activateTab(key, { skipHistory: true })) {
        var cur = currentTabKey();
        if (cur && window.history && window.history.replaceState) {
          try {
            window.history.replaceState(null, "", "#" + cur);
          } catch (e) {}
        }
      }
    });
  });
})();
JS;
		return str_replace('__WDP_UNSAVED_CONFIRM__', $confirm, $js);
	}
}
