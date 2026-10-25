<?php
/**
 * Vergi indirimi beyanı adımı (form ek adımı). Tema: `donation-panel/tax-relief/step.php` ile geçersiz kılınır.
 *
 * @var array<string, mixed> $args `texts` (step_label, title, text, checkbox_label), `field` (alan adı).
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_texts = isset( $args['texts'] ) && is_array( $args['texts'] ) ? $args['texts'] : array();
$donation_panel_field = isset( $args['field'] ) ? (string) $args['field'] : 'donation_tax_relief';
?>
<fieldset class="dp-fieldset dp-tax" data-dp-tax-relief>
	<legend class="dp-legend"><?php echo esc_html( isset( $donation_panel_texts['title'] ) ? (string) $donation_panel_texts['title'] : '' ); ?></legend>
	<p class="dp-hint" id="<?php echo esc_attr( $donation_panel_field ); ?>-text"><?php echo esc_html( isset( $donation_panel_texts['text'] ) ? (string) $donation_panel_texts['text'] : '' ); ?></p>
	<label class="dp-check">
		<input type="checkbox" name="<?php echo esc_attr( $donation_panel_field ); ?>" value="1" aria-describedby="<?php echo esc_attr( $donation_panel_field ); ?>-text" />
		<span class="dp-check__t"><b><?php echo esc_html( isset( $donation_panel_texts['checkbox_label'] ) ? (string) $donation_panel_texts['checkbox_label'] : '' ); ?></b></span>
	</label>
	<p class="dp-hint"><?php esc_html_e( 'This step is optional. You can continue without ticking the box.', 'woo-donation-popup' ); ?></p>
</fieldset>
