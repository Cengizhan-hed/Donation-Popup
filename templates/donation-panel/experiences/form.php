<?php
/**
 * Form çekirdeği (tüm kaplarda aynı). Tema `donation-panel/experiences/form.php` ile geçersiz kılabilir.
 *
 * @var array{model: array<string, mixed>, dom_key: string} $args Şablon verisi.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_model   = $args['model'];
$donation_panel_key     = $args['dom_key'];
$donation_panel_symbol  = (string) $donation_panel_model['symbol'];
$donation_panel_presets = (array) $donation_panel_model['presets'];
$donation_panel_closed  = ! empty( $donation_panel_model['closed'] );
$donation_panel_format  = static function ( $amount ) use ( $donation_panel_model ) {
	$decimals = floor( (float) $amount ) === (float) $amount ? 0 : (int) $donation_panel_model['decimals'];
	return number_format_i18n( (float) $amount, $decimals );
};
?>
<form class="dp-form" method="post" action="" novalidate data-dp-form data-product-id="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) (int) $donation_panel_model['decimals'] ); ?>">
	<div class="dp-surface__body">
		<?php if ( $donation_panel_closed ) : ?>
			<p class="dp-state" role="status"><?php echo esc_html( '' !== (string) $donation_panel_model['closed_message'] ? (string) $donation_panel_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		<?php else : ?>
			<div class="dp-summary-err" role="alert" data-dp-summary></div>

			<?php if ( ! empty( $donation_panel_model['types'] ) ) : ?>
				<fieldset class="dp-fieldset">
					<legend class="dp-legend"><?php esc_html_e( 'Donation type', 'woo-donation-popup' ); ?></legend>
					<div class="dp-seg" role="radiogroup" aria-label="<?php esc_attr_e( 'Donation type', 'woo-donation-popup' ); ?>">
						<?php foreach ( (array) $donation_panel_model['types'] as $donation_panel_index => $donation_panel_type ) : ?>
							<label class="dp-seg__item">
								<input class="dp-sr" type="radio" name="donation_type" value="<?php echo esc_attr( $donation_panel_type['value'] ); ?>" <?php checked( 0, $donation_panel_index ); ?> />
								<span><?php echo esc_html( $donation_panel_type['label'] ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>
				</fieldset>
			<?php endif; ?>

			<fieldset class="dp-fieldset" data-dp-amounts>
				<legend class="dp-legend" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label"><?php esc_html_e( 'Donation amount', 'woo-donation-popup' ); ?></legend>
				<?php if ( $donation_panel_presets ) : ?>
					<div class="dp-amounts" role="radiogroup" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label">
						<?php foreach ( $donation_panel_presets as $donation_panel_index => $donation_panel_preset ) : ?>
							<?php $donation_panel_is_recommended = null !== $donation_panel_model['recommended'] && abs( (float) $donation_panel_model['recommended'] - (float) $donation_panel_preset ) < 0.005; ?>
							<button type="button" class="dp-amount" role="radio" aria-checked="<?php echo $donation_panel_is_recommended ? 'true' : 'false'; ?>" tabindex="<?php echo ( $donation_panel_is_recommended || ( 0 === $donation_panel_index && null === $donation_panel_model['recommended'] ) ) ? '0' : '-1'; ?>" data-dp-preset="<?php echo esc_attr( (string) $donation_panel_preset ); ?>">
								<span class="dp-amount__v dp-num"><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_preset ) ); ?></span>
								<span class="dp-amount__check" aria-hidden="true"><svg class="dp-ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>
							</button>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
				<?php if ( ! empty( $donation_panel_model['allow_custom'] ) ) : ?>
					<div class="dp-field" data-dp-field="amount">
						<label for="<?php echo esc_attr( $donation_panel_key ); ?>-amount"><?php echo esc_html( $donation_panel_presets ? __( 'Custom amount', 'woo-donation-popup' ) : __( 'Donation amount', 'woo-donation-popup' ) ); ?></label>
						<div class="dp-prefixed">
							<span class="pre" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
							<input class="dp-input dp-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" />
						</div>
						<p class="dp-error" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" data-dp-error="amount"></p>
					</div>
				<?php else : ?>
					<input type="hidden" name="amount" value="<?php echo esc_attr( (string) ( $donation_panel_presets ? $donation_panel_presets[0] : '' ) ); ?>" />
					<p class="dp-error" data-dp-error="amount"></p>
				<?php endif; ?>
			</fieldset>

			<?php foreach ( (array) $donation_panel_model['fields'] as $donation_panel_field ) : ?>
				<?php
				$donation_panel_name = (string) $donation_panel_field['name'];
				$donation_panel_id   = $donation_panel_key . '-' . $donation_panel_name;
				$donation_panel_type = (string) $donation_panel_field['type'];
				?>
				<?php if ( 'checkbox' === $donation_panel_type ) : ?>
					<label class="dp-check">
						<input type="checkbox" name="<?php echo esc_attr( $donation_panel_name ); ?>" value="1" />
						<span class="dp-check__t"><b><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></b></span>
					</label>
				<?php else : ?>
					<div class="dp-field" data-dp-field="<?php echo esc_attr( $donation_panel_name ); ?>">
						<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
						<?php if ( 'textarea' === $donation_panel_type ) : ?>
							<textarea class="dp-textarea" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" rows="2" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err"></textarea>
						<?php else : ?>
							<input class="dp-input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="<?php echo esc_attr( $donation_panel_type ); ?>"<?php echo ! empty( $donation_panel_field['required'] ) ? ' required aria-required="true"' : ''; ?><?php echo ! empty( $donation_panel_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_field['inputmode'] ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_field['placeholder'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $donation_panel_field['autocomplete'] ); ?>" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" />
						<?php endif; ?>
						<p class="dp-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
					</div>
				<?php endif; ?>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
	<?php if ( ! $donation_panel_closed ) : ?>
		<div class="dp-actionbar">
			<div class="dp-actionbar__total" aria-live="polite">
				<small><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></small>
				<strong class="dp-num" data-dp-total data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>"><?php echo esc_html( $donation_panel_symbol . '0' ); ?></strong>
			</div>
			<button type="submit" class="dp-btn dp-btn--lg" data-dp-submit><?php esc_html_e( 'Donate', 'woo-donation-popup' ); ?></button>
		</div>
	<?php endif; ?>
</form>
