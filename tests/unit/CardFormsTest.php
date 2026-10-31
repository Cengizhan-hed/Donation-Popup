<?php
/**
 * 12.4 gömülü kart formları: paket (herkese önbellekli) yetkiden bağımsız yalnız herkese açık ürünü içerir; döngü düğmesi
 * formu sayfa sonu kuyruğuna ekler; süzgeç ürün başına dışlar; Form_Pack JSON'u `<script>` içinde güvenli.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\EntryPoints\Card_Forms;
use DonationPanel\Modules\EntryPoints\Form_Pack;
use PHPUnit\Framework\TestCase;

final class CardFormsTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		Card_Forms::reset_for_tests();
	}

	private function product(int $id, string $status = 'publish', string $password = ''): WC_Product {
		$p                = new WC_Product($id);
		$p->type          = 'simple';
		$p->status        = $status;
		$p->post_password = $password;
		WDP_Test_State::$products[ $id ] = $p;
		return $p;
	}

	public function test_only_public_products_even_for_admin_render(): void {
		// Yönetici sayfayı çizse de (her yetki açık) gizli/özel/taslak/şifreli ürün herkese açık sayılmaz.
		WDP_Test_State::$caps = array( 'edit_post', 'edit_products', 'read_private_products', 'manage_woocommerce', 'read' );
		$this->product(31);
		$this->product(32, 'private');
		$this->product(33, 'draft');
		$this->product(34, 'publish', 'gizli');
		$this->product(35, 'pending');
		$this->assertTrue(Card_Forms::public_product(31));
		foreach (array( 32, 33, 34, 35, 999 ) as $id) {
			$this->assertFalse(Card_Forms::public_product($id), (string) $id);
		}
	}

	public function test_piece_key_bounded_per_product_and_invalidated_by_product_or_setting_change(): void {
		$list = \DonationPanel\Modules\EntryPoints\Donations_List::class;
		$this->product(50);
		$a = Card_Forms::piece_key(50, 'popup');
		$this->assertSame($a, Card_Forms::piece_key(50, 'popup'), 'aynı ürün + tür → tek anahtar (arama/sayfa varyasyonu yok)');
		$this->assertNotSame($a, Card_Forms::piece_key(51, 'popup'));
		$this->assertNotSame($a, Card_Forms::piece_key(50, 'side_panel'));
		$this->assertLessThanOrEqual(172, strlen('_transient_timeout_' . $a));
		// 12.4 (O1): anahtar sürümsüz (ürün başına tek satır); sürüm parçanın değerinde, bump onu bayatlatır.
		$piece = array( 'h' => 'x', 'm' => array(), 'cv' => $list::cache_version() );
		$this->assertTrue($list::is_current($piece));
		$list::reset_bump_guard();
		$list::on_product_meta(1, 50, '_price', '10');
		$this->assertSame($a, Card_Forms::piece_key(50, 'popup'), 'bump anahtarı değiştirmez (birikim yok)');
		$this->assertFalse($list::is_current($piece));
		// Formu etkileyen ayar değişti → yine bayatlar; ilgisiz seçenek değiştirmez.
		$piece = array( 'h' => 'x', 'm' => array(), 'cv' => $list::cache_version() );
		$list::reset_bump_guard();
		$list::on_option('wdp_button_settings');
		$this->assertFalse($list::is_current($piece));
		$piece = array( 'h' => 'x', 'm' => array(), 'cv' => $list::cache_version() );
		$list::reset_bump_guard();
		$list::on_option('woocommerce_queue_flush');
		$this->assertTrue($list::is_current($piece));
	}

	public function test_filter_excludes_per_product(): void {
		WDP_Test_State::$filters['donation_panel_prefetch_forms'] = static function ($on, $id = 0) {
			return 41 !== (int) $id && $on;
		};
		$this->assertSame(array( 40, 42 ), Card_Forms::allowed(array( 40, 41, 42 ), 'popup'));
		WDP_Test_State::$filters['donation_panel_prefetch_forms'] = static function () {
			return false;
		};
		$this->assertSame(array(), Card_Forms::allowed(array( 40, 41 ), 'popup'));
	}

	public function test_pack_json_is_script_safe_and_lossless_normalization(): void {
		$html = '<div data-dp-product="7"><dialog id="dp-7-popup-3" aria-labelledby="dp-7-popup-3-title"><form data-product-id="7" data-min="7"><p>&lt;/script&gt; </script> <!-- x --></p></form></dialog></div>';
		$norm = Form_Pack::normalize($html, 7);
		$this->assertStringNotContainsString('dp-7-popup-3', (string) $norm);
		$this->assertStringContainsString('data-min="7"', (string) $norm, 'yalnız ürün kimliği öznitelikleri belirteçlenir');
		$this->assertSame($html, str_replace(array( Form_Pack::KEY_TOKEN, Form_Pack::ID_TOKEN ), array( 'dp-7-popup-3', '7' ), (string) $norm));
		$this->assertNull(Form_Pack::normalize("a\x01b", 7));
		$pack = new Form_Pack();
		$this->assertGreaterThan(0, $pack->add(7, $html));
		$this->assertSame(0, $pack->add(7, $html), 'aynı ürün bir kez');
		$json = Form_Pack::json($pack->to_array());
		$this->assertDoesNotMatchRegularExpression('#</script#i', $json);
		$this->assertStringNotContainsString('<!--', $json);
		$this->assertIsArray(json_decode($json, true));
	}
}
