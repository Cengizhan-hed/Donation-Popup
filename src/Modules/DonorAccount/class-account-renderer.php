<?php
/**
 * Bağışçı hesabı çıktısı: header simgesi, giriş/kayıt/sıfırlama penceresi, Bağışlarım listesi, bağlama onayı.
 *
 * Tüm metinler çevrilebilir ve kaçışlıdır. Tema/oluşturucuya özel seçici yok.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\DonorAccount;

defined( 'ABSPATH' ) || exit;

/**
 * Account_Renderer.
 */
final class Account_Renderer {

	const DIALOG_ID = 'dp-ac-dialog';

	/**
	 * Kişi simgesi.
	 *
	 * @return string
	 */
	private static function icon() {
		return '<svg class="dp-ac__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
	}

	/**
	 * Header simgesi: girişliyse Hesabım bağlantısı, değilse pencereyi açan düğme.
	 *
	 * @param bool   $logged_in   Oturum var mı.
	 * @param string $account_url Hesabım sayfası.
	 * @return string
	 */
	public static function trigger( $logged_in, $account_url ) {
		if ( $logged_in && '' !== $account_url ) {
			return '<a class="dp dp-ac__trigger" href="' . esc_url( $account_url ) . '" aria-label="' . esc_attr__( 'My account', 'woo-donation-popup' ) . '">' . self::icon() . '</a>';
		}
		return '<button type="button" class="dp dp-ac__trigger" data-dp-acc-open aria-haspopup="dialog" aria-expanded="false" aria-controls="' . esc_attr( self::DIALOG_ID ) . '" aria-label="' . esc_attr__( 'Log in or sign up', 'woo-donation-popup' ) . '">' . self::icon() . '</button>';
	}

	/**
	 * Alan: etiket + girdi (+ hata alanı).
	 *
	 * @param string $name         Ad.
	 * @param string $label        Etiket.
	 * @param string $type         Tür.
	 * @param string $autocomplete Otomatik tamamlama.
	 * @param string $error        Hata iletisi.
	 * @return string
	 */
	private static function field( $name, $label, $type, $autocomplete, $error ) {
		$id    = 'dp-ac-' . $name;
		$input = '<input class="dp-ac__input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" type="' . esc_attr( $type ) . '" autocomplete="' . esc_attr( $autocomplete ) . '" required aria-describedby="' . esc_attr( $id ) . '-err"' . ( 'email' === $type ? ' inputmode="email" autocapitalize="none" spellcheck="false"' : '' ) . '>';
		if ( 'password' === $type ) {
			$input = '<span class="dp-ac__pass">' . $input
				. '<button type="button" class="dp-ac__reveal" data-dp-acc-reveal aria-controls="' . esc_attr( $id ) . '" aria-pressed="false" aria-label="' . esc_attr__( 'Show password', 'woo-donation-popup' ) . '" data-label-show="' . esc_attr__( 'Show password', 'woo-donation-popup' ) . '" data-label-hide="' . esc_attr__( 'Hide password', 'woo-donation-popup' ) . '"><svg class="dp-ac__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button></span>';
		}
		return '<div class="dp-ac__field"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>' . $input
			. '<p class="dp-ac__fielderr" id="' . esc_attr( $id ) . '-err" hidden>' . esc_html( $error ) . '</p></div>';
	}

	/**
	 * Giriş / kayıt / şifre sıfırlama penceresi (sayfada bir kez, `wp_footer`).
	 *
	 * @param array<string, string|bool> $attributes Veri öznitelikleri (rest, registration, lost-url ...).
	 * @param bool                       $registration Kayıt açık mı (WooCommerce ayarı).
	 * @return string
	 */
	public static function dialog( array $attributes, $registration ) {
		$data = '';
		foreach ( $attributes as $name => $value ) {
			$data .= ' data-dp-acc-' . sanitize_key( (string) $name ) . '="' . esc_attr( (string) $value ) . '"';
		}
		$bad_email = __( 'Enter a valid email address.', 'woo-donation-popup' );
		$bad_pass  = __( 'Password must be at least 8 characters.', 'woo-donation-popup' );
		$tabs      = '';
		if ( $registration ) {
			$tabs = '<div class="dp-ac__tabs" role="tablist" aria-label="' . esc_attr__( 'Account', 'woo-donation-popup' ) . '"><button type="button" role="tab" class="dp-ac__tab" id="dp-ac-tab-login" data-dp-acc-view-btn="login" aria-selected="true" aria-controls="dp-ac-form-login">' . esc_html__( 'Log in', 'woo-donation-popup' ) . '</button><button type="button" role="tab" class="dp-ac__tab" id="dp-ac-tab-register" data-dp-acc-view-btn="register" aria-selected="false" aria-controls="dp-ac-form-register">' . esc_html__( 'Create account', 'woo-donation-popup' ) . '</button></div>';
		}

		$login = '<form class="dp-ac__view" id="dp-ac-form-login" data-dp-acc-view="login" data-dp-acc-form="login" novalidate>'
			. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
			. self::field( 'email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
			. self::field( 'password', __( 'Password', 'woo-donation-popup' ), 'password', 'current-password', __( 'Enter your password.', 'woo-donation-popup' ) )
			. '<div class="dp-ac__row"><label class="dp-ac__check"><input type="checkbox" name="remember" value="1" checked data-dp-acc-remember>' . esc_html__( 'Remember me', 'woo-donation-popup' ) . '</label>'
			. '<button type="button" class="dp-ac__link" data-dp-acc-view-btn="reset">' . esc_html__( 'Forgot password?', 'woo-donation-popup' ) . '</button></div>'
			. '<button type="submit" class="dpx-btn dpx-btn--primary dp-ac__btn" data-dp-acc-submit>' . esc_html__( 'Log in', 'woo-donation-popup' ) . '</button></form>';

		$register = '';
		if ( $registration ) {
			$register = '<form class="dp-ac__view" id="dp-ac-form-register" data-dp-acc-view="register" data-dp-acc-form="register" novalidate hidden>'
				. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
				. self::field( 'reg-email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
				. self::field( 'reg-password', __( 'Password', 'woo-donation-popup' ), 'password', 'new-password', $bad_pass )
				. '<button type="submit" class="dpx-btn dpx-btn--primary dp-ac__btn" data-dp-acc-submit>' . esc_html__( 'Create account', 'woo-donation-popup' ) . '</button></form>';
		}

		$reset = '<form class="dp-ac__view" data-dp-acc-view="reset" data-dp-acc-form="reset" novalidate hidden>'
			. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
			. self::field( 'reset-email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
			. '<button type="submit" class="dpx-btn dpx-btn--primary dp-ac__btn" data-dp-acc-submit>' . esc_html__( 'Send link', 'woo-donation-popup' ) . '</button>'
			. '<p class="dp-ac__links"><button type="button" class="dp-ac__link" data-dp-acc-view-btn="login">' . esc_html__( 'Back to log in', 'woo-donation-popup' ) . '</button></p></form>';

		$sent = '<div class="dp-ac__view dp-ac__sent" data-dp-acc-view="sent" hidden><h3 class="dp-ac__sent-title">' . esc_html__( 'Check your email', 'woo-donation-popup' ) . '</h3>'
			. '<p>' . esc_html__( 'If this email matches an account, a link is on its way. It arrives within a few minutes; if not, check your spam folder.', 'woo-donation-popup' ) . '</p>'
			. '<button type="button" class="dpx-btn dpx-btn--outline dp-ac__btn" data-dp-acc-view-btn="login">' . esc_html__( 'Back to log in', 'woo-donation-popup' ) . '</button></div>';

		$guard = '<div class="dp-ac__guard" data-dp-acc-guard><svg class="dp-ac__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg><span>' . esc_html__( 'Gifts you made earlier with this email are added to your account automatically once you verify your email.', 'woo-donation-popup' ) . '</span></div>';

		return '<div class="dp dp-ac" data-dp-acc' . $data . '>'
			. '<div class="dp-ac__overlay" data-dp-acc-overlay>'
			. '<div class="dp-ac__surface" id="' . esc_attr( self::DIALOG_ID ) . '" role="dialog" aria-modal="true" aria-labelledby="' . esc_attr( self::DIALOG_ID ) . '-title" tabindex="-1" data-dp-acc-surface>'
			. '<div class="dp-ac__handle" aria-hidden="true"></div>'
			. '<div class="dp-ac__head"><h2 class="dp-ac__title" id="' . esc_attr( self::DIALOG_ID ) . '-title" data-dp-acc-title>' . esc_html__( 'Welcome', 'woo-donation-popup' ) . '</h2>'
			. '<button type="button" class="dp-ac__close" data-dp-acc-close aria-label="' . esc_attr__( 'Close', 'woo-donation-popup' ) . '"><svg class="dp-ac__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
			. '<div class="dp-ac__body"><p class="dp-ac__lead" data-dp-acc-lead>' . esc_html( (string) ( isset( $attributes['lead-login'] ) ? $attributes['lead-login'] : '' ) ) . '</p>' . $tabs . $login . $register . $reset . $sent . $guard . '</div>'
			. '</div></div></div>';
	}

	/**
	 * Bağışlarım listesi (satır kartları).
	 *
	 * @param array<int, array<string, mixed>> $rows Satırlar (Donation_History).
	 * @return string
	 */
	public static function donations( array $rows ) {
		if ( empty( $rows ) ) {
			return '<div class="dp-ac__empty"><h3>' . esc_html__( 'No gifts yet', 'woo-donation-popup' ) . '</h3><p>' . esc_html__( 'Your gifts will appear here after your first donation.', 'woo-donation-popup' ) . '</p></div>';
		}
		$html = '';
		foreach ( $rows as $row ) {
			$html .= self::card( $row );
		}
		return $html;
	}

	/**
	 * Tek bağış kartı (onaylı tasarım Bagislarim.dc.html): küçük görsel, ad, tutar, durum hapı, kampanya ilerlemesi, eylemler.
	 *
	 * @param array<string, mixed> $row Satır.
	 * @return string
	 */
	private static function card( array $row ) {
		$status = isset( $row['status'] ) ? sanitize_html_class( (string) $row['status'] ) : '';
		$tone   = isset( $row['tone'] ) && in_array( $row['tone'], array( 'ok', 'wait', 'bad' ), true ) ? (string) $row['tone'] : 'wait';
		$sub    = array();
		if ( ! empty( $row['date'] ) ) {
			$sub[] = (string) $row['date'];
		}
		if ( ! empty( $row['type'] ) ) {
			$sub[] = (string) $row['type'];
		}
		if ( ! empty( $row['dedication'] ) ) {
			/* translators: %s: dedication text typed by the donor. */
			$sub[] = sprintf( __( 'In honour of: %s', 'woo-donation-popup' ), (string) $row['dedication'] );
		}
		$thumb = ! empty( $row['image'] )
			? '<img class="dp-ac__thumb" src="' . esc_url( (string) $row['image'] ) . '" alt="" loading="lazy" width="52" height="52">'
			: '<span class="dp-ac__thumb dp-ac__thumb--ph" aria-hidden="true"><svg class="dp-ac__ico" viewBox="0 0 24 24" focusable="false"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span>';
		$pill  = '<span class="dp-ac__pill dp-ac__pill--' . esc_attr( $tone ) . ' dp-ac__tag--' . esc_attr( $status ) . '"><span class="dp-ac__dot" aria-hidden="true"></span>' . esc_html( (string) ( isset( $row['status_text'] ) ? $row['status_text'] : '' ) ) . '</span>';

		$progress = '';
		if ( isset( $row['campaign'] ) && is_numeric( $row['campaign'] ) ) {
			$percent  = max( 0.0, min( 100.0, (float) $row['campaign'] ) );
			$label    = sprintf( /* translators: %s: percentage number, for example 62. */ __( '%s%%', 'woo-donation-popup' ), number_format_i18n( $percent, 0 ) );
			$progress = '<div class="dp-ac__progress"><div class="dp-ac__progress-row"><span>' . esc_html__( 'Campaign progress', 'woo-donation-popup' ) . '</span><b>' . esc_html( $label ) . '</b></div>'
				. '<div class="dpx-track dp-ac__track" role="img" aria-label="' . esc_attr( sprintf( /* translators: %s: percentage, for example 62%. */ __( 'Campaign progress: %s', 'woo-donation-popup' ), $label ) ) . '"><i class="dpx-track__brand" style="inline-size:' . esc_attr( (string) round( $percent, 1 ) ) . '%"></i></div></div>';
		}

		$actions = '';
		if ( ! empty( $row['video_url'] ) ) {
			$actions .= '<a class="dpx-btn dpx-btn--outline dpx-btn--sm" data-dp-acc-video href="' . esc_url( (string) $row['video_url'] ) . '" rel="noopener">' . esc_html__( 'Video', 'woo-donation-popup' ) . '</a>';
		}
		if ( ! empty( $row['receipt_url'] ) ) {
			$actions .= '<a class="dpx-btn dpx-btn--outline dpx-btn--sm" data-dp-acc-receipt href="' . esc_url( (string) $row['receipt_url'] ) . '">' . esc_html__( 'Receipt', 'woo-donation-popup' ) . '</a>';
		}
		if ( ! empty( $row['repeat_url'] ) ) {
			$instant  = ! empty( $row['can_repeat'] ) && ! empty( $row['product_id'] ) && ! empty( $row['amount'] );
			$actions .= '<a class="dpx-btn dpx-btn--primary dpx-btn--sm" data-dp-acc-repeat href="' . esc_url( (string) $row['repeat_url'] ) . '"'
				. ( $instant ? ' data-product="' . esc_attr( (string) (int) $row['product_id'] ) . '" data-amount="' . esc_attr( (string) $row['amount'] ) . '"' : '' ) . '>' . esc_html__( 'Give again', 'woo-donation-popup' ) . '</a>';
		}
		return '<article class="dp-ac__card" data-dp-acc-card data-order="' . esc_attr( (string) ( isset( $row['order_id'] ) ? (int) $row['order_id'] : 0 ) ) . '">'
			. '<div class="dp-ac__card-main">' . $thumb
			. '<div class="dp-ac__card-text"><h3 class="dp-ac__card-title">' . esc_html( (string) ( isset( $row['project'] ) ? $row['project'] : '' ) ) . '</h3>'
			. '<span class="dp-ac__card-sub">' . esc_html( implode( ' · ', $sub ) ) . '</span></div>'
			. '<span class="dp-ac__card-amt">' . wp_kses_post( (string) ( isset( $row['amount_html'] ) ? $row['amount_html'] : '' ) ) . '</span></div>'
			. '<div class="dp-ac__card-meta">' . $pill . '</div>'
			. $progress
			. ( '' !== $actions ? '<div class="dp-ac__card-actions">' . $actions . '</div>' : '' )
			. '</article>';
	}

	/**
	 * Bağışlarım üst paneli: baş harfler, ad ve üç özet kutusu (toplam / bağış / bu yıl).
	 *
	 * @param array<string, string> $header `name`, `initials`, `total_html`, `count`, `year_html` (boşsa panel çizilmez).
	 * @return string
	 */
	private static function summary_header( array $header ) {
		if ( empty( $header['name'] ) ) {
			return '';
		}
		$stat = static function ( $label, $value_html ) {
			return '<div class="dp-ac__stat"><span>' . esc_html( $label ) . '</span><b class="dp-num">' . wp_kses_post( $value_html ) . '</b></div>';
		};
		return '<header class="dp-ac__hero"><div class="dp-ac__hero-user"><span class="dp-ac__avatar" aria-hidden="true">' . esc_html( isset( $header['initials'] ) ? (string) $header['initials'] : '' ) . '</span>'
			. '<div class="dp-ac__hero-name"><span>' . esc_html__( 'Welcome', 'woo-donation-popup' ) . '</span><b>' . esc_html( (string) $header['name'] ) . '</b></div></div>'
			. '<div class="dp-ac__stats">' . $stat( __( 'Total', 'woo-donation-popup' ), isset( $header['total_html'] ) ? (string) $header['total_html'] : '' )
			. $stat( __( 'Donations', 'woo-donation-popup' ), isset( $header['count'] ) ? (string) $header['count'] : '0' )
			. $stat( __( 'This year', 'woo-donation-popup' ), isset( $header['year_html'] ) ? (string) $header['year_html'] : '' ) . '</div></header>';
	}

	/**
	 * Bağışlarım sayfası gövdesi: bağlama onayı + liste + "daha fazla".
	 *
	 * @param array<int, array<string, mixed>> $rows     İlk sayfa satırları.
	 * @param int                              $pages    Toplam sayfa.
	 * @param array<string, string>            $attrs    Veri öznitelikleri (rest).
	 * @param string                           $link_ui  Bağlama bölümü HTML'i.
	 * @param array<string, string>            $header   Üst panel verisi (summary_header).
	 * @return string
	 */
	public static function donations_page( array $rows, $pages, array $attrs, $link_ui, array $header = array() ) {
		$data = '';
		foreach ( $attrs as $name => $value ) {
			$data .= ' data-dp-acc-' . sanitize_key( (string) $name ) . '="' . esc_attr( (string) $value ) . '"';
		}
		$more = $pages > 1 ? '<button type="button" class="dpx-btn dpx-btn--outline dp-ac__more" data-dp-acc-more data-page="1" data-pages="' . esc_attr( (string) (int) $pages ) . '">' . esc_html__( 'Show more', 'woo-donation-popup' ) . '</button>' : '';
		return '<div class="dp dp-ac dp-ac--page" data-dp-acc-page' . $data . '>' . self::summary_header( $header ) . $link_ui
			. '<h2 class="dp-ac__heading">' . esc_html__( 'My donations', 'woo-donation-popup' ) . '</h2>'
			. '<div class="dp-ac__list" data-dp-acc-list aria-live="polite">' . self::donations( $rows ) . '</div>' . $more . '</div>';
	}

	/**
	 * Misafir bağışlarını bağlama bölümü: istek düğmesi ya da (bağlantıdan gelince) onay düğmesi.
	 *
	 * @param string $mode  `request` | `confirm`.
	 * @param string $token Onay belirteci (yalnız `confirm`).
	 * @return string
	 */
	public static function link_section( $mode, $token = '' ) {
		if ( 'confirm' === $mode ) {
			return '<section class="dp-ac__link-box" data-dp-acc-link data-mode="confirm" data-token="' . esc_attr( $token ) . '"><h3>' . esc_html__( 'Link your earlier gifts', 'woo-donation-popup' ) . '</h3>'
				. '<p>' . esc_html__( 'Confirm to add the gifts you made as a guest with this email address to your account.', 'woo-donation-popup' ) . '</p>'
				. '<button type="button" class="dpx-btn dpx-btn--primary" data-dp-acc-link-go>' . esc_html__( 'Confirm and link', 'woo-donation-popup' ) . '</button>'
				. '<p class="dp-ac__link-msg" role="status" data-dp-acc-link-msg hidden></p></section>';
		}
		return '<section class="dp-ac__link-box" data-dp-acc-link data-mode="request"><h3>' . esc_html__( 'Gifts made as a guest?', 'woo-donation-popup' ) . '</h3>'
			. '<p>' . esc_html__( 'We will email a verification link to your account address. Only after you confirm are earlier guest gifts added here.', 'woo-donation-popup' ) . '</p>'
			. '<button type="button" class="dpx-btn dpx-btn--outline" data-dp-acc-link-go>' . esc_html__( 'Send verification link', 'woo-donation-popup' ) . '</button>'
			. '<p class="dp-ac__link-msg" role="status" data-dp-acc-link-msg hidden></p></section>';
	}

	/**
	 * Ödeme sayfası: hesap oluşturma açıklaması (kayıt kutusunu WooCommerce çizer).
	 *
	 * @return string
	 */
	public static function checkout_note() {
		return '<p class="dp dp-ac__checkout-note">' . esc_html__( 'Create an account with the box below to track your gifts, download receipts and give again in one tap. Earlier guest gifts are linked only after email verification.', 'woo-donation-popup' ) . '</p>';
	}
}
