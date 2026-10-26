<?php
/**
 * Şemalı, sürümlü tek ayar deposu: `donation_panel_settings`.
 *
 * Eski `wdp_*` seçenekleri Legacy_Settings_Importer ile (idempotent, yalnız okuyarak) içe alınır;
 * eski anahtarlar ASLA silinmez/değiştirilmez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Settings.
 */
class Settings {

	const OPTION_NAME    = 'donation_panel_settings';
	const SCHEMA_VERSION = 1;

	/**
	 * Yönetici ekranı değerleri: eski ekran (varsayılan) ya da yeni sade ekran (E7).
	 */
	const ADMIN_UIS = array( 'legacy', 'new' );

	/**
	 * Kurulum sihirbazı durumları: boş = henüz yapılmadı.
	 */
	const WIZARD_STATES = array( '', 'done', 'skipped' );

	/**
	 * Önizleme açık mı (`?dp_preview=1`, yalnız yetkili yönetici; yalnız o istek; ayar YAZILMAZ).
	 *
	 * @var bool
	 */
	private static $preview = false;

	/**
	 * Bellekteki önbellek.
	 *
	 * @var array<string, mixed>|null
	 */
	private $data = null;

	/**
	 * Şema: grup => [ anahtar => [ type, default ] ]. Tip: bool|int|string|text (çok satırlı).
	 *
	 * @return array<string, array<string, array{type: string, default: mixed}>>
	 */
	public static function schema() {
		return array(
			'general'     => array(
				'delete_data_on_uninstall' => array(
					'type'    => 'bool',
					'default' => false,
				),
			),
			'impact'      => array(
				'map' => array(
					'type'    => 'text',
					'default' => '',
				),
			),
			'thanks'      => array(
				'celebrate' => array(
					'type'    => 'bool',
					'default' => true,
				),
				'share'     => array(
					'type'    => 'bool',
					'default' => true,
				),
				'message'   => array(
					'type'    => 'text',
					'default' => '',
				),
			),
			'tax_relief'  => array(
				'step_label'     => array(
					'type'    => 'string',
					'default' => '',
				),
				'title'          => array(
					'type'    => 'string',
					'default' => '',
				),
				'text'           => array(
					'type'    => 'text',
					'default' => '',
				),
				'checkbox_label' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			'admin'       => array(
				'ui'     => array(
					'type'    => 'string',
					'default' => 'legacy',
				),
				'wizard' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		);
	}

	/**
	 * Varsayılan değerler (modules boş: modül varsayılanı kayıt defterinde).
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults() {
		$defaults = array(
			'version' => self::SCHEMA_VERSION,
			'modules' => array(),
		);
		foreach ( self::schema() as $group => $keys ) {
			foreach ( $keys as $key => $spec ) {
				$defaults[ $group ][ $key ] = $spec['default'];
			}
		}
		return $defaults;
	}

	/**
	 * Tüm ayarlar (varsayılanlarla birleşik).
	 *
	 * @return array<string, mixed>
	 */
	public function all() {
		if ( null === $this->data ) {
			$stored     = get_option( self::OPTION_NAME, array() );
			$this->data = self::normalize( is_array( $stored ) ? $stored : array() );
		}
		return $this->data;
	}

	/**
	 * Nokta yollu okuma: `general.delete_data_on_uninstall`.
	 *
	 * @param string $path          Grup.anahtar.
	 * @param mixed  $default_value Yoksa döner.
	 * @return mixed
	 */
	public function get( $path, $default_value = null ) {
		$node = $this->all();
		foreach ( explode( '.', (string) $path ) as $segment ) {
			if ( ! is_array( $node ) || ! array_key_exists( $segment, $node ) ) {
				return $default_value;
			}
			$node = $node[ $segment ];
		}
		return $node;
	}

	/**
	 * Modül ayarı: açık/kapalı kaydı yoksa verilen varsayılan.
	 *
	 * @param string $slug          Modül slug'ı.
	 * @param bool   $default_state Varsayılan.
	 * @return bool
	 */
	public function module_enabled( $slug, $default_state = false ) {
		if ( self::$preview ) {
			return true;
		}
		$modules = $this->all()['modules'];
		return isset( $modules[ $slug ] ) ? (bool) $modules[ $slug ] : (bool) $default_state;
	}

	/**
	 * Yama uygular, temizler ve yazar (yalnız şemadaki anahtarlar + modül bayrakları).
	 *
	 * @param array<string, mixed> $patch Kısmi ayar dizisi.
	 * @return bool
	 */
	public function update( array $patch ) {
		$current = $this->all();
		foreach ( self::schema() as $group => $keys ) {
			if ( isset( $patch[ $group ] ) && is_array( $patch[ $group ] ) ) {
				$current[ $group ] = array_merge( $current[ $group ], array_intersect_key( $patch[ $group ], $keys ) );
			}
		}
		if ( isset( $patch['modules'] ) && is_array( $patch['modules'] ) ) {
			foreach ( $patch['modules'] as $slug => $state ) {
				$current['modules'][ sanitize_key( (string) $slug ) ] = (bool) $state;
			}
		}

		$this->data = self::normalize( $current );
		return (bool) update_option( self::OPTION_NAME, $this->data, false );
	}

	/**
	 * Saklı değeri şemaya göre tamamlar ve tiplerini zorlar.
	 *
	 * @param array<string, mixed> $stored Saklı dizi.
	 * @return array<string, mixed>
	 */
	public static function normalize( array $stored ) {
		$out            = self::defaults();
		$out['version'] = self::SCHEMA_VERSION;
		$stored_modules = isset( $stored['modules'] ) && is_array( $stored['modules'] ) ? $stored['modules'] : array();
		foreach ( $stored_modules as $slug => $state ) {
			$slug = sanitize_key( (string) $slug );
			if ( '' !== $slug ) {
				$out['modules'][ $slug ] = (bool) $state;
			}
		}

		foreach ( self::schema() as $group => $keys ) {
			foreach ( $keys as $key => $spec ) {
				if ( isset( $stored[ $group ] ) && is_array( $stored[ $group ] ) && array_key_exists( $key, $stored[ $group ] ) ) {
					$out[ $group ][ $key ] = self::cast( $stored[ $group ][ $key ], $spec['type'], $spec['default'] );
				}
			}
		}
		if ( ! in_array( $out['admin']['ui'], self::ADMIN_UIS, true ) ) {
			$out['admin']['ui'] = 'legacy';
		}
		if ( ! in_array( $out['admin']['wizard'], self::WIZARD_STATES, true ) ) {
			$out['admin']['wizard'] = '';
		}
		return $out;
	}

	/**
	 * Önizlemeyi açar/kapatır (yalnız Preview modülü çağırır; bellekte, ayar yazılmaz).
	 *
	 * @param bool $on Açık mı.
	 * @return void
	 */
	public static function set_preview( $on ) {
		self::$preview = (bool) $on;
	}

	/**
	 * Bu istekte önizleme açık mı.
	 *
	 * @return bool
	 */
	public static function is_preview() {
		return self::$preview;
	}

	/**
	 * Yeni kurulumda (hiç ayar ve eski sürüm izi yok) yeni yönetici ekranını varsayılan yazar; mevcut kurulumda hiçbir şey yapmaz.
	 * İdempotent: ayar bir kez varsa bir daha dokunmaz. Etkinleştirmede çağrılır.
	 *
	 * @return bool Yazıldıysa true.
	 */
	public static function seed_fresh_install() {
		if ( false !== get_option( self::OPTION_NAME, false ) ) {
			return false;
		}
		if ( false !== get_option( 'wdp_version', false ) || false !== get_option( 'wdp_cache_version', false ) ) {
			return false;
		}
		$seed = self::normalize(
			array(
				'admin'       => array( 'ui' => 'new' ),
			)
		);
		return (bool) update_option( self::OPTION_NAME, $seed, false );
	}

	/**
	 * Yeni sade yönetici ekranı seçili mi (ayar `admin.ui`; `donation_panel_admin_ui` filtresi ya da
	 * `DONATION_PANEL_ADMIN_UI` sabiti `new`/`legacy` ile geçersiz kılabilir). Varsayılan: eski ekran.
	 * Yalnız yönetim alanında anlamlıdır; yeni ekranın dosyaları `legacy` iken hiç yüklenmez.
	 *
	 * @return bool
	 */
	public static function admin_ui_is_new() {
		$stored = get_option( self::OPTION_NAME, array() );
		$all    = self::normalize( is_array( $stored ) ? $stored : array() );
		$ui     = $all['admin']['ui'];
		if ( defined( 'DONATION_PANEL_ADMIN_UI' ) && in_array( DONATION_PANEL_ADMIN_UI, self::ADMIN_UIS, true ) ) {
			$ui = (string) DONATION_PANEL_ADMIN_UI;
		}

		/**
		 * Yönetici ekranı seçimini değiştirir.
		 *
		 * @param string $ui `legacy` ya da `new`.
		 */
		$ui = (string) apply_filters( 'donation_panel_admin_ui', $ui );
		return 'new' === $ui;
	}

	/**
	 * Değeri tipe çevirir.
	 *
	 * @param mixed  $value         Ham değer.
	 * @param string $type          bool|int|string|text.
	 * @param mixed  $default_value Varsayılan.
	 * @return mixed
	 */
	private static function cast( $value, $type, $default_value ) {
		switch ( $type ) {
			case 'bool':
				return in_array( $value, array( true, 1, '1', 'yes', 'true', 'on' ), true );
			case 'int':
				return is_numeric( $value ) ? (int) $value : $default_value;
			case 'text':
				return is_scalar( $value ) ? sanitize_textarea_field( (string) $value ) : $default_value;
			case 'string':
				return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : $default_value;
		}
		return $default_value;
	}

	/**
	 * Bellek önbelleğini boşaltır (test/göç sonrası).
	 *
	 * @return void
	 */
	public function flush() {
		$this->data = null;
	}
}
