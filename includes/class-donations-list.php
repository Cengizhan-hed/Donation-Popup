<?php
/**
 * [wdp_donations] liste kısa kodu: sorgu, sekme, kart HTML, transient önbellek ve varlıklar.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Donation product grid used by the shortcode, Gutenberg block and Elementor widget.
 */
class WDP_Donations_List {

	const CACHE_VERSION = 'wdp_list_cache_version';
	const STYLE_HANDLE  = 'wdp-donations-list';
	const SCRIPT_HANDLE = 'wdp-donations-list';

	/** @var array<int, array{url:string,name:string}> */
	private static $schema_items = array();

	/** @var bool */
	private static $footer_hooked = false;

	/** @var bool */
	private static $invalidation_hooked = false;

	/** @var bool One bump per HTTP request (option increment is cheap; skip repeats). */
	private static $bumped_this_request = false;

	const UID_PLACEHOLDER   = '{{WDP_LIST_UID}}';
	const PANEL_PLACEHOLDER = '{{WDP_LIST_PANEL}}';

	/**
	 * Events that already called bump_cache in 10.32.0 (measured from source before this version).
	 *
	 * @return array<string, bool>
	 */
	public static function bump_events_before_10_33_0() {
		return array(
			'set_object_terms'                   => true,
			'woocommerce_product_set_stock'      => true,
			'woocommerce_product_set_stock_status' => true,
			'created_product_cat'                => true,
			'edited_product_cat'                 => true,
			'delete_product_cat'                 => true,
			'woocommerce_update_product'         => false,
			'woocommerce_new_product'            => false,
			'save_post_product'                  => false,
			'trashed_post'                       => false,
			'untrashed_post'                     => false,
			'before_delete_post'                 => false,
			'transition_post_status'             => false,
			'updated_post_meta:_price'           => false,
			'updated_post_meta:_regular_price'   => false,
			'updated_post_meta:_sale_price'      => false,
			'product_settings_save'              => false,
			'woocommerce_order_status_changed'   => false,
			'woocommerce_order_refunded'         => false,
		);
	}

	/**
	 * @return void
	 */
	public static function init() {
		if (self::$invalidation_hooked) {
			return;
		}
		self::$invalidation_hooked = true;
		add_action('set_object_terms', array(__CLASS__, 'on_set_object_terms'), 10, 6);
		add_action('woocommerce_product_set_stock', array(__CLASS__, 'bump_cache'));
		add_action('woocommerce_product_set_stock_status', array(__CLASS__, 'bump_cache'));
		add_action('created_product_cat', array(__CLASS__, 'bump_cache'));
		add_action('edited_product_cat', array(__CLASS__, 'bump_cache'));
		add_action('delete_product_cat', array(__CLASS__, 'bump_cache'));
		add_action('woocommerce_update_product', array(__CLASS__, 'bump_cache'));
		add_action('woocommerce_new_product', array(__CLASS__, 'bump_cache'));
		add_action('save_post_product', array(__CLASS__, 'on_save_post_product'), 20, 3);
		add_action('trashed_post', array(__CLASS__, 'on_product_post_event'), 10, 1);
		add_action('untrashed_post', array(__CLASS__, 'on_product_post_event'), 10, 1);
		add_action('before_delete_post', array(__CLASS__, 'on_product_post_event'), 10, 1);
		add_action('transition_post_status', array(__CLASS__, 'on_transition_post_status'), 10, 3);
		add_action('updated_post_meta', array(__CLASS__, 'on_product_meta'), 10, 4);
		add_action('added_post_meta', array(__CLASS__, 'on_product_meta'), 10, 4);
		add_action('deleted_post_meta', array(__CLASS__, 'on_product_meta'), 10, 4);
		add_action('woocommerce_order_status_changed', array(__CLASS__, 'bump_cache'));
		add_action('woocommerce_order_refunded', array(__CLASS__, 'bump_cache'));
	}

	/**
	 * @param mixed $atts Shortcode attributes.
	 * @return string
	 */
	public static function shortcode($atts) {
		return WDP_Render_Guard::html(
			static function () use ($atts) {
				return self::render(is_array($atts) ? $atts : array());
			},
			0,
			'wdp_donations'
		);
	}

	/**
	 * Map Elementor list widget settings to shortcode attributes (responsive columns included).
	 *
	 * @param array $s Elementor settings.
	 * @return array<string, mixed>
	 */
	public static function atts_from_elementor_settings($s) {
		$s = is_array($s) ? $s : array();
		return array(
			'categories'         => isset($s['categories']) ? $s['categories'] : '',
			'exclude_categories' => isset($s['exclude_categories']) ? $s['exclude_categories'] : '',
			'ids'                => isset($s['ids']) ? $s['ids'] : '',
			'exclude'            => isset($s['exclude']) ? $s['exclude'] : '',
			'type'               => isset($s['type']) ? $s['type'] : '',
			'limit'              => isset($s['limit']) ? $s['limit'] : 48,
			'orderby'            => isset($s['orderby']) ? $s['orderby'] : 'menu_order',
			'order'              => isset($s['order']) ? $s['order'] : 'ASC',
			'tabs'               => !empty($s['tabs']) ? $s['tabs'] : 'no',
			'tab_all'            => !empty($s['tab_all']) ? $s['tab_all'] : 'no',
			'tab_all_label'      => isset($s['tab_all_label']) ? $s['tab_all_label'] : '',
			'columns'            => isset($s['columns']) ? $s['columns'] : 3,
			'columns_tablet'     => isset($s['columns_tablet']) ? $s['columns_tablet'] : 2,
			'columns_mobile'     => isset($s['columns_mobile']) ? $s['columns_mobile'] : 1,
			'gap'                => isset($s['gap']) ? $s['gap'] : 24,
			'image_ratio'        => isset($s['image_ratio']) ? $s['image_ratio'] : '4:3',
			'image_size'         => isset($s['image_size']) ? $s['image_size'] : 'woocommerce_thumbnail',
			'align'              => isset($s['align']) ? $s['align'] : 'center',
			'button'             => isset($s['button']) ? $s['button'] : 'panel',
			'button_full'        => !empty($s['button_full']) ? $s['button_full'] : 'no',
			'button_text'        => isset($s['button_text']) ? $s['button_text'] : '',
			'show_image'         => !empty($s['show_image']) ? $s['show_image'] : 'no',
			'show_excerpt'       => !empty($s['show_excerpt']) ? $s['show_excerpt'] : 'no',
			'show_progress'      => !empty($s['show_progress']) ? $s['show_progress'] : 'no',
			'show_price'         => !empty($s['show_price']) ? $s['show_price'] : 'no',
			'show_category'      => !empty($s['show_category']) ? $s['show_category'] : 'no',
			'excerpt_words'      => isset($s['excerpt_words']) ? $s['excerpt_words'] : 18,
			'heading_tag'        => isset($s['heading_tag']) ? $s['heading_tag'] : 'h3',
			'class'              => isset($s['class']) ? $s['class'] : '',
		);
	}

	public static function sanitize_atts($atts) {
		$atts  = is_array($atts) ? $atts : array();
		$yesno = static function ($value, $default) {
			if ($value === null || $value === '') {
				return $default;
			}
			$raw = strtolower(trim((string) $value));
			if (in_array($raw, array('yes', '1', 'true', 'on'), true)) {
				return 'yes';
			}
			if (in_array($raw, array('no', '0', 'false', 'off'), true)) {
				return 'no';
			}
			return $default;
		};
		$int = static function ($value, $min, $max, $default) {
			if ($value === null || $value === '') {
				return $default;
			}
			$n = (int) $value;
			if ($n < $min || $n > $max) {
				return $default;
			}
			return $n;
		};

		$orderby = isset($atts['orderby']) ? sanitize_key((string) $atts['orderby']) : 'menu_order';
		if (!in_array($orderby, array('menu_order', 'date', 'title', 'popularity', 'random'), true)) {
			$orderby = 'menu_order';
		}
		$order = isset($atts['order']) ? strtoupper(sanitize_key((string) $atts['order'])) : 'ASC';
		$order = $order === 'DESC' ? 'DESC' : 'ASC';

		$image_ratio = isset($atts['image_ratio']) ? (string) $atts['image_ratio'] : '4:3';
		if (!in_array($image_ratio, array('1:1', '4:3', '3:2', '16:9', 'original'), true)) {
			$image_ratio = '4:3';
		}
		$align = isset($atts['align']) ? sanitize_key((string) $atts['align']) : 'center';
		$align = $align === 'left' ? 'left' : 'center';
		$button = isset($atts['button']) ? sanitize_key((string) $atts['button']) : 'panel';
		if (!in_array($button, array('panel', 'popup', 'link'), true)) {
			$button = 'panel';
		}
		$heading = isset($atts['heading_tag']) ? strtolower(sanitize_key((string) $atts['heading_tag'])) : 'h3';
		if (!in_array($heading, array('h2', 'h3', 'h4'), true)) {
			$heading = 'h3';
		}

		$types = array();
		if (!empty($atts['type'])) {
			foreach (preg_split('/[\s,]+/', (string) $atts['type']) as $type) {
				$type = WDP_Donation_Type::sanitize($type, '');
				if ($type !== '' && !in_array($type, $types, true)) {
					$types[] = $type;
				}
			}
		}

		return array(
			'categories'         => self::csv_slugs(isset($atts['categories']) ? $atts['categories'] : ''),
			'exclude_categories' => self::csv_slugs(isset($atts['exclude_categories']) ? $atts['exclude_categories'] : ''),
			'ids'                => self::csv_ids(isset($atts['ids']) ? $atts['ids'] : ''),
			'exclude'            => self::csv_ids(isset($atts['exclude']) ? $atts['exclude'] : ''),
			'type'               => $types,
			'limit'              => $int(isset($atts['limit']) ? $atts['limit'] : 48, 1, 100, 48),
			'orderby'            => $orderby,
			'order'              => $order,
			'tabs'               => $yesno(isset($atts['tabs']) ? $atts['tabs'] : null, 'yes'),
			'tab_all'            => $yesno(isset($atts['tab_all']) ? $atts['tab_all'] : null, 'yes'),
			'tab_all_label'      => isset($atts['tab_all_label']) && trim((string) $atts['tab_all_label']) !== ''
				? sanitize_text_field((string) $atts['tab_all_label'])
				: __('Tümü', 'woo-donation-popup'),
			'columns'            => $int(isset($atts['columns']) ? $atts['columns'] : 3, 1, 6, 3),
			'columns_tablet'     => $int(isset($atts['columns_tablet']) ? $atts['columns_tablet'] : 2, 1, 6, 2),
			'columns_mobile'     => $int(isset($atts['columns_mobile']) ? $atts['columns_mobile'] : 1, 1, 6, 1),
			'gap'                => $int(isset($atts['gap']) ? $atts['gap'] : 24, 0, 64, 24),
			'image_ratio'        => $image_ratio,
			'align'              => $align,
			'button'             => $button,
			'button_full'        => $yesno(isset($atts['button_full']) ? $atts['button_full'] : null, 'yes'),
			'button_text'        => isset($atts['button_text']) ? sanitize_text_field((string) $atts['button_text']) : '',
			'show_image'         => $yesno(isset($atts['show_image']) ? $atts['show_image'] : null, 'yes'),
			'show_excerpt'       => $yesno(isset($atts['show_excerpt']) ? $atts['show_excerpt'] : null, 'no'),
			'show_progress'      => $yesno(isset($atts['show_progress']) ? $atts['show_progress'] : null, 'yes'),
			'show_price'         => $yesno(isset($atts['show_price']) ? $atts['show_price'] : null, 'yes'),
			'show_category'      => $yesno(isset($atts['show_category']) ? $atts['show_category'] : null, 'no'),
			'excerpt_words'      => $int(isset($atts['excerpt_words']) ? $atts['excerpt_words'] : 18, 0, 60, 18),
			'image_size'         => isset($atts['image_size']) && sanitize_key((string) $atts['image_size']) !== ''
				? sanitize_key((string) $atts['image_size'])
				: 'woocommerce_thumbnail',
			'heading_tag'        => $heading,
			'class'              => isset($atts['class']) && class_exists('WDP_Shortcodes')
				? WDP_Shortcodes::sanitize_class_list($atts['class'])
				: (isset($atts['class']) ? sanitize_html_class((string) $atts['class']) : ''),
		);
	}

	/**
	 * @param array $atts Raw or sanitized attributes.
	 * @return string
	 */
	public static function render($atts) {
		$atts = self::sanitize_atts($atts);
		self::enqueue_assets();

		$use_cache = $atts['orderby'] !== 'random';
		$html      = '';
		if ($use_cache) {
			$cache_key = self::cache_key($atts);
			$cached    = get_transient($cache_key);
			if (is_string($cached) && $cached !== '') {
				$html = $cached;
			}
		}
		if ($html === '') {
			$built = self::build_html($atts);
			$html  = $built['html'];
			if ($use_cache) {
				set_transient(self::cache_key($atts), $html, DAY_IN_SECONDS);
			}
		} else {
			$built = array('empty' => (strpos($html, 'wdp-list__empty') !== false));
		}

		$html = self::apply_request_ids($html);
		if (!empty($built['empty']) && function_exists('current_user_can') && current_user_can('edit_products')) {
			$notice = WDP_Utils::admin_notice_html(self::empty_reason($atts));
			$html   = preg_replace('/(<div\b[^>]*\bclass="[^"]*wdp-list-wrap[^"]*"[^>]*>)/', '$1' . $notice, $html, 1);
		}

		self::collect_schema_from_html($html);
		if (!self::$footer_hooked) {
			self::$footer_hooked = true;
			add_action('wp_footer', array(__CLASS__, 'print_schema'), 20);
		}

		return $html;
	}

	/**
	 * Increment list cache version once per request.
	 *
	 * @return void
	 */
	public static function bump_cache() {
		if (self::$bumped_this_request) {
			return;
		}
		self::$bumped_this_request = true;
		$current = (int) get_option(self::CACHE_VERSION, 1);
		update_option(self::CACHE_VERSION, $current + 1, false);
	}

	/**
	 * @return void
	 */
	public static function reset_bump_guard() {
		self::$bumped_this_request = false;
	}

	/**
	 * @return void
	 */
	public static function reset_for_tests() {
		self::$invalidation_hooked = false;
		self::$bumped_this_request = false;
		self::$footer_hooked       = false;
		self::$schema_items        = array();
	}

	/**
	 * Product settings panel saved (Bağış sekmesi).
	 *
	 * @return void
	 */
	public static function on_product_settings_save() {
		self::bump_cache();
	}

	/**
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post.
	 * @param bool    $update  Update.
	 * @return void
	 */
	public static function on_save_post_product($post_id, $post = null, $update = true) {
		unset($post, $update);
		if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
			return;
		}
		if (function_exists('wp_is_post_revision') && wp_is_post_revision($post_id)) {
			return;
		}
		self::bump_cache();
	}

	/**
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public static function on_product_post_event($post_id) {
		if (self::post_is_product($post_id)) {
			self::bump_cache();
		}
	}

	/**
	 * @param string  $new  New status.
	 * @param string  $old  Old status.
	 * @param WP_Post $post Post.
	 * @return void
	 */
	public static function on_transition_post_status($new, $old, $post) {
		if ($new === $old || !is_object($post)) {
			return;
		}
		$type = isset($post->post_type) ? (string) $post->post_type : '';
		if ($type === 'product' || $type === 'product_variation') {
			self::bump_cache();
		}
	}

	/**
	 * Price or donation-progress meta on a product.
	 *
	 * @param int    $meta_id    Meta id.
	 * @param int    $object_id  Post id.
	 * @param string $meta_key   Key.
	 * @param mixed  $meta_value Value.
	 * @return void
	 */
	public static function on_product_meta($meta_id, $object_id, $meta_key, $meta_value = null) {
		unset($meta_id, $meta_value);
		$key  = (string) $meta_key;
		$keys = array('_price', '_regular_price', '_sale_price', '_wdp_total_donation_amount', '_wdp_donor_count');
		$watch = in_array($key, $keys, true);
		if (!$watch && class_exists('WDP_Product_Settings_Service') && method_exists('WDP_Product_Settings_Service', 'get_settings_meta_keys')) {
			$watch = in_array($key, WDP_Product_Settings_Service::get_settings_meta_keys(), true);
		}
		if (!$watch) {
			return;
		}
		if (self::post_is_product($object_id)) {
			self::bump_cache();
		}
	}

	/**
	 * @param int $post_id Post ID.
	 * @return bool
	 */
	private static function post_is_product($post_id) {
		$post_id = absint($post_id);
		if ($post_id <= 0) {
			return false;
		}
		$type = function_exists('get_post_type') ? get_post_type($post_id) : '';
		return $type === 'product' || $type === 'product_variation';
	}

	/**
	 * @param int    $object_id  Object ID.
	 * @param array  $terms      Terms.
	 * @param array  $tt_ids     Term taxonomy IDs.
	 * @param string $taxonomy   Taxonomy.
	 * @param bool   $append     Append.
	 * @param array  $old_tt_ids Old term taxonomy IDs.
	 * @return void
	 */
	public static function on_set_object_terms($object_id, $terms, $tt_ids, $taxonomy, $append = false, $old_tt_ids = array()) {
		if ($taxonomy === 'product_cat') {
			self::bump_cache();
		}
	}

	/**
	 * @return void
	 */
	public static function enqueue_assets() {
		$css = WDP_PLUGIN_URL . 'assets/css/list.css';
		$js  = WDP_PLUGIN_URL . 'assets/js/list.js';
		wp_enqueue_style(self::STYLE_HANDLE, $css, array(), WDP_ASSET_VERSION);
		wp_enqueue_script(self::SCRIPT_HANDLE, $js, array(), WDP_ASSET_VERSION, true);
		wp_script_add_data(self::SCRIPT_HANDLE, 'strategy', 'defer');
		WDP_Assets::force_enqueue();
		if (did_action('wp_enqueue_scripts')) {
			WDP_Assets::enqueue_assets_now();
		}
	}

	/**
	 * JSON-LD ItemList in wp_footer (one script even with several lists).
	 *
	 * @return void
	 */
	public static function print_schema() {
		if (WDP_Placement_Settings::value('schema', 'auto') !== 'auto' || empty(self::$schema_items)) {
			return;
		}
		$seen  = array();
		$items = array();
		$pos   = 1;
		foreach (self::$schema_items as $row) {
			$url = isset($row['url']) ? $row['url'] : '';
			if ($url === '' || isset($seen[ $url ])) {
				continue;
			}
			$seen[ $url ] = true;
			$items[]      = array(
				'@type'    => 'ListItem',
				'position' => $pos,
				'url'      => $url,
				'name'     => isset($row['name']) ? $row['name'] : '',
			);
			$pos++;
		}
		if (empty($items)) {
			return;
		}
		$payload = array(
			'@context'        => 'https://schema.org',
			'@type'           => 'ItemList',
			'itemListElement' => $items,
		);
		echo '<script type="application/ld+json">' . wp_json_encode($payload) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Replace cache-safe placeholders with per-request unique ids.
	 *
	 * @param string $html Cached HTML.
	 * @return string
	 */
	public static function apply_request_ids($html) {
		$uid   = function_exists('wp_unique_id') ? wp_unique_id('wdp-list-') : ('wdp-list-' . uniqid());
		$panel = $uid . '-panel';
		$html  = str_replace(self::UID_PLACEHOLDER, $uid, $html);
		return str_replace(self::PANEL_PLACEHOLDER, $panel, $html);
	}

	/**
	 * @param array $atts Sanitized atts.
	 * @return array{html:string,empty:bool}
	 */
	private static function build_html($atts) {
		$products = self::query_products($atts);
		if (empty($products)) {
			$msg = '<p class="wdp-list__empty">' . esc_html__('Şu anda gösterilecek bağış bulunmuyor.', 'woo-donation-popup') . '</p>';
			$class = 'wdp-list-wrap' . ($atts['class'] !== '' ? ' ' . esc_attr($atts['class']) : '');
			return array(
				'html'  => '<div class="' . $class . '" data-wdp-list-id="' . esc_attr(self::UID_PLACEHOLDER) . '">' . $msg . '</div>',
				'empty' => true,
			);
		}

		$ids    = array();
		foreach ($products as $product) {
			$ids[] = (int) $product->get_id();
		}
		$totals = WDP_Utils::get_totals_for_products($ids);
		$tabs   = ($atts['tabs'] === 'yes') ? self::build_tabs($products) : array();

		$style = '--wdp-cols:' . (int) $atts['columns']
			. ';--wdp-cols-t:' . (int) $atts['columns_tablet']
			. ';--wdp-cols-m:' . (int) $atts['columns_mobile']
			. ';--wdp-gap:' . (int) $atts['gap'] . 'px';
		$ratio = self::ratio_css($atts['image_ratio']);
		if ($ratio !== '') {
			$style .= ';--wdp-ratio:' . $ratio;
		}

		$wrap_class = 'wdp-list-wrap wdp-list-wrap--' . $atts['align'];
		if ($atts['class'] !== '') {
			$wrap_class .= ' ' . $atts['class'];
		}

		$panel_id = self::PANEL_PLACEHOLDER;
		$uid      = self::UID_PLACEHOLDER;
		ob_start();
		echo '<div class="' . esc_attr($wrap_class) . '" style="' . esc_attr($style) . '" data-wdp-list-id="' . esc_attr($uid) . '">';
		if (!empty($tabs)) {
			echo self::tabs_html($tabs, $atts, $uid, $panel_id); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$labelled = ($atts['tab_all'] === 'yes') ? ($uid . '-all') : ($uid . '-' . $tabs[0]['slug']);
			echo '<ul class="wdp-list" role="tabpanel" id="' . esc_attr($panel_id) . '" aria-labelledby="' . esc_attr($labelled) . '">';
		} else {
			echo '<ul class="wdp-list" role="list">';
		}
		$index = 0;
		foreach ($products as $product) {
			$index++;
			echo self::card_html($product, $atts, $totals, $index); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		echo '</ul></div>';
		return array(
			'html'  => (string) ob_get_clean(),
			'empty' => false,
		);
	}

	/**
	 * @param array $atts Sanitized atts.
	 * @return WC_Product[]
	 */
	public static function query_products($atts) {
		$tax_query  = array();
		$meta_query = array();

		if (!empty($atts['categories'])) {
			$tax_query[] = array(
				'taxonomy'         => 'product_cat',
				'field'            => 'slug',
				'terms'            => $atts['categories'],
				'include_children' => true,
			);
		}
		if (!empty($atts['exclude_categories'])) {
			$tax_query[] = array(
				'taxonomy'         => 'product_cat',
				'field'            => 'slug',
				'terms'            => $atts['exclude_categories'],
				'operator'         => 'NOT IN',
				'include_children' => true,
			);
		}

		$visibility = array(
			'taxonomy' => 'product_visibility',
			'field'    => 'name',
			'terms'    => array('exclude-from-catalog', 'outofstock'),
			'operator' => 'NOT IN',
		);
		if (taxonomy_exists('product_visibility')) {
			$tax_query[] = $visibility;
		}

		if (count($atts['type']) === 1) {
			$meta_query = WDP_Donation_Type::get_meta_query($atts['type'][0]);
		}

		$orderby  = $atts['orderby'];
		$limit    = (int) $atts['limit'];
		$multi    = count($atts['type']) > 1;
		$per_page = $multi ? min(100, max($limit * 4, $limit)) : min(100, max($limit * 2, $limit));
		$args     = array(
			'post_type'              => 'product',
			'post_status'            => 'publish',
			'posts_per_page'         => $per_page,
			'order'                  => $atts['order'],
			'ignore_sticky_posts'    => true,
			'no_found_rows'          => true,
			'suppress_filters'       => false,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => true,
		);
		if (!empty($atts['ids'])) {
			$args['post__in'] = $atts['ids'];
			$args['orderby']  = 'post__in';
		} elseif ($orderby === 'random') {
			$args['orderby'] = 'rand';
		} elseif ($orderby === 'title') {
			$args['orderby'] = 'title';
		} elseif ($orderby === 'date') {
			$args['orderby'] = 'date';
		} elseif ($orderby === 'popularity') {
			$args['orderby']  = 'meta_value_num';
			$args['meta_key'] = 'total_sales'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		} else {
			$args['orderby'] = 'menu_order title';
		}
		if (!empty($atts['exclude'])) {
			$args['post__not_in'] = $atts['exclude'];
		}
		if (!empty($tax_query)) {
			if (count($tax_query) > 1) {
				$tax_query['relation'] = 'AND';
			}
			$args['tax_query'] = $tax_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		}
		if (!empty($meta_query)) {
			$args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		/**
		 * @param array $args WP_Query args.
		 * @param array $atts Sanitized attributes.
		 */
		$args = apply_filters('wdp_donations_query_args', $args, $atts);
		$out  = array();
		$page = 1;
		$max  = 20;
		while (count($out) < $limit && $page <= $max) {
			$args['paged'] = $page;
			$query         = new WP_Query($args);
			$posts         = is_object($query) && isset($query->posts) ? $query->posts : array();
			if (empty($posts)) {
				break;
			}
			foreach ($posts as $post) {
				$product = wc_get_product($post);
				if (!$product || !WDP_Donation_Scope::is_donation_product($product)) {
					continue;
				}
				if (!$product->is_purchasable() || !$product->is_in_stock() || !$product->is_visible()) {
					continue;
				}
				if (!empty($atts['type']) && !in_array(WDP_Donation_Type::for_product($product->get_id()), $atts['type'], true)) {
					continue;
				}
				$out[] = $product;
				if (count($out) >= $limit) {
					break;
				}
			}
			$got = count($posts);
			if ($got < $per_page) {
				break;
			}
			$page++;
		}
		if (function_exists('wp_reset_postdata')) {
			wp_reset_postdata();
		}
		return $out;
	}

	/**
	 * @param WC_Product[] $products Products.
	 * @return array<int, array{id:int,slug:string,name:string,parent:int}>
	 */
	private static function build_tabs($products) {
		$used = array();
		foreach ($products as $product) {
			$ids = method_exists($product, 'get_category_ids') ? array_map('absint', (array) $product->get_category_ids()) : array();
			foreach ($ids as $term_id) {
				if ($term_id > 0) {
					$used[ $term_id ] = true;
				}
			}
		}
		if (empty($used)) {
			return array();
		}
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'include'    => array_keys($used),
				'hide_empty' => false,
			)
		);
		if (is_wp_error($terms) || empty($terms)) {
			return array();
		}
		$uncat = function_exists('get_option') ? (int) get_option('default_product_cat', 0) : 0;
		$out   = array();
		foreach ($terms as $term) {
			if ((int) $term->term_id === $uncat) {
				continue;
			}
			$slug = sanitize_title($term->slug);
			if ($slug === 'uncategorized') {
				continue;
			}
			$out[] = array(
				'id'     => (int) $term->term_id,
				'slug'   => $slug,
				'name'   => $term->name,
				'parent' => (int) $term->parent,
				'order'  => isset($term->term_order) ? (int) $term->term_order : 0,
			);
		}
		usort(
			$out,
			static function ($a, $b) {
				if ($a['order'] !== $b['order']) {
					return $a['order'] - $b['order'];
				}
				return strcasecmp($a['name'], $b['name']);
			}
		);
		return $out;
	}

	/**
	 * @param array  $tabs     Tabs.
	 * @param array  $atts     Atts.
	 * @param string $uid      Tablist unique id (placeholder allowed).
	 * @param string $panel_id Panel element id (placeholder allowed).
	 * @return string
	 */
	private static function tabs_html(array $tabs, array $atts, $uid = '', $panel_id = '') {
		$uid      = $uid !== '' ? $uid : self::UID_PLACEHOLDER;
		$panel_id = $panel_id !== '' ? $panel_id : self::PANEL_PLACEHOLDER;
		ob_start();
		echo '<div class="wdp-list__tabs" role="tablist" aria-label="' . esc_attr__('Bağış kategorileri', 'woo-donation-popup') . '" data-wdp-tabs data-wdp-tabs-id="' . esc_attr($uid) . '">';
		if ($atts['tab_all'] === 'yes') {
			echo '<button type="button" class="wdp-list__tab is-active" role="tab" id="' . esc_attr($uid . '-all') . '" aria-selected="true" aria-controls="' . esc_attr($panel_id) . '" tabindex="0" data-wdp-tab="all">' . esc_html($atts['tab_all_label']) . '</button>';
		}
		foreach ($tabs as $tab) {
			$hash = 'bagis-' . $tab['slug'];
			echo '<button type="button" class="wdp-list__tab" role="tab" id="' . esc_attr($uid . '-' . $tab['slug']) . '" aria-selected="false" aria-controls="' . esc_attr($panel_id) . '" tabindex="-1" data-wdp-tab="' . esc_attr($tab['slug']) . '" data-wdp-hash="' . esc_attr($hash) . '">' . esc_html($tab['name']) . '</button>';
		}
		echo '</div>';
		return (string) ob_get_clean();
	}

	/**
	 * @param WC_Product $product Product.
	 * @param array      $atts    Atts.
	 * @param array      $totals  Totals.
	 * @param int        $index   1-based index.
	 * @return string
	 */
	private static function card_html($product, array $atts, array $totals, $index) {
		$id      = (int) $product->get_id();
		$url     = $product->get_permalink();
		$name    = $product->get_name();
		$cat_ids = method_exists($product, 'get_category_ids') ? array_map('absint', (array) $product->get_category_ids()) : array();
		$slugs   = array();
		foreach ($cat_ids as $term_id) {
			$term = get_term($term_id, 'product_cat');
			if ($term && !is_wp_error($term)) {
				$slugs[] = $term->slug;
				$anc     = get_ancestors($term_id, 'product_cat', 'taxonomy');
				foreach ($anc as $ancestor) {
					$p = get_term((int) $ancestor, 'product_cat');
					if ($p && !is_wp_error($p)) {
						$slugs[] = $p->slug;
					}
				}
			}
		}
		$slugs = array_values(array_unique($slugs));

		$button_text = $atts['button_text'] !== '' ? $atts['button_text'] : WDP_Shortcodes::resolve_button_text('');
		$cta_class   = 'wdp-card__cta';
		if ($atts['button_full'] === 'yes') {
			$cta_class .= ' wdp-card__cta--full';
		}
		$cta_tag = 'a';
		$cta_attrs = ' href="' . esc_url($url) . '" class="' . esc_attr($cta_class) . '"';
		if ($atts['button'] !== 'link') {
			$mode       = $atts['button'] === 'panel' ? 'side_panel' : 'popup';
			$cta_class .= ' wdp-open-modal' . ($mode === 'side_panel' ? ' wdp-open-side-panel' : '');
			$cta_tag    = 'button';
			$cta_attrs  = ' type="button" class="' . esc_attr($cta_class) . '" data-product-id="' . esc_attr((string) $id) . '" data-wdp-mode="' . esc_attr($mode) . '" data-wdp-lazy="1"';
		}

		$type       = WDP_Donation_Type::for_product($id);
		$price_html = '';
		if ($atts['show_price'] === 'yes') {
			if ($type === WDP_Donation_Type::SHARES) {
				$share_price = WDP_Utils::format_product_display_price($product);
				$price_html  = esc_html(sprintf(
					/* translators: %s: formatted share price */
					__('Hisse: %s', 'woo-donation-popup'),
					wp_strip_all_tags($share_price)
				));
			} elseif ($type === WDP_Donation_Type::CUSTOM) {
				$min = (float) $product->get_meta('_min_custom_price', true);
				if ($min > 0) {
					$price_html = esc_html(sprintf(
						/* translators: %s: formatted minimum amount */
						__('min. %s', 'woo-donation-popup'),
						wp_strip_all_tags(WDP_Utils::format_price_html($min))
					));
				}
			} elseif ($type === WDP_Donation_Type::CAMPAIGN) {
				$goal  = (float) $product->get_meta('_progress_bar_limit', true);
				$total = isset($totals[ $id ]) ? (float) $totals[ $id ] : 0.0;
				if ($goal > 0) {
					$price_html = esc_html(sprintf(
						/* translators: 1: collected, 2: goal */
						__('%1$s / %2$s', 'woo-donation-popup'),
						wp_strip_all_tags(WDP_Utils::format_price_html($total)),
						wp_strip_all_tags(WDP_Utils::format_price_html($goal))
					));
				}
			} else {
				$price_html = WDP_Utils::format_product_display_price($product);
			}
		}

		$progress = '';
		if ($atts['show_progress'] === 'yes' && $type === WDP_Donation_Type::CAMPAIGN) {
			$goal = (float) $product->get_meta('_progress_bar_limit', true);
			if ($goal > 0) {
				$total = isset($totals[ $id ]) ? (float) $totals[ $id ] : 0.0;
				$pct   = (int) min(100, floor(($total / $goal) * 100));
				$label = sprintf(
					/* translators: 1: collected, 2: goal */
					__('%1$s / %2$s toplandı', 'woo-donation-popup'),
					wp_strip_all_tags(WDP_Utils::format_price_html($total)),
					wp_strip_all_tags(WDP_Utils::format_price_html($goal))
				);
				$progress = '<div class="wdp-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr((string) $pct) . '" aria-label="' . esc_attr($label) . '"><span class="wdp-card__progress-bar" style="width:' . esc_attr((string) $pct) . '%"></span></div>';
			}
		}

		$excerpt = '';
		if ($atts['show_excerpt'] === 'yes' && (int) $atts['excerpt_words'] > 0) {
			$raw     = $product->get_short_description();
			$excerpt = wp_trim_words(wp_strip_all_tags(strip_shortcodes((string) $raw)), (int) $atts['excerpt_words']);
		}

		$image = '';
		if ($atts['show_image'] === 'yes') {
			$thumb_id = $product->get_image_id();
			$alt      = $name;
			$attrs    = array(
				'alt'     => $alt,
				'class'   => 'wdp-card__img',
				'loading' => $index <= 3 ? 'eager' : 'lazy',
			);
			if ($index === 1) {
				$attrs['fetchpriority'] = 'high';
			}
			if ($thumb_id && function_exists('wp_get_attachment_image')) {
				$image = wp_get_attachment_image($thumb_id, $atts['image_size'], false, $attrs);
			}
			if ($image === '' && function_exists('wc_placeholder_img')) {
				$image = wc_placeholder_img($atts['image_size']);
			}
		}

		$heading = $atts['heading_tag'];
		$cat_html = '';
		if ($atts['show_category'] === 'yes' && !empty($slugs)) {
			$term = get_term($cat_ids[0], 'product_cat');
			if ($term && !is_wp_error($term)) {
				$cat_html = '<p class="wdp-card__cat">' . esc_html($term->name) . '</p>';
			}
		}

		$html  = '<li class="wdp-list__item" data-wdp-cats="' . esc_attr(implode(' ', $slugs)) . '">';
		$html .= '<article class="wdp-card">';
		if ($image !== '') {
			$html .= '<a class="wdp-card__media" href="' . esc_url($url) . '" aria-hidden="true" tabindex="-1">' . $image . '</a>';
		}
		$html .= '<div class="wdp-card__body">';
		$html .= $cat_html;
		$html .= '<' . $heading . ' class="wdp-card__title"><a href="' . esc_url($url) . '">' . esc_html($name) . '</a></' . $heading . '>';
		if ($excerpt !== '') {
			$html .= '<p class="wdp-card__excerpt">' . esc_html($excerpt) . '</p>';
		}
		if ($price_html !== '') {
			$html .= '<p class="wdp-card__price">' . $price_html . '</p>';
		}
		$html .= $progress;
		$html .= '<' . $cta_tag . $cta_attrs . '>' . esc_html($button_text) . '</' . $cta_tag . '>';
		$html .= '</div></article></li>';

		/**
		 * @param string     $html    Card HTML.
		 * @param WC_Product $product Product.
		 * @param array      $atts    Sanitized atts.
		 */
		return (string) apply_filters('wdp_donations_card_html', $html, $product, $atts);
	}

	/**
	 * @param string $html List HTML.
	 * @return void
	 */
	private static function collect_schema_from_html($html) {
		if (!preg_match_all('#<article class="wdp-card">.*?<a href="([^"]+)"[^>]*>\s*([^<]+)\s*</a>#s', $html, $m, PREG_SET_ORDER)) {
			if (!preg_match_all('#wdp-card__title"><a href="([^"]+)">([^<]+)</a>#', $html, $m, PREG_SET_ORDER)) {
				return;
			}
		}
		foreach ($m as $row) {
			self::$schema_items[] = array(
				'url'  => html_entity_decode($row[1], ENT_QUOTES, 'UTF-8'),
				'name' => html_entity_decode($row[2], ENT_QUOTES, 'UTF-8'),
			);
		}
	}

	/**
	 * @param array $atts Sanitized atts.
	 * @return string
	 */
	private static function empty_reason($atts) {
		if (!empty($atts['ids'])) {
			return __('Sorgu sonuç vermedi: verilen ürün ID’leri yayımlanmış bir bağış ürünü değil veya kapsam dışında.', 'woo-donation-popup');
		}
		if (!empty($atts['categories'])) {
			return __('Sorgu sonuç vermedi: seçilen kategorilerde yayımlanmış, stokta ve satın alınabilir bağış ürünü yok.', 'woo-donation-popup');
		}
		if (WDP_Placement_Settings::value('donation_scope') === 'marked') {
			return __('Sorgu sonuç vermedi: kapsam “yalnızca işaretli ürünler”; Bağış sekmesinden ürün işaretleyin.', 'woo-donation-popup');
		}
		return __('Sorgu sonuç vermedi: yayımlanmış, katalogda görünen ve stokta bağış ürünü yok.', 'woo-donation-popup');
	}

	/**
	 * @param array $atts Sanitized atts.
	 * @return string
	 */
	public static function cache_key($atts) {
		$locale   = function_exists('determine_locale') ? determine_locale() : get_locale();
		$currency = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : '';
		$version  = defined('WDP_VERSION') ? WDP_VERSION : '';
		$cv       = (int) get_option(self::CACHE_VERSION, 1);
		return 'wdp_list_' . md5(wp_json_encode($atts) . '|' . $locale . '|' . $currency . '|' . $version . '|' . $cv);
	}

	/**
	 * @param mixed $raw CSV.
	 * @return string[]
	 */
	private static function csv_slugs($raw) {
		$out = array();
		foreach (preg_split('/[\s,]+/', (string) $raw) as $part) {
			$slug = sanitize_title($part);
			if ($slug !== '') {
				$out[] = $slug;
			}
		}
		return array_values(array_unique($out));
	}

	/**
	 * @param mixed $raw CSV.
	 * @return int[]
	 */
	private static function csv_ids($raw) {
		$out = array();
		foreach (preg_split('/[\s,]+/', (string) $raw) as $part) {
			$id = absint($part);
			if ($id > 0) {
				$out[] = $id;
			}
		}
		return array_values(array_unique($out));
	}

	/**
	 * @param string $ratio Ratio token.
	 * @return string
	 */
	private static function ratio_css($ratio) {
		$map = array(
			'1:1'  => '1 / 1',
			'4:3'  => '4 / 3',
			'3:2'  => '3 / 2',
			'16:9' => '16 / 9',
		);
		return isset($map[ $ratio ]) ? $map[ $ratio ] : '';
	}
}
