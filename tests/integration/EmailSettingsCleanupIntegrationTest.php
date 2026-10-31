<?php
/**
 * Gerçek WP: kaldırılan e-posta ayarlarının göçü yalnız kendi anahtarlarını siler, iki kez çalışınca aynı sonucu verir;
 * nonce yanıtı girişli kullanıcıda yalnız boolean `logged_in` döndürür.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Email_Settings_Cleanup;
use DonationPanel\Core\Settings;

final class EmailSettingsCleanupIntegrationTest extends WDP_Integration_Test_Case {

	/** @var array<string,mixed> */
	private $backup = array();

	/** @var string[] */
	private $options = array( Settings::OPTION_NAME, 'wdp_button_settings', 'wdp_shareholder_settings' );

	protected function setUp(): void {
		parent::setUp();
		foreach ( $this->options as $name ) {
			$this->backup[ $name ] = get_option( $name, null );
		}
	}

	protected function tearDown(): void {
		foreach ( $this->options as $name ) {
			if ( null === $this->backup[ $name ] ) {
				delete_option( $name );
			} else {
				update_option( $name, $this->backup[ $name ] );
			}
		}
		parent::tearDown();
	}

	public function test_cleanup_is_idempotent_and_touches_only_its_own_keys(): void {
		update_option(
			Settings::OPTION_NAME,
			array(
				'form'   => array(
					'donor_email' => true,
					'dedication'  => true,
				),
				'shares' => array(
					'email'       => true,
					'copy_button' => true,
				),
			)
		);
		update_option( 'wdp_button_settings', array( 'enable_donor_email' => '1', 'button_primary_color' => '#ff0000' ) );
		update_option( 'wdp_shareholder_settings', array( 'shareholder_enable_email' => '1', 'shareholder_enable_copy_button' => '1' ) );
		$product = $this->create_product(
			'25',
			array(
				'_enable_email'                => 'yes',
				'_enable_dedication'           => 'yes',
				'_enable_other_plugin_feature' => 'keep',
			)
		);
		$other   = $this->create_product( '30', array( '_enable_email' => '' ) );
		$pid     = $product->get_id();

		$first = ( new Email_Settings_Cleanup() )->run();
		wp_cache_flush();
		$snapshot = array(
			'settings'    => get_option( Settings::OPTION_NAME ),
			'button'      => get_option( 'wdp_button_settings' ),
			'shareholder' => get_option( 'wdp_shareholder_settings' ),
			'meta'        => get_post_meta( $pid ),
		);
		$second   = ( new Email_Settings_Cleanup() )->run();
		wp_cache_flush();

		$this->assertSame( 2, $first['settings'] );
		$this->assertSame( 2, $first['legacy'] );
		$this->assertGreaterThanOrEqual( 2, $first['product_meta'] );
		$this->assertSame( array( 'settings' => 0, 'legacy' => 0, 'product_meta' => 0 ), $second );
		$this->assertSame( $snapshot['settings'], get_option( Settings::OPTION_NAME ) );
		$this->assertSame( $snapshot['meta'], get_post_meta( $pid ) );

		$this->assertSame( array( 'form' => array( 'dedication' => true ), 'shares' => array( 'copy_button' => true ) ), get_option( Settings::OPTION_NAME ) );
		$this->assertSame( array( 'button_primary_color' => '#ff0000' ), get_option( 'wdp_button_settings' ) );
		$this->assertSame( array( 'shareholder_enable_copy_button' => '1' ), get_option( 'wdp_shareholder_settings' ) );
		$this->assertFalse( metadata_exists( 'post', $pid, '_enable_email' ) );
		$this->assertFalse( metadata_exists( 'post', $other->get_id(), '_enable_email' ) );
		$this->assertSame( 'yes', get_post_meta( $pid, '_enable_dedication', true ) );
		$this->assertSame( 'keep', get_post_meta( $pid, '_enable_other_plugin_feature', true ) );
	}

	public function test_nonce_response_has_only_a_boolean_logged_in_flag(): void {
		$_SERVER['REMOTE_ADDR'] = '203.0.113.11';
		$guest                  = rest_do_request( new WP_REST_Request( 'GET', '/donation-panel/v1/nonce' ) );
		$this->assertSame( 200, $guest->get_status() );
		$this->assertFalse( $guest->get_data()['logged_in'] );
		$this->assertSame( array( 'logged_in', 'nonce' ), $this->sorted_keys( $guest->get_data() ) );
		$this->assertStringContainsString( 'Cookie', (string) ( $guest->get_headers()['Vary'] ?? '' ) );
		$this->assertStringContainsString( 'no-store', (string) ( $guest->get_headers()['Cache-Control'] ?? '' ) );

		$user_id = wp_insert_user(
			array(
				'user_login' => 'wdp-int-' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password( 20 ),
				'role'       => 'customer',
			)
		);
		$this->assertIsInt( $user_id );
		wp_set_current_user( $user_id );
		wp_cache_flush();
		$member = rest_do_request( new WP_REST_Request( 'GET', '/donation-panel/v1/nonce' ) );
		$this->assertTrue( $member->get_data()['logged_in'] );
		$this->assertSame( array( 'logged_in', 'nonce' ), $this->sorted_keys( $member->get_data() ) );
		wp_set_current_user( 0 );
		wp_delete_user( $user_id );
	}

	/**
	 * @param array<string,mixed> $data Veri.
	 * @return string[]
	 */
	private function sorted_keys( array $data ): array {
		$keys = array_keys( $data );
		sort( $keys );
		return $keys;
	}
}
