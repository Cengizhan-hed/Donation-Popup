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
