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
/**
 * Sayfa türüne göre Elementor işaret sınıfları (taklit).
 *
 * @return array{0:string,1:string} Tür ve sınıflar.
 */
function wdp_elsim_markers() {
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
	return array( $type, $cls );
}

/**
 * Simülasyon bu istekte açık mı?
 *
 * @return bool
 */
function wdp_elsim_active() {
	// phpcs:ignore WordPress.Security.NonceVerification
	if ( isset( $_GET['dp_elsim'] ) && '0' === $_GET['dp_elsim'] ) {
		return false;
	}
	return ! is_admin() && ! wp_doing_ajax() && ! ( defined( 'REST_REQUEST' ) && REST_REQUEST );
}

// Başlık (kısa kodlar wp_footer'dan ÖNCE çalışsın ki betik/pencere doğru yazılsın) + sarmalayıcı açılışı.
add_action(
	'wp_body_open',
	static function () {
		if ( ! wdp_elsim_active() ) {
			return;
		}
		list( $type, $cls ) = wdp_elsim_markers();
		$count              = ( function_exists( 'WC' ) && WC()->cart ) ? (int) WC()->cart->get_cart_contents_count() : 0;
		echo '<header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;gap:8px"><b>Site</b>'; // phpcs:ignore
		echo do_shortcode( '[donation_panel_side_cart]' ); // phpcs:ignore
		echo do_shortcode( '[donation_panel_account]' ); // phpcs:ignore
		echo wdp_elsim_menu_cart( $count ); // phpcs:ignore
		echo '</header><div data-elementor-type="' . esc_attr( $type ) . '" class="' . esc_attr( $cls ) . '">'; // phpcs:ignore
	},
	1
);
add_action(
	'wp_footer',
	static function () {
		if ( wdp_elsim_active() ) {
			echo '</div>';
		}
	},
	99999
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
