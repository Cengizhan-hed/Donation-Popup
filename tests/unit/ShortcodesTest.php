<?php
/**
 * 10.33.0 — kısa kod / liste önbelleği / uninstall / nopriv sızıntı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ShortcodesTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		\DonationPanel\Modules\EntryPoints\Donations_List::reset_for_tests();
		\DonationPanel\Domain\Placement_Settings::flush();
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array(
			'donation_scope' => 'all',
		);
		// Gerçek deneyim modülü yok: giriş noktası köprüsü sahte işaretleme alır.
		WDP_Test_State::$filters['donation_panel_experience_html'] = static function ($html, $product_id, $kind, $text) {
			return '<div data-dp-exp data-dp-product="' . (int) $product_id . '">' . $text . '</div>';
		};
	}

	public function test_bump_event_table_before_and_after(): void {
		$before = \DonationPanel\Modules\EntryPoints\Donations_List::bump_events_before_10_33_0();
		$this->assertFalse($before['woocommerce_update_product']);
		$this->assertFalse($before['save_post_product']);
		$this->assertTrue($before['woocommerce_product_set_stock']);

		\DonationPanel\Modules\EntryPoints\Donations_List::init();
		$hooks = WDP_Test_State::$actions;
		$after = array(
			'woocommerce_update_product'       => isset($hooks['woocommerce_update_product']),
			'woocommerce_new_product'          => isset($hooks['woocommerce_new_product']),
			'save_post_product'                => isset($hooks['save_post_product']),
			'trashed_post'                     => isset($hooks['trashed_post']),
			'untrashed_post'                   => isset($hooks['untrashed_post']),
			'before_delete_post'               => isset($hooks['before_delete_post']),
			'transition_post_status'           => isset($hooks['transition_post_status']),
			'updated_post_meta'                => isset($hooks['updated_post_meta']),
			'woocommerce_order_status_changed' => isset($hooks['woocommerce_order_status_changed']),
			'woocommerce_order_refunded'       => isset($hooks['woocommerce_order_refunded']),
			'set_object_terms'                 => isset($hooks['set_object_terms']),
			'woocommerce_product_set_stock'    => isset($hooks['woocommerce_product_set_stock']),
		);
		foreach ($after as $hook => $registered) {
			$this->assertTrue($registered, $hook . ' should bump after 10.33.0');
		}

		WDP_Test_State::$options[ \DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION ] = 1;
		$p = new stdClass();
		$p->post_type = 'product';
		WDP_Test_State::$post_types[7] = 'product';

		$events = array(
			array('woocommerce_update_product', array(7)),
			array('woocommerce_new_product', array(7)),
			array('save_post_product', array(7, null, true)),
			array('trashed_post', array(7)),
			array('untrashed_post', array(7)),
			array('before_delete_post', array(7)),
			array('transition_post_status', array('draft', 'publish', $p)),
			array('updated_post_meta', array(1, 7, '_price', '10')),
			array('updated_post_meta', array(1, 7, '_regular_price', '10')),
			array('updated_post_meta', array(1, 7, '_sale_price', '8')),
			array('woocommerce_order_status_changed', array(1, 'pending', 'processing')),
			array('woocommerce_order_refunded', array(1)),
		);
		foreach ($events as $row) {
			\DonationPanel\Modules\EntryPoints\Donations_List::reset_bump_guard();
			$before_v = (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1);
			do_action($row[0], ...$row[1]);
			$this->assertSame($before_v + 1, (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1), $row[0] . ' should bump');
		}

		\DonationPanel\Modules\EntryPoints\Donations_List::reset_bump_guard();
		$before_v = (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1);
		\DonationPanel\Modules\EntryPoints\Donations_List::on_product_settings_save();
		$this->assertSame($before_v + 1, (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1));

		\DonationPanel\Modules\EntryPoints\Donations_List::reset_bump_guard();
		$before_v = (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1);
		\DonationPanel\Modules\EntryPoints\Donations_List::bump_cache();
		\DonationPanel\Modules\EntryPoints\Donations_List::bump_cache();
		$this->assertSame($before_v + 1, (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1), 'same request bumps once');
	}

	public function test_random_skips_cache_and_admin_notice_stays_out(): void {
		WDP_Test_State::$caps = array('edit_products');
		$html = \DonationPanel\Modules\EntryPoints\Donations_List::render(array('orderby' => 'random'));
		$this->assertNotSame('', $html);
		$this->assertSame(array(), WDP_Test_State::$transients);
		$this->assertStringNotContainsString('wdp-admin-notice', $html);

		$html = \DonationPanel\Modules\EntryPoints\Donations_List::render(array('limit' => 3));
		$this->assertStringNotContainsString('wdp-admin-notice', $html);
		$this->assertNotEmpty(WDP_Test_State::$transients);
		foreach (WDP_Test_State::$transients as $cached) {
			$cached = is_array($cached) ? (string) ($cached['html'] ?? '') : $cached; // 12.4: HTML + gömülü form paketi.
			$this->assertStringNotContainsString('wdp-admin-notice', (string) $cached);
			$this->assertStringNotContainsString('wdp-list-1', (string) $cached);
			$this->assertStringContainsString(\DonationPanel\Modules\EntryPoints\Donations_List::UID_PLACEHOLDER, (string) $cached);
		}

		WDP_Test_State::$is_admin = true;
		WDP_Test_State::$transients = array();
		$admin_html = \DonationPanel\Modules\EntryPoints\Donations_List::render(array('limit' => 3));
		$this->assertStringContainsString('wdp-admin-notice', $admin_html);
		foreach (WDP_Test_State::$transients as $cached) {
			$cached = is_array($cached) ? (string) ($cached['html'] ?? '') : $cached; // 12.4: HTML + gömülü form paketi.
			$this->assertStringNotContainsString('wdp-admin-notice', (string) $cached);
		}
	}

	public function test_multi_type_fills_up_to_limit(): void {
		for ($i = 1; $i <= 15; $i++) {
			$p        = new WC_Product($i);
			$p->name  = 'P' . $i;
			$p->price = '10';
			WDP_Test_State::$products[ $i ]   = $p;
			WDP_Test_State::$post_types[ $i ] = 'product';
			WDP_Test_State::$post_meta[ $i ]  = array(
				'_allow_custom_price'    => $i > 10 ? 'yes' : 'no',
				'_allow_multiple_shares' => 'no',
				'_enable_progress_bar'   => 'no',
			);
		}
		$atts  = \DonationPanel\Modules\EntryPoints\Donations_List::sanitize_atts(array('type' => 'custom,fixed', 'limit' => 5));
		$found = \DonationPanel\Modules\EntryPoints\Donations_List::query_products($atts);
		$this->assertCount(5, $found);
	}

	public function test_class_list_and_style_ignored(): void {
		$this->assertSame('foo bar', \DonationPanel\Modules\EntryPoints\Shortcodes::sanitize_class_list('foo bar !!!'));
		$p       = new WC_Product(3);
		$p->name = 'X';
		WDP_Test_State::$products[3] = $p;
		$html = \DonationPanel\Modules\EntryPoints\Shortcodes::render_button(
			array('id' => 3, 'class' => 'foo bar', 'style' => 'color:red;background:url(x)', 'text' => 'Ver'),
			'wdp_donation_button',
			'popup',
			array(),
			true
		);
		$this->assertStringContainsString('foo', $html);
		$this->assertStringContainsString('bar', $html);
		$this->assertStringNotContainsString('color:red', $html);
		$this->assertStringNotContainsString('style=', $html);
		$this->assertStringContainsString('Ver', $html);
	}

	public function test_button_text_key_matches_on_popup(): void {
		$p = new WC_Product(4);
		WDP_Test_State::$products[4] = $p;
		$html_text = \DonationPanel\Modules\EntryPoints\Shortcodes::render_button(
			array('id' => 4, 'text' => 'Özel Metin'),
			'wdp_donation_button',
			'popup',
			array(),
			true
		);
		$html_alias = \DonationPanel\Modules\EntryPoints\Shortcodes::render_button(
			array('id' => 4, 'button_text' => 'Özel Metin'),
			'wdp_donation_button',
			'popup',
			array(),
			true
		);
		$this->assertStringContainsString('Özel Metin', $html_text);
		$this->assertStringContainsString('Özel Metin', $html_alias);
	}

	public function test_form_stock_uses_same_helper_as_button(): void {
		$p              = new WC_Product(5);
		$p->in_stock    = false;
		$p->purchasable = true;
		WDP_Test_State::$products[5] = $p;
		WDP_Test_State::$caps        = array('edit_products');
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::unavailable_product_notice($p));
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::render_form(array('id' => 5)));

		WDP_Test_State::$is_admin = true;
		$notice = \DonationPanel\Modules\EntryPoints\Shortcodes::unavailable_product_notice($p);
		$this->assertStringContainsString('stokta yok', $notice);
		$html = \DonationPanel\Modules\EntryPoints\Shortcodes::render_form(array('id' => 5));
		$this->assertStringContainsString('stokta yok', $html);
		WDP_Test_State::$caps     = array();
		WDP_Test_State::$is_admin = false;
		$guest = \DonationPanel\Modules\EntryPoints\Shortcodes::render_form(array('id' => 5));
		$this->assertSame('', $guest);
	}

	public function test_shortcodes_column_has_three_escaped_codes(): void {
		$list = \DonationPanel\Admin\Product\Product_Data_Tab::get_shortcodes(12);
		$this->assertCount(3, $list);
		$this->assertSame('[wdp_donation_button id="12"]', $list[0]['code']);
		$this->assertSame('[wdp_donation_button_panel id="12"]', $list[1]['code']);
		$this->assertSame('[wdp_donation_form id="12"]', $list[2]['code']);
		$html = esc_attr($list[0]['code']);
		$this->assertStringContainsString('id=&quot;12&quot;', $html);
	}

	public function test_uninstall_deletes_plugin_keys_keeps_core_and_orders(): void {
		WDP_Test_State::$options['wdp_delete_data_on_uninstall'] = '1';
		WDP_Test_State::$options['wdp_button_settings']          = array('x' => 1);
		WDP_Test_State::$options['_transient_wdp_list_abc']      = '<p>cached</p>';
		WDP_Test_State::$options['_price']                       = 'keep-option';
		WDP_Test_State::$products[1] = new WC_Product(1);
		WDP_Test_State::$post_types[1] = 'product';
		WDP_Test_State::$post_meta[1]  = array(
			'_enable_progress_bar' => 'yes',
			'_allow_custom_price'  => 'yes',
			'_theme_primary'       => '#123456',
			'_price'               => '50',
			'_stock'               => '10',
		);
		WDP_Test_State::$post_types[99] = 'shop_order';
		WDP_Test_State::$post_meta[99]  = array(
			'wdp_donor_name'         => 'Ali',
			'_wdp_progress_amounts'  => array(1 => 10),
		);

		$settings = \DonationPanel\Admin\Product\Product_Settings::managed_meta_keys();
		foreach ($settings as $key) {
			$this->assertTrue(\DonationPanel\Core\Uninstall::should_delete_product_meta_key($key), $key);
		}
		$this->assertFalse(\DonationPanel\Core\Uninstall::should_delete_product_meta_key('_price'));
		$this->assertFalse(\DonationPanel\Core\Uninstall::should_delete_product_meta_key('_stock'));

		\DonationPanel\Core\Uninstall::cleanup_site();

		$this->assertArrayNotHasKey('_enable_progress_bar', WDP_Test_State::$post_meta[1]);
		$this->assertArrayNotHasKey('_theme_primary', WDP_Test_State::$post_meta[1]);
		$this->assertSame('50', WDP_Test_State::$post_meta[1]['_price']);
		$this->assertSame('10', WDP_Test_State::$post_meta[1]['_stock']);
		$this->assertSame('Ali', WDP_Test_State::$post_meta[99]['wdp_donor_name']);
		$this->assertArrayNotHasKey('wdp_button_settings', WDP_Test_State::$options);
		$this->assertArrayNotHasKey('_transient_wdp_list_abc', WDP_Test_State::$options);
	}



	public function test_legacy_ajax_action_removed(): void {
		$this->assertStringContainsString('function wdp_render_donation_button', (string) file_get_contents(WDP_PLUGIN_FILE));
		$this->assertFalse(function_exists('wdp_ajax_render_donation_button'));
		$this->assertArrayNotHasKey('wp_ajax_nopriv_wdp_render_donation_button', WDP_Test_State::$actions);
	}

	public function test_responsive_columns_pass_through(): void {
		$san = \DonationPanel\Modules\EntryPoints\Donations_List::sanitize_atts(
			array(
				'columns'        => 4,
				'columns_tablet' => 3,
				'columns_mobile' => 1,
				'image_size'     => 'medium',
			)
		);
		$this->assertSame(4, $san['columns']);
		$this->assertSame(3, $san['columns_tablet']);
		$this->assertSame(1, $san['columns_mobile']);
		$this->assertSame('medium', $san['image_size']);
	}

	public function test_migration_10_33_0_bumps_list_cache(): void {
		WDP_Test_State::$options[ \DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION ] = 4;
		\DonationPanel\Modules\EntryPoints\Donations_List::reset_bump_guard();
		$summary = \DonationPanel\Core\Version_Migrations::step_10_33_0(false);
		$this->assertSame('list cache bumped', $summary);
		$this->assertSame(5, (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1));
		$this->assertArrayHasKey('10.33.0', \DonationPanel\Core\Version_Migrations::steps());
	}

	public function test_migration_10_34_0_bumps_list_cache(): void {
		WDP_Test_State::$options[ \DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION ] = 8;
		\DonationPanel\Modules\EntryPoints\Donations_List::reset_bump_guard();
		$summary = \DonationPanel\Core\Version_Migrations::step_10_34_0(false);
		$this->assertSame('list cache bumped', $summary);
		$this->assertSame(9, (int) get_option(\DonationPanel\Modules\EntryPoints\Donations_List::CACHE_VERSION, 1));
		$this->assertArrayHasKey('10.34.0', \DonationPanel\Core\Version_Migrations::steps());
	}
}
