<?php
/**
 * E8Q: eski/yeni yönetici ekranı geçişi — yetki, nonce, idempotent, yalnız admin.ui yazılır, kutu kapatma, eklentiler listesi bağlantısı.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use DonationPanel\Admin\Ui_Switch;
use DonationPanel\Core\Settings;
use PHPUnit\Framework\TestCase;

final class E8QRedirect extends RuntimeException {
	/** @var string */
	public $url = '';
}

final class E8QState {
	/** @var array<int, array<string, mixed>> */
	public static $user_meta = array();
}

if (!function_exists('check_admin_referer')) {
	function check_admin_referer($action = -1, $query_arg = '_wpnonce') {
		$name = is_string($query_arg) && '' !== $query_arg ? $query_arg : '_wpnonce';
		if (!isset($_REQUEST[ $name ]) || 'valid-nonce' !== $_REQUEST[ $name ]) {
			throw new RuntimeException('bad-nonce');
		}
		return 1;
	}
}
if (!function_exists('wp_safe_redirect')) {
	function wp_safe_redirect($location, $status = 302) {
		$e      = new E8QRedirect('redirect');
		$e->url = (string) $location;
		throw $e;
	}
}
if (!function_exists('update_user_meta')) {
	function update_user_meta($id, $key, $value) {
		E8QState::$user_meta[ (int) $id ][ $key ] = $value;
		return true;
	}
}
if (!function_exists('get_user_meta')) {
	function get_user_meta($id, $key, $single = false) {
		unset($single);
		return E8QState::$user_meta[ (int) $id ][ $key ] ?? '';
	}
}

final class E8QUiSwitchTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$caps    = array( 'manage_woocommerce' );
		WDP_Test_State::$user_id = 90417;
		E8QState::$user_meta     = array();
		$_POST                   = array();
		$_REQUEST                = array();
	}

	protected function tearDown(): void {
		$_POST    = array();
		$_REQUEST = array();
	}

	private function post(string $ui, string $nonce = 'valid-nonce'): void {
		$_POST    = array( 'ui' => $ui, '_wpnonce' => $nonce );
		$_REQUEST = $_POST;
	}

	private function redirect_of(callable $fn): string {
		try {
			$fn();
		} catch (E8QRedirect $e) {
			return $e->url;
		}
		$this->fail('Yonlendirme beklenirdi');
	}

	public function test_switch_writes_only_admin_ui_and_redirects_to_new_screen(): void {
		(new Settings())->update(array( 'modules' => array( 'thanks' => true ), 'experiences' => array( 'engine' => 'legacy' ) ));
		$before = (new Settings())->all();

		$this->post('new');
		$url = $this->redirect_of(array( Ui_Switch::class, 'handle_switch' ));

		$this->assertStringContainsString('page=donation-panel', $url);
		$this->assertStringNotContainsString('wdp-popup-settings', $url);
		$after = (new Settings())->all();
		$this->assertSame('new', $after['admin']['ui']);
		$before['admin']['ui'] = 'new';
		$this->assertSame($before, $after, 'admin.ui disinda hicbir ayar degismemeli');
	}

	public function test_switch_back_to_legacy_redirects_to_classic_screen(): void {
		(new Settings())->update(array( 'admin' => array( 'ui' => 'new' ) ));
		$this->post('legacy');
		$url = $this->redirect_of(array( Ui_Switch::class, 'handle_switch' ));
		$this->assertStringContainsString('page=wdp-popup-settings', $url);
		$this->assertSame('legacy', (new Settings())->get('admin.ui'));
	}

	public function test_switch_is_idempotent_and_skips_write_when_unchanged(): void {
		$this->post('new');
		$this->redirect_of(array( Ui_Switch::class, 'handle_switch' ));
		$first = WDP_Test_State::$options[ Settings::OPTION_NAME ];
		$this->post('new');
		$this->redirect_of(array( Ui_Switch::class, 'handle_switch' ));
		$this->assertSame($first, WDP_Test_State::$options[ Settings::OPTION_NAME ]);
	}

	public function test_unknown_ui_value_changes_nothing(): void {
		$this->post('banana');
		$url = $this->redirect_of(array( Ui_Switch::class, 'handle_switch' ));
		$this->assertSame('legacy', (new Settings())->get('admin.ui'));
		$this->assertStringContainsString('page=wdp-popup-settings', $url);
	}

	public function test_switch_requires_capability(): void {
		WDP_Test_State::$caps = array();
		$this->post('new');
		$this->expectException(RuntimeException::class);
		try {
			Ui_Switch::handle_switch();
		} finally {
			$this->assertSame('legacy', (new Settings())->get('admin.ui'));
		}
	}

	public function test_switch_requires_valid_nonce(): void {
		$this->post('new', 'forged');
		try {
			Ui_Switch::handle_switch();
			$this->fail('Gecersiz nonce reddedilmeliydi');
		} catch (RuntimeException $e) {
			$this->assertSame('bad-nonce', $e->getMessage());
		}
		$this->assertSame('legacy', (new Settings())->get('admin.ui'));
	}

	public function test_notice_shows_for_capable_user_on_legacy_and_has_post_forms(): void {
		$this->assertTrue(Ui_Switch::should_show_notice(90417));
		ob_start();
		Ui_Switch::render_legacy_notice();
		$html = (string) ob_get_clean();
		$this->assertMatchesRegularExpression('/experience is ready|deneyimi hazır/', $html);
		$this->assertSame(2, substr_count($html, 'method="post"'));
		$this->assertStringContainsString('value="' . Ui_Switch::ACTION_SWITCH . '"', $html);
		$this->assertStringNotContainsString('<a ', $html, 'Gecis GET baglantisi olmamali');
	}

	public function test_notice_hidden_without_capability_and_on_new_ui(): void {
		WDP_Test_State::$caps = array();
		$this->assertFalse(Ui_Switch::should_show_notice(90417));
		ob_start();
		Ui_Switch::render_legacy_notice();
		$this->assertSame('', (string) ob_get_clean());

		WDP_Test_State::$caps = array( 'manage_woocommerce' );
		(new Settings())->update(array( 'admin' => array( 'ui' => 'new' ) ));
		$this->assertFalse(Ui_Switch::should_show_notice(90417));
	}

	public function test_dismiss_is_per_user_meta_and_post_only(): void {
		$_REQUEST = array( '_wpnonce' => 'valid-nonce' );
		$url      = $this->redirect_of(array( Ui_Switch::class, 'handle_dismiss' ));
		$this->assertStringContainsString('page=wdp-popup-settings', $url);
		$this->assertSame('1', (string) get_user_meta(90417, Ui_Switch::USER_META, true));
		$this->assertFalse(Ui_Switch::should_show_notice(90417));
		$this->assertTrue(Ui_Switch::should_show_notice(90418), 'Baska kullanici etkilenmemeli');
		$this->assertSame('legacy', (new Settings())->get('admin.ui'), 'Kapatma ayar yazmaz');
	}

	public function test_dismiss_requires_nonce_and_capability(): void {
		WDP_Test_State::$user_id = 90419;
		$_REQUEST = array( '_wpnonce' => 'forged' );
		try {
			Ui_Switch::handle_dismiss();
			$this->fail('nonce');
		} catch (RuntimeException $e) {
			$this->assertSame('bad-nonce', $e->getMessage());
		}
		$this->assertSame('', (string) get_user_meta(90419, Ui_Switch::USER_META, true));

		WDP_Test_State::$caps = array();
		$_REQUEST             = array( '_wpnonce' => 'valid-nonce' );
		$this->expectException(RuntimeException::class);
		Ui_Switch::handle_dismiss();
	}

	public function test_back_to_classic_form_is_post_with_nonce_and_mentions_removal(): void {
		$html = Ui_Switch::render_back_to_classic();
		$this->assertStringContainsString('method="post"', $html);
		$this->assertStringContainsString('name="ui" value="legacy"', $html);
		$this->assertStringContainsString('_wpnonce', $html);
		$this->assertStringContainsString('12.0', $html);
	}

	public function test_plugin_action_link_points_to_active_screen(): void {
		$links = Ui_Switch::action_links(array( 'deactivate' => '<a>x</a>' ));
		$this->assertStringContainsString('page=wdp-popup-settings', $links['settings']);
		$this->assertArrayHasKey('deactivate', $links);

		(new Settings())->update(array( 'admin' => array( 'ui' => 'new' ) ));
		$links = Ui_Switch::action_links(array());
		$this->assertStringContainsString('page=donation-panel', $links['settings']);

		WDP_Test_State::$caps = array();
		$this->assertSame(array( 'x' => 'y' ), Ui_Switch::action_links(array( 'x' => 'y' )));
	}

	public function test_init_registers_post_handlers_and_action_links_in_admin(): void {
		Ui_Switch::init();
		$this->assertArrayHasKey('admin_post_' . Ui_Switch::ACTION_SWITCH, WDP_Test_State::$actions);
		$this->assertArrayHasKey('admin_post_' . Ui_Switch::ACTION_DISMISS, WDP_Test_State::$actions);
		$this->assertArrayHasKey('plugin_action_links_' . Ui_Switch::PLUGIN_BASENAME, WDP_Test_State::$filters);
	}
}
