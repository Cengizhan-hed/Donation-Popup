<?php
/**
 * Yönetici alt sayfalarının çıktısı: Genel Bakış, Kampanyalar, Formlar ve Görünüm, Sepet ve Ödeme,
 * Bağışçı Hesabı, Gizlilik, Araçlar. Ayarlar REST ile (Admin_Controller) kaydedilir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Pages.
 */
final class Pages {

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Ayar deposu.
	 *
	 * @var Settings_Store
	 */
	private $store;

	/**
	 * Durum hesapları.
	 *
	 * @var Status
	 */
	private $status;

	/**
	 * Kurucu.
	 *
	 * @param Settings       $settings Ayarlar.
	 * @param Settings_Store $store    Ayar deposu.
	 */
	public function __construct( Settings $settings, Settings_Store $store ) {
		$this->settings = $settings;
		$this->store    = $store;
		$this->status   = new Status( $settings );
	}

	/**
	 * Yetkiyi denetler (menü zaten yetkiye bağlıdır; doğrudan çağrıya karşı ikinci kilit).
	 *
	 * @return void
	 */
	private function guard() {
		if ( ! current_user_can( Admin_Bootstrap::CAPABILITY ) ) {
			wp_die( esc_html__( 'You do not have permission to open this page.', 'woo-donation-popup' ), '', array( 'response' => 403 ) );
		}
	}

	/**
	 * Bir modül grubunu satır satır çizer.
	 *
	 * @param string[] $slugs Modül slug'ları.
	 * @return string
	 */
	private function module_rows( array $slugs ) {
		$defs = Settings_Store::module_definitions();
		$html = '';
		foreach ( $slugs as $slug ) {
			if ( isset( $defs[ $slug ] ) ) {
				$html .= Admin_View::module_row( $slug, $defs[ $slug ][0], $defs[ $slug ][1], $this->store->module_enabled( $slug ) );
			}
		}
		return $html;
	}

	/**
	 * Bir sayfanın alan kartlarını çizer (bölüm başına bir kart).
	 *
	 * @param string $page Sayfa slug'ı.
	 * @return string
	 */
	private function field_cards( $page ) {
		$fields = Field_Registry::fields_for( $page );
		$html   = '';
		foreach ( Field_Registry::sections( $page ) as $section => $head ) {
			$body = '';
			foreach ( $fields as $id => $spec ) {
				if ( $spec['section'] !== $section ) {
					continue;
				}
				$value = $this->store->get( $id );
				if ( 'cards' === $spec['type'] ) {
					$body .= Admin_View::cards( $id, $spec['options'], (string) $value, $spec['label'] );
					continue;
				}
				$row = Admin_View::field( $id, $spec, $value );
				if ( isset( $spec['only_when'] ) ) {
					$row = '<div data-dpa-when="' . esc_attr( $spec['only_when'][0] . '=' . $spec['only_when'][1] ) . '">' . $row . '</div>';
				}
				if ( isset( $spec['confirm'] ) ) {
					$row = str_replace( 'data-dpa-field="' . esc_attr( $id ) . '"', 'data-dpa-field="' . esc_attr( $id ) . '" data-dpa-confirm="' . esc_attr( $spec['confirm'] ) . '"', $row );
				}
				$body .= $row;
				if ( 'design.colors' === $id ) {
					$status = \DonationPanel\Frontend\Theme_Colors::source_status();
					$vars   = \DonationPanel\Frontend\Theme_Colors::variables( \DonationPanel\Frontend\Theme_Colors::site_palette() );
					$body  .= '<div data-dpa-when="design.colors=theme">' . Admin_View::colors_note( $status, $vars ) . '</div>';
				}
			}
			if ( '' !== $body ) {
				$html .= Admin_View::card( $head[0], $body, 'dpa-card--section', $head[1] );
			}
		}
		return $html;
	}

	/**
	 * Genel Bakış.
	 *
	 * @return void
	 */
	public function render_overview() {
		$this->guard();
		$steps = $this->status->steps();
		$done  = count( array_filter( array_column( $steps, 'ok' ) ) );
		$total = count( $steps );
		$pct   = (int) round( $done / $total * 100 );
		$todo  = array();
		foreach ( $steps as $step ) {
			if ( ! $step['ok'] ) {
				$todo[] = $step['todo'];
			}
		}
		$wizard_open = 'done' !== (string) $this->settings->get( 'admin.wizard', '' );

		if ( $done === $total ) {
			$title = __( 'Setup is complete', 'woo-donation-popup' );
			$text  = __( 'Everything is in place. You can change any setting later.', 'woo-donation-popup' );
		} else {
			$title = $done >= 4 ? __( 'Setup is almost complete', 'woo-donation-popup' ) : __( 'Let\'s finish setting up', 'woo-donation-popup' );
			/* translators: %s: list of remaining steps. */
			$text = sprintf( __( 'Remaining: %s.', 'woo-donation-popup' ), implode( ', ', $todo ) );
		}

		$html  = Admin_View::open( Admin_Bootstrap::SLUG_OVERVIEW, __( 'Donation Panel', 'woo-donation-popup' ), __( 'Your whole donation experience in one place.', 'woo-donation-popup' ) );
		$html .= '<section class="dpa-card dpa-progress"><div class="dpa-ring" style="--dpa-pct:' . (int) $pct . '%" role="img" aria-label="' . esc_attr( sprintf( /* translators: 1: done steps, 2: total steps. */ __( '%1$d of %2$d setup steps done', 'woo-donation-popup' ), $done, $total ) ) . '"><span>' . (int) $done . '/' . (int) $total . '</span></div>';
		$html .= '<div class="dpa-progress__text"><h2>' . esc_html( $title ) . '</h2><p>' . esc_html( $text ) . '</p></div>';
		if ( $wizard_open ) {
			$html .= '<a class="dpa-btn dpa-btn--accent" href="' . esc_url( Admin_View::url( Admin_Bootstrap::SLUG_WIZARD ) ) . '">' . esc_html__( 'Continue the quick setup', 'woo-donation-popup' ) . '</a>';
		}
		$html .= '</section>';

		$html .= '<div class="dpa-grid">';
		$html .= Admin_View::card( __( 'Modules', 'woo-donation-popup' ), '<div class="dpa-mods">' . $this->module_rows( array_keys( Settings_Store::module_definitions() ) ) . '</div>', 'dpa-card--modules' );

		$list = '';
		foreach ( $this->status->items() as $item ) {
			$list .= Admin_View::status_row( $item['ok'], $item['text'], $item['url'], $item['link'] );
		}
		$html .= Admin_View::card( __( 'Status', 'woo-donation-popup' ), '<ul class="dpa-statuses">' . $list . '</ul>', 'dpa-card--status' );
		$html .= '</div>' . Admin_View::close();

		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Admin_View kaçışlıdır.
	}

	/**
	 * Kampanyalar.
	 *
	 * @return void
	 */
	public function render_campaigns() {
		$this->guard();
		$html = Admin_View::open( Admin_Bootstrap::SLUG_CAMPAIGNS, __( 'Campaigns', 'woo-donation-popup' ), __( 'Products with a goal. Set a goal on the product\'s Donation tab.', 'woo-donation-popup' ) );

		$rows     = '';
		$symbol   = function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ) : '';
		$date_fmt = (string) get_option( 'date_format', 'Y-m-d' );
		foreach ( $this->status->campaign_ids( 50 ) as $id ) {
			$r     = $this->status->campaign_row( $id );
			$goal  = function_exists( 'wc_price' ) ? wp_strip_all_tags( (string) wc_price( $r['goal'] ) ) : (string) $r['goal'];
			$got   = function_exists( 'wc_price' ) ? wp_strip_all_tags( (string) wc_price( $r['raised'] ) ) : (string) $r['raised'];
			$title = '' !== $r['title'] ? $r['title'] : __( '(no title)', 'woo-donation-popup' );
			$since = null === $r['start'] ? __( 'The beginning', 'woo-donation-popup' ) : wp_date( $date_fmt, (int) $r['start'] );
			$cid   = 'dpa-carried-' . (int) $r['id'];
			$mid   = 'dpa-manual-' . (int) $r['id'];
			$rows .= '<tr><th scope="row"><a href="' . esc_url( $r['edit'] ) . '">' . esc_html( $title ) . '</a></th>'
				. '<td data-label="' . esc_attr__( 'Goal', 'woo-donation-popup' ) . '">' . esc_html( html_entity_decode( $goal, ENT_QUOTES, 'UTF-8' ) ) . '</td>'
				. '<td data-label="' . esc_attr__( 'Raised', 'woo-donation-popup' ) . '"><span data-dpa-stored="' . (int) $r['id'] . '">' . esc_html( html_entity_decode( $got, ENT_QUOTES, 'UTF-8' ) ) . '</span>'
				. '<span class="dpa-pending" data-dpa-pending="' . (int) $r['id'] . '"' . ( $r['pending'] ? '' : ' hidden' ) . '>' . esc_html__( 'Total not calculated yet. Recalculate to count the earlier donations.', 'woo-donation-popup' ) . '</span></td>'
				. '<td data-label="' . esc_attr__( 'Carried over', 'woo-donation-popup' ) . '"><span class="dpa-carried">'
				. '<label class="screen-reader-text" for="' . esc_attr( $cid ) . '">' . esc_html( sprintf( /* translators: %s: product name. */ __( 'Carried-over amount for %s', 'woo-donation-popup' ), $title ) ) . '</label>'
				. ( '' !== $symbol ? '<span aria-hidden="true">' . esc_html( $symbol ) . '</span>' : '' )
				. '<input class="dpa-input dpa-input--short" type="number" inputmode="decimal" min="0" step="0.01" id="' . esc_attr( $cid ) . '" value="' . esc_attr( (string) $r['carried'] ) . '" data-dpa-carried="' . (int) $r['id'] . '">'
				. '<button type="button" class="dpa-btn dpa-btn--small" data-dpa-carried-save="' . (int) $r['id'] . '">' . esc_html__( 'Save', 'woo-donation-popup' ) . '</button></span></td>'
				. '<td data-label="' . esc_attr__( 'Added by hand', 'woo-donation-popup' ) . '"><span class="dpa-carried">'
				. '<label class="screen-reader-text" for="' . esc_attr( $mid ) . '">' . esc_html( sprintf( /* translators: %s: product name. */ __( 'Amount added by hand for %s', 'woo-donation-popup' ), $title ) ) . '</label>'
				. ( '' !== $symbol ? '<span aria-hidden="true">' . esc_html( $symbol ) . '</span>' : '' )
				. '<input class="dpa-input dpa-input--short" type="number" inputmode="decimal" min="0" step="0.01" id="' . esc_attr( $mid ) . '" value="' . esc_attr( (string) $r['manual'] ) . '" data-dpa-manual="' . (int) $r['id'] . '">'
				. '<button type="button" class="dpa-btn dpa-btn--small" data-dpa-manual-save="' . (int) $r['id'] . '">' . esc_html__( 'Save', 'woo-donation-popup' ) . '</button></span></td>'
				. '<td data-label="' . esc_attr__( 'Counting since', 'woo-donation-popup' ) . '">' . esc_html( $since ) . '</td>'
				. '<td data-label="' . esc_attr__( 'Progress', 'woo-donation-popup' ) . '"><span class="dpa-bar" role="img" aria-label="' . esc_attr( sprintf( /* translators: %d: percent. */ __( '%d percent of the goal', 'woo-donation-popup' ), $r['percent'] ) ) . '"><i style="width:' . (int) $r['percent'] . '%"></i></span> <span class="dpa-bar__n">' . (int) $r['percent'] . '%</span></td>'
				. '<td data-label="' . esc_attr__( 'Status', 'woo-donation-popup' ) . '">' . Admin_View::badge( $this->status_label( $r['status'] ), 'publish' === $r['status'] ? 'success' : 'neutral' )
				. '<span class="dpa-recalc-slot" data-product="' . (int) $r['id'] . '"><button type="button" class="dpa-btn dpa-btn--small" data-dpa-recalc-open="' . (int) $r['id'] . '" aria-expanded="false" aria-controls="dpa-recalc-' . (int) $r['id'] . '">' . esc_html__( 'Recalculate', 'woo-donation-popup' ) . '</button></span></td></tr>'
				. $this->recalc_row( (int) $r['id'], $r['start'], $title );
		}
		if ( '' === $rows ) {
			$body = '<p class="dpa-empty">' . esc_html__( 'No campaigns yet. Open a product, choose the Donation tab and set a goal amount.', 'woo-donation-popup' ) . '</p>';
		} else {
			$body = '<div class="dpa-tablewrap"><table class="dpa-table"><thead><tr><th scope="col">' . esc_html__( 'Product', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Goal', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Raised', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Carried over', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Added by hand', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Counting since', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Progress', 'woo-donation-popup' ) . '</th><th scope="col">' . esc_html__( 'Status', 'woo-donation-popup' ) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div>';
		}
		$body .= '<p><a class="dpa-btn dpa-btn--ghost" href="' . esc_url( admin_url( 'post-new.php?post_type=product' ) ) . '">' . esc_html__( 'Add a product', 'woo-donation-popup' ) . '</a></p>';
		$html .= Admin_View::card( __( 'Campaign products', 'woo-donation-popup' ), $body, '', __( 'Raised = carried-over amount + paid donations since the campaign started + the amount added by hand in this table. Recalculating shows a preview first and changes nothing until you approve it.', 'woo-donation-popup' ) );
		$html .= Admin_View::card( __( 'Modules', 'woo-donation-popup' ), '<div class="dpa-mods">' . $this->module_rows( array( 'campaign', 'impact', 'social_proof' ) ) . '</div>' );
		$html .= $this->field_cards( Admin_Bootstrap::SLUG_CAMPAIGNS );
		$html .= Admin_View::savebar() . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * "Yeniden hesapla" paneli (gizli satır): tarih aralığı -> önizleme -> onay. Yazma yalnız onayla (REST).
	 *
	 * @param int      $id    Ürün.
	 * @param int|null $start Kampanya başlangıcı (Unix) ya da null.
	 * @param string   $title Ürün adı.
	 * @return string
	 */
	private function recalc_row( $id, $start, $title ) {
		$from = null === $start ? '' : wp_date( 'Y-m-d', (int) $start );
		return '<tr class="dpa-recalc-row" id="dpa-recalc-' . (int) $id . '" data-dpa-recalc="' . (int) $id . '" hidden><td colspan="8"><div class="dpa-recalc">'
			. '<p class="dpa-row__help">' . esc_html( sprintf( /* translators: %s: product name. */ __( 'Recalculate "%s": carried-over amount plus paid donations in the dates you choose. Nothing changes until you approve the preview.', 'woo-donation-popup' ), $title ) ) . '</p>'
			. '<div class="dpa-recalc__form">'
			. '<label>' . esc_html__( 'Count donations from', 'woo-donation-popup' ) . ' <input class="dpa-input" type="date" data-dpa-recalc-from value="' . esc_attr( $from ) . '"></label>'
			. '<label>' . esc_html__( 'Until (optional)', 'woo-donation-popup' ) . ' <input class="dpa-input" type="date" data-dpa-recalc-to></label>'
			. '<button type="button" class="dpa-btn dpa-btn--ghost" data-dpa-recalc-preview>' . esc_html__( 'Preview', 'woo-donation-popup' ) . '</button>'
			. '</div>'
			. '<div class="dpa-recalc__result" data-dpa-recalc-result aria-live="polite" hidden>'
			. '<dl class="dpa-recalc__list">'
			. '<div><dt>' . esc_html__( 'Stored total', 'woo-donation-popup' ) . '</dt><dd data-dpa-r="stored"></dd></div>'
			. '<div><dt>' . esc_html__( 'Calculated total', 'woo-donation-popup' ) . '</dt><dd data-dpa-r="computed"></dd></div>'
			. '<div><dt>' . esc_html__( 'Difference', 'woo-donation-popup' ) . '</dt><dd data-dpa-r="diff"></dd></div>'
			. '<div><dt>' . esc_html__( 'Orders counted', 'woo-donation-popup' ) . '</dt><dd data-dpa-r="orders"></dd></div>'
			. '</dl>'
			. '<p class="dpa-row__help" data-dpa-r="note"></p>'
			. '<button type="button" class="dpa-btn dpa-btn--primary" data-dpa-recalc-apply disabled>' . esc_html__( 'Apply this total', 'woo-donation-popup' ) . '</button>'
			. '</div></div></td></tr>';
	}

	/**
	 * Ürün yazı durumu etiketi.
	 *
	 * @param string $status WP yazı durumu.
	 * @return string
	 */
	private function status_label( $status ) {
		$map = array(
			'publish' => __( 'Live', 'woo-donation-popup' ),
			'draft'   => __( 'Draft', 'woo-donation-popup' ),
			'private' => __( 'Private', 'woo-donation-popup' ),
			'pending' => __( 'Pending review', 'woo-donation-popup' ),
		);
		return isset( $map[ $status ] ) ? $map[ $status ] : $status;
	}

	/**
	 * Formlar ve Görünüm.
	 *
	 * @return void
	 */
	public function render_forms() {
		$this->guard();
		$html  = Admin_View::open( Admin_Bootstrap::SLUG_FORMS, __( 'Forms and appearance', 'woo-donation-popup' ), __( 'How the donation form looks and where the donate button appears.', 'woo-donation-popup' ) );
		$html .= $this->field_cards( Admin_Bootstrap::SLUG_FORMS );
		$html .= Admin_View::savebar() . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Sepet ve Ödeme.
	 *
	 * @return void
	 */
	public function render_checkout() {
		$this->guard();
		$checkout = $this->status->checkout_page();
		$info     = '<ul class="dpa-statuses">' . Admin_View::status_row( $checkout['ok'], $checkout['label'], admin_url( 'admin.php?page=wc-settings&tab=advanced' ), __( 'Fix', 'woo-donation-popup' ) );
		$guest    = $this->status->guest_checkout_enabled();
		$info    .= Admin_View::status_row( $guest, $guest ? __( 'Guest checkout is on', 'woo-donation-popup' ) : __( 'Guest checkout is off: donors must create an account to give', 'woo-donation-popup' ), admin_url( 'admin.php?page=wc-settings&tab=account' ), __( 'Open WooCommerce settings', 'woo-donation-popup' ) ) . '</ul>';
		$info    .= '<p class="dpa-row__help">' . esc_html__( 'Payment methods, taxes and currency are set in WooCommerce. Donation Panel works with both the block and the classic checkout.', 'woo-donation-popup' ) . '</p>';

		$html  = Admin_View::open( Admin_Bootstrap::SLUG_CHECKOUT, __( 'Cart and checkout', 'woo-donation-popup' ), __( 'What donors see after they choose an amount.', 'woo-donation-popup' ) );
		$html .= Admin_View::card( __( 'Checkout', 'woo-donation-popup' ), $info );
		$html .= Admin_View::card( __( 'Modules', 'woo-donation-popup' ), '<div class="dpa-mods">' . $this->module_rows( array( 'side_cart', 'thanks', 'tax_relief' ) ) . '</div>' );
		$html .= $this->field_cards( Admin_Bootstrap::SLUG_CHECKOUT );
		$html .= Admin_View::savebar() . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Bağışçı Hesabı.
	 *
	 * @return void
	 */
	public function render_account() {
		$this->guard();
		$rows  = '<ul class="dpa-statuses">';
		$guest = $this->status->guest_checkout_enabled();
		$rows .= Admin_View::status_row( $guest, $guest ? __( 'Guest checkout is on: donors can give without an account', 'woo-donation-popup' ) : __( 'Guest checkout is off: every donor must create an account', 'woo-donation-popup' ), admin_url( 'admin.php?page=wc-settings&tab=account' ), __( 'Open WooCommerce settings', 'woo-donation-popup' ) );
		$reg   = 'yes' === get_option( 'woocommerce_enable_myaccount_registration', 'no' );
		$rows .= Admin_View::status_row( $reg, $reg ? __( 'Registration on My Account is on', 'woo-donation-popup' ) : __( 'Registration on My Account is off: donors cannot create an account themselves', 'woo-donation-popup' ), admin_url( 'admin.php?page=wc-settings&tab=account' ), __( 'Open WooCommerce settings', 'woo-donation-popup' ) );
		$rows .= '</ul><p class="dpa-row__help">' . esc_html__( 'Sign-in, registration and password reset use WordPress and WooCommerce. The plugin never stores passwords. Account options are set in WooCommerce.', 'woo-donation-popup' ) . '</p>';

		$html  = Admin_View::open( Admin_Bootstrap::SLUG_ACCOUNT, __( 'Donor account', 'woo-donation-popup' ), __( 'Optional. Off by default; donors can always give as guests.', 'woo-donation-popup' ) );
		$html .= Admin_View::card( __( 'Donor account', 'woo-donation-popup' ), '<div class="dpa-mods">' . $this->module_rows( array( 'donor_account' ) ) . '</div>', '', __( 'Adds a sign-in icon, a sign-in and register panel, and a "My donations" tab in My Account with receipts and a quick way to give again.', 'woo-donation-popup' ) );
		$html .= Admin_View::card( __( 'WooCommerce account settings', 'woo-donation-popup' ), $rows );
		$html .= Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Gizlilik.
	 *
	 * @return void
	 */
	public function render_privacy() {
		$this->guard();
		$privacy = $this->status->privacy_page_linked();
		$tools   = '<ul class="dpa-statuses">';
		$tools  .= Admin_View::status_row( $privacy, $privacy ? __( 'Privacy policy page is set in WordPress', 'woo-donation-popup' ) : __( 'Privacy policy page is not set in WordPress', 'woo-donation-popup' ), admin_url( 'options-privacy.php' ), __( 'Set it', 'woo-donation-popup' ) );
		$tools  .= Admin_View::status_row( true, __( 'The plugin sets no cookie of its own', 'woo-donation-popup' ) );
		$export  = $this->has_privacy_callbacks( apply_filters( 'wp_privacy_personal_data_exporters', array() ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress çekirdek kancası.
		$erase   = $this->has_privacy_callbacks( apply_filters( 'wp_privacy_personal_data_erasers', array() ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress çekirdek kancası.
		$tools  .= Admin_View::status_row( $export, $export ? __( 'WordPress "Export personal data" includes donor details on orders', 'woo-donation-popup' ) : __( 'Donor details are not part of "Export personal data"', 'woo-donation-popup' ) );
		$tools  .= Admin_View::status_row( $erase, $erase ? __( 'WordPress "Erase personal data" covers donor details on orders', 'woo-donation-popup' ) : __( 'Donor details are not part of "Erase personal data"', 'woo-donation-popup' ) );
		$tools  .= '</ul><p><a class="dpa-btn dpa-btn--ghost" href="' . esc_url( admin_url( 'export-personal-data.php' ) ) . '">' . esc_html__( 'Export personal data', 'woo-donation-popup' ) . '</a> <a class="dpa-btn dpa-btn--ghost" href="' . esc_url( admin_url( 'erase-personal-data.php' ) ) . '">' . esc_html__( 'Erase personal data', 'woo-donation-popup' ) . '</a></p>';

		$html  = Admin_View::open( Admin_Bootstrap::SLUG_PRIVACY, __( 'Privacy', 'woo-donation-popup' ), __( 'Donor details are handled with the WordPress privacy tools.', 'woo-donation-popup' ) );
		$html .= Admin_View::card( __( 'WordPress privacy tools', 'woo-donation-popup' ), $tools, '', __( 'Donor name, dedication, phone and email are saved on the order exactly as typed. Write your privacy text on your own site.', 'woo-donation-popup' ) );
		$html .= $this->field_cards( Admin_Bootstrap::SLUG_PRIVACY );
		$html .= Admin_View::savebar() . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Eklentimizin gizlilik dışa aktarıcı/silici kaydı var mı.
	 *
	 * @param mixed $registered WordPress'in kayıtlı dışa aktarıcı/silici listesi.
	 * @return bool
	 */
	private function has_privacy_callbacks( $registered ) {
		if ( ! is_array( $registered ) ) {
			return false;
		}
		foreach ( array_keys( $registered ) as $key ) {
			if ( false !== strpos( (string) $key, 'donation' ) || false !== strpos( (string) $key, 'wdp' ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Araçlar.
	 *
	 * @return void
	 */
	public function render_tools() {
		$this->guard();
		$html = Admin_View::open( Admin_Bootstrap::SLUG_TOOLS, __( 'Tools', 'woo-donation-popup' ), __( 'Preview, move your settings, and check that everything is working.', 'woo-donation-popup' ) );

		$preview = '<p>' . esc_html__( 'See every module on your site as visitors would, without changing any setting. Only you can see it, and it never saves anything.', 'woo-donation-popup' ) . '</p><p><a class="dpa-btn dpa-btn--primary" target="_blank" rel="noopener" href="' . esc_url( add_query_arg( 'dp_preview', '1', home_url( '/' ) ) ) . '">' . esc_html__( 'Open preview', 'woo-donation-popup' ) . '</a></p>';
		$html   .= Admin_View::card( __( 'Preview', 'woo-donation-popup' ), $preview );

		$move  = '<p>' . esc_html__( 'Export downloads your plugin settings as a file. Import reads such a file. Orders, donors and products are not included.', 'woo-donation-popup' ) . '</p>';
		$move .= '<p><button type="button" class="dpa-btn dpa-btn--ghost" data-dpa-export>' . esc_html__( 'Export settings', 'woo-donation-popup' ) . '</button></p>';
		$move .= '<p><label class="dpa-filebtn"><span class="dpa-btn dpa-btn--ghost">' . esc_html__( 'Import settings', 'woo-donation-popup' ) . '</span><input type="file" accept="application/json,.json" class="screen-reader-text" data-dpa-import></label></p>';
		$html .= Admin_View::card( __( 'Export and import', 'woo-donation-popup' ), $move );

		$html .= $this->field_cards( Admin_Bootstrap::SLUG_TOOLS );

		$diag = $this->diagnostics();
		$text = '';
		foreach ( $diag as $label => $value ) {
			$text .= $label . ': ' . $value . "\n";
		}
		$list = '<dl class="dpa-diag">';
		foreach ( $diag as $label => $value ) {
			$list .= '<dt>' . esc_html( $label ) . '</dt><dd>' . esc_html( $value ) . '</dd>';
		}
		$list .= '</dl><p><button type="button" class="dpa-btn dpa-btn--ghost" data-dpa-copy="' . esc_attr( trim( $text ) ) . '">' . esc_html__( 'Copy for support', 'woo-donation-popup' ) . '</button></p>';
		$html .= Admin_View::card( __( 'Diagnostics', 'woo-donation-popup' ), $list, '', __( 'No personal or order data is included.', 'woo-donation-popup' ) );

		$html .= Admin_View::savebar() . Admin_View::close();
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Tanılama özeti (kişi verisi yok).
	 *
	 * @return array<string, string>
	 */
	public function diagnostics() {
		global $wp_version;
		$active = array();
		foreach ( array_keys( Settings_Store::module_definitions() ) as $slug ) {
			if ( $this->store->module_enabled( $slug ) ) {
				$active[] = $slug;
			}
		}
		$hpos = false;
		if ( class_exists( '\\Automattic\\WooCommerce\\Utilities\\OrderUtil' ) ) {
			$hpos = \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		$checkout = $this->status->checkout_page();
		return array(
			__( 'Plugin version', 'woo-donation-popup' )   => defined( 'WDP_VERSION' ) ? (string) WDP_VERSION : '',
			__( 'WordPress', 'woo-donation-popup' )        => (string) $wp_version,
			__( 'WooCommerce', 'woo-donation-popup' )      => defined( 'WC_VERSION' ) ? (string) WC_VERSION : '',
			__( 'PHP', 'woo-donation-popup' )              => PHP_VERSION,
			__( 'Order storage', 'woo-donation-popup' )    => $hpos ? 'HPOS' : 'posts',
			__( 'Checkout', 'woo-donation-popup' )         => $checkout['kind'],
			__( 'Currency', 'woo-donation-popup' )         => function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '',
			__( 'Guest checkout', 'woo-donation-popup' )   => $this->status->guest_checkout_enabled() ? 'on' : 'off',
			__( 'Donation products', 'woo-donation-popup' ) => (string) $this->status->donation_product_count(),
			__( 'Modules on', 'woo-donation-popup' )       => implode( ', ', $active ),
			__( 'REST API address', 'woo-donation-popup' ) => esc_url_raw( rest_url( 'donation-panel/v1/ping' ) ),
		);
	}
}
