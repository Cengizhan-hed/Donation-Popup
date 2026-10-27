<?php
/**
 * Gerçek WP: hız sınırı kovası istemci IP'sine göre; vekil başlıkları yalnız güvenilen vekilden okunur.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Http\Client_Ip;
use DonationPanel\Http\Rate_Limiter;

final class RateLimitClientIpIntegrationTest extends WDP_Integration_Test_Case {

	/** @var array<string,mixed> */
	private $server_backup = array();

	protected function setUp(): void {
		parent::setUp();
		$this->server_backup = $_SERVER;
		$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
		unset( $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_X_REAL_IP'] );
	}

	protected function tearDown(): void {
		$_SERVER = $this->server_backup;
		remove_all_filters( 'donation_panel_trusted_proxies' );
		parent::tearDown();
	}

	public function test_spoofed_forwarded_header_does_not_escape_the_bucket(): void {
		$limiter = new Rate_Limiter();
		$allowed = 0;
		for ( $i = 1; $i <= 8; $i++ ) {
			// Saldırgan her istekte başka bir X-Forwarded-For yazar; vekil güvenilmediği için yok sayılır.
			$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.' . $i;
			if ( $limiter->hit( 'itest_spoof', 3, 60 ) ) {
				++$allowed;
			}
		}
		$this->assertSame( 3, $allowed, 'Sahte başlık yeni kova açmamalı.' );
		$this->assertSame( '203.0.113.10', Client_Ip::get() );
	}

	public function test_trusted_proxy_gives_each_real_client_its_own_bucket(): void {
		add_filter(
			'donation_panel_trusted_proxies',
			static function () {
				return array( '203.0.113.0/24' );
			}
		);
		$limiter = new Rate_Limiter();
		$counts  = array();
		foreach ( array( '198.51.100.1', '198.51.100.2' ) as $client ) {
			$_SERVER['HTTP_X_FORWARDED_FOR'] = $client;
			$counts[ $client ]               = 0;
			for ( $i = 0; $i < 5; $i++ ) {
				if ( $limiter->hit( 'itest_proxy', 2, 60 ) ) {
					++$counts[ $client ];
				}
			}
		}
		$this->assertSame( array( '198.51.100.1' => 2, '198.51.100.2' => 2 ), $counts, 'Vekil arkasındaki her gerçek istemci kendi kovasında.' );

		$_SERVER['HTTP_X_FORWARDED_FOR'] = '10.9.9.9, 198.51.100.77, 203.0.113.10';
		$this->assertSame( '198.51.100.77', Client_Ip::get(), 'Sağdan ilk güvenilmeyen adres.' );
	}

	public function test_logged_in_user_has_a_separate_bucket_from_the_shared_ip(): void {
		$limiter = new Rate_Limiter();
		for ( $i = 0; $i < 3; $i++ ) {
			$limiter->hit( 'itest_user', 3, 60 );
		}
		$this->assertFalse( $limiter->hit( 'itest_user', 3, 60 ), 'Ziyaretçi kovası dolu.' );

		$user_id = wp_insert_user(
			array(
				'user_login' => 'wdp_itest_' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password( 20 ),
				'user_email' => 'itest-' . wp_generate_password( 6, false ) . '@example.test',
			)
		);
		$this->assertIsInt( $user_id );
		try {
			wp_set_current_user( $user_id );
			$this->assertTrue( ( new Rate_Limiter() )->hit( 'itest_user', 3, 60 ), 'Girişli kullanıcı ortak IP kovasını tüketmez.' );
		} finally {
			require_once ABSPATH . 'wp-admin/includes/user.php';
			wp_delete_user( $user_id );
			wp_set_current_user( 0 );
		}
	}
}
