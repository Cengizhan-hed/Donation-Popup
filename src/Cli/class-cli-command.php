<?php
/**
 * WP-CLI: `wp donation-panel recalc-totals [--product=<id>|--all] [--dry-run]`.
 *
 * Yalnız `WP_CLI` tanımlıyken kaydedilir (bkz. `WDP_Plugin_Bootstrap::run`).
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
	 * Ürün bağış toplamlarını ödenmiş siparişlerden baştan hesaplar (siparişleri değiştirmez).
	 *
	 * Para birimi dönüşümü, iade ve işlem ücreti ayrımı eklentinin mevcut mantığıyla yapılır. Kuru çalıştırma hiçbir
	 * şey yazmaz; uygulamada yalnız farklı çıkan ürünler güncellenir. Döviz kuru bulunamayan siparişler toplama
	 * katılmaz (olduğu gibi bırakılır) ve uyarı olarak listelenir.
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
	 * : Yalnız ürün başına eski toplam -> hesaplanan toplam tablosunu göster; hiçbir şey yazma.
	 *
	 * ## EXAMPLES
	 *
	 *     wp donation-panel recalc-totals --all --dry-run
	 *     wp donation-panel recalc-totals --product=123
	 *
	 * @subcommand recalc-totals
	 *
	 * @param array<int, string>   $args       Konumsal bağımsız değişkenler.
	 * @param array<string, mixed> $assoc_args Adlandırılmış bağımsız değişkenler.
	 * @return void
	 */
	public function recalc_totals( $args, $assoc_args ) {
		unset( $args );
		$all     = ! empty( $assoc_args['all'] );
		$product = isset( $assoc_args['product'] ) ? absint( $assoc_args['product'] ) : 0;
		$dry_run = ! empty( $assoc_args['dry-run'] );

		if ( $all === ( $product > 0 ) ) {
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

		$result = $calculator->run( $ids, $dry_run );

		$table = array();
		foreach ( $result['rows'] as $row ) {
			$table[] = array(
				'product_id'  => $row['product_id'],
				'old_total'   => null === $row['old_total'] ? '-' : (string) $row['old_total'],
				'new_total'   => (string) $row['new_total'],
				'old_donors'  => null === $row['old_donors'] ? '-' : (string) $row['old_donors'],
				'new_donors'  => (string) $row['new_donors'],
				'orders'      => (string) $row['orders'],
				'unconverted' => (string) $row['unconverted'],
				'status'      => $row['written'] ? 'updated' : ( $row['changed'] ? 'differs' : 'same' ),
			);
		}
		\WP_CLI\Utils\format_items( 'table', $table, array( 'product_id', 'old_total', 'new_total', 'old_donors', 'new_donors', 'orders', 'unconverted', 'status' ) );

		if ( $result['unconverted'] > 0 ) {
			\WP_CLI::warning( sprintf( '%d order line(s) had no usable exchange rate and were left out (not converted).', $result['unconverted'] ) );
		}
		if ( $dry_run ) {
			\WP_CLI::success( sprintf( 'Dry run: %d of %d product(s) differ; nothing was written.', $result['changed'], count( $result['rows'] ) ) );
			return;
		}
		\WP_CLI::success( sprintf( 'Updated %d of %d product(s); %d already correct.', $result['written'], count( $result['rows'] ), count( $result['rows'] ) - $result['written'] ) );
	}
}
