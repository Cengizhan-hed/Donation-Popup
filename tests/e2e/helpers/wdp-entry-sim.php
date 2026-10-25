<?php
/**
 * Yalnız yerel e2e: giriş noktası senaryo simülasyonu (mu-plugin).
 * Durum: wp-content/wdp-entry-sim.json (her istekte okunur).
 * Tema/sayfa oluşturucu adı yok; yalnız standart WooCommerce kancaları.
 */
$wdp_sim = json_decode((string) @file_get_contents(WP_CONTENT_DIR . '/wdp-entry-sim.json'), true);
$wdp_sim = is_array($wdp_sim) ? $wdp_sim : array();

// Kullanıcının snippet'ini taklit eder (örn. [hd_panel_buton]): global ürün ID'sini bulup eklenti kısa kodunu çağırır.
add_shortcode(
	'hd_panel_buton',
	static function () {
		global $product;
		$id = (is_object($product) && method_exists($product, 'get_id')) ? (int) $product->get_id() : (int) get_queried_object_id();
		return $id > 0 ? '<span class="hd-snippet">' . do_shortcode('[wdp_donation_button_panel id="' . $id . '"]') . '</span>' : '';
	}
);

if (!empty($wdp_sim['auto_place'])) {
	add_filter(
		'option_wdp_placement_settings',
		static function ($value) use ($wdp_sim) {
			$value               = is_array($value) ? $value : array();
			$value['auto_place'] = $wdp_sim['auto_place'];
			return $value;
		}
	);
}

add_action(
	'wp',
	static function () use ($wdp_sim) {
		if (!function_exists('is_product') || !is_product()) {
			return;
		}
		if (!empty($wdp_sim['builder_no_atc'])) {
			// Sayfa oluşturucu düzeni: Woo özet kancalarında add-to-cart öğesi yok.
			remove_all_actions('woocommerce_single_product_summary');
			add_action('woocommerce_single_product_summary', 'woocommerce_template_single_title', 5);
		}
		$snippet = isset($wdp_sim['snippet']) ? (string) $wdp_sim['snippet'] : '';
		$map     = array(
			'summary'      => array('woocommerce_single_product_summary', 25, '[hd_panel_buton]'),
			'late'         => array('woocommerce_after_single_product', 1000, '[hd_panel_buton]'),
			'idless_panel' => array('woocommerce_single_product_summary', 25, '[wdp_donation_button_panel]'),
			'idless_popup' => array('woocommerce_single_product_summary', 25, '[wdp_donation_button]'),
			'idless_form'  => array('woocommerce_single_product_summary', 25, '[wdp_donation_form]'),
		);
		if (isset($map[ $snippet ])) {
			list($hook, $prio, $code) = $map[ $snippet ];
			add_action(
				$hook,
				static function () use ($code) {
					echo do_shortcode($code); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				},
				$prio
			);
		}
	},
	40
);

if (!empty($wdp_sim['debug'])) {
	add_action(
		'wp_footer',
		static function () {
			$p = function_exists('wc_get_product') ? wc_get_product((int) get_queried_object_id()) : null;
			echo '<!--WDPDBG tov=' . (int) \DonationPanel\Modules\EntryPoints\Auto_Placement::template_override_used()
				. ' hooks=' . (int) \DonationPanel\Modules\EntryPoints\Auto_Placement::hooks_added()
				. ' isprod=' . (int) is_product()
				. ' qid=' . (int) get_queried_object_id()
				. ' ui=' . (int) WDP_Render_Registry::has_product_ui((int) get_queried_object_id())
				. ' scope=' . (int) ($p && WDP_Donation_Scope::is_donation_product($p))
				. ' sap=' . (int) ($p && \DonationPanel\Modules\EntryPoints\Auto_Placement::should_auto_place($p))
				. ' after=' . (int) did_action('woocommerce_after_single_product')
				. ' -->';
		},
		1000
	);
}
