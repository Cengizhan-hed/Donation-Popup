<?php
/**
 * Yönetici ayarlarının okuma/yazma katmanı: doğrulama, Core ayarına yazma ve eski seçenek yansıtması.
 *
 * Okuma sırası: Core ayarında açıkça kaydedilmiş değer; yoksa eski `wdp_*` seçeneğindeki değer (yükseltilen
 * kurulumda hiçbir ayar kaybolmaz); yoksa şema varsayılanı.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Settings_Store.
 */
final class Settings_Store {

	/**
	 * Ayarlar.
	 *
	 * @var Settings
	 */
	private $settings;

	/**
	 * Modül kayıt defteri (modül anahtarları için).
	 *
	 * @var Module_Registry|null
	 */
	private $registry;

	/**
	 * Kurucu.
	 *
	 * @param Settings             $settings Ayarlar.
	 * @param Module_Registry|null $registry Modül kayıt defteri.
	 */
	public function __construct( Settings $settings, $registry = null ) {
		$this->settings = $settings;
		$this->registry = $registry;
	}

	/**
	 * Anahtarla yönetilen modüller (slug => [ etiket, açıklama ]); yeni yönetici ekranında gösterilen sıra.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public static function module_definitions() {
		return array(
			'campaign'      => array(
				__( 'Campaign and progress bars', 'woo-donation-popup' ),
				__( 'Goal, amount raised and days left', 'woo-donation-popup' ),
			),
			'impact'        => array(
				__( 'Impact phrases', 'woo-donation-popup' ),
				__( 'Shows what an amount will do', 'woo-donation-popup' ),
			),
			'side_cart'     => array(
				__( 'Side cart', 'woo-donation-popup' ),
				__( 'Complete several gifts in one go', 'woo-donation-popup' ),
			),
			'donor_account' => array(
				__( 'Donor account', 'woo-donation-popup' ),
				__( 'Sign in, register and My donations', 'woo-donation-popup' ),
			),
			'social_proof'  => array(
				__( 'Social proof', 'woo-donation-popup' ),
				__( 'Real donor counts, no personal details', 'woo-donation-popup' ),
			),
			'thanks'        => array(
				__( 'Thank-you screen', 'woo-donation-popup' ),
				__( 'A warm confirmation after the order', 'woo-donation-popup' ),
			),
			'tax_relief'    => array(
				__( 'Tax relief declaration', 'woo-donation-popup' ),
				__( 'One question; a yes saves name and address on the order', 'woo-donation-popup' ),
			),
		);
	}

	/**
	 * Modül açık mı (kayıt defteri varsa onun kararı, yoksa ayar).
	 *
	 * @param string $slug Modül.
	 * @return bool
	 */
	public function module_enabled( $slug ) {
		if ( null !== $this->registry ) {
			return (bool) $this->registry->is_enabled( $slug );
		}
		return $this->settings->module_enabled( $slug, false );
	}

	/**
	 * Bir alanın geçerli değeri.
	 *
	 * @param string $id Alan kimliği (grup.anahtar).
	 * @return mixed
	 */
	public function get( $id ) {
		$fields              = Field_Registry::fields();
		list( $group, $key ) = explode( '.', $id, 2 );
		$stored              = get_option( Settings::OPTION_NAME, array() );
		if ( is_array( $stored ) && isset( $stored[ $group ] ) && is_array( $stored[ $group ] ) && array_key_exists( $key, $stored[ $group ] ) ) {
			return $this->settings->get( $id );
		}
		if ( isset( $fields[ $id ]['legacy'] ) ) {
			$legacy = $this->read_legacy( $fields[ $id ]['legacy'] );
			if ( null !== $legacy ) {
				return $legacy;
			}
		}
		return $this->settings->get( $id );
	}

	/**
	 * Eski seçenekten değer okur (yoksa null) ve yeni modele çevirir.
	 *
	 * @param array<string, mixed> $legacy Eşleme.
	 * @return mixed|null
	 */
	private function read_legacy( array $legacy ) {
		$option = get_option( (string) $legacy['option'], null );
		if ( '' === $legacy['key'] ) {
			if ( null === $option ) {
				return null;
			}
			$raw = $option;
		} else {
			if ( ! is_array( $option ) || ! array_key_exists( $legacy['key'], $option ) ) {
				return null;
			}
			$raw = $option[ $legacy['key'] ];
		}
		switch ( $legacy['kind'] ) {
			case 'flag01':
				return in_array( $raw, array( '1', 1, true, 'yes' ), true );
			case 'yesno':
				return 'yes' === $raw;
			case 'map':
				$flip = array_flip( $legacy['map'] );
				return isset( $flip[ $raw ] ) ? $flip[ $raw ] : null;
			case 'idlist':
				return is_array( $raw ) ? implode( ', ', array_map( 'absint', $raw ) ) : (string) $raw;
		}
		return is_scalar( $raw ) ? $raw : null;
	}

	/**
	 * Gelen değeri alan tipine göre temizler. Geçersizse WP_Error.
	 *
	 * @param string $id    Alan.
	 * @param mixed  $value Ham değer.
	 * @return mixed|\WP_Error
	 */
	public function sanitize_value( $id, $value ) {
		$fields = Field_Registry::fields();
		if ( ! isset( $fields[ $id ] ) ) {
			return new \WP_Error( 'unknown_field', __( 'Unknown setting.', 'woo-donation-popup' ) );
		}
		$spec = $fields[ $id ];
		switch ( $spec['type'] ) {
			case 'switch':
				return in_array( $value, array( true, 1, '1', 'yes', 'true', 'on' ), true );
			case 'int':
				return max( 0, absint( $value ) );
			case 'textarea':
				return is_scalar( $value ) ? sanitize_textarea_field( (string) $value ) : '';
			case 'color':
				// Hex ya da CSS değişkeni (`var(--ad)`, `var(--ad, #yedek)`); başka her şey reddedilir (CSS enjeksiyonu yok).
				$raw   = is_scalar( $value ) ? trim( (string) $value ) : '';
				$color = \DonationPanel\Frontend\Theme_Colors::sanitize_color( $raw );
				if ( '' !== $raw && '' === $color ) {
					return new \WP_Error( 'invalid_color', __( 'Enter a color like #12305A or a CSS variable like var(--brand).', 'woo-donation-popup' ) );
				}
				return $color;
			case 'url':
				$raw = is_scalar( $value ) ? trim( (string) $value ) : '';
				return '' === $raw ? '' : esc_url_raw( $raw );
			case 'select':
			case 'cards':
				$allowed = array_map( 'strval', array_keys( $spec['options'] ) );
				$clean   = is_scalar( $value ) ? sanitize_key( (string) $value ) : '';
				if ( ! in_array( $clean, $allowed, true ) ) {
					return new \WP_Error( 'invalid_choice', __( 'Choose one of the listed options.', 'woo-donation-popup' ) );
				}
				return $clean;
		}

		$text = is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
		if ( 'form.presets' === $id && '' !== $text ) {
			return $this->sanitize_presets( $text );
		}
		if ( 'placement.categories' === $id ) {
			$ids = array_values( array_unique( array_filter( array_map( 'absint', explode( ',', $text ) ) ) ) );
			return implode( ',', $ids );
		}
		return $text;
	}

	/**
	 * Hızlı tutar listesi: sayılar, en çok 6, tekrar yok.
	 *
	 * @param string $text Virgülle ayrılmış sayılar.
	 * @return string|\WP_Error
	 */
	private function sanitize_presets( $text ) {
		$parts = array_filter(
			array_map( 'trim', explode( ',', $text ) ),
			static function ( $part ) {
				return '' !== $part;
			}
		);
		$out   = array();
		foreach ( $parts as $part ) {
			if ( ! preg_match( '/^\d+(?:[.]\d+)?$/', $part ) || (float) $part <= 0 ) {
				return new \WP_Error( 'invalid_presets', __( 'Use plain numbers separated by commas, for example 25, 50, 100.', 'woo-donation-popup' ) );
			}
			$out[ $part ] = $part;
		}
		if ( count( $out ) > 6 ) {
			return new \WP_Error( 'too_many_presets', __( 'Use at most six amounts.', 'woo-donation-popup' ) );
		}
		return implode( ', ', $out );
	}

	/**
	 * Birden çok alanı ve modül anahtarını doğrular ve yazar. Tek geçersiz değerde hiçbir şey yazılmaz.
	 *
	 * @param array<string, mixed> $fields  Alan kimliği => değer.
	 * @param array<string, mixed> $modules Modül slug'ı => bool.
	 * @return array<string, mixed>|\WP_Error Yazılan değerler.
	 */
	public function save( array $fields, array $modules = array() ) {
		$patch   = array();
		$clean   = array();
		$allowed = self::module_definitions();

		foreach ( $fields as $id => $value ) {
			$value = $this->sanitize_value( (string) $id, $value );
			if ( is_wp_error( $value ) ) {
				return new \WP_Error(
					$value->get_error_code(),
					$value->get_error_message(),
					array(
						'field'  => (string) $id,
						'status' => 400,
					)
				);
			}
			list( $group, $key )     = explode( '.', (string) $id, 2 );
			$patch[ $group ][ $key ] = $value;
			$clean[ $id ]            = $value;
		}
		foreach ( $modules as $slug => $state ) {
			$slug = sanitize_key( (string) $slug );
			if ( ! isset( $allowed[ $slug ] ) ) {
				return new \WP_Error( 'unknown_module', __( 'Unknown module.', 'woo-donation-popup' ), array( 'status' => 400 ) );
			}
			$patch['modules'][ $slug ] = in_array( $state, array( true, 1, '1', 'yes', 'true', 'on' ), true );
		}

		if ( empty( $patch ) ) {
			return array();
		}
		$this->settings->update( $patch );
		$this->mirror( array_keys( $clean ) );
		return $clean;
	}

	/**
	 * Eski seçenekleri yansıtır: form motoru onları okuduğu sürece yeni ekranda yapılan değişiklik etkili olur.
	 * Yalnız eşlemesi olan alanlar; seçenekteki başka anahtarlara dokunulmaz.
	 *
	 * @param string[] $ids Yazılan alanlar.
	 * @return void
	 */
	public function mirror( array $ids ) {
		$fields  = Field_Registry::fields();
		$touched = false;
		if ( in_array( 'design.colors', $ids, true ) ) {
			$ids = array_unique( array_merge( $ids, array( 'design.brand', 'design.accent' ) ) );
		}
		foreach ( $ids as $id ) {
			$spec = $fields[ $id ];
			if ( empty( $spec['legacy'] ) ) {
				continue;
			}
			if ( isset( $spec['only_when'] ) && (string) $this->settings->get( $spec['only_when'][0] ) !== (string) $spec['only_when'][1] ) {
				continue;
			}
			$legacy = $spec['legacy'];
			$value  = $this->get( $id );
			if ( 'color' === $spec['type'] && '' === $value ) {
				continue;
			}
			switch ( $legacy['kind'] ) {
				case 'flag01':
					$out = $value ? '1' : '0';
					break;
				case 'yesno':
					$out = $value ? 'yes' : 'no';
					break;
				case 'map':
					$out = isset( $legacy['map'][ $value ] ) ? $legacy['map'][ $value ] : $value;
					break;
				case 'idlist':
					$out = array_values( array_filter( array_map( 'absint', explode( ',', (string) $value ) ) ) );
					break;
				default:
					$out = $value;
			}
			if ( '' === $legacy['key'] ) {
				if ( false === get_option( $legacy['option'], false ) ) {
					add_option( $legacy['option'], $out, '', \DonationPanel\Core\Settings::autoload_for( $legacy['option'] ) );
				} else {
					update_option( $legacy['option'], $out, \DonationPanel\Core\Settings::autoload_for( $legacy['option'] ) );
				}
				continue;
			}
			$option                   = get_option( $legacy['option'], array() );
			$option                   = is_array( $option ) ? $option : array();
			$option[ $legacy['key'] ] = $out;
			if ( false === get_option( $legacy['option'], false ) ) {
				add_option( $legacy['option'], $option, '', \DonationPanel\Core\Settings::autoload_for( $legacy['option'] ) );
			} else {
				update_option( $legacy['option'], $option, \DonationPanel\Core\Settings::autoload_for( $legacy['option'] ) );
			}
			$touched = true;
		}
		if ( $touched ) {
			update_option( 'wdp_cache_version', time() );
		}
	}
}
