<?php
/**
 * WordPress kişisel veri dışa aktarma / silme kayıtçıları; siparişlerdeki wdp_ bağışçı ve hissedar alanları.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Personal data exporter + eraser for donation order item meta (fixed and legacy keys).
 */
class WDP_Privacy {

	/** Orders handled per exporter page / eraser call. */
	const BATCH_SIZE = 10;

	/**
	 * Register privacy hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter('wp_privacy_personal_data_exporters', array(__CLASS__, 'register_exporter'), 10);
		// Before WooCommerce's order eraser, which may anonymize the billing e-mail we match on.
		add_filter('wp_privacy_personal_data_erasers', array(__CLASS__, 'register_eraser'), 5);
	}

	/**
	 * @param array $exporters Registered exporters.
	 * @return array
	 */
	public static function register_exporter($exporters) {
		$exporters['woo-donation-popup'] = array(
			'exporter_friendly_name' => __('Donation details (Donation Popup)', 'woo-donation-popup'),
			'callback'               => array(__CLASS__, 'export_personal_data'),
		);
		return $exporters;
	}

	/**
	 * @param array $erasers Registered erasers.
	 * @return array
	 */
	public static function register_eraser($erasers) {
		$erasers['woo-donation-popup'] = array(
			'eraser_friendly_name' => __('Donation details (Donation Popup)', 'woo-donation-popup'),
			'callback'             => array(__CLASS__, 'erase_personal_data'),
		);
		return $erasers;
	}

	/**
	 * Exporter callback.
	 *
	 * @param string $email_address Requester e-mail.
	 * @param int    $page          1-based page.
	 * @return array{data:array,done:bool}
	 */
	public static function export_personal_data($email_address, $page = 1) {
		$email = sanitize_email((string) $email_address);
		if ($email === '' || !is_email($email)) {
			return array('data' => array(), 'done' => true);
		}

		$page      = max(1, (int) $page);
		$order_ids = self::find_order_ids($email);
		$slice     = array_slice($order_ids, ($page - 1) * self::BATCH_SIZE, self::BATCH_SIZE);
		$export    = array();

		foreach ($slice as $order_id) {
			$order = wc_get_order($order_id);
			if (!$order) {
				continue;
			}
			$billing_match = self::emails_match($order->get_billing_email(), $email);

			foreach ($order->get_items('line_item') as $item_id => $item) {
				$fields = self::collect_requester_fields($item, $email, $billing_match);
				if (empty($fields)) {
					continue;
				}

				$personal_rows = array();
				foreach ($fields as $fixed_key => $field) {
					if ((string) $field['value'] === WDP_Order_Meta_Keys::ERASED_VALUE) {
						continue;
					}
					$label           = WDP_Order_Meta_Keys::get_label($fixed_key);
					$personal_rows[] = array(
						'name'  => null !== $label ? $label : $fixed_key,
						'value' => (string) $field['value'],
					);
				}
				if (empty($personal_rows)) {
					continue;
				}

				$rows = array_merge(
					array(
						array(
							'name'  => __('Order number', 'woo-donation-popup'),
							'value' => (string) $order->get_order_number(),
						),
						array(
							'name'  => __('Product', 'woo-donation-popup'),
							'value' => wp_strip_all_tags((string) $item->get_name()),
						),
					),
					$personal_rows
				);

				$export[] = array(
					'group_id'          => 'wdp-donations',
					'group_label'       => __('Donation details', 'woo-donation-popup'),
					'group_description' => __('Donor and shareholder details entered on the donation form.', 'woo-donation-popup'),
					'item_id'           => 'wdp-donation-' . (int) $order_id . '-' . (int) $item_id,
					'data'              => $rows,
				);
			}
		}

		return array(
			'data' => $export,
			'done' => ($page * self::BATCH_SIZE) >= count($order_ids),
		);
	}

	/**
	 * Eraser callback: replaces personal values with "[deleted]" (never deletes order data).
	 *
	 * Matches disappear once anonymized, so each call walks the remaining list instead of paging by offset.
	 *
	 * @param string $email_address Requester e-mail.
	 * @param int    $page          Page (unused, see above).
	 * @return array{items_removed:bool,items_retained:bool,messages:array,done:bool}
	 */
	public static function erase_personal_data($email_address, $page = 1) {
		unset($page);

		$response = array(
			'items_removed'  => false,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => true,
		);

		$email = sanitize_email((string) $email_address);
		if ($email === '' || !is_email($email)) {
			return $response;
		}

		$changed_orders = 0;
		foreach (self::find_order_ids($email) as $order_id) {
			$order = wc_get_order($order_id);
			if (!$order) {
				continue;
			}
			$billing_match = self::emails_match($order->get_billing_email(), $email);
			$order_changed = false;

			foreach ($order->get_items('line_item') as $item) {
				if (self::anonymize_item($item, $email, $billing_match)) {
					$order_changed = true;
				}
			}

			if ($order_changed) {
				$response['items_removed'] = true;
				$changed_orders++;
				if ($changed_orders >= self::BATCH_SIZE) {
					$response['done'] = false;
					break;
				}
			}
		}

		return $response;
	}

	/**
	 * Anonymize the requester's donation fields on one order item.
	 *
	 * @param WC_Order_Item $item          Order item.
	 * @param string        $email         Requester e-mail.
	 * @param bool          $billing_match Order billing e-mail is the requester.
	 * @return bool True when something changed.
	 */
	public static function anonymize_item($item, $email, $billing_match) {
		$fields  = self::collect_requester_fields($item, $email, $billing_match);
		$changed = false;

		foreach ($fields as $field) {
			if ((string) $field['value'] === WDP_Order_Meta_Keys::ERASED_VALUE) {
				continue;
			}
			$item->update_meta_data($field['key'], WDP_Order_Meta_Keys::ERASED_VALUE);
			$changed = true;
		}

		if ($changed && method_exists($item, 'save')) {
			$item->save();
		}

		return $changed;
	}

	/**
	 * Personal fields on an item that belong to the requester.
	 *
	 * Donor fields: billing e-mail or donor e-mail matches. Shareholder N: billing e-mail or that shareholder's e-mail matches.
	 *
	 * @param WC_Order_Item $item          Order item.
	 * @param string        $email         Requester e-mail.
	 * @param bool          $billing_match Order billing e-mail matches.
	 * @return array<string,array{key:string,value:mixed}>
	 */
	public static function collect_requester_fields($item, $email, $billing_match) {
		$data = WDP_Order_Meta_Keys::get_item_donation_data($item);
		if (empty($data)) {
			return array();
		}

		$donor_match = $billing_match
			|| (isset($data[ WDP_Order_Meta_Keys::DONOR_EMAIL ]) && self::emails_match($data[ WDP_Order_Meta_Keys::DONOR_EMAIL ]['value'], $email));

		$shareholder_match = array();
		foreach ($data as $fixed_key => $field) {
			$parsed = WDP_Order_Meta_Keys::parse_shareholder_key($fixed_key);
			if (null !== $parsed && 'email' === $parsed['field'] && self::emails_match($field['value'], $email)) {
				$shareholder_match[ $parsed['index'] ] = true;
			}
		}

		$out = array();
		foreach ($data as $fixed_key => $field) {
			if (!WDP_Order_Meta_Keys::is_personal_data_key($fixed_key)) {
				continue;
			}
			$parsed = WDP_Order_Meta_Keys::parse_shareholder_key($fixed_key);
			$belongs = null === $parsed
				? $donor_match
				: ($billing_match || !empty($shareholder_match[ $parsed['index'] ]));
			if ($belongs) {
				$out[ $fixed_key ] = $field;
			}
		}

		return $out;
	}

	/**
	 * Order IDs linked to an e-mail: billing e-mail or a donor/shareholder e-mail in item meta.
	 *
	 * @param string $email Sanitized e-mail.
	 * @return int[] Sorted, unique.
	 */
	public static function find_order_ids($email) {
		global $wpdb;

		$ids = array();

		if (function_exists('wc_get_orders')) {
			$billing = wc_get_orders(array(
				'type'          => 'shop_order',
				'billing_email' => $email,
				'limit'         => -1,
				'return'        => 'ids',
			));
			if (is_array($billing)) {
				$ids = array_map('absint', $billing);
			}
		}

		if (isset($wpdb) && is_object($wpdb)) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT oi.order_id, im.meta_key
					FROM {$wpdb->prefix}woocommerce_order_itemmeta im
					INNER JOIN {$wpdb->prefix}woocommerce_order_items oi ON oi.order_item_id = im.order_item_id
					WHERE im.meta_value = %s",
					$email
				)
			);
			if (is_array($rows)) {
				foreach ($rows as $row) {
					$fixed = WDP_Order_Meta_Keys::normalize_key((string) $row->meta_key);
					if (null !== $fixed && WDP_Order_Meta_Keys::is_email_key($fixed)) {
						$ids[] = absint($row->order_id);
					}
				}
			}
		}

		$ids = array_values(array_unique(array_filter($ids)));
		sort($ids, SORT_NUMERIC);

		return $ids;
	}

	/**
	 * Case-insensitive e-mail comparison.
	 *
	 * @param mixed  $a Stored value.
	 * @param string $b Requester e-mail.
	 * @return bool
	 */
	private static function emails_match($a, $b) {
		$a = strtolower(trim((string) $a));
		$b = strtolower(trim((string) $b));
		return $a !== '' && $a === $b;
	}
}
