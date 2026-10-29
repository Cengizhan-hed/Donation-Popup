<?php
/**
 * Form çekirdeği (tüm kaplarda aynı). Tema `donation-panel/experiences/form.php` ile geçersiz kılabilir.
 *
 * @var array{model: array<string, mixed>, dom_key: string, close?: bool} $args Şablon verisi.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_model    = $args['model'];
$donation_panel_key      = $args['dom_key'];
$donation_panel_close    = ! empty( $args['close'] );
$donation_panel_symbol   = (string) $donation_panel_model['symbol'];
$donation_panel_presets  = (array) $donation_panel_model['presets'];
$donation_panel_closed   = ! empty( $donation_panel_model['closed'] );
$donation_panel_format   = static function ( $amount ) use ( $donation_panel_model ) {
	$decimals = floor( (float) $amount ) === (float) $amount ? 0 : (int) $donation_panel_model['decimals'];
	return number_format_i18n( (float) $amount, $decimals );
};
$donation_panel_kind     = (string) $donation_panel_model['kind'];
$donation_panel_steps    = (array) $donation_panel_model['steps'];
$donation_panel_qty      = (array) $donation_panel_model['quantity'];
$donation_panel_fee      = (float) $donation_panel_model['cover_fee'];
$donation_panel_addon    = is_array( $donation_panel_model['addon'] ) ? $donation_panel_model['addon'] : array();
$donation_panel_unit     = (float) $donation_panel_model['unit_price'];
$donation_panel_decimals = (int) $donation_panel_model['decimals'];
$donation_panel_currency = \DonationPanel\Support\Price::get_js_currency_settings();
$donation_panel_fee_text = rtrim( rtrim( number_format( $donation_panel_fee, 2, '.', '' ), '0' ), '.' );
$donation_panel_single   = 'amount' !== (string) $donation_panel_steps[0]['id'];
$donation_panel_direct   = ! empty( $donation_panel_model['direct'] );
if ( $donation_panel_direct ) {
	$donation_panel_submit_label = _x( 'Continue to payment', 'Donation form: last step button when the donor goes straight to the payment page', 'woo-donation-popup' );
} else {
	/* translators: %s: formatted total amount. */
	$donation_panel_submit_label = __( 'Donate %s', 'woo-donation-popup' );
}
$donation_panel_camp   = isset( $donation_panel_model['campaign'] ) && is_array( $donation_panel_model['campaign'] ) ? $donation_panel_model['campaign'] : array();
$donation_panel_impact = array();
if ( isset( $donation_panel_model['impact']['presets'] ) && is_array( $donation_panel_model['impact']['presets'] ) ) {
	foreach ( $donation_panel_model['impact']['presets'] as $donation_panel_row ) {
		$donation_panel_impact[ (string) (float) $donation_panel_row['amount'] ] = (string) $donation_panel_row['text'];
	}
}
$donation_panel_phone    = isset( $donation_panel_model['phone'] ) && is_array( $donation_panel_model['phone'] ) ? $donation_panel_model['phone'] : array();
$donation_panel_fields   = (array) $donation_panel_model['fields'];
$donation_panel_dedi_def = array();
foreach ( $donation_panel_fields as $donation_panel_probe ) {
	if ( 'donation_dedication' === $donation_panel_probe['name'] ) {
		$donation_panel_dedi_def = $donation_panel_probe;
	}
}
// Tutarı bağışçı seçiyorsa "birinin adına" anahtarı tutar adımında; aksi halde alan bilgiler adımında düz alan.
$donation_panel_dedi_switch = $donation_panel_dedi_def && ! $donation_panel_single;
$donation_panel_privacy     = isset( $donation_panel_model['privacy_url'] ) ? (string) $donation_panel_model['privacy_url'] : '';
// Bağlantı metni: yönetici özel metin yazdıysa o; yoksa kısa varsayılan.
$donation_panel_privacy_label = isset( $donation_panel_model['privacy_label'] ) ? trim( (string) $donation_panel_model['privacy_label'] ) : '';
if ( '' === $donation_panel_privacy_label || \DonationPanel\Domain\Privacy_Notice::default_link_label() === $donation_panel_privacy_label ) {
	$donation_panel_privacy_label = __( 'privacy notice', 'woo-donation-popup' );
}
// Özel renkler (#hex ya da doğrulanmış `var(--ad[, #yedek])`): bildirimler Theme_Colors'ta üretilir.
$donation_panel_style     = \DonationPanel\Frontend\Theme_Colors::form_style(
	isset( $donation_panel_model['brand'] ) ? (string) $donation_panel_model['brand'] : '',
	isset( $donation_panel_model['accent'] ) ? (string) $donation_panel_model['accent'] : ''
);
$donation_panel_lock_icon = '<svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/**
 * Telefon alanı: ülke ön eki seçici + ulusal numara (ön ek mağaza ülkesinden).
 *
 * @param string $name     Alan adı.
 * @param string $id       Kimlik.
 * @param bool   $required Zorunlu mu.
 * @param string $extra    Ek öznitelikler (çağıran kaçışlar).
 */
$donation_panel_phone_field = static function ( $name, $id, $required, $extra ) use ( $donation_panel_phone ) {
	$dial = isset( $donation_panel_phone['dial'] ) ? (string) $donation_panel_phone['dial'] : '';
	$iso  = isset( $donation_panel_phone['iso'] ) ? (string) $donation_panel_phone['iso'] : '';
	$list = isset( $donation_panel_phone['countries'] ) ? (array) $donation_panel_phone['countries'] : array();
	?>
	<span class="donation-panel-phone">
		<?php if ( $list ) : ?>
			<span class="donation-panel-phone__code">
				<span class="donation-panel-phone__dial donation-panel-num" aria-hidden="true" data-dp-dial-label>+<?php echo esc_html( $dial ); ?></span>
				<svg class="donation-panel-ico donation-panel-phone__chev" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
				<select class="donation-panel-phone__select" data-dp-dial aria-label="<?php esc_attr_e( 'Country code', 'woo-donation-popup' ); ?>">
					<?php foreach ( $list as $donation_panel_country ) : ?>
						<option value="<?php echo esc_attr( (string) $donation_panel_country['dial'] ); ?>"<?php echo (string) $donation_panel_country['iso'] === $iso ? ' selected' : ''; ?>><?php echo esc_html( (string) $donation_panel_country['name'] . ' (+' . (string) $donation_panel_country['dial'] . ')' ); ?></option>
					<?php endforeach; ?>
				</select>
			</span>
		<?php endif; ?>
		<input class="donation-panel-phone__input" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="28"<?php echo $required ? ' required aria-required="true"' : ''; ?> <?php echo $extra; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Çağıran kaçışlar. ?> />
	</span>
	<?php
};

/**
 * İşlem ücreti ve ek bağış satırları.
 */
$donation_panel_extras = static function () use ( $donation_panel_key, $donation_panel_fee, $donation_panel_fee_text, $donation_panel_addon, $donation_panel_symbol, $donation_panel_format ) {
	if ( $donation_panel_fee > 0 ) :
		?>
		<label class="donation-panel-check">
			<input type="checkbox" name="donation_cover_fee" value="1" data-dp-fee />
			<span class="donation-panel-check__t"><b><?php /* translators: %s: fee percent. */ echo esc_html( sprintf( __( 'Cover processing costs (+%%%s)', 'woo-donation-popup' ), $donation_panel_fee_text ) ); ?></b><span class="donation-panel-muted" data-dp-fee-hint></span></span>
		</label>
		<?php
	endif;
	if ( $donation_panel_addon ) :
		?>
		<div class="donation-panel-addon" data-dp-addon>
			<label class="donation-panel-check">
				<input type="checkbox" name="addon_active" value="1" data-dp-addon-toggle aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>-addon-box" />
				<span class="donation-panel-check__t"><b><?php echo esc_html( '' !== (string) $donation_panel_addon['label'] ? (string) $donation_panel_addon['label'] : __( 'Add add-on donation', 'woo-donation-popup' ) ); ?></b>
				<?php if ( '' !== (string) $donation_panel_addon['message'] ) : ?>
					<span class="donation-panel-muted"><?php echo esc_html( (string) $donation_panel_addon['message'] ); ?></span>
				<?php endif; ?>
				<?php if ( (float) $donation_panel_addon['fixed'] > 0 ) : ?>
					<span class="donation-panel-muted donation-panel-num"><?php echo esc_html( '+' . $donation_panel_symbol . $donation_panel_format( (float) $donation_panel_addon['fixed'] ) ); ?></span>
				<?php endif; ?>
				</span>
			</label>
			<?php if ( (float) $donation_panel_addon['fixed'] <= 0 ) : ?>
				<div class="donation-panel-field" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-box" data-dp-field="addon_amount" data-dp-addon-box hidden>
					<label for="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount"><?php esc_html_e( 'Add-on amount', 'woo-donation-popup' ); ?></label>
					<div class="donation-panel-prefixed">
						<span class="pre" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
						<input class="donation-panel-input donation-panel-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount" name="addon_amount" type="text" inputmode="decimal" autocomplete="off" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount-err" />
					</div>
					<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_key ); ?>-addon-amount-err" data-dp-error="addon_amount"></p>
				</div>
			<?php endif; ?>
		</div>
		<?php
	endif;
};
?>
<form class="donation-panel-form" method="post" action="" novalidate data-dp-form<?php echo '' !== $donation_panel_style ? ' style="' . esc_attr( $donation_panel_style ) . '"' : ''; ?> data-product-id="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-title="<?php echo esc_attr( (string) $donation_panel_model['title'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-thousand-sep="<?php echo esc_attr( $donation_panel_currency['thousandSeparator'] ); ?>" data-decimal-sep="<?php echo esc_attr( $donation_panel_currency['decimalSeparator'] ); ?>" data-msg-amount-format="<?php echo esc_attr( \DonationPanel\Support\Price::get_ambiguous_amount_message( array( 'decimals' => $donation_panel_decimals ) ) ); ?>" data-kind="<?php echo esc_attr( $donation_panel_kind ); ?>"<?php echo $donation_panel_direct ? ' data-direct="1" data-msg-failed-direct="' . esc_attr__( 'We could not open the payment page. Nothing was charged. Please try again.', 'woo-donation-popup' ) . '"' : ''; ?> data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-fee="<?php echo esc_attr( (string) $donation_panel_fee ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>" data-addon-fixed="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['fixed'] ) ? (float) $donation_panel_addon['fixed'] : 0 ) ); ?>" data-addon-min="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['min'] ) ? (float) $donation_panel_addon['min'] : 0 ) ); ?>" data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-label-choose="<?php echo esc_attr_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-addon="<?php echo esc_attr__( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps. */ echo esc_attr__( 'Step %1$d of %2$d', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?>" data-label-submit="<?php echo esc_attr( $donation_panel_submit_label ); ?>" data-msg-added="<?php echo esc_attr__( 'Added to your cart.', 'woo-donation-popup' ); ?>">
	<div class="donation-panel-head">
		<button type="button" class="donation-panel-iconbtn donation-panel-head__back" data-dp-back aria-label="<?php esc_attr_e( 'Back', 'woo-donation-popup' ); ?>" hidden><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
		<div class="donation-panel-head__t">
			<?php if ( ! $donation_panel_closed ) : ?>
				<p class="donation-panel-steplabel" data-dp-steplabel aria-live="polite"></p>
			<?php endif; ?>
			<h2 class="donation-panel-surface__title" id="<?php echo esc_attr( $donation_panel_key ); ?>-title" tabindex="-1" data-dp-title><?php echo esc_html( (string) $donation_panel_model['title'] ); ?></h2>
			<?php if ( ! empty( $donation_panel_model['badge'] ) ) : ?>
				<span class="donation-panel-pill"><?php echo esc_html( (string) $donation_panel_model['badge'] ); ?></span>
			<?php endif; ?>
		</div>
		<?php if ( $donation_panel_close ) : ?>
			<button type="button" class="donation-panel-iconbtn donation-panel-surface__close" data-dp-close aria-label="<?php esc_attr_e( 'Close popup', 'woo-donation-popup' ); ?>"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
		<?php endif; ?>
	</div>
	<?php if ( ! $donation_panel_closed && count( $donation_panel_steps ) + ( $donation_panel_direct ? 1 : 0 ) > 1 ) : ?>
		<div class="donation-panel-steps" aria-hidden="true" data-dp-steps hidden>
			<?php foreach ( $donation_panel_steps as $donation_panel_step ) : ?>
				<i class="donation-panel-steps__i"></i>
			<?php endforeach; ?>
			<?php if ( $donation_panel_direct ) : ?>
				<i class="donation-panel-steps__i donation-panel-steps__i--pay"></i>
			<?php endif; ?>
		</div>
	<?php endif; ?>
	<div class="donation-panel-surface__body">
		<?php if ( $donation_panel_closed ) : ?>
			<p class="donation-panel-state" role="status"><?php echo esc_html( '' !== (string) $donation_panel_model['closed_message'] ? (string) $donation_panel_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		<?php else : ?>
			<div class="donation-panel-summary-err" role="alert" data-dp-summary></div>

			<?php foreach ( $donation_panel_steps as $donation_panel_idx => $donation_panel_step ) : ?>
				<?php $donation_panel_sid = (string) $donation_panel_step['id']; ?>
			<section class="donation-panel-step" data-dp-step="<?php echo esc_attr( $donation_panel_sid ); ?>" data-step-label="<?php echo esc_attr( (string) $donation_panel_step['label'] ); ?>"<?php echo 0 === $donation_panel_idx ? '' : ' hidden'; ?>>
				<?php if ( 'amount' === $donation_panel_sid ) : ?>
					<?php if ( ! empty( $donation_panel_model['types'] ) ) : ?>
					<fieldset class="donation-panel-fieldset">
						<legend class="donation-panel-legend"><?php esc_html_e( 'Donation type', 'woo-donation-popup' ); ?></legend>
						<div class="donation-panel-seg" role="radiogroup" aria-label="<?php esc_attr_e( 'Donation type', 'woo-donation-popup' ); ?>">
							<?php foreach ( (array) $donation_panel_model['types'] as $donation_panel_index => $donation_panel_type ) : ?>
								<label class="donation-panel-seg__item">
									<input class="donation-panel-sr" type="radio" name="donation_type" value="<?php echo esc_attr( $donation_panel_type['value'] ); ?>" <?php checked( 0, $donation_panel_index ); ?> />
									<span><?php echo esc_html( $donation_panel_type['label'] ); ?></span>
								</label>
							<?php endforeach; ?>
						</div>
					</fieldset>
					<?php endif; ?>

					<?php if ( $donation_panel_camp ) : ?>
					<div class="donation-panel-camp" data-dp-campaign>
						<div class="donation-panel-camp__top">
							<span class="donation-panel-camp__raised donation-panel-num"><?php echo esc_html( (string) $donation_panel_camp['raised'] ); ?> <small><?php esc_html_e( 'raised', 'woo-donation-popup' ); ?></small></span>
							<span class="donation-panel-camp__pct donation-panel-num"><?php /* translators: %d: percent of goal reached. */ echo esc_html( sprintf( __( '%d%%', 'woo-donation-popup' ), (int) $donation_panel_camp['percent'] ) ); ?></span>
						</div>
						<div class="donation-panel-camp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) (int) $donation_panel_camp['percent'] ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>"><span style="inline-size:<?php echo esc_attr( (string) min( 100, max( 0, (int) $donation_panel_camp['percent'] ) ) ); ?>%"></span></div>
						<p class="donation-panel-camp__meta">
							<span><?php /* translators: %s: goal amount. */ echo esc_html( sprintf( __( 'Goal %s', 'woo-donation-popup' ), (string) $donation_panel_camp['goal'] ) ); ?></span>
							<?php if ( (int) $donation_panel_camp['donors'] > 0 ) : ?>
								<span><?php /* translators: %s: number of donors. */ echo esc_html( sprintf( _n( '%s supporter', '%s supporters', (int) $donation_panel_camp['donors'], 'woo-donation-popup' ), number_format_i18n( (int) $donation_panel_camp['donors'] ) ) ); ?></span>
							<?php endif; ?>
							<?php if ( isset( $donation_panel_camp['days_left'] ) ) : ?>
								<span><?php /* translators: %s: number of days left. */ echo esc_html( sprintf( _n( '%s day left', '%s days left', (int) $donation_panel_camp['days_left'], 'woo-donation-popup' ), number_format_i18n( (int) $donation_panel_camp['days_left'] ) ) ); ?></span>
							<?php endif; ?>
						</p>
					</div>
					<?php endif; ?>

					<fieldset class="donation-panel-fieldset" data-dp-amounts>
						<legend class="donation-panel-legend" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label"><?php esc_html_e( 'Donation amount', 'woo-donation-popup' ); ?></legend>
						<?php if ( $donation_panel_presets ) : ?>
							<div class="donation-panel-amounts" role="radiogroup" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label">
								<?php foreach ( $donation_panel_presets as $donation_panel_index => $donation_panel_preset ) : ?>
									<?php
									$donation_panel_is_recommended = null !== $donation_panel_model['recommended'] && abs( (float) $donation_panel_model['recommended'] - (float) $donation_panel_preset ) < 0.005;
									$donation_panel_impact_text    = isset( $donation_panel_impact[ (string) (float) $donation_panel_preset ] ) ? $donation_panel_impact[ (string) (float) $donation_panel_preset ] : '';
									?>
									<button type="button" class="donation-panel-amount" role="radio" aria-checked="<?php echo $donation_panel_is_recommended ? 'true' : 'false'; ?>" tabindex="<?php echo ( $donation_panel_is_recommended || ( 0 === $donation_panel_index && null === $donation_panel_model['recommended'] ) ) ? '0' : '-1'; ?>" data-dp-preset="<?php echo esc_attr( (string) $donation_panel_preset ); ?>">
										<?php if ( $donation_panel_is_recommended ) : ?>
											<span class="donation-panel-amount__badge"><?php esc_html_e( 'Most popular', 'woo-donation-popup' ); ?></span>
										<?php endif; ?>
										<span class="donation-panel-amount__v donation-panel-num"><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_preset ) ); ?></span>
										<?php if ( '' !== $donation_panel_impact_text ) : ?>
											<span class="donation-panel-amount__i"><?php echo esc_html( $donation_panel_impact_text ); ?></span>
										<?php endif; ?>
									</button>
								<?php endforeach; ?>
							</div>
						<?php endif; ?>
						<?php if ( ! empty( $donation_panel_model['allow_custom'] ) ) : ?>
							<div class="donation-panel-field donation-panel-field--custom" data-dp-field="amount">
								<label class="donation-panel-custom" for="<?php echo esc_attr( $donation_panel_key ); ?>-amount">
									<span class="donation-panel-custom__sym" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
									<span class="donation-panel-sr"><?php echo esc_html( $donation_panel_presets ? __( 'Other amount', 'woo-donation-popup' ) : __( 'Donation amount', 'woo-donation-popup' ) ); ?></span>
									<input class="donation-panel-custom__in donation-panel-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="<?php echo esc_attr( $donation_panel_presets ? __( 'Enter another amount', 'woo-donation-popup' ) : __( 'Enter an amount', 'woo-donation-popup' ) ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" />
								</label>
								<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" data-dp-error="amount"></p>
							</div>
						<?php else : ?>
							<input type="hidden" name="amount" value="<?php echo esc_attr( (string) ( $donation_panel_presets ? $donation_panel_presets[0] : '' ) ); ?>" />
							<p class="donation-panel-error" data-dp-error="amount"></p>
						<?php endif; ?>
					</fieldset>

					<?php $donation_panel_extras(); ?>

					<?php if ( $donation_panel_dedi_switch ) : ?>
						<?php $donation_panel_dedi_id = $donation_panel_key . '-donation_dedication'; ?>
					<div class="donation-panel-dedi" data-dp-dedi>
						<label class="donation-panel-switch">
							<span class="donation-panel-switch__t"><b><?php esc_html_e( 'Donate on behalf of someone', 'woo-donation-popup' ); ?></b><small><?php esc_html_e( 'Add a dedication note', 'woo-donation-popup' ); ?></small></span>
							<input type="checkbox" role="switch" class="donation-panel-switch__in" data-dp-dedi-toggle aria-controls="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-box" />
							<span class="donation-panel-switch__track" aria-hidden="true"></span>
						</label>
						<div class="donation-panel-field" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-box" data-dp-field="donation_dedication" hidden>
							<label for="<?php echo esc_attr( $donation_panel_dedi_id ); ?>"><?php echo esc_html( (string) $donation_panel_dedi_def['label'] ); ?></label>
							<input class="donation-panel-input" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>" name="donation_dedication" type="text"<?php echo ! empty( $donation_panel_dedi_def['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_dedi_def['placeholder'] ) . '"' : ''; ?> autocomplete="off" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_dedi_def['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-err" disabled />
							<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-err" data-dp-error="donation_dedication"></p>
						</div>
					</div>
					<?php endif; ?>

				<?php elseif ( 'details' === $donation_panel_sid ) : ?>
					<?php if ( $donation_panel_single ) : ?>
					<div class="donation-panel-fieldset" data-dp-qtyset>
						<div class="donation-panel-qtybox" data-dp-qty-box>
							<span class="donation-panel-legend" id="<?php echo esc_attr( $donation_panel_key ); ?>-qty-label"><?php echo esc_html( 'shares' === $donation_panel_kind ? __( 'Number of shares', 'woo-donation-popup' ) : __( 'Quantity', 'woo-donation-popup' ) ); ?></span>
							<div class="donation-panel-qtybox__row">
								<?php if ( ! empty( $donation_panel_qty['enabled'] ) ) : ?>
									<div class="donation-panel-stepper" role="group" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-qty-label">
										<button type="button" data-dp-qty="-1" aria-label="<?php esc_attr_e( 'Decrease', 'woo-donation-popup' ); ?>" disabled><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
										<output class="donation-panel-num" data-dp-qty-out aria-live="polite">1</output>
										<button type="button" data-dp-qty="1" aria-label="<?php esc_attr_e( 'Increase', 'woo-donation-popup' ); ?>"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
									</div>
								<?php endif; ?>
								<div class="donation-panel-qtybox__sum">
									<small class="donation-panel-num" data-dp-qty-sum data-unit-text="<?php echo esc_attr( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?>"><?php echo esc_html( 'shares' === $donation_panel_kind ? sprintf( /* translators: %s: price of one share. */ __( '%s per share', 'woo-donation-popup' ), $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ) : $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></small>
									<strong class="donation-panel-num" data-dp-qty-total><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></strong>
								</div>
							</div>
							<input type="hidden" name="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>" value="1" data-dp-qty-input />
						</div>
						<input type="hidden" name="amount" value="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" />
						<p class="donation-panel-error" data-dp-error="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>"></p>
						<p class="donation-panel-error" data-dp-error="amount"></p>
					</div>
						<?php $donation_panel_extras(); ?>
					<?php else : ?>
					<div class="donation-panel-summary" data-dp-recap>
						<span class="donation-panel-summary__t"><b><?php echo esc_html( (string) $donation_panel_model['title'] ); ?></b><small><?php echo esc_html( (string) $donation_panel_model['subtitle'] ); ?></small></span>
						<strong class="donation-panel-num" data-dp-recap-amount></strong>
					</div>
					<?php endif; ?>

					<?php if ( 'shares' === $donation_panel_kind ) : ?>
						<?php for ( $donation_panel_n = 1; $donation_panel_n <= (int) $donation_panel_qty['max']; $donation_panel_n++ ) : ?>
					<fieldset class="donation-panel-fieldset donation-panel-holder" data-dp-holder="<?php echo esc_attr( (string) $donation_panel_n ); ?>"<?php echo 1 === $donation_panel_n ? '' : ' hidden'; ?>>
						<legend class="donation-panel-legend"><?php /* translators: %d: shareholder number. */ echo esc_html( sprintf( __( 'Shareholder %d', 'woo-donation-popup' ), $donation_panel_n ) ); ?></legend>
							<?php foreach ( (array) $donation_panel_model['shareholder'] as $donation_panel_def ) : ?>
								<?php
								$donation_panel_hname  = 'shareholder_' . $donation_panel_n . '_' . $donation_panel_def['key'];
								$donation_panel_hid    = $donation_panel_key . '-' . $donation_panel_hname;
								$donation_panel_hreq   = ! empty( $donation_panel_def['required'] );
								$donation_panel_hextra = 'data-dp-holder-field="' . esc_attr( (string) $donation_panel_def['key'] ) . '" aria-describedby="' . esc_attr( $donation_panel_hid ) . '-err"' . ( $donation_panel_hreq ? ' data-required-msg="' . esc_attr( (string) $donation_panel_def['required_msg'] ) . '"' : '' ) . ( 1 === $donation_panel_n ? '' : ' disabled' );
								?>
						<div class="donation-panel-field" data-dp-field="<?php echo esc_attr( $donation_panel_hname ); ?>">
							<label for="<?php echo esc_attr( $donation_panel_hid ); ?>"><?php echo esc_html( (string) $donation_panel_def['label'] ); ?></label>
								<?php if ( 'tel' === (string) $donation_panel_def['type'] ) : ?>
									<?php $donation_panel_phone_field( $donation_panel_hname, $donation_panel_hid, $donation_panel_hreq, $donation_panel_hextra ); ?>
								<?php else : ?>
							<input class="donation-panel-input" id="<?php echo esc_attr( $donation_panel_hid ); ?>" name="<?php echo esc_attr( $donation_panel_hname ); ?>" type="<?php echo esc_attr( (string) $donation_panel_def['type'] ); ?>"<?php echo $donation_panel_hreq ? ' required aria-required="true"' : ''; ?><?php echo ! empty( $donation_panel_def['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_def['inputmode'] ) . '"' : ''; ?> autocomplete="off" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_def['maxlength'] ); ?>" <?php echo $donation_panel_hextra; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Öznitelikler yukarıda kaçışlandı. ?> />
								<?php endif; ?>
							<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_hid ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_hname ); ?>"></p>
						</div>
							<?php endforeach; ?>
					</fieldset>
						<?php endfor; ?>
					<?php endif; ?>

					<?php foreach ( $donation_panel_fields as $donation_panel_field ) : ?>
						<?php
						$donation_panel_name = (string) $donation_panel_field['name'];
						$donation_panel_id   = $donation_panel_key . '-' . $donation_panel_name;
						$donation_panel_type = (string) $donation_panel_field['type'];
						if ( 'donation_dedication' === $donation_panel_name && $donation_panel_dedi_switch ) {
							continue;
						}
						?>
						<?php if ( 'checkbox' === $donation_panel_type ) : ?>
					<label class="donation-panel-check donation-panel-check--plain">
						<input type="checkbox" name="<?php echo esc_attr( $donation_panel_name ); ?>" value="1" />
						<span class="donation-panel-check__t"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></span>
					</label>
						<?php elseif ( 'donation_note' === $donation_panel_name ) : ?>
					<div class="donation-panel-note" data-dp-note>
						<button type="button" class="donation-panel-linkbtn" data-dp-note-toggle aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_id ); ?>-box"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><?php esc_html_e( 'Add a note (optional)', 'woo-donation-popup' ); ?></button>
						<div class="donation-panel-field" id="<?php echo esc_attr( $donation_panel_id ); ?>-box" data-dp-field="<?php echo esc_attr( $donation_panel_name ); ?>" hidden>
							<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
							<textarea class="donation-panel-textarea" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" rows="3" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" disabled></textarea>
							<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
						</div>
					</div>
						<?php else : ?>
					<div class="donation-panel-field" data-dp-field="<?php echo esc_attr( $donation_panel_name ); ?>">
						<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
							<?php if ( 'tel' === $donation_panel_type ) : ?>
								<?php
								$donation_panel_extra = 'aria-describedby="' . esc_attr( $donation_panel_id ) . '-err"' . ( ! empty( $donation_panel_field['required'] ) ? ' data-required-msg="' . esc_attr( isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' ) ) . '"' : '' );
								$donation_panel_phone_field( $donation_panel_name, $donation_panel_id, ! empty( $donation_panel_field['required'] ), $donation_panel_extra );
								?>
								<span class="donation-panel-hint"><?php esc_html_e( 'We use this number to keep you updated about your donation.', 'woo-donation-popup' ); ?></span>
							<?php elseif ( 'textarea' === $donation_panel_type ) : ?>
							<textarea class="donation-panel-textarea" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" rows="2" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err"></textarea>
							<?php else : ?>
							<input class="donation-panel-input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="<?php echo esc_attr( $donation_panel_type ); ?>"<?php echo ! empty( $donation_panel_field['required'] ) ? ' required aria-required="true" data-required-msg="' . esc_attr( isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' ) ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_field['inputmode'] ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_field['placeholder'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $donation_panel_field['autocomplete'] ); ?>" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" />
							<?php endif; ?>
						<p class="donation-panel-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
					</div>
						<?php endif; ?>
					<?php endforeach; ?>

					<?php if ( $donation_panel_fee > 0 || $donation_panel_addon ) : ?>
					<div class="donation-panel-lines" aria-label="<?php esc_attr_e( 'Total', 'woo-donation-popup' ); ?>" data-dp-lines>
						<div data-dp-line="donation"><span><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></span><span class="donation-panel-num" data-dp-line-value></span></div>
						<div data-dp-line="fee" hidden><span><?php esc_html_e( 'Processing fee', 'woo-donation-popup' ); ?></span><span class="donation-panel-num" data-dp-line-value></span></div>
						<div data-dp-line="addon" hidden><span><?php esc_html_e( 'Add-on donation', 'woo-donation-popup' ); ?></span><span class="donation-panel-num" data-dp-line-value></span></div>
						<div class="total" data-dp-line="total"><span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span><span class="donation-panel-num" data-dp-line-value></span></div>
					</div>
					<?php endif; ?>
				<?php else : ?>
					<?php
					/**
					 * Ek form adımının içeriği (ör. vergi indirimi). Kişi verisi basılmaz; alan adları sipariş sözleşmesine uymalıdır.
					 *
					 * @param array<string, mixed> $donation_panel_model Form modeli.
					 */
					do_action( 'donation_panel_form_step_' . $donation_panel_sid, $donation_panel_model );
					?>
				<?php endif; ?>
			</section>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
	<?php if ( ! $donation_panel_closed ) : ?>
		<div class="donation-panel-actionbar" data-single="<?php echo $donation_panel_single ? '1' : '0'; ?>">
			<div class="donation-panel-actionbar__total" aria-live="polite" data-dp-total-row>
				<span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span>
				<strong class="donation-panel-num" data-dp-total data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>"><?php echo esc_html( $donation_panel_symbol . '0' ); ?></strong>
			</div>
			<button class="donation-panel-btn donation-panel-btn--lg donation-panel-btn--accent" data-dp-submit type="submit">
				<span class="donation-panel-btn__lock" data-dp-submit-lock hidden><?php echo $donation_panel_lock_icon; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?></span>
				<span data-dp-submit-label><?php echo esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span>
				<svg class="donation-panel-ico donation-panel-btn__arrow" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" data-dp-submit-arrow><path d="M5 12h14M13 6l6 6-6 6"/></svg>
			</button>
			<button class="donation-panel-btn donation-panel-btn--outline" type="button" data-dp-addcart hidden><?php echo esc_html( $donation_panel_single ? __( 'Add to cart', 'woo-donation-popup' ) : __( 'Add to cart, choose another', 'woo-donation-popup' ) ); ?></button>
			<p class="donation-panel-trust" data-dp-trust><?php echo $donation_panel_lock_icon; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><?php esc_html_e( 'Secure payment · Your details are encrypted', 'woo-donation-popup' ); ?></p>
			<?php if ( '' !== $donation_panel_privacy ) : ?>
				<p class="donation-panel-legal" data-dp-legal hidden>
					<?php
					echo wp_kses(
						sprintf(
							/* translators: %s: link to the privacy policy. */
							__( 'By continuing you confirm you have read the %s.', 'woo-donation-popup' ),
							'<a href="' . esc_url( $donation_panel_privacy ) . '" target="_blank" rel="noopener">' . esc_html( $donation_panel_privacy_label ) . '</a>'
						),
						array(
							'a' => array(
								'href'   => array(),
								'target' => array(),
								'rel'    => array(),
							),
						)
					);
					?>
				</p>
			<?php endif; ?>
		</div>
	<?php endif; ?>
</form>
