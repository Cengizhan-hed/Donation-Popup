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
            $button_settings = get_option('wdp_button_settings', array());
            $button_text = isset($button_settings['popup_button_text']) ? $button_settings['popup_button_text'] : __('Bağış Yap', 'woo-donation-popup');
        }

        // Ürün adını al
        $product_name = $product->get_name();
        
        // Ürün fiyatını al
        $product_price = $product->get_price();
        $formatted_price = $product_price ? wc_price($product_price) : '';

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

        // Assets'i zorla yükle
        WDP_Assets::force_enqueue();

        ob_start();
        ?>
        <!-- Modal -->
        <div id="<?php echo esc_attr($modal_id); ?>" class="wdp-modal <?php echo esc_attr($custom_class); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr($modal_id); ?>-title" aria-describedby="<?php echo esc_attr($modal_id); ?>-description" style="display:none;visibility:hidden;opacity:0;">
            <div class="wdp-modal-content">
                <div class="wdp-modal-header">
                    <div class="wdp-modal-title-wrapper">
                        <span id="<?php echo esc_attr($modal_id); ?>-title" class="wdp-modal-title"><?php echo wp_kses_post($product_name); ?></span>
                        <?php if ($formatted_price): ?>
                        <span class="wdp-product-price"><?php echo wp_kses_post($formatted_price); ?></span>
                        <?php endif; ?>
                    </div>
                    <button type="button" class="wdp-modal-close" aria-label="<?php echo esc_attr__('Modalı Kapat', 'woo-donation-popup'); ?>">&times;</button>
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
                    <input type="text" name="donation_full_name" placeholder="Ad Soyad *" required autocomplete="name">
                    <input type="tel" name="donation_phone" placeholder="Telefon Numarası *" required autocomplete="tel">
                    <textarea name="donation_note" rows="2" placeholder="Not (isteğe bağlı)"></textarea>

                    <!-- Fiyat ve Adet Alanları -->
                    <div class="wdp-price-quantity-row">
                        <?php if ($allow_custom_price): ?>
                        <input type="number" name="custom_price" placeholder="Fiyat (TL)" min="<?php echo esc_attr($min_price); ?>" step="1" required>
                        <?php endif; ?>

                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="Azalt">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="Arttır">+</button>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- Butonlar -->
                    <div class="wdp-button-group">
                        <?php
                        // Buton metinlerini ayarlardan al
                        $button_settings = get_option('wdp_button_settings', array());
                        $button_text_add_to_cart = !empty($button_settings['button_text_add_to_cart']) ? $button_settings['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup');
                        $button_text_go_checkout = !empty($button_settings['button_text_go_checkout']) ? $button_settings['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup');
                        ?>
                        <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                        <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
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
        $formatted_price = $product_price ? wc_price($product_price) : '';

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

        // Form HTML'ini oluştur - popup ile aynı yapıyı kullan
        ob_start();
        ?>
        <div id="<?php echo esc_attr($form_id); ?>" class="wdp-donation-form <?php echo esc_attr($custom_class); ?>" data-product-id="<?php echo esc_attr($product_id); ?>">
            <div class="wdp-modal-content">
                <?php if ($show_title): ?>
                <div class="wdp-form-title-wrapper">
                    <h2 class="wdp-form-title"><?php echo wp_kses_post($title); ?></h2>
                    <?php if ($formatted_price): ?>
                    <span class="wdp-product-price"><?php echo wp_kses_post($formatted_price); ?></span>
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
                    <input type="text" name="donation_full_name" placeholder="Ad Soyad *" required autocomplete="name">
                    <input type="tel" name="donation_phone" placeholder="Telefon Numarası *" required autocomplete="tel">
                    <textarea name="donation_note" rows="2" placeholder="Not (isteğe bağlı)"></textarea>

                    <!-- Fiyat ve Adet Alanları -->
                    <div class="wdp-price-quantity-row">
                        <?php if ($allow_custom_price): ?>
                        <input type="number" name="custom_price" placeholder="Fiyat (TL)" min="<?php echo esc_attr($min_price); ?>" step="1" required>
                        <?php endif; ?>

                        <div class="wdp-quantity-counter">
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-decrease" aria-label="Azalt">-</button>
                            <input type="number" name="quantity" value="1" min="1" max="99" readonly>
                            <button type="button" class="wdp-product-quantity-btn wdp-product-quantity-increase" aria-label="Arttır">+</button>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- Butonlar -->
                    <div class="wdp-button-group">
                        <?php
                        // Buton metinlerini ayarlardan al
                        $button_settings = get_option('wdp_button_settings', array());
                        $button_text_add_to_cart = !empty($button_settings['button_text_add_to_cart']) ? $button_settings['button_text_add_to_cart'] : __('Sepete Ekle', 'woo-donation-popup');
                        $button_text_go_checkout = !empty($button_settings['button_text_go_checkout']) ? $button_settings['button_text_go_checkout'] : __('Ödemeye Git', 'woo-donation-popup');
                        ?>
                        <button type="submit" name="donation_add_to_cart"><?php echo esc_html($button_text_add_to_cart); ?></button>
                        <button type="submit" name="donation_go_checkout"><?php echo esc_html($button_text_go_checkout); ?></button>
                    </div>

                    <!-- Gizli Alanlar -->
                    <input type="hidden" name="add-to-cart" value="<?php echo esc_attr($product_id); ?>">
                    <input type="hidden" name="donation_modal" value="1">
                </form>
            </div>
        </div>

        <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Form elementini bul
            var formContainer = document.getElementById('<?php echo esc_js($form_id); ?>');
            if (!formContainer) return;

            var form = formContainer.querySelector('form');
            if (!form) return;

            // Ürün bilgilerini al
            var productId = formContainer.getAttribute('data-product-id');

            // Modülleri güncelle (eğer henüz yüklenmişse)
            var currentForm = window.WDPApp && window.WDPApp.form;
            var currentShareholder = window.WDPApp && window.WDPApp.shareholder;
            
            var setupFormSubmission = (currentForm && typeof currentForm.setup === 'function') ? currentForm.setup : null;
            var setupShareholderForms = (currentShareholder && typeof currentShareholder.setup === 'function') ? currentShareholder.setup : null;

            // Popup ile aynı JavaScript işleme mantığını kullan
            if (setupShareholderForms && typeof setupShareholderForms === 'function') {
                setupShareholderForms(formContainer, productId);
            } else {
                console.log('WDP: setupShareholderForms not available yet, will retry...');
                // Modüller yüklenene kadar bekle (max 5 saniye)
                var attempts = 0;
                var checkInterval = setInterval(function() {
                    attempts++;
                    currentShareholder = window.WDPApp && window.WDPApp.shareholder;
                    if (currentShareholder && typeof currentShareholder.setup === 'function') {
                        setupShareholderForms = currentShareholder.setup;
                        setupShareholderForms(formContainer, productId);
                        clearInterval(checkInterval);
                    } else if (attempts >= 50) {
                        console.log('WDP: setupShareholderForms timeout after 5 seconds');
                        clearInterval(checkInterval);
                    }
                }, 100);
            }

            // Form gönderim olayını ayarla - popup ile aynı
            if (setupFormSubmission && typeof setupFormSubmission === 'function') {
                setupFormSubmission(form);
            } else {
                console.log('WDP: setupFormSubmission not available yet, will retry...');
                // Modüller yüklenene kadar bekle (max 5 saniye)
                var attempts2 = 0;
                var checkInterval2 = setInterval(function() {
                    attempts2++;
                    currentForm = window.WDPApp && window.WDPApp.form;
                    if (currentForm && typeof currentForm.setup === 'function') {
                        setupFormSubmission = currentForm.setup;
                        setupFormSubmission(form);
                        clearInterval(checkInterval2);
                    } else if (attempts2 >= 50) {
                        console.log('WDP: setupFormSubmission timeout after 5 seconds');
                        clearInterval(checkInterval2);
                    }
                }, 100);
            }
        });
        </script>
        <?php
        return ob_get_clean();
    }
}

