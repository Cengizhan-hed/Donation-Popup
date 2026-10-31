<?php
/**
 * 12.4 e-posta: meta süzgeci (gizlilik, teknik anahtar, etiket dili), bağlam sızıntısı, teşekkür bölümü.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Settings;
use DonationPanel\Core\Uninstall;
use DonationPanel\WooCommerce\Email\Email_Context;
use DonationPanel\WooCommerce\Email\Email_Hooks;
use DonationPanel\WooCommerce\Email\Email_Meta_Filter;
use DonationPanel\WooCommerce\Email\Email_Thanks;
use PHPUnit\Framework\TestCase;

final class EmailTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
		Email_Context::end();
		$GLOBALS['wdp_test_locale'] = 'en_US';
	}

	protected function tearDown(): void {
		unset( $GLOBALS['wdp_test_locale'] );
		Email_Context::end();
	}

	/**
	 * @param array<string, string> $pairs anahtar => değer.
	 * @return array<int, object>
	 */
	private function formatted( array $pairs ): array {
		$out = array();
		$i   = 1;
		foreach ( $pairs as $key => $value ) {
			$out[ $i++ ] = (object) array(
				'key'           => $key,
				'value'         => $value,
				'display_key'   => $key,
				'display_value' => $value,
			);
		}
		return $out;
	}

	private function keys( array $formatted ): array {
		return array_values( array_map( static fn( $m ) => $m->key, $formatted ) );
	}

	private function item_meta(): array {
		return $this->formatted(
			array(
				'wdp_donation_type'    => 'custom',
				'wdp_donor_name'       => 'Çağlar Şükrü',
				'wdp_donor_phone'      => '+44 7700 900123',
				'wdp_donation_note'    => 'Ğüşiöç notu',
				'wdp_shareholder_1_phone' => '+90 530 000 00 00',
				'wdp_shareholder_1_name'  => 'Ayşe',
				'wdp_internal_flag'    => 'x',
				'donation_panel_hash'  => 'abc',
				'_donation_panel_raw'  => 'def',
				'_custom_price'        => '125',
			)
		);
	}

	public function test_customer_mail_hides_phone_and_technical_keys_but_keeps_the_rest(): void {
		$keys = $this->keys( Email_Meta_Filter::apply( $this->item_meta(), true ) );
		$this->assertSame( array( 'wdp_donation_type', 'wdp_donor_name', 'wdp_donation_note', 'wdp_shareholder_1_name' ), $keys );
	}

	public function test_admin_mail_keeps_phone_but_hides_technical_keys(): void {
		$keys = $this->keys( Email_Meta_Filter::apply( $this->item_meta(), false ) );
		$this->assertSame( array( 'wdp_donation_type', 'wdp_donor_name', 'wdp_donor_phone', 'wdp_donation_note', 'wdp_shareholder_1_phone', 'wdp_shareholder_1_name' ), $keys );
	}

	public function test_legacy_translated_keys_follow_the_label_language_and_legacy_phone_is_hidden_for_customers(): void {
		$legacy = $this->formatted(
			array(
				'Bağışçı Adı'     => 'Ali',
				'Bağışçı Telefonu' => '0530',
			)
		);
		$customer = Email_Meta_Filter::apply( $legacy, true );
		$this->assertSame( array( 'Bağışçı Adı' ), $this->keys( $customer ) );
		$this->assertSame( 'Donor name', array_values( $customer )[0]->display_key, 'etiket e-posta anındaki dile göre' );
		$admin = Email_Meta_Filter::apply( $legacy, false );
		$this->assertSame( array( 'Donor name', 'Donor phone' ), array_values( array_map( static fn( $m ) => $m->display_key, $admin ) ) );
	}

	public function test_labels_follow_the_locale_at_send_time_tr_and_en(): void {
		$legacy = $this->formatted(
			array(
				'Bağışçı Adı'       => 'Ali',
				'wdp_donor_name'    => 'Veli',
				'wdp_donation_type' => 'custom',
			)
		);
		$labels = static fn( $list ) => array_values( array_map( static fn( $m ) => $m->display_key, $list ) );

		$GLOBALS['wdp_test_locale'] = 'en_US';
		$en                         = $labels( Email_Meta_Filter::apply( $legacy, false ) );
		$GLOBALS['wdp_test_locale'] = 'tr_TR';
		$tr                         = $labels( Email_Meta_Filter::apply( $legacy, false ) );
		$this->assertSame( 'Donor name', $en[0], 'EN e-posta: Türkçe etiket kalmaz' );
		$this->assertSame( 'Bağışçı Adı', $tr[0], 'TR e-posta: Türkçe etiket' );
	}

	public function test_filter_does_nothing_outside_an_email(): void {
		$meta = $this->item_meta();
		$this->assertSame( $meta, Email_Meta_Filter::filter( $meta, null ), 'bağlam dışı: sızıntı yok' );
		Email_Context::on_before_table( null, false );
		$this->assertNotSame( $meta, Email_Meta_Filter::filter( $meta, null ) );
		Email_Context::end();
		$this->assertSame( $meta, Email_Meta_Filter::filter( $meta, null ), 'e-posta bitince bağlam kapanır' );
	}

	public function test_context_modes(): void {
		$customer = new class() {
			public function is_customer_email() {
				return true;
			}
		};
		$admin    = new class() {
			public function is_customer_email() {
				return false;
			}
		};
		Email_Context::on_header( '', $customer );
		$this->assertSame( Email_Context::CUSTOMER, Email_Context::mode() );
		Email_Context::on_header( '', $admin );
		$this->assertSame( Email_Context::ADMIN, Email_Context::mode() );
		Email_Context::on_before_table( null, false );
		$this->assertSame( Email_Context::CUSTOMER, Email_Context::mode(), '$sent_to_admin kesin bilgidir' );
		Email_Context::on_before_table( null, true );
		$this->assertSame( Email_Context::ADMIN, Email_Context::mode() );
		Email_Context::on_header( '', null );
		$this->assertSame( Email_Context::CUSTOMER, Email_Context::mode(), 'bilinmeyen: en kısıtlayıcı' );
	}

	private function item( int $pid, float $total, array $meta = array() ) {
		return new class( $pid, $total, $meta ) {
			private $pid;
			private $total;
			private $meta;
			public function __construct( $pid, $total, $meta ) {
				$this->pid   = $pid;
				$this->total = $total;
				$this->meta  = $meta;
			}
			public function get_product_id() {
				return $this->pid;
			}
			public function get_name() {
				return 'Su Kuyusu <b>7</b>';
			}
			public function get_total() {
				return $this->total;
			}
			public function get_meta( $key, $single = true ) {
				unset( $single );
				return $this->meta[ $key ] ?? '';
			}
			public function get_product() {
				return null;
			}
		};
	}

	private function order( array $items ) {
		return new class( $items ) {
			private $items;
			public function __construct( $items ) {
				$this->items = $items;
			}
			public function get_items() {
				return $this->items;
			}
			public function get_currency() {
				return 'TRY';
			}
		};
	}

	private function donation_order( int $pid = 7 ) {
		return $this->order( array( $this->item( $pid, 125.0, array( '_custom_price' => 125 ) ) ) );
	}

	public function test_thanks_uses_message_setting_or_builtin_and_respects_switch(): void {
		$settings = new Settings();
		$parts    = Email_Thanks::parts( $this->donation_order(), $settings );
		$this->assertSame( 'Your donation has been received. May it be a source of goodness.', $parts['message'], 'varsayılan söz sayfa ile aynı kaynak' );
		$this->assertSame( array(), $parts['campaign'], 'kampanyasız ürün: satır yok' );

		$settings->update( array( 'thanks' => array( 'message' => 'Allah kabul etsin, bu bağış hayra vesile olsun' ) ) );
		$parts = Email_Thanks::parts( $this->donation_order(), $settings );
		$this->assertSame( 'Allah kabul etsin, bu bağış hayra vesile olsun', $parts['message'] );
		$html = Email_Thanks::html( $parts );
		$this->assertStringContainsString( '<table', $html, 'e-posta uyumlu tablo' );
		$this->assertStringContainsString( '<p style="', $html, 'paragraf satır içi stilli' );
		$this->assertStringContainsString( 'border-left:4px solid #', $html );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringNotContainsString( '<style', $html );
		$this->assertStringNotContainsString( '<link', $html );
		$this->assertStringContainsString( 'Allah kabul etsin, bu bağış hayra vesile olsun', $html, 'Türkçe karakterler bozulmaz' );
		// Kaçışlama (wp_kses) gerçek WP'de e2e ile doğrulanır; birim kalıbı kses'i taklit etmez.
		$xss = Email_Thanks::html( array( 'message' => '<a href="https://x.test">k</a>', 'campaign' => array() ) );
		$this->assertStringContainsString( '<a style="color:#', $xss, 'bağlantı rengi satır içi' );
		$colors = Email_Thanks::colors();
		$this->assertMatchesRegularExpression( '/^#[0-9a-f]{6}$/', $colors['tint'] );
		$this->assertMatchesRegularExpression( '/^#[0-9a-f]{6}$/', $colors['accent'] );

		$settings->update( array( 'thanks' => array( 'email' => false ) ) );
		$this->assertSame( array(), Email_Thanks::parts( $this->donation_order(), $settings ), 'ayar kapalı: bölüm yok' );
	}

	public function test_thanks_is_empty_for_orders_without_a_donation_line(): void {
		$order = $this->order( array( $this->item( 9, 20.0 ) ) );
		$this->assertSame( array(), Email_Thanks::parts( $order, new Settings() ) );
	}

	public function test_campaign_line_html_and_plain(): void {
		$campaign = array(
			'project' => 'Su <i>Kuyusu</i>',
			'raised'  => '<span class="amount">1.000&nbsp;&#8378;</span>',
			'goal'    => '<span class="amount">5.000&nbsp;&#8378;</span>',
		);
		$html = Email_Thanks::campaign_line( $campaign, false );
		$this->assertStringContainsString( '&lt;i&gt;Kuyusu', $html, 'proje adı kaçışlı' );
		$this->assertStringContainsString( 'class="amount"', $html );
		$plain = Email_Thanks::campaign_line( $campaign, true );
		$this->assertStringNotContainsString( '<', $plain );
		$this->assertStringNotContainsString( '&nbsp;', $plain );
		$this->assertStringContainsString( "1.000\u{00A0}₺", $plain );
		$this->assertSame( '', Email_Thanks::campaign_line( array(), false ) );
	}

	public function test_campaign_parts_come_from_progress_data(): void {
		WDP_Test_State::$post_meta[7] = array(
			'_enable_progress_bar'        => 'yes',
			'_progress_bar_limit'         => '5000',
			'_wdp_total_donation_amount'  => '1000',
		);
		$parts = Email_Thanks::parts( $this->donation_order( 7 ), new Settings() );
		$this->assertNotEmpty( $parts['campaign'], 'kampanyalı ürün: tek satır' );
		$this->assertStringContainsString( 'Su Kuyusu 7', $parts['campaign']['project'] );
		$this->assertStringContainsString( '1.000', $parts['campaign']['raised'] );
		$this->assertStringContainsString( '5.000', $parts['campaign']['goal'] );
		$plain = Email_Thanks::plain( $parts );
		$this->assertStringContainsString( 'raised of', $plain );
	}

	public function test_plain_text_version_has_no_markup(): void {
		$plain = Email_Thanks::plain(
			array(
				'message'  => "Allah kabul etsin<br>Teşekkürler <a href=\"https://x.test\">bağlantı</a> &amp; <strong>çok</strong>",
				'campaign' => array(),
			)
		);
		$this->assertSame( "Allah kabul etsin\nTeşekkürler bağlantı & çok", $plain );
	}

	public function test_render_skips_admin_and_non_matching_emails(): void {
		$order = $this->donation_order();
		$mail  = static function ( $id ) {
			return (object) array( 'id' => $id );
		};
		ob_start();
		Email_Thanks::render( $order, true, false, $mail( 'customer_processing_order' ) );
		Email_Thanks::render( $order, false, false, $mail( 'customer_invoice' ) );
		Email_Thanks::render( $order, false, false, null );
		Email_Thanks::render( $order, false, false, $mail( 'customer_on_hold_order' ) );
		Email_Thanks::render( $order, false, true, $mail( 'customer_on_hold_order' ) );
		$this->assertSame( '', ob_get_clean(), 'yönetici / başka e-posta / e-posta nesnesiz: çıktı yok' );
	}

	public function test_thanks_only_for_paid_customer_emails_not_on_hold(): void {
		$this->assertSame( array( 'customer_processing_order', 'customer_completed_order' ), Email_Thanks::EMAIL_IDS );
		$this->assertNotContains( 'customer_on_hold_order', Email_Thanks::EMAIL_IDS, 'ödemesi gelmemiş (beklemede): teşekkür yok' );
	}

	public function test_hooks_are_registered_for_standard_woocommerce_email_hooks_only(): void {
		Email_Hooks::init();
		foreach ( array( 'woocommerce_email_before_order_table', 'woocommerce_order_item_get_formatted_meta_data' ) as $hook ) {
			$this->assertArrayHasKey( $hook, WDP_Test_State::$filters + WDP_Test_State::$actions, $hook );
		}
	}

	public function test_uninstall_covers_embed_transient_prefix(): void {
		$this->assertContains( 'wdp_cf_', Uninstall::transient_prefixes() );
	}
}
