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
	 * Bellekteki önbellek.
	 *
	 * @var array<string, mixed>|null
	 */
	private $data = null;

	/**
	 * Şema: grup => [ anahtar => [ type, default ] ]. Tip: bool|int|string.
	 *
	 * @return array<string, array<string, array{type: string, default: mixed}>>
	 */
	public static function schema() {
		return array(
			'general' => array(
				'delete_data_on_uninstall' => array(
					'type'    => 'bool',
					'default' => false,
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
		return $out;
	}

	/**
	 * Değeri tipe çevirir.
	 *
	 * @param mixed  $value         Ham değer.
	 * @param string $type          bool|int|string.
	 * @param mixed  $default_value Varsayılan.
	 * @return mixed
	 */
	private static function cast( $value, $type, $default_value ) {
		switch ( $type ) {
			case 'bool':
				return in_array( $value, array( true, 1, '1', 'yes', 'true', 'on' ), true );
			case 'int':
				return is_numeric( $value ) ? (int) $value : $default_value;
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
