<?php
/**
 * Popup kabı (≤639 px: alttan panel). Tema `donation-panel/experiences/popup.php` ile geçersiz kılabilir.
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
<div class="dp dp-exp" data-dp-exp data-dp-kind="popup" data-dp-product="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-dp-rest="<?php echo esc_url( (string) $donation_panel_opts['rest_url'] ); ?>" data-dp-nonce="<?php echo esc_attr( (string) $donation_panel_opts['nonce'] ); ?>" data-dp-checkout="<?php echo esc_url( (string) $donation_panel_opts['checkout_url'] ); ?>" data-dp-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-dp-msg-failed="<?php esc_attr_e( 'Something went wrong. Please try again.', 'woo-donation-popup' ); ?>">
	<button type="button" class="dp-btn dp-trigger<?php echo ! empty( $donation_panel_opts['button_full_width'] ) ? ' dp-btn--block' : ''; ?>" data-dp-open aria-haspopup="dialog" aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>"><?php echo esc_html( (string) $donation_panel_opts['button_text'] ); ?></button>
	<div class="dp-overlay dp-overlay--modal" data-dp-overlay>
		<div class="dp-surface dp-surface--modal" id="<?php echo esc_attr( $donation_panel_key ); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-title" tabindex="-1" data-dp-surface>
			<div class="dp-surface__handle" data-dp-handle aria-hidden="true"></div>
			<?php echo $args['form_html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Form şablonunda kaçışlanmış çıktı. ?>
		</div>
	</div>
</div>
