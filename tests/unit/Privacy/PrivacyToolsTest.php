<?php
/**
 * Faz 8 gizlilik araçları: sipariş verisi dışa aktarma/silme (e-posta + telefon, sayfalama, yalnız WC API),
 * hesap bağlama kaydı, politika önerisi, eski wdp_vid çerezi.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Modules\DonorAccount\Guest_Link_Token;
use DonationPanel\Privacy\Privacy_Tools;
use PHPUnit\Framework\TestCase;

/**
 * Sipariş çifti: fatura e-posta/telefon + toplam.
 */
final class WDP_Privacy_Fake_Order extends WDP_Fake_Order {
	/** @var string */
	public $billing_email = '';
	/** @var string */
	public $billing_phone = '';
	/** @var float */
	public $total = 100.0;

	public function get_billing_email(): string {
		return $this->billing_email;
	}

	public function get_billing_phone(): string {
		return $this->billing_phone;
	}

	public function get_order_number(): string {
		return (string) $this->get_id();
	}

	public function get_total(): float {
		return $this->total;
	}
}

/**
 * Yalnız sipariş kalemi meta tablosunu sorgulayan sahte wpdb (kayıtlı sorgular denetlenir).
 */
final class WDP_Privacy_Fake_Wpdb {
	/** @var string */
	public $prefix = 'wp_';
	/** @var string[] */
	public $sql = array();
	/** @var array<int, array{order_id:int,meta_key:string,meta_value:string}> */
	public $rows = array();

	public function prepare($sql, ...$args): array {
		return array('sql' => (string) $sql, 'args' => $args);
	}

	public function get_results($query): array {
		$this->sql[] = $query['sql'];
		$out         = array();
		foreach ($this->rows as $row) {
			if ($row['meta_value'] === (string) $query['args'][0]) {
				$out[] = (object) array('order_id' => $row['order_id'], 'meta_key' => $row['meta_key']);
			}
		}
		return $out;
	}
}

final class WDP_Privacy_Registry {
	/** @var array<int, WDP_Privacy_Fake_Order> */
	public static $orders = array();
	/** @var array<string, int[]> */
	public static $by_email = array();
	/** @var array<string, int[]> */
	public static $by_phone = array();
	/** @var array<int, array<string, mixed>> */
	public static $users = array();
	/** @var array<int, array<string, mixed>> */
	public static $user_meta = array();
	/** @var string[] */
	public static $policy = array();

	public static function reset(): void {
		self::$orders    = array();
		self::$by_email  = array();
		self::$by_phone  = array();
		self::$users     = array();
		self::$user_meta = array();
		self::$policy    = array();
	}
}

if (!function_exists('wc_get_order')) {
	function wc_get_order($id) {
		return WDP_Privacy_Registry::$orders[ (int) $id ] ?? false;
	}
}
if (!function_exists('wc_get_orders')) {
	function wc_get_orders($args) {
		if (isset($args['billing_email'])) {
			return WDP_Privacy_Registry::$by_email[ strtolower((string) $args['billing_email']) ] ?? array();
		}
		if (isset($args['field_query'][0]['value'])) {
			return WDP_Privacy_Registry::$by_phone[ (string) $args['field_query'][0]['value'] ] ?? array();
		}
		return array();
	}
}
if (!function_exists('get_user_by')) {
	function get_user_by($field, $value) {
		foreach (WDP_Privacy_Registry::$users as $id => $user) {
			if (strtolower((string) $user['email']) === strtolower((string) $value)) {
				return (object) array('ID' => $id);
			}
		}
		return false;
	}
}
if (!function_exists('get_user_meta')) {
	function get_user_meta($user_id, $key, $single = false) {
		return WDP_Privacy_Registry::$user_meta[ (int) $user_id ][ $key ] ?? '';
	}
}
if (!function_exists('delete_user_meta')) {
	function delete_user_meta($user_id, $key) {
		unset(WDP_Privacy_Registry::$user_meta[ (int) $user_id ][ $key ]);
		return true;
	}
}
if (!function_exists('wp_add_privacy_policy_content')) {
	function wp_add_privacy_policy_content($plugin_name, $policy_text) {
		WDP_Privacy_Registry::$policy[ (string) $plugin_name ] = (string) $policy_text;
	}
}

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class PrivacyToolsTest extends TestCase {
	/** @var mixed */
	private $saved_wpdb;

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Privacy_Registry::reset();
		$this->saved_wpdb = $GLOBALS['wpdb'] ?? null;
		$GLOBALS['wpdb']  = new WDP_Privacy_Fake_Wpdb();
	}

	protected function tearDown(): void {
		$GLOBALS['wpdb'] = $this->saved_wpdb;
		WDP_Privacy_Registry::reset();
		WDP_Test_State::reset();
	}

	private function add_order(int $id, string $email, string $phone, array $item_meta, ?string $billing_email = null): WDP_Privacy_Fake_Order {
		$order                = new WDP_Privacy_Fake_Order($id, array($id * 10 => new WDP_Fake_Order_Item(5, 100.0, 1, $item_meta)));
		$order->billing_email = null === $billing_email ? $email : $billing_email;
		$order->billing_phone = $phone;
		WDP_Privacy_Registry::$orders[ $id ] = $order;
		if ('' !== $order->billing_email) {
			WDP_Privacy_Registry::$by_email[ strtolower($order->billing_email) ][] = $id;
		}
		if ('' !== $phone) {
			WDP_Privacy_Registry::$by_phone[ $phone ][] = $id;
		}
		return $order;
	}

	public function test_export_finds_orders_by_email(): void {
		$this->add_order(1, 'ayse@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Ayşe Çelik', 'wdp_dedication' => 'Şükrü için'));

		$result = WDP_Privacy::export_personal_data('ayse@example.com', 1);

		$this->assertTrue($result['done']);
		$this->assertCount(1, $result['data']);
		$values = array_column($result['data'][0]['data'], 'value');
		$this->assertContains('Ayşe Çelik', $values);
		$this->assertContains('Şükrü için', $values);
	}

	public function test_export_finds_phone_only_order_with_empty_email(): void {
		$this->add_order(1, 'ayse@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Ayşe'));
		// E-postası boş, aynı telefon (biçim farkı: boşluksuz).
		$this->add_order(2, '', '905321112233', array('wdp_donor_name' => 'Ayşe (telefonla)', 'wdp_donor_phone' => '905321112233'), '');
		WDP_Privacy_Registry::$by_phone['+90 532 111 22 33'][] = 2;

		$ids = WDP_Privacy::find_order_ids('ayse@example.com');

		$this->assertSame(array(1, 2), $ids);
		$export = WDP_Privacy::export_personal_data('ayse@example.com', 1);
		$this->assertCount(2, $export['data']);
	}

	public function test_phone_match_never_pulls_other_persons_order(): void {
		$this->add_order(1, 'ayse@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Ayşe'));
		$this->add_order(2, 'baska@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Başka Kişi'));
		WDP_Privacy_Registry::$by_phone['+90 532 111 22 33'] = array(1, 2);

		$this->assertSame(array(1), WDP_Privacy::find_order_ids('ayse@example.com'));
	}

	public function test_erase_anonymizes_meta_keeps_order_total_and_reports_retained(): void {
		$order = $this->add_order(1, 'ayse@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Ayşe', 'wdp_donor_phone' => '+90 532 111 22 33', 'wdp_anonymous' => 'yes', '_custom_price' => 250));

		$response = WDP_Privacy::erase_personal_data('ayse@example.com', 1);

		$items = array_values($order->get_items());
		$this->assertTrue($response['items_removed']);
		$this->assertTrue($response['items_retained']);
		$this->assertNotEmpty($response['messages']);
		$this->assertSame('[deleted]', $items[0]->meta['wdp_donor_name']);
		$this->assertSame('[deleted]', $items[0]->meta['wdp_donor_phone']);
		$this->assertSame(250, $items[0]->meta['_custom_price']);
		$this->assertSame(100.0, $order->get_total());
		$this->assertTrue($response['done']);
	}

	public function test_export_paginates_by_fifty(): void {
		for ($i = 1; $i <= 120; $i++) {
			$this->add_order($i, 'toplu@example.com', '', array('wdp_donor_name' => 'Toplu ' . $i));
		}

		$p1 = WDP_Privacy::export_personal_data('toplu@example.com', 1);
		$p2 = WDP_Privacy::export_personal_data('toplu@example.com', 2);
		$p3 = WDP_Privacy::export_personal_data('toplu@example.com', 3);

		$this->assertSame(50, WDP_Privacy::BATCH_SIZE);
		$this->assertCount(50, $p1['data']);
		$this->assertFalse($p1['done']);
		$this->assertCount(50, $p2['data']);
		$this->assertFalse($p2['done']);
		$this->assertCount(20, $p3['data']);
		$this->assertTrue($p3['done']);
	}

	public function test_only_wc_api_and_itemmeta_table_are_queried_hpos_agnostic(): void {
		$this->add_order(1, 'ayse@example.com', '+90 532 111 22 33', array('wdp_donor_name' => 'Ayşe'));

		WDP_Privacy::export_personal_data('ayse@example.com', 1);
		WDP_Privacy::erase_personal_data('ayse@example.com', 1);

		foreach ($GLOBALS['wpdb']->sql as $sql) {
			$this->assertStringNotContainsString('postmeta', $sql);
			$this->assertStringNotContainsString('wc_orders', $sql);
			$this->assertStringContainsString('woocommerce_order_itemmeta', $sql);
		}
	}

	public function test_account_export_and_erase_remove_guest_link(): void {
		WDP_Privacy_Registry::$users[7]     = array('email' => 'bagisci@example.com');
		WDP_Privacy_Registry::$user_meta[7] = array(
			Guest_Link_Token::META => Guest_Link_Token::make_record('tok', 'bagisci@example.com', time(), 'secret'),
		);

		$export = Privacy_Tools::export_account_data('bagisci@example.com');
		$this->assertCount(1, $export['data']);
		$this->assertStringNotContainsString('hash', wp_json_encode($export['data']));

		$erase = Privacy_Tools::erase_account_data('bagisci@example.com');
		$this->assertTrue($erase['items_removed']);
		$this->assertArrayNotHasKey(Guest_Link_Token::META, WDP_Privacy_Registry::$user_meta[7]);
		$this->assertSame(array(), Privacy_Tools::export_account_data('bagisci@example.com')['data']);
		$this->assertFalse(Privacy_Tools::erase_account_data('yok@example.com')['items_removed']);
	}

	public function test_registers_exporters_and_erasers(): void {
		$this->assertArrayHasKey('donation-panel-account', Privacy_Tools::register_exporter(array()));
		$this->assertArrayHasKey('donation-panel-account', Privacy_Tools::register_eraser(array()));
		$this->assertArrayHasKey('woo-donation-popup', WDP_Privacy::register_exporter(array()));
		$this->assertArrayHasKey('woo-donation-popup', WDP_Privacy::register_eraser(array()));
	}

	public function test_policy_content_is_added_and_mentions_no_own_cookie(): void {
		// Yerel ayardan bagimsiz: kaynak dil (Ingilizce) ile uret, sonra eski ayari geri yukle.
		$previous = $GLOBALS['wdp_test_locale'] ?? null;
		$GLOBALS['wdp_test_locale'] = 'en_US';
		try {
			Privacy_Tools::add_policy_content();
		} finally {
			if (null === $previous) {
				unset($GLOBALS['wdp_test_locale']);
			} else {
				$GLOBALS['wdp_test_locale'] = $previous;
			}
		}

		$this->assertCount(1, WDP_Privacy_Registry::$policy);
		$text = (string) reset(WDP_Privacy_Registry::$policy);
		$this->assertStringContainsString('does not set its own cookies', $text);
		$this->assertStringContainsString('dedication', $text);
	}

	public function test_legacy_cookie_is_ignored_and_removed_from_request(): void {
		$_COOKIE['wdp_vid'] = 'abc.123.def';
		Privacy_Tools::expire_legacy_cookie();
		$this->assertArrayNotHasKey('wdp_vid', $_COOKIE);

		// Çerez yoksa hiçbir şey yapmaz (idempotent).
		Privacy_Tools::expire_legacy_cookie();
		$this->assertArrayNotHasKey('wdp_vid', $_COOKIE);
	}
}
