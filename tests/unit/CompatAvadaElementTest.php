<?php
/**
 * Avada (Fusion Builder) elementi: koşullu kayıt, Elementor/blok ile seçenek eşliği, kısa kod çıktısı.
 *
 * @package WDP\Tests
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

if (!class_exists('\Elementor\Widget_Base', false)) {
	eval(<<<'PHP'
namespace Elementor;

class Controls_Manager {
	const SELECT = 'select';
	const SELECT2 = 'select2';
	const TEXT = 'text';
	const NUMBER = 'number';
	const SWITCHER = 'switcher';
}

class Widget_Base {
	/** @var array<string, array> */
	public $sections = array();
	/** @var array<string, array> */
	public $controls = array();

	public function start_controls_section($id, $args = array()) {
		$this->sections[ (string) $id ] = is_array($args) ? $args : array();
	}

	public function end_controls_section() {}

	public function add_control($id, $args = array()) {
		$this->controls[ (string) $id ] = is_array($args) ? $args : array();
	}

	public function add_responsive_control($id, $args = array()) {
		$this->add_control($id, $args);
	}

	public function get_settings($key = null) {
		return array();
	}

	public function get_settings_for_display() {
		return array();
	}
}
PHP
	);
}
if (!function_exists('do_shortcode')) {
	function do_shortcode($content) {
		$GLOBALS['wdp_test_do_shortcode'][] = $content;
		return 'RENDERED:' . $content;
	}
}
if (!function_exists('add_shortcode')) {
	function add_shortcode($tag, $callback) {
		$GLOBALS['wdp_test_shortcodes'][ $tag ] = $callback;
	}
}

final class CompatAvadaElementTest extends TestCase {

	/** @var array<int, array<string,mixed>> */
	public static $mapped = array();

	protected function setUp(): void {
		WDP_Test_State::reset();
		$GLOBALS['wdp_test_do_shortcode'] = array();
		$GLOBALS['wdp_test_locale']       = 'en_US';
		self::$mapped                     = array();
	}

	protected function tearDown(): void {
		unset($GLOBALS['wdp_test_locale']);
	}

	/** Sıra önemli: Fusion Builder saplaması tanımlanmadan çalışmalı. */
	public function test_a_not_loaded_and_noop_without_fusion_builder(): void {
		$this->assertFalse(class_exists('WDP_Compat_Avada_Element', false));
		WDP_Compat_Loader::init();
		$this->assertFalse(class_exists('WDP_Compat_Avada_Element', false), 'Kanca ateşlenmeden sınıf yüklenmemeli.');
		$cb = WDP_Test_State::$actions['fusion_builder_before_init'][0] ?? null;
		$this->assertSame(array('WDP_Compat_Avada_Element', 'register'), $cb);
		$this->assertFalse(function_exists('fusion_builder_map'));
		WDP_Compat_Avada_Element::register();
		$this->assertSame(array(), self::$mapped);
	}

	private function defineFusionStub(): void {
		if (!function_exists('fusion_builder_map')) {
			eval('function fusion_builder_map($args) { CompatAvadaElementTest::$mapped[] = $args; }');
		}
	}

	public function test_register_maps_two_elements(): void {
		$this->defineFusionStub();
		WDP_Compat_Avada_Element::register();
		$this->assertCount(2, self::$mapped);
		$this->assertSame('wdp_avada_donation_form', self::$mapped[0]['shortcode']);
		$this->assertSame('wdp_donations', self::$mapped[1]['shortcode']);
		$this->assertArrayHasKey('wdp_avada_donation_form', $GLOBALS['wdp_test_shortcodes']);
		foreach (self::$mapped as $el) {
			$this->assertStringStartsWith('Donation Panel', $el['name']);
			$this->assertContains('donation', $el['keywords']);
		}
	}

	/** @return string[] */
	private function params(array $el): array {
		return array_map(static function ($p) { return $p['param_name']; }, $el['params']);
	}

	private function elementorControls(string $class): array {
		require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donation-form.php';
		require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donations-list.php';
		$w = new $class();
		$m = new ReflectionMethod($w, 'register_controls');
		$m->setAccessible(true);
		$m->invoke($w);
		return $w->controls;
	}

	public function test_form_params_match_elementor_widget(): void {
		$controls = $this->elementorControls('WDP_Elementor_Widget_Donation_Form');
		$el       = WDP_Compat_Avada_Element::form_element();
		$names    = $this->params($el);
		foreach (array_keys($controls) as $id) {
			$this->assertContains($id, $names, "Elementor seçeneği Avada'da yok: $id");
		}
		$byName = array();
		foreach ($el['params'] as $p) {
			$byName[ $p['param_name'] ] = $p;
		}
		$this->assertSame(array_keys($controls['display']['options']), array_keys($byName['display']['value']));
		$this->assertSame(array_keys($controls['source']['options']), array_keys($byName['source']['value']));
		$this->assertSame($controls['display']['default'], $byName['display']['default']);
	}

	public function test_list_params_match_elementor_widget_and_block(): void {
		$controls = $this->elementorControls('WDP_Elementor_Widget_Donations_List');
		$el       = WDP_Compat_Avada_Element::list_element();
		$names    = $this->params($el);
		foreach (array_keys($controls) as $id) {
			$this->assertContains($id, $names, "Elementor seçeneği Avada'da yok: $id");
		}
		$block = json_decode((string) file_get_contents(WDP_PLUGIN_DIR . 'blocks/donations/block.json'), true);
		foreach (array_keys($block['attributes']) as $attr) {
			$this->assertContains($attr, $names, "Blok özniteliği Avada'da yok: $attr");
		}
		$byName = array();
		foreach ($el['params'] as $p) {
			$byName[ $p['param_name'] ] = $p;
		}
		foreach ($block['attributes'] as $attr => $def) {
			if ('tab_all_label' === $attr) {
				continue; // Blokta boş = genel "All" etiketi; Elementor ile aynı görünür varsayılan "All".
			}
			$this->assertSame((string) $def['default'], (string) ($byName[ $attr ]['default'] ?? $byName[ $attr ]['value']), "Varsayılan uyuşmuyor: $attr");
		}
	}

	public function test_form_block_attributes_covered(): void {
		$block = json_decode((string) file_get_contents(WDP_PLUGIN_DIR . 'blocks/donation-form/block.json'), true);
		$this->assertSame(array('productId', 'slug', 'sku', 'display', 'showTitle', 'buttonText'), array_keys($block['attributes']));
		$names = $this->params(WDP_Compat_Avada_Element::form_element());
		foreach (array('product_id', 'manual', 'display', 'show_title', 'button_text') as $n) {
			$this->assertContains($n, $names);
		}
	}

	public function test_render_form_dispatches_to_existing_shortcodes(): void {
		$out = WDP_Compat_Avada_Element::render_form(array('source' => 'manual', 'manual' => '42', 'display' => 'inline', 'show_title' => 'no'));
		$this->assertSame('RENDERED:[wdp_donation_form id="42" show_title="no"]', $out);
		WDP_Compat_Avada_Element::render_form(array('source' => 'manual', 'manual' => 'Bagis Slug', 'display' => 'popup', 'button_text' => 'Give "now" [x]'));
		WDP_Compat_Avada_Element::render_form(array('source' => 'list', 'product_id' => '7', 'display' => 'panel'));
		WDP_Compat_Avada_Element::render_form(array());
		$this->assertSame(
			array(
				'[wdp_donation_form id="42" show_title="no"]',
				'[wdp_donation_button slug="bagis-slug" button_text="Give now x"]',
				'[wdp_donation_button_panel id="7"]',
				'[wdp_donation_form show_title="yes"]',
			),
			$GLOBALS['wdp_test_do_shortcode']
		);
	}
}
