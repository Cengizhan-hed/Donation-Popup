<?php
/**
 * ============================================================================
 * WDP_PROGRESS_FORM - PROGRESS BAR FORM RENDER SINIFI
 * ============================================================================
 * 
 * DOSYA: class-progress-form.php
 * KONUM: /includes/class-progress-form.php
 * 
 * AMAÇ:
 * Progress bar özellikli bağış formlarını render eder.
 * 
 * ============================================================================
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
        ob_start();
        ?>
        <!-- Progress Bar -->
        <div class="wdp-progress-bar-container" data-product-id="<?php echo esc_attr($product_id); ?>" data-limit="<?php echo esc_attr($progress_bar_limit); ?>" data-current="<?php echo esc_attr($total_donation); ?>">
            <div class="wdp-progress-bar-header">
                <div class="wdp-progress-bar-info">
                    <span class="wdp-progress-bar-label"><?php echo esc_html__('Toplanan Bağış', 'woo-donation-popup'); ?></span>
                    <span class="wdp-progress-bar-amount"><?php echo WDP_Utils::format_price_html($total_donation); ?></span>
                </div>
                <div class="wdp-progress-bar-limit">
                    <span class="wdp-progress-bar-limit-label"><?php echo esc_html__('Hedef', 'woo-donation-popup'); ?></span>
                    <span class="wdp-progress-bar-limit-amount"><?php echo WDP_Utils::format_price_html($progress_bar_limit); ?></span>
                </div>
            </div>
            <div class="wdp-progress-bar-wrapper">
                <div class="wdp-progress-bar">
                    <div class="wdp-progress-bar-fill" style="width: <?php echo esc_attr(min(100, ($total_donation / max(1, $progress_bar_limit)) * 100)); ?>%;"></div>
                    <div class="wdp-progress-bar-preview" style="width: 0%;"></div>
                </div>
                <div class="wdp-progress-bar-percentage">
                    <span class="wdp-progress-bar-percentage-value"><?php echo esc_html(round(min(100, ($total_donation / max(1, $progress_bar_limit)) * 100), 1)); ?>%</span>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render progress bar form fields
     *
     * @param bool   $allow_custom_price Allow custom price (always true for progress bar forms).
     * @param string $min_price          Minimum price.
     * @return string Form fields HTML.
     */
    public static function render_form_fields($allow_custom_price = false, $min_price = '0') {
        // Progress bar formunda özel fiyat her zaman aktif olmalı
        $allow_custom_price = true;

        $wdp_currency_symbol = WDP_Utils::get_display_currency_symbol();
        $wdp_custom_price_placeholder = (floatval($min_price) > 0)
            ? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price))
            : __('Bağış tutarı *', 'woo-donation-popup');
        
        ob_start();
        ?>
        <!-- Bağışçı Bilgileri -->
        <?php echo WDP_Templates::render_donor_contact_stack(); ?>

        <!-- Fiyat Alanı - Progress bar formunda sayaç yok, sadece özel fiyat -->
        <div class="wdp-price-quantity-row wdp-progress-bar-price-row">
            <!-- Progress bar formunda özel fiyat her zaman gösterilir, full width -->
            <div class="wdp-price-field wdp-progress-bar-price-field">
                <div class="wdp-custom-price-shell">
                    <span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($wdp_currency_symbol); ?></span>
                    <input type="number" name="custom_price" placeholder="<?php echo esc_attr($wdp_custom_price_placeholder); ?>" min="<?php echo esc_attr($min_price); ?>" step="1" required class="wdp-custom-price-input wdp-progress-bar-price-input" data-base-min="<?php echo esc_attr($min_price); ?>" inputmode="decimal" autocomplete="off">
                </div>
            </div>
            <!-- Hidden quantity input for form submission -->
            <input type="hidden" name="quantity" value="1">
        </div>
        <?php
        return ob_get_clean();
    }
}

