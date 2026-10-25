<?php
/**
 * Yalnız yerel e2e (E6): yeni motor + thanks + tax_relief + impact modüllerini açar; test sayfası ve sipariş meta okuyucu sunar.
 * Uzak ortamda KULLANILMAZ.
 *
 *   /?dp_e6_test=form&dp_product=ID        satır içi bağış formu
 *   /?dp_e6_test=meta&dp_order=ID          sipariş + kalem meta (JSON; yalnız bu geçici yerel WP)
 *   Çerez dp_e6_off=1                      thanks + tax_relief kapalı (modül kapalıyken çıktı yok kanıtı)
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function () {
		$off = isset($_COOKIE['dp_e6_off']); // phpcs:ignore
		return array(
			'version'     => 1,
			'modules'     => array(
				'thanks'     => !$off,
				'tax_relief' => !$off,
				'impact'     => true,
			),
			'experiences' => array( 'engine' => 'new' ),
			'impact'      => array( 'map' => "25={count} food parcel|{count} food parcels\n100={count} water well|{count} water wells" ),
			'tax_relief'  => array( 'text' => 'I declare e2e wording ğüşiöç.' ),
		);
	}
);

add_action(
	'template_redirect',
	static function () {
		$mode = isset($_GET['dp_e6_test']) ? sanitize_key(wp_unslash($_GET['dp_e6_test'])) : ''; // phpcs:ignore
		if ('' === $mode) {
			return;
		}
		nocache_headers();
		if ('meta' === $mode) {
			$order = wc_get_order(isset($_GET['dp_order']) ? (int) $_GET['dp_order'] : 0); // phpcs:ignore
			$out   = array( 'order' => array(), 'items' => array(), 'hpos' => false );
			if ($order) {
				$out['hpos']  = class_exists('Automattic\WooCommerce\Utilities\OrderUtil') && Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
				foreach (array('_wdp_tax_relief_declared', '_wdp_tax_relief_text_hash') as $key) {
					$out['order'][ $key ] = (string) $order->get_meta($key, true);
				}
				foreach ($order->get_items() as $item) {
					$row = array();
					foreach (array('_wdp_tax_relief_declared', '_wdp_tax_relief_text_hash', 'wdp_donor_name', 'wdp_donor_phone', 'wdp_donation_note') as $key) {
						$row[ $key ] = (string) $item->get_meta($key, true);
					}
					$out['items'][] = $row;
				}
			}
			wp_send_json($out);
		}
		$id = isset($_GET['dp_product']) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>E6 e2e</title>';
		wp_head();
		echo '</head><body><main style="padding:16px"><h1>Test</h1>';
		echo do_shortcode('[donation_panel_experience id="' . $id . '" kind="inline"]'); // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
