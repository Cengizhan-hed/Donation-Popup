<?php
/**
 * Yalnız yerel e2e (E3): yeni motor + kampanya/etki/sosyal kanıt modüllerini açar, örnek veriyi yalnız bu GEÇİCİ yerel WP'ye yazar
 * ve test sayfası sunar. Uzak ortamda KULLANILMAZ.
 *
 *   /?dp_cmp_test=1&dp_product=ID[&dp_seed=1]
 */
add_filter(
	'pre_option_donation_panel_settings',
	static function () {
		return array(
			'version'     => 1,
			'modules'     => array(
				'campaign'     => true,
				'impact'       => true,
				'social_proof' => true,
			),
			'experiences' => array( 'engine' => 'new' ),
			'impact'      => array( 'map' => "25={count} food parcel|{count} food parcels\n250={count} water well|{count} water wells" ),
		);
	}
);

add_action(
	'init',
	static function () {
		$id = isset($_GET['dp_product']) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		if ($id < 1 || !isset($_GET['dp_cmp_test'])) { // phpcs:ignore
			return;
		}
		if (isset($_GET['dp_seed']) && function_exists('wc_create_order') && !get_option('wdp_cmp_seeded_' . $id)) { // phpcs:ignore
			update_option('wdp_cmp_seeded_' . $id, 1);
			$rows = array(
				array('Ayşe Yılmaz', 'yes', 'ayse@example.test'),
				array('Gizli Kişi', '', 'gizli@example.test'),
			);
			foreach ($rows as $row) {
				$order = wc_create_order();
				$item  = new WC_Order_Item_Product();
				$item->set_product_id($id);
				$item->set_name('Test');
				$item->set_quantity(1);
				$item->set_subtotal(50);
				$item->set_total(50);
				$order->add_item($item);
				$order->set_billing_email($row[2]);
				$order->set_billing_first_name(explode(' ', $row[0])[0]);
				$order->set_billing_last_name(explode(' ', $row[0])[1]);
				if ('yes' === $row[1]) {
					$order->update_meta_data('wdp_public_name', 'yes');
				}
				$order->set_status('completed');
				$order->save();
			}
		}
		update_post_meta($id, '_enable_progress_bar', 'yes');
		update_post_meta($id, '_progress_bar_limit', '1000');
		update_post_meta($id, '_wdp_total_donation_amount', '400');
		update_post_meta($id, '_wdp_donor_count', '12');
		update_post_meta($id, '_donation_panel_milestones', "25=Well 1\n60=Well 2\n100=Village");
	},
	50
);

add_action(
	'template_redirect',
	static function () {
		if (!isset($_GET['dp_cmp_test'])) { // phpcs:ignore
			return;
		}
		$id = isset($_GET['dp_product']) ? (int) $_GET['dp_product'] : 0; // phpcs:ignore
		nocache_headers();
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Campaign e2e</title>';
		wp_head();
		echo '</head><body><main style="padding:16px"><h1>Test</h1>';
		echo do_shortcode('[donation_panel_progress id="' . $id . '"]'); // phpcs:ignore
		echo '<div id="social-line">' . do_shortcode('[donation_panel_social_proof id="' . $id . '" variant="line"]') . '</div>'; // phpcs:ignore
		echo '<div id="social-counters">' . do_shortcode('[donation_panel_social_proof id="' . $id . '" variant="counters"]') . '</div>'; // phpcs:ignore
		echo '<div id="social-feed">' . do_shortcode('[donation_panel_social_proof id="' . $id . '" variant="feed" per_page="1"]') . '</div>'; // phpcs:ignore
		echo '<div id="form">' . do_shortcode('[donation_panel_experience id="' . $id . '" kind="inline"]') . '</div>'; // phpcs:ignore
		echo '</main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
