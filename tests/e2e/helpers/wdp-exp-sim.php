<?php
/**
 * Yalnız yerel e2e: yeni nesil form motorunu açar ve her kabı tek başına gösteren boş test sayfası sunar (mu-plugin).
 *
 *   /?dp_exp_test=popup|side_panel|inline|bottom_sheet[&dp_product=ID]
 *
 * Tema/sayfa oluşturucu adı yok; yalnız standart WordPress kancaları.
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function () {
		return array(
			'version'     => 1,
			'modules'     => array(),
		);
	}
);

// Yerel e2e tüm cihazları tek IP'den (127.0.0.1) koşar: hız sınırı sayaçları her REST isteğinden önce sıfırlanır.
// Sınırlayıcının kendisi birim testlerle kanıtlıdır (tests/unit/Core/RestFoundationTest.php).
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

// Tasarım karşılaştırma ekran görüntüleri için örnek veri (`?dp_demo=1`): önerilen tutar, etki ifadesi, rozet, kalan gün, görsel.
if (isset($_GET['dp_demo'])) { // phpcs:ignore
	add_filter( 'donation_panel_campaign_days_left', static function () { return 18; } );
	add_filter(
		'donation_panel_form_model',
		static function ($model) {
			$presets = isset($model['presets']) ? (array) $model['presets'] : array();
			if (count($presets) >= 3) {
				$model['recommended'] = (float) $presets[2];
				$texts                = array( '1 aileye 1 ay su', '5 kişiye 6 ay su', 'Bir ailenin yıllık suyu', 'Kuyuya büyük katkı', 'Bir köye su' );
				$model['impact']      = array( 'tiers' => array(), 'presets' => array() );
				foreach ($presets as $i => $amount) {
					$model['impact']['presets'][] = array( 'amount' => (float) $amount, 'text' => $texts[ $i % 5 ] );
				}
			}
			$model['badge']    = 'shares' === ($model['kind'] ?? '') ? '24 saat içinde kesim videosu' : '';
			return $model;
		},
		40
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

// Doğrudan (sepetsiz) bağış e2e: `dp_direct=1` çerezi gönderilen isteklerde özellik açılır; test kart geçidi kart verisi görmez.
if (isset($_COOKIE['dp_direct'])) { // phpcs:ignore
	add_filter('donation_panel_direct_enabled', '__return_true');
	add_action(
		'plugins_loaded',
		static function () {
			if (!class_exists('WC_Payment_Gateway') || class_exists('WDP_Sim_Card_Gateway')) {
				return;
			}
			class WDP_Sim_Card_Gateway extends WC_Payment_Gateway {
				public function __construct() {
					$this->id           = 'wdp_sim_card';
					$this->method_title = 'WDP sim card';
					$this->title        = 'Test card';
					$this->enabled      = 'yes';
					$this->has_fields   = false;
				}
				public function process_payment($order_id) {
					$order = wc_get_order($order_id);
					$order->payment_complete('sim_txn');
					return array('result' => 'success', 'redirect' => $this->get_return_url($order));
				}
			}
			add_filter(
				'woocommerce_payment_gateways',
				static function ($gateways) {
					$gateways[] = 'WDP_Sim_Card_Gateway';
					return $gateways;
				}
			);
		},
		25
	);
}
