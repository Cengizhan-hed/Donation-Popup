<?php
/**
 * #2: giriş ucu hesap (e-posta) başına da sınırlıdır; dağıtık IP ile parola denemesi durur ve yanıt hesap varlığını sızdırmaz.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';
require_once dirname( __DIR__ ) . '/DonorAccount/DonorAccountModuleTest.php';

use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\DonorAccount\Account_Controller;
use PHPUnit\Framework\TestCase;

final class LoginAccountThrottleTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		E5Wp::reset();
	}

	private function attempt( string $ip, string $email, string $password = 'yanlis-sifre' ) {
		$c = new Account_Controller( new Rate_Limiter( static function () use ( $ip ) {
			return $ip;
		} ) );
		$request                        = new WP_REST_Request();
		$request->headers['X-WP-Nonce'] = 'abc123';
		$request->params                = array( 'email' => $email, 'password' => $password );
		return $c->login( $request );
	}

	public function test_distributed_guessing_against_one_account_is_stopped(): void {
		$last = null;
		for ( $i = 1; $i <= 14; $i++ ) {
			$last = $this->attempt( '198.51.100.' . $i, 'ayse@example.test' ); // her istek başka IP.
		}
		$this->assertInstanceOf( WP_Error::class, $last );
		$this->assertSame( 429, $last->data['status'] );
	}

	public function test_other_accounts_are_not_affected_and_unknown_account_looks_the_same(): void {
		for ( $i = 1; $i <= 14; $i++ ) {
			$this->attempt( '198.51.100.' . $i, 'ayse@example.test' );
		}
		$other = $this->attempt( '198.51.100.200', 'baska@example.test' );
		$this->assertInstanceOf( WP_Error::class, $other );
		$this->assertSame( 401, $other->data['status'] );
		$this->assertSame( 'donation_panel_login_failed', $other->get_error_code() );
	}

	public function test_error_message_never_names_the_account(): void {
		$res = $this->attempt( '198.51.100.9', 'ayse@example.test' );
		$this->assertStringNotContainsString( 'ayse', $res->get_error_message() );
	}
}
