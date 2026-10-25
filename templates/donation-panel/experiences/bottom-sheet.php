<?php
/**
 * Alttan panel kabı. Tema `donation-panel/experiences/bottom-sheet.php` ile geçersiz kılabilir.
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
<div class="dp dp-exp" data-dp-exp data-dp-kind="bottom_sheet" data-dp-product="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-dp-rest="<?php echo esc_url( (string) $donation_panel_opts['rest_url'] ); ?>" data-dp-nonce="<?php echo esc_attr( (string) $donation_panel_opts['nonce'] ); ?>" data-dp-ajax="<?php echo esc_url( (string) $donation_panel_opts['ajax_url'] ); ?>" data-dp-cart-nonce="<?php echo esc_attr( (string) $donation_panel_opts['cart_nonce'] ); ?>" data-dp-checkout="<?php echo esc_url( (string) $donation_panel_opts['checkout_url'] ); ?>" data-dp-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-dp-msg-failed="<?php esc_attr_e( 'Something went wrong. Please try again.', 'woo-donation-popup' ); ?>">
	<button type="button" class="dp-btn dp-trigger" data-dp-open aria-haspopup="dialog" aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>"><?php echo esc_html( (string) $donation_panel_opts['button_text'] ); ?></button>
	<div class="dp-overlay dp-overlay--sheet" data-dp-overlay>
		<div class="dp-surface dp-surface--sheet" id="<?php echo esc_attr( $donation_panel_key ); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-title" tabindex="-1" data-dp-surface>
			<div class="dp-surface__handle" data-dp-handle aria-hidden="true"></div>
			<div class="dp-surface__head">
				<h2 class="dp-surface__title" id="<?php echo esc_attr( $donation_panel_key ); ?>-title"><?php echo esc_html( (string) $donation_panel_model['title'] ); ?></h2>
				<button type="button" class="dp-iconbtn dp-surface__close" data-dp-close aria-label="<?php esc_attr_e( 'Close popup', 'woo-donation-popup' ); ?>"><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
			</div>
			<?php echo $args['form_html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Form şablonunda kaçışlanmış çıktı. ?>
		</div>
	</div>
</div>
