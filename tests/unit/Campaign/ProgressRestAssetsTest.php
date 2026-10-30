<?php
/**
 * 12.3 (progress2): REST'le gelen katman (mağaza/kategori döngü kartı) kampanyalı formda canlı çubuk paketini yalnız
 * SUNUCU yanıtından alır: kampanyalı ürün kimlikleri + kayıtlı betik adresi (sürümlü) + satır içi stil. Kampanyasız
 * yanıtta anahtar yoktur; `DONATION_PANEL_DISABLE` açıkken adres yoktur.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Container;
use DonationPanel\Frontend\Assets;
use DonationPanel\Modules\Campaign\Campaign_Module;
use DonationPanel\Modules\Campaign\Progress_Live;
use DonationPanel\Modules\EntryPoints\Experience_Controller;
use PHPUnit\Framework\TestCase;

final class ProgressRestAssetsTest extends TestCase {

	/** @var string */
	private $dir = '';

	protected function setUp(): void {
		WDP_Test_State::reset();
		$this->dir = sys_get_temp_dir() . '/wdp-pra-' . uniqid();
		mkdir($this->dir . '/assets/build/progress', 0777, true);
		file_put_contents($this->dir . '/assets/build/progress/index.js', '//');
		file_put_contents($this->dir . '/assets/build/progress/index.css', '.donation-panel .donation-panel-live__pv{opacity:0}');
		file_put_contents($this->dir . '/assets/build/progress/index.asset.php', "<?php return array('dependencies' => array(), 'version' => 'abc123');");
	}

	protected function tearDown(): void {
		foreach (array( 'index.js', 'index.css', 'index.asset.php' ) as $f) {
			@unlink($this->dir . '/assets/build/progress/' . $f); // phpcs:ignore
		}
		@rmdir($this->dir . '/assets/build/progress'); // phpcs:ignore
		@rmdir($this->dir . '/assets/build'); // phpcs:ignore
		@rmdir($this->dir . '/assets'); // phpcs:ignore
		@rmdir($this->dir); // phpcs:ignore
	}

	/**
	 * @return array{0: Campaign_Module, 1: Assets}
	 */
	private function module(): array {
		$container = new Container();
		$assets    = new Assets($this->dir, 'https://example.test/wp-content/plugins/woo-donation-popup');
		$container->instance(Assets::class, $assets);
		$module = new Campaign_Module();
		$module->register($container);
		return array( $module, $assets );
	}

	public function test_script_url_is_the_registered_versioned_build_file(): void {
		list( , $assets ) = $this->module();
		$this->assertSame('https://example.test/wp-content/plugins/woo-donation-popup/assets/build/progress/index.js?ver=abc123', $assets->script_url(Progress_Live::ASSET));
		$this->assertSame('', $assets->script_url('missing'));
	}

	public function test_only_campaign_forms_are_listed_with_server_url_and_inline_style(): void {
		list( $module ) = $this->module();
		$out            = $module->rest_assets(
			array(),
			array(
				77 => array( 'campaign' => array( 'live' => array( 'id' => 77 ) ) ),
				78 => array( 'product_id' => 78 ),
				79 => array( 'campaign' => array( 'raised' => '1' ) ),
			)
		);
		$this->assertSame(array( 77 ), $out['progress']['ids']);
		$this->assertStringEndsWith('/assets/build/progress/index.js?ver=abc123', $out['progress']['script']);
		$this->assertStringContainsString('donation-panel-live__pv', $out['progress']['style']);
	}

	public function test_no_campaign_means_no_key(): void {
		list( $module ) = $this->module();
		$this->assertSame(array(), $module->rest_assets(array(), array( 78 => array( 'product_id' => 78 ) )));
	}

	public function test_guide_progress_section_mentions_shop_and_list_cards(): void {
		$sections = \DonationPanel\Admin\Guide::sections();
		$body     = implode( "\n", $sections['progress']['body'] );
		$this->assertStringContainsString('Shop, category and donation list cards', $body);
	}

	public function test_controller_adds_assets_only_when_filter_returns_some(): void {
		list( $module ) = $this->module();
		$body           = array(
			'kind'  => 'popup',
			'items' => array( '77' => '<div></div>' ),
		);
		$this->assertArrayNotHasKey('assets', Experience_Controller::with_assets($body, array( 78 => array() )));
		$with = Experience_Controller::with_assets($body, array( 77 => array( 'campaign' => array( 'live' => array( 'id' => 77 ) ) ) ));
		$this->assertSame(array( 77 ), $with['assets']['progress']['ids']);
		$this->assertSame($body['items'], $with['items']);
		unset( $module );
	}
}
