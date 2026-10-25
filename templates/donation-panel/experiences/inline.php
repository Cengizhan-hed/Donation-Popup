<?php
/**
 * Sayfa içi form kabı. Tema `donation-panel/experiences/inline.php` ile geçersiz kılabilir.
 *
 * @var array<string, mixed> $args Şablon verisi: model, container, dom_key, args, form_html.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$dp_model = $args['model'];
$dp_key   = (string) $args['dom_key'];
$dp_opts  = (array) $args['args'];
?>
<div class="dp dp-exp" data-dp-exp data-dp-kind="inline" data-dp-product="<?php echo esc_attr( (string) (int) $dp_model['product_id'] ); ?>" data-dp-rest="<?php echo esc_url( (string) $dp_opts['rest_url'] ); ?>" data-dp-nonce="<?php echo esc_attr( (string) $dp_opts['nonce'] ); ?>" data-dp-ajax="<?php echo esc_url( (string) $dp_opts['ajax_url'] ); ?>" data-dp-cart-nonce="<?php echo esc_attr( (string) $dp_opts['cart_nonce'] ); ?>" data-dp-checkout="<?php echo esc_url( (string) $dp_opts['checkout_url'] ); ?>">
	<section class="dp-inline" aria-labelledby="<?php echo esc_attr( $dp_key ); ?>-title">
		<div class="dp-surface__head">
			<h2 class="dp-surface__title" id="<?php echo esc_attr( $dp_key ); ?>-title"><?php echo esc_html( (string) $dp_model['title'] ); ?></h2>
		</div>
		<?php echo $args['form_html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Form şablonunda kaçışlanmış çıktı. ?>
	</section>
</div>
