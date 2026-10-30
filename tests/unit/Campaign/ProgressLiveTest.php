<?php
/**
 * 12.3 canlı ilerleme çubuğu: ortak yapılandırma, kart çıktısı, ayarlar (ayarda görünen = uygulanan), Rehber bölümü.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Admin\Admin_Bootstrap;
use DonationPanel\Admin\Field_Registry;
use DonationPanel\Admin\Guide;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\Campaign\Progress_Data;
use DonationPanel\Modules\Campaign\Progress_Live;
use DonationPanel\Modules\Campaign\Progress_Renderer;
use PHPUnit\Framework\TestCase;

if ( ! function_exists( '_n' ) ) {
	function _n( $single, $plural, $number, $domain = 'default' ) { // phpcs:ignore
		return 1 === (int) $number ? $single : $plural;
	}
}

final class ProgressLiveTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @param float $raised Toplanan.
	 * @param float $goal   Hedef.
	 * @param int   $donors Bağışçı.
	 * @return array<string, mixed>
	 */
	private function data( $raised, $goal = 3000.0, $donors = 0 ): array {
		return Progress_Data::build(
			array(
				'product_id' => 77,
				'raised'     => $raised,
				'goal'       => $goal,
				'donors'     => $donors,
				'milestones' => array(),
				'reached'    => $raised >= $goal,
				'decimals'   => 2,
				'symbol'     => '£',
				'currency'   => 'GBP',
			)
		);
	}

	/**
	 * Çevrilmiş yüzde kalıbıyla beklenen metin (test ortamı dili bağımsız).
	 *
	 * @param string $n Sayı metni.
	 * @return string
	 */
	private function pct( $n ): string {
		$pattern = Progress_Live::texts()['pct'];
		return str_replace( array( '{n}', '.' ), array( $n, wc_get_price_decimal_separator() ), $pattern );
	}

	public function test_percent_text_floors_and_never_shows_100_before_goal(): void {
		$this->assertContains( Progress_Live::texts()['pct'], array( '{n}%', '%{n}' ) );
		$this->assertSame( $this->pct( '41' ), Progress_Live::percent_text( 41.67, 0 ) );
		$this->assertSame( $this->pct( '41.6' ), Progress_Live::percent_text( 41.67, 1 ) );
		$this->assertSame( $this->pct( '99' ), Progress_Live::percent_text( 99.99, 0 ) );
		$this->assertSame( $this->pct( '100' ), Progress_Live::percent_text( 100.0, 0 ) );
		$this->assertSame( $this->pct( '0' ), Progress_Live::percent_text( -5, 1 ) );
	}

	public function test_config_has_public_data_settings_and_patterns_only(): void {
		$config = Progress_Live::config( $this->data( 1250.0, 3000.0, 12 ) );
		$this->assertSame( 77, $config['id'] );
		$this->assertSame( 1250.0, $config['raised'] );
		$this->assertSame( 3000.0, $config['goal'] );
		$this->assertSame( 12, $config['donors'] );
		$this->assertSame( 0, $config['pd'] );
		$this->assertSame(
			array(
				'p' => 1,
				'c' => 1,
				'k' => 1,
			),
			$config['o']
		);
		$this->assertStringContainsString( '{n}', $config['t']['pct'] );
		foreach ( array( 'with', 'cart', 'goal' ) as $key ) {
			$this->assertStringContainsString( '%1$s', $config['t'][ $key ] );
		}
		$this->assertStringContainsString( '%2$s', $config['t']['with'] );
		$this->assertArrayNotHasKey( 'fresh', $config );
		$this->assertSame( array( 'id', 'pd', 'raised', 'goal', 'donors', 'reached', 'cur', 'o', 't' ), array_values( array_diff( array_keys( $config ), array( 'v' ) ) ) );
		// Güvenlik: öznitelikte adres yok; yalnız doğrulanmış sürüm belirteci.
		$this->assertArrayNotHasKey( 'src', $config );
		$this->assertArrayNotHasKey( 'css', $config );
		$this->assertMatchesRegularExpression( '/^[A-Za-z0-9._-]{1,64}$/', (string) $config['v'] );
		$this->assertStringNotContainsString( 'http', (string) wp_json_encode( $config ) );
		$this->assertSame( array( 's', 'd', 'ds', 'ts', 'pos' ), array_keys( $config['cur'] ) );
	}

	public function test_settings_switches_reach_the_bar(): void {
		( new Settings() )->update(
			array(
				'progress' => array(
					'preview'   => false,
					'count'     => false,
					'celebrate' => false,
				),
			)
		);
		$config = Progress_Live::config( $this->data( 10.0 ) );
		$this->assertSame(
			array(
				'p' => 0,
				'c' => 0,
				'k' => 0,
			),
			$config['o']
		);
		$this->assertSame( ' donation-panel-live--static', Progress_Live::root_class( $config ) );
		$html = Progress_Renderer::render( $this->data( 10.0 ) );
		$this->assertStringContainsString( 'donation-panel-live--static', $html );
	}

	public function test_almost_reached_goal_is_not_shown_as_100(): void {
		$data = $this->data( 2999.0 );
		$this->assertSame( 100.0, (float) $data['percent'] ); // Progress_Data tek ondalığa yuvarlar.
		$html = Progress_Renderer::render( $data );
		$this->assertStringContainsString( 'data-dp-live-pct>' . esc_html( $this->pct( '99.9' ) ) . '<', $html );
		$this->assertStringContainsString( 'aria-valuenow="99"', $html );
	}

	public function test_settings_default_on(): void {
		$settings = new Settings();
		$this->assertTrue( (bool) $settings->get( 'progress.preview', null ) );
		$this->assertTrue( (bool) $settings->get( 'progress.count', null ) );
		$this->assertTrue( (bool) $settings->get( 'progress.celebrate', null ) );
		$this->assertSame( '', Progress_Live::root_class( Progress_Live::config( $this->data( 10.0 ) ) ) );
	}

	public function test_card_uses_transform_fill_live_config_and_accessible_value(): void {
		$html = Progress_Renderer::render( $this->data( 1250.0, 3000.0, 3 ) );
		$this->assertStringContainsString( 'data-dp-live-cfg="', $html );
		$this->assertStringContainsString( 'class="donation-panel-live__fill" data-dp-live-fill style="--p:41.67"', $html );
		$this->assertStringNotContainsString( 'inline-size', $html );
		$this->assertMatchesRegularExpression( '/role="progressbar"[^>]*aria-valuenow="41"[^>]*aria-valuetext="' . preg_quote( esc_attr( $this->pct( '41.6' ) ), '/' ) . '/', $html );
		$this->assertStringContainsString( 'data-dp-live-meta', $html );
		$this->assertStringContainsString( 'data-dp-live-pct>' . esc_html( $this->pct( '41.6' ) ) . '<', $html );
		// Kart görününce taze veri ister (önbellekli sayfa).
		$this->assertStringContainsString( '&quot;fresh&quot;:1', $html );
		// Sayfa HTML'inde nonce ya da kişiye özel veri yok.
		$this->assertStringNotContainsString( 'nonce', strtolower( $html ) );
	}

	public function test_card_zero_state_shows_first_gift_call_and_hides_percent(): void {
		$html = Progress_Renderer::render( $this->data( 0.0 ) );
		$this->assertMatchesRegularExpression( '/data-dp-live-zero="hide" hidden><b class="donation-panel-num" data-dp-live-pct>/', $html );
		$this->assertStringContainsString( 'data-dp-live-zero="show">' . esc_html( __( 'Be the first to give', 'woo-donation-popup' ) ) . '<', $html );
		$this->assertMatchesRegularExpression( '/data-dp-live-donors[^>]* hidden>/', $html );
	}

	public function test_admin_has_progress_section_with_three_switches(): void {
		$sections = Field_Registry::sections( Admin_Bootstrap::SLUG_CAMPAIGNS );
		$this->assertArrayHasKey( 'progress', $sections );
		$this->assertNotSame( '', $sections['progress'][1] );
		$fields = Field_Registry::fields_for( Admin_Bootstrap::SLUG_CAMPAIGNS );
		foreach ( array( 'progress.preview', 'progress.count', 'progress.celebrate' ) as $id ) {
			$this->assertArrayHasKey( $id, $fields );
			$this->assertSame( 'switch', $fields[ $id ]['type'] );
			$this->assertSame( 'progress', $fields[ $id ]['section'] );
			$this->assertNotSame( '', trim( (string) $fields[ $id ]['help'] ) );
		}
	}

	public function test_guide_has_progress_section_with_shortcode_figure_and_settings_link(): void {
		$sections = Guide::sections();
		$this->assertArrayHasKey( 'progress', $sections );
		$section = $sections['progress'];
		$this->assertSame( '[donation_panel_progress id="123"]', $section['code'] );
		$this->assertSame( 'progress', $section['figure'] );
		$this->assertSame( array( Admin_Bootstrap::SLUG_CAMPAIGNS, 'dpa-s-progress' ), array_slice( $section['link'], 0, 2 ) );
		$this->assertGreaterThanOrEqual( 5, count( $section['body'] ) );
		$figure = Guide::figure( 'progress' );
		$this->assertStringContainsString( 'role="img"', $figure );
		$this->assertStringContainsString( 'data-dpa-figure="progress"', $figure );
	}
}
