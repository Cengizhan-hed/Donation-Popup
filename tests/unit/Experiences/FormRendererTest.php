<?php
/**
 * E2A: Form_Renderer + dört kap + tema geçersiz kılma.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Frontend\Template_Loader;
use DonationPanel\Modules\Experiences\Experience_Container;
use DonationPanel\Modules\Experiences\Form_Context;
use DonationPanel\Modules\Experiences\Form_Renderer;
use PHPUnit\Framework\TestCase;

final class FormRendererTest extends TestCase {

	/** @var string */
	private $tmp = '';

	protected function setUp(): void {
		WDP_Test_State::reset();
		$this->tmp = sys_get_temp_dir() . '/wdp-e2a-' . uniqid( '', true );
	}

	protected function tearDown(): void {
		if ( '' !== $this->tmp && is_dir( $this->tmp ) ) {
			$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $this->tmp, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
			foreach ( $it as $f ) {
				$f->isDir() ? rmdir( (string) $f ) : unlink( (string) $f );
			}
			rmdir( $this->tmp );
		}
	}

	/**
	 * @param string[] $theme_roots Tema kökleri.
	 */
	private function renderer( array $theme_roots = array() ): Form_Renderer {
		return new Form_Renderer(
			new Template_Loader(
				WDP_PLUGIN_DIR,
				static function () use ( $theme_roots ) {
					return $theme_roots;
				}
			)
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function model(): array {
		return Form_Context::from_legacy(
			array(
				'product_id'            => 7,
				'product_name'          => 'Çocuk Eğitim <b>Bağışı</b>',
				'allow_custom_price'    => true,
				'min_price'             => '0',
				'enable_amount_presets' => true,
				'amount_presets'        => '50 100',
				'enable_email'          => true,
				'enable_dedication'     => true,
				'currency_symbol'       => '₺',
			)
		);
	}

	/**
	 * @return array<string, array{0: string, 1: string}>
	 */
	public static function kinds(): array {
		return array(
			'popup'        => array( 'popup', 'dp-overlay--modal' ),
			'side_panel'   => array( 'side_panel', 'dp-overlay--panel' ),
			'bottom_sheet' => array( 'bottom_sheet', 'dp-overlay--sheet' ),
		);
	}

	/**
	 * @dataProvider kinds
	 */
	public function test_layer_containers_render_one_core_form( string $kind, string $overlay_class ): void {
		$html = $this->renderer()->render( $this->model(), $kind );
		$this->assertStringContainsString( $overlay_class, $html );
		$this->assertSame( 1, substr_count( $html, 'data-dp-form' ) );
		$this->assertStringContainsString( 'role="dialog"', $html );
		$this->assertStringContainsString( 'aria-modal="true"', $html );
		$this->assertStringContainsString( 'data-dp-kind="' . $kind . '"', $html );
	}

	public function test_inline_container_has_no_dialog_or_trigger(): void {
		$html = $this->renderer()->render( $this->model(), 'inline' );
		$this->assertStringNotContainsString( 'role="dialog"', $html );
		$this->assertStringNotContainsString( 'data-dp-open', $html );
		$this->assertStringContainsString( 'dp-inline', $html );
		$this->assertSame( 1, substr_count( $html, 'data-dp-form' ) );
	}

	public function test_title_is_escaped_and_turkish_characters_survive(): void {
		$html = $this->renderer()->render( $this->model(), 'inline' );
		$this->assertStringContainsString( 'Çocuk Eğitim &lt;b&gt;Bağışı&lt;/b&gt;', $html );
		$this->assertStringNotContainsString( '<b>Bağışı</b>', $html );
	}

	public function test_form_has_labelled_amount_group_and_touch_friendly_controls(): void {
		$html = $this->renderer()->render_form( $this->model(), 'dp-7-test' );
		$this->assertStringContainsString( 'role="radiogroup"', $html );
		$this->assertSame( 2, substr_count( $html, 'role="radio"' ) );
		$this->assertStringContainsString( 'for="dp-7-test-donation_full_name"', $html );
		$this->assertStringContainsString( 'autocomplete="name"', $html );
		$this->assertStringContainsString( 'name="donation_dedication"', $html );
		$this->assertStringContainsString( 'name="donation_email"', $html );
	}

	public function test_instances_get_unique_ids(): void {
		$renderer = $this->renderer();
		$first    = $renderer->render( $this->model(), 'popup' );
		$second   = $renderer->render( $this->model(), 'popup' );
		preg_match( '/id="(dp-7-popup-\d+)"/', $first, $a );
		preg_match( '/id="(dp-7-popup-\d+)"/', $second, $b );
		$this->assertNotSame( $a[1], $b[1] );
	}

	public function test_empty_model_renders_nothing(): void {
		$this->assertSame( '', $this->renderer()->render( array(), 'popup' ) );
	}

	public function test_theme_overrides_container_template(): void {
		mkdir( $this->tmp . '/theme/donation-panel/experiences', 0777, true );
		file_put_contents( $this->tmp . '/theme/donation-panel/experiences/inline.php', 'THEME-INLINE:<?php echo esc_html( $args["model"]["title"] ); ?>' );
		$html = $this->renderer( array( $this->tmp . '/theme' ) )->render( $this->model(), 'inline' );
		$this->assertStringStartsWith( 'THEME-INLINE:', $html );
	}

	public function test_container_factory_aliases(): void {
		$this->assertSame( 'side_panel', Experience_Container::make( 'panel' )->slug() );
		$this->assertSame( 'bottom_sheet', Experience_Container::make( 'sheet' )->slug() );
		$this->assertSame( 'inline', Experience_Container::make( 'inline' )->slug() );
		$this->assertSame( 'popup', Experience_Container::make( 'bogus' )->slug() );
		$this->assertFalse( Experience_Container::make( 'inline' )->is_layer() );
		$this->assertTrue( Experience_Container::make( 'popup' )->is_layer() );
	}
}
