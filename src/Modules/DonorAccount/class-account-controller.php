<?php
/**
 * REST: bağışçı hesabı uçları (`donation-panel/v1/account/...`).
 *
 * - Kimlik doğrulama WordPress/WooCommerce işlevleriyle: `wp_signon`, `wc_create_new_customer`,
 *   `get_password_reset_key` + `woocommerce_reset_password_notification` (WooCommerce e-postası). Kendi parola/oturum kodu yok.
 * - Her yazma ucu: `wp_rest` nonce + hız sınırı. Kullanıcı sayımı (enumeration) yok: kayıt ve sıfırlama yanıtı
 *   hesap var/yok durumundan bağımsız aynıdır; giriş hatası tek iletidir.
 * - Kişi verisi yalnız oturumdaki kullanıcının kendi verisidir; hiçbir yanıt `no-store` dışında değildir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\DonorAccount;

use DonationPanel\Http\Rest_Controller;
use DonationPanel\Modules\Experiences\Form_Controller;
use DonationPanel\WooCommerce\Cart;

defined( 'ABSPATH' ) || exit;

/**
 * Account_Controller.
 */
class Account_Controller extends Rest_Controller {

	const MIN_PASSWORD = 8;

	/**
	 * Rotaları kaydeder.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->strip_cors_for( '/' . self::REST_NAMESPACE . '/account/session' );
		$public = array( $this, 'permission_public' );
		$member = array( $this, 'permission_member' );
		$routes = array(
			'/account/session'            => array( 'GET', 'session', $public ),
			'/account/login'              => array( 'POST', 'login', $public ),
			'/account/register'           => array( 'POST', 'register', $public ),
			'/account/reset'              => array( 'POST', 'reset', $public ),
			'/account/donations'          => array( 'GET', 'donations', $member ),
			'/account/repeat'             => array( 'POST', 'repeat', $member ),
			'/account/link-guest'         => array( 'POST', 'link_guest', $member ),
			'/account/link-guest/confirm' => array( 'POST', 'link_guest_confirm', $member ),
		);
		foreach ( $routes as $route => $def ) {
			register_rest_route(
				self::REST_NAMESPACE,
				$route,
				array(
					'methods'             => $def[0],
					'callback'            => array( $this, $def[1] ),
					'permission_callback' => $def[2],
				)
			);
		}
	}

	/**
	 * Yalnız oturum açmış kullanıcı.
	 *
	 * @return bool
	 */
	public function permission_member() {
		return is_user_logged_in();
	}

	/**
	 * Hız sınırı: uç başına varsayılan sınır `donation_panel_account_rate_limit` süzgeciyle değiştirilebilir.
	 *
	 * @param string $bucket Uç adı.
	 * @param int    $limit  Pencere başına üst sınır.
	 * @param int    $period Pencere (sn).
	 * @param bool   $donation_bucket Yok sayılır (hesap kovaları her zaman katı).
	 * @return true|\WP_Error
	 */
	protected function throttle( $bucket, $limit, $period = 60, $donation_bucket = false ) {
		/**
		 * Hesap uçlarının hız sınırı.
		 *
		 * @param int    $limit  Pencere başına istek sayısı.
		 * @param string $bucket Uç adı (`account_login`, `account_register`, `account_reset`, `account_link_guest` ...).
		 */
		$limit = (int) apply_filters( 'donation_panel_account_rate_limit', (int) $limit, (string) $bucket );
		// Hesap/kimlik doğrulama kovaları HER ZAMAN katıdır (belirteç bazlı gevşetme yok): 12.0 davranışı.
		return parent::throttle( $bucket, $limit, $period, false );
	}

	/**
	 * Yanıta önbelleksiz başlık ekler.
	 *
	 * @param mixed $data Yanıt verisi.
	 * @return \WP_REST_Response
	 */
	private function respond( $data ) {
		$response = rest_ensure_response( $data );
		$response->header( 'Cache-Control', 'no-store, private' );
		return $response;
	}

	/**
	 * İstek parametresini temiz metin olarak okur.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @param string           $name    Parametre.
	 * @return string
	 */
	private function text( $request, $name ) {
		return trim( (string) $request->get_param( $name ) );
	}

	/**
	 * Parola ham okunur (kaçışlanmaz, kırpılmaz: WordPress da böyle yapar).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @param string           $name    Parametre.
	 * @return string
	 */
	private function raw( $request, $name ) {
		$value = $request->get_param( $name );
		return is_string( $value ) ? $value : '';
	}

	/**
	 * Kayıt açık mı (WooCommerce ayarı).
	 *
	 * @return bool
	 */
	public static function registration_enabled() {
		return 'yes' === get_option( 'woocommerce_enable_myaccount_registration' );
	}

	/**
	 * GET /account/session: taze nonce + durum (önbellekli sayfalarda bayat nonce'ı önler).
	 *
	 * @param \WP_REST_Request|null $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function session( $request = null ) {
		if ( is_object( $request ) ) {
			// Çerez kullanıcısı için nonce dönüyor: başka kökenden okunamasın (Origin / Sec-Fetch-Site).
			$origin = $this->require_same_origin( $request );
			if ( is_wp_error( $origin ) ) {
				return $origin;
			}
		}
		$this->remember_client( $request );
		$limited = $this->throttle( 'account_session', 120 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		// REST, X-WP-Nonce olmadan gelen çerezli isteği oturumsuz sayar; nonce'ın çerezdeki kullanıcıya ait olması için
		// kullanıcı çerezden çözülür (WordPress'in `rest-nonce` admin-ajax eylemiyle aynı yaklaşım; yanıt yalnız aynı kökene okunur).
		if ( 0 === get_current_user_id() && function_exists( 'wp_validate_auth_cookie' ) ) {
			$cookie_user = (int) wp_validate_auth_cookie( '', 'logged_in' );
			if ( $cookie_user > 0 ) {
				wp_set_current_user( $cookie_user );
			}
		}
		return $this->respond(
			array(
				'logged_in'    => is_user_logged_in(),
				'registration' => self::registration_enabled(),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
			)
		);
	}

	/**
	 * POST /account/login.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function login( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_login', 10 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$login    = $this->text( $request, 'email' );
		$password = $this->raw( $request, 'password' );
		$fail     = $this->error( 'donation_panel_login_failed', 'The email or password is incorrect.', 401 );
		if ( '' === $login || '' === $password ) {
			return $fail;
		}
		// Hesap başına sınır: dağıtık IP'lerle tek hesaba parola denemesini durdurur. Aşımda yanıt hesabın var olup
		// olmadığını belirtmez (her giriş adı için aynı sınır uygulanır). WordPress'in kendi başarısız giriş
		// kancaları (`wp_login_failed`) wp_signon ile çalışmaya devam eder.
		if ( ! $this->allow_target( 'account_login', $login, 10, 900 ) ) {
			return $this->error( 'donation_panel_rate_limited', 'Too many requests. Please try again shortly.', 429 );
		}
		$user = wp_signon(
			array(
				'user_login'    => $login,
				'user_password' => $password,
				'remember'      => (bool) $request->get_param( 'remember' ),
			),
			is_ssl()
		);
		if ( is_wp_error( $user ) || ! is_object( $user ) ) {
			return $fail;
		}
		wp_set_current_user( (int) $user->ID );
		return $this->respond(
			array(
				'ok'    => true,
				'nonce' => wp_create_nonce( 'wp_rest' ),
			)
		);
	}

	/**
	 * POST /account/register: yanıt, e-postanın kayıtlı olup olmamasından bağımsız aynıdır.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function register( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_register', 6 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		if ( ! self::registration_enabled() ) {
			return $this->error( 'donation_panel_registration_disabled', 'Registration is not available.', 403 );
		}
		$email    = sanitize_email( $this->text( $request, 'email' ) );
		$password = $this->raw( $request, 'password' );
		if ( '' === $email || ! is_email( $email ) ) {
			return $this->error( 'donation_panel_invalid_email', 'Enter a valid email address.', 400 );
		}
		if ( strlen( $password ) < self::MIN_PASSWORD ) {
			return $this->error( 'donation_panel_weak_password', 'Password must be at least 8 characters.', 400 );
		}
		if ( ! $this->allow_target( 'account_register', $email, 3, 900 ) ) {
			return $this->respond( array( 'ok' => true ) );
		}
		if ( function_exists( 'wc_create_new_customer' ) && ! email_exists( $email ) ) {
			// Hata (var olan e-posta, eklenti reddi) bilerek yutulur: yanıt değişmez. Sonuç giriş denemesiyle anlaşılır.
			wc_create_new_customer( $email, $email, $password );
		}
		return $this->respond( array( 'ok' => true ) );
	}

	/**
	 * POST /account/reset: WooCommerce şifre sıfırlama e-postası; yanıt her durumda aynı.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function reset( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_reset', 5 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$email = sanitize_email( $this->text( $request, 'email' ) );
		if ( '' === $email || ! is_email( $email ) ) {
			return $this->error( 'donation_panel_invalid_email', 'Enter a valid email address.', 400 );
		}
		// Aynı adrese e-posta yağdırmayı önler (dağıtık IP'lerle de); aşımda yanıt değişmez, e-posta gitmez.
		if ( ! $this->allow_target( 'account_reset', $email, 3, 900 ) ) {
			return $this->respond( array( 'ok' => true ) );
		}
		$user = get_user_by( 'email', $email );
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress çekirdek süzgeci.
		if ( $user && apply_filters( 'allow_password_reset', true, $user->ID ) ) {
			$key = get_password_reset_key( $user );
			if ( is_string( $key ) && '' !== $key ) {
				// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WooCommerce standart şifre sıfırlama e-postası kancası.
				do_action( 'woocommerce_reset_password_notification', $user->user_login, $key );
			}
		}
		return $this->respond( array( 'ok' => true ) );
	}

	/**
	 * GET /account/donations: oturumdaki kullanıcının bağışları (sayfalı).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function donations( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_donations', 120 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$per_page = (int) $request->get_param( 'per_page' );
		$page     = Donation_History::page( get_current_user_id(), (int) $request->get_param( 'page' ), $per_page > 0 ? $per_page : 10 );
		return $this->respond(
			array(
				'rows'  => $page['rows'],
				'html'  => Account_Renderer::donations( $page['rows'] ),
				'total' => $page['total'],
				'pages' => $page['pages'],
				'page'  => $page['page'],
			)
		);
	}

	/**
	 * Sipariş durumu tekrar bağışa izin verir mi (ödenmiş sayılan durumlar).
	 *
	 * @param string $status Durum (`wc-` öneki olabilir).
	 * @return bool
	 */
	public static function repeat_status_allowed( $status ) {
		$status = preg_replace( '/^wc-/', '', strtolower( trim( (string) $status ) ) );
		return '' !== $status && in_array( $status, \DonationPanel\Domain\Campaign_Totals::get_progress_paid_statuses(), true );
	}

	/**
	 * Sipariş kalemi verisinden tekrar bağış girdisi (saf; test edilebilir).
	 *
	 * @param array<string, array<string, mixed>> $data      `Order_Meta_Keys::get_item_donation_data` çıktısı.
	 * @param float                               $total     Kalem toplamı (işlem ücreti dahil olabilir).
	 * @param string                              $frequency Düzenli bağış seçeneği (boş olabilir).
	 * @param int                                 $decimals  Fiyat ondalık hanesi.
	 * @return array<string, mixed>
	 */
	public static function repeat_input( array $data, $total, $frequency, $decimals ) {
		$pick   = static function ( $key ) use ( $data ) {
			return isset( $data[ $key ]['value'] ) && is_scalar( $data[ $key ]['value'] ) ? (string) $data[ $key ]['value'] : '';
		};
		$keys   = '\\DonationPanel\\WooCommerce\\Order_Meta_Keys';
		$amount = (float) $total;
		$fee    = $pick( constant( $keys . '::COVER_FEE' ) );
		$input  = array();
		if ( is_numeric( $fee ) && (float) $fee > 0 ) {
			// İşlem ücreti siparişte tutara eklenmiştir; ücretsiz birim tutar geri bulunur ve ücret yeniden uygulanır.
			$amount                      = round( $amount / ( 1 + ( (float) $fee / 100 ) ), max( 0, (int) $decimals ) );
			$input['donation_cover_fee'] = '1';
		}
		$input['amount']              = $amount;
		$input['donation_full_name']  = $pick( constant( $keys . '::DONOR_NAME' ) );
		$input['donation_phone']      = $pick( constant( $keys . '::DONOR_PHONE' ) );
		$input['donation_email']      = $pick( constant( $keys . '::DONOR_EMAIL' ) );
		$input['donation_dedication'] = $pick( constant( $keys . '::DEDICATION' ) );
		$input['donation_note']       = $pick( constant( $keys . '::DONATION_NOTE' ) );
		if ( 'yes' === $pick( constant( $keys . '::ANONYMOUS' ) ) ) {
			$input['donation_anonymous'] = '1';
		}
		if ( '' !== trim( (string) $frequency ) ) {
			$input['donation_type'] = sanitize_key( (string) $frequency );
		}
		return array_filter(
			$input,
			static function ( $v ) {
				return '' !== (string) $v;
			}
		);
	}

	/**
	 * Geçmiş bir bağışı aynı tutarla sepete ekler (yalnız kendi siparişi; bağışçı bilgisi o siparişten devralınır).
	 *
	 * @param \WP_REST_Request $request Istek (`order_id`, `product_id`).
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function repeat( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_repeat', 20 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$order      = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $request->get_param( 'order_id' ) ) ) : null;
		$product_id = absint( $request->get_param( 'product_id' ) );
		if ( ! $order || (int) $order->get_customer_id() !== get_current_user_id() || $product_id < 1 ) {
			return $this->error( 'donation_panel_repeat_not_found', 'Donation not found.', 404 );
		}
		// İptal/başarısız/bekleyen/iade siparişler tekrarlanmaz: yalnız ödenmiş sayılan durumlar.
		if ( ! self::repeat_status_allowed( (string) $order->get_status() ) ) {
			return $this->error( 'donation_panel_repeat_unavailable', 'This donation cannot be repeated here.', 422 );
		}
		$store = function_exists( 'get_woocommerce_currency' ) ? (string) get_woocommerce_currency() : '';
		if ( '' === $store || $store !== (string) $order->get_currency() ) {
			return $this->error( 'donation_panel_repeat_currency', 'Please give again from the donation page.', 422 );
		}
		$input = null;
		foreach ( (array) $order->get_items() as $item ) {
			if ( ! $item instanceof \WC_Order_Item_Product || (int) $item->get_product_id() !== $product_id ) {
				continue;
			}
			$input                   = self::repeat_input(
				\DonationPanel\WooCommerce\Order_Meta_Keys::get_item_donation_data( $item ),
				(float) $item->get_total(),
				(string) $item->get_meta( \DonationPanel\WooCommerce\Donation_Order_Meta::KEY_FREQUENCY, true ),
				function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2
			);
			$input['submission_key'] = 'again-' . wp_generate_password( 12, false );
			break;
		}
		$model   = Form_Controller::model_for_id( $product_id );
		$product = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( null === $input || empty( $model ) || ! is_object( $product ) || 'publish' !== get_post_status( $product_id ) ) {
			return $this->error( 'donation_panel_repeat_unavailable', 'This donation cannot be repeated here.', 422 );
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		$result = ( new Cart() )->add_item(
			WC()->cart,
			$product,
			$model,
			array_filter(
				$input,
				static function ( $v ) {
					return '' !== (string) $v;
				}
			)
		);
		if ( empty( $result['ok'] ) ) {
			return $this->error( 'donation_panel_cart_rejected', (string) $result['message'], (int) $result['status'] );
		}
		return $this->respond( array( 'ok' => true ) );
	}

	/**
	 * Misafir bağışlarını bağlama bağlantısını hesap e-postasına gönderir.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function link_guest( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_link_guest', 3, 600 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$user = wp_get_current_user();
		if ( ! $user || empty( $user->ID ) || ! is_email( $user->user_email ) ) {
			return $this->error( 'donation_panel_no_user', 'Log in first.', 401 );
		}
		$token = Guest_Link_Token::issue( (int) $user->ID, (string) $user->user_email );
		$url   = add_query_arg( 'dp_link_guest', rawurlencode( $token ), Donor_Account_Module::donations_url() );
		/* translators: %s: site name. */
		$subject = sprintf( __( '[%s] Confirm to link your earlier gifts', 'woo-donation-popup' ), wp_specialchars_decode( (string) get_option( 'blogname' ), ENT_QUOTES ) );
		/* translators: 1: verification link, 2: validity in minutes. */
		$body = sprintf( __( "Open this link while logged in to add the gifts you made as a guest with this email address to your account:\n\n%1\$s\n\nThe link works once and expires in %2\$d minutes. If you did not ask for this, ignore this email.", 'woo-donation-popup' ), esc_url_raw( $url ), (int) ( Guest_Link_Token::TTL / 60 ) );
		wp_mail( (string) $user->user_email, $subject, $body );
		return $this->respond( array( 'ok' => true ) );
	}

	/**
	 * Belirteci doğrular ve yalnız hesap e-postasıyla eşleşen misafir siparişlerini hesaba bağlar.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function link_guest_confirm( $request ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$limited = $this->throttle( 'account_link_confirm', 10, 600 );
		if ( is_wp_error( $limited ) ) {
			return $limited;
		}
		$user_id = get_current_user_id();
		$email   = Guest_Link_Token::consume( $user_id, $this->text( $request, 'token' ) );
		if ( null === $email ) {
			return $this->error( 'donation_panel_link_invalid', 'This link is invalid or has expired. Request a new one.', 400 );
		}
		return $this->respond( array( 'linked' => self::link_orders( $user_id, $email ) ) );
	}

	/**
	 * Fatura e-postası eşleşen, hesapsız (misafir) siparişleri kullanıcıya bağlar.
	 *
	 * @param int    $user_id Kullanıcı.
	 * @param string $email   Doğrulanmış e-posta.
	 * @return int Bağlanan sipariş sayısı.
	 */
	public static function link_orders( $user_id, $email ) {
		if ( ! function_exists( 'wc_get_orders' ) || $user_id <= 0 || '' === $email ) {
			return 0;
		}
		$orders = wc_get_orders(
			array(
				'billing_email' => $email,
				'limit'         => -1,
				'type'          => 'shop_order',
			)
		);
		$linked = 0;
		foreach ( (array) $orders as $order ) {
			if ( ! is_object( $order ) || 0 !== (int) $order->get_customer_id() || strtolower( trim( (string) $order->get_billing_email() ) ) !== $email ) {
				continue;
			}
			$order->set_customer_id( $user_id );
			$order->save();
			++$linked;
		}
		/**
		 * Misafir siparişleri hesaba bağlandıktan sonra.
		 *
		 * @param int $user_id Kullanıcı.
		 * @param int $linked  Bağlanan sipariş sayısı.
		 */
		do_action( 'donation_panel_guest_orders_linked', $user_id, $linked );
		return $linked;
	}
}
