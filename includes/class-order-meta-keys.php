<?php
/**
 * Sipariş satırı bağış meta anahtarları: dilden bağımsız sabit anahtarlar, görünen etiketler ve eski (çevrilmiş) anahtar uyumluluğu.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Single source of truth for donation order item meta keys.
 *
 * Orders created before 10.25.0 stored translated labels (e.g. "Bağışçı Adı") as meta keys.
 * New orders use the fixed keys below; every reader must go through this class so both work.
 */
class WDP_Order_Meta_Keys {

	const DONOR_NAME    = 'wdp_donor_name';
	const DONOR_PHONE   = 'wdp_donor_phone';
	const DONOR_EMAIL   = 'wdp_donor_email';
	const DONATION_NOTE = 'wdp_donation_note';
	const DEDICATION    = 'wdp_dedication';
	const ANONYMOUS     = 'wdp_anonymous';
	const COVER_FEE     = 'wdp_cover_fee';
	const SHARE_COUNT   = 'wdp_share_count';

	/** sprintf pattern: shareholder index, field (name|phone|email|note). */
	const SHAREHOLDER_PATTERN = 'wdp_shareholder_%d_%s';

	/** Value written to personal data fields by the privacy eraser. */
	const ERASED_VALUE = '[deleted]';

	/**
	 * Shareholder field slugs.
	 *
	 * @return string[]
	 */
	public static function shareholder_fields() {
		return array('name', 'phone', 'email', 'note');
	}

	/**
	 * Build a shareholder meta key.
	 *
	 * @param int    $index Shareholder index (1-based).
	 * @param string $field name|phone|email|note.
	 * @return string
	 */
	public static function shareholder_key($index, $field) {
		return sprintf(self::SHAREHOLDER_PATTERN, absint($index), sanitize_key($field));
	}

	/**
	 * Parse a fixed shareholder key.
	 *
	 * @param string $key Meta key.
	 * @return array{index:int,field:string}|null
	 */
	public static function parse_shareholder_key($key) {
		if (!is_string($key) || !preg_match('/^wdp_shareholder_(\d+)_(name|phone|email|note)$/', $key, $m)) {
			return null;
		}
		return array(
			'index' => (int) $m[1],
			'field' => $m[2],
		);
	}

	/**
	 * Translatable labels for fixed (non-shareholder) keys.
	 *
	 * @return array<string,string>
	 */
	public static function labels() {
		return array(
			self::DONOR_NAME    => __('Bağışçı Adı', 'woo-donation-popup'),
			self::DONOR_PHONE   => __('Bağışçı Telefonu', 'woo-donation-popup'),
			self::DONOR_EMAIL   => __('Bağışçı E-posta', 'woo-donation-popup'),
			self::DONATION_NOTE => __('Bağış Notu', 'woo-donation-popup'),
			self::DEDICATION    => __('İthaf', 'woo-donation-popup'),
			self::ANONYMOUS     => __('Anonim', 'woo-donation-popup'),
			self::COVER_FEE     => __('İşlem ücreti', 'woo-donation-popup'),
			self::SHARE_COUNT   => __('Hisse Sayısı', 'woo-donation-popup'),
		);
	}

	/**
	 * Translatable sprintf formats for shareholder labels.
	 *
	 * @return array<string,string> field => format with %d.
	 */
	public static function shareholder_label_formats() {
		return array(
			'name'  => __('%d. Hissedar Adı', 'woo-donation-popup'),
			'phone' => __('%d. Hissedar Telefonu', 'woo-donation-popup'),
			'email' => __('%d. Hissedar E-postası', 'woo-donation-popup'),
			'note'  => __('%d. Hissedar Notu', 'woo-donation-popup'),
		);
	}

	/**
	 * Whether a key is one of the plugin's fixed donation keys.
	 *
	 * @param string $key Meta key.
	 * @return bool
	 */
	public static function is_fixed_key($key) {
		if (!is_string($key) || $key === '') {
			return false;
		}
		$labels = self::labels();
		return isset($labels[ $key ]) || null !== self::parse_shareholder_key($key);
	}

	/**
	 * Human readable label for a fixed key (null when not ours).
	 *
	 * @param string $key Meta key.
	 * @return string|null
	 */
	public static function get_label($key) {
		$labels = self::labels();
		if (isset($labels[ $key ])) {
			return $labels[ $key ];
		}
		$parsed = self::parse_shareholder_key($key);
		if (null !== $parsed) {
			$formats = self::shareholder_label_formats();
			return sprintf($formats[ $parsed['field'] ], $parsed['index']);
		}
		return null;
	}

	/**
	 * Map a legacy (translated label) key to its fixed key.
	 *
	 * Matches both the Turkish source strings and the current-locale translation.
	 *
	 * @param string $legacy_key Stored meta key.
	 * @return string|null Fixed key or null when unknown.
	 */
	public static function legacy_to_fixed_key($legacy_key) {
		if (!is_string($legacy_key) || $legacy_key === '') {
			return null;
		}
		$legacy_key = trim($legacy_key);

		$source_labels = array(
			self::DONOR_NAME    => 'Bağışçı Adı',
			self::DONOR_PHONE   => 'Bağışçı Telefonu',
			self::DONOR_EMAIL   => 'Bağışçı E-posta',
			self::DONATION_NOTE => 'Bağış Notu',
			self::DEDICATION    => 'İthaf',
			self::ANONYMOUS     => 'Anonim',
			self::COVER_FEE     => 'İşlem ücreti',
			self::SHARE_COUNT   => 'Hisse Sayısı',
		);
		$translated = self::labels();
		foreach ($source_labels as $fixed => $source) {
			if ($legacy_key === $source || (isset($translated[ $fixed ]) && $legacy_key === $translated[ $fixed ])) {
				return $fixed;
			}
		}

		$source_formats = array(
			'name'  => '%d. Hissedar Adı',
			'phone' => '%d. Hissedar Telefonu',
			'email' => '%d. Hissedar E-postası',
			'note'  => '%d. Hissedar Notu',
		);
		$translated_formats = self::shareholder_label_formats();
		foreach ($source_formats as $field => $source_format) {
			$candidates = array_unique(array($source_format, $translated_formats[ $field ]));
			foreach ($candidates as $format) {
				$regex = '/^' . str_replace('%d', '(\d+)', preg_quote($format, '/')) . '$/u';
				if (preg_match($regex, $legacy_key, $m)) {
					return self::shareholder_key((int) $m[1], $field);
				}
			}
		}

		return null;
	}

	/**
	 * Resolve any stored key (fixed or legacy) to a fixed key.
	 *
	 * @param string $key Stored meta key.
	 * @return string|null
	 */
	public static function normalize_key($key) {
		if (self::is_fixed_key($key)) {
			return $key;
		}
		return self::legacy_to_fixed_key($key);
	}

	/**
	 * Whether a fixed key holds personal data (exported / anonymized by privacy tools).
	 *
	 * @param string $fixed_key Fixed key.
	 * @return bool
	 */
	public static function is_personal_data_key($fixed_key) {
		if (in_array($fixed_key, array(self::DONOR_NAME, self::DONOR_PHONE, self::DONOR_EMAIL, self::DONATION_NOTE, self::DEDICATION), true)) {
			return true;
		}
		return null !== self::parse_shareholder_key($fixed_key);
	}

	/**
	 * Whether a fixed key holds an e-mail address.
	 *
	 * @param string $fixed_key Fixed key.
	 * @return bool
	 */
	public static function is_email_key($fixed_key) {
		if (self::DONOR_EMAIL === $fixed_key) {
			return true;
		}
		$parsed = self::parse_shareholder_key($fixed_key);
		return null !== $parsed && 'email' === $parsed['field'];
	}

	/**
	 * Build order item meta (fixed key => value) from cart donation data.
	 *
	 * @param array $donation_data Cart item donation_data.
	 * @return array<string,mixed>
	 */
	public static function build_item_meta(array $donation_data) {
		$meta = array();

		if (isset($donation_data['share_count']) && $donation_data['share_count'] > 0) {
			$meta[ self::SHARE_COUNT ] = $donation_data['share_count'];

			if (!empty($donation_data['shareholders']) && is_array($donation_data['shareholders'])) {
				foreach ($donation_data['shareholders'] as $index => $shareholder) {
					if (!is_array($shareholder)) {
						continue;
					}
					foreach (array('name', 'phone', 'email') as $field) {
						if (!empty($shareholder[ $field ])) {
							$meta[ self::shareholder_key($index, $field) ] = $shareholder[ $field ];
						}
					}
					if (isset($shareholder['note']) && $shareholder['note'] !== '') {
						$meta[ self::shareholder_key($index, 'note') ] = $shareholder['note'];
					}
				}
			}

			return $meta;
		}

		if (!empty($donation_data['full_name'])) {
			$meta[ self::DONOR_NAME ] = $donation_data['full_name'];
		}
		if (!empty($donation_data['phone'])) {
			$meta[ self::DONOR_PHONE ] = $donation_data['phone'];
		}
		if (isset($donation_data['note']) && $donation_data['note'] !== '') {
			$meta[ self::DONATION_NOTE ] = $donation_data['note'];
		}
		if (!empty($donation_data['email'])) {
			$meta[ self::DONOR_EMAIL ] = $donation_data['email'];
		}
		if (!empty($donation_data['dedication'])) {
			$meta[ self::DEDICATION ] = $donation_data['dedication'];
		}
		if (!empty($donation_data['anonymous'])) {
			$meta[ self::ANONYMOUS ] = 'yes';
		}
		if (!empty($donation_data['cover_fee'])) {
			$meta[ self::COVER_FEE ] = !empty($donation_data['cover_fee_percent'])
				? (string) $donation_data['cover_fee_percent']
				: 'yes';
		}

		return $meta;
	}

	/**
	 * Display value for fixed keys whose stored value is language independent.
	 *
	 * @param string $fixed_key Fixed key.
	 * @param mixed  $value     Stored value.
	 * @return mixed
	 */
	public static function format_display_value($fixed_key, $value) {
		if (self::ANONYMOUS === $fixed_key && 'yes' === $value) {
			return __('Evet', 'woo-donation-popup');
		}
		if (self::COVER_FEE === $fixed_key) {
			if ('yes' === $value) {
				return __('Evet', 'woo-donation-popup');
			}
			if (is_numeric($value)) {
				return sprintf('+%%%s', $value);
			}
		}
		return $value;
	}

	/**
	 * Read donation fields from an order item, merging fixed and legacy keys.
	 *
	 * @param WC_Order_Item $item Order item.
	 * @return array<string,array{key:string,value:mixed}> fixed key => stored key + value.
	 */
	public static function get_item_donation_data($item) {
		$out = array();
		if (!is_object($item) || !method_exists($item, 'get_meta_data')) {
			return $out;
		}

		foreach ($item->get_meta_data() as $meta) {
			$data = method_exists($meta, 'get_data') ? $meta->get_data() : (array) $meta;
			$key  = isset($data['key']) ? (string) $data['key'] : '';
			$fixed = self::normalize_key($key);
			if (null === $fixed) {
				continue;
			}
			// Fixed keys win over legacy duplicates.
			if (isset($out[ $fixed ]) && $out[ $fixed ]['key'] === $fixed) {
				continue;
			}
			$out[ $fixed ] = array(
				'key'   => $key,
				'value' => isset($data['value']) ? $data['value'] : '',
			);
		}

		return $out;
	}

	/**
	 * Register display filters.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter('woocommerce_order_item_display_meta_key', array(__CLASS__, 'filter_display_meta_key'), 10, 3);
		add_filter('woocommerce_order_item_display_meta_value', array(__CLASS__, 'filter_display_meta_value'), 10, 3);
	}

	/**
	 * woocommerce_order_item_display_meta_key: fixed key → translatable label.
	 *
	 * @param string $display_key Display key.
	 * @param object $meta        Meta object (key, value).
	 * @param mixed  $item        Order item.
	 * @return string
	 */
	public static function filter_display_meta_key($display_key, $meta = null, $item = null) {
		unset($item);
		$raw_key = is_object($meta) && isset($meta->key) ? (string) $meta->key : (string) $display_key;
		$label   = self::get_label($raw_key);
		return null !== $label ? $label : $display_key;
	}

	/**
	 * woocommerce_order_item_display_meta_value: language independent flags → label.
	 *
	 * @param string $display_value Display value.
	 * @param object $meta          Meta object (key, value).
	 * @param mixed  $item          Order item.
	 * @return string
	 */
	public static function filter_display_meta_value($display_value, $meta = null, $item = null) {
		unset($item);
		if (!is_object($meta) || !isset($meta->key) || !self::is_fixed_key((string) $meta->key)) {
			return $display_value;
		}
		$raw   = isset($meta->value) ? $meta->value : $display_value;
		$value = self::format_display_value((string) $meta->key, $raw);
		return $value === $raw ? $display_value : esc_html((string) $value);
	}
}
