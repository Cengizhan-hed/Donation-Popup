<?php
/**
 * Yalnız yerel e2e: bağış listesi ([wdp_donations]) için boş test sayfası sunar (mu-plugin).
 *
 *   /?dp_list_test=1[&dp_atts=button="popup" tabs="no"][&dp_demo=1]
 *
 * Tema/sayfa oluşturucu adı yok; yalnız standart WordPress kancaları.
 */
add_filter(
	'rest_pre_dispatch',
	static function ($result, $server, $request) {
		if (0 === strpos((string) $request->get_route(), '/donation-panel/v1')) {
			global $wpdb;
			$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%donation\\_panel\\_rl\\_%'"); // phpcs:ignore
		}
		return $result;
	},
	1,
	3
);

add_action(
	'template_redirect',
	static function () {
		if (!isset($_GET['dp_list_test'])) { // phpcs:ignore
			return;
		}
		$atts = isset($_GET['dp_atts']) ? wp_unslash((string) $_GET['dp_atts']) : ''; // phpcs:ignore
		$atts = preg_replace('/[^\p{L}\p{N}_=",\s\-.]/u', '', $atts);
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>List e2e</title>';
		wp_head();
		echo '</head><body><main style="padding:0 0 24px">';
		echo '<div style="padding:24px 20px 12px;max-width:1200px;margin:0 auto">';
		echo do_shortcode('[wdp_donations ' . $atts . ']'); // phpcs:ignore
		echo '</div></main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
