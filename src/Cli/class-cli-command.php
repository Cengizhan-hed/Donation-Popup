<?php
/**
 * WP-CLI: `wp donation-panel recalc-totals [--product=<id>|--all] [--dry-run]` (yalnız kuru çalıştırma).
 *
 * Yalnız `WP_CLI` tanımlıyken kaydedilir (bkz. `Bootstrap::run`).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Cli;

defined( 'ABSPATH' ) || exit;

/**
 * Bağış Paneli komutları.
 */
final class Cli_Command {

	/**
	 * Komutu WP-CLI'a kaydeder.
	 *
	 * @return void
	 */
	public static function register() {
		if ( ! class_exists( '\WP_CLI' ) ) {
			return;
		}
		\WP_CLI::add_command( 'donation-panel', self::class );
	}

	/**
	 * Kampanya toplamlarını formülle hesaplar ve saklanan toplamla karşılaştırır. SALT OKUNUR: hiçbir şey yazmaz.
	 *
	 * Formül: devreden tutar + kampanya başlangıcından sonra ödenmiş siparişlerdeki bağış tutarları (iade düşülmüş,
	 * sipariş anındaki kurla ana para birimine çevrilmiş). Döviz kuru bulunamayan siparişler toplama katılmaz ve uyarı
	 * olarak listelenir. Toplamı değiştirmek için Bağış Paneli > Kampanyalar ekranındaki "Yeniden hesapla" düğmesi
	 * (önizleme + yönetici onayı) kullanılır; komut satırından yazma yoktur.
	 *
	 * ## OPTIONS
	 *
	 * [--product=<id>]
	 * : Yalnız bu ürün.
	 *
	 * [--all]
	 * : Tüm bağış ürünleri.
	 *
	 * [--dry-run]
	 * : Kabul edilir; komut zaten her zaman kuru çalıştırmadır.
	 *
	 * ## EXAMPLES
	 *
	 *     wp donation-panel recalc-totals --all --dry-run
	 *     wp donation-panel recalc-totals --product=123 --dry-run
	 *
	 * @subcommand recalc-totals
	 *
	 * @param array<int, string>   $args       Konumsal bağımsız değişkenler.
	 * @param array<string, mixed> $assoc_args Adlandırılmış bağımsız değişkenler.
	 * @return void
	 */
	public function recalc_totals( $args, $assoc_args ) {
		unset( $args );
		if ( isset( $assoc_args['apply'] ) || isset( $assoc_args['i-understand'] ) ) {
			\WP_CLI::error( 'Writing from the command line was removed. Use Donation Panel > Campaigns > Recalculate (preview, then approve).' );
			return;
		}
		$all     = ! empty( $assoc_args['all'] );
		$product = isset( $assoc_args['product'] ) ? absint( $assoc_args['product'] ) : 0;

		if ( ( $product > 0 ) === $all ) {
			\WP_CLI::error( 'Give exactly one of --product=<id> or --all.' );
			return;
		}
		if ( ! class_exists( '\WDP_Utils' ) || ! function_exists( 'wc_get_orders' ) ) {
			\WP_CLI::error( 'WooCommerce is not active.' );
			return;
		}

		$calculator = new Totals_Recalculator();
		$ids        = $all ? $calculator->all_product_ids() : array( $product );
		if ( ! $ids ) {
			\WP_CLI::success( 'No donation products found.' );
			return;
		}

		$result = $calculator->run( $ids );

		$table = array();
		foreach ( $result['rows'] as $row ) {
			$table[] = array(
				'product_id'  => $row['product_id'],
				'stored'      => null === $row['stored'] ? '-' : (string) $row['stored'],
				'computed'    => (string) $row['computed'],
				'diff'        => null === $row['diff'] ? '-' : (string) $row['diff'],
				'carried'     => (string) $row['carried'],
				'start'       => null === $row['start'] ? '-' : wp_date( 'Y-m-d', (int) $row['start'] ),
				'orders'      => (string) $row['orders'],
				'unconverted' => (string) $row['unconverted'],
				'status'      => $row['changed'] ? 'differs' : 'same',
			);
		}
		\WP_CLI\Utils\format_items( 'table', $table, array( 'product_id', 'stored', 'computed', 'diff', 'carried', 'start', 'orders', 'unconverted', 'status' ) );

		if ( $result['unconverted'] > 0 ) {
			\WP_CLI::warning( sprintf( '%d order line(s) had no usable exchange rate and were left out (not converted).', $result['unconverted'] ) );
		}
		\WP_CLI::success( sprintf( 'Dry run: %d of %d product(s) differ; nothing was written.', $result['changed'], count( $result['rows'] ) ) );
	}
}
