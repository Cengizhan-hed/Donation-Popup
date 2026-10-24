<?php
/**
 * Ayarlar → Ürünler sekmesindeki WP_List_Table tabanlı bağış ürünleri tablosu (arama, filtre, sayfalama).
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

if (!class_exists('WP_List_Table')) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

/**
 * Donation products overview table.
 */
class WDP_Admin_Products_List_Table extends WP_List_Table {
	const PER_PAGE    = 20;
	const CATEGORY_QV = 'wdp_cat';
	const TYPE_QV     = 'wdp_type';

	/**
	 * Constructor.
	 */
	public function __construct() {
		parent::__construct(
			array(
				'singular' => 'wdp_product',
				'plural'   => 'wdp_products',
				'ajax'     => false,
			)
		);
	}

	/**
	 * @return array<string, string>
	 */
	public function get_columns() {
		return array(
			'cb'        => '<input type="checkbox" />',
			'name'      => __('Product', 'woo-donation-popup'),
			'category'  => __('Category', 'woo-donation-popup'),
			'type'      => __('Donation type', 'woo-donation-popup'),
			'shortcode' => __('Shortcode', 'woo-donation-popup'),
			'progress'  => __('Goal / Raised', 'woo-donation-popup'),
			'actions'   => '<span class="screen-reader-text">' . esc_html__('Actions', 'woo-donation-popup') . '</span>',
		);
	}

	/**
	 * @return array<string, array{0:string,1:bool}>
	 */
	protected function get_sortable_columns() {
		return array(
			'name' => array('title', false),
		);
	}

	/**
	 * @return string
	 */
	protected function get_primary_column_name() {
		return 'name';
	}

	/**
	 * Auto layout so long product names get the space they need instead of wrapping word by word.
	 *
	 * @return string[]
	 */
	protected function get_table_classes() {
		return array('widefat', 'striped', 'table-view-list', 'wdp-products-table');
	}

	/**
	 * @return void
	 */
	public function no_items() {
		esc_html_e('No products match these filters.', 'woo-donation-popup');
	}

	/**
	 * Query products for the current page.
	 *
	 * @return void
	 */
	public function prepare_items() {
		$this->_column_headers = array($this->get_columns(), array(), $this->get_sortable_columns(), $this->get_primary_column_name());

		$args = array(
			'post_type'           => 'product',
			'post_status'         => array('publish', 'future', 'draft', 'pending', 'private'),
			'posts_per_page'      => self::PER_PAGE,
			'paged'               => $this->get_pagenum(),
			'orderby'             => 'title',
			'order'               => $this->get_order(),
			'ignore_sticky_posts' => true,
		);

		$search = $this->get_search();
		if ($search !== '') {
			if (ctype_digit($search)) {
				$args['p'] = (int) $search;
			} else {
				$args['s'] = $search;
			}
		}

		$category = $this->get_category_filter();
		if ($category > 0) {
			$args['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
				array(
					'taxonomy'         => 'product_cat',
					'field'            => 'term_id',
					'terms'            => $category,
					'include_children' => true,
				),
			);
		}

		$type = $this->get_type_filter();
		if ($type !== '') {
			$args['meta_query'] = WDP_Donation_Type::get_meta_query($type); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		$query = new WP_Query($args);

		$this->items = array();
		foreach ($query->posts as $post) {
			$product = wc_get_product($post);
			if ($product) {
				$this->items[] = $product;
			}
		}

		$this->set_pagination_args(
			array(
				'total_items' => (int) $query->found_posts,
				'per_page'    => self::PER_PAGE,
				'total_pages' => (int) $query->max_num_pages,
			)
		);
	}

	/**
	 * Category + donation type filters.
	 *
	 * @param string $which top|bottom.
	 * @return void
	 */
	protected function extra_tablenav($which) {
		if ($which !== 'top') {
			return;
		}

		echo '<div class="alignleft actions wdp-products-table__filters">';

		echo '<label class="screen-reader-text" for="wdp-filter-category">' . esc_html__('Filter by category', 'woo-donation-popup') . '</label>';
		wp_dropdown_categories(
			array(
				'taxonomy'        => 'product_cat',
				'name'            => self::CATEGORY_QV,
				'id'              => 'wdp-filter-category',
				'selected'        => $this->get_category_filter(),
				'show_option_all' => __('All categories', 'woo-donation-popup'),
				'hide_empty'      => false,
				'hierarchical'    => true,
				'orderby'         => 'name',
				'value_field'     => 'term_id',
			)
		);

		echo '<label class="screen-reader-text" for="wdp-filter-type">' . esc_html__('Filter by donation type', 'woo-donation-popup') . '</label>';
		echo '<select name="' . esc_attr(self::TYPE_QV) . '" id="wdp-filter-type">';
		echo '<option value="">' . esc_html__('All donation types', 'woo-donation-popup') . '</option>';
		foreach (WDP_Donation_Type::get_definitions() as $type => $def) {
			echo '<option value="' . esc_attr($type) . '"' . selected($this->get_type_filter(), $type, false) . '>' . esc_html($def['label']) . '</option>';
		}
		echo '</select>';

		submit_button(__('Filter', 'woo-donation-popup'), '', 'wdp_filter', false);

		if ($this->get_category_filter() > 0 || $this->get_type_filter() !== '' || $this->get_search() !== '') {
			echo ' <a class="button-link wdp-products-table__reset" href="' . esc_url(self::get_base_url()) . '">' . esc_html__('Clear filters', 'woo-donation-popup') . '</a>';
		}

		echo '</div>';
	}

	/**
	 * Settings page URL (products tab).
	 *
	 * @return string
	 */
	public static function get_base_url() {
		return admin_url('admin.php?page=wdp-popup-settings') . '#products';
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_name($product) {
		$edit_url = WDP_Admin_Product_Data_Tab::get_edit_url($product->get_id());
		$thumb    = $product->get_image(array(40, 40), array('class' => 'wdp-products-table__img', 'alt' => '', 'loading' => 'lazy'));

		$state = '';
		$status = $product->get_status();
		if ($status !== 'publish') {
			$status_object = get_post_status_object($status);
			if ($status_object) {
				$state = ' <span class="post-state">— ' . esc_html($status_object->label) . '</span>';
			}
		}

		$out  = '<div class="wdp-products-table__product">';
		$out .= '<span class="wdp-products-table__thumb" aria-hidden="true">' . $thumb . '</span>';
		$is_donation = class_exists('WDP_Donation_Scope') && WDP_Donation_Scope::is_donation_product($product);
		if ($is_donation) {
			$badge_label = __('Donation product', 'woo-donation-popup');
			$badge_class = 'wdp-scope-badge wdp-scope-badge--yes';
		} else {
			$badge_label = __('Regular product', 'woo-donation-popup');
			$badge_class = 'wdp-scope-badge wdp-scope-badge--no';
		}

		$out .= '<span class="wdp-products-table__title"><a class="row-title" href="' . esc_url($edit_url) . '">' . esc_html($product->get_name()) . '</a>' . $state;
		$out .= ' <span class="' . esc_attr($badge_class) . '">' . esc_html($badge_label) . '</span>';

		if (class_exists('WDP_Sadaka_Product_Visibility') && WDP_Sadaka_Product_Visibility::is_sadaka_line_product($product->get_id())) {
			$referrers = WDP_Sadaka_Product_Visibility::get_referrer_labels($product->get_id());
			$count     = count($referrers);
			if ($count > 0) {
				$sadaka_title = implode(', ', $referrers);
				$sadaka_label = sprintf(
					/* translators: %d: number of parent products using this as alt donation */
					__('Used as an add-on donation (%d)', 'woo-donation-popup'),
					$count
				);
				$out .= ' <span class="wdp-scope-badge wdp-scope-badge--sadaka" title="' . esc_attr($sadaka_title) . '">' . esc_html($sadaka_label) . '</span>';
			}
		}
		$out .= '<span class="wdp-products-table__id">#' . esc_html((string) $product->get_id()) . '</span></span>';
		$out .= '</div>';

		$permalink = get_permalink($product->get_id());
		$actions   = array(
			'edit' => '<a href="' . esc_url($edit_url) . '">' . esc_html__('Donation settings', 'woo-donation-popup') . '</a>',
		);
		if ($permalink && $status === 'publish') {
			$actions['view'] = '<a href="' . esc_url($permalink) . '" target="_blank" rel="noopener noreferrer">' . esc_html_x('View', 'row action', 'woo-donation-popup') . '<span class="screen-reader-text"> ' . esc_html__('(opens in a new tab)', 'woo-donation-popup') . '</span></a>';
		}

		return $out . $this->row_actions($actions);
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_category($product) {
		$terms = get_the_terms($product->get_id(), 'product_cat');
		if (empty($terms) || is_wp_error($terms)) {
			return '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__('No category', 'woo-donation-popup') . '</span>';
		}

		$links = array();
		foreach ($terms as $term) {
			$url     = add_query_arg(self::CATEGORY_QV, (int) $term->term_id, admin_url('admin.php?page=wdp-popup-settings')) . '#products';
			$links[] = '<a href="' . esc_url($url) . '">' . esc_html($term->name) . '</a>';
		}
		return implode(', ', $links);
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_type($product) {
		$type = WDP_Donation_Type::for_product($product->get_id());
		return '<span class="wdp-type-badge wdp-type-badge--' . esc_attr($type) . '">' . esc_html(WDP_Donation_Type::get_label($type)) . '</span>';
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_shortcode($product) {
		$shortcodes = WDP_Admin_Product_Data_Tab::get_shortcodes($product->get_id());
		$out        = '<div class="wdp-products-table__shortcode">';
		foreach ($shortcodes as $row) {
			$code = $row['code'];
			$out .= '<div class="wdp-products-table__shortcode-row">';
			$out .= '<code>' . esc_html($code) . '</code>';
			/* translators: %s: shortcode */
			$out .= '<button type="button" class="wdp-icon-button" data-wdp-copy="' . esc_attr($code) . '" aria-label="' . esc_attr(sprintf(__('Copy shortcode: %s', 'woo-donation-popup'), $code)) . '" title="' . esc_attr__('Copy', 'woo-donation-popup') . '">';
			$out .= '<span class="dashicons dashicons-admin-page" aria-hidden="true"></span>';
			$out .= '</button>';
			$out .= '</div>';
		}
		$out .= '</div>';

		return $out;
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_progress($product) {
		if (WDP_Donation_Type::for_product($product->get_id()) !== WDP_Donation_Type::CAMPAIGN) {
			return '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__('No goal', 'woo-donation-popup') . '</span>';
		}

		ob_start();
		WDP_Admin_Product_Data_Tab::render_progress_summary($product->get_id(), true);
		return (string) ob_get_clean();
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_actions($product) {
		/* translators: %s: product name */
		$label = sprintf(__('Edit donation settings for %s', 'woo-donation-popup'), $product->get_name());
		return '<a class="button" href="' . esc_url(WDP_Admin_Product_Data_Tab::get_edit_url($product->get_id())) . '" aria-label="' . esc_attr($label) . '">' . esc_html__('Edit', 'woo-donation-popup') . '</a>';
	}

	/**
	 * @param WC_Product $item        Product.
	 * @param string     $column_name Column.
	 * @return string
	 */
	protected function column_default($item, $column_name) {
		return '';
	}

	/**
	 * @param WC_Product $product Product.
	 * @return string
	 */
	protected function column_cb($product) {
		return '<input type="checkbox" name="wdp_product[]" value="' . esc_attr((string) $product->get_id()) . '" />';
	}

	/**
	 * @return array<string, string>
	 */
	protected function get_bulk_actions() {
		return array(
			'wdp_mark_donation' => __('Make donation product', 'woo-donation-popup'),
			'wdp_mark_normal'   => __('Make regular product', 'woo-donation-popup'),
			'wdp_mark_global'   => __('Revert to the global setting', 'woo-donation-popup'),
		);
	}

	/**
	 * @return string
	 */
	private function get_search() {
		return isset($_REQUEST['s']) ? trim(sanitize_text_field(wp_unslash($_REQUEST['s']))) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * @return int
	 */
	private function get_category_filter() {
		return isset($_REQUEST[ self::CATEGORY_QV ]) ? absint(wp_unslash($_REQUEST[ self::CATEGORY_QV ])) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * @return string
	 */
	private function get_type_filter() {
		$raw = isset($_REQUEST[ self::TYPE_QV ]) ? wp_unslash($_REQUEST[ self::TYPE_QV ]) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return WDP_Donation_Type::sanitize($raw, '');
	}

	/**
	 * @return string
	 */
	private function get_order() {
		$order = isset($_REQUEST['order']) ? strtoupper(sanitize_key(wp_unslash($_REQUEST['order']))) : 'ASC'; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return $order === 'DESC' ? 'DESC' : 'ASC';
	}
}
