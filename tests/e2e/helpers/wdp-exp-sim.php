<?php
/**
 * Yalnız yerel e2e: yeni nesil form motorunu açar ve her kabı tek başına gösteren boş test sayfası sunar (mu-plugin).
 *
 *   /?dp_exp_test=popup|side_panel|inline|bottom_sheet[&dp_product=ID][&dp_engine=legacy]
 *
 * Tema/sayfa oluşturucu adı yok; yalnız standart WordPress kancaları.
 */
$wdp_exp_legacy = isset($_GET['dp_engine']) && 'legacy' === $_GET['dp_engine']; // phpcs:ignore

add_filter(
	'pre_option_donation_panel_settings',
	static function () use ($wdp_exp_legacy) {
		return array(
			'version'     => 1,
			'modules'     => array(),
			'experiences' => array( 'engine' => $wdp_exp_legacy ? 'legacy' : 'new' ),
		);
	}
);

// Yerel e2e tüm cihazları tek IP'den (127.0.0.1) koşar: hız sınırı sayaçları her REST isteğinden önce sıfırlanır.
// Sınırlayıcının kendisi birim testlerle kanıtlıdır (tests/unit/Http).
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

// Düzenli bağış anahtarı yalnız seçenek filtresi doluysa çizilir (`?dp_freq=1`).
if (isset($_GET['dp_freq'])) { // phpcs:ignore
	add_filter(
		'donation_panel_frequency_options',
		static function () {
			return array(
				array( 'value' => 'once', 'label' => 'Tek seferlik' ),
				array( 'value' => 'monthly', 'label' => 'Aylık' ),
			);
		}
	);
}

add_action(
	'template_redirect',
	static function () {
		if (!isset($_GET['dp_exp_test'])) { // phpcs:ignore
			return;
		}
		$kind = sanitize_key((string) $_GET['dp_exp_test']); // phpcs:ignore
		$id   = isset($_GET['dp_product']) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Experiences e2e</title>';
		wp_head();
		echo '</head><body><main style="padding:16px"><h1>Test</h1><p>Sayfa metni.</p>';
		echo do_shortcode('[donation_panel_experience id="' . $id . '" kind="' . esc_attr($kind) . '"]'); // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
