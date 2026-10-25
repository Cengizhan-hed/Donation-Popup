<?php
/**
 * Modül başına tembel varlık kaydı: tüm tanımlar yalnız KAYIT edilir (çıktı yok); bir modül
 * ihtiyaç duyduğunda `enqueue( $slug )` ile kuyruğa alınır.
 *
 * Derleme çıktısı (`wp-scripts`): `assets/build/<slug>/index.js|.css` + `index.asset.php` (bağımlılık + sürüm).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Frontend;

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
	 * Modül varlıklarını tanımlar (yalnız tanım; kayıt `register_all` içinde).
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
	 * Tanımlı modül varlıklarını kaydeder (kuyruğa ALMAZ).
	 *
	 * @return void
	 */
	public function register_all() {
		foreach ( $this->definitions as $slug => $definition ) {
			$handle = self::handle( $slug );

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
	}

	/**
	 * Modülün kayıtlı varlıklarını kuyruğa alır.
	 *
	 * @param string $slug Modül slug'ı.
	 * @return void
	 */
	public function enqueue( $slug ) {
		$handle = self::handle( $slug );
		if ( wp_script_is( $handle, 'registered' ) ) {
			wp_enqueue_script( $handle );
		}
		if ( wp_style_is( $handle, 'registered' ) ) {
			wp_enqueue_style( $handle );
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
