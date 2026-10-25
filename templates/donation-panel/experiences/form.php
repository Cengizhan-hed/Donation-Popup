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
$donation_panel_kind     = (string) $donation_panel_model['kind'];
$donation_panel_steps    = (array) $donation_panel_model['steps'];
$donation_panel_qty      = (array) $donation_panel_model['quantity'];
$donation_panel_fee      = (float) $donation_panel_model['cover_fee'];
$donation_panel_addon    = is_array( $donation_panel_model['addon'] ) ? $donation_panel_model['addon'] : array();
$donation_panel_unit     = (float) $donation_panel_model['unit_price'];
$donation_panel_derived  = in_array( $donation_panel_kind, array( 'fixed', 'shares' ), true );
$donation_panel_decimals = (int) $donation_panel_model['decimals'];
$donation_panel_fee_text = rtrim( rtrim( number_format( $donation_panel_fee, 2, '.', '' ), '0' ), '.' );
?>
<form class="dp-form" method="post" action="" novalidate data-dp-form data-product-id="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-kind="<?php echo esc_attr( $donation_panel_kind ); ?>" data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-fee="<?php echo esc_attr( (string) $donation_panel_fee ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>" data-addon-fixed="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['fixed'] ) ? (float) $donation_panel_addon['fixed'] : 0 ) ); ?>" data-addon-min="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['min'] ) ? (float) $donation_panel_addon['min'] : 0 ) ); ?>" data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-addon="<?php echo esc_attr__( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps. */ echo esc_attr__( 'Step %1$d of %2$d', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr__( 'Continue', 'woo-donation-popup' ); ?>" data-label-submit="<?php echo esc_attr__( 'Donate', 'woo-donation-popup' ); ?>">
	<?php if ( ! $donation_panel_closed ) : ?>
		<div class="dp-steps" aria-hidden="true">
			<?php foreach ( $donation_panel_steps as $donation_panel_step ) : ?>
				<i class="dp-steps__i"></i>
			<?php endforeach; ?>
		</div>
		<p class="dp-steplabel" data-dp-steplabel aria-live="polite"></p>
	<?php endif; ?>
	<div class="dp-surface__body">
		<?php if ( $donation_panel_closed ) : ?>
			<p class="dp-state" role="status"><?php echo esc_html( '' !== (string) $donation_panel_model['closed_message'] ? (string) $donation_panel_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		<?php else : ?>
			<div class="dp-summary-err" role="alert" data-dp-summary></div>

			<section class="dp-step" data-dp-step="amount" data-step-label="<?php echo esc_attr( (string) $donation_panel_steps[0]['label'] ); ?>">
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
				<?php if ( 'shares' === $donation_panel_kind || ( 'fixed' === $donation_panel_kind ) ) : ?>
					<div class="dp-fieldset" data-dp-qtyset>
					<div class="dp-qty" data-dp-qty-box>
						<div class="dp-qty__label">
							<span><?php echo esc_html( 'shares' === $donation_panel_kind ? __( 'Number of shares', 'woo-donation-popup' ) : (string) $donation_panel_model['title'] ); ?></span>
							<small class="dp-num"><?php echo esc_html( 'shares' === $donation_panel_kind ? sprintf( /* translators: %s: price of one share. */ __( '%s per share', 'woo-donation-popup' ), $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ) : $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></small>
						</div>
						<?php if ( ! empty( $donation_panel_qty['enabled'] ) ) : ?>
							<div class="dp-stepper" role="group" aria-label="<?php echo esc_attr( 'shares' === $donation_panel_kind ? __( 'Number of shares', 'woo-donation-popup' ) : __( 'Quantity', 'woo-donation-popup' ) ); ?>">
								<button type="button" data-dp-qty="-1" aria-label="<?php esc_attr_e( 'Decrease', 'woo-donation-popup' ); ?>" disabled><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
								<output class="dp-num" data-dp-qty-out aria-live="polite">1</output>
								<button type="button" data-dp-qty="1" aria-label="<?php esc_attr_e( 'Increase', 'woo-donation-popup' ); ?>"><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
							</div>
						<?php endif; ?>
						<input type="hidden" name="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>" value="1" data-dp-qty-input />
					</div>
					<input type="hidden" name="amount" value="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" />
					<p class="dp-error" data-dp-error="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>"></p>
					<p class="dp-error" data-dp-error="amount"></p>
					</div>
				<?php else : ?>
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
				<?php endif; ?>

				<?php if ( $donation_panel_fee > 0 ) : ?>
					<label class="dp-check">
						<input type="checkbox" name="donation_cover_fee" value="1" data-dp-fee />
						<span class="dp-check__t"><b><?php /* translators: %s: fee percent. */ echo esc_html( sprintf( __( 'Cover processing costs (+%%%s)', 'woo-donation-popup' ), $donation_panel_fee_text ) ); ?></b><span class="dp-muted" data-dp-fee-hint></span></span>
					</label>
				<?php endif; ?>

				<?php if ( $donation_panel_addon ) : ?>
					<div class="dp-addon" data-dp-addon>
						<label class="dp-check">
							<input type="checkbox" name="addon_active" value="1" data-dp-addon-toggle aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>-addon-box" />
							<span class="dp-check__t"><b><?php echo esc_html( '' !== (string) $donation_panel_addon['label'] ? (string) $donation_panel_addon['label'] : __( 'Add add-on donation', 'woo-donation-popup' ) ); ?></b><?php if ( '' !== (string) $donation_panel_addon['message'] ) : ?><span class="dp-muted"><?php echo esc_html( (string) $donation_panel_addon['message'] ); ?></span><?php endif; ?><?php if ( (float) $donation_panel_addon['fixed'] > 0 ) : ?><span class="dp-muted dp-num"><?php echo esc_html( '+' . $donation_panel_symbol . $donation_panel_format( (float) $donation_panel_addon['fixed'] ) ); ?></span><?php endif; ?></span>
						</label>
						<?php if ( (float) $donation_panel_addon['fixed'] <= 0 ) : ?>
							<div class="dp-field" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-box" data-dp-field="addon_amount" data-dp-addon-box hidden>
								<label for="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount"><?php esc_html_e( 'Add-on amount', 'woo-donation-popup' ); ?></label>
								<div class="dp-prefixed">
									<span class="pre" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
									<input class="dp-input dp-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount" name="addon_amount" type="text" inputmode="decimal" autocomplete="off" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount-err" />
								</div>
								<p class="dp-error" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount-err" data-dp-error="addon_amount"></p>
							</div>
						<?php endif; ?>
					</div>
				<?php endif; ?>

			</section>

			<section class="dp-step" data-dp-step="details" data-step-label="<?php echo esc_attr( (string) $donation_panel_steps[1]['label'] ); ?>" hidden>
			<?php if ( 'shares' === $donation_panel_kind ) : ?>
				<?php for ( $donation_panel_n = 1; $donation_panel_n <= (int) $donation_panel_qty['max']; $donation_panel_n++ ) : ?>
					<fieldset class="dp-fieldset dp-holder" data-dp-holder="<?php echo esc_attr( (string) $donation_panel_n ); ?>"<?php echo 1 === $donation_panel_n ? '' : ' hidden'; ?>>
						<legend class="dp-legend"><?php /* translators: %d: shareholder number. */ echo esc_html( sprintf( __( 'Shareholder %d', 'woo-donation-popup' ), $donation_panel_n ) ); ?></legend>
						<?php foreach ( (array) $donation_panel_model['shareholder'] as $donation_panel_def ) : ?>
							<?php
							$donation_panel_hname = 'shareholder_' . $donation_panel_n . '_' . $donation_panel_def['key'];
							$donation_panel_hid   = $donation_panel_key . '-' . $donation_panel_hname;
							?>
							<div class="dp-field" data-dp-field="<?php echo esc_attr( $donation_panel_hname ); ?>">
								<label for="<?php echo esc_attr( $donation_panel_hid ); ?>"><?php echo esc_html( (string) $donation_panel_def['label'] ); ?></label>
								<input class="dp-input" id="<?php echo esc_attr( $donation_panel_hid ); ?>" name="<?php echo esc_attr( $donation_panel_hname ); ?>" data-dp-holder-field="<?php echo esc_attr( (string) $donation_panel_def['key'] ); ?>" type="<?php echo esc_attr( (string) $donation_panel_def['type'] ); ?>"<?php echo ! empty( $donation_panel_def['required'] ) ? ' required aria-required="true" data-required-msg="' . esc_attr( (string) $donation_panel_def['required_msg'] ) . '"' : ''; ?><?php echo ! empty( $donation_panel_def['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_def['inputmode'] ) . '"' : ''; ?> autocomplete="off" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_def['maxlength'] ); ?>"<?php echo 1 === $donation_panel_n ? '' : ' disabled'; ?> aria-describedby="<?php echo esc_attr( $donation_panel_hid ); ?>-err" />
								<p class="dp-error" id="<?php echo esc_attr( $donation_panel_hid ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_hname ); ?>"></p>
							</div>
						<?php endforeach; ?>
					</fieldset>
				<?php endfor; ?>
			<?php endif; ?>

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
							<input class="dp-input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="<?php echo esc_attr( $donation_panel_type ); ?>"<?php echo ! empty( $donation_panel_field['required'] ) ? ' required aria-required="true" data-required-msg="' . esc_attr( isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' ) ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_field['inputmode'] ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_field['placeholder'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $donation_panel_field['autocomplete'] ); ?>" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" />
						<?php endif; ?>
						<p class="dp-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
					</div>
				<?php endif; ?>
			<?php endforeach; ?>

			<div class="dp-lines" aria-label="<?php esc_attr_e( 'Total', 'woo-donation-popup' ); ?>" data-dp-lines>
				<div data-dp-line="donation"><span><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
				<div data-dp-line="fee" hidden><span><?php esc_html_e( 'Processing fee', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
				<div data-dp-line="addon" hidden><span><?php esc_html_e( 'Add-on donation', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
				<div class="total" data-dp-line="total"><span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
			</div>
			</section>

			<?php foreach ( $donation_panel_steps as $donation_panel_step ) : ?>
				<?php if ( ! in_array( $donation_panel_step['id'], array( 'amount', 'details' ), true ) ) : ?>
					<section class="dp-step" data-dp-step="<?php echo esc_attr( $donation_panel_step['id'] ); ?>" data-step-label="<?php echo esc_attr( $donation_panel_step['label'] ); ?>" hidden>
						<?php
						/**
						 * Ek form adımının içeriği (ör. vergi indirimi). Kişi verisi basılmaz; alan adları sipariş sözleşmesine uymalıdır.
						 *
						 * @param array<string, mixed> $donation_panel_model Form modeli.
						 */
						do_action( 'donation_panel_form_step_' . $donation_panel_step['id'], $donation_panel_model );
						?>
					</section>
				<?php endif; ?>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
	<?php if ( ! $donation_panel_closed ) : ?>
		<div class="dp-actionbar">
			<button type="button" class="dp-btn dp-btn--ghost dp-btn--back" data-dp-back aria-label="<?php esc_attr_e( 'Back', 'woo-donation-popup' ); ?>" hidden><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
			<div class="dp-actionbar__total" aria-live="polite">
				<small><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></small>
				<strong class="dp-num" data-dp-total data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>"><?php echo esc_html( $donation_panel_symbol . '0' ); ?></strong>
			</div>
			<button type="submit" class="dp-btn dp-btn--lg" data-dp-submit><?php esc_html_e( 'Continue', 'woo-donation-popup' ); ?></button>
		</div>
	<?php endif; ?>
</form>
