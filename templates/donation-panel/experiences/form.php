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
$donation_panel_fee_text = rtrim( rtrim( number_format( $donation_panel_fee, 2, '.', '' ), '0' ), '.' );
$donation_panel_single   = 'amount' !== (string) $donation_panel_steps[0]['id'];
$donation_panel_image    = isset( $donation_panel_model['image'] ) ? (string) $donation_panel_model['image'] : '';
$donation_panel_camp     = isset( $donation_panel_model['campaign'] ) && is_array( $donation_panel_model['campaign'] ) ? $donation_panel_model['campaign'] : array();
$donation_panel_impact   = array();
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
$donation_panel_style = '';
foreach ( array(
	'brand'  => '--dp-color-primary',
	'accent' => '--dp-accent',
) as $donation_panel_slot => $donation_panel_var ) {
	$donation_panel_hex = isset( $donation_panel_model[ $donation_panel_slot ] ) ? (string) $donation_panel_model[ $donation_panel_slot ] : '';
	if ( 1 === preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $donation_panel_hex ) ) {
		$donation_panel_style .= $donation_panel_var . ':' . $donation_panel_hex . ';';
	}
}
$donation_panel_lock_icon = '<svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

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
	<span class="dp-phone">
		<?php if ( $list ) : ?>
			<span class="dp-phone__code">
				<span class="dp-phone__dial dp-num" aria-hidden="true" data-dp-dial-label>+<?php echo esc_html( $dial ); ?></span>
				<svg class="dp-ico dp-phone__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
				<select class="dp-phone__select" data-dp-dial aria-label="<?php esc_attr_e( 'Country code', 'woo-donation-popup' ); ?>">
					<?php foreach ( $list as $donation_panel_country ) : ?>
						<option value="<?php echo esc_attr( (string) $donation_panel_country['dial'] ); ?>"<?php echo (string) $donation_panel_country['iso'] === $iso ? ' selected' : ''; ?>><?php echo esc_html( (string) $donation_panel_country['name'] . ' (+' . (string) $donation_panel_country['dial'] . ')' ); ?></option>
					<?php endforeach; ?>
				</select>
			</span>
		<?php endif; ?>
		<input class="dp-phone__input" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="28"<?php echo $required ? ' required aria-required="true"' : ''; ?> <?php echo $extra; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Çağıran kaçışlar. ?> />
	</span>
	<?php
};

/**
 * İşlem ücreti ve ek bağış satırları.
 */
$donation_panel_extras = static function () use ( $donation_panel_key, $donation_panel_fee, $donation_panel_fee_text, $donation_panel_addon, $donation_panel_symbol, $donation_panel_format ) {
	if ( $donation_panel_fee > 0 ) :
		?>
		<label class="dp-check">
			<input type="checkbox" name="donation_cover_fee" value="1" data-dp-fee />
			<span class="dp-check__t"><b><?php /* translators: %s: fee percent. */ echo esc_html( sprintf( __( 'Cover processing costs (+%%%s)', 'woo-donation-popup' ), $donation_panel_fee_text ) ); ?></b><span class="dp-muted" data-dp-fee-hint></span></span>
		</label>
		<?php
	endif;
	if ( $donation_panel_addon ) :
		?>
		<div class="dp-addon" data-dp-addon>
			<label class="dp-check">
				<input type="checkbox" name="addon_active" value="1" data-dp-addon-toggle aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>-addon-box" />
				<span class="dp-check__t"><b><?php echo esc_html( '' !== (string) $donation_panel_addon['label'] ? (string) $donation_panel_addon['label'] : __( 'Add add-on donation', 'woo-donation-popup' ) ); ?></b>
				<?php if ( '' !== (string) $donation_panel_addon['message'] ) : ?>
					<span class="dp-muted"><?php echo esc_html( (string) $donation_panel_addon['message'] ); ?></span>
				<?php endif; ?>
				<?php if ( (float) $donation_panel_addon['fixed'] > 0 ) : ?>
					<span class="dp-muted dp-num"><?php echo esc_html( '+' . $donation_panel_symbol . $donation_panel_format( (float) $donation_panel_addon['fixed'] ) ); ?></span>
				<?php endif; ?>
				</span>
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
		<?php
	endif;
};
?>
<form class="dp-form" method="post" action="" novalidate data-dp-form<?php echo '' !== $donation_panel_style ? ' style="' . esc_attr( $donation_panel_style ) . '"' : ''; ?> data-product-id="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-title="<?php echo esc_attr( (string) $donation_panel_model['title'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-kind="<?php echo esc_attr( $donation_panel_kind ); ?>" data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-fee="<?php echo esc_attr( (string) $donation_panel_fee ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>" data-addon-fixed="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['fixed'] ) ? (float) $donation_panel_addon['fixed'] : 0 ) ); ?>" data-addon-min="<?php echo esc_attr( (string) ( isset( $donation_panel_addon['min'] ) ? (float) $donation_panel_addon['min'] : 0 ) ); ?>" data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-addon="<?php echo esc_attr__( 'Please enter a valid add-on donation amount.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps. */ echo esc_attr__( 'Step %1$d of %2$d', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?>" data-label-submit="<?php /* translators: %s: formatted total amount. */ echo esc_attr__( 'Donate %s', 'woo-donation-popup' ); ?>" data-msg-added="<?php echo esc_attr__( 'Added to your cart.', 'woo-donation-popup' ); ?>">
	<div class="dp-head">
		<button type="button" class="dp-iconbtn dp-head__back" data-dp-back aria-label="<?php esc_attr_e( 'Back', 'woo-donation-popup' ); ?>" hidden><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
		<div class="dp-head__t">
			<?php if ( ! $donation_panel_closed ) : ?>
				<p class="dp-steplabel" data-dp-steplabel aria-live="polite"></p>
			<?php endif; ?>
			<h2 class="dp-surface__title" id="<?php echo esc_attr( $donation_panel_key ); ?>-title" data-dp-title><?php echo esc_html( (string) $donation_panel_model['title'] ); ?></h2>
			<?php if ( ! empty( $donation_panel_model['badge'] ) ) : ?>
				<span class="dp-pill"><?php echo esc_html( (string) $donation_panel_model['badge'] ); ?></span>
			<?php endif; ?>
		</div>
		<?php if ( $donation_panel_close ) : ?>
			<button type="button" class="dp-iconbtn dp-surface__close" data-dp-close aria-label="<?php esc_attr_e( 'Close popup', 'woo-donation-popup' ); ?>"><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
		<?php endif; ?>
	</div>
	<?php if ( ! $donation_panel_closed && count( $donation_panel_steps ) > 1 ) : ?>
		<div class="dp-steps" aria-hidden="true" data-dp-steps hidden>
			<?php foreach ( $donation_panel_steps as $donation_panel_step ) : ?>
				<i class="dp-steps__i"></i>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
	<div class="dp-surface__body">
		<?php if ( $donation_panel_closed ) : ?>
			<p class="dp-state" role="status"><?php echo esc_html( '' !== (string) $donation_panel_model['closed_message'] ? (string) $donation_panel_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		<?php else : ?>
			<div class="dp-summary-err" role="alert" data-dp-summary></div>

			<?php foreach ( $donation_panel_steps as $donation_panel_idx => $donation_panel_step ) : ?>
				<?php $donation_panel_sid = (string) $donation_panel_step['id']; ?>
			<section class="dp-step" data-dp-step="<?php echo esc_attr( $donation_panel_sid ); ?>" data-step-label="<?php echo esc_attr( (string) $donation_panel_step['label'] ); ?>"<?php echo 0 === $donation_panel_idx ? '' : ' hidden'; ?>>
				<?php if ( 'amount' === $donation_panel_sid ) : ?>
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

					<?php if ( '' !== $donation_panel_image ) : ?>
					<div class="dp-hero"><img src="<?php echo esc_url( $donation_panel_image ); ?>" alt="" loading="lazy" decoding="async" /></div>
					<?php endif; ?>

					<?php if ( $donation_panel_camp ) : ?>
					<div class="dp-camp" data-dp-campaign>
						<div class="dp-camp__top">
							<span class="dp-camp__raised dp-num"><?php echo esc_html( (string) $donation_panel_camp['raised'] ); ?> <small><?php esc_html_e( 'raised', 'woo-donation-popup' ); ?></small></span>
							<span class="dp-camp__pct dp-num"><?php /* translators: %d: percent of goal reached. */ echo esc_html( sprintf( __( '%d%%', 'woo-donation-popup' ), (int) $donation_panel_camp['percent'] ) ); ?></span>
						</div>
						<div class="dp-camp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) (int) $donation_panel_camp['percent'] ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>"><span style="inline-size:<?php echo esc_attr( (string) min( 100, max( 0, (int) $donation_panel_camp['percent'] ) ) ); ?>%"></span></div>
						<p class="dp-camp__meta">
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

					<fieldset class="dp-fieldset" data-dp-amounts>
						<legend class="dp-legend" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label"><?php esc_html_e( 'Donation amount', 'woo-donation-popup' ); ?></legend>
						<?php if ( $donation_panel_presets ) : ?>
							<div class="dp-amounts" role="radiogroup" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-label">
								<?php foreach ( $donation_panel_presets as $donation_panel_index => $donation_panel_preset ) : ?>
									<?php
									$donation_panel_is_recommended = null !== $donation_panel_model['recommended'] && abs( (float) $donation_panel_model['recommended'] - (float) $donation_panel_preset ) < 0.005;
									$donation_panel_impact_text    = isset( $donation_panel_impact[ (string) (float) $donation_panel_preset ] ) ? $donation_panel_impact[ (string) (float) $donation_panel_preset ] : '';
									?>
									<button type="button" class="dp-amount" role="radio" aria-checked="<?php echo $donation_panel_is_recommended ? 'true' : 'false'; ?>" tabindex="<?php echo ( $donation_panel_is_recommended || ( 0 === $donation_panel_index && null === $donation_panel_model['recommended'] ) ) ? '0' : '-1'; ?>" data-dp-preset="<?php echo esc_attr( (string) $donation_panel_preset ); ?>">
										<?php if ( $donation_panel_is_recommended ) : ?>
											<span class="dp-amount__badge"><?php esc_html_e( 'Most popular', 'woo-donation-popup' ); ?></span>
										<?php endif; ?>
										<span class="dp-amount__v dp-num"><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_preset ) ); ?></span>
										<?php if ( '' !== $donation_panel_impact_text ) : ?>
											<span class="dp-amount__i"><?php echo esc_html( $donation_panel_impact_text ); ?></span>
										<?php endif; ?>
									</button>
								<?php endforeach; ?>
							</div>
						<?php endif; ?>
						<?php if ( ! empty( $donation_panel_model['allow_custom'] ) ) : ?>
							<div class="dp-field dp-field--custom" data-dp-field="amount">
								<label class="dp-custom" for="<?php echo esc_attr( $donation_panel_key ); ?>-amount">
									<span class="dp-custom__sym" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
									<span class="dp-sr"><?php echo esc_html( $donation_panel_presets ? __( 'Other amount', 'woo-donation-popup' ) : __( 'Donation amount', 'woo-donation-popup' ) ); ?></span>
									<input class="dp-custom__in dp-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="<?php echo esc_attr( $donation_panel_presets ? __( 'Enter another amount', 'woo-donation-popup' ) : __( 'Enter an amount', 'woo-donation-popup' ) ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" />
								</label>
								<p class="dp-error" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount-err" data-dp-error="amount"></p>
							</div>
						<?php else : ?>
							<input type="hidden" name="amount" value="<?php echo esc_attr( (string) ( $donation_panel_presets ? $donation_panel_presets[0] : '' ) ); ?>" />
							<p class="dp-error" data-dp-error="amount"></p>
						<?php endif; ?>
					</fieldset>

					<?php $donation_panel_extras(); ?>

					<?php if ( $donation_panel_dedi_switch ) : ?>
						<?php $donation_panel_dedi_id = $donation_panel_key . '-donation_dedication'; ?>
					<div class="dp-dedi" data-dp-dedi>
						<label class="dp-switch">
							<span class="dp-switch__t"><b><?php esc_html_e( 'Donate on behalf of someone', 'woo-donation-popup' ); ?></b><small><?php esc_html_e( 'Add a dedication note', 'woo-donation-popup' ); ?></small></span>
							<input type="checkbox" role="switch" class="dp-switch__in" data-dp-dedi-toggle aria-controls="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-box" />
							<span class="dp-switch__track" aria-hidden="true"></span>
						</label>
						<div class="dp-field" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-box" data-dp-field="donation_dedication" hidden>
							<label for="<?php echo esc_attr( $donation_panel_dedi_id ); ?>"><?php echo esc_html( (string) $donation_panel_dedi_def['label'] ); ?></label>
							<input class="dp-input" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>" name="donation_dedication" type="text"<?php echo ! empty( $donation_panel_dedi_def['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_dedi_def['placeholder'] ) . '"' : ''; ?> autocomplete="off" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_dedi_def['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-err" disabled />
							<p class="dp-error" id="<?php echo esc_attr( $donation_panel_dedi_id ); ?>-err" data-dp-error="donation_dedication"></p>
						</div>
					</div>
					<?php endif; ?>

				<?php elseif ( 'details' === $donation_panel_sid ) : ?>
					<?php if ( $donation_panel_single ) : ?>
					<div class="dp-fieldset" data-dp-qtyset>
						<div class="dp-qtybox" data-dp-qty-box>
							<span class="dp-legend" id="<?php echo esc_attr( $donation_panel_key ); ?>-qty-label"><?php echo esc_html( 'shares' === $donation_panel_kind ? __( 'Number of shares', 'woo-donation-popup' ) : __( 'Quantity', 'woo-donation-popup' ) ); ?></span>
							<div class="dp-qtybox__row">
								<?php if ( ! empty( $donation_panel_qty['enabled'] ) ) : ?>
									<div class="dp-stepper" role="group" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-qty-label">
										<button type="button" data-dp-qty="-1" aria-label="<?php esc_attr_e( 'Decrease', 'woo-donation-popup' ); ?>" disabled><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
										<output class="dp-num" data-dp-qty-out aria-live="polite">1</output>
										<button type="button" data-dp-qty="1" aria-label="<?php esc_attr_e( 'Increase', 'woo-donation-popup' ); ?>"><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
									</div>
								<?php endif; ?>
								<div class="dp-qtybox__sum">
									<small class="dp-num" data-dp-qty-sum data-unit-text="<?php echo esc_attr( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?>"><?php echo esc_html( 'shares' === $donation_panel_kind ? sprintf( /* translators: %s: price of one share. */ __( '%s per share', 'woo-donation-popup' ), $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ) : $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></small>
									<strong class="dp-num" data-dp-qty-total><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></strong>
								</div>
							</div>
							<input type="hidden" name="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>" value="1" data-dp-qty-input />
						</div>
						<input type="hidden" name="amount" value="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" />
						<p class="dp-error" data-dp-error="<?php echo esc_attr( 'shares' === $donation_panel_kind ? 'share_count' : 'quantity' ); ?>"></p>
						<p class="dp-error" data-dp-error="amount"></p>
					</div>
						<?php $donation_panel_extras(); ?>
					<?php else : ?>
					<div class="dp-summary" data-dp-recap>
						<?php if ( '' !== $donation_panel_image ) : ?>
							<img class="dp-summary__img" src="<?php echo esc_url( $donation_panel_image ); ?>" alt="" loading="lazy" decoding="async" />
						<?php endif; ?>
						<span class="dp-summary__t"><b><?php echo esc_html( (string) $donation_panel_model['title'] ); ?></b><small><?php echo esc_html( (string) $donation_panel_model['subtitle'] ); ?></small></span>
						<strong class="dp-num" data-dp-recap-amount></strong>
					</div>
					<?php endif; ?>

					<?php if ( 'shares' === $donation_panel_kind ) : ?>
						<?php for ( $donation_panel_n = 1; $donation_panel_n <= (int) $donation_panel_qty['max']; $donation_panel_n++ ) : ?>
					<fieldset class="dp-fieldset dp-holder" data-dp-holder="<?php echo esc_attr( (string) $donation_panel_n ); ?>"<?php echo 1 === $donation_panel_n ? '' : ' hidden'; ?>>
						<legend class="dp-legend"><?php /* translators: %d: shareholder number. */ echo esc_html( sprintf( __( 'Shareholder %d', 'woo-donation-popup' ), $donation_panel_n ) ); ?></legend>
							<?php foreach ( (array) $donation_panel_model['shareholder'] as $donation_panel_def ) : ?>
								<?php
								$donation_panel_hname  = 'shareholder_' . $donation_panel_n . '_' . $donation_panel_def['key'];
								$donation_panel_hid    = $donation_panel_key . '-' . $donation_panel_hname;
								$donation_panel_hreq   = ! empty( $donation_panel_def['required'] );
								$donation_panel_hextra = 'data-dp-holder-field="' . esc_attr( (string) $donation_panel_def['key'] ) . '" aria-describedby="' . esc_attr( $donation_panel_hid ) . '-err"' . ( $donation_panel_hreq ? ' data-required-msg="' . esc_attr( (string) $donation_panel_def['required_msg'] ) . '"' : '' ) . ( 1 === $donation_panel_n ? '' : ' disabled' );
								?>
						<div class="dp-field" data-dp-field="<?php echo esc_attr( $donation_panel_hname ); ?>">
							<label for="<?php echo esc_attr( $donation_panel_hid ); ?>"><?php echo esc_html( (string) $donation_panel_def['label'] ); ?></label>
								<?php if ( 'tel' === (string) $donation_panel_def['type'] ) : ?>
									<?php $donation_panel_phone_field( $donation_panel_hname, $donation_panel_hid, $donation_panel_hreq, $donation_panel_hextra ); ?>
								<?php else : ?>
							<input class="dp-input" id="<?php echo esc_attr( $donation_panel_hid ); ?>" name="<?php echo esc_attr( $donation_panel_hname ); ?>" type="<?php echo esc_attr( (string) $donation_panel_def['type'] ); ?>"<?php echo $donation_panel_hreq ? ' required aria-required="true"' : ''; ?><?php echo ! empty( $donation_panel_def['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_def['inputmode'] ) . '"' : ''; ?> autocomplete="off" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_def['maxlength'] ); ?>" <?php echo $donation_panel_hextra; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Öznitelikler yukarıda kaçışlandı. ?> />
								<?php endif; ?>
							<p class="dp-error" id="<?php echo esc_attr( $donation_panel_hid ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_hname ); ?>"></p>
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
					<label class="dp-check dp-check--plain">
						<input type="checkbox" name="<?php echo esc_attr( $donation_panel_name ); ?>" value="1" />
						<span class="dp-check__t"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></span>
					</label>
						<?php elseif ( 'donation_note' === $donation_panel_name ) : ?>
					<div class="dp-note" data-dp-note>
						<button type="button" class="dp-linkbtn" data-dp-note-toggle aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_id ); ?>-box"><svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><?php esc_html_e( 'Add a note (optional)', 'woo-donation-popup' ); ?></button>
						<div class="dp-field" id="<?php echo esc_attr( $donation_panel_id ); ?>-box" data-dp-field="<?php echo esc_attr( $donation_panel_name ); ?>" hidden>
							<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
							<textarea class="dp-textarea" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" rows="3" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" disabled></textarea>
							<p class="dp-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
						</div>
					</div>
						<?php else : ?>
					<div class="dp-field" data-dp-field="<?php echo esc_attr( $donation_panel_name ); ?>">
						<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
							<?php if ( 'tel' === $donation_panel_type ) : ?>
								<?php
								$donation_panel_extra = 'aria-describedby="' . esc_attr( $donation_panel_id ) . '-err"' . ( ! empty( $donation_panel_field['required'] ) ? ' data-required-msg="' . esc_attr( isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' ) ) . '"' : '' );
								$donation_panel_phone_field( $donation_panel_name, $donation_panel_id, ! empty( $donation_panel_field['required'] ), $donation_panel_extra );
								?>
								<span class="dp-hint"><?php esc_html_e( 'We use this number to keep you updated about your donation.', 'woo-donation-popup' ); ?></span>
							<?php elseif ( 'textarea' === $donation_panel_type ) : ?>
							<textarea class="dp-textarea" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" rows="2" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err"></textarea>
							<?php else : ?>
							<input class="dp-input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="<?php echo esc_attr( $donation_panel_type ); ?>"<?php echo ! empty( $donation_panel_field['required'] ) ? ' required aria-required="true" data-required-msg="' . esc_attr( isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' ) ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_field['inputmode'] ) . '"' : ''; ?><?php echo ! empty( $donation_panel_field['placeholder'] ) ? ' placeholder="' . esc_attr( (string) $donation_panel_field['placeholder'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $donation_panel_field['autocomplete'] ); ?>" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_id ); ?>-err" />
							<?php endif; ?>
						<p class="dp-error" id="<?php echo esc_attr( $donation_panel_id ); ?>-err" data-dp-error="<?php echo esc_attr( $donation_panel_name ); ?>"></p>
					</div>
						<?php endif; ?>
					<?php endforeach; ?>

					<?php if ( $donation_panel_fee > 0 || $donation_panel_addon ) : ?>
					<div class="dp-lines" aria-label="<?php esc_attr_e( 'Total', 'woo-donation-popup' ); ?>" data-dp-lines>
						<div data-dp-line="donation"><span><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
						<div data-dp-line="fee" hidden><span><?php esc_html_e( 'Processing fee', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
						<div data-dp-line="addon" hidden><span><?php esc_html_e( 'Add-on donation', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
						<div class="total" data-dp-line="total"><span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span><span class="dp-num" data-dp-line-value></span></div>
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
		<div class="dp-actionbar" data-single="<?php echo $donation_panel_single ? '1' : '0'; ?>">
			<div class="dp-actionbar__total" aria-live="polite" data-dp-total-row>
				<span><?php esc_html_e( 'Total', 'woo-donation-popup' ); ?></span>
				<strong class="dp-num" data-dp-total data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>"><?php echo esc_html( $donation_panel_symbol . '0' ); ?></strong>
			</div>
			<button class="dp-btn dp-btn--lg dp-btn--accent" data-dp-submit type="submit">
				<span class="dp-btn__lock" data-dp-submit-lock hidden><?php echo $donation_panel_lock_icon; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?></span>
				<span data-dp-submit-label><?php echo esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span>
				<svg class="dp-ico dp-btn__arrow" viewBox="0 0 24 24" aria-hidden="true" data-dp-submit-arrow><path d="M5 12h14M13 6l6 6-6 6"/></svg>
			</button>
			<button class="dp-btn dp-btn--outline" type="button" data-dp-addcart hidden><?php echo esc_html( $donation_panel_single ? __( 'Add to cart', 'woo-donation-popup' ) : __( 'Add to cart, choose another', 'woo-donation-popup' ) ); ?></button>
			<p class="dp-trust" data-dp-trust><?php echo $donation_panel_lock_icon; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><?php esc_html_e( 'Secure payment · Your details are encrypted', 'woo-donation-popup' ); ?></p>
			<?php if ( '' !== $donation_panel_privacy ) : ?>
				<p class="dp-legal" data-dp-legal hidden>
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
