<?php
/**
 * Yalnız yerel e2e (E8N): Elementor Pro DOM işaretlerini TAKLİT EDEN şablon simülasyonu.
 *
 * Gerçek Elementor Pro yerelde kurulamaz (lisanslı). Bu dosya yalnız testin seçicilerini ve atlama mantığını
 * kanıtlamak içindir; eklentiye Elementor bilgisi eklemez ve üretim paketine girmez.
 * `wdp-exp-sim.php` + `wdp-sc-sim.php` + `wdp-da-sim.php` ile birlikte yüklenir (yan sepet ve bağışçı hesabı açık).
 *
 *   ?dp_elsim=0   -> işaretler YOK (atlama mantığı sınanır)
 *
 * Taklit edilenler: ürün şablonu sarmalayıcısı, Cart/Checkout/My Account widget sarmalayıcıları, Menu Cart widget'ı
 * (aç/kapa, sayaç, `woocommerce_add_to_cart_fragments` parçası). Başlıkta eklentinin kısa kodları da yer alır.
 */
add_action(
	'template_redirect',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( isset( $_GET['dp_elsim'] ) && '0' === $_GET['dp_elsim'] ) {
			return;
		}
		if ( wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || isset( $_GET['wc-ajax'] ) || isset( $_GET['dp_sc_add'] ) || isset( $_GET['dp_da_seed'] ) ) {
			return;
		}
		// phpcs:enable
		ob_start(
			static function ( $html ) {
				if ( false === stripos( (string) $html, '<body' ) ) {
					return $html;
				}
				$type = 'wp-page';
				$cls  = 'elementor';
				if ( function_exists( 'is_product' ) && is_product() ) {
					$type = 'product';
					$cls .= ' elementor-location-single';
				} elseif ( function_exists( 'is_cart' ) && is_cart() ) {
					$cls .= ' elementor-widget-woocommerce-cart';
				} elseif ( function_exists( 'is_checkout' ) && is_checkout() ) {
					$cls .= ' elementor-widget-woocommerce-checkout-page';
				} elseif ( function_exists( 'is_account_page' ) && is_account_page() ) {
					$cls .= ' elementor-widget-woocommerce-my-account';
				}
				$count  = ( function_exists( 'WC' ) && WC()->cart ) ? (int) WC()->cart->get_cart_contents_count() : 0;
				$header = '<header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;gap:8px">'
					. '<b>Site</b>'
					. do_shortcode( '[donation_panel_side_cart]' )
					. do_shortcode( '[donation_panel_account]' )
					. wdp_elsim_menu_cart( $count )
					. '</header>';
				$open   = '<div data-elementor-type="' . esc_attr( $type ) . '" class="' . esc_attr( $cls ) . '">';
				$html   = preg_replace( '/(<body[^>]*>)/i', '$1' . str_replace( '$', '\\$', $header . $open ), (string) $html, 1 );
				return preg_replace( '#</body>#i', '</div></body>', (string) $html, 1 );
			}
		);
	},
	0
);

/**
 * Elementor Menu Cart widget'ının işaret sınıflarını taşıyan sade çıktı (taklit).
 *
 * @param int $count Sepet öğe sayısı.
 * @return string
 */
function wdp_elsim_menu_cart( $count ) {
	$count = (int) $count;
	return '<div class="elementor-widget-woocommerce-menu-cart"><div class="elementor-menu-cart__wrapper">'
		. '<a class="elementor-menu-cart__toggle_button" href="#" role="button" aria-expanded="false" style="padding:8px">Sepet '
		. '<span class="elementor-button-icon-qty" data-counter="' . $count . '">' . $count . '</span></a>'
		. '<div class="elementor-menu-cart__container elementor-lightbox" aria-hidden="true" style="display:none;position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.4)">'
		. '<div class="elementor-menu-cart__main" style="background:#fff;margin:40px auto;max-width:320px;padding:16px">'
		. '<button type="button" class="elementor-menu-cart__close-button" aria-label="Kapat">X</button><p>Elementor menü sepeti</p></div></div>'
		. '</div></div>'
		. '<script>(function(){var w=document.querySelector(".elementor-widget-woocommerce-menu-cart");if(!w)return;'
		. 'var t=w.querySelector(".elementor-menu-cart__toggle_button"),c=w.querySelector(".elementor-menu-cart__container"),x=w.querySelector(".elementor-menu-cart__close-button");'
		. 'function s(o){w.classList.toggle("elementor-menu-cart--shown",o);c.style.display=o?"block":"none";c.setAttribute("aria-hidden",o?"false":"true");t.setAttribute("aria-expanded",o?"true":"false");}'
		. 't.addEventListener("click",function(e){e.preventDefault();s(!w.classList.contains("elementor-menu-cart--shown"));});'
		. 'x.addEventListener("click",function(){s(false);});'
		. 'document.addEventListener("keydown",function(e){if(e.key==="Escape")s(false);});})();</script>';
}

// Elementor'un menü sepeti parçası: Woo'nun standart parça kancasıyla sayaç taklidi.
add_filter(
	'woocommerce_add_to_cart_fragments',
	static function ( $fragments ) {
		$count = ( function_exists( 'WC' ) && WC()->cart ) ? (int) WC()->cart->get_cart_contents_count() : 0;
		$fragments['div.elementor-menu-cart__wrapper'] = '<div class="elementor-menu-cart__wrapper"><span class="elementor-button-icon-qty" data-counter="' . $count . '">' . $count . '</span></div>';
		return $fragments;
	}
);
