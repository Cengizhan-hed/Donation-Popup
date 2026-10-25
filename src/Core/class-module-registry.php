<?php
/**
 * Modül kayıt defteri: modül ayarla açılır/kapanır; KAPALI modülün sınıf dosyası hiç yüklenmez.
 *
 * Kayıt yalnız slug + sınıf adı + varsayılan durum tutar; sınıf yalnız modül etkinse (autoload ile) yüklenir.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Module_Registry.
 */
class Module_Registry {

	/**
	 * Tanımlar: slug => [ class, default ].
	 *
	 * @var array<string, array{class: string, default: bool}>
	 */
	private $definitions = array();

	/**
	 * Etkin ve başlatılmış modüller.
	 *
	 * @var array<string, Module_Interface>
	 */
	private $active = array();

	/**
	 * Ayar deposu.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Kurucu.
	 *
	 * @param Settings $settings Ayar deposu.
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Modül tanımlar (sınıf yüklenmez).
	 *
	 * @param string $slug          Küçük harf, rakam, tire/alt çizgi.
	 * @param string $class_name    Module_Interface uygulayan sınıf (tam ad).
	 * @param bool   $default_state Ayar yokken açık mı.
	 * @return void
	 */
	public function add( $slug, $class_name, $default_state = false ) {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return;
		}
		$this->definitions[ $slug ] = array(
			'class'   => ltrim( (string) $class_name, '\\' ),
			'default' => (bool) $default_state,
		);
	}

	/**
	 * Tanımlı tüm slug'lar.
	 *
	 * @return string[]
	 */
	public function slugs() {
		return array_keys( $this->definitions );
	}

	/**
	 * Modül açık mı (ayar + `donation_panel_module_enabled` filtresi).
	 *
	 * @param string $slug Modül slug'ı.
	 * @return bool
	 */
	public function is_enabled( $slug ) {
		$slug = sanitize_key( $slug );
		if ( ! isset( $this->definitions[ $slug ] ) ) {
			return false;
		}

		$enabled = $this->settings->module_enabled( $slug, $this->definitions[ $slug ]['default'] );

		/**
		 * Modülün açık olup olmadığını değiştirir.
		 *
		 * @param bool   $enabled Ayara göre açık mı.
		 * @param string $slug    Modül slug'ı.
		 */
		return (bool) apply_filters( 'donation_panel_module_enabled', $enabled, $slug );
	}

	/**
	 * Açık modülleri kurar ve kaydeder; kapalı modülün dosyasına dokunmaz.
	 *
	 * @param Container $container Bağımlılık kabı.
	 * @return void
	 */
	public function boot( Container $container ) {
		foreach ( $this->definitions as $slug => $definition ) {
			if ( isset( $this->active[ $slug ] ) || ! $this->is_enabled( $slug ) ) {
				continue;
			}

			$class_name = $definition['class'];
			if ( ! class_exists( $class_name ) || ! is_subclass_of( $class_name, Module_Interface::class ) ) {
				continue;
			}

			$module = $container->get( $class_name );
			if ( ! $module instanceof Module_Interface ) {
				continue;
			}

			$module->register( $container );
			$this->active[ $slug ] = $module;
		}
	}

	/**
	 * Başlatılmış modül slug'ları.
	 *
	 * @return string[]
	 */
	public function active_slugs() {
		return array_keys( $this->active );
	}

	/**
	 * Tanım + durum listesi (ping/yönetici ekranı için; kişisel veri yok).
	 *
	 * @return array<int, array{slug: string, enabled: bool}>
	 */
	public function summary() {
		$list = array();
		foreach ( array_keys( $this->definitions ) as $slug ) {
			$list[] = array(
				'slug'    => $slug,
				'enabled' => $this->is_enabled( $slug ),
			);
		}
		return $list;
	}
}
