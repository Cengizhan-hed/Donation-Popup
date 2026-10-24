<?php
/**
 * Elementor widget titles / keywords / controls are translatable English sources.
 *
 * @package WooCommerce\Donation_Popup
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

final class ElementorI18nTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	private function turkishHits(string $text): array {
		$hits = array();
		if (preg_match_all('/[çğıöşüÇĞİÖŞÜ]/u', $text, $m)) {
			$hits = array_values(array_unique($m[0]));
		}
		return $hits;
	}

	private function collectLabels(array $args): array {
		$out = array();
		foreach (array('label', 'label_on', 'label_off', 'title') as $k) {
			if (isset($args[ $k ]) && is_string($args[ $k ]) && $args[ $k ] !== '') {
				$out[] = $args[ $k ];
			}
		}
		if (isset($args['options']) && is_array($args['options'])) {
			foreach ($args['options'] as $opt) {
				if (is_string($opt) && $opt !== '') {
					$out[] = $opt;
				}
			}
		}
		return $out;
	}

	private function formWidget(): \WDP_Elementor_Widget_Donation_Form {
		if (!class_exists('WDP_Elementor_Widget_Donation_Form', false)) {
			require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donation-form.php';
		}
		$w = new \WDP_Elementor_Widget_Donation_Form();
		$ref = new \ReflectionMethod($w, 'register_controls');
		$ref->setAccessible(true);
		$ref->invoke($w);
		return $w;
	}

	private function listWidget(): \WDP_Elementor_Widget_Donations_List {
		if (!class_exists('WDP_Elementor_Widget_Donations_List', false)) {
			require_once WDP_PLUGIN_DIR . 'includes/elementor/class-widget-donations-list.php';
		}
		$w = new \WDP_Elementor_Widget_Donations_List();
		$ref = new \ReflectionMethod($w, 'register_controls');
		$ref->setAccessible(true);
		$ref->invoke($w);
		return $w;
	}

	public function test_form_widget_title_and_keywords_are_english(): void {
		$w = $this->formWidget();
		$this->assertSame('Donation form', $w->get_title());
		$this->assertSame(array('Donation form'), $w->get_keywords());
		$this->assertSame(array('wdp-donation'), $w->get_categories());
		$this->assertSame('wdp-donation-form', $w->get_name());
	}

	public function test_list_widget_title_and_keywords_are_english(): void {
		$w = $this->listWidget();
		$this->assertSame('Donations list', $w->get_title());
		$this->assertSame(array('Donations list'), $w->get_keywords());
		$this->assertSame(array('wdp-donation'), $w->get_categories());
		$this->assertSame('wdp-donations', $w->get_name());
	}

	public function test_control_labels_have_no_turkish(): void {
		$labels = array();
		foreach (array($this->formWidget(), $this->listWidget()) as $w) {
			foreach ($w->sections as $section) {
				$labels = array_merge($labels, $this->collectLabels($section));
			}
			foreach ($w->controls as $control) {
				$labels = array_merge($labels, $this->collectLabels($control));
			}
		}
		$this->assertNotEmpty($labels);
		$this->assertContains('Content', $labels);
		$this->assertContains('Query', $labels);
		$this->assertContains('Product', $labels);
		foreach ($labels as $label) {
			$this->assertSame(array(), $this->turkishHits($label), 'Türkçe kaynak: ' . $label);
		}
	}

	public function test_category_title_is_english(): void {
		$captured = (object) array('title' => '');
		$elements = new class($captured) {
			/** @var object */
			private $cap;
			public function __construct($cap) {
				$this->cap = $cap;
			}
			public function add_category($id, $args) {
				if ($id === 'wdp-donation' && is_array($args) && isset($args['title'])) {
					$this->cap->title = (string) $args['title'];
				}
			}
		};
		WDP_Elementor::category($elements);
		$this->assertSame('Donation (WooCommerce Donation)', $captured->title);
	}

	public function test_editor_script_uses_wp_i18n_translations(): void {
		WDP_Elementor::editor_assets();
		$scripts = WDP_Test_State::$options['__enqueued_scripts'] ?? array();
		$this->assertContains('wdp-elementor-editor', $scripts);
		$tr = WDP_Test_State::$options['__script_translations'] ?? array();
		$hit = null;
		foreach ($tr as $row) {
			if (($row['handle'] ?? '') === 'wdp-elementor-editor') {
				$hit = $row;
			}
		}
		$this->assertNotNull($hit);
		$this->assertSame('woo-donation-popup', $hit['domain']);
		$this->assertStringEndsWith('/languages', (string) $hit['path']);
	}

	public function test_block_scripts_set_translations(): void {
		WDP_Blocks::register();
		$tr = WDP_Test_State::$options['__script_translations'] ?? array();
		$handles = array();
		foreach ($tr as $row) {
			if (($row['domain'] ?? '') === 'woo-donation-popup') {
				$handles[] = $row['handle'];
				$this->assertStringEndsWith('/languages', (string) $row['path']);
			}
		}
		$this->assertContains('wdp-block-donation-form', $handles);
		$this->assertContains('wdp-block-donations', $handles);
	}
}
