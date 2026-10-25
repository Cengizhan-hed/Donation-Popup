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
		$id = 'dp-ac-' . $name;
		return '<div class="dp-ac__field"><label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>'
			. '<input class="dp-ac__input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" type="' . esc_attr( $type ) . '" autocomplete="' . esc_attr( $autocomplete ) . '" required aria-describedby="' . esc_attr( $id ) . '-err"' . ( 'email' === $type ? ' inputmode="email" autocapitalize="none" spellcheck="false"' : '' ) . '>'
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
			$tabs = '<div class="dp-ac__tabs" role="group" aria-label="' . esc_attr__( 'Account', 'woo-donation-popup' ) . '"><button type="button" class="dp-ac__tab" data-dp-acc-view-btn="login" aria-pressed="true">' . esc_html__( 'Log in', 'woo-donation-popup' ) . '</button><button type="button" class="dp-ac__tab" data-dp-acc-view-btn="register" aria-pressed="false">' . esc_html__( 'Sign up', 'woo-donation-popup' ) . '</button></div>';
		}

		$login = '<form class="dp-ac__view" data-dp-acc-view="login" data-dp-acc-form="login" novalidate>'
			. '<p class="dp-ac__sub">' . esc_html__( 'See your gifts and receipts.', 'woo-donation-popup' ) . '</p>'
			. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
			. self::field( 'email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
			. self::field( 'password', __( 'Password', 'woo-donation-popup' ), 'password', 'current-password', __( 'Enter your password.', 'woo-donation-popup' ) )
			. '<p class="dp-ac__links"><button type="button" class="dp-ac__link" data-dp-acc-view-btn="reset">' . esc_html__( 'Forgot password?', 'woo-donation-popup' ) . '</button></p>'
			. '<button type="submit" class="dp-ac__btn dp-ac__btn--primary" data-dp-acc-submit>' . esc_html__( 'Log in', 'woo-donation-popup' ) . '</button></form>';

		$register = '';
		if ( $registration ) {
			$register = '<form class="dp-ac__view" data-dp-acc-view="register" data-dp-acc-form="register" novalidate hidden>'
				. '<p class="dp-ac__sub">' . esc_html__( 'Make your next gift even quicker.', 'woo-donation-popup' ) . '</p>'
				. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
				. self::field( 'reg-email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
				. self::field( 'reg-password', __( 'Password', 'woo-donation-popup' ), 'password', 'new-password', $bad_pass )
				. '<p class="dp-ac__note">' . esc_html__( 'Your earlier guest gifts can be linked to your account by email, after we send a verification link.', 'woo-donation-popup' ) . '</p>'
				. '<button type="submit" class="dp-ac__btn dp-ac__btn--primary" data-dp-acc-submit>' . esc_html__( 'Create account', 'woo-donation-popup' ) . '</button></form>';
		}

		$reset = '<form class="dp-ac__view" data-dp-acc-view="reset" data-dp-acc-form="reset" novalidate hidden>'
			. '<p class="dp-ac__sub">' . esc_html__( 'Enter your email and we will send a link.', 'woo-donation-popup' ) . '</p>'
			. '<div class="dp-ac__error" role="alert" data-dp-acc-error hidden></div>'
			. self::field( 'reset-email', __( 'Email', 'woo-donation-popup' ), 'email', 'email', $bad_email )
			. '<button type="submit" class="dp-ac__btn dp-ac__btn--primary" data-dp-acc-submit>' . esc_html__( 'Send link', 'woo-donation-popup' ) . '</button>'
			. '<p class="dp-ac__links"><button type="button" class="dp-ac__link" data-dp-acc-view-btn="login">' . esc_html__( 'Back to log in', 'woo-donation-popup' ) . '</button></p></form>';

		$sent = '<div class="dp-ac__view dp-ac__sent" data-dp-acc-view="sent" hidden><h3 class="dp-ac__sent-title">' . esc_html__( 'Check your email', 'woo-donation-popup' ) . '</h3>'
			. '<p>' . esc_html__( 'If this email matches an account, a link is on its way. It arrives within a few minutes; if not, check your spam folder.', 'woo-donation-popup' ) . '</p>'
			. '<button type="button" class="dp-ac__btn dp-ac__btn--secondary" data-dp-acc-view-btn="login">' . esc_html__( 'Back to log in', 'woo-donation-popup' ) . '</button></div>';

		return '<div class="dp dp-ac" data-dp-acc' . $data . '>'
			. '<div class="dp-ac__overlay" data-dp-acc-overlay>'
			. '<div class="dp-ac__surface" id="' . esc_attr( self::DIALOG_ID ) . '" role="dialog" aria-modal="true" aria-labelledby="' . esc_attr( self::DIALOG_ID ) . '-title" tabindex="-1" data-dp-acc-surface>'
			. '<div class="dp-ac__handle" aria-hidden="true"></div>'
			. '<div class="dp-ac__head"><h2 class="dp-ac__title" id="' . esc_attr( self::DIALOG_ID ) . '-title" data-dp-acc-title>' . esc_html__( 'Log in to your account', 'woo-donation-popup' ) . '</h2>'
			. '<button type="button" class="dp-ac__close" data-dp-acc-close aria-label="' . esc_attr__( 'Close', 'woo-donation-popup' ) . '"><svg class="dp-ac__ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'
			. '<div class="dp-ac__body">' . $tabs . $login . $register . $reset . $sent . '</div>'
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
	 * Tek bağış kartı.
	 *
	 * @param array<string, mixed> $row Satır.
	 * @return string
	 */
	private static function card( array $row ) {
		$status = isset( $row['status'] ) ? sanitize_html_class( (string) $row['status'] ) : '';
		$meta   = '';
		if ( ! empty( $row['type'] ) ) {
			$meta .= '<span class="dp-ac__tag">' . esc_html( (string) $row['type'] ) . '</span>';
		}
		$meta .= '<span class="dp-ac__tag dp-ac__tag--status dp-ac__tag--' . esc_attr( $status ) . '">' . esc_html( (string) ( isset( $row['status_text'] ) ? $row['status_text'] : '' ) ) . '</span>';
		$extra = '';
		if ( ! empty( $row['dedication'] ) ) {
			/* translators: %s: dedication text typed by the donor. */
			$extra .= '<small class="dp-ac__detail">' . esc_html( sprintf( __( 'In honour of: %s', 'woo-donation-popup' ), (string) $row['dedication'] ) ) . '</small>';
		}
		$actions = '';
		if ( ! empty( $row['receipt_url'] ) ) {
			$actions .= '<a class="dp-ac__btn dp-ac__btn--secondary" href="' . esc_url( (string) $row['receipt_url'] ) . '">' . esc_html__( 'Receipt', 'woo-donation-popup' ) . '</a>';
		}
		if ( ! empty( $row['repeat_url'] ) ) {
			$actions .= '<a class="dp-ac__btn dp-ac__btn--primary" href="' . esc_url( (string) $row['repeat_url'] ) . '">' . esc_html__( 'Give again', 'woo-donation-popup' ) . '</a>';
		}
		return '<article class="dp-ac__card" data-dp-acc-card data-order="' . esc_attr( (string) ( isset( $row['order_id'] ) ? (int) $row['order_id'] : 0 ) ) . '">'
			. '<div class="dp-ac__card-main"><h3 class="dp-ac__card-title">' . esc_html( (string) ( isset( $row['project'] ) ? $row['project'] : '' ) ) . '</h3>'
			. '<span class="dp-ac__card-amt">' . wp_kses_post( (string) ( isset( $row['amount_html'] ) ? $row['amount_html'] : '' ) ) . '</span></div>'
			. '<p class="dp-ac__card-meta">' . $meta . '<span class="dp-ac__date">' . esc_html( (string) ( isset( $row['date'] ) ? $row['date'] : '' ) ) . '</span></p>'
			. $extra
			. ( '' !== $actions ? '<div class="dp-ac__card-actions">' . $actions . '</div>' : '' )
			. '</article>';
	}

	/**
	 * Bağışlarım sayfası gövdesi: bağlama onayı + liste + "daha fazla".
	 *
	 * @param array<int, array<string, mixed>> $rows     İlk sayfa satırları.
	 * @param int                              $pages    Toplam sayfa.
	 * @param array<string, string>            $attrs    Veri öznitelikleri (rest).
	 * @param string                           $link_ui  Bağlama bölümü HTML'i.
	 * @return string
	 */
	public static function donations_page( array $rows, $pages, array $attrs, $link_ui ) {
		$data = '';
		foreach ( $attrs as $name => $value ) {
			$data .= ' data-dp-acc-' . sanitize_key( (string) $name ) . '="' . esc_attr( (string) $value ) . '"';
		}
		$more = $pages > 1 ? '<button type="button" class="dp-ac__btn dp-ac__btn--secondary dp-ac__more" data-dp-acc-more data-page="1" data-pages="' . esc_attr( (string) (int) $pages ) . '">' . esc_html__( 'Show more', 'woo-donation-popup' ) . '</button>' : '';
		return '<div class="dp dp-ac dp-ac--page" data-dp-acc-page' . $data . '>' . $link_ui
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
				. '<button type="button" class="dp-ac__btn dp-ac__btn--primary" data-dp-acc-link-go>' . esc_html__( 'Confirm and link', 'woo-donation-popup' ) . '</button>'
				. '<p class="dp-ac__link-msg" role="status" data-dp-acc-link-msg hidden></p></section>';
		}
		return '<section class="dp-ac__link-box" data-dp-acc-link data-mode="request"><h3>' . esc_html__( 'Gifts made as a guest?', 'woo-donation-popup' ) . '</h3>'
			. '<p>' . esc_html__( 'We will email a verification link to your account address. Only after you confirm are earlier guest gifts added here.', 'woo-donation-popup' ) . '</p>'
			. '<button type="button" class="dp-ac__btn dp-ac__btn--secondary" data-dp-acc-link-go>' . esc_html__( 'Send verification link', 'woo-donation-popup' ) . '</button>'
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
