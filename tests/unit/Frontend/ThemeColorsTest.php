<?php
/**
 * Tema renkleri: palet kuralları, kontrast, boş palet (12.1 tema).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Frontend\Theme_Colors;
use PHPUnit\Framework\TestCase;

final class ThemeColorsTest extends TestCase {

	private function palette( array $pairs ): array {
		$out = array();
		foreach ( $pairs as $slug => $color ) {
			$out[] = array( 'slug' => $slug, 'color' => $color );
		}
		return $out;
	}

	/**
	 * Nötr varsayılanın beklenen değişkenleri.
	 *
	 * @return array<string, string>
	 */
	private function neutral(): array {
		return array(
			'--dp-color-primary'    => '#' . Theme_Colors::DEFAULT_PRIMARY,
			'--dp-color-on-primary' => '#ffffff',
			'--dp-accent'           => '#' . Theme_Colors::DEFAULT_PRIMARY,
			'--dp-color-on-accent'  => '#ffffff',
		);
	}

	public function test_empty_palette_yields_explicit_neutral_default(): void {
		$this->assertSame( $this->neutral(), Theme_Colors::variables( array() ) );
		$this->assertSame( $this->neutral(), Theme_Colors::variables( 'garbage' ) );
		$this->assertSame( $this->neutral(), Theme_Colors::variables( array( 'default' => $this->palette( array( 'primary' => '#0000ff' ) ) ) ), 'WP varsayılan paleti kullanılmaz.' );
		$this->assertGreaterThanOrEqual( 4.5, Theme_Colors::contrast( Theme_Colors::DEFAULT_PRIMARY, 'ffffff' ) );
	}

	/**
	 * Gerçek tema paletlerinin benzetimleri (slug + ad) ve beklenen sonuç.
	 *
	 * @return array<string, array{0: mixed, 1: string, 2: string, 3: string, 4: string, 5: string}>
	 */
	public static function theme_palettes(): array {
		$named = static function ( array $rows ): array {
			$out = array();
			foreach ( $rows as $row ) {
				$out[] = array(
					'slug'  => $row[0],
					'name'  => $row[1],
					'color' => $row[2],
				);
			}
			return $out;
		};
		$tt5   = $named(
			array(
				array( 'base', 'Base', '#FFFFFF' ),
				array( 'contrast', 'Contrast', '#111111' ),
				array( 'accent-1', 'Accent 1', '#FFEE58' ),
				array( 'accent-2', 'Accent 2', '#F6CFF4' ),
				array( 'accent-3', 'Accent 3', '#503AA8' ),
				array( 'accent-4', 'Accent 4', '#686868' ),
				array( 'accent-5', 'Accent 5', '#FBFAF3' ),
				array( 'accent-6', 'Accent 6', 'color-mix(in srgb, currentColor 20%, transparent)' ),
			)
		);
		// Rol adı olmayan klasik tema paleti (sayfa oluşturucu temaları gibi): kırmızı tonu canlı ama ADI rol değil.
		$roleless = $named(
			array(
				array( 'color1', 'Color 1', '#ffffff' ),
				array( 'color2', 'Color 2', '#f9f9fb' ),
				array( 'color3', 'Color 3', '#e2201c' ),
				array( 'color4', 'Color 4', '#65bc7b' ),
				array( 'color5', 'Color 5', '#198fd9' ),
				array( 'color8', 'Color 8', '#212934' ),
			)
		);
		$numbered = $named(
			array(
				array( 'palette-color-1', 'Palette Color 1', '#2872fa' ),
				array( 'palette-color-2', 'Palette Color 2', '#1559ed' ),
				array( 'palette-color-3', 'Palette Color 3', '#3A4F66' ),
				array( 'palette-color-8', 'Palette Color 8', '#ffffff' ),
			)
		);
		$by_name  = $named(
			array(
				array( 'c1', 'Primary', '#12305a' ),
				array( 'c2', 'Accent', '#c2511c' ),
			)
		);
		return array(
			'blok tema (TT5)'            => array( array( 'theme' => $tt5 ), 'theme', '111111', 'contrast', '503aa8', 'accent-3' ),
			'klasik, palet yok'          => array( array(), 'none', Theme_Colors::DEFAULT_PRIMARY, '', Theme_Colors::DEFAULT_PRIMARY, '' ),
			'palet var, rol adı yok'     => array( array( 'theme' => $roleless ), 'none', Theme_Colors::DEFAULT_PRIMARY, '', Theme_Colors::DEFAULT_PRIMARY, '' ),
			'numaralı "palette-color-N"' => array( array( 'theme' => $numbered ), 'none', Theme_Colors::DEFAULT_PRIMARY, '', Theme_Colors::DEFAULT_PRIMARY, '' ),
			'yalnız ad eşleşmesi'        => array( array( 'theme' => $by_name ), 'theme', '12305a', 'c1', 'c2511c', 'c2' ),
		);
	}

	/**
	 * @dataProvider theme_palettes
	 */
	public function test_role_mapping_for_theme_palettes( $palette, string $status, string $primary, string $primary_slug, string $action, string $action_slug ): void {
		$this->assertSame( $status, Theme_Colors::source_status( $palette ) );
		$res = Theme_Colors::resolve( $palette );
		$this->assertSame( $primary, $res['primary']['hex'] );
		$this->assertSame( $primary_slug, $res['primary']['slug'] );
		$this->assertSame( '' === $primary_slug ? 'default' : 'theme', $res['primary']['source'] );
		$this->assertSame( $action, $res['action']['hex'] );
		$this->assertSame( $action_slug, $res['action']['slug'] );
		$this->assertSame( '' === $action_slug ? 'primary' : 'theme', $res['action']['source'] );
		$v = Theme_Colors::variables( $palette );
		$this->assertSame( '#' . $primary, $v['--dp-color-primary'] );
		$this->assertSame( '#' . $action, $v['--dp-accent'] );
		$this->assertGreaterThanOrEqual( 4.5, Theme_Colors::contrast( $action, ltrim( $v['--dp-color-on-accent'], '#' ) ) );
	}

	public function test_source_labels(): void {
		$res = Theme_Colors::resolve( array( 'theme' => $this->palette( array( 'primary' => '#1d3557' ) ) ), '', '' );
		$this->assertSame( 'Theme palette: primary', Theme_Colors::source_label( $res['primary'] ) );
		$this->assertSame( 'Follows the main color', Theme_Colors::source_label( $res['action'] ) );
		$res = Theme_Colors::resolve( array(), '#123456', 'var(--cta)' );
		$this->assertSame( 'Your choice', Theme_Colors::source_label( $res['primary'] ) );
		$this->assertSame( 'Your choice', Theme_Colors::source_label( $res['action'] ) );
		$this->assertSame( 'Default', Theme_Colors::source_label( Theme_Colors::resolve( array() )['primary'] ) );
	}

	public function test_partial_when_only_action_role_matches(): void {
		$this->assertSame( 'partial', Theme_Colors::source_status( array( 'theme' => $this->palette( array( 'accent' => '#ff6a00' ) ) ) ) );
	}

	public function test_custom_colors_never_change_whatever_the_palette(): void {
		foreach ( array( array(), array( 'theme' => $this->palette( array( 'primary' => '#1d3557', 'accent' => '#e63946' ) ) ) ) as $palette ) {
			$v = Theme_Colors::variables( $palette, '#AbCdEf', '#123' );
			$this->assertSame( '#abcdef', $v['--dp-color-primary'] );
			$this->assertSame( '#112233', $v['--dp-accent'] );
		}
	}

	public function test_named_slugs_win(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#fff', 'primary' => '#1d3557', 'accent' => '#e63946' ) ) ) );
		$this->assertSame( '#1d3557', $v['--dp-color-primary'] );
		$this->assertSame( '#e63946', $v['--dp-accent'] );
		$this->assertSame( '#ffffff', $v['--dp-color-on-primary'] );
	}

	public function test_flat_list_and_short_hex(): void {
		$v = Theme_Colors::variables( $this->palette( array( 'primary' => '#036' ) ) );
		$this->assertSame( '003366', Theme_Colors::normalize_hex( '#036' ) );
		$this->assertSame( '#003366', $v['--dp-color-primary'] );
	}

	public function test_unnamed_dark_color_is_not_guessed(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'tint' => '#fafafa', 'ink' => '#1a1a2e' ) ) ) );
		$this->assertSame( $this->neutral(), $v, '12.3: rol adı olmayan renk tahmin edilmez.' );
	}

	public function test_named_primary_below_45_contrast_is_not_picked(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#8c8c8c', 'secondary' => '#14532d' ) ) ) );
		$this->assertSame( '#14532d', $v['--dp-color-primary'], 'Beyazda ~3.4:1 olan adlı renk seçilmez.' );
	}

	public function test_light_primary_name_is_skipped_for_unreadable_color(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#ffe08a', 'secondary' => '#14532d' ) ) ) );
		$this->assertSame( '#14532d', $v['--dp-color-primary'], 'Beyaz zeminde okunmayan ana renk atlanır.' );
	}

	public function test_action_never_takes_unnamed_vivid_color(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'primary' => '#222222', 'pop' => '#ff5a1f', 'vivid-red' => '#cf2e2e' ) ) ) );
		$this->assertSame( '#222222', $v['--dp-accent'], '12.3: "ilk canlı renk" ve "vivid" tahmini yok; düğme ana rengi izler.' );
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'primary' => '#222222', 'secondary' => '#b42318' ) ) ) );
		$this->assertSame( '#b42318', $v['--dp-accent'] );
	}

	public function test_button_text_always_meets_aa(): void {
		foreach ( array( '#e63946', '#ffd60a', '#767676', '#777777', '#0a0a0a', '#2a9d8f', '#ffffff', '#808080' ) as $bg ) {
			$on = Theme_Colors::text_on( $bg );
			$this->assertGreaterThanOrEqual( 4.5, Theme_Colors::contrast( ltrim( $bg, '#' ), ltrim( $on, '#' ) ), $bg );
		}
		$this->assertSame( '#000000', Theme_Colors::text_on( '#ffd60a' ) );
		$this->assertSame( '#ffffff', Theme_Colors::text_on( '#1d3557' ) );
		$this->assertSame( '', Theme_Colors::text_on( 'not-a-color' ) );
	}

	public function test_custom_colors_override_theme(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#1d3557' ) ) ), '#ffd60a', '#0a7' );
		$this->assertSame( '#ffd60a', $v['--dp-color-primary'] );
		$this->assertSame( '#000000', $v['--dp-color-on-primary'] );
		$this->assertSame( '#00aa77', $v['--dp-accent'] );
	}

	public function test_invalid_values_ignored(): void {
		$v = Theme_Colors::variables( array( 'theme' => array( array( 'slug' => 'primary', 'color' => 'var(--x)' ), array( 'slug' => 'accent', 'color' => 'red' ) ) ), 'javascript:1', '</style>' );
		$this->assertSame( $this->neutral(), $v );
	}

	public function test_source_status_none_for_empty_or_default_only_palette(): void {
		$this->assertSame( 'none', Theme_Colors::source_status( array() ) );
		$this->assertSame( 'none', Theme_Colors::source_status( 'garbage' ) );
		$this->assertSame( 'none', Theme_Colors::source_status( array( 'default' => $this->palette( array( 'primary' => '#0000ff' ) ) ) ) );
	}

	public function test_source_status_none_when_no_color_has_enough_contrast(): void {
		$this->assertSame( 'none', Theme_Colors::source_status( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'tint' => '#fafafa', 'soft' => '#ffe08a' ) ) ) ) );
	}

	public function test_sanitize_color_accepts_hex_and_css_variables(): void {
		$this->assertSame( '#12305A', Theme_Colors::sanitize_color( '#12305A' ) );
		$this->assertSame( '#abc', Theme_Colors::sanitize_color( ' #abc ' ) );
		$this->assertSame( 'var(--e-global-color-primary)', Theme_Colors::sanitize_color( 'var(--e-global-color-primary)' ) );
		$this->assertSame( 'var(--wp--preset--color--primary)', Theme_Colors::sanitize_color( 'var( --wp--preset--color--primary )' ) );
		$this->assertSame( 'var(--brand_2, #112233)', Theme_Colors::sanitize_color( 'var(--brand_2,#112233)' ) );
		$this->assertSame( 'var(--brand, #aabbcc)', Theme_Colors::sanitize_color( 'var(--brand, #ABC)' ) );
		$this->assertSame( '', Theme_Colors::sanitize_color( '' ) );
		$this->assertSame( '', Theme_Colors::sanitize_color( array( '#fff' ) ) );
	}

	/**
	 * @return array<string, array{0: string}>
	 */
	public static function injection_values(): array {
		return array(
			'url'            => array( 'url(https://x.test/a.png)' ),
			'expression'     => array( 'expression(alert(1))' ),
			'semicolon'      => array( 'var(--a);background:red' ),
			'brace'          => array( 'var(--a)}body{display:none' ),
			'style close'    => array( 'var(--a)</style><script>alert(1)</script>' ),
			'nested var'     => array( 'var(--a, var(--b))' ),
			'fallback word'  => array( 'var(--a, red)' ),
			'fallback url'   => array( 'var(--a, url(x))' ),
			'no dashes'      => array( 'var(a)' ),
			'bad name'       => array( 'var(--a b)' ),
			'quote'          => array( 'var(--a")' ),
			'newline'        => array( "var(--a)\n" . 'x' ),
			'trailing nl'    => array( "#fff\n;" ),
			'named color'    => array( 'red' ),
			'rgb'            => array( 'rgb(1,2,3)' ),
			'escape'         => array( 'var(--a\\3b)' ),
			'comment'        => array( 'var(--a/**/)' ),
			'too long'       => array( 'var(--' . str_repeat( 'a', 101 ) . ')' ),
			'javascript'     => array( 'javascript:alert(1)' ),
			'four digit hex' => array( '#abcd' ),
		);
	}

	/**
	 * @dataProvider injection_values
	 */
	public function test_sanitize_color_rejects_everything_else( string $value ): void {
		$this->assertSame( '', Theme_Colors::sanitize_color( $value ) );
		$this->assertNull( Theme_Colors::parse_var( $value ) );
		$this->assertSame( $this->neutral(), Theme_Colors::variables( array(), $value, $value ), 'Geçersiz değer CSS çıktısına girmez.' );
		$this->assertSame( '', Theme_Colors::form_style( $value, $value ) );
	}

	public function test_variable_with_explicit_fallback(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#1d3557' ) ) ), 'var(--e-global-color-primary, #ffd60a)', '' );
		$this->assertSame( 'var(--e-global-color-primary, #ffd60a)', $v['--dp-color-primary'] );
		$this->assertSame( '#000000', $v['--dp-color-on-primary'], 'Yazı rengi yedeğe göre güvenli.' );
		$this->assertSame( '1', $v['--dp-color-dynamic'] );
	}

	public function test_variable_without_fallback_uses_theme_then_default(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#1d3557' ) ) ), 'var(--brand)', 'var(--cta)' );
		$this->assertSame( 'var(--brand, #1d3557)', $v['--dp-color-primary'] );
		$this->assertSame( '#ffffff', $v['--dp-color-on-primary'] );
		$this->assertSame( 'var(--cta, #1d3557)', $v['--dp-accent'] );
		$this->assertSame( '1', $v['--dp-color-dynamic'] );
		$v = Theme_Colors::variables( array(), 'var(--brand)', '' );
		$this->assertSame( 'var(--brand, #' . Theme_Colors::DEFAULT_PRIMARY . ')', $v['--dp-color-primary'] );
		$this->assertGreaterThanOrEqual( 4.5, Theme_Colors::contrast( Theme_Colors::DEFAULT_PRIMARY, ltrim( $v['--dp-color-on-primary'], '#' ) ) );
	}

	public function test_hex_custom_colors_have_no_dynamic_flag(): void {
		$v = Theme_Colors::variables( array(), '#1d3557', '#e63946' );
		$this->assertArrayNotHasKey( '--dp-color-dynamic', $v );
	}

	public function test_form_style_hex_and_variable(): void {
		$this->assertSame( '--dp-color-primary:#1d3557;--dp-color-on-primary:#ffffff;', Theme_Colors::form_style( '#1d3557', '' ) );
		$this->assertSame( '', Theme_Colors::form_style( '', '' ) );
		$style = Theme_Colors::form_style( 'var(--brand, #ffd60a)', '' );
		$this->assertStringContainsString( '--dp-color-primary:var(--brand, #ffd60a);', $style );
		$this->assertStringContainsString( '--dp-color-on-primary:#000000;', $style );
		$this->assertStringContainsString( '--dp-color-dynamic:1;', $style );
		$this->assertStringNotContainsString( '--dp-accent', $style, 'Verilmeyen renk forma yazılmaz.' );
	}

	public function test_source_status_theme_for_good_palette(): void {
		$this->assertSame( 'theme', Theme_Colors::source_status( array( 'theme' => $this->palette( array( 'base' => '#fff', 'primary' => '#1d3557' ) ) ) ) );
		$this->assertSame( 'theme', Theme_Colors::source_status( $this->palette( array( 'brand' => '#1a1a2e' ) ) ) );
		$this->assertSame( 'none', Theme_Colors::source_status( $this->palette( array( 'ink' => '#1a1a2e' ) ) ), 'Rol adı olmayan renk sayılmaz.' );
	}
}
