<?php
/**
 * wdp_donation_button, panel, form ve wdp_donations kısa kod kayıt ve render işlemleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Shortcodes
 */
class WDP_Shortcodes {

	/**
	 * Initialize shortcodes
	 */
	public static function init() {
		add_shortcode('wdp_donation_button', array(__CLASS__, 'donation_button_shortcode'));
		add_shortcode('wdp_donation_button_panel', array(__CLASS__, 'donation_button_panel_shortcode'));
		add_shortcode('wdp_donation_form', array(__CLASS__, 'donation_form_shortcode'));
		add_shortcode('wdp_donations', array('WDP_Donations_List', 'shortcode'));
	}

	/**
	 * Donation button shortcode (center popup).
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_button_shortcode($atts) {
		return WDP_Render_Guard::html(
			static function () use ($atts) {
				return self::render_button($atts, 'wdp_donation_button', 'popup');
			},
			self::raw_id($atts),
			'wdp_donation_button'
		);
	}

	/**
	 * Donation button shortcode (right side panel).
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_button_panel_shortcode($atts) {
		return WDP_Render_Guard::html(
			static function () use ($atts) {
				return self::render_button($atts, 'wdp_donation_button_panel', 'side_panel');
			},
			self::raw_id($atts),
			'wdp_donation_button_panel'
		);
	}

	/**
	 * Donation form shortcode
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public static function donation_form_shortcode($atts) {
		return WDP_Render_Guard::html(
			static function () use ($atts) {
				return self::render_form($atts);
			},
			self::raw_id($atts),
			'wdp_donation_form'
		);
	}

	/**
	 * Shared button + modal renderer used by shortcodes, blocks, widgets and auto-placement.
	 *
	 * @param array  $atts          Attributes.
	 * @param string $shortcode_tag Tag name (for shortcode_atts).
	 * @param string $display_mode  popup|side_panel.
	 * @param array  $context       Block context.
	 * @param bool   $lazy          When true, skip modal HTML (AJAX later).
	 * @return string
	 */
	public static function render_button($atts, $shortcode_tag, $display_mode, $context = array(), $lazy = false) {
		$atts = shortcode_atts(
			array(
				'id'      => 0,
				'slug'    => '',
				'sku'     => '',
				'text'    => '',
				'class'   => '',
				'style'   => '',
			),
			is_array($atts) ? $atts : array(),
			$shortcode_tag
		);

		$resolved = self::resolve_for_output($atts, $context);
		if (is_string($resolved)) {
			return $resolved;
		}
		$product    = $resolved['product'];
		$product_id = (int) $product->get_id();
		$notice     = $resolved['notice'];

		if (!$product->is_purchasable()) {
			return WDP_Utils::admin_notice_html(
				sprintf(
					/* translators: %d: product ID */
					__('Bu ürün satın alınamaz (ID: %d).', 'woo-donation-popup'),
					$product_id
				)
			);
		}
		if (!$product->is_in_stock()) {
			return WDP_Utils::admin_notice_html(
				sprintf(
					/* translators: %d: product ID */
					__('Bu ürün stokta yok (ID: %d).', 'woo-donation-popup'),
					$product_id
				)
			);
		}

		$custom_class = sanitize_html_class($atts['class']);
		$custom_style = sanitize_text_field($atts['style']);
		$button_text  = self::resolve_button_text($atts['text']);

		self::enqueue_front();

		$button_settings = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);
		$is_full_width = isset($button_settings['popup_button_full_width']) && $button_settings['popup_button_full_width'] === '1';
		$is_side_panel = ($display_mode === 'side_panel');
		$modal_id      = WDP_Render_Registry::modal_id($product_id, $display_mode);

		$open_class = $is_side_panel ? 'wdp-open-modal wdp-open-side-panel' : 'wdp-open-modal';
		$button_classes = 'wdp-donate-button ' . $open_class . ' wdp-shortcode-trigger';
		if ($is_full_width) {
			$button_classes .= ' wdp-donate-button-full-width';
		}
		if ($custom_class !== '') {
			$button_classes .= ' ' . $custom_class;
		}

		ob_start();
		echo $notice; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- admin_notice_html is escaped
		?>
		<button type="button" class="<?php echo esc_attr($button_classes); ?>"
				data-product-id="<?php echo esc_attr((string) $product_id); ?>"
				data-wdp-mode="<?php echo esc_attr($is_side_panel ? 'side_panel' : 'popup'); ?>"
				<?php if ($is_side_panel) : ?>data-wdp-modal-id="<?php echo esc_attr($modal_id); ?>" <?php endif; ?>
				<?php if ($lazy) : ?>data-wdp-lazy="1"<?php endif; ?>
				<?php if ($custom_style !== '') : ?>style="<?php echo esc_attr($custom_style); ?>"<?php endif; ?>>
			<?php echo esc_html($button_text); ?>
		</button>
		<?php
		WDP_Render_Registry::mark_trigger($product_id);
		if (!$lazy && WDP_Render_Registry::claim_modal($modal_id)) {
			echo WDP_Templates::render_donation_modal($product_id, $button_text, $custom_class, $custom_style, $display_mode); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		return (string) ob_get_clean();
	}

	/**
	 * Shared inline form renderer.
	 *
	 * @param array $atts    Attributes.
	 * @param array $context Block context.
	 * @return string
	 */
	public static function render_form($atts, $context = array()) {
		$atts = shortcode_atts(
			array(
				'id'          => 0,
				'slug'        => '',
				'sku'         => '',
				'button_text' => __('Bağış Yap', 'woo-donation-popup'),
				'title'       => '',
				'show_title'  => 'yes',
				'class'       => '',
			),
			is_array($atts) ? $atts : array(),
			'wdp_donation_form'
		);

		$resolved = self::resolve_for_output($atts, $context);
		if (is_string($resolved)) {
			return $resolved;
		}
		$product    = $resolved['product'];
		$product_id = (int) $product->get_id();
		$notice     = $resolved['notice'];

		if (!WDP_Render_Registry::claim_form($product_id)) {
			return WDP_Render_Registry::duplicate_form_notice($product_id);
		}

		self::enqueue_front();
		return $notice . WDP_Templates::render_donation_form($product_id, $atts);
	}

	/**
	 * Resolve product, apply scope, return product+preview notice or an HTML string (error/empty).
	 *
	 * @param array $atts    Attributes.
	 * @param array $context Block context.
	 * @return array{product:object,notice:string}|string
	 */
	public static function resolve_for_output($atts, $context = array()) {
		$atts    = is_array($atts) ? $atts : array();
		$context = is_array($context) ? $context : array();
		$explicit = WDP_Product_Resolver::has_explicit_product($atts);
		$product  = WDP_Product_Resolver::resolve($atts, $context);

		$preview_notice = '';
		if ($product && class_exists('WDP_Builder_Detect') && WDP_Builder_Detect::is_builder_preview()) {
			$preview_notice = WDP_Builder_Detect::preview_notice($product);
		}

		if (!$product) {
			return WDP_Utils::admin_notice_html(
				__('Bağış formu: ürün bulunamadı (id/slug/sku verilmedi veya bu sayfa bir ürün sayfası değil).', 'woo-donation-popup')
			);
		}

		if (!$explicit && class_exists('WDP_Donation_Scope') && !WDP_Donation_Scope::is_donation_product($product)) {
			return WDP_Utils::admin_notice_html(__('Bu ürün bağış ürünü olarak işaretli değil.', 'woo-donation-popup'));
		}

		return array(
			'product' => $product,
			'notice'  => $preview_notice,
		);
	}

	/**
	 * @param mixed $text Attribute text.
	 * @return string
	 */
	public static function resolve_button_text($text) {
		$text = is_scalar($text) ? sanitize_text_field((string) $text) : '';
		if ($text !== '') {
			return $text;
		}
		$button_settings = WDP_Utils::normalize_legacy_popup_button_text(
			get_option('wdp_button_settings', array())
		);
		if (!empty($button_settings['popup_button_text'])) {
			return sanitize_text_field((string) $button_settings['popup_button_text']);
		}
		return __('Bağış Yap', 'woo-donation-popup');
	}

	/**
	 * @return void
	 */
	public static function enqueue_front() {
		WDP_Assets::force_enqueue();
		if (did_action('wp_enqueue_scripts') && class_exists('WDP_Assets')) {
			WDP_Assets::enqueue_assets_now();
		}
	}

	/**
	 * Product ID attribute as typed (for error notices before the product is resolved).
	 *
	 * @param mixed $atts Shortcode attributes.
	 * @return int
	 */
	private static function raw_id($atts) {
		return (is_array($atts) && isset($atts['id'])) ? absint($atts['id']) : 0;
	}
}
