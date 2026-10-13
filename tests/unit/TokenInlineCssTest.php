<?php
/**
 * Stage 2C token / inline CSS guards.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class TokenInlineCssTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
		WDP_Test_State::$options['wdp_button_settings'] = array(
			'brand_color'          => '#1d5fa8',
			'button_primary_color' => '#1d5fa8',
			'ui_border_radius'     => '10',
			'form_density'         => 'normal',
			'body_font_family'     => 'inherit',
			'title_size'           => 'M',
			'shell_modal_width'    => '520',
			'shell_panel_width'    => '480',
		);
	}

	public function test_color_palette_on_primary_contrast(): void {
		$light = WDP_Color_Palette::from_hex('#f5f5f5');
		$dark  = WDP_Color_Palette::from_hex('#1d5fa8');
		$this->assertSame('#0f172a', $light['on_primary']);
		$this->assertSame('#ffffff', $dark['on_primary']);
	}

	public function test_color_palette_hover_is_darker(): void {
		$p = WDP_Color_Palette::from_hex('#1d5fa8');
		$this->assertNotSame($p['primary'], $p['primary_hover']);
		$this->assertNotSame($p['primary'], $p['primary_dark']);
	}

	public function test_inline_token_css_under_1kb(): void {
		$assets = new ReflectionClass('WDP_Assets');
		if (!$assets->hasMethod('get_button_customization_css') && class_exists('WDP_Assets')) {
			// Method lives on trait used by WDP_Assets — invoke via reflection on trait user.
		}
		$ref = new ReflectionClass('WDP_Assets');
		$method = null;
		foreach ($ref->getMethods(ReflectionMethod::IS_PRIVATE | ReflectionMethod::IS_STATIC) as $m) {
			if ($m->getName() === 'get_button_customization_css') {
				$method = $m;
				break;
			}
		}
		$this->assertNotNull($method, 'get_button_customization_css exists on WDP_Assets');
		$method->setAccessible(true);
		$css = $method->invoke(null);
		$this->assertIsString($css);
		$this->assertLessThanOrEqual(1024, strlen($css), 'Inline token CSS ≤ 1 KB');
		$this->assertStringContainsString('--wdp-primary:', $css);
		$this->assertStringContainsString('.wdp-root', $css);
		$this->assertStringNotContainsString('button_shadow', $css);
	}

	public function test_builder_detect_site_context_keys(): void {
		$ctx = WDP_Builder_Detect::detect_site_context();
		$this->assertArrayHasKey('type', $ctx);
		$this->assertArrayHasKey('recommended', $ctx);
		$this->assertArrayHasKey('reason', $ctx);
		$this->assertArrayHasKey('label', $ctx);
	}
}
