<?php
/**
 * 10.31.0 Kampanya blokları: hedef davranışı, tutar, hisse, toplanan, FX, tarih, sosyal, yüzde, aydınlatma.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * @covers Campaign_Goal
 * @covers Progress_Currency
 * @covers \DonationPanel\Admin\Product\Product_Settings
 */
final class CampaignBlocksTest extends TestCase {

	private const PRODUCT = 501;

	protected function setUp(): void {
		WDP_Test_State::reset();
		require_once dirname(__DIR__, 2) . '/docs/site-snippets/curcy-bridge.php';
		WDP_Site_Curcy_Bridge::init();
		WDP_Test_State::$post_meta[ self::PRODUCT ] = array(
			'_enable_progress_bar' => 'yes',
			'_progress_bar_limit'  => '1000',
			'_wdp_total_donation_amount' => 0.0,
		);
	}

	private function product(array $meta = array()): WC_Product {
		WDP_Test_State::$post_meta[ self::PRODUCT ] = array_merge(
			WDP_Test_State::$post_meta[ self::PRODUCT ],
			$meta
		);
		$p = new WC_Product(self::PRODUCT);
		WDP_Test_State::$products[ self::PRODUCT ] = $p;
		return $p;
	}

	public function test_empty_goal_action_defaults_to_message(): void {
		$this->assertSame('message', \DonationPanel\Domain\Campaign_Goal::sanitize_action(''));
		$this->assertSame('message', \DonationPanel\Domain\Campaign_Goal::resolve_action($this->product()));
	}

	public function test_goal_reached_threshold_and_overflow(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 999.0);
		$this->assertFalse(\DonationPanel\Domain\Campaign_Goal::is_goal_reached(self::PRODUCT));
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 1000.0);
		$this->assertTrue(\DonationPanel\Domain\Campaign_Goal::is_goal_reached(self::PRODUCT));
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 1500.0);
		$this->assertTrue(\DonationPanel\Domain\Campaign_Goal::is_goal_reached(self::PRODUCT));
		$this->assertSame(100.0, \DonationPanel\Domain\Campaign_Goal::compute_percent(1500.0, 1000.0));
	}

	public function test_message_and_continue_accept_when_reached(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 1000.0);
		$msg = $this->product(array('_goal_reached_action' => 'message'));
		$this->assertFalse(\DonationPanel\Domain\Campaign_Goal::should_block_new_donations($msg));
		$this->assertTrue(\DonationPanel\Domain\Campaign_Goal::should_show_reached_message($msg));
		$html = \DonationPanel\Domain\Campaign_Goal::render_reached_notice_html($msg);
		$this->assertStringContainsString('wdp-goal-reached-notice', $html);
		$this->assertStringContainsString('Hedefimize ulaştık', $html);

		$cont = $this->product(array('_goal_reached_action' => 'continue'));
		$this->assertFalse(\DonationPanel\Domain\Campaign_Goal::should_show_reached_message($cont));
		$this->assertSame('', \DonationPanel\Domain\Campaign_Goal::render_reached_notice_html($cont));
	}

	public function test_goal_zero_rejected_and_thousand_separator(): void {
		$bad = \DonationPanel\Admin\Product\Product_Settings::normalize(
			array(
				'donation_type'      => 'campaign',
				'progress_bar_limit' => '0',
			)
		)['meta'];
		$this->assertArrayNotHasKey('_progress_bar_limit', $bad, 'reddedilen hedef yazılmaz (kayıtlı değer korunur)');

		// Ölçüm: PHP (float)"100.000" = 100; parse_money_input TR binliği doğru okur.
		$this->assertSame(100.0, (float) '100.000');
		$this->assertSame(100.0, (float) wc_format_decimal('100.000'));
		$parsed = \DonationPanel\Admin\Product\Product_Settings::parse_money('100.000');
		$this->assertTrue($parsed['ok']);
		$this->assertSame(100000.0, $parsed['amount']);

		$ok = \DonationPanel\Admin\Product\Product_Settings::normalize(
			array(
				'donation_type'      => 'campaign',
				'progress_bar_limit' => '100.000',
			)
		)['meta'];
		$this->assertSame('100000', $ok['_progress_bar_limit']);
	}

	public function test_max_shares_over_50_rejected(): void {
		$meta = \DonationPanel\Admin\Product\Product_Settings::normalize(
			array(
				'donation_type' => 'shares',
				'max_shares'    => '51',
			)
		)['meta'];
		$this->assertArrayNotHasKey('_max_shares', $meta);
		$ok = \DonationPanel\Admin\Product\Product_Settings::normalize(
			array(
				'donation_type' => 'shares',
				'max_shares'    => '50',
			)
		)['meta'];
		$this->assertSame('50', $ok['_max_shares']);
	}

	public function test_cover_fee_stripped_with_rounding(): void {
		$item = new WDP_Fake_Order_Item(
			self::PRODUCT,
			102.5,
			1,
			array(
				'_custom_price' => 102.5,
				'wdp_cover_fee' => '2.5',
			)
		);
		$net = \DonationPanel\Domain\Campaign_Totals::strip_cover_fee_from_line_total($item, 102.5);
		$this->assertEqualsWithDelta(100.0, $net, 0.001);
	}

	public function test_processing_to_on_hold_uncounts(): void {
		update_post_meta(self::PRODUCT, '_wdp_total_donation_amount', 0.0);
		$order = new WDP_Fake_Order(
			11,
			array(1 => new WDP_Fake_Order_Item(self::PRODUCT, 80.0, 1, array('_custom_price' => 80)))
		);
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(11, 'pending', 'processing', $order);
		$this->assertSame(80.0, (float) get_post_meta(self::PRODUCT, '_wdp_total_donation_amount', true));
		\DonationPanel\Domain\Campaign_Totals::sync_order_donation_totals_on_status_change(11, 'processing', 'on-hold', $order);
		$this->assertSame(0.0, (float) get_post_meta(self::PRODUCT, '_wdp_total_donation_amount', true));
	}

	public function test_currency_convert_same_unit_and_eur_usd_gbp(): void {
		WDP_Test_State::$currency = 'TRY';
		$same = \DonationPanel\Domain\Progress_Currency::convert_to_base(50.0, 'TRY', null);
		$this->assertTrue($same['ok']);
		$this->assertSame(50.0, $same['amount']);

		$order = new WDP_Fake_Order(20, array());
		$order->currency = 'EUR';
		$order->meta['wmc_order_info'] = array('EUR' => array('rate' => 0.025));
		$eur = \DonationPanel\Domain\Progress_Currency::convert_to_base(25.0, 'EUR', $order);
		$this->assertTrue($eur['ok']);
		$this->assertEqualsWithDelta(1000.0, $eur['amount'], 0.01);

		$usd = new WDP_Fake_Order(21, array());
		$usd->currency = 'USD';
		$usd->meta['_wmc_order_rate'] = '0.03';
		$u = \DonationPanel\Domain\Progress_Currency::convert_to_base(30.0, 'USD', $usd);
		$this->assertTrue($u['ok']);
		$this->assertEqualsWithDelta(1000.0, $u['amount'], 0.01);

		$gbp = new WDP_Fake_Order(22, array());
		$gbp->currency = 'GBP';
		$gbp->meta['wmc_order_info'] = array('GBP' => array('rate' => 0.02));
		$g = \DonationPanel\Domain\Progress_Currency::convert_to_base(20.0, 'GBP', $gbp);
		$this->assertTrue($g['ok']);
		$this->assertEqualsWithDelta(1000.0, $g['amount'], 0.01);

		$bad = new WDP_Fake_Order(23, array());
		$bad->currency = 'EUR';
		$fail = \DonationPanel\Domain\Progress_Currency::convert_to_base(10.0, 'EUR', $bad);
		$this->assertFalse($fail['ok']);
	}

	public function test_compute_amounts_skips_unconvertible_and_excludes_fee(): void {
		WDP_Test_State::$currency = 'TRY';
		$order = new WDP_Fake_Order(
			30,
			array(
				1 => new WDP_Fake_Order_Item(
					self::PRODUCT,
					102.5,
					1,
					array('_custom_price' => 102.5, 'wdp_cover_fee' => '2.5')
				),
			)
		);
		$order->currency = 'EUR';
		$order->meta['wmc_order_info'] = array('EUR' => array('rate' => 0.025));
		$amounts = \DonationPanel\Domain\Campaign_Totals::compute_order_progress_amounts($order);
		// 102.5 / 1.025 = 100 EUR net → / 0.025 = 4000 TRY
		$this->assertEqualsWithDelta(4000.0, $amounts[ self::PRODUCT ], 0.05);

		$bad = new WDP_Fake_Order(
			31,
			array(1 => new WDP_Fake_Order_Item(self::PRODUCT, 50.0, 1, array('_custom_price' => 50)))
		);
		$bad->currency = 'EUR';
		$this->assertSame(array(), \DonationPanel\Domain\Campaign_Totals::compute_order_progress_amounts($bad));
	}

	public function test_empty_meta_schedules_recalc_returns_zero(): void {
		delete_post_meta(self::PRODUCT, '_wdp_total_donation_amount');
		$total = \DonationPanel\Domain\Campaign_Totals::get_total_donation_amount(self::PRODUCT);
		$this->assertSame(0.0, $total);
		$this->assertNotEmpty(WDP_Test_State::$cron);
	}

	public function test_privacy_default_is_short_link_label(): void {
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'enable_privacy_notice' => '1',
			'privacy_notice_text'   => '',
			'privacy_notice_url'    => 'https://example.test/p',
		);
		$n = \DonationPanel\Domain\Privacy_Notice::resolve(array( 'has_email' => true ));
		$this->assertNotNull($n);
		$this->assertSame(
			\DonationPanel\Domain\Privacy_Notice::default_link_label(),
			$n['link_label']
		);
		$this->assertStringNotContainsString('yurt dışındaki saha', $n['text']);
	}

	public function test_migration_10_31_0(): void {
		$this->assertArrayHasKey('10.31.0', \DonationPanel\Core\Version_Migrations::steps());
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'privacy_notice_text' => 'Kişisel verileriniz Aydınlatma Metni kapsamında işlenir.',
		);
		WDP_Test_State::$post_meta[77] = array('_enable_progress_bar' => 'yes');
		$summary = \DonationPanel\Core\Version_Migrations::step_10_31_0(false);
		$this->assertStringContainsString('updated_default', $summary);
		$this->assertStringContainsString('yurt dışındaki saha', WDP_Test_State::$options['wdp_button_settings']['privacy_notice_text']);
		$this->assertStringContainsString('already', \DonationPanel\Core\Version_Migrations::step_10_31_0(false));
	}

	public function test_goal_message_max_300(): void {
		$long = str_repeat('a', 350);
		$this->assertSame(300, strlen(\DonationPanel\Domain\Campaign_Goal::sanitize_message($long)));
	}
}
