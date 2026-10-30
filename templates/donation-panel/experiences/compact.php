<?php
/**
 * Compact bağış kartı: adımlar aynı grid hücresinde üst üste; kart yüksekliği hiçbir adımda değişmez. Pasif adımlar `inert` +
 * `aria-hidden`. Sepetli akış 2 adım (tutar, bilgiler + "Ödemeye geç"), doğrudan akış 3 adım (tutar, bilgiler, ödeme) + teşekkür.
 * Her adımın altı aynıdır: tek durum satırı (güven satırı ya da hata; yer önceden ayrılı) + ana düğme.
 * Tema `donation-panel/experiences/compact.php` ile geçersiz kılabilir.
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
$donation_panel_steps    = isset( $donation_panel_view['steps'] ) ? (int) $donation_panel_view['steps'] : ( $donation_panel_direct ? 3 : 2 );
$donation_panel_trust    = ! isset( $donation_panel_view['trust'] ) || ! empty( $donation_panel_view['trust'] );
// Ödeme adımı notu ve güven satırı aynı yeri paylaşır (bkz. $donation_panel_status).
$donation_panel_tiers    = isset( $donation_panel_view['impact_tiers'] ) ? (array) $donation_panel_view['impact_tiers'] : array();
$donation_panel_fixed    = ! empty( $donation_panel_view['fixed'] );
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
$donation_panel_tax   = array();
if ( ! empty( $donation_panel_view['tax_relief'] ) && class_exists( '\DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration' ) ) {
	$donation_panel_tax = \DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration::texts( (array) ( new \DonationPanel\Core\Settings() )->get( 'tax_relief', array() ) );
}

/**
 * Adım üst bölgesi (tüm adımlarda aynı yükseklik, tek satır): geri düğmesi (ilk adım hariç), ürün adı (tek satır, ellipsis),
 * seçilen tutar, adım sayacı (gerçek adım sayısı).
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
 * Adımın alt bölgesi: tek durum satırı (güven satırı; hata varken yerini hata alır — yer her zaman ayrılı, yükseklik değişmez).
 *
 * @param int    $index Adım (1–3).
 * @param string $trust Güven satırı metni ('' = yok).
 */
$donation_panel_status = static function ( $index, $trust ) use ( $donation_panel_key, $donation_panel_lock ) {
	?>
	<div class="donation-panel-compact__status">
		<p class="donation-panel-compact__err" id="<?php echo esc_attr( $donation_panel_key . '-e' . $index ); ?>" data-dp-cerr></p>
		<?php if ( '' !== $trust ) : ?>
			<p class="donation-panel-compact__trust"><?php echo str_replace( 'width="20" height="20"', 'width="14" height="14"', $donation_panel_lock ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><span><?php echo esc_html( $trust ); ?></span></p>
		<?php endif; ?>
	</div>
	<?php
};
$donation_panel_trust_text = $donation_panel_trust ? _x( 'Secure payment', 'Compact donation card: trust line above the button', 'woo-donation-popup' ) : '';

/**
 * Kampanya satırı + çubuk (tutar ve teşekkür adımlarında; teşekkürde sayfa yenilenmeden güncellenir). Tek satır:
 * "£1,250 / £3,000 · 12 destekçi … %42"; hiç bağış yokken "£0 / £3,000 · İlk bağışı siz yapın" (yüzde yok).
 */
$donation_panel_campaign = static function () use ( $donation_panel_camp, $donation_panel_view ) {
	if ( ! $donation_panel_camp ) {
		return;
	}
	$zero   = ! empty( $donation_panel_camp['zero'] );
	$donors = (int) $donation_panel_camp['donors'];
	?>
	<div class="donation-panel-compact__camp" data-dp-ccamp data-zero="<?php echo $zero ? '1' : '0'; ?>">
		<p class="donation-panel-compact__nums">
			<span class="donation-panel-compact__sum">
				<span class="donation-panel-compact__raised donation-panel-num" data-dp-craised-row><b data-dp-craised><?php echo esc_html( (string) $donation_panel_camp['raised'] ); ?></b></span>
				<span class="donation-panel-compact__goal donation-panel-num" data-dp-cgoal><?php /* translators: %s: campaign goal amount ("£1,250 / £3,000"). */ echo esc_html( sprintf( _x( '/ %s', 'Compact donation card: raised of goal', 'woo-donation-popup' ), (string) $donation_panel_camp['goal'] ) ); ?></span>
				<span class="donation-panel-compact__first" data-dp-cfirst<?php echo $zero ? '' : ' hidden'; ?>><?php echo esc_html( (string) $donation_panel_view['first_text'] ); ?></span>
				<span class="donation-panel-compact__donors" data-dp-cdonors data-one="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 1, 'woo-donation-popup' ) ); ?>" data-many="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 2, 'woo-donation-popup' ) ); ?>"<?php echo ! $zero && $donors > 0 ? '' : ' hidden'; ?>><?php /* translators: %s: number of donors. */ echo esc_html( sprintf( _n( '%s supporter', '%s supporters', max( 1, $donors ), 'woo-donation-popup' ), number_format_i18n( $donors ) ) ); ?></span>
			</span>
			<span class="donation-panel-compact__pct donation-panel-num" data-dp-cpct<?php echo $zero ? ' hidden' : ''; ?>><?php /* translators: %d: percent of goal reached. */ echo esc_html( sprintf( __( '%d%%', 'woo-donation-popup' ), (int) $donation_panel_camp['percent'] ) ); ?></span>
		</p>
		<div class="donation-panel-compact__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) min( 100, (int) $donation_panel_camp['percent'] ) ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>" data-dp-cbar><span style="inline-size:<?php echo esc_attr( (string) min( 100, (int) $donation_panel_camp['percent'] ) ); ?>%"></span></div>
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
	<form class="donation-panel-compact__form" method="post" action="" novalidate data-dp-cform data-steps="<?php echo esc_attr( (string) $donation_panel_steps ); ?>" data-kind="<?php echo esc_attr( (string) $donation_panel_model['kind'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-thousand-sep="<?php echo esc_attr( $donation_panel_currency['thousandSeparator'] ); ?>" data-decimal-sep="<?php echo esc_attr( $donation_panel_currency['decimalSeparator'] ); ?>" data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>" data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>"<?php echo $donation_panel_direct ? ' data-direct="1"' : ''; ?><?php echo $donation_panel_tiers ? ' data-impact="' . esc_attr( (string) wp_json_encode( $donation_panel_tiers ) ) . '"' : ''; ?> data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-msg-format="<?php echo esc_attr( \DonationPanel\Support\Price::get_ambiguous_amount_message( array( 'decimals' => $donation_panel_decimals ) ) ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-msg-email="<?php esc_attr_e( 'Please enter a valid email address.', 'woo-donation-popup' ); ?>" data-msg-failed="<?php echo esc_attr( $donation_panel_direct ? __( 'We could not open the payment page. Nothing was charged. Please try again.', 'woo-donation-popup' ) : __( 'Something went wrong. Please try again.', 'woo-donation-popup' ) ); ?>" data-msg-rate="<?php esc_attr_e( 'Too many attempts. Please wait a moment and try again.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps, 3: step name. */ echo esc_attr_x( 'Step %1$d of %2$d: %3$s', 'Compact donation card: screen reader announcement', 'woo-donation-popup' ); ?>" data-msg-paid="<?php esc_attr_e( 'Thank you! Your donation was received.', 'woo-donation-popup' ); ?>" data-label-choose="<?php echo esc_attr_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?>">
		<p class="donation-panel-sr" aria-live="polite" data-dp-live></p>
		<div class="donation-panel-compact__stack">

			<section class="donation-panel-compact__step is-on" data-dp-cstep="amount" data-step-name="<?php esc_attr_e( 'Amount', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t1">
				<?php $donation_panel_top( 1, false, false ); ?>
				<?php $donation_panel_campaign(); ?>
				<?php if ( ! $donation_panel_camp && '' !== (string) $donation_panel_view['impact'] ) : ?>
					<p class="donation-panel-compact__impact"><?php echo esc_html( (string) $donation_panel_view['impact'] ); ?></p>
				<?php endif; ?>
				<div class="donation-panel-compact__main">
				<?php if ( $donation_panel_fixed ) : ?>
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
				<?php
				// Toplam satırı: sabit fiyatta adet × fiyat ("Toplam"), serbest tutarda seçilen tutar ("Bağışınız" · etki ifadesi —
				// Etki ifadeleri modülü açıksa). Sütunlar içerikten bağımsız genişlikte: metin değişince kutular kaymaz (CLS 0).
				?>
				<p class="donation-panel-compact__total" data-dp-csum>
					<span class="donation-panel-compact__totall"><?php echo $donation_panel_fixed ? esc_html__( 'Total', 'woo-donation-popup' ) : esc_html_x( 'Your donation', 'Compact donation card: chosen amount row', 'woo-donation-popup' ); ?></span>
					<span class="donation-panel-compact__effect" data-dp-ceffect aria-live="polite"></span>
					<b class="donation-panel-num" data-dp-ctotal><?php echo $donation_panel_fixed ? esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ) : '—'; ?></b>
				</p>
				<div class="donation-panel-compact__foot">
				<?php $donation_panel_status( 1, $donation_panel_trust_text ); ?>
				<?php // İlk durum sunucuda çizilir (betik yüklenince metin/genişlik değişmesin: CLS 0): tutar seçilmemişken pasif "Tutar seçin". ?>
				<?php $donation_panel_pending = ! $donation_panel_fixed; ?>
				<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta<?php echo $donation_panel_pending ? ' is-pending' : ''; ?>" type="submit" aria-disabled="<?php echo $donation_panel_pending ? 'true' : 'false'; ?>" data-dp-cnext><span data-dp-cnext-label><?php echo $donation_panel_pending ? esc_html_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ) : esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span></button>
				</div>
			</section>

			<section class="donation-panel-compact__step" data-dp-cstep="details" data-step-name="<?php esc_attr_e( 'Your details', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t2" inert aria-hidden="true">
				<?php $donation_panel_top( 2, true, true ); ?>
				<?php // Alanlar tek çerçeveli grupta: etiket solda, alan sağda (≥48 px satır); telefon ülke kodu aynı satırda. ?>
				<div class="donation-panel-compact__group" style="--_n:<?php echo esc_attr( (string) max( 1, count( (array) $donation_panel_view['fields'] ) ) ); ?>">
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
				<?php if ( $donation_panel_tax ) : ?>
					<?php // Vergi indirimi beyanı: başlık + beyanın kısa hali (tek satır) + "Ayrıntılar" (tam metin kart içinde, üstte açılır; yükseklik değişmez). ?>
					<div class="donation-panel-compact__tax">
						<label class="donation-panel-compact__taxcheck">
							<input type="checkbox" name="<?php echo esc_attr( \DonationPanel\Modules\TaxRelief\Tax_Relief_Declaration::FIELD ); ?>" value="1" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-taxtext" data-dp-ctax />
							<span class="donation-panel-compact__taxt">
								<b><?php echo esc_html( (string) $donation_panel_tax['title'] ); ?></b>
								<span class="donation-panel-sr"><?php echo esc_html( (string) $donation_panel_tax['checkbox_label'] ); ?></span>
								<span class="donation-panel-compact__taxs" aria-hidden="true"><?php echo esc_html( (string) $donation_panel_tax['text'] ); ?></span>
							</span>
						</label>
						<button type="button" class="donation-panel-compact__more" aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>-taxfull" data-dp-ctax-more><?php echo esc_html_x( 'Details', 'Compact donation card: open the full tax relief declaration', 'woo-donation-popup' ); ?></button>
					</div>
				<?php endif; ?>
				<div class="donation-panel-compact__foot">
				<?php $donation_panel_status( 2, $donation_panel_trust_text ); ?>
				<?php if ( $donation_panel_direct ) : ?>
					<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" type="submit"><span><?php echo esc_html_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?></span></button>
				<?php else : ?>
					<?php // Sepetli akışın son adımı: sepete ekler ve ödeme sayfasına geçer (ara "ödeme sayfasında tamamlayacaksınız" adımı yok). ?>
					<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" type="submit" data-dp-cpay data-label="<?php /* translators: %s: formatted amount. */ esc_attr_e( 'Continue to checkout · %s', 'woo-donation-popup' ); ?>"><span data-dp-cpay-label><?php esc_html_e( 'Continue to checkout', 'woo-donation-popup' ); ?></span></button>
				<?php endif; ?>
				</div>
				<?php if ( $donation_panel_tax ) : ?>
					<div class="donation-panel-compact__sheet" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxfull" role="region" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-taxh" tabindex="-1" inert data-dp-ctax-sheet>
						<h3 class="donation-panel-compact__sheeth" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxh"><?php echo esc_html( (string) $donation_panel_tax['title'] ); ?></h3>
						<p class="donation-panel-compact__sheett" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxtext"><?php echo esc_html( (string) $donation_panel_tax['text'] ); ?></p>
						<button type="button" class="donation-panel-btn donation-panel-btn--ghost donation-panel-compact__sheetx" data-dp-ctax-close><?php echo esc_html_x( 'Done', 'Compact donation card: close the full tax relief declaration', 'woo-donation-popup' ); ?></button>
					</div>
				<?php endif; ?>
			</section>

			<?php if ( $donation_panel_direct ) : ?>
			<section class="donation-panel-compact__step" data-dp-cstep="pay" data-step-name="<?php esc_attr_e( 'Payment', 'woo-donation-popup' ); ?>" data-dp-kind="popup" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t3" inert aria-hidden="true">
				<?php $donation_panel_top( 3, true, true ); ?>
				<div class="donation-panel-compact__recap">
					<dl>
						<div><dt><?php esc_html_e( 'Donation', 'woo-donation-popup' ); ?></dt><dd class="donation-panel-num" data-dp-crecap-amount></dd></div>
						<div><dt><?php esc_html_e( 'Donor', 'woo-donation-popup' ); ?></dt><dd data-dp-crecap-name></dd></div>
						<div data-dp-crecap-email-row hidden><dt><?php esc_html_e( 'Email', 'woo-donation-popup' ); ?></dt><dd data-dp-crecap-email></dd></div>
						<?php if ( $donation_panel_tax ) : ?>
							<div data-dp-crecap-tax-row hidden><dt><?php echo esc_html( (string) $donation_panel_tax['step_label'] ); ?></dt><dd><?php echo esc_html_x( 'Declared', 'Compact donation card: tax relief declaration given', 'woo-donation-popup' ); ?></dd></div>
						<?php endif; ?>
					</dl>
				</div>
				<?php // Ödeme adımında güven satırı yerine (aynı yerde) ödeme penceresi notu; ayardan bağımsız (bilgilendirme). ?>
				<div class="donation-panel-compact__foot">
				<?php $donation_panel_status( 3, __( 'You will pay in a secure payment window. Your card details never pass through this form.', 'woo-donation-popup' ) ); ?>
				<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" type="submit" data-dp-cpay data-label="<?php /* translators: %s: formatted amount. */ esc_attr_e( 'Donate %s securely', 'woo-donation-popup' ); ?>" aria-haspopup="dialog" aria-expanded="false" aria-controls="<?php echo esc_attr( $donation_panel_key ); ?>-pay"><?php echo $donation_panel_lock; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Sabit SVG. ?><span data-dp-cpay-label><?php esc_html_e( 'Donate securely', 'woo-donation-popup' ); ?></span></button>
				</div>
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
							<?php // Yükleniyor iletisi çerçevenin ÜSTÜNDE durur, bağlantı satırının yeri ayrılmıştır: çerçeve yüklenince katmanda kayma olmaz. ?>
							<div class="donation-panel-compact__paybody" data-dp-cpaybody data-loading="1">
								<iframe class="donation-panel-compact__frame" title="<?php esc_attr_e( 'Secure payment', 'woo-donation-popup' ); ?>" data-dp-cframe></iframe>
								<p class="donation-panel-compact__payload" role="status"><?php esc_html_e( 'Opening the secure payment page…', 'woo-donation-popup' ); ?></p>
							</div>
							<p class="donation-panel-compact__payalt"><a href="#" target="_top" class="is-off" data-dp-cpayalt><?php esc_html_e( 'Trouble paying here? Open the payment page instead', 'woo-donation-popup' ); ?></a></p>
						</div>
					</dialog>
				</template>
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
			<?php endif; ?>
		</div>
	</form>
<?php endif; ?>
</div>
