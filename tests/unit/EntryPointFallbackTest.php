<?php
/**
 * Otomatik giriş noktası yedeği: giriş yoksa çiz, varsa çizme, çift giriş yok, ID'siz çözüm.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class EntryPointFallbackTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		\DonationPanel\Modules\EntryPoints\Render_Registry::reset();
		\DonationPanel\Modules\EntryPoints\Auto_Placement::reset_request_flags();
		\DonationPanel\Domain\Placement_Settings::flush();
		$this->settings(array());
		unset($GLOBALS['product'], $GLOBALS['post']);
		// Gerçek deneyim modülü yok: giriş noktası köprüsü sahte işaretleme alır (kapsam: giriş noktası mantığı).
		WDP_Test_State::$filters['donation_panel_experience_html'] = static function ($html, $product_id, $kind, $text) {
			return '<div class="donation-panel donation-panel-exp" data-dp-exp data-dp-product="' . (int) $product_id . '" data-dp-kind="' . $kind . '">' . $text . '</div>';
		};
	}

	protected function tearDown(): void {
		unset($GLOBALS['product'], $GLOBALS['post']);
		\DonationPanel\Modules\EntryPoints\Render_Registry::reset();
	}

	/**
	 * @param array<string, string> $extra Placement overrides.
	 */
	private function settings(array $extra): void {
		WDP_Test_State::$options[ \DonationPanel\Domain\Placement_Settings::OPTION ] = array_merge(
			array(
				'auto_place'     => 'yes',
				'display'        => 'button_panel',
				'donation_scope' => 'all',
			),
			$extra
		);
		\DonationPanel\Domain\Placement_Settings::flush();
	}

	private function product(int $id): WC_Product {
		$p                               = new WC_Product($id);
		$p->type                         = 'simple';
		$p->name                         = 'Bağış ' . $id;
		WDP_Test_State::$products[ $id ] = $p;
		WDP_Test_State::$queried_id      = $id;
		WDP_Test_State::$is_product      = true;
		$GLOBALS['product']              = $p;
		return $p;
	}

	private function fallback_html(): string {
		ob_start();
		\DonationPanel\Modules\EntryPoints\Fallback_Button::render_builder_fallback();
		return (string) ob_get_clean();
	}

	public function test_fallback_draws_button_when_no_entry(): void {
		$this->product(30);
		$html = $this->fallback_html();
		$this->assertStringContainsString('data-dp-exp', $html);
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::has_product_ui(30));
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Render_Registry::has_auto(30));
	}

	public function test_fallback_runs_once_even_if_hooked_twice(): void {
		$this->product(31);
		$first  = $this->fallback_html();
		$second = $this->fallback_html();
		$this->assertStringContainsString('data-dp-exp', $first);
		$this->assertSame('', $second);
	}

	public function test_snippet_shortcode_via_do_shortcode_counts_as_entry(): void {
		$this->product(32);
		$snippet = \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_panel_shortcode(array('id' => '32'));
		$this->assertStringContainsString('data-dp-exp', $snippet);
		$this->assertSame('', $this->fallback_html());
		$this->assertStringNotContainsString('wdp-auto-place-fallback', $this->fallback_html());
	}

	public function test_inline_form_entry_counts(): void {
		$this->product(33);
		\DonationPanel\Modules\EntryPoints\Render_Registry::claim_form(33);
		$this->assertSame('', $this->fallback_html());
	}

	public function test_later_explicit_shortcode_is_skipped_after_auto_entry(): void {
		$this->product(34);
		$this->assertStringContainsString('data-dp-exp', $this->fallback_html());
		$late = \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_panel_shortcode(array('id' => '34'));
		$this->assertSame('', $late);
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_form_shortcode(array('id' => '34')));
	}

	public function test_multiple_entries_filter_allows_late_shortcode(): void {
		$this->product(35);
		$this->fallback_html();
		add_filter(
			'wdp_allow_multiple_entries',
			static function () {
				return true;
			}
		);
		$late = \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_panel_shortcode(array('id' => '35'));
		$this->assertStringContainsString('data-dp-exp', $late);
	}

	public function test_other_product_entry_does_not_block(): void {
		$this->product(36);
		$this->product(37);
		WDP_Test_State::$queried_id = 36;
		$GLOBALS['product']         = WDP_Test_State::$products[36];
		\DonationPanel\Modules\EntryPoints\Render_Registry::mark_trigger(37);
		$this->assertStringContainsString('data-dp-exp', $this->fallback_html());
	}

	public function test_global_setting_off_draws_nothing(): void {
		$this->settings(array('auto_place' => 'no'));
		$this->product(38);
		$this->assertSame('', $this->fallback_html());
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Render_Registry::has_product_ui(38));
	}

	public function test_product_override_off_draws_nothing(): void {
		$this->product(39);
		WDP_Test_State::$post_meta[39]['_wdp_auto_place'] = 'no';
		$this->assertSame('', $this->fallback_html());
	}

	public function test_not_a_product_page_draws_nothing(): void {
		$this->product(40);
		WDP_Test_State::$is_product = false;
		$this->assertSame('', $this->fallback_html());
	}

	public function test_fallback_hooks_are_late_and_name_agnostic(): void {
		$this->assertSame(999, \DonationPanel\Modules\EntryPoints\Fallback_Button::FALLBACK_PRIORITY);
		\DonationPanel\Modules\EntryPoints\Auto_Placement::init();
		$this->assertArrayHasKey('woocommerce_after_single_product', WDP_Test_State::$actions);
		$src = (string) file_get_contents(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/class-fallback-button.php');
		$this->assertDoesNotMatchRegularExpression('/avada|elementor|divi|blocksy|storefront/i', $this->fallback_source($src));
	}

	private function fallback_source(string $src): string {
		$start = strpos($src, 'public static function render_builder_fallback');
		$end   = strpos($src, 'public static function render_fallback_placed_form');
		return substr($src, (int) $start, (int) $end - (int) $start);
	}

	public function test_block_add_to_cart_keeps_entry_drawn_by_template_override(): void {
		$this->product(45);
		$entry = \DonationPanel\Modules\EntryPoints\Shortcodes::render_button(array('id' => 45), 'wdp_donation_button', 'popup');
		$this->assertTrue(\DonationPanel\Modules\EntryPoints\Auto_Placement::html_has_entry($entry, 45));
		$out = \DonationPanel\Modules\EntryPoints\Auto_Placement::filter_block_add_to_cart($entry, array(), null);
		$this->assertSame($entry, $out);
	}

	public function test_block_add_to_cart_drops_native_content_when_other_entry_exists(): void {
		$this->product(46);
		\DonationPanel\Modules\EntryPoints\Render_Registry::mark_trigger(46);
		$out = \DonationPanel\Modules\EntryPoints\Auto_Placement::filter_block_add_to_cart('<form class="cart">native</form>', array(), null);
		$this->assertStringNotContainsString('native', $out);
	}

	public function test_html_has_entry_ignores_other_products(): void {
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Auto_Placement::html_has_entry('<div data-dp-exp data-dp-product="7">', 8));
		$this->assertFalse(\DonationPanel\Modules\EntryPoints\Auto_Placement::html_has_entry('', 8));
	}

	// --- ID'siz çözüm ---

	public function test_idless_button_uses_global_product(): void {
		$this->product(41);
		$this->assertStringContainsString('data-dp-product="41"', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_shortcode(array()));
	}

	public function test_idless_panel_and_form_use_queried_object_without_global(): void {
		$this->product(42);
		unset($GLOBALS['product']);
		WDP_Test_State::$is_product = false;
		WDP_Test_State::$queried_id = 0;
		$post                       = new stdClass();
		$post->ID                   = 42;
		$post->post_type            = 'product';
		WDP_Test_State::$queried_object = $post;
		$this->assertStringContainsString('data-dp-product="42"', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_panel_shortcode(array()));
	}

	public function test_idless_from_global_post_when_template_runs_outside_loop(): void {
		$this->product(43);
		unset($GLOBALS['product']);
		WDP_Test_State::$is_product = false;
		WDP_Test_State::$queried_id = 0;
		$post                       = new stdClass();
		$post->ID                   = 43;
		$post->post_type            = 'product';
		$GLOBALS['post']            = $post;
		$resolved = \DonationPanel\Modules\EntryPoints\Product_Resolver::resolve(array());
		$this->assertSame(43, $resolved->get_id());
	}

	public function test_idless_block_context_post_id(): void {
		$this->product(44);
		unset($GLOBALS['product']);
		WDP_Test_State::$is_product = false;
		$html = \DonationPanel\Modules\EntryPoints\Shortcodes::render_button(array(), 'wdp_donation_button', 'popup', array('postId' => 44, 'postType' => 'product'));
		$this->assertStringContainsString('data-dp-product="44"', $html);
	}

	public function test_idless_unresolvable_is_silently_empty(): void {
		WDP_Test_State::$is_product = false;
		WDP_Test_State::$queried_id = 0;
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_shortcode(array()));
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_button_panel_shortcode(array()));
		$this->assertSame('', \DonationPanel\Modules\EntryPoints\Shortcodes::donation_form_shortcode(array()));
	}

	public function test_non_product_post_is_not_resolved(): void {
		$post            = new stdClass();
		$post->ID        = 50;
		$post->post_type = 'page';
		WDP_Test_State::$queried_object = $post;
		$this->assertNull(\DonationPanel\Modules\EntryPoints\Product_Resolver::resolve(array()));
	}
}
