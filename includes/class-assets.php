<?php
/**
 * Ön yüz CSS/JS yükleme orkestratörü; koşullu enqueue ve önbellek temizleme.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-assets-optimizer.php';
require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-assets-registry.php';
require_once WDP_PLUGIN_DIR . 'includes/traits/trait-wdp-assets-inline-styles.php';

/**
 * Class WDP_Assets
 */
class WDP_Assets {
    use WDP_Assets_Optimizer_Trait;
    use WDP_Assets_Registry_Trait;
    use WDP_Assets_Inline_Styles_Trait;

    /** @var bool */
    private static $force_enqueue_assets = false;

    /** @var bool */
    private static $inline_style_attached = false;

    /** @var bool */
    private static $frontend_data_localized = false;

    /** @var bool */
    private static $frontend_assets_registered = false;

    const FRONTEND_CSS_HANDLE = 'wdp-donation-modal-css';
    const FRONTEND_JS_HANDLE = 'wdp-donation-modal-js';

    /**
     * Purge known page caches after asset revision changes.
     *
     * @return void
     */
    public static function purge_known_page_caches() {
        if (function_exists('sg_cachepress_purge_cache')) {
            sg_cachepress_purge_cache();
        }
        if (function_exists('do_action')) {
            do_action('litespeed_purge_all');
            do_action('rocket_clean_domain');
            do_action('autoptimize_action_cachepurged');
        }
    }

    /**
     * Initialize hooks.
     *
     * @return void
     */
    public static function init() {
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue_assets'));
        add_action('wp_footer', array(__CLASS__, 'maybe_enqueue_in_footer'), 1);
        self::register_optimizer_exclusions();
        add_filter('style_loader_tag', array(__CLASS__, 'style_loader_tag_add_no_optimize'), 10, 4);
    }

    /**
     * Maybe enqueue assets in footer when force_enqueue was called late.
     *
     * @return void
     */
    public static function maybe_enqueue_in_footer() {
        if (!self::$force_enqueue_assets) {
            return;
        }
        if (!wp_script_is('wdp-utils-js', 'enqueued') && !wp_script_is(self::FRONTEND_JS_HANDLE, 'enqueued')) {
            self::enqueue_assets_now();
        }
    }

    /**
     * Force enqueue on current request.
     *
     * @return void
     */
    public static function force_enqueue() {
        self::$force_enqueue_assets = true;
        if (did_action('wp_enqueue_scripts')) {
            if (!has_action('wp_footer', array(__CLASS__, 'enqueue_assets_now'))) {
                add_action('wp_footer', array(__CLASS__, 'enqueue_assets_now'), 1);
            }
        }
    }

    /**
     * Enqueue plugin CSS and JS files.
     *
     * @return void
     */
    public static function enqueue_assets() {
        global $post;

        $plugin_dir = defined('WDP_PLUGIN_DIR') ? WDP_PLUGIN_DIR : plugin_dir_path(dirname(dirname(dirname(__FILE__))));
        $plugin_url = defined('WDP_PLUGIN_URL') ? WDP_PLUGIN_URL : plugin_dir_url(dirname(dirname(dirname(__FILE__))));

        self::maybe_refresh_asset_revision_from_files($plugin_dir);

        $should_enqueue = self::should_enqueue_assets($post);
        $should_enqueue = apply_filters('wdp_should_enqueue_assets', $should_enqueue, $post);
        if (self::$force_enqueue_assets) {
            $should_enqueue = true;
        }
        if (!$should_enqueue) {
            return;
        }

        $asset_versions    = self::get_frontend_asset_versions($plugin_dir);
        $css_version       = $asset_versions['css_version'];
        $js_module_version = $asset_versions['js_module_version'];

        $dependencies = array('jquery');
        if (wp_script_is('wc-add-to-cart', 'enqueued')) {
            $dependencies[] = 'wc-add-to-cart';
        }

        self::register_frontend_assets($plugin_url, $css_version, $js_module_version, $dependencies);
        if (!self::$frontend_data_localized) {
            self::localize_frontend_assets($plugin_url);
        }

        self::enqueue_assets_now();
    }

    /**
     * Whether the current request should load donation popup frontend assets.
     *
     * @param WP_Post|null $post Current post.
     * @return bool
     */
    public static function request_should_enqueue_frontend_assets($post = null) {
        if (self::$force_enqueue_assets) {
            return true;
        }
        if (null === $post) {
            $post = get_post();
        }
        return self::should_enqueue_assets($post);
    }

    /**
     * Decide if frontend assets should be loaded for current request.
     *
     * @param WP_Post|null $post Current post.
     * @return bool
     */
    private static function should_enqueue_assets($post) {
        $should_enqueue    = self::$force_enqueue_assets;
        $has_wdp_shortcode = false;

        if (!$should_enqueue && is_a($post, 'WP_Post')) {
            if (self::post_contains_wdp_shortcode($post->post_content) || self::post_contains_wdp_shortcode($post->post_excerpt)) {
                $should_enqueue    = true;
                $has_wdp_shortcode = true;
            }
        }

        if (
            !$should_enqueue
            && function_exists('is_checkout')
            && function_exists('is_cart')
            && (is_checkout() || is_cart())
        ) {
            return false;
        }

        if (!$should_enqueue && is_active_widget(false, false, 'text', true)) {
            $widget_content = get_option('widget_text');
            if (is_array($widget_content)) {
                foreach ($widget_content as $widget) {
                    if (isset($widget['text']) && (has_shortcode($widget['text'], 'wdp_donation_button') || has_shortcode($widget['text'], 'wdp_donation_button_panel') || has_shortcode($widget['text'], 'wdp_donation_form'))) {
                        $should_enqueue = true;
                        break;
                    }
                }
            }
        }

        if (!$should_enqueue && function_exists('is_product') && is_product()) {
            $current_product_id = get_the_ID();
            if ($current_product_id) {
                $should_enqueue = self::product_requires_front_assets($current_product_id);
            }
        }

        if (
            !$should_enqueue
            && function_exists('is_shop')
            && (is_shop() || (function_exists('is_product_taxonomy') && is_product_taxonomy()))
            && class_exists('WDP_Placement_Settings')
            && WDP_Placement_Settings::value('loop_button') !== 'off'
        ) {
            $should_enqueue = true;
        }

        if (!$should_enqueue && is_a($post, 'WP_Post')) {
            if (strpos($post->post_content, 'wdp-donate-button') !== false ||
                strpos($post->post_content, 'wdp-donation-form') !== false ||
                strpos($post->post_content, 'wdp-open-modal') !== false) {
                $should_enqueue = true;
            }
        }

        if (
            $should_enqueue
            && !self::$force_enqueue_assets
            && !$has_wdp_shortcode
            && function_exists('is_checkout')
            && function_exists('is_cart')
            && (is_checkout() || is_cart())
        ) {
            return false;
        }

        return $should_enqueue;
    }

    /**
     * Check post content for donation shortcodes.
     *
     * @param string $post_content Post content.
     * @return bool
     */
    private static function post_contains_wdp_shortcode($post_content) {
        if (!is_string($post_content) || $post_content === '') {
            return false;
        }
        return has_shortcode($post_content, 'wdp_donation_button')
            || has_shortcode($post_content, 'wdp_donation_button_panel')
            || has_shortcode($post_content, 'wdp_donation_form')
            || has_shortcode($post_content, 'wdp_donations')
            || (function_exists('has_block') && (has_block('wdp/donation-form', $post_content) || has_block('wdp/donations', $post_content)));
    }

    /**
     * Whether product meta requires frontend assets.
     *
     * @param int $product_id Product ID.
     * @return bool
     */
    public static function product_requires_front_assets($product_id) {
        $product_id = absint($product_id);
        if (!$product_id) {
            return false;
        }
        if (get_post_meta($product_id, '_allow_custom_price', true) === 'yes'
            || get_post_meta($product_id, '_allow_multiple_shares', true) === 'yes'
            || get_post_meta($product_id, '_enable_progress_bar', true) === 'yes') {
            return true;
        }
        return class_exists('WDP_Donation_Scope') && WDP_Donation_Scope::is_donation_product($product_id);
    }
}
