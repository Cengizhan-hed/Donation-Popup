<?php
/**
 * ============================================================================
 * WDP_TEMPLATES - ŞABLON RENDER SINIFI
 * ============================================================================
 * 
 * DOSYA: class-templates.php
 * KONUM: /includes/classes/class-templates.php
 * 
 * AMAÇ:
 * Modal ve form HTML şablonlarını render eder.
 * PHP tarafında HTML oluşturma.
 * 
 * ANA İŞLEVLER:
 * 1. render_donation_modal - Modal HTML render
 * 2. render_donation_form - Form HTML render
 * 3. render_button - Buton HTML render
 * 4. get_form_fields - Form alanlarını oluşturma
 * 5. get_shareholder_fields - Hissedar alanlarını oluşturma
 * 
 * MODAL YAPISI:
 * - Modal container (.wdp-modal)
 * - Modal backdrop (.wdp-modal-backdrop)
 * - Modal content (.wdp-modal-content)
 * - Form (.wdp-donation-form)
 * - Close button
 * 
 * FORM YAPISI:
 * - Product ID hidden input
 * - Quantity selector
 * - Custom price input (opsiyonel)
 * - Shareholder form (opsiyonel)
 * - Submit button
 * 
 * ÖZELLEŞTİRME:
 * - Admin panelinden gelen ayarlar
 * - Custom CSS class
 * - Custom inline styles
 * - Button text customization
 * 
 * GÜVENLİK:
 * - Input sanitization
 * - Output escaping (esc_html, esc_attr)
 * - Nonce field ekleme
 * 
 * PERFORMANS:
 * - Cached product data
 * - Optimized HTML generation
 * - Minimal DOM manipulation
 * 
 * ============================================================================
 * 
 * Templates class
 * Handles template rendering (modal, forms)
 * 
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class WDP_Templates
 */
class WDP_Templates {
    /**
     * Render note icon SVG.
     *
     * @param string $icon Icon key.
     * @return string
     */
    private static function render_note_icon_svg($icon) {
        $svg_map = array(
            'info' => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="M12 10.2v6.1"></path><circle cx="12" cy="7.6" r="1"></circle></svg>',
            'video' => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-wdp-note-icon="video"><circle cx="12" cy="12" r="8.75" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"></circle><path fill="currentColor" stroke="none" d="M10.15 8.45c0-.28.22-.5.5-.5.11 0 .22.04.31.11l4.85 3.18c.22.14.22.46 0 .6l-4.85 3.18c-.09.07-.2.11-.31.11-.28 0-.5-.22-.5-.5V8.95z"></path></svg>',
            'delivery' => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 8h11v7h-11z"></path><path d="M14.5 11h3.2l2.3 2.6V15h-5.5z"></path><circle cx="8" cy="17.5" r="1.7"></circle><circle cx="17.5" cy="17.5" r="1.7"></circle></svg>',
            'heart' => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20s-6.8-3.9-8.9-8A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 8.9 6c-2.1 4.1-8.9 8-8.9 8z"></path></svg>',
        );

        $icon = isset($svg_map[$icon]) ? $icon : 'info';
        return $svg_map[$icon];
    }

    /**
     * Get note tone class by icon.
     *
     * @param string $icon Icon key.
     * @return string
     */
    private static function get_note_tone_class($icon) {
        $map = array(
            'video'    => 'wdp-product-note--video',
            'delivery' => 'wdp-product-note--delivery',
            'heart'    => 'wdp-product-note--heart',
        );
        return isset($map[$icon]) ? $map[$icon] : 'wdp-product-note--info';
    }

    /**
     * Inline SVG icons for premium field stack (filled, consistent weight).
     *
     * @return string
     */
    private static function field_stack_icon_user_svg() {
        $svg = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>';
        return wp_kses(
            $svg,
            array(
                'svg'  => array(
                    'class'       => true,
                    'viewbox'     => true,
                    'aria-hidden' => true,
                    'focusable'   => true,
                ),
                'path' => array(
                    'fill' => true,
                    'd'    => true,
                ),
            )
        );
    }

    /**
     * @return string
     */
    private static function field_stack_icon_note_svg() {
        $svg = '<svg class="wdp-field-stack__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
        return wp_kses(
            $svg,
            array(
                'svg'  => array(
                    'class'       => true,
                    'viewbox'     => true,
                    'aria-hidden' => true,
                    'focusable'   => true,
                ),
                'path' => array(
                    'fill' => true,
                    'd'    => true,
                ),
            )
        );
    }

    /**
     * Stacked donor fields: name, phone, visible note (standard / progress forms).
     *
     * @return string Safe HTML.
     */
    public static function render_donor_contact_stack() {
        ob_start();
        ?>
        <div class="wdp-field-stack" role="group" aria-label="<?php echo esc_attr__('Bağışçı iletişim bilgileri', 'woo-donation-popup'); ?>">
            <div class="wdp-field-stack__row">
                <span class="wdp-field-stack__icon"><?php echo self::field_stack_icon_user_svg(); ?></span>
                <input type="text" class="wdp-field-stack__input" name="donation_full_name" placeholder="<?php echo esc_attr__( 'Ad Soyad *', 'woo-donation-popup' ); ?>" required autocomplete="name" />
            </div>
            <div class="wdp-field-stack__row wdp-field-stack__row--phone">
                <div class="wdp-field-stack__phone">
                    <input type="tel" class="wdp-field-stack__input" name="donation_phone" placeholder="<?php echo esc_attr__( 'Telefon Numarası *', 'woo-donation-popup' ); ?>" required autocomplete="tel" inputmode="tel" />
                </div>
            </div>
            <div class="wdp-field-stack__row wdp-field-stack__row--textarea">
                <span class="wdp-field-stack__icon"><?php echo self::field_stack_icon_note_svg(); ?></span>
                <textarea class="wdp-field-stack__textarea" name="donation_note" rows="2" placeholder="<?php echo esc_attr__( 'Not (isteğe bağlı)', 'woo-donation-popup' ); ?>"></textarea>
            </div>
        </div>
        <?php
        return trim(ob_get_clean());
    }

    /**
     * Multibyte-safe string length.
     *
     * @param string $value Text value.
     * @return int
     */
    private static function text_length($value) {
        if (function_exists('mb_strlen')) {
            return mb_strlen($value);
        }
        return strlen($value);
    }

    /**
     * Render donation modal
     *
     * @param int    $product_id    Product ID.
     * @param string $button_text   Button text.
     * @param string $custom_class  Custom CSS class.
     * @param string $custom_style  Custom CSS style.
     * @return string
     */
    public static function render_donation_modal($product_id, $button_text = '', $custom_class = '', $custom_style = '') {
        // Ürün ID'sini integer'a çevir
        $product_id = intval($product_id);

        // Ürünün varlığını kontrol et
        $product = wc_get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        // Buton metni boşsa ayarlardan veya varsayılan değeri kullan
        if (empty($button_text)) {
            $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
                get_option('wdp_button_settings', array())
            );
            $button_text = isset($button_settings['popup_button_text']) ? $button_settings['popup_button_text'] : __('Bağış Yap', 'woo-donation-popup');
        }

        // Ürün adını al
        $product_name = $product->get_name();
        
        // Ürün fiyatını al
        $product_price = $product->get_price();
        $formatted_price = $product_price ? WDP_Utils::format_price_html($product_price) : '';
        $enable_product_note = $product->get_meta('_enable_product_note') === 'yes';
        $product_note_text = trim((string) $product->get_meta('_product_note_text'));
        $product_note_icon = $product->get_meta('_product_note_icon');
        if ($product_note_icon === '') {
            $product_note_icon = 'info';
        }
        $show_product_note = $enable_product_note && $product_note_text !== '';
        $note_tone_class = self::get_note_tone_class($product_note_icon);
        $is_long_note = self::text_length($product_note_text) > 110;
        $modal_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-modal';

        // Benzersiz bir ID oluştur
        $modal_id = 'wdp-modal-' . $product_id;

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
        $min_price = $product->get_meta('_min_custom_price');

        // Eğer minimum fiyat yoksa ve özel fiyat aktifse, varsayılan olarak 0 kullan
        if ($allow_custom_price && $min_price === '') {
            $min_price = '0';
        }

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $allow_multiple_shares = $product->get_meta('_allow_multiple_shares') === 'yes';
        $max_shares = $product->get_meta('_max_shares');

        // Eğer maksimum hisse sayısı yoksa ve çoklu hisse aktifse, varsayılan olarak 7 kullan
        if ($allow_multiple_shares && $max_shares === '') {
            $max_shares = '7';
        }

        // Progress bar ayarları
        $enable_progress_bar = $product->get_meta('_enable_progress_bar') === 'yes';
        $progress_bar_limit = $product->get_meta('_progress_bar_limit');
        if ($progress_bar_limit === '') {
            $progress_bar_limit = '100000';
        }
        $progress_bar_limit = floatval($progress_bar_limit);
        
        // Progress bar formunda minimum fiyat kontrolü (ürün fiyatı veya min_custom_price)
        $progress_min_price = $min_price;
        if ($enable_progress_bar) {
            $product_base_price = floatval($product->get_price());
            if ($product_base_price > 0) {
                $progress_min_price = $min_price && floatval($min_price) > 0 ? min(floatval($min_price), $product_base_price) : $product_base_price;
            } else {
                $progress_min_price = $min_price && floatval($min_price) > 0 ? $min_price : '0';
            }
        }
        
        // Toplam bağış miktarını al
        $total_donation = 0.0;
        if ($enable_progress_bar) {
            $total_donation = WDP_Utils::get_total_donation_amount($product_id);
        }

        $wdp_currency_symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '₺';
        $wdp_custom_price_placeholder = (floatval($min_price) > 0)
            ? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price))
            : __('Bağış tutarı *', 'woo-donation-popup');

        // Assets'i zorla yükle
        WDP_Assets::force_enqueue();

        ob_start();
        ?>
        <!-- Modal -->
        <div id="<?php echo esc_attr($modal_id); ?>" class="wdp-modal <?php echo esc_attr($custom_class); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modal_id); ?>-title" aria-describedby="<?php echo esc_attr($modal_id); ?>-description" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>" style="display:none;visibility:hidden;opacity:0;">
            <div class="wdp-modal-content">
                <button type="button" class="wdp-modal-close" aria-label="<?php echo esc_attr__('Modalı Kapat', 'woo-donation-popup'); ?>">&times;</button>
                <div class="wdp-modal-header">
                    <div class="wdp-modal-title-wrapper">
                        <span id="<?php echo esc_attr($modal_id); ?>-title" class="wdp-modal-title"><?php echo wp_kses_post($product_name); ?></span>
                        <?php if ($show_product_note): ?>
                        <div class="wdp-product-note <?php echo esc_attr($note_tone_class); ?>" role="note">
                            <span class="wdp-product-note__content">
                                <span class="wdp-product-note__icon" aria-hidden="true"><?php echo self::render_note_icon_svg($product_note_icon); ?></span>
                                <span class="wdp-product-note__body">
                                    <?php if ($is_long_note): ?>
                                    <input type="checkbox" id="<?php echo esc_attr($modal_note_toggle_id); ?>" class="wdp-product-note__toggle">
                                    <?php endif; ?>
                                    <span class="wdp-product-note__text"><?php echo esc_html($product_note_text); ?></span>
                                    <?php if ($is_long_note): ?>
                                    <label for="<?php echo esc_attr($modal_note_toggle_id); ?>" class="wdp-product-note__more">
                                        <span class="wdp-product-note__more-open"><?php echo esc_html__('Devamini Gor', 'woo-donation-popup'); ?></span>
                                        <span class="wdp-product-note__more-close"><?php echo esc_html__('Daha Az Goster', 'woo-donation-popup'); ?></span>
                                    </label>
                                    <?php endif; ?>
                                </span>
                            </span>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
                <div id="<?php echo esc_attr($modal_id); ?>-description" class="screen-reader-text"><?php echo esc_html(sprintf(__('%s için bağış formu', 'woo-donation-popup'), $product_name)); ?></div>
                
                <?php if ($enable_progress_bar): ?>
                <?php echo WDP_Progress_Form::render_progress_bar($product_id, $progress_bar_limit, $total_donation, true, $progress_min_price); ?>
                <?php endif; ?>
                
                <form method="post" action="" class="<?php echo esc_attr($allow_multiple_shares ? 'wdp-donation-form-fields wdp-has-shareholders' : ($enable_progress_bar ? 'wdp-donation-form-fields wdp-has-progress-bar' : 'wdp-donation-form-fields')); ?>">
                    <div class="wdp-form-error" style="display: none;"></div>

                    <?php if ($allow_multiple_shares): ?>
                    <!-- Çoklu Hisse Alanı -->
                    <div class="wdp-shares-section">
                        <div class="wdp-shares-header">
                            <label>Hisse Adedi:</label>
                            <div class="wdp-share-counter">
                                <button type="button" class="wdp-share-btn decrease"><span>-</span></button>
                                <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                                <button type="button" class="wdp-share-btn increase"><span>+</span></button>
                            </div>
                        </div>
                        <div class="wdp-shareholders-area">
                            <div class="wdp-shareholders-container">
                                <div class="wdp-shareholders-scroll">
                                <!-- Hissedar formları JavaScript ile eklenecek -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <?php elseif ($enable_progress_bar): ?>
                    <?php echo WDP_Progress_Form::render_form_fields(true, $progress_min_price); ?>
                    <?php else: ?>
                    <!-- Bağışçı Bilgileri -->
                    <?php echo WDP_Templates::render_donor_contact_stack(); ?>

                    <?php if ($allow_custom_price) : ?>
                    <div class="wdp-price-quantity-row wdp-custom-price-with-qty-row">
                        <div class="wdp-price-field wdp-custom-price-field">
                            <div class="wdp-custom-price-shell">
                                <span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($wdp_currency_symbol); ?></span>
                                <input type="number" name="custom_price" placeholder="<?php echo esc_attr($wdp_custom_price_placeholder); ?>" min="<?php echo esc_attr($min_price); ?>" step="1" required class="wdp-custom-price-input" inputmode="decimal" autocomplete="off">
                            </div>
                        </div>
                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>">+</button>
                        </div>
                    </div>
                    <?php else : ?>
                    <div class="wdp-price-quantity-row wdp-fixed-price-counter-row">
                        <div class="wdp-line-total-display" role="status" aria-live="polite">
                            <span class="screen-reader-text"><?php esc_html_e('Satır tutarı', 'woo-donation-popup'); ?></span>
                            <span class="wdp-line-total-value"><?php echo $formatted_price ? wp_kses_post($formatted_price) : '—'; ?></span>
                        </div>
                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>">+</button>
                        </div>
                    </div>
                    <?php endif; ?>
                    <?php endif; ?>

                    <!-- Butonlar -->
                    <?php
                    // Buton metinlerini ve düzenini ayarlardan al
                    $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
                        get_option('wdp_button_settings', array())
                    );
                    $button_text_add_to_cart = !empty($button_settings['button_text_add_to_cart']) ? $button_settings['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup');
                    $button_text_go_checkout = !empty($button_settings['button_text_go_checkout']) ? $button_settings['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup');
                    $form_button_order = !empty($button_settings['form_button_order']) ? $button_settings['form_button_order'] : 'add_first';
                    $form_button_alignment = !empty($button_settings['form_button_alignment']) ? $button_settings['form_button_alignment'] : 'left';
                    $button_group_classes = 'wdp-button-group wdp-button-align-' . esc_attr($form_button_alignment);
                    ?>
                    <div class="<?php echo $button_group_classes; ?>">
                        <?php if ($form_button_order === 'checkout_first') : ?>
                            <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
                            <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                        <?php else : ?>
                            <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                            <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
                        <?php endif; ?>
                    </div>

                    <!-- Gizli Alanlar -->
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product_id); ?>">
                    <input type="hidden" name="donation_modal" value="1">
                </form>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render donation form (direct, no modal)
     *
     * @param int   $product_id Product ID.
     * @param array $atts       Shortcode attributes.
     * @return string
     */
    public static function render_donation_form($product_id, $atts = array()) {
        // Ürün ID'sini integer'a çevir
        $product_id = intval($product_id);

        // Varsayılan değerler
        $defaults = array(
            'button_text' => __('Bağış Yap', 'woo-donation-popup'),
            'title' => '',
            'show_title' => 'yes',
            'class' => '',
        );

        $atts = wp_parse_args($atts, $defaults);

        // Ürünün varlığını kontrol et
        $product = wc_get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        // Ürün adını al
        $product_name = $product->get_name();
        
        // Ürün fiyatını al
        $product_price = $product->get_price();
        $formatted_price = $product_price ? WDP_Utils::format_price_html($product_price) : '';
        $enable_product_note = $product->get_meta('_enable_product_note') === 'yes';
        $product_note_text = trim((string) $product->get_meta('_product_note_text'));
        $product_note_icon = $product->get_meta('_product_note_icon');
        if ($product_note_icon === '') {
            $product_note_icon = 'info';
        }
        $show_product_note = $enable_product_note && $product_note_text !== '';
        $note_tone_class = self::get_note_tone_class($product_note_icon);
        $is_long_note = self::text_length($product_note_text) > 110;
        $direct_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-direct';

        // Özel başlık varsa onu kullan
        $title = !empty($atts['title']) ? sanitize_text_field($atts['title']) : $product_name;
        $show_title = ($atts['show_title'] === 'yes');

        // Benzersiz bir ID oluştur - popup ile aynı format
        $form_id = 'wdp-modal-' . $product_id . '-direct';
        $custom_class = sanitize_text_field($atts['class']);

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $allow_custom_price = $product->get_meta('_allow_custom_price') === 'yes';
        $min_price = $product->get_meta('_min_custom_price');

        // Eğer minimum fiyat yoksa ve özel fiyat aktifse, varsayılan olarak 0 kullan
        if ($allow_custom_price && $min_price === '') {
            $min_price = '0';
        }

        // OPTIMIZATION: WooCommerce get_meta() kullan (cache'lenmiş, daha hızlı)
        $allow_multiple_shares = $product->get_meta('_allow_multiple_shares') === 'yes';
        $max_shares = $product->get_meta('_max_shares');

        // Eğer maksimum hisse sayısı yoksa ve çoklu hisse aktifse, varsayılan olarak 7 kullan
        if ($allow_multiple_shares && $max_shares === '') {
            $max_shares = '7';
        }

        // Progress bar ayarları
        $enable_progress_bar = $product->get_meta('_enable_progress_bar') === 'yes';
        $progress_bar_limit = $product->get_meta('_progress_bar_limit');
        if ($progress_bar_limit === '') {
            $progress_bar_limit = '100000';
        }
        $progress_bar_limit = floatval($progress_bar_limit);
        
        // Progress bar formunda minimum fiyat kontrolü (ürün fiyatı veya min_custom_price)
        $progress_min_price = $min_price;
        if ($enable_progress_bar) {
            $product_base_price = floatval($product->get_price());
            if ($product_base_price > 0) {
                $progress_min_price = $min_price && floatval($min_price) > 0 ? min(floatval($min_price), $product_base_price) : $product_base_price;
            } else {
                $progress_min_price = $min_price && floatval($min_price) > 0 ? $min_price : '0';
            }
        }
        
        // Toplam bağış miktarını al
        $total_donation = 0.0;
        if ($enable_progress_bar) {
            $total_donation = WDP_Utils::get_total_donation_amount($product_id);
        }

        $wdp_currency_symbol = function_exists('get_woocommerce_currency_symbol') ? get_woocommerce_currency_symbol() : '₺';
        $wdp_custom_price_placeholder = (floatval($min_price) > 0)
            ? ('min: ' . WDP_Utils::format_amount_for_min_placeholder($min_price))
            : __('Bağış tutarı *', 'woo-donation-popup');

        // Form HTML'ini oluştur - popup ile aynı yapıyı kullan
        ob_start();
        ?>
        <div id="<?php echo esc_attr($form_id); ?>" class="wdp-donation-form <?php echo esc_attr($custom_class); ?>" data-product-id="<?php echo esc_attr($product_id); ?>" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>">
            <div class="wdp-modal-content">
                <?php if ($show_title): ?>
                <div class="wdp-form-title-wrapper">
                    <h2 class="wdp-form-title"><?php echo wp_kses_post($title); ?></h2>
                    <?php if ($show_product_note): ?>
                    <div class="wdp-product-note <?php echo esc_attr($note_tone_class); ?>" role="note">
                        <span class="wdp-product-note__content">
                            <span class="wdp-product-note__icon" aria-hidden="true"><?php echo self::render_note_icon_svg($product_note_icon); ?></span>
                            <span class="wdp-product-note__body">
                                <?php if ($is_long_note): ?>
                                <input type="checkbox" id="<?php echo esc_attr($direct_note_toggle_id); ?>" class="wdp-product-note__toggle">
                                <?php endif; ?>
                                <span class="wdp-product-note__text"><?php echo esc_html($product_note_text); ?></span>
                                <?php if ($is_long_note): ?>
                                <label for="<?php echo esc_attr($direct_note_toggle_id); ?>" class="wdp-product-note__more">
                                    <span class="wdp-product-note__more-open"><?php echo esc_html__('Devamini Gor', 'woo-donation-popup'); ?></span>
                                    <span class="wdp-product-note__more-close"><?php echo esc_html__('Daha Az Goster', 'woo-donation-popup'); ?></span>
                                </label>
                                <?php endif; ?>
                            </span>
                        </span>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <?php if ($enable_progress_bar): ?>
                <?php echo WDP_Progress_Form::render_progress_bar($product_id, $progress_bar_limit, $total_donation, true, $progress_min_price); ?>
                <?php endif; ?>

                <form method="post" action="" class="<?php echo esc_attr($allow_multiple_shares ? 'wdp-donation-form-fields wdp-has-shareholders' : ($enable_progress_bar ? 'wdp-donation-form-fields wdp-has-progress-bar' : 'wdp-donation-form-fields')); ?>">
                    <div class="wdp-form-error" style="display: none;"></div>

                    <?php if ($allow_multiple_shares): ?>
                    <!-- Çoklu Hisse Alanı -->
                    <div class="wdp-shares-section">
                        <div class="wdp-shares-header">
                            <label>Hisse Adedi:</label>
                            <div class="wdp-share-counter">
                                <button type="button" class="wdp-share-btn decrease"><span>-</span></button>
                                <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                                <button type="button" class="wdp-share-btn increase"><span>+</span></button>
                            </div>
                        </div>
                        <div class="wdp-shareholders-area">
                            <div class="wdp-shareholders-container">
                                <div class="wdp-shareholders-scroll">
                                <!-- Hissedar formları JavaScript ile eklenecek -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <?php elseif ($enable_progress_bar): ?>
                    <?php echo WDP_Progress_Form::render_form_fields(true, $progress_min_price); ?>
                    <?php else: ?>
                    <!-- Bağışçı Bilgileri -->
                    <?php echo WDP_Templates::render_donor_contact_stack(); ?>

                    <?php if ($allow_custom_price) : ?>
                    <div class="wdp-price-quantity-row wdp-custom-price-with-qty-row">
                        <div class="wdp-price-field wdp-custom-price-field">
                            <div class="wdp-custom-price-shell">
                                <span class="wdp-custom-price-currency" aria-hidden="true"><?php echo esc_html($wdp_currency_symbol); ?></span>
                                <input type="number" name="custom_price" placeholder="<?php echo esc_attr($wdp_custom_price_placeholder); ?>" min="<?php echo esc_attr($min_price); ?>" step="1" required class="wdp-custom-price-input" inputmode="decimal" autocomplete="off">
                            </div>
                        </div>
                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>">+</button>
                        </div>
                    </div>
                    <?php else : ?>
                    <div class="wdp-price-quantity-row wdp-fixed-price-counter-row">
                        <div class="wdp-line-total-display" role="status" aria-live="polite">
                            <span class="screen-reader-text"><?php esc_html_e('Satır tutarı', 'woo-donation-popup'); ?></span>
                            <span class="wdp-line-total-value"><?php echo $formatted_price ? wp_kses_post($formatted_price) : '—'; ?></span>
                        </div>
                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="<?php echo esc_attr__('Azalt', 'woo-donation-popup'); ?>">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="<?php echo esc_attr__('Arttır', 'woo-donation-popup'); ?>">+</button>
                        </div>
                    </div>
                    <?php endif; ?>
                    <?php endif; ?>

                    <!-- Butonlar -->
                    <?php
                    // Buton metinlerini ve düzenini ayarlardan al
                    $button_settings = WDP_Utils::normalize_legacy_popup_button_text(
                        get_option('wdp_button_settings', array())
                    );
                    $button_text_add_to_cart = !empty($button_settings['button_text_add_to_cart']) ? $button_settings['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup');
                    $button_text_go_checkout = !empty($button_settings['button_text_go_checkout']) ? $button_settings['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup');
                    $form_button_order = !empty($button_settings['form_button_order']) ? $button_settings['form_button_order'] : 'add_first';
                    $form_button_alignment = !empty($button_settings['form_button_alignment']) ? $button_settings['form_button_alignment'] : 'left';
                    $button_group_classes = 'wdp-button-group wdp-button-align-' . esc_attr($form_button_alignment);
                    ?>
                    <div class="<?php echo $button_group_classes; ?>">
                        <?php if ($form_button_order === 'checkout_first') : ?>
                            <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
                            <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                        <?php else : ?>
                            <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                            <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
                        <?php endif; ?>
                    </div>

                    <!-- Gizli Alanlar -->
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product_id); ?>">
                    <input type="hidden" name="donation_modal" value="1">
                </form>
            </div>
        </div>

        <script>
        document.addEventListener('DOMContentLoaded', function() {
            var formContainer = document.getElementById('<?php echo esc_js($form_id); ?>');
            if (!formContainer) return;

            var form = formContainer.querySelector('form');
            if (!form) return;

            var productId = formContainer.getAttribute('data-product-id');

            function wdpInlineDebugLog(msg) {
                if (window.wdp_ajax && window.wdp_ajax.debug) {
                    console.log(msg);
                }
            }

            function wdpRunWhenReady(getSetup, run, waitMsg, timeoutMsg) {
                var setup = getSetup();
                if (setup && typeof setup === 'function') {
                    run(setup);
                    return;
                }
                wdpInlineDebugLog(waitMsg);
                var attempts = 0;
                var id = setInterval(function() {
                    attempts++;
                    setup = getSetup();
                    if (setup && typeof setup === 'function') {
                        run(setup);
                        clearInterval(id);
                    } else if (attempts >= 50) {
                        wdpInlineDebugLog(timeoutMsg);
                        clearInterval(id);
                    }
                }, 100);
            }

            wdpRunWhenReady(
                function() {
                    var m = window.WDPApp && window.WDPApp.shareholder;
                    return m && typeof m.setup === 'function' ? m.setup : null;
                },
                function(setup) { setup(formContainer, productId); },
                'WDP: setupShareholderForms not available yet, will retry...',
                'WDP: setupShareholderForms timeout after 5 seconds'
            );

            wdpRunWhenReady(
                function() {
                    var m = window.WDPApp && window.WDPApp.form;
                    return m && typeof m.setup === 'function' ? m.setup : null;
                },
                function(setup) { setup(form); },
                'WDP: setupFormSubmission not available yet, will retry...',
                'WDP: setupFormSubmission timeout after 5 seconds'
            );
        });
        </script>
        <?php
        return ob_get_clean();
    }
}

