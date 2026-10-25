<?php
/**
 * Teşekkür özeti (WooCommerce "sipariş alındı" sayfası). Tema: `donation-panel/thanks/summary.php` ile geçersiz kılınır.
 * KİŞİ BİLGİSİ basılmaz.
 *
 * @var array<string, mixed> $args summary, order_number, impact, message, celebrate, share, share_text, share_url, again_url.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_summary  = isset( $args['summary'] ) && is_array( $args['summary'] ) ? $args['summary'] : array();
$donation_panel_lines    = isset( $donation_panel_summary['lines'] ) ? (array) $donation_panel_summary['lines'] : array();
$donation_panel_currency = isset( $donation_panel_summary['currency'] ) ? (string) $donation_panel_summary['currency'] : '';
$donation_panel_message  = ! empty( $args['message'] ) ? (string) $args['message'] : __( 'Your donation has been received. May it be a source of goodness.', 'woo-donation-popup' );
$donation_panel_money    = static function ( $amount ) use ( $donation_panel_currency ) {
	return function_exists( 'wc_price' ) ? wc_price( (float) $amount, array( 'currency' => $donation_panel_currency ) ) : esc_html( (string) $amount );
};
?>
<section class="dp dp-thanks" data-dp-thanks data-celebrate="<?php echo ! empty( $args['celebrate'] ) ? '1' : '0'; ?>" aria-labelledby="dp-thanks-title">
	<svg class="dp-thanks__ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" focusable="false">
		<circle class="dp-thanks__disc" cx="60" cy="60" r="52"/>
		<circle class="dp-thanks__circle" cx="60" cy="60" r="52"/>
		<path class="dp-thanks__tick" d="M38 62l16 16 30-34"/>
	</svg>
	<h2 class="dp-thanks__title" id="dp-thanks-title"><?php esc_html_e( 'Thank you!', 'woo-donation-popup' ); ?></h2>
	<p class="dp-thanks__sub dp-muted"><?php echo esc_html( $donation_panel_message ); ?></p>

	<div class="dp-thanks__card">
		<?php foreach ( $donation_panel_lines as $donation_panel_line ) : ?>
			<div class="dp-thanks__row">
				<b class="dp-thanks__project"><?php echo esc_html( (string) $donation_panel_line['project'] ); ?></b>
				<b class="dp-num dp-thanks__amount"><?php echo wp_kses_post( $donation_panel_money( $donation_panel_line['amount'] ) ); ?></b>
			</div>
		<?php endforeach; ?>
		<?php if ( count( $donation_panel_lines ) > 1 ) : ?>
			<div class="dp-thanks__row dp-thanks__row--total">
				<span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span>
				<b class="dp-num dp-thanks__amount"><?php echo wp_kses_post( $donation_panel_money( $donation_panel_summary['total'] ) ); ?></b>
			</div>
		<?php endif; ?>
		<?php if ( ! empty( $args['impact'] ) ) : ?>
			<p class="dp-impact" data-dp-thanks-impact><?php echo esc_html( (string) $args['impact'] ); ?></p>
		<?php endif; ?>
		<?php if ( ! empty( $args['order_number'] ) ) : ?>
			<p class="dp-thanks__order dp-muted">
				<?php
				/* translators: %s: order number. */
				echo esc_html( sprintf( __( 'Order %s', 'woo-donation-popup' ), '#' . (string) $args['order_number'] ) );
				?>
			</p>
		<?php endif; ?>
	</div>

	<div class="dp-thanks__actions">
		<?php if ( ! empty( $args['share'] ) ) : ?>
			<button type="button" class="dp-btn dp-btn--ghost" data-dp-share hidden
				data-title="<?php echo esc_attr( (string) $args['share_text'] ); ?>"
				data-text="<?php echo esc_attr( (string) $args['share_text'] ); ?>"
				data-url="<?php echo esc_url( (string) $args['share_url'] ); ?>"
				data-copied="<?php esc_attr_e( 'Link copied', 'woo-donation-popup' ); ?>"
				data-failed="<?php esc_attr_e( 'Could not copy the link', 'woo-donation-popup' ); ?>"><?php esc_html_e( 'Share', 'woo-donation-popup' ); ?></button>
		<?php endif; ?>
		<?php if ( ! empty( $args['again_url'] ) ) : ?>
			<a class="dp-btn dp-btn--ghost" href="<?php echo esc_url( (string) $args['again_url'] ); ?>"><?php esc_html_e( 'Give again', 'woo-donation-popup' ); ?></a>
		<?php endif; ?>
	</div>
	<p class="dp-thanks__toast dp-sr" role="status" aria-live="polite" data-dp-thanks-toast></p>
</section>
