<?php
/**
 * Hedefli bağışlar için progress bar ve ilgili form alanı HTML'i.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Progress_Form
 */
class WDP_Progress_Form {

    /**
     * Render progress bar form HTML
     *
     * @param int    $product_id         Product ID.
     * @param float  $progress_bar_limit Progress bar limit.
     * @param float  $total_donation     Total donation amount.
     * @param bool   $allow_custom_price Allow custom price.
     * @param string $min_price          Minimum price.
     * @return string Progress bar HTML.
     */
    public static function render_progress_bar($product_id, $progress_bar_limit, $total_donation, $allow_custom_price = false, $min_price = '0') {
        $limit = max(1, (float) $progress_bar_limit);
        $current = max(0, (float) $total_donation);
        $pending = class_exists('WDP_Cart')
            ? (float) WDP_Cart::sum_cart_pending_for_product($product_id)
            : 0.0;
        $percent = min(100, ($current / $limit) * 100);
        $pending_percent = 0.0;
        if ($pending > 0 && $percent < 100) {
            $pending_percent = min(100 - $percent, ($pending / $limit) * 100);
        }
        $display_percent = min(100, $percent + $pending_percent);
        $is_complete = $percent >= 100;
        $is_approaching = !$is_complete && $display_percent >= 90;
        $donor_count = class_exists('WDP_Utils') ? (int) WDP_Utils::get_donor_count($product_id) : 0;
        $remaining = max(0, $limit - $current);
        $pct_rounded = round($display_percent, 1);

        $container_class = 'wdp-progress-bar-container';
        if ($is_complete) {
            $container_class .= ' is-complete';
        }
        if ($is_approaching) {
            $container_class .= ' is-approaching';
        }
        if ($pending_percent > 0.05) {
            $container_class .= ' has-pending';
        }

        $donors_label = '';
        if ($donor_count > 0) {
            $donors_label = sprintf(
                /* translators: %d: number of donors */
                _n('%d kişi', '%d kişi', $donor_count, 'woo-donation-popup'),
                $donor_count
            );
        }
        $remaining_label = '';
        if (!$is_complete && $remaining > 0) {
            $remaining_plain = method_exists('WDP_Utils', 'format_price_plain')
                ? WDP_Utils::format_price_plain($remaining)
                : wp_strip_all_tags(WDP_Utils::format_price_html($remaining));
            $remaining_label = sprintf(
                /* translators: %s: remaining amount */
                __('%s kaldı', 'woo-donation-popup'),
                $remaining_plain
            );
        }

        ob_start();
        ?>
        <div
            class="<?php echo esc_attr($container_class); ?>"
            data-product-id="<?php echo esc_attr($product_id); ?>"
            data-limit="<?php echo esc_attr($progress_bar_limit); ?>"
            data-current="<?php echo esc_attr($total_donation); ?>"
            data-pending="<?php echo esc_attr($pending); ?>"
            data-donor-count="<?php echo esc_attr((string) $donor_count); ?>"
            role="group"
            aria-label="<?php echo esc_attr__('Bağış ilerleme durumu', 'woo-donation-popup'); ?>"
        >
            <div class="wdp-progress-bar-header">
                <div class="wdp-progress-bar-info">
                    <span class="wdp-progress-bar-amount"><?php echo WDP_Utils::format_price_html($total_donation); ?></span>
                    <span class="wdp-progress-bar-label"><?php echo esc_html__('toplandı', 'woo-donation-popup'); ?></span>
                    <span class="wdp-progress-bar-delta" data-wdp-progress-delta hidden></span>
                </div>
                <div class="wdp-progress-bar-pct-block">
                    <span class="wdp-progress-bar-pct" data-wdp-progress-pct-text><?php echo esc_html((string) $pct_rounded); ?>%</span>
                </div>
            </div>

            <div class="wdp-progress-bar-wrapper">
                <div
                    class="wdp-progress-bar"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="<?php echo esc_attr((string) round($percent, 1)); ?>"
                    aria-label="<?php echo esc_attr__('Hedef tamamlanma oranı', 'woo-donation-popup'); ?>"
                >
                    <div class="wdp-progress-bar-fill" style="width: <?php echo esc_attr((string) $percent); ?>%;"></div>
                    <div
                        class="wdp-progress-bar-pending"
                        style="left: <?php echo esc_attr((string) $percent); ?>%; width: <?php echo esc_attr((string) $pending_percent); ?>%;<?php echo $pending_percent > 0 ? '' : ' display: none;'; ?>"
                    ></div>
                    <div class="wdp-progress-bar-preview" style="width: 0%;"></div>
                </div>
                <!-- Kept for JS color helpers; visually unused -->
                <span class="wdp-progress-bar-percentage-value" hidden aria-hidden="true"><?php echo esc_html((string) $pct_rounded); ?>%</span>
            </div>

            <div class="wdp-progress-bar-status-row">
                <span class="wdp-progress-bar-goal">
                    <span class="wdp-progress-bar-limit-label"><?php echo esc_html__('Hedef', 'woo-donation-popup'); ?></span>
                    <span class="wdp-progress-bar-limit-amount"><?php echo WDP_Utils::format_price_html($progress_bar_limit); ?></span>
                </span>
                <?php if ($remaining_label !== '') : ?>
                <span class="wdp-progress-bar-sep" aria-hidden="true">·</span>
                <span class="wdp-progress-bar-remaining" data-wdp-progress-remaining><?php echo esc_html($remaining_label); ?></span>
                <?php else : ?>
                <span class="wdp-progress-bar-remaining" data-wdp-progress-remaining hidden></span>
                <?php endif; ?>
                <?php if ($donors_label !== '') : ?>
                <span class="wdp-progress-bar-sep" aria-hidden="true">·</span>
                <span class="wdp-progress-bar-donors" data-wdp-progress-donors><?php echo esc_html($donors_label); ?></span>
                <?php else : ?>
                <span class="wdp-progress-bar-donors" data-wdp-progress-donors hidden></span>
                <?php endif; ?>
                <span class="wdp-progress-bar-status__chip" data-wdp-progress-status hidden></span>
                <span class="wdp-progress-bar-impact" data-wdp-progress-impact hidden></span>
            </div>

            <div class="wdp-progress-bar-meta"<?php echo !$is_complete ? ' hidden' : ''; ?>>
                <span class="wdp-progress-bar-complete-label"<?php echo !$is_complete ? ' hidden' : ''; ?>>
                    <?php echo esc_html__('Hedefe ulaşıldı', 'woo-donation-popup'); ?>
                </span>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render progress bar form fields (ordered via module_order).
     *
     * @param bool   $allow_custom_price Allow custom price (always true for progress bar forms).
     * @param string $min_price          Minimum price.
     * @param array  $donor_opts         Donor stack options.
     * @param array  $context            Optional form context (cover_fee flags, etc.).
     * @param int    $product_id         Optional product ID for module_order.
     * @return string Form fields HTML.
     */
    public static function render_form_fields($allow_custom_price = false, $min_price = '0', $donor_opts = array(), $context = array(), $product_id = 0) {
        unset($allow_custom_price);

        if (!is_array($donor_opts)) {
            $donor_opts = array();
        }
        if (!is_array($context)) {
            $context = array();
        }

        $product_id = absint($product_id);
        if ($product_id <= 0 && !empty($GLOBALS['wdp_current_donation_product_id'])) {
            $product_id = absint($GLOBALS['wdp_current_donation_product_id']);
        }

        return WDP_Templates::render_ordered_body_modules(
            array(
                'product_id'  => $product_id,
                'context'     => $context,
                'donor_opts'  => $donor_opts,
                'amount_html' => WDP_Form_Fields_Renderer::render_progress_amount_block($min_price),
            )
        );
    }
}
