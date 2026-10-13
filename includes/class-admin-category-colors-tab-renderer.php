<?php
/**
 * Ürün kategorileri için başlık rengi seçim formu.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Renders category color settings.
 */
class WDP_Admin_Category_Colors_Tab_Renderer {
	/**
	 * Category color fields without form chrome (embedded in Görünüm).
	 *
	 * @return void
	 */
	public static function render_fields_only() {
		if (!taxonomy_exists('product_cat')) {
			echo '<p>' . esc_html__('WooCommerce ürün kategorileri bulunamadı.', 'woo-donation-popup') . '</p>';
			return;
		}

		$colors = class_exists('WDP_Category_Title_Color_Service')
			? WDP_Category_Title_Color_Service::get_all()
			: array();

		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		if (is_wp_error($terms) || empty($terms)) {
			echo '<p>' . esc_html__('Henüz ürün kategorisi yok.', 'woo-donation-popup') . '</p>';
			return;
		}

		$tree = self::build_category_tree($terms);
		echo '<div class="wdp-category-colors-compact">';
		foreach ($tree as $node) {
			self::render_category_node($node, $colors, 0);
		}
		echo '</div>';
	}

	/**
	 * @return void
	 */
	public static function render_tab() {
		WDP_Admin_Renderer_Helpers::open_form_container('wdp-category-colors-settings-form');
		echo '<div class="wdp-tab-help" role="note"><p class="wdp-tab-help__title">' . esc_html__('Kategori başlık renkleri', 'woo-donation-popup') . '</p>';
		echo '<ul class="wdp-tab-help__list"><li>' . esc_html__('Her kategori için renk seçin; o kategoriye doğrudan atanmış ürünlerin panel başlığı bu renkle görünür.', 'woo-donation-popup') . '</li>';
		echo '<li>' . esc_html__('Ürün birden fazla kategorideyse en alt (en spesifik) kategori rengi kullanılır.', 'woo-donation-popup') . '</li></ul></div>';
		self::render_fields_only();
		WDP_Admin_Renderer_Helpers::close_form_container('wdp-save-category-colors-settings');
	}

	/**
	 * @param array<int, WP_Term> $terms Flat terms.
	 * @return array<int, array{term:WP_Term,children:array}>
	 */
	private static function build_category_tree(array $terms) {
		$nodes = array();
		foreach ($terms as $term) {
			if (!($term instanceof WP_Term)) {
				continue;
			}
			$nodes[ (int) $term->term_id ] = array(
				'term'     => $term,
				'children' => array(),
			);
		}

		$roots = array();
		foreach ($nodes as $term_id => $node) {
			$parent = (int) $node['term']->parent;
			if ($parent > 0 && isset($nodes[ $parent ])) {
				$nodes[ $parent ]['children'][ $term_id ] = &$nodes[ $term_id ];
			} else {
				$roots[ $term_id ] = &$nodes[ $term_id ];
			}
		}

		return $roots;
	}

	/**
	 * @param array{term:WP_Term,children:array} $node       Tree node.
	 * @param array<int,string>                 $colors     Saved colors.
	 * @param int                               $depth      Nesting depth.
	 * @return void
	 */
	private static function render_category_node(array $node, array $colors, $depth) {
		$term    = $node['term'];
		$term_id = (int) $term->term_id;
		$current = isset($colors[ $term_id ]) ? $colors[ $term_id ] : '';
		$enabled = $current !== '';
		$preview = $current ? $current : '#1f2937';

		$products = self::get_products_for_category($term_id);
		$indent   = max(0, min(4, $depth));

		echo '<section class="wdp-cat-color-block" data-depth="' . esc_attr((string) $indent) . '" style="--wdp-cat-indent:' . esc_attr((string) ( $indent * 14 )) . 'px">';
		echo '<header class="wdp-cat-color-block__head">';
		echo '<div class="wdp-cat-color-block__title-wrap">';
		echo '<h3 class="wdp-cat-color-block__title">' . esc_html($term->name) . '</h3>';
		echo '<span class="wdp-cat-color-block__meta">ID ' . esc_html((string) $term_id);
		if (!empty($products)) {
			echo ' · ' . esc_html(sprintf(_n('%d ürün', '%d ürün', count($products), 'woo-donation-popup'), count($products)));
		}
		echo '</span>';
		echo '</div>';
		echo '<div class="wdp-cat-color-block__controls">';
		echo '<label class="wdp-cat-color-block__enable"><input type="checkbox" name="category_color_enable[' . esc_attr((string) $term_id) . ']" value="1" ' . checked($enabled, true, false) . ' /> ' . esc_html__('Renk', 'woo-donation-popup') . '</label>';
		echo '<input type="color" class="wdp-cat-color-picker" name="category_color[' . esc_attr((string) $term_id) . ']" value="' . esc_attr($current ? $current : '#036a37') . '" data-preview-target="wdp-cat-preview-' . esc_attr((string) $term_id) . '" />';
		echo '</div>';
		echo '</header>';

		if (!empty($products)) {
			echo '<ul class="wdp-cat-color-block__products" id="wdp-cat-preview-' . esc_attr((string) $term_id) . '">';
			foreach ($products as $product) {
				if (!($product instanceof WC_Product)) {
					continue;
				}
				$style = $enabled ? ' style="color:' . esc_attr($preview) . '"' : '';
				echo '<li><span class="wdp-cat-color-block__product-name"' . $style . '>' . esc_html($product->get_name()) . '</span>';
				echo ' <code class="wdp-cat-color-block__product-id">#' . esc_html((string) $product->get_id()) . '</code></li>';
			}
			echo '</ul>';
		} else {
			echo '<p class="wdp-cat-color-block__empty">' . esc_html__('Bu kategoriye doğrudan atanmış ürün yok.', 'woo-donation-popup') . '</p>';
		}

		echo '</section>';

		if (!empty($node['children'])) {
			foreach ($node['children'] as $child) {
				self::render_category_node($child, $colors, $depth + 1);
			}
		}
	}

	/**
	 * Products assigned directly to this category (not child terms).
	 *
	 * @param int $term_id Category term ID.
	 * @return array<int, WC_Product>
	 */
	private static function get_products_for_category($term_id) {
		$term_id = absint($term_id);
		if ($term_id <= 0 || !function_exists('wc_get_products')) {
			return array();
		}

		$ids = wc_get_products(
			array(
				'status'    => array( 'publish', 'private' ),
				'limit'     => -1,
				'orderby'   => 'title',
				'order'     => 'ASC',
				'return'    => 'ids',
				'tax_query' => array(
					array(
						'taxonomy'         => 'product_cat',
						'field'            => 'term_id',
						'terms'            => array( $term_id ),
						'include_children' => false,
					),
				),
			)
		);

		if (!is_array($ids) || empty($ids)) {
			return array();
		}

		$out = array();
		foreach ($ids as $id) {
			$product = wc_get_product($id);
			if ($product) {
				$out[] = $product;
			}
		}

		return $out;
	}
}
