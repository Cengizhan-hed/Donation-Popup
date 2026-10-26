<?php
/**
 * Yönetici CSS/JS yalnız eklentinin kendi ekranlarında yüklenir (Y6).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

if (!function_exists('wp_add_inline_script')) {
	function wp_add_inline_script(...$args) {
		return true;
	}
}
if (!function_exists('wp_enqueue_media')) {
	function wp_enqueue_media(...$args) {}
}
if (!function_exists('get_current_screen')) {
	function get_current_screen() {
		return WDP_Test_State::$options['__screen'] ?? null;
	}
}

final class AdminAssetsScreenTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps = array('manage_woocommerce', 'manage_options', 'edit_products');
	}

	/** @return string[] bizim (wdp-) handle'lar */
	private function ours(): array {
		$all = array_merge(
			WDP_Test_State::$options['__enqueued_scripts'] ?? array(),
			WDP_Test_State::$options['__enqueued_styles'] ?? array()
		);
		return array_values(array_filter(array_unique($all), static function ($h) {
			return strpos((string) $h, 'wdp-') === 0;
		}));
	}

	/** @return array<string, array{0: string}> */
	public function foreign_screens(): array {
		return array(
			'plugins'            => array('plugins.php'),
			'dashboard'          => array('index.php'),
			'woocommerce ayar'   => array('woocommerce_page_wc-settings'),
			'woocommerce durum'  => array('woocommerce_page_wc-status'),
			'siparisler'         => array('woocommerce_page_wc-orders'),
			'ürün listesi'       => array('edit.php'),
			'sayfa düzenleme'    => array('page-new-unknown'),
			'ayarlar'            => array('options-general.php'),
			'tema'               => array('themes.php'),
			'diğer woo ekranı'   => array('toplevel_page_elementor'),
		);
	}

	/**
	 * @dataProvider foreign_screens
	 */
	public function test_no_wdp_handles_on_foreign_screens(string $hook): void {
		WDP_Admin_Assets::enqueue($hook);
		$this->assertSame(array(), $this->ours(), $hook . ' ekranında wdp- varlığı yüklenmemeli');
	}

	public function test_post_editor_for_non_product_loads_nothing(): void {
		WDP_Test_State::$options['__screen'] = (object) array('post_type' => 'page');
		WDP_Admin_Assets::enqueue('post.php');
		WDP_Admin_Assets::enqueue('post-new.php');
		$this->assertSame(array(), $this->ours());
	}

	public function test_product_editor_loads_only_product_tab_assets(): void {
		WDP_Test_State::$options['__screen'] = (object) array('post_type' => 'product');
		WDP_Admin_Assets::enqueue('post.php');
		$ours = $this->ours();
		$this->assertContains('wdp-admin-products', $ours);
		$this->assertNotContains('wdp-admin-js', $ours);
		$this->assertNotContains('wdp-admin-css', $ours);
	}

	public function test_product_editor_without_capability_loads_nothing(): void {
		WDP_Test_State::$caps = array();
		WDP_Test_State::$options['__screen'] = (object) array('post_type' => 'product');
		WDP_Admin_Assets::enqueue('post.php');
		$this->assertSame(array(), $this->ours());
	}

	public function test_own_settings_screen_loads_admin_assets(): void {
		WDP_Admin_Assets::enqueue(WDP_Admin_Assets::PAGE_HOOK);
		$ours = $this->ours();
		$this->assertContains('wdp-admin-js', $ours);
		$this->assertContains('wdp-admin-css', $ours);
		$this->assertContains('wdp-admin-products', $ours);
	}
}
