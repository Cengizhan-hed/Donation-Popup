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
     * Ürün notu metni (görünüm CSS ile sabitlenir).
     *
     * @param array $context Product form context.
     * @return array{text:string}
     */
    private static function resolve_product_note_display(array $context) {
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
    private static function render_product_note_block(array $display, $toggle_id = '', $is_long = false) {
        if (empty($display['text'])) {
            return '';
        }

        ob_start();
        ?>
        <div class="wdp-product-note" role="note">
            <div class="wdp-product-note__content">
                <div class="wdp-product-note__body">
                    <?php if ($is_long && $toggle_id !== '') : ?>
                    <input type="checkbox" id="<?php echo esc_attr($toggle_id); ?>" class="wdp-product-note__toggle">
                    <?php endif; ?>
                    <p class="wdp-product-note__text"><?php echo esc_html($display['text']); ?></p>
                    <?php if ($is_long && $toggle_id !== '') : ?>
                    <label for="<?php echo esc_attr($toggle_id); ?>" class="wdp-product-note__more">
                        <span class="wdp-product-note__more-open"><?php echo esc_html__('Devamini Gor', 'woo-donation-popup'); ?></span>
                        <span class="wdp-product-note__more-close"><?php echo esc_html__('Daha Az Goster', 'woo-donation-popup'); ?></span>
                    </label>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php
        return trim(ob_get_clean());
    }

    /**
     * Hisseli formlar: toplam tutar çubuğu (butonların üstü).
     *
     * @return string Safe HTML.
     */
    private static function render_shares_total_bar() {
        ob_start();
        ?>
        <div class="wdp-shares-total-bar" aria-live="polite" hidden>
            <span class="wdp-shares-total-bar__label"><?php echo esc_html__('Toplam Tutar', 'woo-donation-popup'); ?></span>
            <span class="wdp-shares-total-bar__value">—</span>
        </div>
        <?php
        return trim(ob_get_clean());
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
     * Allowed tags for form action button SVG icons.
     *
     * @return array<string, array<string, bool>>
     */
    private static function form_button_svg_kses() {
        return array(
            'svg'      => array(
                'class'           => true,
                'viewbox'         => true,
                'xmlns'           => true,
                'fill'            => true,
                'aria-hidden'     => true,
                'focusable'       => true,
            ),
            'path'     => array(
                'd'               => true,
                'fill'            => true,
                'stroke'          => true,
                'stroke-width'    => true,
                'stroke-linecap'  => true,
                'stroke-linejoin' => true,
            ),
            'rect'     => array(
                'x'               => true,
                'y'               => true,
                'width'           => true,
                'height'          => true,
                'rx'              => true,
                'fill'            => true,
                'stroke'          => true,
                'stroke-width'    => true,
            ),
            'circle'   => array(
                'cx'              => true,
                'cy'              => true,
                'r'               => true,
                'fill'            => true,
                'stroke'          => true,
                'stroke-width'    => true,
            ),
            'polyline' => array(
                'points'          => true,
                'fill'            => true,
                'stroke'          => true,
                'stroke-width'    => true,
                'stroke-linecap'  => true,
                'stroke-linejoin' => true,
            ),
        );
    }

    /**
     * Sepete ekle — alışveriş arabası (stroke, yuvarlatılmış).
     *
     * @return string Safe HTML.
     */
    public static function get_form_button_icon_cart_svg() {
        $svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
            . '<path d="M2.25 3h1.9l2.05 11.58a1.85 1.85 0 0 0 1.82 1.52h8.68a1.85 1.85 0 0 0 1.8-1.38L20.75 6.5H7.1" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>'
            . '<circle cx="9.25" cy="19.25" r="1.35" fill="currentColor" stroke="none"/>'
            . '<circle cx="17.25" cy="19.25" r="1.35" fill="currentColor" stroke="none"/>'
            . '</svg>';

        return wp_kses($svg, self::form_button_svg_kses());
    }

    /**
     * Ödemeye git — kalkan + onay (güvenli tamamlama).
     *
     * @return string Safe HTML.
     */
    public static function get_form_button_icon_checkout_svg() {
        $svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
            . '<path d="M12 3.25 18.25 6.4v5.35c0 3.72-2.55 6.72-6.25 8-3.7-1.28-6.25-4.28-6.25-8V6.4L12 3.25z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/>'
            . '<path d="M8.6 12.15 10.65 14.2 15.55 9.3" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>'
            . '</svg>';

        return wp_kses($svg, self::form_button_svg_kses());
    }

    /**
     * Bağışa devam — hediye kutusu (bağış teması).
     *
     * @return string Safe HTML.
     */
    public static function get_form_button_icon_continue_svg() {
        $svg = '<svg class="wdp-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
            . '<rect x="4.25" y="10.25" width="15.5" height="9.5" rx="1.75" stroke="currentColor" stroke-width="1.65"/>'
            . '<path d="M12 10.25V19.75M4.25 10.25h15.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>'
            . '<path d="M12 10.25c0-2.35-1.85-4.25-4.25-4.25S3.5 7.9 3.5 10.25s1.85 4.25 4.25 4.25M12 10.25c0-2.35 1.85-4.25 4.25-4.25s4.25 1.9 4.25 4.25-1.85 4.25-4.25 4.25" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>'
            . '<path d="M12 10.25V6.75" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>'
            . '</svg>';

        return wp_kses($svg, self::form_button_svg_kses());
    }

    /**
     * Form altı aksiyon butonu (ikon + metin).
     *
     * @param string $name  donation_add_to_cart | donation_go_checkout.
     * @param string $class wdp-btn-primary | wdp-btn-secondary.
     * @param string $label Visible label.
     * @return string Safe HTML.
     */
    private static function render_form_action_button($name, $class, $label) {
        $icon = $name === 'donation_go_checkout'
            ? self::get_form_button_icon_checkout_svg()
            : self::get_form_button_icon_cart_svg();

        return sprintf(
            '<button type="submit" class="%1$s" name="%2$s"><span class="wdp-btn__inner">%3$s<span class="wdp-btn__label">%4$s</span></span></button>',
            esc_attr($class),
            esc_attr($name),
            $icon,
            esc_html($label)
        );
    }

    /**
     * Sepete ekle + ödemeye git buton grubu.
     *
     * @param bool   $checkout_first Checkout button first.
     * @param string $text_add_to_cart Add to cart label.
     * @param string $text_go_checkout Checkout label.
     * @return void
     */
    private static function render_form_action_buttons($checkout_first, $text_add_to_cart, $text_go_checkout) {
        if ($checkout_first) {
            echo self::render_form_action_button('donation_go_checkout', 'wdp-btn-primary', $text_go_checkout);
            echo self::render_form_action_button('donation_add_to_cart', 'wdp-btn-secondary', $text_add_to_cart);
            return;
        }

        echo self::render_form_action_button('donation_add_to_cart', 'wdp-btn-secondary', $text_add_to_cart);
        echo self::render_form_action_button('donation_go_checkout', 'wdp-btn-primary', $text_go_checkout);
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
            <div class="wdp-field-stack__row wdp-field-stack__row--name">
                <span class="wdp-field-stack__icon"><?php echo self::field_stack_icon_user_svg(); ?></span>
                <input type="text" class="wdp-field-stack__input" name="donation_full_name" placeholder="<?php echo esc_attr__( 'Ad Soyad *', 'woo-donation-popup' ); ?>" required autocomplete="name" />
            </div>
            <div class="wdp-field-stack__row wdp-field-stack__row--phone">
                <div class="wdp-field-stack__phone">
                    <?php echo WDP_Phone_Field::render(); ?>
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
     * @param string $display_mode  popup|side_panel.
     * @return string
     */
    public static function render_donation_modal($product_id, $button_text = '', $custom_class = '', $custom_style = '', $display_mode = 'popup') {
        // Ürün ID'sini integer'a çevir
        $product_id = absint($product_id);

        // Ürünün varlığını kontrol et
        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
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

        $context = WDP_Donation_Product_Context_Service::build_form_context($product);
        $product_name = $context['product_name'];
        $product_price = $context['product_price'];
        $formatted_price = $context['formatted_price'];
        $enable_product_note = $context['enable_product_note'];
        $product_note_text = $context['product_note_text'];
        $show_product_note = $enable_product_note && $product_note_text !== '';
        $is_long_note = self::text_length($product_note_text) > 110;
        $modal_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-modal';

        // Benzersiz bir ID oluştur (popup ve sağ panel aynı sayfada çakışmasın)
        $use_side_panel   = ($display_mode === 'side_panel');
        $modal_id         = $use_side_panel ? ('wdp-side-panel-' . $product_id) : ('wdp-modal-' . $product_id);
        $modal_mode_class = $use_side_panel ? ' wdp-side-panel' : '';
        $allow_custom_price = $context['allow_custom_price'];
        $min_price = $context['min_price'];
        $allow_multiple_shares = $context['allow_multiple_shares'];
        $max_shares = $context['max_shares'];
        $enable_progress_bar = $context['enable_progress_bar'];
        $progress_bar_limit = $context['progress_bar_limit'];
        $progress_min_price = $context['progress_min_price'];
        $total_donation = $context['total_donation'];
        $wdp_currency_symbol = $context['currency_symbol'];
        $wdp_custom_price_placeholder = $context['custom_price_placeholder'];
        $title_style_attr = class_exists('WDP_Category_Title_Color_Service')
            ? WDP_Category_Title_Color_Service::get_title_style_attr($product_id)
            : '';

        // Assets'i zorla yükle
        WDP_Assets::force_enqueue();

        ob_start();
        ?>
        <!-- Modal -->
        <div id="<?php echo esc_attr($modal_id); ?>" class="hdf-donation-modal-wrapper wdp-modal<?php echo esc_attr($modal_mode_class); ?><?php echo $custom_class !== '' ? ' ' . esc_attr($custom_class) : ''; ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modal_id); ?>-title" aria-describedby="<?php echo esc_attr($modal_id); ?>-description" data-product-id="<?php echo esc_attr($product_id); ?>" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>"<?php echo $use_side_panel ? ' data-wdp-open-mode="side-panel"' : ''; ?> style="display:none;visibility:hidden;opacity:0;">
            <div class="wdp-modal-content<?php echo $use_side_panel ? ' wdp-side-panel-content' : ''; ?>">
                <button type="button" class="wdp-modal-close" aria-label="<?php echo esc_attr__('Modalı Kapat', 'woo-donation-popup'); ?>">&times;</button>
                <div class="wdp-modal-header">
                    <div class="wdp-modal-title-wrapper">
                        <span id="<?php echo esc_attr($modal_id); ?>-title" class="wdp-modal-title"<?php echo $title_style_attr; ?>><?php echo wp_kses_post($product_name); ?></span>
                        <?php if ($show_product_note) : ?>
                        <?php echo self::render_product_note_block(self::resolve_product_note_display($context), $modal_note_toggle_id, $is_long_note); ?>
                        <?php endif; ?>
                    </div>
                </div>
                <div id="<?php echo esc_attr($modal_id); ?>-description" class="screen-reader-text"><?php echo esc_html(sprintf(__('%s için bağış formu', 'woo-donation-popup'), $product_name)); ?></div>
                
                <?php if ($enable_progress_bar): ?>
                <?php echo WDP_Progress_Form::render_progress_bar($product_id, $progress_bar_limit, $total_donation, true, $progress_min_price); ?>
                <?php endif; ?>
                
                <?php
                $form_field_classes = $allow_multiple_shares ? 'wdp-donation-form-fields wdp-has-shareholders' : ($enable_progress_bar ? 'wdp-donation-form-fields wdp-has-progress-bar' : 'wdp-donation-form-fields');
                if ($use_side_panel) {
                    $form_field_classes .= ' wdp-side-panel-form';
                }
                $side_panel_main_class = 'wdp-side-panel-main';
                if ($allow_multiple_shares) {
                    $side_panel_main_class .= ' wdp-side-panel-main--shares';
                }
                ?>
                <form method="post" action="" class="<?php echo esc_attr($form_field_classes); ?>">
                    <div class="wdp-form-error" style="display: none;"></div>

                    <?php if ($use_side_panel) : ?>
                    <div class="<?php echo esc_attr($side_panel_main_class); ?>">
                    <?php endif; ?>

                    <?php if ($allow_multiple_shares): ?>
                    <!-- Çoklu Hisse Alanı -->
                    <div class="wdp-shares-section">
                        <div class="wdp-shares-header">
                            <label>Hisse Adedi:</label>
                            <div class="wdp-share-counter">
                                <button type="button" class="wdp-share-btn wdp-share-btn-decrease"><span>-</span></button>
                                <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                                <button type="button" class="wdp-share-btn wdp-share-btn-increase"><span>+</span></button>
                            </div>
                        </div>
                        <div class="wdp-shareholders-area wdp-shareholders-area--with-rail">
                            <div class="wdp-shareholders-container">
                                <aside class="wdp-shareholders-rail" aria-label="<?php echo esc_attr__('Hisse adımları', 'woo-donation-popup'); ?>">
                                    <div class="wdp-shareholders-rail__inner">
                                        <span class="wdp-shareholders-rail__line" aria-hidden="true"></span>
                                        <div class="wdp-shareholders-step-rail" role="group"></div>
                                    </div>
                                </aside>
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

                    <?php if ($use_side_panel) : ?>
                    </div>
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
                    if ($use_side_panel) {
                        $button_group_classes .= ' wdp-side-panel-form-footer';
                    }
                    $side_panel_checkout_first = $use_side_panel || $form_button_order === 'checkout_first';
                    ?>
                    <?php if ($use_side_panel) : ?>
                    <div class="wdp-side-panel-footer-zone">
                    <?php endif; ?>
                    <?php if ($allow_multiple_shares) : ?>
                    <?php echo self::render_shares_total_bar(); ?>
                    <?php endif; ?>
                    <div class="<?php echo $button_group_classes; ?>">
                        <?php self::render_form_action_buttons($side_panel_checkout_first, $button_text_add_to_cart, $button_text_go_checkout); ?>
                    </div>
                    <?php if ($use_side_panel) : ?>
                    </div>
                    <?php endif; ?>
                    <!-- Gizli Alanlar -->
                    <input type="hidden" name="wdp_product_id" value="<?php echo esc_attr($product_id); ?>">
                    <input type="hidden" name="donation_modal" value="1">
                    <?php wp_nonce_field('wdp_nonajax_add_to_cart', 'wdp_nonce'); ?>
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
        $product_id = absint($product_id);

        // Varsayılan değerler
        $defaults = array(
            'button_text' => __('Bağış Yap', 'woo-donation-popup'),
            'title' => '',
            'show_title' => 'yes',
            'class' => '',
        );

        $atts = wp_parse_args($atts, $defaults);

        // Ürünün varlığını kontrol et
        $product = WDP_Donation_Product_Context_Service::get_product($product_id);
        if (!$product) {
            if (current_user_can('manage_options')) {
                return '<p style="color:red;">Ürün bulunamadı (ID: ' . esc_html($product_id) . '). Lütfen ürün ID\'sini kontrol edin.</p>';
            }
            return '';
        }

        $context = WDP_Donation_Product_Context_Service::build_form_context($product);
        $product_name = $context['product_name'];
        $product_price = $context['product_price'];
        $formatted_price = $context['formatted_price'];
        $enable_product_note = $context['enable_product_note'];
        $product_note_text = $context['product_note_text'];
        $show_product_note = $enable_product_note && $product_note_text !== '';
        $is_long_note = self::text_length($product_note_text) > 110;
        $direct_note_toggle_id = 'wdp-note-toggle-' . $product_id . '-direct';

        // Özel başlık varsa onu kullan
        $title = !empty($atts['title']) ? sanitize_text_field($atts['title']) : $product_name;
        $show_title = ($atts['show_title'] === 'yes');

        // Benzersiz bir ID oluştur - popup ile aynı format
        $form_id = 'wdp-modal-' . $product_id . '-direct';
        $custom_class = sanitize_text_field($atts['class']);

        $allow_custom_price = $context['allow_custom_price'];
        $min_price = $context['min_price'];
        $allow_multiple_shares = $context['allow_multiple_shares'];
        $max_shares = $context['max_shares'];
        $enable_progress_bar = $context['enable_progress_bar'];
        $progress_bar_limit = $context['progress_bar_limit'];
        $progress_min_price = $context['progress_min_price'];
        $total_donation = $context['total_donation'];
        $wdp_currency_symbol = $context['currency_symbol'];
        $wdp_custom_price_placeholder = $context['custom_price_placeholder'];
        $title_style_attr = class_exists('WDP_Category_Title_Color_Service')
            ? WDP_Category_Title_Color_Service::get_title_style_attr($product_id)
            : '';

        // Form HTML'ini oluştur - popup ile aynı yapıyı kullan
        ob_start();
        ?>
        <div id="<?php echo esc_attr($form_id); ?>" class="hdf-donation-modal-wrapper wdp-donation-form <?php echo esc_attr($custom_class); ?>" data-product-id="<?php echo esc_attr($product_id); ?>" data-wdp-unit-price="<?php echo esc_attr($product_price !== '' ? $product_price : ''); ?>">
            <div class="wdp-modal-content">
                <?php if ($show_title): ?>
                <div class="wdp-form-title-wrapper">
                    <h2 class="wdp-form-title"<?php echo $title_style_attr; ?>><?php echo wp_kses_post($title); ?></h2>
                    <?php if ($show_product_note) : ?>
                    <?php echo self::render_product_note_block(self::resolve_product_note_display($context), $direct_note_toggle_id, $is_long_note); ?>
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
                                <button type="button" class="wdp-share-btn wdp-share-btn-decrease"><span>-</span></button>
                                <input type="number" name="share_count" value="1" min="1" max="<?php echo esc_attr($max_shares); ?>" readonly>
                                <button type="button" class="wdp-share-btn wdp-share-btn-increase"><span>+</span></button>
                            </div>
                        </div>
                        <div class="wdp-shareholders-area wdp-shareholders-area--with-rail">
                            <div class="wdp-shareholders-container">
                                <aside class="wdp-shareholders-rail" aria-label="<?php echo esc_attr__('Hisse adımları', 'woo-donation-popup'); ?>">
                                    <div class="wdp-shareholders-rail__inner">
                                        <span class="wdp-shareholders-rail__line" aria-hidden="true"></span>
                                        <div class="wdp-shareholders-step-rail" role="group"></div>
                                    </div>
                                </aside>
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
                    <?php if ($allow_multiple_shares) : ?>
                    <?php echo self::render_shares_total_bar(); ?>
                    <?php endif; ?>
                    <div class="<?php echo $button_group_classes; ?>">
                        <?php self::render_form_action_buttons($form_button_order === 'checkout_first', $button_text_add_to_cart, $button_text_go_checkout); ?>
                    </div>
                    <!-- Gizli Alanlar -->
                    <input type="hidden" name="wdp_product_id" value="<?php echo esc_attr($product_id); ?>">
                    <input type="hidden" name="donation_modal" value="1">
                    <?php wp_nonce_field('wdp_nonajax_add_to_cart', 'wdp_nonce'); ?>
                </form>
            </div>
        </div>

        <?php
        return ob_get_clean();
    }
}

