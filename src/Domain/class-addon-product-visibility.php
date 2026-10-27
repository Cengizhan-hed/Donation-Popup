<?php
/**
 * Alt bağış WC ürün bağlantılarını bilgi amaçlı izler (görünürlük veya bağış kapsamı etkilemez).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Domain;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Addon_Product_Visibility
 *
 * Bir ürün hem bağış ürünü hem de başka bir ürünün alt bağışı olabilir.
 * Alt bağış bağlantısı katalog görünürlüğünü veya bağış ürünü olmayı değiştirmez.
 */
class Addon_Product_Visibility {

	const TRANSIENT    = 'wdp_addon_line_ids';
	const AUDIT_OPTION = 'wdp_addon_links_audit';

	/** Eski (10.35 öncesi) seçenek/geçici veri adları: göçte yeni adlara taşınır. */
	const LEGACY_TRANSIENT    = 'wdp_sadaka_line_ids';
	const LEGACY_AUDIT_OPTION = 'wdp_sadaka_links_audit';

	/**
	 * Ürün meta anahtarları: yeni ad => eski ad. Göçten sonra eski anahtar silinmez (okuma yedeği):
	 * okumada önce yeni, yoksa eski.
	 */
	const LEGACY_META = array(
		'_enable_addon_donation'  => '_enable_sadaka_donation',
		'_addon_toggle_label'     => '_sadaka_toggle_label',
		'_addon_wc_product_id'    => '_sadaka_wc_product_id',
		'_addon_min_price'        => '_sadaka_min_price',
		'_addon_fixed_price'      => '_sadaka_fixed_price',
		'_addon_donation_message' => '_sadaka_donation_message',
	);

	/**
	 * Ürün metasını okur: yeni anahtar varsa o, yoksa eski anahtar (geriye uyum).
	 *
	 * @param object|int $product \WC_Product benzeri nesne ya da ürün ID.
	 * @param string     $key     Yeni ad.
	 * @return mixed
	 */
	public static function get_meta( $product, $key ) {
		$legacy = self::LEGACY_META[ $key ] ?? '';
		if ( is_object( $product ) && method_exists( $product, 'get_meta' ) ) {
			$value = $product->get_meta( $key );
			if ( '' === $legacy ) {
				return $value;
			}
			$has_new = method_exists( $product, 'meta_exists' ) ? $product->meta_exists( $key ) : ( '' !== $value && null !== $value );
			return $has_new ? $value : $product->get_meta( $legacy );
		}
		$id    = absint( $product );
		$value = get_post_meta( $id, $key, true );
		if ( '' === $legacy ) {
			return $value;
		}
		$has_new = ! empty( get_post_meta( $id, $key, false ) );
		return $has_new ? $value : get_post_meta( $id, $legacy, true );
	}

	/** @var int[]|null */
	private static $ids = null;

	/** @var bool Re-entrancy guard while collecting IDs. */
	private static $collecting = false;

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'updated_option', array( __CLASS__, 'maybe_flush_on_option' ), 10, 1 );
		add_action( 'updated_post_meta', array( __CLASS__, 'maybe_flush_on_meta' ), 10, 3 );
		add_action( 'added_post_meta', array( __CLASS__, 'maybe_flush_on_meta' ), 10, 3 );
		add_action( 'deleted_post_meta', array( __CLASS__, 'maybe_flush_on_meta' ), 10, 3 );
	}

	/**
	 * Alt bağış olarak kullanılan WC ürün ID'leri (genel varsayılan + etkin ürün meta).
	 *
	 * Yalnızca genel varsayılan veya "Alt bağış ekle" açık ürünlerin `_addon_wc_product_id`
	 * değeri sayılır. Kendini gösteren ID hariç. Bağış ürünü bayrağı bu listeyi etkilemez.
	 *
	 * @return int[]
	 */
	public static function get_all_ids() {
		if ( null !== self::$ids ) {
			return self::$ids;
		}

		$cached = get_transient( self::TRANSIENT );
		if ( is_array( $cached ) ) {
			self::$ids = array_values( array_unique( array_filter( array_map( 'absint', $cached ) ) ) );
			return self::$ids;
		}

		$ids = self::collect_ids_uncached();
		/**
		 * Alt bağış satırı olarak kullanılan WC ürün ID listesi (bilgi amaçlı).
		 *
		 * @param int[] $ids Product IDs.
		 */
		$ids       = array_values( array_unique( array_filter( array_map( 'absint', (array) apply_filters( 'wdp_sadaka_line_product_ids', $ids ) ) ) ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		self::$ids = $ids;
		set_transient( self::TRANSIENT, $ids, DAY_IN_SECONDS );
		return self::$ids;
	}

	/**
	 * @return int[]
	 */
	private static function collect_ids_uncached() {
		$ids = array();

		$default = (int) Addon_Settings::get_default_addon_wc_product_id();
		if ( $default > 0 ) {
			$ids[] = $default;
		}

		foreach ( self::collect_enabled_parent_links() as $link ) {
			$sid    = (int) $link['addon_id'];
			$parent = (int) $link['parent_id'];
			if ( $sid <= 0 || $sid === $parent ) {
				continue;
			}
			$ids[] = $sid;
		}

		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
	}

	/**
	 * Etkin ("Alt bağış ekle" açık) ürün → alt bağış ID eşlemeleri.
	 *
	 * @return array<int, array{parent_id:int,addon_id:int}>
	 */
	public static function collect_enabled_parent_links() {
		$out = array();
		foreach ( self::collect_parent_ids_with_addon_meta() as $parent_id ) {
			$parent_id = (int) $parent_id;
			if ( $parent_id <= 0 ) {
				continue;
			}
			if ( ! self::parent_has_addon_enabled( $parent_id ) ) {
				continue;
			}
			$sid = absint( self::get_meta( $parent_id, '_addon_wc_product_id' ) );
			if ( $sid <= 0 || $sid === $parent_id ) {
				continue;
			}
			$out[] = array(
				'parent_id' => $parent_id,
				'addon_id'  => $sid,
			);
		}
		return $out;
	}

	/**
	 * @param int $parent_id Parent product ID.
	 * @return bool
	 */
	public static function parent_has_addon_enabled( $parent_id ) {
		$parent_id = absint( $parent_id );
		if ( $parent_id <= 0 ) {
			return false;
		}
		$flag = self::get_meta( $parent_id, '_enable_addon_donation' );
		return is_scalar( $flag ) && strtolower( trim( (string) $flag ) ) === 'yes';
	}

	/**
	 * Bu ürünü alt bağış olarak kullanan ana ürün etiketleri (tooltip).
	 *
	 * @param int $addon_id Addon line product ID.
	 * @return string[] Parent titles (or #id).
	 */
	public static function get_referrer_labels( $addon_id ) {
		$addon_id = absint( $addon_id );
		if ( $addon_id <= 0 ) {
			return array();
		}

		$labels  = array();
		$default = (int) Addon_Settings::get_default_addon_wc_product_id();
		if ( $default === $addon_id ) {
			$labels[] = __( 'General default (Success tab)', 'woo-donation-popup' );
		}

		foreach ( self::collect_enabled_parent_links() as $link ) {
			if ( (int) $link['addon_id'] !== $addon_id ) {
				continue;
			}
			$labels[] = self::product_label( (int) $link['parent_id'] );
		}

		return array_values( array_unique( array_filter( $labels ) ) );
	}

	/**
	 * @param int $product_id Product ID.
	 * @return string
	 */
	public static function product_label( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return '';
		}
		$title = function_exists( 'get_the_title' ) ? get_the_title( $product_id ) : '';
		if ( is_string( $title ) && '' !== $title ) {
			return $title . ' (#' . $product_id . ')';
		}
		return '#' . $product_id;
	}

	/**
	 * Verilen bağlantı meta anahtarı > 0 olan ürün ID'leri.
	 *
	 * @param string $link_key Meta anahtarı.
	 * @return int[]
	 */
	private static function query_parent_ids_by_link_key( $link_key ) {
		$ids = get_posts(
			array(
				'post_type'              => 'product',
				'post_status'            => 'any',
				'numberposts'            => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_numberposts -- yalnız kimlik listesi, önbelleğe alınır.
				'fields'                 => 'ids',
				'suppress_filters'       => true, // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.SuppressFilters_suppress_filters -- yalnız kimlik listesi; filtreler sonucu bozmasın.
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
				'meta_query'             => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					array(
						'key'     => $link_key,
						'value'   => 0,
						'compare' => '>',
						'type'    => 'NUMERIC',
					),
				),
			)
		);
		return array_map( 'absint', (array) $ids );
	}

	/**
	 * @return int[] Parent product IDs that have _addon_wc_product_id > 0.
	 */
	private static function collect_parent_ids_with_addon_meta() {
		if ( self::$collecting ) {
			return array();
		}

		if ( function_exists( 'get_posts' ) ) {
			self::$collecting = true;
			try {
				$found = array();
				foreach ( array( '_addon_wc_product_id', '_sadaka_wc_product_id' ) as $link_key ) {
					$found = array_merge( $found, self::query_parent_ids_by_link_key( $link_key ) );
				}
				$found = array_values( array_unique( $found ) );
			} finally {
				self::$collecting = false;
			}
			if ( ! empty( $found ) ) {
				return array_map( 'absint', (array) $found );
			}
		}

		// Birim testleri / get_posts meta_query yoksa post_meta taraması.
		if ( class_exists( 'WDP_Test_State' ) && ! empty( \WDP_Test_State::$post_meta ) ) {
			$out = array();
			foreach ( \WDP_Test_State::$post_meta as $pid => $meta ) {
				$linked = $meta['_addon_wc_product_id'] ?? ( $meta['_sadaka_wc_product_id'] ?? 0 );
				if ( absint( $linked ) > 0 ) {
					$out[] = (int) $pid;
				}
			}
			return $out;
		}

		return array();
	}

	/**
	 * Bu ürün başka bir ürünün (veya genel varsayılanın) alt bağışı olarak kullanılıyor mu?
	 *
	 * @param int $product_id Product ID.
	 * @return bool
	 */
	public static function is_addon_line_product( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return false;
		}
		return in_array( $product_id, self::get_all_ids(), true );
	}

	/**
	 * @return void
	 */
	public static function flush() {
		self::$ids = null;
		delete_transient( self::TRANSIENT );
	}

	/**
	 * Görünürlük/dışlama için tutulan önbellekleri temizle (10.28.5 geçişi).
	 *
	 * @return void
	 */
	public static function clear_visibility_caches() {
		self::flush();
		do_action( 'donation_panel_totals_changed' );
		if ( function_exists( 'wp_cache_flush_group' ) ) {
			// Best-effort; group may not exist.
			wp_cache_flush_group( 'wdp_donations_list' );
		}
	}

	/**
	 * @param string $option Option name.
	 * @return void
	 */
	public static function maybe_flush_on_option( $option ) {
		if ( 'wdp_success_settings' === $option || self::AUDIT_OPTION === $option ) {
			self::flush();
		}
	}

	/**
	 * @param mixed  $_meta_id Unused.
	 * @param int    $object_id Object ID.
	 * @param string $meta_key Meta key.
	 * @return void
	 */
	public static function maybe_flush_on_meta( $_meta_id, $object_id, $meta_key ) {
		unset( $_meta_id, $object_id );
		if (
		'_addon_wc_product_id' === $meta_key
			|| '_enable_addon_donation' === $meta_key
			|| '_sadaka_wc_product_id' === $meta_key
			|| '_enable_sadaka_donation' === $meta_key
		) {
			self::flush();
		}
	}

	/**
	 * wc-product-search seçenekleri (mevcut ID korunur).
	 *
	 * @param int $product_id Selected product ID.
	 * @return array<int|string, string> id => label
	 */
	public static function product_search_options( $product_id ) {
		$product_id = absint( $product_id );
		if ( $product_id <= 0 ) {
			return array();
		}
		$label = '#' . $product_id;
		$p     = function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( $p && method_exists( $p, 'get_formatted_name' ) ) {
			$label = $p->get_formatted_name();
		} elseif ( $p && method_exists( $p, 'get_name' ) ) {
			$label = $p->get_name() . ' (#' . $product_id . ')';
		} elseif ( function_exists( 'get_the_title' ) ) {
			$title = get_the_title( $product_id );
			if ( $title ) {
				$label = $title . ' (#' . $product_id . ')';
			}
		}
		return array( (string) $product_id => $label );
	}

	/**
	 * WooCommerce wc-product-search alanını yazdırır.
	 *
	 * @param array<string, mixed> $args {
	 *     @type string $id          HTML id.
	 *     @type string $name        Input name.
	 *     @type int    $value       Selected product ID.
	 *     @type string $label       Field label.
	 *     @type string $description Help text.
	 *     @type string $error       Optional field error shown below the control.
	 * }
	 * @return void
	 */
	public static function render_product_search_field( array $args ) {
		$id          = isset( $args['id'] ) ? (string) $args['id'] : 'addon_wc_product_id';
		$name        = isset( $args['name'] ) ? (string) $args['name'] : $id;
		$value       = isset( $args['value'] ) ? absint( $args['value'] ) : 0;
		$label       = isset( $args['label'] ) ? (string) $args['label'] : __( 'Add-on donation product', 'woo-donation-popup' );
		$description = isset( $args['description'] ) ? (string) $args['description'] : '';
		$error       = isset( $args['error'] ) ? (string) $args['error'] : '';
		$options     = self::product_search_options( $value );

		if ( function_exists( 'woocommerce_wp_select' ) ) {
			woocommerce_wp_select(
				array(
					'id'                => $id,
					'name'              => $name,
					'value'             => $value > 0 ? (string) $value : '',
					'label'             => $label,
					'description'       => $description,
					'desc_tip'          => false,
					'class'             => 'wc-product-search',
					'options'           => $options,
					'custom_attributes' => array(
						'data-placeholder' => esc_attr__( 'Search by product name…', 'woo-donation-popup' ),
						'data-action'      => 'woocommerce_json_search_products_and_variations',
						'data-allow_clear' => 'true',
						'style'            => 'width:100%;max-width:400px;',
					),
				)
			);
			if ( '' !== $error ) {
				echo '<p class="wdp-pp-field-error" style="color:#b32d2e;margin:4px 0 0;">' . esc_html( $error ) . '</p>';
			}
			return;
		}

		echo '<p class="form-field">';
		echo '<label for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label> ';
		echo '<select class="wc-product-search" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '"';
		echo ' data-placeholder="' . esc_attr__( 'Search by product name…', 'woo-donation-popup' ) . '"';
		echo ' data-action="woocommerce_json_search_products_and_variations" data-allow_clear="true" style="width:100%;max-width:400px;">';
		foreach ( $options as $opt_id => $opt_label ) {
			if ( '' === (string) $opt_id ) {
				continue;
			}
			echo '<option value="' . esc_attr( (string) $opt_id ) . '" selected="selected">' . esc_html( $opt_label ) . '</option>';
		}
		echo '</select>';
		if ( '' !== $description ) {
			echo '<span class="description">' . esc_html( $description ) . '</span>';
		}
		if ( '' !== $error ) {
			echo '<span class="wdp-pp-field-error" style="display:block;color:#b32d2e;margin-top:4px;">' . esc_html( $error ) . '</span>';
		}
		echo '</p>';
	}

	/**
	 * Seçilen alt bağış WC ürün ID'sini doğrula (0 = boş/temiz).
	 *
	 * @param int $addon_id  Candidate ID.
	 * @param int $parent_id  Parent product ID (self-ref check).
	 * @return array{ok:bool,id:int,error:string}
	 */
	public static function validate_addon_product_id( $addon_id, $parent_id = 0 ) {
		$addon_id  = absint( $addon_id );
		$parent_id = absint( $parent_id );
		if ( $addon_id <= 0 ) {
			return array(
				'ok'    => true,
				'id'    => 0,
				'error' => '',
			);
		}
		if ( $parent_id > 0 && $addon_id === $parent_id ) {
			return array(
				'ok'    => false,
				'id'    => 0,
				'error' => __( 'The add-on donation product cannot be the main product itself.', 'woo-donation-popup' ),
			);
		}
		if ( ! Addon_Settings::is_valid_addon_wc_product( $addon_id ) ) {
			return array(
				'ok'    => false,
				'id'    => 0,
				'error' => __( 'Select a valid simple WooCommerce product (published or private).', 'woo-donation-popup' ),
			);
		}
		return array(
			'ok'    => true,
			'id'    => $addon_id,
			'error' => '',
		);
	}
}
