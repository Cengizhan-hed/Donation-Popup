<?php
/**
 * Form çekirdeği (tüm kaplarda aynı). Tema `donation-panel/experiences/form.php` ile geçersiz kılabilir.
 *
 * @var array{model: array<string, mixed>, dom_key: string} $args Şablon verisi.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$dp_model   = $args['model'];
$dp_key     = $args['dom_key'];
$dp_symbol  = (string) $dp_model['symbol'];
$dp_presets = (array) $dp_model['presets'];
$dp_closed  = ! empty( $dp_model['closed'] );
$dp_format  = static function ( $amount ) use ( $dp_model ) {
	$decimals = floor( (float) $amount ) === (float) $amount ? 0 : (int) $dp_model['decimals'];
	return number_format_i18n( (float) $amount, $decimals );
};
?>
<form class="dp-form" method="post" action="" novalidate data-dp-form data-product-id="<?php echo esc_attr( (string) (int) $dp_model['product_id'] ); ?>" data-min="<?php echo esc_attr( (string) $dp_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) (int) $dp_model['decimals'] ); ?>">
	<div class="dp-surface__body">
		<?php if ( $dp_closed ) : ?>
			<p class="dp-state" role="status"><?php echo esc_html( '' !== (string) $dp_model['closed_message'] ? (string) $dp_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		<?php else : ?>
			<div class="dp-summary-err" role="alert" data-dp-summary></div>

			<?php if ( ! empty( $dp_model['types'] ) ) : ?>
				<fieldset class="dp-fieldset">
					<legend class="dp-legend"><?php esc_html_e( 'Donation type', 'woo-donation-popup' ); ?></legend>
					<div class="dp-seg" role="radiogroup" aria-label="<?php esc_attr_e( 'Donation type', 'woo-donation-popup' ); ?>">
						<?php foreach ( (array) $dp_model['types'] as $dp_index => $dp_type ) : ?>
							<label class="dp-seg__item">
								<input class="dp-sr" type="radio" name="donation_type" value="<?php echo esc_attr( $dp_type['value'] ); ?>" <?php checked( 0, $dp_index ); ?> />
								<span><?php echo esc_html( $dp_type['label'] ); ?></span>
							</label>
						<?php endforeach; ?>
					</div>
				</fieldset>
			<?php endif; ?>

			<fieldset class="dp-fieldset" data-dp-amounts>
				<legend class="dp-legend" id="<?php echo esc_attr( $dp_key ); ?>-amount-label"><?php esc_html_e( 'Donation amount', 'woo-donation-popup' ); ?></legend>
				<?php if ( $dp_presets ) : ?>
					<div class="dp-amounts" role="radiogroup" aria-labelledby="<?php echo esc_attr( $dp_key ); ?>-amount-label">
						<?php foreach ( $dp_presets as $dp_index => $dp_preset ) : ?>
							<?php $dp_is_recommended = null !== $dp_model['recommended'] && abs( (float) $dp_model['recommended'] - (float) $dp_preset ) < 0.005; ?>
							<button type="button" class="dp-amount" role="radio" aria-checked="<?php echo $dp_is_recommended ? 'true' : 'false'; ?>" tabindex="<?php echo ( $dp_is_recommended || ( 0 === $dp_index && null === $dp_model['recommended'] ) ) ? '0' : '-1'; ?>" data-dp-preset="<?php echo esc_attr( (string) $dp_preset ); ?>">
								<span class="dp-amount__v dp-num"><?php echo esc_html( $dp_symbol . $dp_format( $dp_preset ) ); ?></span>
								<span class="dp-amount__check" aria-hidden="true"><svg class="dp-ico" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>
							</button>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
				<?php if ( ! empty( $dp_model['allow_custom'] ) ) : ?>
					<div class="dp-field" data-dp-field="amount">
						<label for="<?php echo esc_attr( $dp_key ); ?>-amount"><?php echo esc_html( $dp_presets ? __( 'Custom amount', 'woo-donation-popup' ) : __( 'Donation amount', 'woo-donation-popup' ) ); ?></label>
						<div class="dp-prefixed">
							<span class="pre" aria-hidden="true"><?php echo esc_html( $dp_symbol ); ?></span>
							<input class="dp-input dp-num" id="<?php echo esc_attr( $dp_key ); ?>-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" aria-describedby="<?php echo esc_attr( $dp_key ); ?>-amount-err" />
						</div>
						<p class="dp-error" id="<?php echo esc_attr( $dp_key ); ?>-amount-err" data-dp-error="amount"></p>
					</div>
				<?php else : ?>
					<input type="hidden" name="amount" value="<?php echo esc_attr( (string) ( $dp_presets ? $dp_presets[0] : '' ) ); ?>" />
					<p class="dp-error" data-dp-error="amount"></p>
				<?php endif; ?>
			</fieldset>

			<?php foreach ( (array) $dp_model['fields'] as $dp_field ) : ?>
				<?php
				$dp_name = (string) $dp_field['name'];
				$dp_id   = $dp_key . '-' . $dp_name;
				$dp_type = (string) $dp_field['type'];
				?>
				<?php if ( 'checkbox' === $dp_type ) : ?>
					<label class="dp-check">
						<input type="checkbox" name="<?php echo esc_attr( $dp_name ); ?>" value="1" />
						<span class="dp-check__t"><b><?php echo esc_html( (string) $dp_field['label'] ); ?></b></span>
					</label>
				<?php else : ?>
					<div class="dp-field" data-dp-field="<?php echo esc_attr( $dp_name ); ?>">
						<label for="<?php echo esc_attr( $dp_id ); ?>"><?php echo esc_html( (string) $dp_field['label'] ); ?></label>
						<?php if ( 'textarea' === $dp_type ) : ?>
							<textarea class="dp-textarea" id="<?php echo esc_attr( $dp_id ); ?>" name="<?php echo esc_attr( $dp_name ); ?>" rows="2" maxlength="<?php echo esc_attr( (string) (int) $dp_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $dp_id ); ?>-err"></textarea>
						<?php else : ?>
							<input class="dp-input" id="<?php echo esc_attr( $dp_id ); ?>" name="<?php echo esc_attr( $dp_name ); ?>" type="<?php echo esc_attr( $dp_type ); ?>"<?php echo ! empty( $dp_field['required'] ) ? ' required aria-required="true"' : ''; ?><?php echo ! empty( $dp_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $dp_field['inputmode'] ) . '"' : ''; ?><?php echo ! empty( $dp_field['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $dp_field['placeholder'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $dp_field['autocomplete'] ); ?>" maxlength="<?php echo esc_attr( (string) (int) $dp_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $dp_id ); ?>-err" />
						<?php endif; ?>
						<p class="dp-error" id="<?php echo esc_attr( $dp_id ); ?>-err" data-dp-error="<?php echo esc_attr( $dp_name ); ?>"></p>
					</div>
				<?php endif; ?>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
	<?php if ( ! $dp_closed ) : ?>
		<div class="dp-actionbar">
			<div class="dp-actionbar__total" aria-live="polite">
				<small><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></small>
				<strong class="dp-num" data-dp-total data-symbol="<?php echo esc_attr( $dp_symbol ); ?>"><?php echo esc_html( $dp_symbol . '0' ); ?></strong>
			</div>
			<button type="submit" class="dp-btn dp-btn--lg" data-dp-submit><?php esc_html_e( 'Donate', 'woo-donation-popup' ); ?></button>
		</div>
	<?php endif; ?>
</form>
