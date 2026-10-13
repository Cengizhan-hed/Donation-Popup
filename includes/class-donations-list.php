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
	 * @param array $atts Attributes.
	 * @return array<string, mixed>
	 */
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
			'class'              => isset($atts['class']) ? sanitize_html_class((string) $atts['class']) : '',
		);
	}

	/**
	 * @param array $atts Raw or sanitized attributes.
	 * @return string
	 */
	public static function render($atts) {
		$atts = self::sanitize_atts($atts);
		self::enqueue_assets();

		$cache_key = self::cache_key($atts);
		$html      = get_transient($cache_key);
		if (!is_string($html) || $html === '') {
			$html = self::build_html($atts);
			set_transient($cache_key, $html, DAY_IN_SECONDS);
		}

		self::collect_schema_from_html($html);
		if (!self::$footer_hooked) {
			self::$footer_hooked = true;
			add_action('wp_footer', array(__CLASS__, 'print_schema'), 20);
		}

		return $html;
	}

	/**
	 * @return void
	 */
	public static function bump_cache() {
		$current = (int) get_option(self::CACHE_VERSION, 1);
		update_option(self::CACHE_VERSION, $current + 1, false);
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
	 * @param array $atts Sanitized atts.
	 * @return string
	 */
	private static function build_html($atts) {
		$products = self::query_products($atts);
		if (empty($products)) {
			$msg = '<p class="wdp-list__empty">' . esc_html__('Şu anda gösterilecek bağış bulunmuyor.', 'woo-donation-popup') . '</p>';
			$why = '';
			if (function_exists('current_user_can') && current_user_can('edit_products')) {
				$why = WDP_Utils::admin_notice_html(self::empty_reason($atts));
			}
			$class = 'wdp-list-wrap' . ($atts['class'] !== '' ? ' ' . esc_attr($atts['class']) : '');
			return '<div class="' . $class . '">' . $why . $msg . '</div>';
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

		ob_start();
		echo '<div class="' . esc_attr($wrap_class) . '" style="' . esc_attr($style) . '">';
		if (!empty($tabs)) {
			echo self::tabs_html($tabs, $atts); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		echo '<ul class="wdp-list" role="list">';
		$index = 0;
		foreach ($products as $product) {
			$index++;
			echo self::card_html($product, $atts, $totals, $index); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		echo '</ul></div>';
		return (string) ob_get_clean();
	}

	/**
	 * @param array $atts Sanitized atts.
	 * @return WC_Product[]
	 */
	private static function query_products($atts) {
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

		$orderby = $atts['orderby'];
		$args    = array(
			'post_type'              => 'product',
			'post_status'            => 'publish',
			'posts_per_page'         => min(100, max((int) $atts['limit'] * 2, (int) $atts['limit'])),
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
		$args  = apply_filters('wdp_donations_query_args', $args, $atts);
		$query = new WP_Query($args);
		$out   = array();
		foreach ($query->posts as $post) {
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
			if (count($out) >= (int) $atts['limit']) {
				break;
			}
		}
		wp_reset_postdata();
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
				$used[ $term_id ] = true;
				$ancestors        = function_exists('get_ancestors') ? get_ancestors($term_id, 'product_cat', 'taxonomy') : array();
				foreach ($ancestors as $ancestor) {
					$used[ absint($ancestor) ] = true;
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
	 * @param array $tabs Tabs.
	 * @param array $atts Atts.
	 * @return string
	 */
	private static function tabs_html(array $tabs, array $atts) {
		$uid = 'wdp-list-tabs-' . wp_unique_id();
		ob_start();
		echo '<div class="wdp-list__tabs" role="tablist" aria-label="' . esc_attr__('Bağış kategorileri', 'woo-donation-popup') . '" data-wdp-tabs>';
		if ($atts['tab_all'] === 'yes') {
			echo '<button type="button" class="wdp-list__tab is-active" role="tab" id="' . esc_attr($uid . '-all') . '" aria-selected="true" aria-controls="' . esc_attr($uid) . '" data-wdp-tab="all">' . esc_html($atts['tab_all_label']) . '</button>';
		}
		foreach ($tabs as $tab) {
			$hash = 'bagis-' . $tab['slug'];
			echo '<button type="button" class="wdp-list__tab" role="tab" id="' . esc_attr($uid . '-' . $tab['slug']) . '" aria-selected="false" aria-controls="' . esc_attr($uid) . '" data-wdp-tab="' . esc_attr($tab['slug']) . '" data-wdp-hash="' . esc_attr($hash) . '">' . esc_html($tab['name']) . '</button>';
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
		$cta_attrs = ' href="' . esc_url($url) . '" class="' . esc_attr($cta_class) . '"';
		if ($atts['button'] !== 'link') {
			$mode      = $atts['button'] === 'panel' ? 'side_panel' : 'popup';
			$cta_class .= ' wdp-open-modal' . ($mode === 'side_panel' ? ' wdp-open-side-panel' : '');
			$cta_attrs = ' href="' . esc_url($url) . '" class="' . esc_attr($cta_class) . '" data-product-id="' . esc_attr((string) $id) . '" data-wdp-mode="' . esc_attr($mode) . '" data-wdp-lazy="1"';
		}

		$type     = WDP_Donation_Type::for_product($id);
		$price_html = '';
		if ($atts['show_price'] === 'yes') {
			if ($type === WDP_Donation_Type::SHARES) {
				$price_html = esc_html(sprintf(
					/* translators: %s: formatted share price */
					__('Hisse: %s', 'woo-donation-popup'),
					wp_strip_all_tags(WDP_Utils::format_price_html($product->get_price()))
				));
			} elseif ($type === WDP_Donation_Type::CUSTOM) {
				$price_html = esc_html__('Dilediğin tutar', 'woo-donation-popup');
			} elseif ($type === WDP_Donation_Type::CAMPAIGN && $atts['show_progress'] === 'yes') {
				$price_html = '';
			} else {
				$price_html = WDP_Utils::format_price_html($product->get_price());
			}
		}

		$progress = '';
		if ($atts['show_progress'] === 'yes' && $type === WDP_Donation_Type::CAMPAIGN) {
			$goal  = (float) $product->get_meta('_progress_bar_limit', true);
			$goal  = $goal > 0 ? $goal : (float) WDP_Donation_Type::DEFAULT_GOAL;
			$total = isset($totals[ $id ]) ? (float) $totals[ $id ] : 0.0;
			$pct   = $goal > 0 ? (int) min(100, floor(($total / $goal) * 100)) : 0;
			$label = sprintf(
				/* translators: 1: collected, 2: goal */
				__('%1$s / %2$s toplandı', 'woo-donation-popup'),
				wp_strip_all_tags(WDP_Utils::format_price_html($total)),
				wp_strip_all_tags(WDP_Utils::format_price_html($goal))
			);
			$progress = '<div class="wdp-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr((string) $pct) . '" aria-label="' . esc_attr($label) . '"><span class="wdp-card__progress-bar" style="width:' . esc_attr((string) $pct) . '%"></span></div>';
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
			$html .= '<a class="wdp-card__media" href="' . esc_url($url) . '">' . $image . '</a>';
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
		$html .= '<a' . $cta_attrs . '>' . esc_html($button_text) . '</a>';
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
	private static function cache_key($atts) {
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
