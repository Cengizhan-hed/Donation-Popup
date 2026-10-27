<?php
/**
 * E5: bağışçı hesabı — belirteç (süre, tek kullanım, karma), Bağışlarım (yalnız kendi siparişleri, eski anahtarlar),
 * REST (nonce, hız sınırı, enumeration yok, yetki), misafir bağlama, çıktı kaçışı, modül kaydı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Http\Rate_Limiter;
use DonationPanel\Modules\DonorAccount\Account_Controller;
use DonationPanel\Modules\DonorAccount\Account_Renderer;
use DonationPanel\Modules\DonorAccount\Donation_History;
use DonationPanel\Modules\DonorAccount\Guest_Link_Token;
use PHPUnit\Framework\TestCase;

/**
 * WordPress/WooCommerce saplama durumu (yalnız bu test).
 */
final class E5Wp {
	/** @var array<int, array<string, mixed>> */
	public static $user_meta = array();
	/** @var array<int, array{to: string, subject: string, body: string}> */
	public static $mails = array();
	/** @var array<string, int> email => user id */
	public static $users = array();
	/** @var array<int, object> */
	public static $orders = array();
	/** @var int[] */
	public static $created = array();
	/** @var array<int, string> */
	public static $reset_events = array();
	/** @var bool */
	public static $signon_ok = false;

	public static function reset(): void {
		self::$user_meta    = array();
		self::$mails        = array();
		self::$users        = array();
		self::$orders       = array();
		self::$created      = array();
		self::$reset_events = array();
		self::$signon_ok    = false;
	}
}

if ( ! function_exists( 'wp_generate_password' ) ) {
	function wp_generate_password( $length = 12, $special = true, $extra = false ) { // phpcs:ignore
		unset( $special, $extra );
		return substr( str_repeat( bin2hex( random_bytes( 20 ) ), 2 ), 0, (int) $length );
	}
}
if ( ! function_exists( 'update_user_meta' ) ) {
	function update_user_meta( $id, $key, $value ) { // phpcs:ignore
		E5Wp::$user_meta[ (int) $id ][ $key ] = $value;
		return true;
	}
}
if ( ! function_exists( 'get_user_meta' ) ) {
	function get_user_meta( $id, $key, $single = false ) { // phpcs:ignore
		unset( $single );
		return E5Wp::$user_meta[ (int) $id ][ $key ] ?? '';
	}
}
if ( ! function_exists( 'delete_user_meta' ) ) {
	function delete_user_meta( $id, $key ) { // phpcs:ignore
		unset( E5Wp::$user_meta[ (int) $id ][ $key ] );
		return true;
	}
}
if ( ! function_exists( 'wp_mail' ) ) {
	function wp_mail( $to, $subject, $body ) { // phpcs:ignore
		E5Wp::$mails[] = array(
			'to'      => (string) $to,
			'subject' => (string) $subject,
			'body'    => (string) $body,
		);
		return true;
	}
}
if ( ! function_exists( 'wp_signon' ) ) {
	function wp_signon( $creds = array(), $secure = false ) { // phpcs:ignore
		unset( $secure );
		if ( E5Wp::$signon_ok && 'ayse@example.test' === $creds['user_login'] && 'dogru-sifre-1' === $creds['user_password'] ) {
			return (object) array( 'ID' => 7 );
		}
		return new WP_Error( 'incorrect_password', 'Kullanıcı adı veya parola yanlış: ayse@example.test' );
	}
}
if ( ! function_exists( 'wp_set_current_user' ) ) {
	function wp_set_current_user( $id ) { // phpcs:ignore
		WDP_Test_State::$user_id = (int) $id;
		return null;
	}
}
if ( ! function_exists( 'wp_get_current_user' ) ) {
	function wp_get_current_user() { // phpcs:ignore
		return (object) array(
			'ID'         => (int) WDP_Test_State::$user_id,
			'user_email' => 'ayse@example.test',
		);
	}
}
if ( ! function_exists( 'email_exists' ) ) {
	function email_exists( $email ) { // phpcs:ignore
		return E5Wp::$users[ $email ] ?? false;
	}
}
if ( ! function_exists( 'get_user_by' ) ) {
	function get_user_by( $field, $value ) { // phpcs:ignore
		unset( $field );
		return isset( E5Wp::$users[ $value ] ) ? (object) array(
			'ID'         => E5Wp::$users[ $value ],
			'user_login' => 'ayse',
		) : false;
	}
}
if ( ! function_exists( 'get_password_reset_key' ) ) {
	function get_password_reset_key( $user ) { // phpcs:ignore
		unset( $user );
		return 'resetkey';
	}
}
if ( ! function_exists( 'wc_create_new_customer' ) ) {
	function wc_create_new_customer( $email, $username = '', $password = '' ) { // phpcs:ignore
		unset( $username, $password );
		E5Wp::$created[]        = $email;
		E5Wp::$users[ $email ]  = 99;
		return 99;
	}
}
if ( ! function_exists( 'wc_get_orders' ) ) {
	function wc_get_orders( $args ) { // phpcs:ignore
		unset( $args );
		return E5Wp::$orders;
	}
}
if ( ! function_exists( 'wc_get_order_status_name' ) ) {
	function wc_get_order_status_name( $status ) { // phpcs:ignore
		return 'completed' === $status ? 'Tamamlandı' : ucfirst( (string) $status );
	}
}
if ( ! function_exists( 'wc_format_datetime' ) ) {
	function wc_format_datetime( $date ) { // phpcs:ignore
		unset( $date );
		return '25 Ekim 2026';
	}
}
if ( ! function_exists( 'get_post_status' ) ) {
	function get_post_status( $id ) { // phpcs:ignore
		return $id > 0 && $id < 900 ? 'publish' : 'draft';
	}
}
if ( ! function_exists( 'get_the_terms' ) ) {
	function get_the_terms( $id, $taxonomy ) { // phpcs:ignore
		unset( $id, $taxonomy );
		return array( (object) array( 'name' => 'Zekât' ) );
	}
}
if ( ! function_exists( 'wp_specialchars_decode' ) ) {
	function wp_specialchars_decode( $s, $q = 3 ) { // phpcs:ignore
		unset( $q );
		return (string) $s;
	}
}
if ( ! function_exists( 'rawurlencode_deep' ) && ! function_exists( 'wc_get_page_permalink' ) ) {
	function wc_get_page_permalink( $page ) { // phpcs:ignore
		return 'https://example.test/' . $page . '/';
	}
}
if ( ! function_exists( 'wc_get_endpoint_url' ) ) {
	function wc_get_endpoint_url( $endpoint, $value = '', $permalink = '' ) { // phpcs:ignore
		unset( $value );
		return rtrim( (string) $permalink, '/' ) . '/' . $endpoint . '/';
	}
}

/**
 * Sahte sipariş kalemi.
 */
final class E5Item {
	/** @var array<string, mixed> */
	private $meta;
	/** @var string */
	private $name;

	public function __construct( string $name, array $meta ) {
		$this->name = $name;
		$this->meta = $meta;
	}

	public function get_meta_data(): array {
		$out = array();
		foreach ( $this->meta as $k => $v ) {
			$out[] = new WC_Meta_Data_Stub( $k, $v );
		}
		return $out;
	}

	public function get_meta( $key, $single = true ) { // phpcs:ignore
		unset( $single );
		return $this->meta[ $key ] ?? '';
	}

	public function get_name(): string {
		return $this->name;
	}

	public function get_total(): float {
		return 150.0;
	}

	public function get_product_id(): int {
		return 12;
	}
}

if ( ! class_exists( 'WC_Meta_Data_Stub' ) ) {
	/**
	 * Meta kaydı.
	 */
	final class WC_Meta_Data_Stub {
		/** @var string */
		private $key;
		/** @var mixed */
		private $value;

		public function __construct( $key, $value ) {
			$this->key   = (string) $key;
			$this->value = $value;
		}

		public function get_data(): array {
			return array(
				'key'   => $this->key,
				'value' => $this->value,
			);
		}
	}
}

/**
 * Sahte sipariş.
 */
final class E5Order {
	/** @var int */
	public $id;
	/** @var int */
	public $customer;
	/** @var string */
	public $email;
	/** @var array<int, E5Item> */
	public $items;
	/** @var bool */
	public $saved = false;

	public function __construct( int $id, int $customer, string $email, array $items ) {
		$this->id       = $id;
		$this->customer = $customer;
		$this->email    = $email;
		$this->items    = $items;
	}

	public function get_id(): int {
		return $this->id;
	}

	public function get_customer_id(): int {
		return $this->customer;
	}

	public function set_customer_id( $id ): void {
		$this->customer = (int) $id;
	}

	public function save(): void {
		$this->saved = true;
	}

	public function get_billing_email(): string {
		return $this->email;
	}

	public function get_items(): array {
		return $this->items;
	}

	public function get_status(): string {
		return 'completed';
	}

	public function get_date_created() {
		return new DateTime( '2026-10-25' );
	}

	public function get_currency(): string {
		return 'TRY';
	}

	public function get_view_order_url(): string {
		return 'https://example.test/hesabim/view-order/' . $this->id . '/';
	}
}

final class E5DonorAccountTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		E5Wp::reset();
		WDP_Test_State::$user_id = 0;
	}

	private function controller( int $limit_clients = 1 ): Account_Controller {
		unset( $limit_clients );
		return new Account_Controller( new Rate_Limiter( static function () {
			return '203.0.113.9';
		} ) );
	}

	private function request( array $params, string $nonce = 'abc123' ): WP_REST_Request {
		$r         = new WP_REST_Request();
		$r->params = $params;
		if ( '' !== $nonce ) {
			$r->headers['X-WP-Nonce'] = $nonce;
		}
		return $r;
	}

	// ---- Belirteç ----

	public function test_token_record_stores_only_hash_and_checks_expiry_and_value(): void {
		$rec = Guest_Link_Token::make_record( 'plain-token', 'Ayse@Example.test', 1000, 'secret' );
		$this->assertStringNotContainsString( 'plain-token', (string) wp_json_encode( $rec ) );
		$this->assertSame( 'ayse@example.test', $rec['email'] );
		$this->assertTrue( Guest_Link_Token::check_record( $rec, 'plain-token', 1000 + 3599, 'secret' ) );
		$this->assertFalse( Guest_Link_Token::check_record( $rec, 'plain-token', 1000 + 3601, 'secret' ), 'süre dolmuş' );
		$this->assertFalse( Guest_Link_Token::check_record( $rec, 'plain-tokeN', 1001, 'secret' ), 'yanlış belirteç' );
		$this->assertFalse( Guest_Link_Token::check_record( $rec, 'plain-token', 1001, 'other-secret' ), 'yanlış anahtar' );
		$this->assertFalse( Guest_Link_Token::check_record( $rec, '', 1001, 'secret' ) );
		$this->assertFalse( Guest_Link_Token::check_record( null, 'x', 1, 's' ) );
	}

	public function test_token_is_single_use_and_bound_to_user(): void {
		$token = Guest_Link_Token::issue( 7, 'ayse@example.test' );
		$this->assertNull( Guest_Link_Token::consume( 8, $token ), 'başka kullanıcı kullanamaz' );
		$this->assertSame( 'ayse@example.test', Guest_Link_Token::consume( 7, $token ) );
		$this->assertNull( Guest_Link_Token::consume( 7, $token ), 'ikinci kullanım reddedilir' );
	}

	public function test_new_token_invalidates_previous_one(): void {
		$first  = Guest_Link_Token::issue( 7, 'ayse@example.test' );
		$second = Guest_Link_Token::issue( 7, 'ayse@example.test' );
		$this->assertNull( Guest_Link_Token::consume( 7, $first ) );
		$this->assertSame( 'ayse@example.test', Guest_Link_Token::consume( 7, $second ) );
	}

	// ---- Bağışlarım ----

	public function test_history_returns_only_own_orders_and_reads_legacy_keys(): void {
		$own      = new E5Order( 1, 7, 'a@example.test', array(
			new E5Item( 'Su kuyusu', array( 'wdp_dedication' => 'Anneannem Şükriye için', '_custom_price' => '150' ) ),
			new E5Item( 'Kargo', array() ),
			new E5Item( 'Eski bağış', array( 'İthaf' => 'Dedem İbrahim için' ) ),
		) );
		$foreign  = new E5Order( 2, 8, 'b@example.test', array( new E5Item( 'Başkasının', array( '_custom_price' => '5' ) ) ) );
		// get_post_status taslağı birden çok test dosyasında tanımlı (ilk yüklenen kazanır); ürünü açıkça yayımlanmış işaretle.
		WDP_Test_State::$options['__post_status'][12] = 'publish';
		$page     = Donation_History::page( 7, 1, 10, static function () use ( $own, $foreign ) {
			return array(
				'orders' => array( $own, $foreign ),
				'total'  => 2,
			);
		} );
		$this->assertCount( 2, $page['rows'], 'kargo satırı ve başkasının siparişi hariç' );
		$this->assertSame( 'Su kuyusu', $page['rows'][0]['project'] );
		$this->assertSame( 'Anneannem Şükriye için', $page['rows'][0]['dedication'] );
		$this->assertSame( 'Dedem İbrahim için', $page['rows'][1]['dedication'], 'eski (çevrilmiş) anahtar okunur' );
		$this->assertSame( 'Zekât', $page['rows'][0]['type'] );
		$this->assertSame( 'Tamamlandı', $page['rows'][0]['status_text'] );
		$this->assertSame( 'https://example.test/hesabim/view-order/1/', $page['rows'][0]['receipt_url'] );
		$this->assertSame( 'https://example.test/?p=12', $page['rows'][0]['repeat_url'] );
		$this->assertSame( 1, $page['pages'] );
	}

	public function test_history_for_guest_user_is_empty_and_never_fetches(): void {
		$called = false;
		$page   = Donation_History::page( 0, 1, 10, static function () use ( &$called ) {
			$called = true;
			return array(
				'orders' => array(),
				'total'  => 0,
			);
		} );
		$this->assertFalse( $called );
		$this->assertSame( array(), $page['rows'] );
	}

	public function test_history_pagination_counts(): void {
		$page = Donation_History::page( 7, 2, 10, static function () {
			return array(
				'orders' => array(),
				'total'  => 25,
			);
		} );
		$this->assertSame( 3, $page['pages'] );
		$this->assertSame( 2, $page['page'] );
	}

	public function test_donations_html_escapes_and_keeps_turkish(): void {
		$html = Account_Renderer::donations( array(
			array(
				'order_id'    => 1,
				'project'     => '<script>x</script> Su Kuyusu Çağlar',
				'amount_html' => '<span>150</span>',
				'status'      => 'completed',
				'status_text' => 'Tamamlandı',
				'dedication'  => 'İğdır "için"',
				'receipt_url' => 'https://example.test/r/1/',
				'repeat_url'  => '',
				'date'        => '25 Ekim 2026',
				'type'        => 'Zekât',
			),
		) );
		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( 'Su Kuyusu Çağlar', $html );
		$this->assertStringContainsString( 'İğdır', $html );
		$this->assertStringContainsString( 'data-dp-acc-receipt', $html );
		$this->assertStringNotContainsString( 'data-dp-acc-repeat', $html, 'ürün yoksa tekrar bağış düğmesi yok' );
		$this->assertStringContainsString( 'dp-ac__empty', Account_Renderer::donations( array() ) );
	}

	public function test_status_tone_and_video_url_filtering(): void {
		$this->assertSame( 'ok', Donation_History::tone( 'completed' ) );
		$this->assertSame( 'ok', Donation_History::tone( 'processing' ) );
		$this->assertSame( 'wait', Donation_History::tone( 'on-hold' ) );
		$this->assertSame( 'bad', Donation_History::tone( 'cancelled' ) );
		$order = new E5Order( 1, 7, 'a@example.test', array() );
		$this->assertSame( '', Donation_History::video_url( $order ), 'meta yoksa video yok' );
	}

	public function test_card_shows_pill_progress_and_instant_repeat_only_when_possible(): void {
		$row  = array(
			'order_id'    => 1,
			'project'     => 'Su Kuyusu',
			'amount_html' => '1.000',
			'status'      => 'completed',
			'status_text' => 'Tamamlandı',
			'tone'        => 'ok',
			'receipt_url' => 'https://example.test/r/1/',
			'repeat_url'  => 'https://example.test/?p=12',
			'video_url'   => 'https://example.test/v/1',
			'campaign'    => 62.0,
			'product_id'  => 12,
			'amount'      => 1000.0,
			'can_repeat'  => true,
			'date'        => '2 Ekim',
		);
		$html = Account_Renderer::donations( array( $row ) );
		$this->assertStringContainsString( 'dp-ac__pill--ok', $html );
		$this->assertStringContainsString( 'dp-ac__progress', $html );
		$this->assertStringContainsString( 'data-dp-acc-video', $html );
		$this->assertStringContainsString( 'data-product="12"', $html );
		$row['can_repeat'] = false;
		$row['video_url']  = '';
		$row['campaign']   = null;
		$plain             = Account_Renderer::donations( array( $row ) );
		$this->assertStringNotContainsString( 'data-product=', $plain, 'para birimi farklıysa anında tekrar yok; bağlantı ürün sayfasına gider' );
		$this->assertStringNotContainsString( 'data-dp-acc-video', $plain );
		$this->assertStringNotContainsString( 'dp-ac__progress', $plain );
	}

	public function test_dialog_has_accessible_tabs_password_toggle_and_remember(): void {
		$html = Account_Renderer::dialog( array( 'rest' => 'https://e.test/' ), true );
		$this->assertStringContainsString( 'role="tablist"', $html );
		$this->assertStringContainsString( 'aria-selected="true"', $html );
		$this->assertStringContainsString( 'data-dp-acc-reveal', $html );
		$this->assertStringContainsString( 'data-dp-acc-remember', $html );
		$this->assertStringContainsString( 'id="dp-ac-password"', $html );
	}

	// ---- REST ----

	public function test_write_endpoints_reject_missing_nonce(): void {
		$c = $this->controller();
		foreach ( array( 'login', 'register', 'reset', 'link_guest', 'link_guest_confirm', 'donations' ) as $method ) {
			$res = $c->$method( $this->request( array( 'email' => 'a@example.test', 'password' => 'x' ), '' ) );
			$this->assertInstanceOf( WP_Error::class, $res, $method );
			$this->assertSame( 403, $res->data['status'], $method );
		}
	}

	public function test_login_failure_message_is_identical_for_unknown_user_and_wrong_password(): void {
		$c = $this->controller();
		$a = $c->login( $this->request( array( 'email' => 'yok@example.test', 'password' => 'yanlis-sifre' ) ) );
		$b = $c->login( $this->request( array( 'email' => 'ayse@example.test', 'password' => 'yanlis-sifre' ) ) );
		$this->assertInstanceOf( WP_Error::class, $a );
		$this->assertSame( $a->message, $b->message );
		$this->assertSame( 401, $b->data['status'] );
		$this->assertStringNotContainsString( 'ayse@', $b->message, 'WordPress hata metni sızdırılmaz' );
	}

	public function test_login_success_returns_fresh_nonce(): void {
		E5Wp::$signon_ok = true;
		$res             = $this->controller()->login( $this->request( array( 'email' => 'ayse@example.test', 'password' => 'dogru-sifre-1' ) ) );
		$this->assertTrue( $res->get_data()['ok'] );
		$this->assertSame( 'test-nonce-wp_rest', $res->get_data()['nonce'] );
		$this->assertSame( 'no-store, private', $res->headers['Cache-Control'] );
	}

	public function test_login_is_rate_limited(): void {
		$c    = $this->controller();
		$last = null;
		for ( $i = 0; $i < 11; $i++ ) {
			$last = $c->login( $this->request( array( 'email' => 'a@example.test', 'password' => 'x' ) ) );
		}
		$this->assertSame( 429, $last->data['status'] );
	}

	public function test_register_response_is_identical_for_new_and_existing_email(): void {
		WDP_Test_State::$options['woocommerce_enable_myaccount_registration'] = 'yes';
		E5Wp::$users['var@example.test']                                      = 5;
		$c    = $this->controller();
		$new  = $c->register( $this->request( array( 'email' => 'yeni@example.test', 'password' => 'uzun-sifre-1' ) ) );
		$old  = $c->register( $this->request( array( 'email' => 'var@example.test', 'password' => 'uzun-sifre-1' ) ) );
		$this->assertSame( $new->get_data(), $old->get_data() );
		$this->assertSame( array( 'yeni@example.test' ), E5Wp::$created, 'var olan e-posta için hesap açılmaz' );
	}

	public function test_register_validates_and_respects_woocommerce_setting(): void {
		$c = $this->controller();
		$r = $c->register( $this->request( array( 'email' => 'a@example.test', 'password' => 'uzun-sifre-1' ) ) );
		$this->assertSame( 403, $r->data['status'], 'WooCommerce kaydı kapalıysa reddedilir' );
		WDP_Test_State::$options['woocommerce_enable_myaccount_registration'] = 'yes';
		$this->assertSame( 400, $c->register( $this->request( array( 'email' => 'bozuk', 'password' => 'uzun-sifre-1' ) ) )->data['status'] );
		$this->assertSame( 400, $c->register( $this->request( array( 'email' => 'a@example.test', 'password' => 'kisa' ) ) )->data['status'] );
		$this->assertSame( array(), E5Wp::$created );
	}

	public function test_reset_response_identical_and_mail_event_only_for_existing_account(): void {
		WDP_Test_State::$actions['woocommerce_reset_password_notification'][] = static function ( $login ) {
			E5Wp::$reset_events[] = (string) $login;
		};
		E5Wp::$users['ayse@example.test'] = 7;
		$c   = $this->controller();
		$yes = $c->reset( $this->request( array( 'email' => 'ayse@example.test' ) ) );
		$no  = $c->reset( $this->request( array( 'email' => 'yok@example.test' ) ) );
		$this->assertSame( $yes->get_data(), $no->get_data() );
		$this->assertSame( array( 'ayse' ), E5Wp::$reset_events );
	}

	public function test_member_endpoints_require_login(): void {
		$c = $this->controller();
		$this->assertFalse( $c->permission_member() );
		WDP_Test_State::$user_id = 7;
		$this->assertTrue( $c->permission_member() );
	}

	public function test_session_returns_nonce_without_personal_data(): void {
		$data = $this->controller()->session()->get_data();
		$this->assertSame( array( 'logged_in', 'registration', 'nonce' ), array_keys( $data ) );
	}

	public function test_link_guest_mails_link_to_account_email_and_stores_hash_only(): void {
		WDP_Test_State::$user_id = 7;
		$res                     = $this->controller()->link_guest( $this->request( array() ) );
		$this->assertTrue( $res->get_data()['ok'] );
		$this->assertCount( 1, E5Wp::$mails );
		$this->assertSame( 'ayse@example.test', E5Wp::$mails[0]['to'] );
		preg_match( '/dp_link_guest=([A-Za-z0-9]+)/', E5Wp::$mails[0]['body'], $m );
		$this->assertNotEmpty( $m[1] ?? '' );
		$stored = (string) wp_json_encode( E5Wp::$user_meta[7][ Guest_Link_Token::META ] );
		$this->assertStringNotContainsString( $m[1], $stored );
	}

	public function test_link_guest_confirm_links_only_matching_guest_orders(): void {
		WDP_Test_State::$user_id = 7;
		$guest_match   = new E5Order( 1, 0, 'Ayse@Example.test', array() );
		$guest_other   = new E5Order( 2, 0, 'baska@example.test', array() );
		$owned_by_else = new E5Order( 3, 55, 'ayse@example.test', array() );
		E5Wp::$orders  = array( $guest_match, $guest_other, $owned_by_else );
		$token         = Guest_Link_Token::issue( 7, 'ayse@example.test' );
		$res           = $this->controller()->link_guest_confirm( $this->request( array( 'token' => $token ) ) );
		$this->assertSame( 1, $res->get_data()['linked'] );
		$this->assertSame( 7, $guest_match->get_customer_id() );
		$this->assertSame( 0, $guest_other->get_customer_id(), 'başka e-posta bağlanmaz' );
		$this->assertSame( 55, $owned_by_else->get_customer_id(), 'başkasının hesabındaki sipariş bağlanmaz' );
		$again = $this->controller()->link_guest_confirm( $this->request( array( 'token' => $token ) ) );
		$this->assertInstanceOf( WP_Error::class, $again, 'belirteç tek kullanımlık' );
	}

	public function test_link_guest_confirm_without_valid_token_links_nothing(): void {
		WDP_Test_State::$user_id = 7;
		$order                   = new E5Order( 1, 0, 'ayse@example.test', array() );
		E5Wp::$orders            = array( $order );
		$res                     = $this->controller()->link_guest_confirm( $this->request( array( 'token' => 'uydurma' ) ) );
		$this->assertSame( 400, $res->data['status'] );
		$this->assertSame( 0, $order->get_customer_id() );
	}

	// ---- Modül ----

	public function test_module_registered_default_off(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'donor_account', $registry->slugs() );
		$this->assertFalse( $registry->is_enabled( 'donor_account' ) );
	}
}
