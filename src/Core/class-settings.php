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
	 * Her istekte okunan, küçük ve otomatik yüklenen seçenekler (ek sorgu yok; toplam ≤5 KB).
	 */
	const AUTOLOAD_FLAG    = 'donation_panel_autoload_v2';
	const AUTOLOAD_OPTIONS = array(
		'donation_panel_settings',
		'donation_panel_migrations',
		'wdp_placement_settings',
		'wdp_button_settings',
		'wdp_success_settings',
		'wdp_list_cache_version',
	);

	/**
	 * Bu seçenek otomatik yüklenmeli mi (yazan kodlar `update_option` üçüncü bağımsız değişkeni için kullanır).
	 *
	 * @param string $name Seçenek adı.
	 * @return bool
	 */
	public static function autoload_for( $name ) {
		return in_array( (string) $name, self::AUTOLOAD_OPTIONS, true );
	}

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
			'general'    => array(
				'delete_data_on_uninstall' => array(
					'type'    => 'bool',
					'default' => false,
				),
				// Ön yüzü kapatır (DONATION_PANEL_DISABLE sabitiyle aynı etki): bağışçı yüzeyi çıktısı 0; sepet/sipariş sürer.
				'disable_frontend'         => array(
					'type'    => 'bool',
					'default' => false,
				),
				// Güvenilen ters vekil/CDN adresleri (satır başına bir IP/CIDR); boşsa yalnız REMOTE_ADDR kullanılır.
				'trusted_proxies'          => array(
					'type'    => 'text',
					'default' => '',
				),
			),
			// Doğrudan (sepetsiz) bağış = ödeme davranışı (düzenden bağımsız). Öncelik: ürün (`_donation_panel_direct`) >
			// bağış türü (`type_*`: '' genel ayarı kullan | cart | direct) > genel (`enabled`). Bkz. Direct_Settings::decide().
			'direct'     => array(
				'enabled'       => array(
					'type'    => 'bool',
					'default' => false,
				),
				'type_fixed'    => array(
					'type'    => 'string',
					'default' => '',
				),
				'type_custom'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'type_shares'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'type_campaign' => array(
					'type'    => 'string',
					'default' => '',
				),
				'type_addon'    => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			// Yan sepet: sağ altta yüzen düğme (tema kendi sepet simgesini gösteriyorsa kapatılabilir).
			'side_cart'  => array(
				'floating'        => array(
					'type'    => 'bool',
					'default' => true,
				),
				// Yüzen düğme köşesi: 'end' sağ alt (sağdan sola sitelerde sol alt), 'start' tersi.
				'position'        => array(
					'type'    => 'string',
					'default' => 'end',
				),
				// Ek bağış önerisi (12.3): kapalıysa öneri yok (`donation_panel_side_cart_suggestion` filtresi yine çalışır).
				'suggest'         => array(
					'type'    => 'bool',
					'default' => false,
				),
				'suggest_product' => array(
					'type'    => 'int',
					'default' => 0,
				),
				'suggest_amounts' => array(
					'type'    => 'string',
					'default' => '',
				),
				'suggest_hint'    => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			'impact'     => array(
				'map' => array(
					'type'    => 'text',
					'default' => '',
				),
			),
			// Kampanya ilerleme çubuğu (tüm yüzeyler): kişisel önizleme, dolum + sayma animasyonu, hedefte kutlama.
			'progress'   => array(
				'preview'   => array(
					'type'    => 'bool',
					'default' => true,
				),
				'count'     => array(
					'type'    => 'bool',
					'default' => true,
				),
				'celebrate' => array(
					'type'    => 'bool',
					'default' => true,
				),
			),
			'thanks'     => array(
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
			'tax_relief' => array(
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
			'design'     => array(
				'colors'            => array(
					'type'    => 'string',
					'default' => 'theme',
				),
				'brand'             => array(
					'type'    => 'string',
					'default' => '',
				),
				'accent'            => array(
					'type'    => 'string',
					'default' => '',
				),
				'button_text'       => array(
					'type'    => 'string',
					'default' => '',
				),
				'button_full_width' => array(
					'type'    => 'bool',
					'default' => false,
				),
			),
			'display'    => array(
				'mode' => array(
					'type'    => 'string',
					'default' => 'panel',
				),
			),
			// Compact bağış kartı (`layout="compact"`): hızlı tutar sayısı (0–3), ilk bağış çağrısı, gizlenince başa dönme.
			'compact'    => array(
				'quick_amounts' => array(
					'type'    => 'int',
					'default' => 3,
				),
				'first_text'    => array(
					'type'    => 'string',
					'default' => '',
				),
				'reset_hidden'  => array(
					'type'    => 'bool',
					'default' => false,
				),
				// Düğmenin üstünde kilit simgeli "Güvenli ödeme" satırı (12.3 compact v2).
				'trust'         => array(
					'type'    => 'bool',
					'default' => true,
				),
			),
			'form'       => array(
				'presets_enabled'  => array(
					'type'    => 'bool',
					'default' => false,
				),
				'presets'          => array(
					'type'    => 'string',
					'default' => '',
				),
				'donor_email'      => array(
					'type'    => 'bool',
					'default' => false,
				),
				'dedication'       => array(
					'type'    => 'bool',
					'default' => false,
				),
				'dedication_label' => array(
					'type'    => 'string',
					'default' => '',
				),
				'anonymous'        => array(
					'type'    => 'bool',
					'default' => false,
				),
				'multi_step'       => array(
					'type'    => 'bool',
					'default' => false,
				),
				'trust_enabled'    => array(
					'type'    => 'bool',
					'default' => false,
				),
				'trust_text'       => array(
					'type'    => 'string',
					'default' => '',
				),
				'privacy_notice'   => array(
					'type'    => 'bool',
					'default' => false,
				),
				'privacy_text'     => array(
					'type'    => 'string',
					'default' => '',
				),
				'privacy_url'      => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			'shares'     => array(
				'header_text' => array(
					'type'    => 'string',
					'default' => '',
				),
				'copy_button' => array(
					'type'    => 'bool',
					'default' => false,
				),
				'email'       => array(
					'type'    => 'bool',
					'default' => false,
				),
			),
			'placement'  => array(
				'auto_place'  => array(
					'type'    => 'bool',
					'default' => true,
				),
				'position'    => array(
					'type'    => 'string',
					'default' => 'replace_cart',
				),
				'hide_price'  => array(
					'type'    => 'bool',
					'default' => true,
				),
				'show_title'  => array(
					'type'    => 'bool',
					'default' => false,
				),
				'loop_button' => array(
					'type'    => 'string',
					'default' => 'panel',
				),
				'scope'       => array(
					'type'    => 'string',
					'default' => 'all',
				),
				'categories'  => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			'checkout'   => array(
				'addon_product_id' => array(
					'type'    => 'int',
					'default' => 0,
				),
				'addon_label'      => array(
					'type'    => 'string',
					'default' => '',
				),
			),
			'admin'      => array(
				'wizard'      => array(
					'type'    => 'string',
					'default' => '',
				),
				'wizard_step' => array(
					'type'    => 'int',
					'default' => 1,
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
		// Her istekte okunan küçük kayıt: otomatik yüklenir (ayrı sorgu yok; CLAUDE.md §24 autoload ≤5 KB).
		return (bool) update_option( self::OPTION_NAME, $this->data, true );
	}

	/**
	 * Her istekte okunan küçük seçenekleri bir kez otomatik yüklemeye çevirir (sıfır ek sorgu). Eski sürümlerde bu
	 * kayıtlar `autoload=no` yazılmıştı; her sayfa isteğinde ayrı bir SELECT harcıyorlardı. Bayrak otomatik yüklenir,
	 * sonraki isteklerde bu işlev sorgu yapmaz. İdempotent.
	 *
	 * @return void
	 */
	public static function ensure_autoload() {
		if ( get_option( self::AUTOLOAD_FLAG, false ) ) {
			return;
		}
		$values = array();
		foreach ( self::AUTOLOAD_OPTIONS as $name ) {
			if ( false !== get_option( $name, false ) ) {
				$values[ $name ] = 'yes';
			} elseif ( 'donation_panel_settings' === $name ) {
				// Kayıt yoksa WordPress her istekte boşuna sorgular: varsayılanı (okuma davranışıyla aynı) otomatik yüklenen kayıt olarak yaz.
				add_option( $name, self::normalize( array() ), '', true );
			} elseif ( 'wdp_button_settings' === $name || 'wdp_success_settings' === $name ) {
				// Kayıt yoksa her istekte tek SELECT harcanır: boş dizi (okuma varsayılanıyla aynı) otomatik yüklenen kayıt olarak yazılır.
				add_option( $name, array(), '', true );
			} elseif ( 'wdp_placement_settings' === $name ) {
				add_option( $name, \DonationPanel\Domain\Placement_Settings::normalize( array( 'auto_place' => 'no' ) ), '', true );
			}
		}
		if ( $values && function_exists( 'wp_set_option_autoload_values' ) ) {
			wp_set_option_autoload_values( $values );
		} elseif ( $values ) {
			global $wpdb;
			if ( is_object( $wpdb ) && isset( $wpdb->options ) && method_exists( $wpdb, 'update' ) ) {
				foreach ( array_keys( $values ) as $name ) {
					$wpdb->update( $wpdb->options, array( 'autoload' => 'yes' ), array( 'option_name' => $name ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- WP 6.4 öncesi yedeği; tek seferlik.
				}
				wp_cache_delete( 'alloptions', 'options' );
			}
		}
		update_option( self::AUTOLOAD_FLAG, '1', true );
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
	 * Yeni kurulumda (hiç ayar ve eski sürüm izi yok) varsayılan ayar kaydını yazar; mevcut kurulumda hiçbir şey yapmaz.
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
		$seed = self::normalize( array() );
		return (bool) update_option( self::OPTION_NAME, $seed, true );
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
