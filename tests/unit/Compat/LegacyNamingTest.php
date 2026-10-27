<?php
/**
 * Fix2 #28: kod içi Türkçe iç adlar ("sadaka") genel adlara çevrildi; yalnız dışa açık/veritabanı adları kalır
 * ve eski adlar Compat\Legacy_Context ile okunur.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Compat\Legacy_Context;
use PHPUnit\Framework\TestCase;

final class LegacyNamingTest extends TestCase {

	/**
	 * src/ içinde geçmesine izin verilen "sadaka" içeren adlar: kanca, sepet kalemi, meta/seçenek anahtarı, CSS sınıfı
	 * (docs/HOOKS.md "Eski sözleşme"; adlar değişmez) ve Legacy_Context eski anahtar eşlemesi.
	 *
	 * @var string[]
	 */
	private const ALLOWED = array(
		'wdp_sadaka_donation',
		'wdp_sadaka_linked_wc_product',
		'wdp_sadaka_toggle_label',
		'wdp_sadaka_wc_product_id',
		'wdp_sadaka_line_product_ids',
		'wdp_sadaka_cart_thumbnail_size',
		'wdp_sadaka_price_label',
		'wdp_sadaka_links_audit',
		'wdp_sadaka_line_ids',
		'wdp_sadaka_visibility_cache_cleared',
		'_enable_sadaka_donation',
		'_sadaka_min_price',
		'_sadaka_wc_product_id',
		'_sadaka_toggle_label',
		'_sadaka_fixed_price',
		'_sadaka_donation_message',
		'sadaka_wc_product_id',
		'sadaka_toggle_label',
		'wdp-sadaka-cart-thumb',
		'enable_sadaka_donation',
		'sadaka_donation_message',
		'sadaka_min_price',
		'sadaka_fixed_price',
		'sadaka_is_fixed_price',
		'sadaka_price_placeholder',
		'is_sadaka',
		'sadaka_',
		'_sadaka_',
		'sadaka',
	);

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_no_unlisted_sadaka_identifiers_in_source(): void {
		$root  = dirname( __DIR__, 3 ) . '/src';
		$found = array();
		$iter  = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );
		foreach ( $iter as $file ) {
			if ( 'php' !== $file->getExtension() ) {
				continue;
			}
			if ( preg_match_all( '/[A-Za-z0-9_-]*sadaka[A-Za-z0-9_-]*/i', (string) file_get_contents( $file->getPathname() ), $m ) ) {
				foreach ( $m[0] as $token ) {
					if ( ! in_array( $token, self::ALLOWED, true ) ) {
						$found[ $token ] = substr( $file->getPathname(), strlen( $root ) + 1 );
					}
				}
			}
		}
		$this->assertSame( array(), $found, 'Listede olmayan "sadaka" iç adı (genel ad kullanın): ' . wp_json_encode( $found ) );
	}

	public function test_internal_context_keys_use_generic_names(): void {
		$tab = (string) file_get_contents( dirname( __DIR__, 3 ) . '/src/Domain/class-product-context.php' );
		$this->assertStringNotContainsString( "'sadaka_", $tab );
		$this->assertStringContainsString( "'addon_wc_product_id'", $tab );
	}

	public function test_form_context_filter_still_sees_and_can_change_legacy_keys(): void {
		$seen = array();
		WDP_Test_State::$filters['wdp_form_context'] = static function ( $context ) use ( &$seen ) {
			$seen                          = $context;
			$context['sadaka_toggle_label'] = 'Changed by theme';
			$context['custom_extra']        = 'kept';
			return $context;
		};
		$out = Legacy_Context::filter_form_context(
			array(
				'addon_toggle_label'    => 'Add a donation',
				'addon_min_price'       => '5',
				'enable_addon_donation' => true,
			),
			null
		);
		$this->assertSame( 'Add a donation', $seen['sadaka_toggle_label'] );
		$this->assertSame( '5', $seen['sadaka_min_price'] );
		$this->assertTrue( $seen['enable_sadaka_donation'] );
		$this->assertSame( 'Changed by theme', $out['addon_toggle_label'], 'Süzgeçteki değişiklik yeni ada geri yazılır.' );
		$this->assertSame( '5', $out['addon_min_price'] );
		$this->assertSame( 'kept', $out['custom_extra'] );
		$this->assertArrayNotHasKey( 'sadaka_toggle_label', $out );
		$this->assertArrayNotHasKey( 'sadaka_min_price', $out );
	}

	public function test_legacy_session_flag_is_still_recognised(): void {
		$this->assertTrue( Legacy_Context::is_addon_data( array( 'is_addon' => true ) ) );
		$this->assertTrue( Legacy_Context::is_addon_data( array( 'is_sadaka' => true ) ), 'Eski sepet oturumundaki işaret okunur.' );
		$this->assertFalse( Legacy_Context::is_addon_data( array( 'full_name' => 'Ada' ) ) );
	}
}
