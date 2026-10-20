<?php
/**
 * İsteğe bağlı form alanları: e-posta / ithaf / anonim kapı + herkese açık ad maskesi + aydınlatma bağlantısı.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Shared helpers for optional donor fields (AJAX + legacy cart paths).
 */
class WDP_Donation_Optional_Fields {

	const EMAIL_MAX       = 100;
	const DEDICATION_MAX  = 120;
	const NOTE_MAX        = 500;
	const NAME_MAX        = 100;

	/**
	 * Hisseli (çoklu hisse) tipte e-posta / ithaf / anonim yok.
	 *
	 * @param WC_Product|int|null $product Product.
	 * @return bool
	 */
	public static function product_supports_optional_contact_fields($product) {
		if (is_numeric($product)) {
			$product = function_exists('wc_get_product') ? wc_get_product((int) $product) : null;
		}
		if (!$product || !is_object($product) || !method_exists($product, 'get_meta')) {
			return true;
		}
		return $product->get_meta('_allow_multiple_shares') !== 'yes';
	}

	/**
	 * Resolve enable flags from product meta → global (same as form context).
	 *
	 * @param WC_Product|int|null $product Product.
	 * @return array{email:bool,dedication:bool,anonymous:bool}
	 */
	public static function resolve_flags($product) {
		if (is_numeric($product)) {
			$product = function_exists('wc_get_product') ? wc_get_product((int) $product) : null;
		}
		if (!$product || !is_object($product)) {
			$button = get_option('wdp_button_settings', array());
			return array(
				'email'       => is_array($button) && !empty($button['enable_donor_email']) && (string) $button['enable_donor_email'] === '1',
				'dedication'  => is_array($button) && !empty($button['enable_dedication']) && (string) $button['enable_dedication'] === '1',
				'anonymous'   => is_array($button) && !empty($button['enable_anonymous']) && (string) $button['enable_anonymous'] === '1',
			);
		}
		if (!self::product_supports_optional_contact_fields($product)) {
			return array(
				'email'      => false,
				'dedication' => false,
				'anonymous'  => false,
			);
		}
		if (class_exists('WDP_Donation_Product_Context_Service')) {
			return array(
				'email'      => WDP_Donation_Product_Context_Service::resolve_flag_or_global($product, '_enable_email', 'enable_donor_email'),
				'dedication' => WDP_Donation_Product_Context_Service::resolve_flag_or_global($product, '_enable_dedication', 'enable_dedication'),
				'anonymous'  => WDP_Donation_Product_Context_Service::resolve_flag_or_global($product, '_enable_anonymous', 'enable_anonymous'),
			);
		}
		return array(
			'email'      => false,
			'dedication' => false,
			'anonymous'  => false,
		);
	}

	/**
	 * Apply email / dedication / anonymous from a request map into $donation_data.
	 * Closed fields are ignored. Invalid non-empty email throws.
	 *
	 * @param WC_Product|int|null $product       Product.
	 * @param array               $request_data  Already unslashed request (POST-like).
	 * @param array               $donation_data Donation payload (by ref).
	 * @return void
	 * @throws WDP_Validation_Exception Invalid email when field enabled.
	 */
	public static function apply_from_request($product, array $request_data, array &$donation_data) {
		$flags = self::resolve_flags($product);

		if ($flags['email']) {
			$raw = isset($request_data['donation_email']) ? trim((string) $request_data['donation_email']) : '';
			if ($raw !== '') {
				if (function_exists('mb_substr') && function_exists('mb_strlen') && mb_strlen($raw) > self::EMAIL_MAX) {
					$raw = mb_substr($raw, 0, self::EMAIL_MAX);
				} elseif (strlen($raw) > self::EMAIL_MAX) {
					$raw = substr($raw, 0, self::EMAIL_MAX);
				}
				$email = sanitize_email($raw);
				if (!$email || !is_email($email)) {
					throw new WDP_Validation_Exception(
						__('Lütfen geçerli bir e-posta adresi giriniz.', 'woo-donation-popup'),
						array('donation_email')
					);
				}
				$donation_data['email'] = $email;
			}
		}

		if ($flags['dedication']) {
			$raw = isset($request_data['donation_dedication']) ? (string) $request_data['donation_dedication'] : '';
			if ($raw !== '') {
				$dedication = WDP_Security::sanitize_text($raw, self::DEDICATION_MAX);
				if ($dedication !== '') {
					$donation_data['dedication'] = $dedication;
				}
			}
		}

		if ($flags['anonymous'] && !empty($request_data['donation_anonymous'])) {
			$donation_data['anonymous'] = '1';
		}
	}

	/**
	 * Mask a donor name for public surfaces when anonymous. Order/admin keep the original.
	 * Multibyte-safe. Empty name → "Anonim".
	 *
	 * @param string     $name        Full name.
	 * @param bool|string $anonymous  Truthy when anonymous.
	 * @return string
	 */
	public static function mask_public_donor_name($name, $anonymous = false) {
		$is_anon = $anonymous === true
			|| $anonymous === 1
			|| $anonymous === '1'
			|| $anonymous === 'yes'
			|| $anonymous === 'on';
		if (!$is_anon) {
			return (string) $name;
		}
		$name = trim(preg_replace('/\s+/u', ' ', (string) $name));
		if ($name === '') {
			return __('Anonim', 'woo-donation-popup');
		}
		$parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
		if (!is_array($parts) || !$parts) {
			return __('Anonim', 'woo-donation-popup');
		}
		$masked = array();
		foreach ($parts as $part) {
			$first = function_exists('mb_substr') ? mb_substr($part, 0, 1) : substr($part, 0, 1);
			$masked[] = $first . '***';
		}
		return implode(' ', $masked);
	}

	/**
	 * Resolve privacy notice for the current form.
	 *
	 * @param array $options {
	 *     @type bool $has_email
	 *     @type bool $has_dedication
	 *     @type bool $has_shareholders
	 * }
	 * @return array{show:bool,text:string,url:string,link_label:string}|null
	 */
	public static function resolve_privacy_notice(array $options = array()) {
		$button = get_option('wdp_button_settings', array());
		if (!is_array($button) || empty($button['enable_privacy_notice']) || (string) $button['enable_privacy_notice'] !== '1') {
			return null;
		}
		$eligible = !empty($options['has_email'])
			|| !empty($options['has_dedication'])
			|| !empty($options['has_shareholders']);
		if (!$eligible) {
			return null;
		}

		$default_label = self::default_privacy_link_label();
		$label         = isset($button['privacy_notice_text']) && trim((string) $button['privacy_notice_text']) !== ''
			? trim((string) $button['privacy_notice_text'])
			: $default_label;

		$url = isset($button['privacy_notice_url']) ? trim((string) $button['privacy_notice_url']) : '';
		if ($url === '' && function_exists('get_privacy_policy_url')) {
			$url = (string) get_privacy_policy_url();
		}
		$url = $url !== '' && function_exists('esc_url_raw') ? esc_url_raw($url) : $url;

		return array(
			'show'       => true,
			'text'       => $label,
			'url'        => $url,
			'link_label' => $label,
		);
	}

	/**
	 * Default short link label (no long body copy — site owns the KVKK page).
	 *
	 * @return string
	 */
	public static function default_privacy_link_label() {
		return __('Kişisel verilerin işlenmesine ilişkin aydınlatma metni', 'woo-donation-popup');
	}

	/**
	 * Safe HTML for the privacy notice line (empty when hidden / no URL).
	 * Shows only a short link; long default body copy was removed in 10.32.0.
	 *
	 * @param array $options See resolve_privacy_notice.
	 * @return string
	 */
	public static function render_privacy_notice_html(array $options = array()) {
		$notice = self::resolve_privacy_notice($options);
		if (!$notice || empty($notice['show']) || empty($notice['url'])) {
			return '';
		}
		$link_label = (string) $notice['link_label'];
		$url        = (string) $notice['url'];
		$link_html  = '<a href="' . esc_url($url) . '" target="_blank" rel="noopener">' . esc_html($link_label) . '</a>';

		return '<p class="wdp-privacy-notice">' . $link_html . '</p>';
	}
}
