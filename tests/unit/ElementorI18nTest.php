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
		// Bu sınıf İNGİLİZCE kaynak metni doğrular (çeviri yok).
		$GLOBALS['wdp_test_locale'] = 'en_US';
	}

	protected function tearDown(): void {
		unset($GLOBALS['wdp_test_locale']);
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

	private function formWidget(): \DonationPanel\Modules\EntryPoints\Elementor\Donation_Form_Widget {
		$w = new \DonationPanel\Modules\EntryPoints\Elementor\Donation_Form_Widget();
		$ref = new \ReflectionMethod($w, 'register_controls');
		$ref->setAccessible(true);
		$ref->invoke($w);
		return $w;
	}

	private function listWidget(): \DonationPanel\Modules\EntryPoints\Elementor\Donations_List_Widget {
		$w = new \DonationPanel\Modules\EntryPoints\Elementor\Donations_List_Widget();
		$ref = new \ReflectionMethod($w, 'register_controls');
		$ref->setAccessible(true);
		$ref->invoke($w);
		return $w;
	}

	public function test_form_widget_title_and_keywords_are_english(): void {
		$w = $this->formWidget();
		$this->assertSame('Donation form', $w->get_title());
		$this->assertSame(array('Donation form', 'donation', 'donate', 'charity', 'form', 'popup'), $w->get_keywords());
		$this->assertSame(array('wdp-donation'), $w->get_categories());
		$this->assertSame('wdp-donation-form', $w->get_name());
	}

	public function test_list_widget_title_and_keywords_are_english(): void {
		$w = $this->listWidget();
		$this->assertSame('Donations list', $w->get_title());
		$this->assertSame(array('Donations list', 'donation', 'campaign', 'list', 'progress'), $w->get_keywords());
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
		\DonationPanel\Modules\EntryPoints\Elementor\Elementor_Compat::category($elements);
		$this->assertSame('Donation (WooCommerce Donation)', $captured->title);
	}

	public function test_register_hooks_only_widgets_and_category(): void {
		\DonationPanel\Modules\EntryPoints\Elementor\Elementor_Compat::init();
		$this->assertArrayHasKey('elementor/widgets/register', WDP_Test_State::$actions);
		$this->assertArrayHasKey('elementor/elements/categories_registered', WDP_Test_State::$actions);
		$this->assertArrayNotHasKey('elementor/editor/after_enqueue_scripts', WDP_Test_State::$actions);
		$this->assertArrayNotHasKey('wp_ajax_wdp_elementor_search_products', WDP_Test_State::$actions);
	}

	public function test_setting_keys_unchanged_for_saved_pages(): void {
		$form = array_keys($this->formWidget()->controls);
		foreach (array('source', 'product_id', 'manual', 'display', 'show_title', 'button_text') as $key) {
			$this->assertContains($key, $form);
		}
		$list = array_keys($this->listWidget()->controls);
		foreach (array('categories', 'exclude_categories', 'ids', 'exclude', 'type', 'limit', 'orderby', 'order', 'columns', 'gap', 'image_ratio', 'align', 'button', 'button_full', 'button_text', 'tabs', 'tab_all', 'tab_all_label', 'show_image', 'show_excerpt', 'show_progress', 'show_price', 'show_category', 'excerpt_words', 'image_size', 'heading_tag', 'class') as $key) {
			$this->assertContains($key, $list);
		}
	}

	public function test_form_widget_maps_to_equivalent_shortcode(): void {
		$cases = array(
			array(array('source' => 'manual', 'manual' => '42', 'display' => 'inline', 'show_title' => 'no'), 'wdp_donation_form', array('id' => 42, 'show_title' => 'no')),
			array(array('source' => 'manual', 'manual' => 'Bagis Slug', 'display' => 'popup', 'button_text' => 'Give "now" [x]'), 'wdp_donation_button', array('slug' => 'bagis-slug', 'button_text' => 'Give "now" [x]')),
			array(array('source' => 'list', 'product_id' => '7', 'display' => 'panel'), 'wdp_donation_button_panel', array('id' => 7)),
			array(array(), 'wdp_donation_form', array('id' => 0, 'slug' => '')),
		);
		foreach ($cases as $case) {
			list($tag, $atts) = \DonationPanel\Modules\EntryPoints\Elementor\Donation_Form_Widget::shortcode_from_settings($case[0]);
			$this->assertSame($case[1], $tag);
			foreach ($case[2] as $k => $v) {
				$this->assertSame($v, $atts[ $k ], $k);
			}
		}
		$src = (string) file_get_contents(WDP_PLUGIN_DIR . 'src/Modules/EntryPoints/Elementor/class-donation-form-widget.php');
		$this->assertStringContainsString('Shortcodes::donation_form_shortcode', $src);
		$this->assertStringContainsString('Shortcodes::donation_button_panel_shortcode', $src);
	}

	public function test_list_widget_maps_to_shortcode_attributes(): void {
		$atts = \DonationPanel\Modules\EntryPoints\Elementor\Donations_List_Widget::atts_from_settings(array('columns' => 4, 'columns_tablet' => 3, 'columns_mobile' => 1, 'image_size' => 'medium'));
		$this->assertSame(4, (int) $atts['columns']);
		$this->assertSame(3, (int) $atts['columns_tablet']);
		$this->assertSame(1, (int) $atts['columns_mobile']);
		$this->assertSame('medium', $atts['image_size']);
		$san = WDP_Donations_List::sanitize_atts($atts);
		$this->assertSame(4, $san['columns']);
		$this->assertSame('medium', $san['image_size']);
	}

	public function test_widget_files_hold_no_editor_special_cases(): void {
		foreach (array('src/Modules/EntryPoints/Elementor/class-elementor-compat.php', 'src/Modules/EntryPoints/Elementor/class-donation-form-widget.php', 'src/Modules/EntryPoints/Elementor/class-donations-list-widget.php') as $f) {
			$src = (string) file_get_contents(WDP_PLUGIN_DIR . $f);
			$this->assertStringNotContainsString('is_edit_mode', $src, $f);
			$this->assertStringNotContainsString('wp_enqueue_', $src, $f);
			$this->assertStringNotContainsString('wp_ajax', $src, $f);
		}
	}

	public function test_block_scripts_set_translations(): void {
		\DonationPanel\Modules\EntryPoints\Blocks::register();
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
