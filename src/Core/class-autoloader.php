<?php
/**
 * Pakete gömülü basit autoloader: DonationPanel\ ad alanı -> WPCS dosya adı.
 *
 * Eşleme: DonationPanel\Core\Module_Registry -> src/Core/class-module-registry.php,
 * ...\Module_Interface -> interface-module-interface.php, ...\Foo_Trait -> trait-foo-trait.php.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Ad alanı öneki -> dizin eşlemesi tutan SPL autoloader.
 */
final class Autoloader {

	/**
	 * Kayıtlı kökler (ad alanı öneki => dizin, sonunda eğik çizgi ile).
	 *
	 * @var array<string, string>
	 */
	private static $roots = array();

	/**
	 * SPL kaydı yapıldı mı.
	 *
	 * @var bool
	 */
	private static $registered = false;

	/**
	 * Bir ad alanı kökünü kaydeder (tekrar çağrı güvenlidir).
	 *
	 * @param string $base_dir         Kök dizin.
	 * @param string $namespace_prefix Ad alanı öneki (sonunda ters eğik çizgi).
	 * @return void
	 */
	public static function register( $base_dir, $namespace_prefix = 'DonationPanel\\' ) {
		self::$roots[ $namespace_prefix ] = rtrim( (string) $base_dir, '/\\' ) . '/';

		if ( ! self::$registered ) {
			spl_autoload_register( array( self::class, 'autoload' ) );
			self::$registered = true;
		}
	}

	/**
	 * Sınıf adından dosya yolunu üretir (dosyanın var olup olmadığına bakmaz).
	 *
	 * @param string $class_name       Tam sınıf adı.
	 * @param string $base_dir         Kök dizin.
	 * @param string $namespace_prefix Ad alanı öneki.
	 * @return string Boş dize: bu kök için değil.
	 */
	public static function file_for_class( $class_name, $base_dir, $namespace_prefix = 'DonationPanel\\' ) {
		$class_name = ltrim( (string) $class_name, '\\' );
		if ( 0 !== strpos( $class_name, $namespace_prefix ) ) {
			return '';
		}

		$relative = substr( $class_name, strlen( $namespace_prefix ) );
		$parts    = explode( '\\', $relative );
		$short    = (string) array_pop( $parts );
		if ( '' === $short ) {
			return '';
		}

		$prefix = 'class-';
		if ( '_interface' === substr( strtolower( $short ), -10 ) ) {
			$prefix = 'interface-';
		} elseif ( '_trait' === substr( strtolower( $short ), -6 ) ) {
			$prefix = 'trait-';
		}

		$file = $prefix . strtolower( str_replace( '_', '-', $short ) ) . '.php';
		$dir  = rtrim( (string) $base_dir, '/\\' ) . '/';
		if ( $parts ) {
			$dir .= implode( '/', $parts ) . '/';
		}

		return $dir . $file;
	}

	/**
	 * SPL geri çağrısı.
	 *
	 * @param string $class_name Yüklenecek sınıf.
	 * @return void
	 */
	public static function autoload( $class_name ) {
		foreach ( self::$roots as $prefix => $dir ) {
			$file = self::file_for_class( $class_name, $dir, $prefix );
			if ( '' !== $file && is_file( $file ) ) {
				require_once $file;
				return;
			}
		}
	}
}
