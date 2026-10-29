<?php
/**
 * Teşekkür özeti (WooCommerce "sipariş alındı" sayfası). Tema: `donation-panel/thanks/summary.php` ile geçersiz kılınır.
 * KİŞİ BİLGİSİ basılmaz.
 *
 * @var array<string, mixed> $args summary, order_number, impact, message, celebrate, share, share_text, share_url, again_url, campaign, tax_relief, account.
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
$donation_panel_campaign = isset( $args['campaign'] ) && is_array( $args['campaign'] ) ? $args['campaign'] : array();
$donation_panel_account  = isset( $args['account'] ) && is_array( $args['account'] ) ? $args['account'] : array();
$donation_panel_percent  = static function ( $value, $decimals ) {
	/* translators: %s: percentage number, for example 62. */
	return sprintf( __( '%s%%', 'woo-donation-popup' ), number_format_i18n( (float) $value, $decimals ) );
};
?>
<section class="donation-panel donation-panel-thanks" data-dp-thanks data-celebrate="<?php echo ! empty( $args['celebrate'] ) ? '1' : '0'; ?>" aria-labelledby="dp-thanks-title">
	<div class="donation-panel-thanks__hero">
		<span class="donation-panel-thanks__ring" aria-hidden="true">
			<svg viewBox="0 0 24 24" width="40" height="40" focusable="false"><path class="donation-panel-thanks__tick" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
		</span>
		<h2 class="donation-panel-thanks__title" id="dp-thanks-title"><?php esc_html_e( 'Thank you!', 'woo-donation-popup' ); ?></h2>
		<p class="donation-panel-thanks__sub"><?php echo esc_html( $donation_panel_message ); ?></p>
	</div>

	<div class="donation-panel-thanks__card">
		<?php foreach ( $donation_panel_lines as $donation_panel_line ) : ?>
			<div class="donation-panel-thanks__row">
				<span class="donation-panel-thanks__label"><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></span>
				<b class="donation-panel-thanks__project"><?php echo esc_html( (string) $donation_panel_line['project'] ); ?></b>
			</div>
			<div class="donation-panel-thanks__row">
				<span class="donation-panel-thanks__label"><?php esc_html_e( 'Amount', 'woo-donation-popup' ); ?></span>
				<b class="donation-panel-num donation-panel-thanks__amount"><?php echo wp_kses_post( $donation_panel_money( $donation_panel_line['amount'] ) ); ?></b>
			</div>
		<?php endforeach; ?>
		<?php if ( count( $donation_panel_lines ) > 1 ) : ?>
			<div class="donation-panel-thanks__row donation-panel-thanks__row--total">
				<span class="donation-panel-thanks__label"><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span>
				<b class="donation-panel-num donation-panel-thanks__amount"><?php echo wp_kses_post( $donation_panel_money( $donation_panel_summary['total'] ) ); ?></b>
			</div>
		<?php endif; ?>
		<?php if ( ! empty( $args['order_number'] ) ) : ?>
			<div class="donation-panel-thanks__row">
				<span class="donation-panel-thanks__label"><?php esc_html_e( 'Donation no.', 'woo-donation-popup' ); ?></span>
				<b class="donation-panel-num donation-panel-thanks__order"><?php echo esc_html( '#' . (string) $args['order_number'] ); ?></b>
			</div>
		<?php endif; ?>
		<?php if ( ! empty( $args['impact'] ) ) : ?>
			<p class="donation-panel-impact" data-dp-thanks-impact><?php echo esc_html( (string) $args['impact'] ); ?></p>
		<?php endif; ?>
		<?php if ( ! empty( $args['tax_relief'] ) ) : ?>
			<p class="donation-panel-thanks__tax"><?php esc_html_e( 'Your tax relief declaration has been recorded with this donation.', 'woo-donation-popup' ); ?></p>
		<?php endif; ?>
		<?php if ( $donation_panel_campaign ) : ?>
			<?php
			$donation_panel_decimals = round( (float) $donation_panel_campaign['before'] ) === round( (float) $donation_panel_campaign['after'] ) ? 1 : 0;
			?>
			<div class="donation-panel-thanks__divider" aria-hidden="true"></div>
			<div class="donation-panel-thanks__impactbar" data-dp-thanks-campaign>
				<div class="donation-panel-thanks__row donation-panel-thanks__row--bar">
					<span class="donation-panel-thanks__barlabel"><?php esc_html_e( 'Your contribution to the campaign', 'woo-donation-popup' ); ?></span>
					<b class="donation-panel-num donation-panel-thanks__barvalue"><?php echo esc_html( $donation_panel_percent( $donation_panel_campaign['before'], $donation_panel_decimals ) . ' → ' . $donation_panel_percent( $donation_panel_campaign['after'], $donation_panel_decimals ) ); ?></b>
				</div>
				<div class="dpx-track" role="img" aria-label="<?php echo esc_attr( sprintf( /* translators: 1: percentage before this gift, 2: percentage after this gift. */ __( 'Campaign progress rose from %1$s to %2$s', 'woo-donation-popup' ), $donation_panel_percent( $donation_panel_campaign['before'], $donation_panel_decimals ), $donation_panel_percent( $donation_panel_campaign['after'], $donation_panel_decimals ) ) ); ?>">
					<i class="dpx-track__brand" style="inline-size:<?php echo esc_attr( (string) $donation_panel_campaign['before'] ); ?>%"></i>
					<i class="dpx-track__accent" style="inline-size:<?php echo esc_attr( (string) max( 1.0, (float) $donation_panel_campaign['share'] ) ); ?>%"></i>
				</div>
			</div>
		<?php endif; ?>
	</div>

	<?php if ( $donation_panel_account ) : ?>
		<a class="donation-panel-thanks__promo" href="<?php echo esc_url( (string) $donation_panel_account['url'] ); ?>">
			<span class="donation-panel-thanks__promo-ico" aria-hidden="true"><svg class="dpx-ico" width="20" height="20" viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span>
			<span class="donation-panel-thanks__promo-text">
				<b><?php esc_html_e( 'Follow your donations', 'woo-donation-popup' ); ?></b>
				<span><?php echo ! empty( $donation_panel_account['logged_in'] ) ? esc_html__( 'See every donation and receipt in one place.', 'woo-donation-popup' ) : esc_html__( 'Open an account in one tap; all your donations in one place.', 'woo-donation-popup' ); ?></span>
			</span>
		</a>
	<?php endif; ?>

	<div class="donation-panel-thanks__actions">
		<?php if ( ! empty( $args['again_url'] ) ) : ?>
			<a class="dpx-btn dpx-btn--primary" href="<?php echo esc_url( (string) $args['again_url'] ); ?>"><?php esc_html_e( 'Give again', 'woo-donation-popup' ); ?></a>
		<?php endif; ?>
		<?php if ( ! empty( $args['share'] ) ) : ?>
			<button type="button" class="dpx-btn dpx-btn--outline" data-dp-share hidden
				data-title="<?php echo esc_attr( (string) $args['share_text'] ); ?>"
				data-text="<?php echo esc_attr( (string) $args['share_text'] ); ?>"
				data-url="<?php echo esc_url( (string) $args['share_url'] ); ?>"
				data-copied="<?php esc_attr_e( 'Link copied', 'woo-donation-popup' ); ?>"
				data-failed="<?php esc_attr_e( 'Could not copy the link', 'woo-donation-popup' ); ?>"><svg class="dpx-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/></svg><?php esc_html_e( 'Share the campaign', 'woo-donation-popup' ); ?></button>
		<?php endif; ?>
	</div>
	<p class="donation-panel-thanks__toast donation-panel-sr" role="status" aria-live="polite" data-dp-thanks-toast></p>
</section>
