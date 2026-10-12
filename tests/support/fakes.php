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
