<?php
/**
 * Sayfa içi form kabı. Tema `donation-panel/experiences/inline.php` ile geçersiz kılabilir.
 *
 * @var array<string, mixed> $args Şablon verisi: model, container, dom_key, args, form_html.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_model = $args['model'];
$donation_panel_key   = (string) $args['dom_key'];
$donation_panel_opts  = (array) $args['args'];
?>
<div class="dp dp-exp" data-dp-exp data-dp-kind="inline" data-dp-product="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-dp-rest="<?php echo esc_url( (string) $donation_panel_opts['rest_url'] ); ?>" data-dp-nonce="<?php echo esc_attr( (string) $donation_panel_opts['nonce'] ); ?>" data-dp-checkout="<?php echo esc_url( (string) $donation_panel_opts['checkout_url'] ); ?>" data-dp-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-dp-msg-failed="<?php esc_attr_e( 'Something went wrong. Please try again.', 'woo-donation-popup' ); ?>">
	<section class="dp-inline" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-title">
		<?php echo $args['form_html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Form şablonunda kaçışlanmış çıktı. ?>
	</section>
</div>
