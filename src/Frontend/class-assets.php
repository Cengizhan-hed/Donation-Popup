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
	 * Bu istekte stili gereken slug'lar (çizim sırasıyla): slug => satır içi basıldı mı.
	 *
	 * @var array<string, bool>
	 */
	private $styles = array();

	/**
	 * Marka renk belirteçleri bu istekte basıldı mı.
	 *
	 * @var bool
	 */
	private $brand_printed = false;

	/**
	 * `wp_footer` yedeği bağlandı mı.
	 *
	 * @var bool
	 */
	private $footer_hooked = false;

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
	 * Modülün betiğini çizim anında kaydedip kuyruğa alır ve stilini bu istek için "gerekli" işaretler.
	 * `DONATION_PANEL_DISABLE` açıkken hiçbir şey yapmaz.
	 *
	 * Stil `<link>` olarak YÜKLENMEZ (CLAUDE.md §25, stilsiz görünmeye sıfır tolerans): derlenmiş CSS, yüzey çizilirken
	 * çıktının hemen önüne satır içi `<style>` olarak basılır (`inline_styles()`), sayfa başına bir kez. Böylece her
	 * sayfa oluşturucuda, slider'da, editör önizlemesinde ve AJAX/REST çıktısında ilk karede stillidir; render engelleyen
	 * dosya yoktur. Çağıran yüzey kendi çıktısının önüne `inline_styles()` eklemediyse (ör. döngü kartı düğmesi) stil
	 * `wp_footer` içinde basılır; betikler `defer` olduğundan katman açılmadan önce her zaman yerindedir.
	 *
	 * @param string $slug        Modül slug'ı.
	 * @param bool   $defer_style Geriye dönük imza (artık etkisiz; stil her zaman satır içi).
	 * @param bool   $with_style  Stil de gerekli mi (false: yalnız betik).
	 * @return void
	 */
	public function enqueue( $slug, $defer_style = false, $with_style = true ) {
		unset( $defer_style );
		if ( Front_Gate::disabled() ) {
			return;
		}
		$slug   = sanitize_key( $slug );
		$handle = self::handle( $slug );
		$this->register( $slug );
		if ( wp_script_is( $handle, 'registered' ) ) {
			wp_enqueue_script( $handle );
		}
		if ( $with_style ) {
			$this->require_style( $slug );
		}
	}

	/**
	 * Yalnız stili bu istek için gerekli işaretler (betik kuyruğa alınmaz). Bir sonraki `inline_styles()` çağrısı ya da
	 * `wp_footer` yedeği basar. `DONATION_PANEL_DISABLE` açıkken hiçbir şey yapmaz.
	 *
	 * @param string $slug Modül slug'ı.
	 * @return void
	 */
	public function require_style( $slug ) {
		$slug = sanitize_key( $slug );
		if ( Front_Gate::disabled() || ! isset( $this->definitions[ $slug ] ) || '' === $this->definitions[ $slug ]['style'] || isset( $this->styles[ $slug ] ) ) {
			return;
		}
		$this->styles[ $slug ] = false;
		if ( ! $this->footer_hooked ) {
			$this->footer_hooked = true;
			add_action( 'wp_footer', array( $this, 'print_pending_styles' ), 1 );
		}
	}

	/**
	 * Gerekli ama henüz basılmamış modül stillerini satır içi `<style>` etiketleri olarak döndürür ve basıldı işaretler.
	 * Yüzeyler bunu kendi çıktılarının ÖNÜNE ekler; aynı istekte ikinci çağrı boş döner.
	 *
	 * @return string
	 */
	public function inline_styles() {
		$out = '';
		foreach ( $this->styles as $slug => $printed ) {
			if ( $printed ) {
				continue;
			}
			$this->styles[ $slug ] = true;
			$css                   = $this->style_css( (string) $slug );
			if ( '' === $css ) {
				continue;
			}
			$out .= '<style id="' . esc_attr( 'donation-panel-inline-' . str_replace( '_', '-', (string) $slug ) ) . '">' . $css . $this->brand_variables() . '</style>';
		}
		return $out;
	}

	/**
	 * `wp_footer` yedeği: çıktısının önüne stil eklemeyen yüzeylerin stilini basar.
	 *
	 * @return void
	 */
	public function print_pending_styles() {
		echo $this->inline_styles(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Eklentinin kendi derlenmiş CSS'i; `</` dizisi süzülür.
	}

	/**
	 * Modülün derlenmiş CSS'i (istek başına önbellekli). `</` dizisi çıkarılır (stil etiketinden kaçış yok).
	 *
	 * @param string $slug Modül slug'ı.
	 * @return string
	 */
	public function style_css( $slug ) {
		static $cache = array();
		$slug         = sanitize_key( $slug );
		if ( isset( $cache[ $this->plugin_dir . $slug ] ) ) {
			return $cache[ $this->plugin_dir . $slug ];
		}
		$file                               = isset( $this->definitions[ $slug ] ) && '' !== $this->definitions[ $slug ]['style'] ? $this->plugin_dir . $this->definitions[ $slug ]['style'] : '';
		$css                                = '' !== $file && is_file( $file ) ? trim( (string) file_get_contents( $file ) ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Eklenti içi yerel dosya.
		$css                                = str_replace( '</', '<\/', $css );
		$cache[ $this->plugin_dir . $slug ] = $css;
		return $css;
	}

	/**
	 * Yönetici "kendi renklerimi seçeyim" dediyse marka/eylem rengini tüm bağışçı yüzeylerine (form, teşekkür,
	 * yan sepet, hesap) tek belirteçle yazar (ilk satır içi stilin sonuna, istek başına bir kez). Boşsa hiçbir şey
	 * yazılmaz: renkler tema ön ayarından gelir. `:root .donation-panel` seçicisi varsayılan tanımın önüne geçer.
	 *
	 * @return string
	 */
	private function brand_variables() {
		if ( $this->brand_printed ) {
			return '';
		}
		$this->brand_printed = true;
		$settings            = new Settings();
		$custom              = 'custom' === (string) $settings->get( 'design.colors', 'theme' );
		$declarations        = Theme_Colors::declarations(
			$custom ? (string) $settings->get( 'design.brand', '' ) : '',
			$custom ? (string) $settings->get( 'design.accent', '' ) : ''
		);
		return '' !== $declarations ? ':root .donation-panel{' . $declarations . '}' : '';
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
