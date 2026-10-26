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
	 * Tanım: yalnız ödenmiş siparişler (varsayılan completed, processing), iade düşülmüş, sipariş anındaki kurla ana
	 * para birimine çevrilmiş, varsa kampanya dönemiyle sınırlı. VARSAYILAN HER ZAMAN KURU ÇALIŞTIRMADIR: hiçbir şey
	 * yazılmaz. Yazmak için `--apply --i-understand` birlikte verilmelidir; yazma elle eklenen tutara dokunmaz.
	 * Döviz kuru bulunamayan siparişler toplama katılmaz ve uyarı olarak listelenir.
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
	 * : Varsayılan davranış (açıkça yazmasanız da): hiçbir şey yazılmaz.
	 *
	 * [--apply]
	 * : Hesaplanan toplamı yazar. Yalnız `--i-understand` ile birlikte çalışır.
	 *
	 * [--i-understand]
	 * : `--apply` için açık onay bayrağı.
	 *
	 * [--detail=<ids>]
	 * : Virgülle ayrılmış ürün kimlikleri için neden ayrıştırma ayrıntısını yazdırır.
	 *
	 * ## EXAMPLES
	 *
	 *     wp donation-panel recalc-totals --all --dry-run
	 *     wp donation-panel recalc-totals --product=123 --detail=123
	 *     wp donation-panel recalc-totals --product=123 --apply --i-understand
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
		$apply   = ! empty( $assoc_args['apply'] ) && ! empty( $assoc_args['i-understand'] ) && empty( $assoc_args['dry-run'] );
		$dry_run = ! $apply;
		if ( ! empty( $assoc_args['apply'] ) && empty( $assoc_args['i-understand'] ) ) {
			\WP_CLI::error( '--apply requires --i-understand; nothing was written.' );
			return;
		}

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

		$result = $calculator->run( $ids, $dry_run, $apply );

		$table = array();
		foreach ( $result['rows'] as $row ) {
			$table[] = array(
				'product_id'  => $row['product_id'],
				'old_total'   => null === $row['old_total'] ? '-' : (string) $row['old_total'],
				'new_total'   => (string) $row['new_total'],
				'diff'        => null === $row['diff'] ? '-' : (string) $row['diff'],
				'manual_sug'  => (string) $row['suggested_manual'],
				'shown_after' => (string) $row['display_after'],
				'reason'      => (string) $row['reason'],
				'old_donors'  => null === $row['old_donors'] ? '-' : (string) $row['old_donors'],
				'new_donors'  => (string) $row['new_donors'],
				'orders'      => (string) $row['orders'],
				'unconverted' => (string) $row['unconverted'],
				'status'      => $row['written'] ? 'updated' : ( $row['changed'] ? 'differs' : 'same' ),
			);
		}
		\WP_CLI\Utils\format_items( 'table', $table, array( 'product_id', 'old_total', 'new_total', 'diff', 'manual_sug', 'shown_after', 'reason', 'old_donors', 'new_donors', 'orders', 'unconverted', 'status' ) );

		$detail = isset( $assoc_args['detail'] ) ? array_filter( array_map( 'absint', explode( ',', (string) $assoc_args['detail'] ) ) ) : array();
		foreach ( $result['rows'] as $row ) {
			if ( in_array( (int) $row['product_id'], $detail, true ) ) {
				\WP_CLI::log( sprintf( 'product %d breakdown: %s', (int) $row['product_id'], (string) wp_json_encode( $row['breakdown'] ) ) );
			}
		}

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
