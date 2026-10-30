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
		$settings = array(
			'version'     => 1,
			'modules'     => array(),
		);
		// Compact kart ayarları (`?dp_cquick=0..3`, `?dp_creset=1`) — yalnız test.
		if (isset($_GET['dp_cquick']) || isset($_GET['dp_creset'])) { // phpcs:ignore
			$settings['compact'] = array(
				'quick_amounts' => isset($_GET['dp_cquick']) ? (int) $_GET['dp_cquick'] : 3, // phpcs:ignore
				'reset_hidden'  => isset($_GET['dp_creset']), // phpcs:ignore
			);
		}
		// Compact kart v2 (123-compact2): vergi indirimi beyanı (`?dp_ctax=1`), etki ifadesi (`?dp_cimpact=1`), güven satırı
		// kapalı (`?dp_ctrust=0`) — yalnız test verisi.
		if (isset($_GET['dp_ctax'])) { // phpcs:ignore
			$settings['modules']['tax_relief'] = true;
			$settings['tax_relief']            = array(
				'title'          => 'Boost your donation by 25% with Gift Aid',
				'text'           => 'I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax in the current tax year than the amount of Gift Aid claimed on all my donations, it is my responsibility to pay any difference. Please treat this and any donations I make in the future or have made in the past four years as Gift Aid donations.',
				'checkbox_label' => 'Yes, I make this declaration',
			);
		}
		if (isset($_GET['dp_cimpact'])) { // phpcs:ignore
			$settings['modules']['impact'] = true;
			$settings['impact']            = array( 'map' => "10={count} hot meal|{count} hot meals\n50={count} family food parcel|{count} family food parcels" );
		}
		if (isset($_GET['dp_ctrust'])) { // phpcs:ignore
			$settings['compact']          = isset($settings['compact']) ? $settings['compact'] : array();
			$settings['compact']['trust'] = '0' !== (string) $_GET['dp_ctrust']; // phpcs:ignore
		}
		return $settings;
	}
);

// Compact kart e2e: dil (`?dp_locale=tr_TR`) ve kampanya önbelleği (çerez `dp_progress_fresh`: ödemeden hemen sonra güncel toplam).
if (isset($_GET['dp_locale'])) { // phpcs:ignore
	$dp_locale = preg_replace('/[^A-Za-z_]/', '', (string) $_GET['dp_locale']); // phpcs:ignore
	add_filter('locale', static function () use ($dp_locale) { return $dp_locale; });
}
if (isset($_COOKIE['dp_progress_fresh'])) { // phpcs:ignore
	add_action(
		'init',
		static function () {
			global $wpdb;
			$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '\\_transient\\_%dp\\_progress\\_%'"); // phpcs:ignore
		}
	);
}

// Compact kart test sayfaları: `/?dp_compact=plain|slider&dp_ids=ID[,ID…]`. Kaydırıcı: CSS scroll-snap + Swiper benzeri sürükleme
// ve ok tuşu dinleyicisi (kütüphane indirilmez; yalnız genel olay davranışı taklit edilir). Slayt değişimleri `window.__slides`.
add_action(
	'template_redirect',
	static function () {
		if (!isset($_GET['dp_compact'])) { // phpcs:ignore
			return;
		}
		$view = sanitize_key((string) $_GET['dp_compact']); // phpcs:ignore
		$ids  = array_values(array_filter(array_map('intval', explode(',', isset($_GET['dp_ids']) ? (string) $_GET['dp_ids'] : '')))); // phpcs:ignore
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Compact e2e</title>';
		wp_head();
		echo '<style>.t-slider{overflow-x:auto;scroll-snap-type:x mandatory;display:flex;gap:0;scrollbar-width:none}.t-slide{flex:0 0 100%;scroll-snap-align:start;padding:24px 16px;box-sizing:border-box;background:#eef2f6}</style>';
		echo '</head><body><main style="padding:16px 0"><h1 style="padding:0 16px">Compact</h1>';
		if ('slider' === $view) {
			echo '<div class="t-slider" id="t-slider">';
			foreach ($ids as $i => $id) {
				echo '<div class="t-slide" data-i="' . (int) $i . '"><p class="t-label">Slide ' . (int) ($i + 1) . '</p>' . do_shortcode('[wdp_donation_form id="' . (int) $id . '" layout="compact"]') . '</div>'; // phpcs:ignore
			}
			echo '</div>';
			echo '<script>(function(){var s=document.getElementById("t-slider");var st={changes:0,index:0};window.__slides=st;'
				. 'function go(i){var n=s.children.length;i=Math.max(0,Math.min(n-1,i));if(i!==st.index){st.index=i;st.changes++;}s.scrollTo({left:i*s.clientWidth,behavior:"instant"});}'
				. 'window.__slideGo=go;var x=null;'
				. 's.addEventListener("pointerdown",function(e){x=e.clientX;});s.addEventListener("touchstart",function(e){x=e.touches[0].clientX;},{passive:true});'
				. 'function mv(cx){if(x===null)return;var d=cx-x;if(Math.abs(d)>40){go(st.index+(d<0?1:-1));x=null;}}'
				. 's.addEventListener("pointermove",function(e){mv(e.clientX);});s.addEventListener("touchmove",function(e){mv(e.touches[0].clientX);},{passive:true});'
				. 'document.addEventListener("pointerup",function(){x=null;});'
				. 's.addEventListener("wheel",function(e){if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&Math.abs(e.deltaX)>20){go(st.index+(e.deltaX>0?1:-1));}},{passive:true});'
				. 'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight")go(st.index+1);if(e.key==="ArrowLeft")go(st.index-1);});'
				. '})();</script>';
		} else {
			echo '<div style="padding:0 16px">' . do_shortcode('[wdp_donation_form id="' . (int) ($ids ? $ids[0] : 0) . '" layout="compact"]') . '</div>'; // phpcs:ignore
		}
		echo '<p style="padding:0 16px">Sayfa metni.</p></main>';
		wp_footer();
		echo '</body></html>';
		exit;
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
		// 12.3 hareket testi: `dp_sb=1` klasik (yer kaplayan) kaydırma çubuğu (Chromium), `dp_long=1` uzun sayfa (çubuk görünür).
		if (isset($_GET['dp_sb'])) { // phpcs:ignore
			echo '<style>::-webkit-scrollbar{width:15px;height:15px}::-webkit-scrollbar-thumb{background:#888}::-webkit-scrollbar-track{background:#eee}</style>';
		}
		echo '</head><body><main style="padding:16px"><h1>Test</h1><p>Sayfa metni.</p>';
		if (isset($_GET['dp_long'])) { // phpcs:ignore
			echo '<div id="dp-sim-center" style="margin:0 auto;max-width:300px;height:40px;background:#ddd"></div>';
		}
		if ('slider' === $kind) {
			// 12.2 slider: 6 sayfa içi form. track = yatay kayan şerit (ilk slayt görünür, diğerleri kırpılmış ekran dışı);
			// fade = üst üste slaytlar (yalnız ilki görünür, diğerleri visibility:hidden). Genel CSS; kütüphane/tema adı yok.
			$fade   = isset($_GET['dp_mode']) && 'fade' === $_GET['dp_mode']; // phpcs:ignore
			$slides = '';
			for ($i = 0; $i < 6; $i++) {
				$style   = $fade ? ($i > 0 ? 'position:absolute;inset:0;visibility:hidden' : 'position:relative') : 'flex:0 0 100%;min-width:0';
				$slides .= '<div class="sim-slide" data-sim-slide="' . $i . '" style="' . $style . '">' . do_shortcode('[donation_panel_experience id="' . $id . '" kind="inline"]') . '</div>';
			}
			echo '<div class="sim-slider" style="overflow:hidden;position:relative"><div class="sim-track" style="' . ($fade ? 'position:relative' : 'display:flex;transition:none') . '">' . $slides . '</div></div>'; // phpcs:ignore
		} elseif ('list' === $kind) {
			// 12.3 ön alma testi: bağış listesi (kart düğmesi formu REST ile alır) + işaretlemeye sokulmuş sahte düğme (başka köken).
			echo do_shortcode('[wdp_donations button="panel"]'); // phpcs:ignore
			echo '<div class="wdp-list-wrap" data-wdp-rest="https://evil.invalid/wp-json/donation-panel/v1/" data-wdp-kind="popup"><a class="wdp-card__cta" id="dp-rogue" href="#rogue" data-wdp-form="' . (int) $id . '">rogue</a></div>'; // phpcs:ignore
		} else {
			echo do_shortcode('[donation_panel_experience id="' . $id . '" kind="' . esc_attr($kind) . '"]'); // phpcs:ignore
		}
		if (isset($_GET['dp_long'])) { // phpcs:ignore
			echo '<div style="height:2400px">Uzun içerik</div>';
		}
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
