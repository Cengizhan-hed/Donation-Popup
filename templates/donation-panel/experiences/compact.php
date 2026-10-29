<?php
/**
 * Compact bağış kartı: 4 adım (tutar, bilgiler, ödeme, teşekkür) aynı grid hücresinde üst üste; kart yüksekliği hiçbir adımda
 * değişmez. Pasif adımlar `inert` + `aria-hidden`. Tema `donation-panel/experiences/compact.php` ile geçersiz kılabilir.
 *
 * @var array{model: array<string, mixed>, view: array<string, mixed>, dom_key: string, args: array<string, mixed>} $args Şablon verisi.
 *
 * @package DonationPanel
 */

defined( 'ABSPATH' ) || exit;

$donation_panel_model    = $args['model'];
$donation_panel_view     = $args['view'];
$donation_panel_key      = (string) $args['dom_key'];
$donation_panel_opts     = (array) $args['args'];
$donation_panel_symbol   = (string) $donation_panel_model['symbol'];
$donation_panel_decimals = (int) $donation_panel_model['decimals'];
$donation_panel_currency = \DonationPanel\Support\Price::get_js_currency_settings();
$donation_panel_title    = (string) $donation_panel_model['title'];
$donation_panel_direct   = ! empty( $donation_panel_model['direct'] );
$donation_panel_closed   = ! empty( $donation_panel_model['closed'] );
$donation_panel_unit     = (float) $donation_panel_model['unit_price'];
$donation_panel_qty      = (array) $donation_panel_model['quantity'];
$donation_panel_camp     = (array) $donation_panel_view['campaign'];
$donation_panel_phone    = isset( $donation_panel_model['phone'] ) && is_array( $donation_panel_model['phone'] ) ? $donation_panel_model['phone'] : array();
$donation_panel_format   = static function ( $amount ) use ( $donation_panel_decimals ) {
	$decimals = floor( (float) $amount ) === (float) $amount ? 0 : $donation_panel_decimals;
	return number_format_i18n( (float) $amount, $decimals );
};
$donation_panel_style    = '';
foreach ( array(
	'brand'  => '--dp-color-primary',
	'accent' => '--dp-accent',
) as $donation_panel_slot => $donation_panel_var ) {
	$donation_panel_hex = isset( $donation_panel_model[ $donation_panel_slot ] ) ? (string) $donation_panel_model[ $donation_panel_slot ] : '';
	if ( 1 === preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $donation_panel_hex ) ) {
		$donation_panel_style .= $donation_panel_var . ':' . $donation_panel_hex . ';';
		$donation_panel_on     = \DonationPanel\Frontend\Theme_Colors::text_on( $donation_panel_hex );
		$donation_panel_style .= '' !== $donation_panel_on ? ( 'brand' === $donation_panel_slot ? '--dp-color-on-primary:' : '--dp-color-on-accent:' ) . $donation_panel_on . ';' : '';
	}
}
$donation_panel_lock  = '<svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
$donation_panel_back  = '<svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
$donation_panel_steps = 3;

/**
 * Adım üst bölgesi (tüm adımlarda aynı yükseklik): geri düğmesi (ilk adım hariç), ürün adı, seçilen tutar, adım sayacı.
 *
 * @param int  $index   Adım (1–3; 4 = teşekkür, sayaçsız).
 * @param bool $back    Geri düğmesi.
 * @param bool $amount  Seçilen tutar.
 */
$donation_panel_top = static function ( $index, $back, $amount ) use ( $donation_panel_key, $donation_panel_title, $donation_panel_back, $donation_panel_steps ) {
	?>
	<div class="donation-panel-compact__top">
		<?php if ( $back ) : ?>
			<button type="button" class="donation-panel-compact__back" data-dp-cback><?php echo $donation_panel_back; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><span><?php echo esc_html_x( 'Back', 'Compact donation card: previous step', 'woo-donation-popup' ); ?></span></button>
		<?php endif; ?>
		<h2 class="donation-panel-compact__title" id="<?php echo esc_attr( $donation_panel_key . '-t' . $index ); ?>" tabindex="-1" data-dp-ctitle><?php echo esc_html( $donation_panel_title ); ?></h2>
		<?php if ( $amount ) : ?>
			<span class="donation-panel-compact__amt donation-panel-num" data-dp-camount></span>
		<?php endif; ?>
		<?php if ( $index <= $donation_panel_steps ) : ?>
			<span class="donation-panel-compact__count donation-panel-num" aria-hidden="true"><?php echo esc_html( $index . '/' . $donation_panel_steps ); ?></span>
		<?php endif; ?>
	</div>
	<?php
};

/**
 * Kampanya çubuğu (tutar ve teşekkür adımlarında; teşekkürde sayfa yenilenmeden güncellenir).
 */
$donation_panel_campaign = static function () use ( $donation_panel_camp, $donation_panel_view ) {
	if ( ! $donation_panel_camp ) {
		return;
	}
	$zero = ! empty( $donation_panel_camp['zero'] );
	?>
	<div class="donation-panel-compact__camp" data-dp-ccamp data-zero="<?php echo $zero ? '1' : '0'; ?>">
		<p class="donation-panel-compact__nums">
			<span class="donation-panel-compact__raised donation-panel-num" data-dp-craised-row<?php echo $zero ? ' hidden' : ''; ?>><b data-dp-craised><?php echo esc_html( (string) $donation_panel_camp['raised'] ); ?></b> <small><?php esc_html_e( 'raised', 'woo-donation-popup' ); ?></small></span>
			<span class="donation-panel-compact__first" data-dp-cfirst<?php echo $zero ? '' : ' hidden'; ?>><?php echo esc_html( (string) $donation_panel_view['first_text'] ); ?></span>
			<span class="donation-panel-compact__pct donation-panel-num" data-dp-cpct<?php echo $zero ? ' hidden' : ''; ?>><?php /* translators: %d: percent of goal reached. */ echo esc_html( sprintf( __( '%d%%', 'woo-donation-popup' ), (int) $donation_panel_camp['percent'] ) ); ?></span>
		</p>
		<div class="donation-panel-compact__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) min( 100, (int) $donation_panel_camp['percent'] ) ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>" data-dp-cbar><span style="inline-size:<?php echo esc_attr( (string) min( 100, (int) $donation_panel_camp['percent'] ) ); ?>%"></span></div>
		<p class="donation-panel-compact__meta">
			<span data-dp-cgoal><?php /* translators: %s: goal amount. */ echo esc_html( sprintf( __( 'Goal %s', 'woo-donation-popup' ), (string) $donation_panel_camp['goal'] ) ); ?></span>
			<span data-dp-cdonors data-one="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 1, 'woo-donation-popup' ) ); ?>" data-many="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 2, 'woo-donation-popup' ) ); ?>"<?php echo (int) $donation_panel_camp['donors'] > 0 ? '' : ' hidden'; ?>><?php /* translators: %s: number of donors. */ echo esc_html( sprintf( _n( '%s supporter', '%s supporters', max( 1, (int) $donation_panel_camp['donors'] ), 'woo-donation-popup' ), number_format_i18n( (int) $donation_panel_camp['donors'] ) ) ); ?></span>
		</p>
	</div>
	<?php
};
?>
<div class="donation-panel donation-panel-compact" id="<?php echo esc_attr( $donation_panel_key ); ?>" data-dp-compact data-dp-product="<?php echo esc_attr( (string) (int) $donation_panel_model['product_id'] ); ?>" data-dp-rest="<?php echo esc_url( (string) $donation_panel_opts['rest_url'] ); ?>" data-dp-checkout="<?php echo esc_url( (string) $donation_panel_opts['checkout_url'] ); ?>" data-dp-reset="<?php echo ! empty( $donation_panel_view['reset_hidden'] ) ? '1' : '0'; ?>"<?php echo '' !== $donation_panel_style ? ' style="' . esc_attr( $donation_panel_style ) . '"' : ''; ?>>
<?php if ( $donation_panel_closed ) : ?>
	<div class="donation-panel-compact__stack">
		<section class="donation-panel-compact__step is-on" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t4">
			<?php $donation_panel_top( 4, false, false ); ?>
			<p class="donation-panel-compact__closed" role="status"><?php echo esc_html( '' !== (string) $donation_panel_model['closed_message'] ? (string) $donation_panel_model['closed_message'] : __( 'Donation form closed', 'woo-donation-popup' ) ); ?></p>
		</section>
	</div>
<?php else : ?>
	<form class="donation-panel-compact__form" method="post" action="" novalidate data-dp-cform data-kind="<?php echo esc_attr( (string) $donation_panel_model['kind'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-thousand-sep="<?php echo esc_attr( $donation_panel_currency['thousandSeparator'] ); ?>" data-decimal-sep="<?php echo esc_attr( $donation_panel_currency['decimalSeparator'] ); ?>" data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>" data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>"<?php echo $donation_panel_direct ? ' data-direct="1"' : ''; ?> data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-msg-format="<?php echo esc_attr( \DonationPanel\Support\Price::get_ambiguous_amount_message( array( 'decimals' => $donation_panel_decimals ) ) ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-msg-email="<?php esc_attr_e( 'Please enter a valid email address.', 'woo-donation-popup' ); ?>" data-msg-failed="<?php echo esc_attr( $donation_panel_direct ? __( 'We could not open the payment page. Nothing was charged. Please try again.', 'woo-donation-popup' ) : __( 'Something went wrong. Please try again.', 'woo-donation-popup' ) ); ?>" data-msg-rate="<?php esc_attr_e( 'Too many attempts. Please wait a moment and try again.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps, 3: step name. */ echo esc_attr_x( 'Step %1$d of %2$d: %3$s', 'Compact donation card: screen reader announcement', 'woo-donation-popup' ); ?>" data-msg-paid="<?php esc_attr_e( 'Thank you! Your donation was received.', 'woo-donation-popup' ); ?>" data-label-choose="<?php echo esc_attr_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?>">
		<p class="donation-panel-sr" aria-live="polite" data-dp-live></p>
		<div class="donation-panel-compact__stack">

			<section class="donation-panel-compact__step is-on" data-dp-cstep="amount" data-step-name="<?php esc_attr_e( 'Amount', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t1">
				<?php $donation_panel_top( 1, false, false ); ?>
				<?php $donation_panel_campaign(); ?>
				<?php if ( ! $donation_panel_camp && '' !== (string) $donation_panel_view['impact'] ) : ?>
					<p class="donation-panel-compact__impact"><?php echo esc_html( (string) $donation_panel_view['impact'] ); ?></p>
				<?php endif; ?>
				<div class="donation-panel-compact__main">
				<?php if ( ! empty( $donation_panel_view['fixed'] ) ) : ?>
					<div class="donation-panel-compact__fixed">
						<span class="donation-panel-compact__price">
							<b class="donation-panel-num" data-dp-cunit><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></b>
							<small><?php esc_html_e( 'Price', 'woo-donation-popup' ); ?></small>
						</span>
						<?php if ( ! empty( $donation_panel_qty['enabled'] ) ) : ?>
							<div class="donation-panel-stepper" role="group" aria-label="<?php esc_attr_e( 'Quantity', 'woo-donation-popup' ); ?>">
								<button type="button" data-dp-cqty="-1" aria-label="<?php esc_attr_e( 'Decrease', 'woo-donation-popup' ); ?>" disabled><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
								<output class="donation-panel-num" data-dp-cqty-out aria-live="polite">1</output>
								<button type="button" data-dp-cqty="1" aria-label="<?php esc_attr_e( 'Increase', 'woo-donation-popup' ); ?>"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
							</div>
						<?php endif; ?>
						<input type="hidden" name="quantity" value="1" data-dp-cqty-in />
						<input type="hidden" name="amount" value="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" />
					</div>
				<?php else : ?>
					<fieldset class="donation-panel-compact__amounts">
						<legend class="donation-panel-sr"><?php esc_html_e( 'Donation amount', 'woo-donation-popup' ); ?></legend>
						<?php if ( $donation_panel_view['quick'] ) : ?>
							<div class="donation-panel-compact__quick">
								<?php foreach ( (array) $donation_panel_view['quick'] as $donation_panel_preset ) : ?>
									<?php $donation_panel_is_rec = null !== $donation_panel_view['recommended'] && abs( (float) $donation_panel_view['recommended'] - (float) $donation_panel_preset ) < 0.005; ?>
									<label class="donation-panel-compact__chip">
										<input class="donation-panel-sr" type="radio" name="dp_quick" value="<?php echo esc_attr( (string) $donation_panel_preset ); ?>" data-dp-cquick />
										<span class="donation-panel-num"><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_preset ) ); ?></span>
										<?php if ( $donation_panel_is_rec ) : ?>
											<small class="donation-panel-compact__rec"><?php echo esc_html_x( 'Recommended', 'Compact donation card: amount suggested by the site', 'woo-donation-popup' ); ?></small>
										<?php endif; ?>
									</label>
								<?php endforeach; ?>
							</div>
						<?php endif; ?>
						<?php if ( ! empty( $donation_panel_view['custom'] ) ) : ?>
							<label class="donation-panel-custom donation-panel-compact__other" for="<?php echo esc_attr( $donation_panel_key ); ?>-amount">
								<span class="donation-panel-custom__sym" aria-hidden="true"><?php echo esc_html( $donation_panel_symbol ); ?></span>
								<span class="donation-panel-sr"><?php echo esc_html( $donation_panel_view['quick'] ? __( 'Other amount', 'woo-donation-popup' ) : __( 'Donation amount', 'woo-donation-popup' ) ); ?></span>
								<input class="donation-panel-custom__in donation-panel-num" id="<?php echo esc_attr( $donation_panel_key ); ?>-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="<?php echo esc_attr( $donation_panel_view['quick'] ? __( 'Other amount', 'woo-donation-popup' ) : __( 'Enter an amount', 'woo-donation-popup' ) ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-e1" data-dp-camount-in />
							</label>
						<?php endif; ?>
					</fieldset>
				<?php endif; ?>
				</div>
				<p class="donation-panel-compact__err" id="<?php echo esc_attr( $donation_panel_key ); ?>-e1" data-dp-cerr></p>
				<button type="submit" class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" data-dp-cnext><span data-dp-cnext-label><?php echo esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span></button>
			</section>

			<section class="donation-panel-compact__step" data-dp-cstep="details" data-step-name="<?php esc_attr_e( 'Your details', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t2" inert aria-hidden="true">
				<?php $donation_panel_top( 2, true, true ); ?>
				<div class="donation-panel-compact__fields">
					<?php foreach ( (array) $donation_panel_view['fields'] as $donation_panel_field ) : ?>
						<?php
						$donation_panel_name = (string) $donation_panel_field['name'];
						$donation_panel_id   = $donation_panel_key . '-' . $donation_panel_name;
						$donation_panel_req  = ! empty( $donation_panel_field['required'] );
						$donation_panel_msg  = isset( $donation_panel_field['required_msg'] ) ? (string) $donation_panel_field['required_msg'] : __( 'This field is required.', 'woo-donation-popup' );
						?>
						<div class="donation-panel-compact__field" data-dp-cfield="<?php echo esc_attr( $donation_panel_name ); ?>">
							<label for="<?php echo esc_attr( $donation_panel_id ); ?>"><?php echo esc_html( (string) $donation_panel_field['label'] ); ?></label>
							<?php if ( 'donation_phone' === $donation_panel_name ) : ?>
								<?php
								$donation_panel_dial = isset( $donation_panel_phone['dial'] ) ? (string) $donation_panel_phone['dial'] : '';
								$donation_panel_iso  = isset( $donation_panel_phone['iso'] ) ? (string) $donation_panel_phone['iso'] : '';
								$donation_panel_list = isset( $donation_panel_phone['countries'] ) ? (array) $donation_panel_phone['countries'] : array();
								?>
								<span class="donation-panel-phone">
									<?php if ( $donation_panel_list ) : ?>
										<span class="donation-panel-phone__code">
											<span class="donation-panel-phone__dial donation-panel-num" aria-hidden="true" data-dp-dial-label>+<?php echo esc_html( $donation_panel_dial ); ?></span>
											<svg class="donation-panel-ico donation-panel-phone__chev" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
											<select class="donation-panel-phone__select" data-dp-dial aria-label="<?php esc_attr_e( 'Country code', 'woo-donation-popup' ); ?>">
												<?php foreach ( $donation_panel_list as $donation_panel_country ) : ?>
													<option value="<?php echo esc_attr( (string) $donation_panel_country['dial'] ); ?>"<?php echo (string) $donation_panel_country['iso'] === $donation_panel_iso ? ' selected' : ''; ?>><?php echo esc_html( (string) $donation_panel_country['name'] . ' (+' . (string) $donation_panel_country['dial'] . ')' ); ?></option>
												<?php endforeach; ?>
											</select>
										</span>
									<?php endif; ?>
									<input class="donation-panel-phone__input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="next" maxlength="28" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-e2"<?php echo $donation_panel_req ? ' required aria-required="true" data-required-msg="' . esc_attr( $donation_panel_msg ) . '"' : ''; ?> />
								</span>
							<?php else : ?>
								<input class="donation-panel-input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="<?php echo esc_attr( (string) $donation_panel_field['type'] ); ?>"<?php echo ! empty( $donation_panel_field['inputmode'] ) ? ' inputmode="' . esc_attr( (string) $donation_panel_field['inputmode'] ) . '"' : ''; ?> autocomplete="<?php echo esc_attr( (string) $donation_panel_field['autocomplete'] ); ?>" enterkeyhint="next" maxlength="<?php echo esc_attr( (string) (int) $donation_panel_field['maxlength'] ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-e2"<?php echo $donation_panel_req ? ' required aria-required="true" data-required-msg="' . esc_attr( $donation_panel_msg ) . '"' : ''; ?> />
							<?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
				<div class="donation-panel-compact__slot" data-dp-cslot>
					<?php if ( ! empty( $donation_panel_view['tax_relief'] ) && class_exists( '\DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration' ) ) : ?>
						<?php $donation_panel_tax = \DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration::texts( (array) ( new \DonationPanel\Core\Settings() )->get( 'tax_relief', array() ) ); ?>
						<label class="donation-panel-check donation-panel-check--plain donation-panel-compact__tax">
							<input type="checkbox" name="<?php echo esc_attr( \DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration::FIELD ); ?>" value="1" />
							<span class="donation-panel-check__t"><?php echo esc_html( (string) $donation_panel_tax['checkbox_label'] ); ?></span>
						</label>
					<?php endif; ?>
				</div>
				<p class="donation-panel-compact__err" id="<?php echo esc_attr( $donation_panel_key ); ?>-e2" data-dp-cerr></p>
				<button type="submit" class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta"><span><?php echo esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span></button>
			</section>

			<section class="donation-panel-compact__step" data-dp-cstep="pay" data-step-name="<?php esc_attr_e( 'Payment', 'woo-donation-popup' ); ?>" data-dp-kind="popup" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t3" inert aria-hidden="true">
				<?php $donation_panel_top( 3, true, true ); ?>
				<dl class="donation-panel-compact__recap">
					<div><dt><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></dt><dd class="donation-panel-num" data-dp-crecap-amount></dd></div>
					<div><dt><?php esc_html_e( 'Donor', 'woo-donation-popup' ); ?></dt><dd data-dp-crecap-name></dd></div>
				</dl>
				<p class="donation-panel-compact__note">
					<?php
					echo esc_html(
						$donation_panel_direct
							? __( 'You will pay in a secure payment window. Your card details never pass through this form.', 'woo-donation-popup' )
							: __( 'You will complete your donation on the secure checkout page.', 'woo-donation-popup' )
					);
					?>
				</p>
				<p class="donation-panel-compact__err" id="<?php echo esc_attr( $donation_panel_key ); ?>-e3" data-dp-cerr></p>
				<button type="submit" class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" data-dp-cpay data-label="<?php /* translators: %s: formatted amount. */ echo esc_attr( $donation_panel_direct ? __( 'Donate %s securely', 'woo-donation-popup' ) : __( 'Continue to checkout · %s', 'woo-donation-popup' ) ); ?>"<?php echo $donation_panel_direct ? ' aria-haspopup="dialog" aria-expanded="false" aria-controls="' . esc_attr( $donation_panel_key ) . '-pay"' : ''; ?>><?php echo $donation_panel_lock; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><span data-dp-cpay-label><?php esc_html_e( 'Donate securely', 'woo-donation-popup' ); ?></span></button>
				<?php if ( $donation_panel_direct ) : ?>
					<?php // Ödeme katmanı canlı DOM'da değil, inert <template> içinde (CLS 0); ödeme adımında <dialog> olarak oluşturulur. ?>
					<template data-dp-tpl>
						<dialog class="donation-panel-overlay donation-panel-overlay--modal" id="<?php echo esc_attr( $donation_panel_key ); ?>-pay" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-paytitle" data-dp-overlay>
							<div class="donation-panel-surface donation-panel-surface--modal donation-panel-compact__paysurface" tabindex="-1" data-dp-surface>
								<div class="donation-panel-surface__handle" data-dp-handle aria-hidden="true"></div>
								<div class="donation-panel-head">
									<div class="donation-panel-head__t">
										<h2 class="donation-panel-surface__title" id="<?php echo esc_attr( $donation_panel_key ); ?>-paytitle" tabindex="-1" data-dp-title><?php esc_html_e( 'Secure payment', 'woo-donation-popup' ); ?></h2>
									</div>
									<button type="button" class="donation-panel-iconbtn donation-panel-surface__close" data-dp-close aria-label="<?php esc_attr_e( 'Close payment window', 'woo-donation-popup' ); ?>"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
								</div>
								<div class="donation-panel-compact__paybody" data-dp-cpaybody>
									<p class="donation-panel-compact__payload" data-dp-cpayload role="status"><?php esc_html_e( 'Opening the secure payment page…', 'woo-donation-popup' ); ?></p>
									<iframe class="donation-panel-compact__frame" title="<?php esc_attr_e( 'Secure payment', 'woo-donation-popup' ); ?>" data-dp-cframe hidden></iframe>
								</div>
								<p class="donation-panel-compact__payalt"><a href="#" target="_top" data-dp-cpayalt hidden><?php esc_html_e( 'Trouble paying here? Open the payment page instead', 'woo-donation-popup' ); ?></a></p>
							</div>
						</dialog>
					</template>
				<?php endif; ?>
			</section>

			<section class="donation-panel-compact__step" data-dp-cstep="thanks" data-step-name="<?php esc_attr_e( 'Thank you', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t4" inert aria-hidden="true">
				<div class="donation-panel-compact__top">
					<h2 class="donation-panel-compact__title" id="<?php echo esc_attr( $donation_panel_key ); ?>-t4" tabindex="-1" data-dp-ctitle><?php esc_html_e( 'Thank you!', 'woo-donation-popup' ); ?></h2>
				</div>
				<div class="donation-panel-compact__thanks">
					<svg class="donation-panel-compact__tick" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>
					<p data-dp-cthanks data-text="<?php /* translators: 1: formatted amount, 2: product name. */ echo esc_attr__( 'Your donation of %1$s to %2$s was received.', 'woo-donation-popup' ); ?>" data-title="<?php echo esc_attr( $donation_panel_title ); ?>"></p>
				</div>
				<?php $donation_panel_campaign(); ?>
				<button type="button" class="donation-panel-btn donation-panel-btn--ghost donation-panel-compact__cta" data-dp-cagain><?php esc_html_e( 'Give again', 'woo-donation-popup' ); ?></button>
			</section>
		</div>
	</form>
<?php endif; ?>
</div>
