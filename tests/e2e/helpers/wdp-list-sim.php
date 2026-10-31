<?php
/**
 * Yalnız yerel e2e: bağış listesi ([wdp_donations]) için boş test sayfası sunar (mu-plugin).
 *
 *   /?dp_list_test=1[&dp_atts=button="popup" tabs="no"][&dp_demo=1]
 *   Genel sayfa oluşturucu/üçüncü taraf durumları (ad yok; 12.3 fix):
 *   &dp_builder=1      liste çıktısı yüklemeden SONRA betikle DOM'a eklenir (oluşturucu/kaydırıcı çizimi)
 *   &dp_rerender=1     (dp_builder ile) 1,8 sn sonra aynı çıktı yeniden çizilir (düğümler değişir)
 *   &dp_cookie_churn=1 başka bir betik 250 ms'de bir çerez yazar (ölçüm/güvenlik betikleri)
 *   &dp_heavy=1        ağır tema CSS'i (3000 genel kural + evrensel seçiciler)
 *
 * Tema/sayfa oluşturucu adı yok; yalnız standart WordPress kancaları.
 */
add_filter(
	'rest_pre_dispatch',
	static function ($result, $server, $request) {
		if (0 === strpos((string) $request->get_route(), '/donation-panel/v1')) {
			global $wpdb;
			$wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '%donation\\_panel\\_rl\\_%'"); // phpcs:ignore
			// Yavaş sunucu benzetimi (yalnız `dp_slow_rest` çerezi varken): toplu ön alma isteği ağda sürer.
			if (!empty($_COOKIE['dp_slow_rest']) && 0 === strpos((string) $request->get_route(), '/donation-panel/v1/experiences')) { // phpcs:ignore
				usleep(2500000);
			}
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
		if (!empty($_GET['dp_heavy'])) { // phpcs:ignore
			$css = '*{-webkit-tap-highlight-color:transparent}*,*::before,*::after{box-sizing:border-box}[class*="sim-col-"]{float:left}body:focus-within div[class] > span:not(.sim-d){text-decoration-skip-ink:auto}';
			for ($i = 0; $i < 3000; $i++) {
				$css .= '.x-' . $i . ' .y-' . $i . ' > div:not(.z-' . $i . '){margin:0}';
			}
			echo '<style id="sim-heavy">' . $css . '</style>'; // phpcs:ignore
		}
		echo '</head><body><main style="padding:0 0 24px">';
		echo '<div style="padding:24px 20px 12px;max-width:1200px;margin:0 auto">';
		$list = do_shortcode('[wdp_donations ' . $atts . ']');
		if (!empty($_GET['dp_builder'])) { // phpcs:ignore
			// Oluşturucu benzetimi: çıktı etkisiz şablonda gelir, yüklemeden sonra betikle yerleştirilir (ve istenirse yeniden çizilir).
			echo '<div id="sim-builder"></div><template id="sim-builder-tpl">' . $list . '</template>'; // phpcs:ignore
			echo '<script>addEventListener("load",function(){var b=document.getElementById("sim-builder"),t=document.getElementById("sim-builder-tpl");setTimeout(function(){b.appendChild(t.content.cloneNode(true));window.__simBuilt=1;' . (!empty($_GET['dp_rerender']) ? 'setTimeout(function(){b.textContent="";b.appendChild(t.content.cloneNode(true));window.__simRerendered=1;},1800);' : '') . '},300);});</script>'; // phpcs:ignore
		} else {
			echo $list; // phpcs:ignore
		}
		echo '</div></main>';
		if (!empty($_GET['dp_cookie_churn'])) { // phpcs:ignore
			echo '<script>setInterval(function(){document.cookie="sim_churn="+Date.now()+"; path=/";},250);</script>';
		}
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
