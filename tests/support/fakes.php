<?php
/**
 * Minimal WooCommerce test doubles for unit tests (orders, refunds, order items, meta).
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

if (!class_exists('WC_Abstract_Order')) {
	abstract class WC_Abstract_Order {}
}

/**
 * Meta row like WC_Meta_Data.
 */
final class WDP_Fake_Meta {
	/** @var string */
	public $key;
	/** @var mixed */
	public $value;

	public function __construct(string $key, $value) {
		$this->key   = $key;
		$this->value = $value;
	}

	public function get_data(): array {
		return array('key' => $this->key, 'value' => $this->value);
	}
}

/**
 * Order line item double.
 */
final class WDP_Fake_Order_Item {
	/** @var int */
	private $product_id;
	/** @var int */
	private $quantity;
	/** @var float */
	private $total;
	/** @var array<string,mixed> */
	public $meta = array();
	/** @var int */
	public $saved = 0;

	public function __construct(int $product_id, float $total, int $quantity = 1, array $meta = array()) {
		$this->product_id = $product_id;
		$this->total      = $total;
		$this->quantity   = $quantity;
		$this->meta       = $meta;
	}

	public function get_product_id(): int {
		return $this->product_id;
	}

	public function get_quantity(): int {
		return $this->quantity;
	}

	public function get_total(): float {
		return $this->total;
	}

	public function get_name(): string {
		return 'Product #' . $this->product_id;
	}

	public function get_meta($key, $single = true) {
		return array_key_exists($key, $this->meta) ? $this->meta[ $key ] : '';
	}

	public function get_meta_data(): array {
		$out = array();
		foreach ($this->meta as $key => $value) {
			$out[] = new WDP_Fake_Meta((string) $key, $value);
		}
		return $out;
	}

	public function update_meta_data($key, $value): void {
		$this->meta[ $key ] = $value;
	}

	public function save(): void {
		$this->saved++;
	}
}

/**
 * Order (or refund) double.
 */
class WDP_Fake_Order extends WC_Abstract_Order {
	/** @var int */
	private $id;
	/** @var WDP_Fake_Order_Item[] */
	private $items;
	/** @var array<string,mixed> */
	public $meta = array();
	/** @var array<int,float> item id => refunded amount */
	public $refunded_for_item = array();

	public function __construct(int $id, array $items = array()) {
		$this->id    = $id;
		$this->items = $items;
	}

	public function get_id(): int {
		return $this->id;
	}

	public function get_items($type = 'line_item'): array {
		return $this->items;
	}

	public function get_meta($key, $single = true) {
		return array_key_exists($key, $this->meta) ? $this->meta[ $key ] : '';
	}

	public function update_meta_data($key, $value): void {
		$this->meta[ $key ] = $value;
	}

	public function delete_meta_data($key): void {
		unset($this->meta[ $key ]);
	}

	public function save_meta_data(): void {}

	public function save(): void {}

	public function get_total_refunded_for_item($item_id): float {
		return isset($this->refunded_for_item[ $item_id ]) ? (float) $this->refunded_for_item[ $item_id ] : 0.0;
	}
}

if (!class_exists('WC_Order_Refund')) {
	class WC_Order_Refund extends WDP_Fake_Order {}
}

if (!class_exists('WC_Product')) {
	class WC_Product {
		/** @var int */
		protected $id = 0;
		/** @var array<string, mixed> */
		public $meta = array();
		/** @var string */
		public $type = 'simple';
		/** @var string */
		public $name = 'Ürün';
		/** @var string */
		public $price = '10';
		/** @var string */
		public $slug = '';
		/** @var int[] */
		public $category_ids = array();
		/** @var bool */
		public $purchasable = true;
		/** @var bool */
		public $in_stock = true;
		/** @var string */
		public $status = 'publish';
		/** @var string */
		public $short_description = '';
		/** @var string */
		public $description = '';

		public function __construct($id = 0) {
			$this->id = (int) $id;
			if (isset(WDP_Test_State::$post_meta[ $this->id ])) {
				$this->meta = WDP_Test_State::$post_meta[ $this->id ];
			}
		}

		public function get_id() {
			return $this->id;
		}

		public function get_type() {
			return $this->type;
		}

		public function get_name() {
			return $this->name;
		}

		public function get_price() {
			return $this->price;
		}

		public function get_slug() {
			return $this->slug;
		}

		public function get_status() {
			return $this->status;
		}

		public function get_short_description() {
			return $this->short_description;
		}

		public function get_description() {
			return $this->description;
		}

		public function get_category_ids() {
			return $this->category_ids;
		}

		public function is_purchasable() {
			return $this->purchasable;
		}

		public function is_in_stock() {
			return $this->in_stock;
		}

		public function get_meta($key, $single = true) {
			if (isset(WDP_Test_State::$post_meta[ $this->id ][ $key ])) {
				return WDP_Test_State::$post_meta[ $this->id ][ $key ];
			}
			return array_key_exists($key, $this->meta) ? $this->meta[ $key ] : '';
		}

		public function update_meta_data($key, $value) {
			$this->meta[ $key ] = $value;
			WDP_Test_State::$post_meta[ $this->id ][ $key ] = $value;
		}

		public function save() {}
	}
}

/**
 * $wpdb double: answers the "post_id by meta_key + LIKE" scans used by migrations from WDP_Test_State::$post_meta.
 */
final class WDP_Fake_Wpdb {
	/** @var string */
	public $postmeta = 'wp_postmeta';
	/** @var string */
	public $posts = 'wp_posts';
	/** @var string */
	public $options = 'wp_options';
	/** @var string */
	public $prefix = 'wp_';
	/** @var string[] */
	public $queries = array();

	public function esc_like($text): string {
		return addcslashes((string) $text, '_%\\');
	}

	/**
	 * Returns the query and its arguments unchanged so get_col() can interpret them.
	 *
	 * @return array{sql:string,args:array}
	 */
	public function prepare($sql, ...$args): array {
		if (count($args) === 1 && is_array($args[0])) {
			$args = $args[0];
		}
		return array('sql' => (string) $sql, 'args' => $args);
	}

	public function get_col($query): array {
		$this->queries[] = $query;
		if (!is_array($query) || strpos($query['sql'], 'meta_value LIKE') === false) {
			return array();
		}
		list($key, $like, $after, $limit) = $query['args'];
		$needle = stripslashes(trim((string) $like, '%'));
		$ids    = array();
		foreach (WDP_Test_State::$post_meta as $post_id => $meta) {
			if ($post_id > (int) $after && array_key_exists($key, $meta) && strpos((string) $meta[ $key ], $needle) !== false) {
				$ids[] = (string) $post_id;
			}
		}
		sort($ids, SORT_NUMERIC);
		return array_slice($ids, 0, (int) $limit);
	}

	public function get_results($query, $output = 'OBJECT'): array {
		$this->queries[] = $query;
		return array();
	}

	public function get_var($query) {
		$this->queries[] = $query;
		return null;
	}

	public function query($query) {
		$this->queries[] = $query;
		return 0;
	}
}
