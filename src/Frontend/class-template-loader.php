<?php
/**
 * Şablon yükleyici: temanın `donation-panel/` klasörü eklentinin varsayılan şablonlarını geçersiz kılar
 * (WooCommerce şablon mantığı: alt/üst tema sırası, öncesi/sonrası eylemleri, konum filtresi).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Frontend;

defined( 'ABSPATH' ) || exit;

/**
 * Template_Loader.
 */
class Template_Loader {

	const THEME_DIR = 'donation-panel';

	/**
	 * Eklentinin şablon kökü (sonunda eğik çizgi).
	 *
	 * @var string
	 */
	private $plugin_templates_dir;

	/**
	 * Tema kökleri çözücü (alt tema önce).
	 *
	 * @var callable|null
	 */
	private $theme_dirs;

	/**
	 * Konum önbelleği.
	 *
	 * @var array<string, string>
	 */
	private $cache = array();

	/**
	 * Kurucu.
	 *
	 * @param string        $plugin_dir Eklenti kök dizini.
	 * @param callable|null $theme_dirs function (): string[]; yoksa alt + üst tema.
	 */
	public function __construct( $plugin_dir, $theme_dirs = null ) {
		$this->plugin_templates_dir = rtrim( (string) $plugin_dir, '/\\' ) . '/templates/' . self::THEME_DIR . '/';
		$this->theme_dirs           = is_callable( $theme_dirs ) ? $theme_dirs : null;
	}

	/**
	 * Şablon adı güvenli mi (göreli, `..` yok, .php).
	 *
	 * @param string $name Örn. `form/popup.php`.
	 * @return bool
	 */
	public static function is_valid_name( $name ) {
		$name = (string) $name;
		return '' !== $name
			&& '.php' === substr( $name, -4 )
			&& 0 === preg_match( '#(^|[\\\\/])\.\.([\\\\/]|$)|^[\\\\/]|\0|:#', $name );
	}

	/**
	 * Şablonun tam yolunu bulur: alt tema, üst tema, eklenti sırasıyla.
	 *
	 * @param string $name Şablon adı.
	 * @return string Boş dize: bulunamadı/geçersiz.
	 */
	public function locate( $name ) {
		if ( ! self::is_valid_name( $name ) ) {
			return '';
		}
		if ( isset( $this->cache[ $name ] ) ) {
			return $this->cache[ $name ];
		}

		/**
		 * Temadaki şablon klasörünün adı (varsayılan `donation-panel`).
		 *
		 * @param string $folder Klasör adı.
		 */
		$folder  = trim( (string) apply_filters( 'donation_panel_template_theme_folder', self::THEME_DIR ), '/\\' );
		$located = '';
		foreach ( $this->theme_roots() as $root ) {
			$candidate = rtrim( $root, '/\\' ) . '/' . $folder . '/' . $name;
			if ( is_file( $candidate ) ) {
				$located = $candidate;
				break;
			}
		}
		if ( '' === $located && is_file( $this->plugin_templates_dir . $name ) ) {
			$located = $this->plugin_templates_dir . $name;
		}

		/**
		 * Bulunan şablon yolunu değiştirir.
		 *
		 * @param string $located Tam yol (boş olabilir).
		 * @param string $name    Şablon adı.
		 */
		$located = (string) apply_filters( 'donation_panel_located_template', $located, $name );

		$this->cache[ $name ] = $located;
		return $located;
	}

	/**
	 * Şablonu çıktıya yazar. Değişkenler şablonda `$args` dizisi olarak bulunur.
	 *
	 * @param string               $name Şablon adı.
	 * @param array<string, mixed> $args Şablona geçen veri.
	 * @return void
	 */
	public function render( $name, array $args = array() ) {
		$file = $this->locate( $name );
		if ( '' === $file ) {
			return;
		}

		do_action( 'donation_panel_before_template', $name, $file, $args );
		$include = static function ( $template_file, $template_args ) {
			$args = $template_args; // Şablonun kullandığı değişken.
			include $template_file;
			unset( $args );
		};
		$include( $file, $args );
		do_action( 'donation_panel_after_template', $name, $file, $args );
	}

	/**
	 * Şablonu metin olarak döndürür.
	 *
	 * @param string               $name Şablon adı.
	 * @param array<string, mixed> $args Veri.
	 * @return string
	 */
	public function render_to_string( $name, array $args = array() ) {
		ob_start();
		$this->render( $name, $args );
		return (string) ob_get_clean();
	}

	/**
	 * Tema kökleri (alt tema önce, tekrarsız).
	 *
	 * @return string[]
	 */
	private function theme_roots() {
		if ( null !== $this->theme_dirs ) {
			$roots = (array) call_user_func( $this->theme_dirs );
		} else {
			$roots = array( get_stylesheet_directory(), get_template_directory() );
		}
		return array_values( array_unique( array_filter( array_map( 'strval', $roots ) ) ) );
	}
}
