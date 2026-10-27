<?php
/**
 * [wdp_donations] liste kısa kodu: sorgu, sekme, kart HTML, transient önbellek ve varlıklar.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

use DonationPanel\Core\Plugin;
use DonationPanel\Core\Uninstall;
use DonationPanel\Domain\Button_Settings;
use DonationPanel\Domain\Campaign_Totals;
use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Domain\Placement_Settings;
use DonationPanel\Frontend\Assets;
use DonationPanel\Modules\Experiences\Experiences_Module;
use DonationPanel\Support\Admin_Notice;
use DonationPanel\Support\Price;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Donation product grid used by the shortcode, Gutenberg block.
 */
class Donations_List {

	const CACHE_VERSION = 'wdp_list_cache_version';
	/** Varlık modül adı (Assets::define / enqueue). */
	const ASSET_SLUG = 'list';

	/** İşaretleme sürümü: kart/sekme HTML'i değişince önbellek anahtarına girer. */
	const MARKUP_REV = '12.1';

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
			'set_object_terms'                     => true,
			'woocommerce_product_set_stock'        => true,
			'woocommerce_product_set_stock_status' => true,
			'created_product_cat'                  => true,
			'edited_product_cat'                   => true,
			'delete_product_cat'                   => true,
			'woocommerce_update_product'           => false,
			'woocommerce_new_product'              => false,
			'save_post_product'                    => false,
			'trashed_post'                         => false,
			'untrashed_post'                       => false,
			'before_delete_post'                   => false,
			'transition_post_status'               => false,
			'updated_post_meta:_price'             => false,
			'updated_post_meta:_regular_price'     => false,
			'updated_post_meta:_sale_price'        => false,
			'product_settings_save'                => false,
			'woocommerce_order_status_changed'     => false,
			'woocommerce_order_refunded'           => false,
		);
	}

	/**
	 * @return void
	 */
	public static function init() {
		if ( self::$invalidation_hooked ) {
			return;
		}
		self::$invalidation_hooked = true;
		add_action( 'set_object_terms', array( __CLASS__, 'on_set_object_terms' ), 10, 6 );
		add_action( 'woocommerce_product_set_stock', array( __CLASS__, 'bump_cache' ) );
		add_action( 'woocommerce_product_set_stock_status', array( __CLASS__, 'bump_cache' ) );
		add_action( 'created_product_cat', array( __CLASS__, 'bump_cache' ) );
		add_action( 'edited_product_cat', array( __CLASS__, 'bump_cache' ) );
		add_action( 'delete_product_cat', array( __CLASS__, 'bump_cache' ) );
		add_action( 'woocommerce_update_product', array( __CLASS__, 'bump_cache' ) );
		add_action( 'woocommerce_new_product', array( __CLASS__, 'bump_cache' ) );
		add_action( 'save_post_product', array( __CLASS__, 'on_save_post_product' ), 20, 3 );
		add_action( 'trashed_post', array( __CLASS__, 'on_product_post_event' ), 10, 1 );
		add_action( 'untrashed_post', array( __CLASS__, 'on_product_post_event' ), 10, 1 );
		add_action( 'before_delete_post', array( __CLASS__, 'on_product_post_event' ), 10, 1 );
		add_action( 'transition_post_status', array( __CLASS__, 'on_transition_post_status' ), 10, 3 );
		add_action( 'updated_post_meta', array( __CLASS__, 'on_product_meta' ), 10, 4 );
		add_action( 'added_post_meta', array( __CLASS__, 'on_product_meta' ), 10, 4 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'on_product_meta' ), 10, 4 );
		add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'bump_cache' ) );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'bump_cache' ) );
	}

	/**
	 * @param mixed $atts Shortcode attributes.
	 * @return string
	 */
	public static function shortcode( $atts ) {
		return Render_Guard::html(
			static function () use ( $atts ) {
				return self::render( is_array( $atts ) ? $atts : array() );
			},
			0,
			'wdp_donations'
		);
	}

	/**
	 * Kısa kod özniteliklerini temizler ve varsayılanlarla tamamlar.
	 *
	 * @param mixed $atts Ham öznitelikler.
	 * @return array<string, mixed>
	 */
	public static function sanitize_atts( $atts ) {
		$atts  = is_array( $atts ) ? $atts : array();
		$yesno = static function ( $value, $default_value ) {
			if ( null === $value || '' === $value ) {
				return $default_value;
			}
			$raw = strtolower( trim( (string) $value ) );
			if ( in_array( $raw, array( 'yes', '1', 'true', 'on' ), true ) ) {
				return 'yes';
			}
			if ( in_array( $raw, array( 'no', '0', 'false', 'off' ), true ) ) {
				return 'no';
			}
			return $default_value;
		};
		$int   = static function ( $value, $min, $max, $default_value ) {
			if ( null === $value || '' === $value ) {
				return $default_value;
			}
			$n = (int) $value;
			if ( $n < $min || $n > $max ) {
				return $default_value;
			}
			return $n;
		};

		$orderby = isset( $atts['orderby'] ) ? sanitize_key( (string) $atts['orderby'] ) : 'menu_order';
		if ( ! in_array( $orderby, array( 'menu_order', 'date', 'title', 'popularity', 'random' ), true ) ) {
			$orderby = 'menu_order';
		}
		$order = isset( $atts['order'] ) ? strtoupper( sanitize_key( (string) $atts['order'] ) ) : 'ASC';
		$order = 'DESC' === $order ? 'DESC' : 'ASC';

		$image_ratio = isset( $atts['image_ratio'] ) ? (string) $atts['image_ratio'] : '4:3';
		if ( ! in_array( $image_ratio, array( '1:1', '4:3', '3:2', '16:9', 'original' ), true ) ) {
			$image_ratio = '4:3';
		}
		$align  = isset( $atts['align'] ) ? sanitize_key( (string) $atts['align'] ) : 'center';
		$align  = 'left' === $align ? 'left' : 'center';
		$button = isset( $atts['button'] ) ? sanitize_key( (string) $atts['button'] ) : 'panel';
		if ( ! in_array( $button, array( 'panel', 'popup', 'link' ), true ) ) {
			$button = 'panel';
		}
		$heading = isset( $atts['heading_tag'] ) ? strtolower( sanitize_key( (string) $atts['heading_tag'] ) ) : 'h3';
		if ( ! in_array( $heading, array( 'h2', 'h3', 'h4' ), true ) ) {
			$heading = 'h3';
		}

		$types = array();
		if ( ! empty( $atts['type'] ) ) {
			foreach ( preg_split( '/[\s,]+/', (string) $atts['type'] ) as $type ) {
				$type = Donation_Type::sanitize( $type, '' );
				if ( '' !== $type && ! in_array( $type, $types, true ) ) {
					$types[] = $type;
				}
			}
		}

		return array(
			'categories'         => self::csv_slugs( isset( $atts['categories'] ) ? $atts['categories'] : '' ),
			'exclude_categories' => self::csv_slugs( isset( $atts['exclude_categories'] ) ? $atts['exclude_categories'] : '' ),
			'ids'                => self::csv_ids( isset( $atts['ids'] ) ? $atts['ids'] : '' ),
			'exclude'            => self::csv_ids( isset( $atts['exclude'] ) ? $atts['exclude'] : '' ), // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- kartlarda yinelenen ürünleri hariç tutmak için; sayfa başına küçük küme.
			'type'               => $types,
			'limit'              => $int( isset( $atts['limit'] ) ? $atts['limit'] : 48, 1, 100, 48 ),
			'orderby'            => $orderby,
			'order'              => $order,
			'title'              => isset( $atts['title'] ) ? sanitize_text_field( (string) $atts['title'] ) : '',
			'tabs'               => $yesno( isset( $atts['tabs'] ) ? $atts['tabs'] : null, 'yes' ),
			'tab_all'            => $yesno( isset( $atts['tab_all'] ) ? $atts['tab_all'] : null, 'yes' ),
			'tab_all_label'      => isset( $atts['tab_all_label'] ) && trim( (string) $atts['tab_all_label'] ) !== ''
				? sanitize_text_field( (string) $atts['tab_all_label'] )
				: __( 'All', 'woo-donation-popup' ),
			'columns'            => $int( isset( $atts['columns'] ) ? $atts['columns'] : 3, 1, 6, 3 ),
			'columns_tablet'     => $int( isset( $atts['columns_tablet'] ) ? $atts['columns_tablet'] : 2, 1, 6, 2 ),
			'columns_mobile'     => $int( isset( $atts['columns_mobile'] ) ? $atts['columns_mobile'] : 1, 1, 6, 1 ),
			'gap'                => $int( isset( $atts['gap'] ) ? $atts['gap'] : 24, 0, 64, 24 ),
			'image_ratio'        => $image_ratio,
			'align'              => $align,
			'button'             => $button,
			'button_full'        => $yesno( isset( $atts['button_full'] ) ? $atts['button_full'] : null, 'yes' ),
			'button_text'        => isset( $atts['button_text'] ) ? sanitize_text_field( (string) $atts['button_text'] ) : '',
			'show_image'         => $yesno( isset( $atts['show_image'] ) ? $atts['show_image'] : null, 'yes' ),
			'show_excerpt'       => $yesno( isset( $atts['show_excerpt'] ) ? $atts['show_excerpt'] : null, 'no' ),
			'show_progress'      => $yesno( isset( $atts['show_progress'] ) ? $atts['show_progress'] : null, 'yes' ),
			'show_price'         => $yesno( isset( $atts['show_price'] ) ? $atts['show_price'] : null, 'yes' ),
			'show_category'      => $yesno( isset( $atts['show_category'] ) ? $atts['show_category'] : null, 'no' ),
			'excerpt_words'      => $int( isset( $atts['excerpt_words'] ) ? $atts['excerpt_words'] : 18, 0, 60, 18 ),
			'image_size'         => isset( $atts['image_size'] ) && sanitize_key( (string) $atts['image_size'] ) !== ''
				? sanitize_key( (string) $atts['image_size'] )
				: 'woocommerce_thumbnail',
			'heading_tag'        => $heading,
			'class'              => isset( $atts['class'] )
				? Shortcodes::sanitize_class_list( $atts['class'] )
				: '',
		);
	}

	/**
	 * @param array<string, mixed> $atts Raw or sanitized attributes.
	 * @return string
	 */
	public static function render( $atts ) {
		$atts = self::sanitize_atts( $atts );
		self::enqueue_assets( 'link' !== $atts['button'] );

		$use_cache = 'random' !== $atts['orderby'];
		$html      = '';
		if ( $use_cache ) {
			$cache_key = self::cache_key( $atts );
			$cached    = get_transient( $cache_key );
			if ( is_string( $cached ) && '' !== $cached ) {
				$html = $cached;
			}
		}
		if ( '' === $html ) {
			$built = self::build_html( $atts );
			$html  = $built['html'];
			if ( $use_cache ) {
				set_transient( self::cache_key( $atts ), $html, DAY_IN_SECONDS );
			}
		} else {
			$built = array( 'empty' => ( strpos( $html, 'wdp-list__empty' ) !== false ) );
		}

		$html = self::apply_request_ids( $html );
		if ( ! empty( $built['empty'] ) && function_exists( 'current_user_can' ) && current_user_can( 'edit_products' ) ) {
			$notice = Admin_Notice::admin_notice_html( self::empty_reason( $atts ) );
			$html   = preg_replace( '/(<div\b[^>]*\bclass="[^"]*wdp-list-wrap[^"]*"[^>]*>)/', '$1' . $notice, $html, 1 );
		}

		return $html;
	}

	/**
	 * Increment list cache version once per request.
	 *
	 * @return void
	 */
	public static function bump_cache() {
		if ( self::$bumped_this_request ) {
			return;
		}
		self::$bumped_this_request = true;
		$current                   = (int) get_option( self::CACHE_VERSION, 1 );
		update_option( self::CACHE_VERSION, $current + 1, false );
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
	 * @param \WP_Post $post    Post.
	 * @param bool    $update  Update.
	 * @return void
	 */
	public static function on_save_post_product( $post_id, $post = null, $update = true ) {
		unset( $post, $update );
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( function_exists( 'wp_is_post_revision' ) && wp_is_post_revision( $post_id ) ) {
			return;
		}
		self::bump_cache();
	}

	/**
	 * @param int $post_id Post ID.
	 * @return void
	 */
	public static function on_product_post_event( $post_id ) {
		if ( self::post_is_product( $post_id ) ) {
			self::bump_cache();
		}
	}

	/**
	 * @param string   $new_status Yeni durum.
	 * @param string   $old_status Eski durum.
	 * @param \WP_Post $post       Yazı.
	 * @return void
	 */
	public static function on_transition_post_status( $new_status, $old_status, $post ) {
		if ( $new_status === $old_status || ! is_object( $post ) ) {
			return;
		}
		$type = property_exists( $post, 'post_type' ) ? (string) $post->post_type : '';
		if ( 'product' === $type || 'product_variation' === $type ) {
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
	public static function on_product_meta( $meta_id, $object_id, $meta_key, $meta_value = null ) {
		unset( $meta_id, $meta_value );
		$key   = (string) $meta_key;
		$keys  = array( '_price', '_regular_price', '_sale_price', '_wdp_total_donation_amount', '_wdp_manual_total', '_wdp_donor_count' );
		$watch = in_array( $key, $keys, true );
		if ( ! $watch ) {
			$watch = in_array( $key, Uninstall::product_meta_keys(), true );
		}
		if ( ! $watch ) {
			return;
		}
		if ( self::post_is_product( $object_id ) ) {
			self::bump_cache();
		}
	}

	/**
	 * @param int $post_id Post ID.
	 * @return bool
	 */
	private static function post_is_product( $post_id ) {
		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return false;
		}
		$type = function_exists( 'get_post_type' ) ? get_post_type( $post_id ) : '';
		return 'product' === $type || 'product_variation' === $type;
	}

	/**
	 * @param int    $object_id  Object ID.
	 * @param array<int, mixed>  $terms      Terms.
	 * @param array<int, mixed>  $tt_ids     Term taxonomy IDs.
	 * @param string $taxonomy   Taxonomy.
	 * @param bool   $append     Append.
	 * @param array<int, mixed>  $old_tt_ids Old term taxonomy IDs.
	 * @return void
	 */
	public static function on_set_object_terms( $object_id, $terms, $tt_ids, $taxonomy, $append = false, $old_tt_ids = array() ) {
		unset( $object_id, $terms, $tt_ids, $append, $old_tt_ids );
		if ( 'product_cat' === $taxonomy ) {
			self::bump_cache();
		}
	}

	/**
	 * Liste varlıkları (derlenmiş `list` modülü) ve form deneyimi varlıkları (kart düğmesi formu açar).
	 *
	 * @param bool $with_form Form deneyimi de yüklensin mi (düğme modu `link` ise gerekmez).
	 * @return void
	 */
	public static function enqueue_assets( $with_form = true ) {
		$plugin = Plugin::instance();
		if ( null === $plugin ) {
			return;
		}
		$assets = $plugin->container()->get( Assets::class );
		$assets->enqueue( self::ASSET_SLUG );
		if ( $with_form ) {
			$assets->enqueue( Experiences_Module::SLUG );
		}
	}

	/**
	 * Replace cache-safe placeholders with per-request unique ids.
	 *
	 * @param string $html Cached HTML.
	 * @return string
	 */
	public static function apply_request_ids( $html ) {
		$uid   = function_exists( 'wp_unique_id' ) ? wp_unique_id( 'wdp-list-' ) : ( 'wdp-list-' . uniqid() );
		$panel = $uid . '-panel';
		$html  = str_replace( self::UID_PLACEHOLDER, $uid, $html );
		return str_replace( self::PANEL_PLACEHOLDER, $panel, $html );
	}

	/**
	 * @param array<string, mixed> $atts Sanitized atts.
	 * @return array{html:string,empty:bool}
	 */
	private static function build_html( $atts ) {
		$products = self::query_products( $atts );
		if ( empty( $products ) ) {
			$msg   = '<p class="wdp-list__empty">' . esc_html__( 'There are no donations to show right now.', 'woo-donation-popup' ) . '</p>';
			$class = 'wdp-list-wrap' . ( '' !== $atts['class'] ? ' ' . esc_attr( $atts['class'] ) : '' );
			return array(
				'html'  => '<div class="' . $class . '" data-wdp-list-id="' . esc_attr( self::UID_PLACEHOLDER ) . '">' . $msg . '</div>',
				'empty' => true,
			);
		}

		$ids = array();
		foreach ( $products as $product ) {
			$ids[] = (int) $product->get_id();
		}
		$totals = Campaign_Totals::get_totals_for_products( $ids );
		$tabs   = ( 'yes' === $atts['tabs'] ) ? self::build_tabs( $products ) : array();

		$style = '--wdp-cols:' . (int) $atts['columns']
			. ';--wdp-cols-t:' . (int) $atts['columns_tablet']
			. ';--wdp-cols-m:' . (int) $atts['columns_mobile']
			. ';--wdp-gap:' . (int) $atts['gap'] . 'px';
		$ratio = self::ratio_css( $atts['image_ratio'] );
		if ( '' !== $ratio && '4:3' !== $atts['image_ratio'] ) {
			$style .= ';--wdp-ratio:' . $ratio;
		}

		$wrap_class = 'dp wdp-list-wrap wdp-list-wrap--' . $atts['align'];
		if ( '' !== $atts['class'] ) {
			$wrap_class .= ' ' . $atts['class'];
		}

		$panel_id = self::PANEL_PLACEHOLDER;
		$uid      = self::UID_PLACEHOLDER;
		$kind     = 'link' === $atts['button'] ? '' : ( 'popup' === $atts['button'] ? 'popup' : 'side_panel' );
		ob_start();
		echo '<div class="' . esc_attr( $wrap_class ) . '" id="' . esc_attr( $uid ) . '" style="' . esc_attr( $style ) . '" data-wdp-list-id="' . esc_attr( $uid ) . '"';
		if ( '' !== $kind ) {
			echo ' data-wdp-kind="' . esc_attr( $kind ) . '" data-wdp-rest="' . esc_url( rest_url( 'donation-panel/v1/' ) ) . '"';
		}
		echo '>';
		if ( '' !== $atts['title'] ) {
			echo '<h2 class="wdp-list__title">' . esc_html( $atts['title'] ) . '</h2>';
		}
		if ( ! empty( $tabs ) ) {
			echo self::tabs_html( $tabs, $atts, $uid, $panel_id ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			$labelled = ( 'yes' === $atts['tab_all'] ) ? ( $uid . '-all' ) : ( $uid . '-' . $tabs[0]['slug'] );
			echo '<ul class="wdp-list" role="list" id="' . esc_attr( $panel_id ) . '" aria-labelledby="' . esc_attr( $labelled ) . '">';
		} else {
			echo '<ul class="wdp-list" role="list">';
		}
		$index = 0;
		foreach ( $products as $product ) {
			++$index;
			echo self::card_html( $product, $atts, $totals, $index ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		echo '</ul></div>';
		return array(
			'html'  => (string) ob_get_clean(),
			'empty' => false,
		);
	}

	/**
	 * @param array<string, mixed> $atts Sanitized atts.
	 * @return \WC_Product[]
	 */
	public static function query_products( $atts ) {
		$tax_query  = array();
		$meta_query = array();

		if ( ! empty( $atts['categories'] ) ) {
			$tax_query[] = array(
				'taxonomy'         => 'product_cat',
				'field'            => 'slug',
				'terms'            => $atts['categories'],
				'include_children' => true,
			);
		}
		if ( ! empty( $atts['exclude_categories'] ) ) {
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
			'terms'    => array( 'exclude-from-catalog', 'outofstock' ),
			'operator' => 'NOT IN',
		);
		if ( taxonomy_exists( 'product_visibility' ) ) {
			$tax_query[] = $visibility;
		}

		if ( count( $atts['type'] ) === 1 ) {
			$meta_query = Donation_Type::get_meta_query( $atts['type'][0] );
		}

		$orderby  = $atts['orderby'];
		$limit    = (int) $atts['limit'];
		$multi    = count( $atts['type'] ) > 1;
		$per_page = $multi ? min( 100, max( $limit * 4, $limit ) ) : min( 100, max( $limit * 2, $limit ) );
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
		if ( ! empty( $atts['ids'] ) ) {
			$args['post__in'] = $atts['ids'];
			$args['orderby']  = 'post__in';
		} elseif ( 'random' === $orderby ) {
			$args['orderby'] = 'rand';
		} elseif ( 'title' === $orderby ) {
			$args['orderby'] = 'title';
		} elseif ( 'date' === $orderby ) {
			$args['orderby'] = 'date';
		} elseif ( 'popularity' === $orderby ) {
			$args['orderby']  = 'meta_value_num';
			$args['meta_key'] = 'total_sales'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		} else {
			$args['orderby'] = 'menu_order title';
		}
		if ( ! empty( $atts['exclude'] ) ) {
			$args['post__not_in'] = $atts['exclude']; // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- kartlarda yinelenen ürünleri hariç tutmak için; sayfa başına küçük küme.
		}
		if ( ! empty( $tax_query ) ) {
			if ( count( $tax_query ) > 1 ) {
				$tax_query['relation'] = 'AND';
			}
			$args['tax_query'] = $tax_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		}
		if ( ! empty( $meta_query ) ) {
			$args['meta_query'] = $meta_query; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		/**
		 * @param array $args \WP_Query args.
		 * @param array $atts Sanitized attributes.
		 */
		$args  = apply_filters( 'wdp_donations_query_args', $args, $atts ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		$out   = array();
		$page  = 1;
		$max   = 20;
		$found = 0;
		while ( $found < $limit && $page <= $max ) {
			$args['paged'] = $page;
			$query         = new \WP_Query( $args );
			$posts         = (array) $query->posts;
			if ( empty( $posts ) ) {
				break;
			}
			foreach ( $posts as $post ) {
				$product = wc_get_product( $post );
				if ( ! $product || ! Donation_Scope::is_donation_product( $product ) ) {
					continue;
				}
				if ( ! $product->is_purchasable() || ! $product->is_in_stock() || ! $product->is_visible() ) {
					continue;
				}
				if ( ! empty( $atts['type'] ) && ! in_array( Donation_Type::for_product( $product->get_id() ), $atts['type'], true ) ) {
					continue;
				}
				$out[] = $product;
				++$found;
				if ( $found >= $limit ) {
					break;
				}
			}
			$got = count( $posts );
			if ( $got < $per_page ) {
				break;
			}
			++$page;
		}
		if ( function_exists( 'wp_reset_postdata' ) ) {
			wp_reset_postdata();
		}
		return $out;
	}

	/**
	 * @param \WC_Product[] $products Products.
	 * @return array<int, array{id:int,slug:string,name:string,parent:int}>
	 */
	private static function build_tabs( $products ) {
		$used = array();
		foreach ( $products as $product ) {
			$ids = method_exists( $product, 'get_category_ids' ) ? array_map( 'absint', (array) $product->get_category_ids() ) : array();
			foreach ( $ids as $term_id ) {
				if ( $term_id > 0 ) {
					$used[ $term_id ] = true;
				}
			}
		}
		if ( empty( $used ) ) {
			return array();
		}
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'include'    => array_keys( $used ),
				'hide_empty' => false,
			)
		);
		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return array();
		}
		$uncat = function_exists( 'get_option' ) ? (int) get_option( 'default_product_cat', 0 ) : 0;
		$out   = array();
		foreach ( $terms as $term ) {
			if ( (int) $term->term_id === $uncat ) {
				continue;
			}
			$slug = sanitize_title( $term->slug );
			if ( 'uncategorized' === $slug ) {
				continue;
			}
			$out[] = array(
				'id'     => (int) $term->term_id,
				'slug'   => $slug,
				'name'   => $term->name,
				'parent' => (int) $term->parent,
				'order'  => isset( $term->term_order ) ? (int) $term->term_order : 0,
			);
		}
		usort(
			$out,
			static function ( $a, $b ) {
				if ( $a['order'] !== $b['order'] ) {
					return $a['order'] - $b['order'];
				}
				return strcasecmp( $a['name'], $b['name'] );
			}
		);
		return $out;
	}

	/**
	 * Kategori sekmeleri: gerçek bağlantılar (JS yokken tüm kartlar görünür kalır, bağlantı listeye götürür);
	 * JS varken süzgeç olarak çalışır.
	 *
	 * @param array<int, mixed>    $tabs     Tabs.
	 * @param array<string, mixed> $atts     Atts.
	 * @param string               $uid      Liste kimliği (yer tutucu olabilir).
	 * @param string               $panel_id Liste öğesi kimliği (yer tutucu olabilir).
	 * @return string
	 */
	private static function tabs_html( array $tabs, array $atts, $uid = '', $panel_id = '' ) {
		$uid      = '' !== $uid ? $uid : self::UID_PLACEHOLDER;
		$panel_id = '' !== $panel_id ? $panel_id : self::PANEL_PLACEHOLDER;
		ob_start();
		echo '<nav class="wdp-list__tabs" aria-label="' . esc_attr__( 'Donation categories', 'woo-donation-popup' ) . '" data-wdp-tabs data-wdp-tabs-id="' . esc_attr( $uid ) . '">';
		if ( 'yes' === $atts['tab_all'] ) {
			echo '<a class="wdp-list__tab is-active" id="' . esc_attr( $uid . '-all' ) . '" href="#' . esc_attr( $panel_id ) . '" aria-controls="' . esc_attr( $panel_id ) . '" aria-current="true" data-wdp-tab="all">' . esc_html( $atts['tab_all_label'] ) . '</a>';
		}
		foreach ( $tabs as $tab ) {
			$hash = 'bagis-' . $tab['slug'];
			echo '<a class="wdp-list__tab" id="' . esc_attr( $uid . '-' . $tab['slug'] ) . '" href="#' . esc_attr( $panel_id ) . '" aria-controls="' . esc_attr( $panel_id ) . '" data-wdp-tab="' . esc_attr( $tab['slug'] ) . '" data-wdp-hash="' . esc_attr( $hash ) . '">' . esc_html( $tab['name'] ) . '</a>';
		}
		echo '</nav>';
		return (string) ob_get_clean();
	}

	/**
	 * @param \WC_Product         $product Product.
	 * @param array<string, mixed> $atts    Atts.
	 * @param array<int, float>    $totals  Ürün kimliği => toplam.
	 * @param int                  $index   1-based index.
	 * @return string
	 */
	private static function card_html( $product, array $atts, array $totals, $index ) {
		$id      = (int) $product->get_id();
		$url     = $product->get_permalink();
		$name    = $product->get_name();
		$cat_ids = method_exists( $product, 'get_category_ids' ) ? array_map( 'absint', (array) $product->get_category_ids() ) : array();
		$slugs   = array();
		foreach ( $cat_ids as $term_id ) {
			$term = get_term( $term_id, 'product_cat' );
			if ( $term && ! is_wp_error( $term ) ) {
				$slugs[] = $term->slug;
				$anc     = get_ancestors( $term_id, 'product_cat', 'taxonomy' );
				foreach ( $anc as $ancestor ) {
					$p = get_term( (int) $ancestor, 'product_cat' );
					if ( $p && ! is_wp_error( $p ) ) {
						$slugs[] = $p->slug;
					}
				}
			}
		}
		$slugs = array_values( array_unique( $slugs ) );

		$type        = Donation_Type::for_product( $id );
		$is_campaign = Donation_Type::CAMPAIGN === $type;
		$button_text = self::button_label( $atts, $is_campaign );

		// Düğme: gerçek bağlantı (JS yoksa ürün sayfasına gider); JS varken form katmanını açar.
		$cta_class = 'wdp-card__cta';
		if ( $is_campaign && 'yes' === $atts['button_full'] ) {
			$cta_class .= ' wdp-card__cta--full';
		}
		$cta_attrs = ' href="' . esc_url( $url ) . '" class="' . esc_attr( $cta_class ) . '"';
		if ( 'link' !== $atts['button'] ) {
			$cta_attrs .= ' data-wdp-form="' . esc_attr( (string) $id ) . '"';
		}
		$cta_attrs .= ' aria-label="' . esc_attr(
			sprintf(
				/* translators: 1: button text (e.g. Donate), 2: donation product name */
				__( '%1$s: %2$s', 'woo-donation-popup' ),
				$button_text,
				$name
			)
		) . '"';
		$cta = '<a' . $cta_attrs . '>' . esc_html( $button_text ) . '</a>';

		$image = '';
		if ( 'yes' === $atts['show_image'] ) {
			$thumb_id = $product->get_image_id();
			$attrs    = array(
				'alt'      => '',
				'class'    => 'wdp-card__img',
				'loading'  => $index <= 3 ? 'eager' : 'lazy',
				'decoding' => 'async',
			);
			if ( 1 === $index ) {
				$attrs['fetchpriority'] = 'high';
			}
			if ( $thumb_id && function_exists( 'wp_get_attachment_image' ) ) {
				$image = wp_get_attachment_image( (int) $thumb_id, $atts['image_size'], false, $attrs );
			}
		}

		$subtitle = '';
		if ( 'yes' === $atts['show_excerpt'] && (int) $atts['excerpt_words'] > 0 ) {
			$raw      = $product->get_short_description();
			$subtitle = wp_trim_words( wp_strip_all_tags( strip_shortcodes( (string) $raw ) ), (int) $atts['excerpt_words'] );
		} elseif ( Donation_Type::SHARES === $type ) {
			$subtitle = __( 'Per share', 'woo-donation-popup' );
		}

		$heading  = $atts['heading_tag'];
		$cat_html = '';
		if ( 'yes' === $atts['show_category'] && ! empty( $cat_ids ) ) {
			$term = get_term( $cat_ids[0], 'product_cat' );
			if ( $term && ! is_wp_error( $term ) ) {
				$cat_html = '<p class="wdp-card__cat">' . esc_html( $term->name ) . '</p>';
			}
		}
		$title_html = '<' . $heading . ' class="wdp-card__title"><a href="' . esc_url( $url ) . '">' . esc_html( $name ) . '</a></' . $heading . '>';

		$modifier = $is_campaign ? 'campaign' : 'row';
		$html     = '<li class="wdp-list__item" data-wdp-cats="' . esc_attr( implode( ' ', $slugs ) ) . '">';
		$html    .= '<article class="wdp-card wdp-card--' . $modifier . ' wdp-card--' . esc_attr( $type ) . '">';
		$media    = '';
		if ( 'yes' === $atts['show_image'] ) {
			// Görsel yoksa yer tutucu simge çizilmez: yalnız sakin bir zemin (tasarımdaki gibi).
			$badge = $is_campaign ? self::campaign_badge( $id ) : '';
			$media = '<a class="wdp-card__media" href="' . esc_url( $url ) . '" aria-hidden="true" tabindex="-1">' . $image . $badge . '</a>';
		}

		if ( $is_campaign ) {
			$html .= $media;
			$html .= '<div class="wdp-card__body">';
			if ( '' === $media ) {
				$html .= self::campaign_badge( $id, false );
			}
			$html .= $cat_html . $title_html;
			if ( '' !== $subtitle ) {
				$html .= '<p class="wdp-card__sub">' . esc_html( $subtitle ) . '</p>';
			}
			$html .= self::campaign_progress_html( $product, $id, $atts, $totals );
			$html .= $cta;
			$html .= '</div>';
		} else {
			$html .= $media;
			$html .= '<div class="wdp-card__body">';
			$html .= $cat_html . $title_html;
			if ( '' !== $subtitle ) {
				$html .= '<p class="wdp-card__sub">' . esc_html( $subtitle ) . '</p>';
			}
			$html .= '<div class="wdp-card__foot">';
			if ( 'yes' === $atts['show_price'] ) {
				$html .= self::row_price_html( $product, $type );
			}
			$html .= $cta . '</div>';
			$html .= '</div>';
		}
		$html .= '</article></li>';

		/**
		 * @param string     $html    Card HTML.
		 * @param \WC_Product $product Product.
		 * @param array      $atts    Sanitized atts.
		 */
		return (string) apply_filters( 'wdp_donations_card_html', $html, $product, $atts ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
	}

	/**
	 * Düğme metni: öznitelik > yönetici ayarı > varsayılan (kampanya: "Donate now", diğerleri: "Donate").
	 *
	 * @param array<string, mixed> $atts        Atts.
	 * @param bool                 $is_campaign Kampanya kartı mı.
	 * @return string
	 */
	private static function button_label( array $atts, $is_campaign ) {
		if ( '' !== $atts['button_text'] ) {
			return $atts['button_text'];
		}
		$settings = Button_Settings::get();
		if ( ! empty( $settings['popup_button_text'] ) ) {
			return sanitize_text_field( (string) $settings['popup_button_text'] );
		}
		return $is_campaign ? __( 'Donate now', 'woo-donation-popup' ) : __( 'Donate', 'woo-donation-popup' );
	}

	/**
	 * Kampanya rozeti: "CAMPAIGN · n DAYS" (bitiş tarihi varsa kalan gün; yoksa yalnız "Campaign").
	 *
	 * @param int  $product_id Ürün.
	 * @param bool $overlay    Görsel üstünde mi (false: gövde içinde satır içi rozet).
	 * @return string
	 */
	private static function campaign_badge( $product_id, $overlay = true ) {
		$label  = __( 'Campaign', 'woo-donation-popup' );
		$period = Campaign_Totals::get_campaign_period( $product_id );
		$days   = ( is_array( $period ) && ! empty( $period['end'] ) ) ? (int) ceil( ( (int) $period['end'] - time() ) / DAY_IN_SECONDS ) : null;
		// Form üstündeki ilerleme özetiyle aynı süzgeç (kalan gün); varsayılan: kampanya bitiş tarihinden.
		$filtered = apply_filters( 'donation_panel_campaign_days_left', $days, $product_id );
		$days     = is_numeric( $filtered ) ? (int) $filtered : null;
		if ( null !== $days && $days > 0 ) {
			$label = sprintf(
				/* translators: %d: days left in the campaign */
				_n( 'Campaign · %d day', 'Campaign · %d days', $days, 'woo-donation-popup' ),
				$days
			);
		}
		return '<span class="wdp-card__badge' . ( $overlay ? '' : ' wdp-card__badge--inline' ) . '">' . esc_html( $label ) . '</span>';
	}

	/**
	 * Kampanya kartı ilerleme bloğu: çubuk, toplanan / hedef, bağışçı sayısı (yalnız gerçek veri).
	 *
	 * @param \WC_Product          $product Ürün.
	 * @param int                  $id      Ürün kimliği.
	 * @param array<string, mixed> $atts    Atts.
	 * @param array<int, float>    $totals  Ürün kimliği => toplam.
	 * @return string
	 */
	private static function campaign_progress_html( $product, $id, array $atts, array $totals ) {
		if ( 'yes' !== $atts['show_progress'] ) {
			return '';
		}
		$goal = (float) $product->get_meta( '_progress_bar_limit', true );
		if ( $goal <= 0 ) {
			return '';
		}
		$total  = isset( $totals[ $id ] ) ? (float) $totals[ $id ] : 0.0;
		$pct    = (int) min( 100, floor( ( $total / $goal ) * 100 ) );
		$donors = (int) Campaign_Totals::get_donor_count( $id );
		$label  = sprintf(
			/* translators: 1: collected, 2: goal */
			__( '%1$s / %2$s raised', 'woo-donation-popup' ),
			wp_strip_all_tags( Price::format_price_html( $total ) ),
			wp_strip_all_tags( Price::format_price_html( $goal ) )
		);

		$out  = '<div class="wdp-card__progress-wrap">';
		$out .= '<div class="wdp-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr( (string) $pct ) . '" aria-label="' . esc_attr( $label ) . '"><span class="wdp-card__progress-bar" style="width:' . esc_attr( (string) $pct ) . '%"></span></div>';
		$out .= '<p class="wdp-card__stats"><span class="wdp-card__raised"><b>' . Price::format_price_html( $total ) . '</b> / ' . Price::format_price_html( $goal ) . '</span>';
		if ( $donors > 0 ) {
			$out .= '<span class="wdp-card__donors">' . esc_html(
				sprintf(
					/* translators: %s: number of donors (formatted) */
					_n( '%s donor', '%s donors', $donors, 'woo-donation-popup' ),
					number_format_i18n( $donors )
				)
			) . '</span>';
		}
		$out .= '</p></div>';
		return $out;
	}

	/**
	 * Satır kartı (sabit / hisseli / serbest tutar) fiyat bölümü.
	 *
	 * @param \WC_Product $product Ürün.
	 * @param string      $type    Bağış türü.
	 * @return string
	 */
	private static function row_price_html( $product, $type ) {
		if ( Donation_Type::CUSTOM === $type ) {
			return '<span class="wdp-card__price wdp-card__price--any">' . esc_html__( 'Any amount', 'woo-donation-popup' ) . '</span>';
		}
		$price = Price::format_product_display_price( $product );
		if ( '' === $price ) {
			return '<span class="wdp-card__price wdp-card__price--any"></span>';
		}
		return '<span class="wdp-card__price">' . $price . '</span>';
	}

	/**
	 * @param array<string, mixed> $atts Sanitized atts.
	 * @return string
	 */
	private static function empty_reason( $atts ) {
		if ( ! empty( $atts['ids'] ) ) {
			return __( 'Query returned no results: the given product IDs are not a published donation product or are out of scope.', 'woo-donation-popup' );
		}
		if ( ! empty( $atts['categories'] ) ) {
			return __( 'Query returned no results: no published, in-stock, purchasable donation product in the selected categories.', 'woo-donation-popup' );
		}
		if ( Placement_Settings::value( 'donation_scope' ) === 'marked' ) {
			return __( 'Query returned no results: scope is “flagged products only”; flag products on the Donation tab.', 'woo-donation-popup' );
		}
		return __( 'Query returned no results: no published, catalog-visible, in-stock donation product.', 'woo-donation-popup' );
	}

	/**
	 * @param array<string, mixed> $atts Sanitized atts.
	 * @return string
	 */
	public static function cache_key( $atts ) {
		$locale   = function_exists( 'determine_locale' ) ? determine_locale() : get_locale();
		$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : '';
		$version  = defined( 'WDP_VERSION' ) ? WDP_VERSION : '';
		$cv       = (int) get_option( self::CACHE_VERSION, 1 );
		return 'wdp_list_' . md5( wp_json_encode( $atts ) . '|' . $locale . '|' . $currency . '|' . $version . '|' . $cv . '|' . self::MARKUP_REV );
	}

	/**
	 * @param mixed $raw CSV.
	 * @return string[]
	 */
	private static function csv_slugs( $raw ) {
		$out = array();
		foreach ( preg_split( '/[\s,]+/', (string) $raw ) as $part ) {
			$slug = sanitize_title( $part );
			if ( '' !== $slug ) {
				$out[] = $slug;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param mixed $raw CSV.
	 * @return int[]
	 */
	private static function csv_ids( $raw ) {
		$out = array();
		foreach ( preg_split( '/[\s,]+/', (string) $raw ) as $part ) {
			$id = absint( $part );
			if ( $id > 0 ) {
				$out[] = $id;
			}
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * @param string $ratio Ratio token.
	 * @return string
	 */
	private static function ratio_css( $ratio ) {
		$map = array(
			'1:1'  => '1 / 1',
			'4:3'  => '4 / 3',
			'3:2'  => '3 / 2',
			'16:9' => '16 / 9',
		);
		return isset( $map[ $ratio ] ) ? $map[ $ratio ] : '';
	}
}
