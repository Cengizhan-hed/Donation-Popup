<?php
/**
 * Tip × kritik aç/kapa kombinasyonlarında bağlam üretimi uyarı üretmez.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RenderMatrixTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options[ WDP_Placement_Settings::OPTION ] = array('donation_scope' => 'all');
		WDP_Test_State::$options['wdp_button_settings']            = array();
	}

	/**
	 * @return array<int, array<string, string>>
	 */
	private function flag_sets(): array {
		$on  = 'yes';
		$off = 'no';
		return array(
			array(),
			array('_enable_wizard' => $on, '_enable_quantity' => $on, '_enable_amount_presets' => $on),
			array('_enable_field_icons' => $off, '_enable_trust_strip' => $on, '_trust_badges' => '[{"icon":"lock","text":"SSL"}]'),
			array('_enable_email' => $on, '_enable_dedication' => $on, '_enable_anonymous' => $on),
			array('_enable_urgency' => $on, '_enable_social_proof' => $on, '_enable_impact_line' => $on),
			array('_enable_campaign_media' => $on, '_layout_mode' => 'story', '_wdp_module_order' => 'media,impact,urgency'),
			array('_enable_addon_donation' => $on, '_addon_fixed_price' => '10', '_addon_wc_product_id' => '999'),
			array('_layout_mode' => 'campaign'),
			array('_layout_mode' => 'not-a-mode'),
		);
	}

	public function test_all_types_and_flag_sets_build_context(): void {
		$id = 20;
		foreach (WDP_Donation_Type::ids() as $type) {
			foreach ($this->flag_sets() as $extra) {
				$id++;
				$p        = new WC_Product($id);
				$p->price = $type === WDP_Donation_Type::FIXED ? '25' : '0';
				$p->type  = 'simple';
				$p->name  = 'Kampanya ' . $id;
				WDP_Test_State::$products[ $id ] = $p;
				WDP_Test_State::$post_meta[ $id ] = array_merge(WDP_Donation_Type::to_meta($type), $extra);
				$context = WDP_Donation_Product_Context_Service::build_form_context($p);
				$this->assertSame($id, $context['product_id']);
				$this->assertArrayHasKey('allow_custom_price', $context);
				$this->assertArrayHasKey('module_order', $context);
				$this->assertContains($context['layout_mode'], array('classic', 'campaign', 'story'));
			}
		}
	}

	public function test_form_context_filter_can_simulate_type(): void {
		$p = new WC_Product(50);
		$p->type = 'simple';
		WDP_Test_State::$products[50] = $p;
		WDP_Test_State::$post_meta[50] = WDP_Donation_Type::to_meta(WDP_Donation_Type::FIXED);
		add_filter(
			'wdp_form_context',
			static function ($context) {
				$context['allow_custom_price'] = true;
				return $context;
			}
		);
		$context = WDP_Donation_Product_Context_Service::build_form_context($p);
		$this->assertTrue($context['allow_custom_price']);
	}
}
