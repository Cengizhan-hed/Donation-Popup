<?php
/**
 * woocommerce_get_price_html gizleme bağlamları.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class PriceHtmlContextTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array(
			'auto_place'     => 'yes',
			'hide_price'     => 'yes',
			'donation_scope' => 'all',
		);
		WDP_Placement_Settings::flush();
	}

	private function product(int $id, string $donation_type = 'custom'): WC_Product {
		$p       = new WC_Product($id);
		$p->type = 'simple';
		WDP_Test_State::$products[ $id ] = $p;
		if ($donation_type === 'custom') {
			WDP_Test_State::$post_meta[ $id ]['_allow_custom_price'] = 'yes';
		} elseif ($donation_type === 'campaign') {
			WDP_Test_State::$post_meta[ $id ]['_enable_progress_bar'] = 'yes';
			WDP_Test_State::$post_meta[ $id ]['_allow_custom_price']  = 'yes';
		} elseif ($donation_type === 'shares') {
			WDP_Test_State::$post_meta[ $id ]['_allow_multiple_shares'] = 'yes';
		}
		return $p;
	}

	public function test_custom_price_hidden_on_front(): void {
		$p = $this->product(30, 'custom');
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html('<span>10</span>', $p));
	}

	public function test_fixed_and_shares_keep_price(): void {
		$fixed  = $this->product(31, 'fixed');
		$shares = $this->product(32, 'shares');
		$this->assertSame('<span>10</span>', \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html('<span>10</span>', $fixed));
		$this->assertSame('<span>20</span>', \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html('<span>20</span>', $shares));
	}

	public function test_admin_cart_checkout_rest_email_preserved(): void {
		$p = $this->product(33, 'custom');
		$html = '<span>10</span>';

		WDP_Test_State::$is_admin = true;
		$this->assertSame($html, \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html($html, $p));
		WDP_Test_State::$is_admin = false;

		WDP_Test_State::$is_cart = true;
		$this->assertSame($html, \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html($html, $p));
		WDP_Test_State::$is_cart = false;

		WDP_Test_State::$is_checkout = true;
		$this->assertSame($html, \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html($html, $p));
		WDP_Test_State::$is_checkout = false;

		WDP_Test_State::$did_actions['woocommerce_email_header'] = 1;
		$this->assertSame($html, \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html($html, $p));
		WDP_Test_State::$did_actions = array();
	}

	public function test_cart_fragment_ajax_preserved(): void {
		$p = $this->product(34, 'campaign');
		WDP_Test_State::$doing_ajax = true;
		$_REQUEST['wc-ajax']       = 'get_refreshed_fragments';
		$this->assertSame('<span>10</span>', \DonationPanel\Modules\EntryPoints\Loop_Price_Filters::filter_price_html('<span>10</span>', $p));
	}
}
