<?php
/**
 * Ürün "Donation" sekmesi: yetki, nonce, kayıt, tab kaydı (WooCommerce standart kancaları).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Admin\Product\Product_Data_Tab;
use DonationPanel\Admin\Product\Product_List;
use PHPUnit\Framework\TestCase;

if (!class_exists('WC_Admin_Meta_Boxes')) {
	class WC_Admin_Meta_Boxes {
		/** @var string[] */
		public static $errors = array();

		public static function add_error($message) {
			self::$errors[] = (string) $message;
		}
	}
}

final class ProductDataTabTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WC_Admin_Meta_Boxes::$errors = array();
		$_POST                       = array();
		WDP_Test_State::$caps        = array('manage_woocommerce', 'edit_post');
	}

	protected function tearDown(): void {
		$_POST = array();
	}

	private function product(int $id = 70): WC_Product {
		$p                               = new WC_Product($id);
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	/** @param array<string, mixed> $fields */
	private function post(array $fields, string $nonce = 'abc'): void {
		$_POST = array(
			Product_Data_Tab::NONCE_FIELD => $nonce,
			Product_Data_Tab::FIELD_NAME  => $fields,
		);
	}

	public function test_tab_is_added_with_the_woocommerce_tab_api_for_authorised_users_only(): void {
		$tabs = Product_Data_Tab::add_tab(array('general' => array()));
		$this->assertArrayHasKey(Product_Data_Tab::TAB_KEY, $tabs);
		$this->assertSame(Product_Data_Tab::PANEL_ID, $tabs[ Product_Data_Tab::TAB_KEY ]['target']);
		$this->assertContains('show_if_simple', $tabs[ Product_Data_Tab::TAB_KEY ]['class']);

		WDP_Test_State::$caps = array();
		$this->assertArrayNotHasKey(Product_Data_Tab::TAB_KEY, Product_Data_Tab::add_tab(array('general' => array())));
	}

	public function test_save_writes_validated_meta_with_turkish_characters(): void {
		$p = $this->product();
		$this->post(
			array(
				'donation_type'          => 'campaign',
				'progress_bar_limit'     => '2500',
				'dedication_placeholder' => addslashes('Şükrü Bey adına, ğüöıİ'),
				'enable_dedication'      => 'yes',
			)
		);
		Product_Data_Tab::save($p);
		$this->assertSame('yes', $p->get_meta('_enable_progress_bar'));
		$this->assertSame('2500', $p->get_meta('_progress_bar_limit'));
		$this->assertSame('Şükrü Bey adına, ğüöıİ', $p->get_meta('_dedication_placeholder'));
		$this->assertSame('yes', $p->get_meta('_enable_dedication'));
	}

	public function test_save_without_a_valid_nonce_changes_nothing(): void {
		$p = $this->product();
		$this->post(array('donation_type' => 'custom'), '');
		Product_Data_Tab::save($p);
		$this->assertSame('', $p->get_meta('_allow_custom_price'));
	}

	public function test_save_without_the_capability_changes_nothing(): void {
		$p = $this->product();
		$this->post(array('donation_type' => 'custom'));
		WDP_Test_State::$caps = array('edit_post');
		Product_Data_Tab::save($p);
		$this->assertSame('', $p->get_meta('_allow_custom_price'));
	}

	public function test_save_never_touches_hidden_or_removed_meta(): void {
		$p                  = $this->product();
		$p->meta            = array(
			'_wdp_manual_total'    => '120',
			'_wdp_carried_amount'  => '4000',
			'_enable_urgency'      => 'yes',
			'_theme_primary'       => '#123456',
			'_trust_badges'        => '[{"icon":"x","text":"Güvenli"}]',
		);
		WDP_Test_State::$post_meta[70] = $p->meta;
		$this->post(array('donation_type' => 'custom'));
		Product_Data_Tab::save($p);
		$this->assertSame('120', $p->get_meta('_wdp_manual_total'));
		$this->assertSame('4000', $p->get_meta('_wdp_carried_amount'));
		$this->assertSame('yes', $p->get_meta('_enable_urgency'));
		$this->assertSame('#123456', $p->get_meta('_theme_primary'));
		$this->assertStringContainsString('Güvenli', (string) $p->get_meta('_trust_badges'));
	}

	public function test_rejected_input_raises_a_woocommerce_notice_and_keeps_the_stored_value(): void {
		$p = $this->product();
		$p->meta                       = array('_cover_fee_percent' => '3');
		WDP_Test_State::$post_meta[70] = $p->meta;
		$this->post(array('donation_type' => 'custom', 'cover_fee_percent' => '80'));
		Product_Data_Tab::save($p);
		$this->assertSame('3', $p->get_meta('_cover_fee_percent'));
		$this->assertNotEmpty(WC_Admin_Meta_Boxes::$errors);
	}

	public function test_shortcodes_keep_their_names_and_the_id_attribute(): void {
		$codes = array_column(Product_Data_Tab::get_shortcodes(9), 'code');
		$this->assertSame(
			array('[wdp_donation_button id="9"]', '[wdp_donation_button_panel id="9"]', '[wdp_donation_form id="9"]'),
			$codes
		);
	}

	public function test_bulk_actions_are_added_only_for_authorised_users_and_apply_the_flag(): void {
		$this->assertArrayHasKey('wdp_mark_donation', Product_List::register_actions(array()));
		WDP_Test_State::$caps = array();
		$this->assertSame(array(), Product_List::register_actions(array()));
		$this->assertSame('https://example.test/edit', Product_List::handle_actions('https://example.test/edit', 'wdp_mark_donation', array(70)));

		WDP_Test_State::$caps = array('manage_woocommerce', 'edit_post');
		$p                    = $this->product();
		$url                  = Product_List::handle_actions('https://example.test/edit', 'wdp_mark_donation', array(70));
		$this->assertStringContainsString('wdp_bulk_marked=1', $url);
		$this->assertSame('yes', $p->get_meta('_wdp_donation_product'));
		$this->assertSame('https://example.test/edit', Product_List::handle_actions('https://example.test/edit', 'other', array(70)));
	}
}
