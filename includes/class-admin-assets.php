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
				'ajax_url'      => admin_url('admin-ajax.php'),
				'nonce'         => wp_create_nonce('wdp_admin_nonce'),
				'save_success'  => __('Ayarlar başarıyla kaydedildi.', 'woo-donation-popup'),
				'save_error'    => __('Ayarlar kaydedilirken bir hata oluştu.', 'woo-donation-popup'),
				'style_packs'   => $style_packs,
				'icon_builtins' => $icon_builtins,
				'i18n'          => array(
					'preset_applied' => __('Paket form alanlarına uygulandı. Kaydetmeyi unutmayın.', 'woo-donation-popup'),
					'media_title'    => __('İkon seç', 'woo-donation-popup'),
					'media_button'   => __('Kullan', 'woo-donation-popup'),
				),
			)
		);
	}

	/**
	 * Vanilla JS tab switcher (no jQuery).
	 *
	 * @return string
	 */
	private static function get_tabs_inline_script() {
		return <<<'JS'
(function () {
  var TAB_KEYS = [
    "products",
    "design-studio",
    "modal-layout",
    "normal-form",
    "shareholder-form",
    "progress-bar",
    "success-screen",
    "meta",
    "category-colors",
    "advanced"
  ];

  function normalizeHash(raw) {
    var key = String(raw || "").replace(/^#/, "");
    if (!key) return null;
    if (TAB_KEYS.indexOf(key) !== -1) return key;
    var m = key.match(/^wdp-(.+)-tab$/);
    if (m && TAB_KEYS.indexOf(m[1]) !== -1) return m[1];
    return null;
  }

  function activateTab(tabKey, opts) {
    opts = opts || {};
    if (TAB_KEYS.indexOf(tabKey) === -1) return;
    var wrap = document.querySelector(".wdp-admin-wrap");
    if (!wrap) return;

    var tabs = wrap.querySelectorAll(".wdp-nav-tab-wrapper .nav-tab");
    var panels = wrap.querySelectorAll(".wdp-tab-content");
    var targetTab = wrap.querySelector('.wdp-nav-tab-wrapper .nav-tab[data-tab="' + tabKey + '"]');
    var targetPanel = document.getElementById("wdp-" + tabKey + "-tab");
    if (!targetPanel) return;

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
      var tabs = wrap.querySelectorAll(".wdp-nav-tab-wrapper .nav-tab");
      var idx = Array.prototype.indexOf.call(tabs, tab);
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

    var initial = normalizeHash(window.location.hash) || "products";
    activateTab(initial, { skipHistory: !window.location.hash });

    window.addEventListener("hashchange", function () {
      var key = normalizeHash(window.location.hash);
      if (key) activateTab(key, { skipHistory: true });
    });
  });
})();
JS;
	}
}
