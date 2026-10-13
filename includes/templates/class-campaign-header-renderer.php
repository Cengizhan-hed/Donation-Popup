<?php
/**
 * Kampanya başlığı: medya, etki, header modülleri ve shell öznitelikleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Class WDP_Campaign_Header_Renderer
 */
class WDP_Campaign_Header_Renderer {

	/**
	 * Ürün notu metni (görünüm CSS ile sabitlenir).
	 *
	 * @param array $context Product form context.
	 * @return array{text:string}
	 */
	public static function resolve_product_note_display(array $context) {
		return array(
			'text' => isset($context['product_note_text']) ? trim((string) $context['product_note_text']) : '',
		);
	}

	/**
	 * Ürün notu HTML bloğu.
	 *
	 * @param array  $display   text.
	 * @param string $toggle_id Optional expand toggle id.
	 * @param bool   $is_long   Long text flag.
	 * @return string Safe HTML.
	 */
	public static function render_product_note_block($display, $toggle_id = '', $is_long = false) {
		if (!is_array($display) || empty($display['text'])) {
			return '';
		}

		ob_start();
		?>
		<div class="wdp-product-note" role="note">
			<div class="wdp-product-note__card">
				<span class="wdp-product-note__badge" aria-hidden="true">
					<svg class="wdp-product-note__badge-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
						<path d="M12 3.5 4.8 6.2v5.1c0 4.6 3.1 7.9 7.2 9.2 4.1-1.3 7.2-4.6 7.2-9.2V6.2L12 3.5Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
						<path d="M9.4 12.1 11.1 13.8 14.7 10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
				<div class="wdp-product-note__body">
					<?php if ($is_long && $toggle_id !== '') : ?>
					<input type="checkbox" id="<?php echo esc_attr($toggle_id); ?>" class="wdp-product-note__toggle">
					<?php endif; ?>
					<p class="wdp-product-note__text"><?php echo esc_html($display['text']); ?></p>
					<?php if ($is_long && $toggle_id !== '') : ?>
					<label for="<?php echo esc_attr($toggle_id); ?>" class="wdp-product-note__more">
						<span class="wdp-product-note__more-open"><?php echo esc_html__('Devamını Gör', 'woo-donation-popup'); ?></span>
						<span class="wdp-product-note__more-close"><?php echo esc_html__('Daha Az Göster', 'woo-donation-popup'); ?></span>
					</label>
					<?php endif; ?>
				</div>
			</div>
		</div>
		<?php
		return trim(ob_get_clean());
	}

	/**
	 * Başlık altı etki / kampanya satırı.
	 *
	 * @param string $text Impact copy.
	 * @return string Safe HTML.
	 */
	public static function render_impact_line($text) {
		$text = trim((string) $text);
		if ($text === '') {
			return '';
		}
		return '<p class="wdp-impact-line">' . esc_html($text) . '</p>';
	}

	/**
	 * Impact metnini çözümler (progress formlarda varsayılan destek cümlesi).
	 *
	 * @param int   $product_id Product ID.
	 * @param array $context    Form context.
	 * @return string
	 */
	public static function resolve_impact_line_text($product_id, array $context) {
		if (isset($context['enable_impact_line']) && empty($context['enable_impact_line'])) {
			return '';
		}
		$default = '';
		if (!empty($context['impact_line_text'])) {
			$default = trim((string) $context['impact_line_text']);
		} elseif ($product_id > 0) {
			$default = trim((string) get_post_meta($product_id, '_impact_line_text', true));
		}
		if ($default === '' && !empty($context['enable_progress_bar'])) {
			$default = '';
		}
		return (string) apply_filters('wdp_impact_line', $default, $product_id, $context);
	}

	/**
	 * Opsiyonel ürün küçük görseli (filtre ile URL verilirse).
	 *
	 * @param int $product_id Product ID.
	 * @return string Safe HTML.
	 */
	public static function render_modal_product_thumb($product_id) {
		$url = (string) apply_filters('wdp_modal_product_thumb_url', '', $product_id);
		$url = esc_url(trim($url));
		if ($url === '') {
			return '';
		}
		$alt = (string) apply_filters('wdp_modal_product_thumb_alt', '', $product_id);
		return '<span class="wdp-modal-thumb"><img src="' . esc_url($url) . '" alt="' . esc_attr($alt) . '" loading="lazy" decoding="async" width="48" height="48" /></span>';
	}

	/**
	 * Campaign hero media (product featured image when enabled).
	 *
	 * @param int   $product_id Product ID.
	 * @param array $context    Context.
	 * @return string
	 */
	public static function render_campaign_media($product_id, array $context) {
		if (empty($context['enable_campaign_media'])) {
			return '';
		}
		$url = '';
		if (function_exists('get_the_post_thumbnail_url')) {
			$url = (string) get_the_post_thumbnail_url($product_id, 'large');
		}
		$url = (string) apply_filters('wdp_campaign_media_url', $url, $product_id, $context);
		$url = esc_url(trim($url));
		if ($url === '') {
			return '';
		}
		$alt = isset($context['product_name']) ? (string) $context['product_name'] : '';
		return '<div class="wdp-campaign-media"><img src="' . esc_url($url) . '" alt="' . esc_attr($alt) . '" loading="lazy" decoding="async" /></div>';
	}

	/**
	 * Header persuasion modules (media, impact, urgency, social proof) in module order.
	 * Skips body module ids (amount, donor, dedication, cover_fee, sadaka, trust).
	 *
	 * @param int   $product_id Product ID.
	 * @param array $context    Context.
	 * @param array $extra      title_html, note_html, progress_html.
	 * @return string
	 */
	public static function render_header_modules($product_id, array $context, array $extra = array()) {
		$order = class_exists('WDP_Form_Modules')
			? WDP_Form_Modules::resolve_order($product_id)
			: array('media', 'impact', 'urgency', 'social_proof', 'progress');

		$chunks = array(
			'media'        => self::render_campaign_media($product_id, $context),
			'impact'       => self::render_impact_line(self::resolve_impact_line_text($product_id, $context)),
			'urgency'      => (!empty($context['enable_urgency']) && class_exists('WDP_Form_Modules'))
				? WDP_Form_Modules::render_urgency(
					isset($context['urgency_text']) ? $context['urgency_text'] : '',
					isset($context['urgency_ends_at']) ? $context['urgency_ends_at'] : ''
				)
				: '',
			'social_proof' => (!empty($context['enable_social_proof']) && class_exists('WDP_Form_Modules'))
				? WDP_Form_Modules::render_social_proof(isset($context['social_proof_text']) ? $context['social_proof_text'] : '')
				: '',
			'progress'     => isset($extra['progress_html']) ? (string) $extra['progress_html'] : '',
			'title'        => isset($extra['title_html']) ? (string) $extra['title_html'] : '',
			'note'         => isset($extra['note_html']) ? (string) $extra['note_html'] : '',
		);

		$html = '';
		if (!empty($chunks['title'])) {
			$html .= $chunks['title'];
		}
		foreach ($order as $id) {
			if ($id === 'amount' || $id === 'donor' || $id === 'dedication' || $id === 'cover_fee' || $id === 'sadaka' || $id === 'trust') {
				continue;
			}
			if (!empty($chunks[ $id ])) {
				$html .= $chunks[ $id ];
			}
		}
		if (!empty($chunks['note'])) {
			$html .= $chunks['note'];
		}
		return $html;
	}

	/**
	 * Layout class + theme style attrs for modal/form shell.
	 *
	 * @param int   $product_id Product ID.
	 * @param array $context    Context.
	 * @return array{class:string,style:string,layout:string}
	 */
	public static function resolve_shell_attrs($product_id, array $context) {
		$layout = isset($context['layout_mode']) ? sanitize_key((string) $context['layout_mode']) : 'classic';
		if (!in_array($layout, array('classic', 'campaign', 'story'), true)) {
			$layout = 'classic';
		}
		$class = ' wdp-layout-' . $layout;
		$style = class_exists('WDP_Form_Modules')
			? WDP_Form_Modules::build_product_theme_style($product_id, $context)
			: '';
		return array(
			'class'  => $class,
			'style'  => $style,
			'layout' => $layout,
		);
	}
}
