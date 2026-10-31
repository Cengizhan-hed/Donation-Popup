<?php
/**
 * Compact bağış kartı (slider/hero): bağışı sepete ekler ve WooCommerce ödeme sayfasına götürür (doğrudan bağış bu düzende
 * uygulanmaz). Adımlar aynı grid hücresinde üst üste; kart yüksekliği hiçbir adımda değişmez. Pasif adımlar `inert` +
 * `aria-hidden`. Serbest tutar 2 adım (tutar, ad/telefon + "Ödemeye geç · tutar"); sabit fiyat tek ekran (fiyat × adet,
 * ad/telefon, düğme). Toplam yalnız ana düğmededir. Her adımın altı aynıdır: hata satırı (yer önceden ayrılı) + ana düğme.
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
$donation_panel_closed   = ! empty( $donation_panel_model['closed'] );
$donation_panel_unit     = (float) $donation_panel_model['unit_price'];
$donation_panel_qty      = (array) $donation_panel_model['quantity'];
$donation_panel_camp     = (array) $donation_panel_view['campaign'];
$donation_panel_phone    = isset( $donation_panel_model['phone'] ) && is_array( $donation_panel_model['phone'] ) ? $donation_panel_model['phone'] : array();
$donation_panel_steps    = isset( $donation_panel_view['steps'] ) ? (int) $donation_panel_view['steps'] : 2;
$donation_panel_tiers  =isset( $donation_panel_view['impact_tiers'] ) ? (array) $donation_panel_view['impact_tiers'] : array();
$donation_panel_fixed  = ! empty( $donation_panel_view['fixed'] );
$donation_panel_format = static function ( $amount ) use ( $donation_panel_decimals ) {
	$decimals = floor( (float) $amount ) === (float) $amount ? 0 : $donation_panel_decimals;
	return number_format_i18n( (float) $amount, $decimals );
};
$donation_panel_style  = '';
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
$donation_panel_back = '<svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
$donation_panel_tax  = array();
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
		<?php // Tek adımda (sabit fiyat) sayaç çizilmez. ?>
		<?php if ( $donation_panel_steps > 1 && $index <= $donation_panel_steps ) : ?>
			<span class="donation-panel-compact__count donation-panel-num" aria-hidden="true"><?php echo esc_html( $index . '/' . $donation_panel_steps ); ?></span>
		<?php endif; ?>
	</div>
	<?php
};

/**
 * Adımın alt bölgesi: tek hata satırı (yer her zaman ayrılı, kartta yerleşim/yükseklik değişmez; hata düğmenin üstünde görünür).
 *
 * @param int $index Adım (1–2).
 */
$donation_panel_status = static function ( $index ) use ( $donation_panel_key ) {
	?>
	<div class="donation-panel-compact__status">
		<p class="donation-panel-compact__err" id="<?php echo esc_attr( $donation_panel_key . '-e' . $index ); ?>" data-dp-cerr></p>
	</div>
	<?php
};

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
	$live   = isset( $donation_panel_camp['live'] ) && is_array( $donation_panel_camp['live'] ) ? $donation_panel_camp['live'] : array();
	$exact  = isset( $donation_panel_camp['exact'] ) ? (float) $donation_panel_camp['exact'] : (float) $donation_panel_camp['percent'];
	?>
	<div class="donation-panel-compact__camp<?php echo $live && empty( $live['o']['c'] ) ? ' donation-panel-live--static' : ''; ?>" data-dp-ccamp data-zero="<?php echo $zero ? '1' : '0'; ?>"<?php echo $live ? ' data-dp-live-cfg="' . esc_attr( (string) wp_json_encode( $live ) ) . '"' : ''; ?>>
		<p class="donation-panel-compact__nums">
			<span class="donation-panel-compact__sum" data-dp-live-meta>
				<span class="donation-panel-compact__raised donation-panel-num" data-dp-craised-row><b data-dp-craised data-dp-live-raised><?php echo esc_html( (string) $donation_panel_camp['raised'] ); ?></b></span>
				<span class="donation-panel-compact__goal donation-panel-num" data-dp-cgoal><?php /* translators: %s: campaign goal amount ("£1,250 / £3,000"). */ echo esc_html( sprintf( _x( '/ %s', 'Compact donation card: raised of goal', 'woo-donation-popup' ), (string) $donation_panel_camp['goal'] ) ); ?></span>
				<span class="donation-panel-compact__first" data-dp-cfirst data-dp-live-zero="show"<?php echo $zero ? '' : ' hidden'; ?>><?php echo esc_html( (string) $donation_panel_view['first_text'] ); ?></span>
				<span class="donation-panel-compact__donors" data-dp-cdonors data-dp-live-donors data-one="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 1, 'woo-donation-popup' ) ); ?>" data-many="<?php /* translators: %s: number of donors. */ echo esc_attr( _n( '%s supporter', '%s supporters', 2, 'woo-donation-popup' ) ); ?>"<?php echo ! $zero && $donors > 0 ? '' : ' hidden'; ?>><?php /* translators: %s: number of donors. */ echo esc_html( sprintf( _n( '%s supporter', '%s supporters', max( 1, $donors ), 'woo-donation-popup' ), number_format_i18n( $donors ) ) ); ?></span>
			</span>
			<span class="donation-panel-compact__pct donation-panel-num" data-dp-cpct data-dp-live-pct data-dp-live-zero="hide"<?php echo $zero ? ' hidden' : ''; ?>><?php /* translators: %d: percent of goal reached. */ echo esc_html( sprintf( __( '%d%%', 'woo-donation-popup' ), (int) $donation_panel_camp['percent'] ) ); ?></span>
		</p>
		<div class="donation-panel-compact__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) min( 100, (int) $donation_panel_camp['percent'] ) ); ?>"<?php echo ! empty( $donation_panel_camp['vtext'] ) ? ' aria-valuetext="' . esc_attr( (string) $donation_panel_camp['vtext'] ) . '"' : ''; ?> aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>" data-dp-cbar data-dp-live-bar><i class="donation-panel-live__fill" data-dp-live-fill style="--p:<?php echo esc_attr( (string) min( 100.0, max( 0.0, $exact ) ) ); ?>"></i></div>
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
	<form class="donation-panel-compact__form" method="post" action="" novalidate data-dp-cform data-steps="<?php echo esc_attr( (string) $donation_panel_steps ); ?>" data-kind="<?php echo esc_attr( (string) $donation_panel_model['kind'] ); ?>" data-min="<?php echo esc_attr( (string) $donation_panel_model['min'] ); ?>" data-decimals="<?php echo esc_attr( (string) $donation_panel_decimals ); ?>" data-thousand-sep="<?php echo esc_attr( $donation_panel_currency['thousandSeparator'] ); ?>" data-decimal-sep="<?php echo esc_attr( $donation_panel_currency['decimalSeparator'] ); ?>" data-symbol="<?php echo esc_attr( $donation_panel_symbol ); ?>" data-unit="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" data-qty-max="<?php echo esc_attr( (string) (int) $donation_panel_qty['max'] ); ?>"<?php echo $donation_panel_tiers ? ' data-impact="' . esc_attr( (string) wp_json_encode( $donation_panel_tiers ) ) . '"' : ''; ?> data-msg-amount="<?php echo esc_attr__( 'Please enter a donation amount.', 'woo-donation-popup' ); ?>" data-msg-format="<?php echo esc_attr( \DonationPanel\Support\Price::get_ambiguous_amount_message( array( 'decimals' => $donation_panel_decimals ) ) ); ?>" data-msg-min="<?php /* translators: %s: minimum amount. */ echo esc_attr( sprintf( __( 'Minimum amount is %s.', 'woo-donation-popup' ), $donation_panel_format( max( (float) $donation_panel_model['min'], 0.01 ) ) ) ); ?>" data-msg-invalid="<?php esc_attr_e( 'Please check the highlighted fields.', 'woo-donation-popup' ); ?>" data-msg-failed="<?php esc_attr_e( 'Something went wrong. Please try again.', 'woo-donation-popup' ); ?>" data-msg-rate="<?php esc_attr_e( 'Too many attempts. Please wait a moment and try again.', 'woo-donation-popup' ); ?>" data-msg-step="<?php /* translators: 1: current step, 2: number of steps, 3: step name. */ echo esc_attr_x( 'Step %1$d of %2$d: %3$s', 'Compact donation card: screen reader announcement', 'woo-donation-popup' ); ?>" data-label-choose="<?php echo esc_attr_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ); ?>" data-label-next="<?php echo esc_attr_x( 'Continue', 'Donation form: next step button', 'woo-donation-popup' ); ?>">
		<p class="donation-panel-sr" aria-live="polite" data-dp-live></p>
		<div class="donation-panel-compact__stack">

			<?php // Sabit fiyatlı ürün: ayrı tutar adımı yok; fiyat, adet ve bilgiler tek ekranda (aşağıdaki "details" bölümü o ekrandır). ?>
			<?php if ( ! $donation_panel_fixed ) : ?>
			<section class="donation-panel-compact__step is-on" data-dp-cstep="amount" data-step-name="<?php esc_attr_e( 'Amount', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-t1">
				<?php $donation_panel_top( 1, false, false ); ?>
				<?php $donation_panel_campaign(); ?>
				<?php // Tek ek satır: seçilen tutarın etki ifadesi (Etki ifadeleri modülü), yoksa hedefsiz ürünün kısa açıklaması. ?>
				<?php if ( $donation_panel_tiers ) : ?>
					<p class="donation-panel-compact__impact" style="--_lc:1" data-dp-ceffect aria-live="polite"></p>
				<?php elseif ( ! $donation_panel_camp && '' !== (string) $donation_panel_view['impact'] ) : ?>
					<p class="donation-panel-compact__impact"><?php echo esc_html( (string) $donation_panel_view['impact'] ); ?></p>
				<?php endif; ?>
				<?php // Esnek bölge sınıfı sunucuda (:has() seçicisi yok: stil yeniden hesabı ucuz). ?>
				<div class="donation-panel-compact__main donation-panel-compact__main--amounts">
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
				</div>
				<div class="donation-panel-compact__foot">
				<?php $donation_panel_status( 1 ); ?>
				<?php // İlk durum sunucuda çizilir (betik yüklenince metin/genişlik değişmesin: CLS 0): tutar seçilmemişken pasif "Tutar seçin". ?>
				<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta is-pending" type="submit" aria-disabled="true" data-dp-cnext><span data-dp-cnext-label><?php echo esc_html_x( 'Choose an amount', 'Donation form: disabled button while no amount is chosen', 'woo-donation-popup' ); ?></span></button>
				</div>
			</section>
			<?php endif; ?>

			<?php // Sabit fiyatta bu bölüm TEK ekrandır ("amount" adı, ilk ekran): fiyat × adet = toplam tek ince satırda, hemen altında bilgiler. ?>
			<section class="donation-panel-compact__step<?php echo $donation_panel_fixed ? ' is-on donation-panel-compact__step--one' : ''; ?>" data-dp-cstep="<?php echo $donation_panel_fixed ? 'amount' : 'details'; ?>" data-step-name="<?php echo $donation_panel_fixed ? esc_attr_x( 'Donation and details', 'Compact donation card: single-screen step name (fixed price product)', 'woo-donation-popup' ) : esc_attr__( 'Your details', 'woo-donation-popup' ); ?>" aria-labelledby="<?php echo esc_attr( $donation_panel_key . ( $donation_panel_fixed ? '-t1' : '-t2' ) ); ?>"<?php echo $donation_panel_fixed ? '' : ' inert aria-hidden="true"'; ?>>
				<?php $donation_panel_top( $donation_panel_fixed ? 1 : 2, ! $donation_panel_fixed, ! $donation_panel_fixed ); ?>
				<?php if ( $donation_panel_fixed ) : ?>
					<?php // Sabit fiyatlı ürün kampanya çubuğu taşımaz (hedefli ürün "kampanya" türüdür: tutar adımlı karttır). ?>
					<?php // Fiyat × adet seçici: tek ince satır (≥48 px dokunma hedefi); toplam yalnız ana düğmede. Adet kapalıysa yalnız fiyat. ?>
					<div class="donation-panel-compact__fixed">
						<span class="donation-panel-compact__priceword"><?php esc_html_e( 'Price', 'woo-donation-popup' ); ?></span>
						<b class="donation-panel-num" data-dp-cunit><?php echo esc_html( $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ); ?></b>
						<?php if ( ! empty( $donation_panel_qty['enabled'] ) ) : ?>
							<span class="donation-panel-compact__times" aria-hidden="true">×</span>
							<div class="donation-panel-stepper" role="group" aria-label="<?php esc_attr_e( 'Quantity', 'woo-donation-popup' ); ?>">
								<button type="button" data-dp-cqty="-1" aria-label="<?php esc_attr_e( 'Decrease', 'woo-donation-popup' ); ?>" disabled><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
								<output class="donation-panel-num" data-dp-cqty-out aria-live="polite">1</output>
								<button type="button" data-dp-cqty="1" aria-label="<?php esc_attr_e( 'Increase', 'woo-donation-popup' ); ?>"><svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
							</div>
						<?php endif; ?>
						<input type="hidden" name="quantity" value="1" data-dp-cqty-in />
						<input type="hidden" name="amount" value="<?php echo esc_attr( (string) $donation_panel_unit ); ?>" />
					</div>
					<?php // Tek ince ek satır (384 px'e sığması için en çok biri): etki ifadesi > ürün kısa açıklaması; vergi beyanı varsa ikisi de çizilmez. ?>
					<?php if ( ! $donation_panel_tax && $donation_panel_tiers ) : ?>
						<p class="donation-panel-compact__impact" style="--_lc:1" data-dp-ceffect aria-live="polite"></p>
					<?php elseif ( ! $donation_panel_tax && '' !== (string) $donation_panel_view['impact'] ) : ?>
						<p class="donation-panel-compact__impact" style="--_lc:1"><?php echo esc_html( (string) $donation_panel_view['impact'] ); ?></p>
					<?php endif; ?>
				<?php endif; ?>
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
													<option value="<?php echo esc_attr( (string) $donation_panel_country['dial'] ); ?>" data-iso="<?php echo esc_attr( (string) $donation_panel_country['iso'] ); ?>"<?php echo (string) $donation_panel_country['iso'] === $donation_panel_iso ? ' selected' : ''; ?>><?php echo esc_html( (string) $donation_panel_country['name'] . ' (+' . (string) $donation_panel_country['dial'] . ')' ); ?></option>
												<?php endforeach; ?>
											</select>
										</span>
									<?php endif; ?>
									<input class="donation-panel-phone__input" id="<?php echo esc_attr( $donation_panel_id ); ?>" name="<?php echo esc_attr( $donation_panel_name ); ?>" type="tel" inputmode="tel" autocomplete="tel" enterkeyhint="next" maxlength="28" data-msg-short="<?php echo esc_attr__( 'This phone number looks incomplete or too long. Please check the digits.', 'woo-donation-popup' ); ?>" data-msg-mobile="<?php echo esc_attr__( 'This does not look like a mobile number. You can still continue.', 'woo-donation-popup' ); ?>" data-msg-length="<?php echo esc_attr__( 'This number has an unusual length for the selected country. Please double-check it; you can still continue.', 'woo-donation-popup' ); ?>" aria-describedby="<?php echo esc_attr( $donation_panel_key ); ?>-e2"<?php echo $donation_panel_req ? ' required aria-required="true" data-required-msg="' . esc_attr( $donation_panel_msg ) . '"' : ''; ?> />
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
						<label class="donation-panel-check donation-panel-check--plain donation-panel-compact__taxcheck">
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
				<?php $donation_panel_status( 2 ); ?>
					<?php // Son adım: sepete ekler ve WooCommerce ödeme sayfasına götürür; toplam yalnız bu düğmede. ?>
					<button class="donation-panel-btn donation-panel-btn--accent donation-panel-compact__cta" type="submit" data-dp-cpay data-label="<?php /* translators: %s: formatted amount. */ esc_attr_e( 'Continue to checkout · %s', 'woo-donation-popup' ); ?>"><span data-dp-cpay-label><?php /* translators: %s: formatted amount. */ echo $donation_panel_fixed ? esc_html( sprintf( __( 'Continue to checkout · %s', 'woo-donation-popup' ), $donation_panel_symbol . $donation_panel_format( $donation_panel_unit ) ) ) : esc_html__( 'Continue to checkout', 'woo-donation-popup' ); ?></span></button>
				</div>
				<?php if ( $donation_panel_tax ) : ?>
					<div class="donation-panel-compact__sheet" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxfull" role="region" aria-labelledby="<?php echo esc_attr( $donation_panel_key ); ?>-taxh" tabindex="-1" inert data-dp-ctax-sheet>
						<h3 class="donation-panel-compact__sheeth" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxh"><?php echo esc_html( (string) $donation_panel_tax['title'] ); ?></h3>
						<p class="donation-panel-compact__sheett" id="<?php echo esc_attr( $donation_panel_key ); ?>-taxtext"><?php echo esc_html( (string) $donation_panel_tax['text'] ); ?></p>
						<button type="button" class="donation-panel-btn donation-panel-btn--ghost donation-panel-compact__sheetx" data-dp-ctax-close><?php echo esc_html_x( 'Done', 'Compact donation card: close the full tax relief declaration', 'woo-donation-popup' ); ?></button>
					</div>
				<?php endif; ?>
			</section>

		</div>
	</form>
<?php endif; ?>
</div>
