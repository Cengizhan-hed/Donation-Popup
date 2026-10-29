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

	public function test_empty_palette_yields_no_variables(): void {
		$this->assertSame( array(), Theme_Colors::variables( array() ) );
		$this->assertSame( array(), Theme_Colors::variables( 'garbage' ) );
		$this->assertSame( array(), Theme_Colors::variables( array( 'default' => $this->palette( array( 'primary' => '#0000ff' ) ) ) ), 'WP varsayılan paleti kullanılmaz.' );
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

	public function test_primary_falls_back_to_first_dark_color(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'tint' => '#fafafa', 'ink' => '#1a1a2e' ) ) ) );
		$this->assertSame( '#1a1a2e', $v['--dp-color-primary'] );
	}

	public function test_named_primary_below_45_contrast_is_not_picked(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#8c8c8c', 'secondary' => '#14532d' ) ) ) );
		$this->assertSame( '#14532d', $v['--dp-color-primary'], 'Beyazda ~3.4:1 olan adlı renk seçilmez.' );
	}

	public function test_light_primary_name_is_skipped_for_unreadable_color(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'primary' => '#ffe08a', 'secondary' => '#14532d' ) ) ) );
		$this->assertSame( '#14532d', $v['--dp-color-primary'], 'Beyaz zeminde okunmayan ana renk atlanır.' );
	}

	public function test_action_falls_back_to_first_vivid_then_primary(): void {
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'primary' => '#222222', 'pop' => '#ff5a1f' ) ) ) );
		$this->assertSame( '#ff5a1f', $v['--dp-accent'] );
		$v = Theme_Colors::variables( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'primary' => '#222222' ) ) ) );
		$this->assertSame( '#222222', $v['--dp-accent'] );
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
		$this->assertSame( array(), $v );
	}

	public function test_source_status_none_for_empty_or_default_only_palette(): void {
		$this->assertSame( 'none', Theme_Colors::source_status( array() ) );
		$this->assertSame( 'none', Theme_Colors::source_status( 'garbage' ) );
		$this->assertSame( 'none', Theme_Colors::source_status( array( 'default' => $this->palette( array( 'primary' => '#0000ff' ) ) ) ) );
	}

	public function test_source_status_none_when_no_color_has_enough_contrast(): void {
		$this->assertSame( 'none', Theme_Colors::source_status( array( 'theme' => $this->palette( array( 'base' => '#ffffff', 'tint' => '#fafafa', 'soft' => '#ffe08a' ) ) ) ) );
	}

	public function test_source_status_theme_for_good_palette(): void {
		$this->assertSame( 'theme', Theme_Colors::source_status( array( 'theme' => $this->palette( array( 'base' => '#fff', 'primary' => '#1d3557' ) ) ) ) );
		$this->assertSame( 'theme', Theme_Colors::source_status( $this->palette( array( 'ink' => '#1a1a2e' ) ) ) );
	}
}
