<?php
/**
 * Ön yüz paketinin (cta-ready + donation-modal) etkileşime/boşta ana kadar ertelenmesi.
 *
 * WordPress standart script_loader_tag süzgeciyle yalnız eklentinin iki betiğinin `<script src>`
 * etiketi `type="text/wdp-deferred"` + `data-wdp-src` olur (satır içi veri betikleri, bağımlılıklar,
 * sıra ve tutamaçlar aynı kalır); küçük satır içi yükleyici (assets/js/defer-loader.js) onları
 * dokunma/odak/fare üstü/tıklama ya da boşta anında gerçek betik olarak ekler. Kapatma:
 * `add_filter( 'wdp_defer_frontend_assets', '__return_false' )`.
 *
 * @package WooCommerce\Donation_Popup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class WDP_Assets_Defer
 */
class WDP_Assets_Defer {

	/** @var bool Yükleyici bu istekte yazıldı mı. */
	private static $loader_printed = false;

	/**
	 * @return void
	 */
	public static function init() {
		add_filter( 'script_loader_tag', array( __CLASS__, 'filter_script_tag' ), 20, 3 );
		add_filter( 'style_loader_tag', array( __CLASS__, 'filter_style_tag' ), 20, 4 );
	}

	/**
	 * K3: stil bağlantıları ilk boyamayı engellemez.
	 *
	 * 1) Tam ön yüz paketi (34 KB gzip): ilk görünümdeki kuralların alt kümesi (derleme çıktısı `critical.*.css`) satır içi
	 *    basılır; tam paketin yerine <meta name="wdp-deferred-style"> yer tutucusu konur, sayfa yüklendikten sonra
	 *    (boşta / ilk etkileşimde, `assets/js/style-defer-loader.js`) AYNI yere <link> eklenir → basamaklı sıra özgün
	 *    düzenle aynı kalır (satır içi ayar CSS'i bağlantıdan sonra gelmeye devam eder), ilk yük bant genişliği
	 *    yarışılmaz. Betiksiz tarayıcı için `<noscript>` yedeği özgün bağlantıdır.
	 * 2) Küçük modül stilleri (`donation-panel-*`, ≤ 12 KB; yan sepet, bağışçı hesabı): ayrı engelleyici istek yerine satır içi.
	 *
	 * Kapatma: `add_filter( 'wdp_defer_frontend_styles', '__return_false' )` ya da `wdp_defer_frontend_assets`.
	 *
	 * @param string $html   Bağlantı etiketi.
	 * @param string $handle Tutamaç.
	 * @param string $href   Adres.
	 * @param string $media  Ortam.
	 * @return string
	 */
	public static function filter_style_tag( $html, $handle, $href = '', $media = 'all' ) {
		$is_bundle = WDP_Assets::FRONTEND_CSS_HANDLE === $handle;
		$is_module = 0 === strpos( (string) $handle, 'donation-panel-' );
		if ( ( ! $is_bundle && ! $is_module ) || 'all' !== $media || false === strpos( $html, "media='all'" ) ) {
			return $html;
		}
		if ( ! self::is_active() ) {
			return $html;
		}
		/**
		 * Stil bağlantılarının ilk boyamayı engellemeden yüklenmesi (varsayılan açık).
		 *
		 * @param bool $defer Ertele.
		 */
		if ( ! apply_filters( 'wdp_defer_frontend_styles', true ) ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- wdp_ öneki eklentiye ait.
			return $html;
		}
		if ( $is_module ) {
			$css = self::small_local_css( (string) $href );
			return '' === $css ? $html : '<style id="' . esc_attr( $handle ) . '-css">' . $css . "</style>\n";
		}
		$critical = WDP_Assets::get_critical_bundle_css();
		if ( '' === $critical ) {
			return $html; // Kritik alt küme yok: bölme yok, özgün engelleyici bağlantı.
		}
		$loader = self::style_loader_markup();
		if ( '' === $loader ) {
			return $html; // Yükleyici yok: erteleme yok.
		}
		$placeholder = '<meta name="wdp-deferred-style" data-id="' . esc_attr( $handle . '-css' ) . '" data-href="' . esc_url( $href ) . '">';
		return '<style id="wdp-critical-bundle">' . $critical . "</style>\n" . $placeholder . "\n" . $loader . '<noscript>' . $html . "</noscript>\n";
	}

	/**
	 * Eklenti dizinindeki küçük (≤ 12 KB) bir stil dosyasının içeriği; değilse ''.
	 *
	 * @param string $href Stil adresi (sorgu dizesi olabilir).
	 * @return string
	 */
	private static function small_local_css( $href ) {
		$base = defined( 'WDP_PLUGIN_URL' ) ? (string) WDP_PLUGIN_URL : '';
		$dir  = defined( 'WDP_PLUGIN_DIR' ) ? (string) WDP_PLUGIN_DIR : '';
		$path = (string) wp_parse_url( $href, PHP_URL_PATH );
		$root = (string) wp_parse_url( $base, PHP_URL_PATH );
		if ( '' === $base || '' === $dir || '' === $root || 0 !== strpos( $path, $root ) || false !== strpos( $path, '..' ) || '.css' !== substr( $path, -4 ) ) {
			return '';
		}
		$file = $dir . substr( $path, strlen( $root ) );
		if ( ! is_readable( $file ) || filesize( $file ) > 12288 ) {
			return '';
		}
		$css = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- yerel eklenti dosyası.
		if ( ! is_string( $css ) || '' === $css ) {
			return '';
		}
		return trim( str_ireplace( '</style', '<\/style', $css ) );
	}

	/**
	 * Stil yükleyicisi (istek başına bir kez; satır içi).
	 *
	 * @return string
	 */
	private static function style_loader_markup() {
		static $printed = false;
		static $code    = null;
		if ( $printed ) {
			return ' ';
		}
		if ( null === $code ) {
			$file = WDP_PLUGIN_DIR . 'assets/js/style-defer-loader.js';
			$raw  = is_readable( $file ) ? file_get_contents( $file ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- yerel eklenti dosyası.
			$code = is_string( $raw ) ? (string) preg_replace( array( '~/\*.*?\*/~s', '~^\s*//.*$~m', '~\n\s*\n+~' ), array( '', '', "\n" ), $raw ) : '';
		}
		if ( '' === $code ) {
			return '';
		}
		$printed = true;
		return "<script id=\"wdp-style-loader\">\n" . $code . "\n</script>\n";
	}

	/**
	 * Ertelenecek tutamaçlar (yalnız eklentinin paket modu betikleri).
	 *
	 * @return string[]
	 */
	private static function deferred_handles() {
		return array( WDP_Assets::FRONTEND_JS_HANDLE, 'wdp-form-cta-ready-js', WDP_Client_Data::HANDLE );
	}

	/**
	 * Bu istekte erteleme uygulanır mı.
	 *
	 * @return bool
	 */
	public static function is_active() {
		if ( is_admin() || wp_doing_ajax() || is_feed() || ( function_exists( 'wp_is_json_request' ) && wp_is_json_request() ) ) {
			return false;
		}
		if ( function_exists( 'is_customize_preview' ) && is_customize_preview() ) {
			return false;
		}
		/**
		 * Ön yüz paketinin etkileşime kadar ertelenmesi (varsayılan açık).
		 *
		 * @param bool $defer Ertele.
		 */
		return (bool) apply_filters( 'wdp_defer_frontend_assets', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- wdp_ öneki eklentiye ait.
	}

	/**
	 * Paket betiğinin src etiketini ertelenmiş biçime çevirir.
	 *
	 * @param string $tag    Etiket(ler) (satır içi veri betikleri dahil olabilir).
	 * @param string $handle Tutamaç.
	 * @param string $src    Kaynak.
	 * @return string
	 */
	public static function filter_script_tag( $tag, $handle, $src ) {
		if ( ! in_array( $handle, self::deferred_handles(), true ) || '' === $src ) {
			return $tag;
		}
		if ( ! self::is_active() ) {
			return $tag;
		}
		$rewritten = self::rewrite_src_tag( $tag );
		if ( $rewritten === $tag ) {
			return $tag;
		}
		$loader = self::loader_markup();
		if ( '' === $loader && ! self::$loader_printed ) {
			return $tag; // Yükleyici yoksa erteleme yok: betik olduğu gibi yüklenir.
		}
		return $loader . $rewritten;
	}

	/**
	 * İlk `<script ... src="...">` etiketini type="text/wdp-deferred" data-wdp-src="..." yapar.
	 * Satır içi (src'siz) betikler ve diğer öznitelikler dokunulmadan kalır.
	 *
	 * @param string $tag Etiket dizisi.
	 * @return string
	 */
	public static function rewrite_src_tag( $tag ) {
		$pattern = '/<script\b([^>]*?)\ssrc=(["\'])(.*?)\2([^>]*)>/i';
		return (string) preg_replace_callback(
			$pattern,
			static function ( $m ) {
				$attrs = $m[1] . $m[4];
				// Var olan type/async/defer öznitelikleri yeni türle çakışmasın.
				$attrs = (string) preg_replace( '/\s(?:type|async|defer)(?:=(["\']).*?\1)?/i', '', $attrs );
				return '<script type="text/wdp-deferred"' . $attrs . ' data-wdp-src=' . $m[2] . $m[3] . $m[2] . '>';
			},
			$tag,
			1
		);
	}

	/**
	 * Satır içi yükleyici (istek başına bir kez).
	 *
	 * @return string
	 */
	private static function loader_markup() {
		if ( self::$loader_printed ) {
			return '';
		}
		$file = WDP_PLUGIN_DIR . 'assets/js/defer-loader.js';
		if ( ! is_readable( $file ) ) {
			return '';
		}
		$code = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- yerel eklenti dosyası.
		if ( ! is_string( $code ) || '' === $code ) {
			return '';
		}
		self::$loader_printed = true;
		$code                 = (string) preg_replace( array( '~/\*.*?\*/~s', '~^\s*//.*$~m', '~\n\s*\n+~' ), array( '', '', "\n" ), $code );
		return "<script id=\"wdp-defer-loader\">\n" . $code . "\n</script>\n";
	}
}
