<?php
/**
 * Modül başına tembel varlık kaydı (CLAUDE.md §24 sıfır yük): tanımlar yalnız bellekte tutulur; kayıt VE kuyruk
 * yalnız bir yüzey çizilirken `enqueue( $slug )` ile yapılır. Koşulsuz `wp_enqueue_scripts` kancası yoktur.
 *
 * Derleme çıktısı (`wp-scripts`): `assets/build/<slug>/index.js|.css` + `index.asset.php` (bağımlılık + sürüm).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Frontend;

use DonationPanel\Core\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Assets.
 */
class Assets {

	/**
	 * Eklenti kök dizini (sonunda eğik çizgi).
	 *
	 * @var string
	 */
	private $plugin_dir;

	/**
	 * Eklenti kök URL'si (sonunda eğik çizgi).
	 *
	 * @var string
	 */
	private $plugin_url;

	/**
	 * Tanımlar: slug => [ script, style ] (eklenti köküne göreli yollar).
	 *
	 * @var array<string, array{script: string, style: string}>
	 */
	private $definitions = array();

	/**
	 * Kaydı yapılmış slug'lar.
	 *
	 * @var array<string, bool>
	 */
	private $registered = array();

	/**
	 * Kurucu.
	 *
	 * @param string $plugin_dir Eklenti kök dizini.
	 * @param string $plugin_url Eklenti kök URL'si.
	 */
	public function __construct( $plugin_dir, $plugin_url ) {
		$this->plugin_dir = rtrim( (string) $plugin_dir, '/\\' ) . '/';
		$this->plugin_url = rtrim( (string) $plugin_url, '/' ) . '/';
	}

	/**
	 * Modül varlıklarını tanımlar (yalnız tanım; kayıt `register` içinde, çizim anında).
	 *
	 * @param string $slug   Modül slug'ı.
	 * @param string $script Göreli betik yolu ('' = yok).
	 * @param string $style  Göreli stil yolu ('' = yok).
	 * @return void
	 */
	public function define( $slug, $script = '', $style = '' ) {
		$slug = sanitize_key( $slug );
		if ( '' !== $slug ) {
			$this->definitions[ $slug ] = array(
				'script' => ltrim( (string) $script, '/' ),
				'style'  => ltrim( (string) $style, '/' ),
			);
		}
	}

	/**
	 * Varlık tutamacı.
	 *
	 * @param string $slug Modül slug'ı.
	 * @return string
	 */
	public static function handle( $slug ) {
		return 'donation-panel-' . sanitize_key( $slug );
	}

	/**
	 * Tek modülün varlıklarını kaydeder (kuyruğa ALMAZ); kayıt tembeldir: yalnız çizim anında, bir kez.
	 *
	 * @param string $slug Modül slug'ı.
	 * @return void
	 */
	public function register( $slug ) {
		$slug = sanitize_key( $slug );
		if ( ! isset( $this->definitions[ $slug ] ) || isset( $this->registered[ $slug ] ) ) {
			return;
		}
		$this->registered[ $slug ] = true;
		$definition                = $this->definitions[ $slug ];
		$handle                    = self::handle( $slug );

		if ( '' !== $definition['script'] && is_file( $this->plugin_dir . $definition['script'] ) ) {
			$meta = $this->read_asset_meta( $definition['script'] );
			wp_register_script(
				$handle,
				$this->plugin_url . $definition['script'],
				$meta['dependencies'],
				$meta['version'],
				array(
					'in_footer' => true,
					'strategy'  => 'defer',
				)
			);
		}
		if ( '' !== $definition['style'] && is_file( $this->plugin_dir . $definition['style'] ) ) {
			$meta = $this->read_asset_meta( $definition['script'] ? $definition['script'] : $definition['style'] );
			wp_register_style( $handle, $this->plugin_url . $definition['style'], array(), $meta['version'] );
		}
	}

	/**
	 * Tanımlı tüm modül varlıklarını kaydeder (kuyruğa ALMAZ). Çekirdek bunu bir kancaya BAĞLAMAZ (sıfır yük
	 * kuralı); yalnız araçlar ve testler içindir.
	 *
	 * @return void
	 */
	public function register_all() {
		foreach ( array_keys( $this->definitions ) as $slug ) {
			$this->register( (string) $slug );
		}
	}

	/**
	 * Modülün varlıklarını çizim anında kaydedip kuyruğa alır. Blok temalarında içerik `wp_enqueue_scripts`
	 * öncesi çizilse de çalışır (kayıt ve kuyruk aynı çağrıdadır; çıktıyı WordPress `wp_head`/`wp_footer`'da yapar).
	 * `DONATION_PANEL_DISABLE` açıkken hiçbir şey yapmaz.
	 *
	 * @param string $slug Modül slug'ı.
	 * @return void
	 */
	public function enqueue( $slug ) {
		if ( Front_Gate::disabled() ) {
			return;
		}
		$slug   = sanitize_key( $slug );
		$handle = self::handle( $slug );
		$this->register( $slug );
		if ( wp_script_is( $handle, 'registered' ) ) {
			wp_enqueue_script( $handle );
		}
		if ( wp_style_is( $handle, 'registered' ) ) {
			wp_enqueue_style( $handle );
			$this->add_brand_variables( $handle );
		}
	}

	/**
	 * Yönetici "kendi renklerimi seçeyim" dediyse marka/eylem rengini tüm bağışçı yüzeylerine (form, teşekkür,
	 * yan sepet, hesap) tek satır içi belirteçle yazar. Boşsa hiçbir şey yazılmaz: renkler tema ön ayarından gelir.
	 * `:root .dp` seçicisi `.dp` kapsamındaki varsayılan tanımın önüne geçer. İstek başına bir kez eklenir.
	 *
	 * @param string $handle Stil tutamacı.
	 * @return void
	 */
	private function add_brand_variables( $handle ) {
		static $added = false;
		if ( $added ) {
			return;
		}
		$added    = true;
		$settings = new Settings();
		if ( 'custom' !== (string) $settings->get( 'design.colors', 'theme' ) ) {
			return;
		}
		$declarations = '';
		foreach ( array(
			'design.brand'  => '--dp-color-primary',
			'design.accent' => '--dp-accent',
		) as $path => $variable ) {
			$hex = trim( (string) $settings->get( $path, '' ) );
			if ( 1 === preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $hex ) ) {
				$declarations .= $variable . ':' . $hex . ';';
			}
		}
		if ( '' !== $declarations ) {
			wp_add_inline_style( $handle, ':root .dp{' . $declarations . '}' );
		}
	}

	/**
	 * `index.asset.php` dosyasından bağımlılık + sürüm okur; yoksa eklenti sürümü.
	 *
	 * @param string $relative_file Göreli betik/stil yolu.
	 * @return array{dependencies: string[], version: string}
	 */
	private function read_asset_meta( $relative_file ) {
		$meta = array(
			'dependencies' => array(),
			'version'      => defined( 'WDP_VERSION' ) ? (string) WDP_VERSION : '1',
		);

		$asset_file = $this->plugin_dir . preg_replace( '/\.(js|css)$/', '.asset.php', $relative_file );
		if ( is_file( $asset_file ) ) {
			$data = include $asset_file;
			if ( is_array( $data ) ) {
				$meta['dependencies'] = isset( $data['dependencies'] ) && is_array( $data['dependencies'] ) ? array_map( 'strval', $data['dependencies'] ) : array();
				$meta['version']      = isset( $data['version'] ) ? (string) $data['version'] : $meta['version'];
			}
		}
		return $meta;
	}
}
