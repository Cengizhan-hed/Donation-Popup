<?php
/**
 * Formlar ve Görünüm → "Compact kart (slider/hero)" bölümünün ek araçları: kısa kod oluşturucu (ürün seç → kopyala),
 * kartın güncel yükseklikleri ve `--dp-compact-h` kullanımı. Yalnız yönetici ekranında çizilir (ön yüze yük yok).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Domain\Donation_Scope;
use DonationPanel\Domain\Donation_Type;

defined( 'ABSPATH' ) || exit;

/**
 * Compact_Tools.
 */
final class Compact_Tools {

	/**
	 * Kart yüksekliği (px), varsayılan blok teması + yerel test ürünleri; `layout="compact"` (yalnız sepetli), TEK birleşik
	 * değer: tüm ürün türleri ve adımlar aynı (adımlar aynı hücrede üst üste). e2e `kurgu-matrix` "compact kart
	 * yükseklikleri" testi ölçümü bu tabloyla karşılaştırır (±HEIGHT_TOLERANCE). Ölçüm 2026-10-31 (12.4 sade kart: 354 px taban
	 * + 2 px kenarlık = 356), TT5, 1440/820/375/320 px; en dolu hal (serbest tutar + kampanya + etki ifadesi) doğal olarak 347 px
	 * tutar, yani 9 px pay vardır; hedefli/hedefsiz/sabit fiyat, etki ifadesi ve vergi beyanı ile aynıdır. Tema yazı tipi çok
	 * büyükse içerik tabanı aşar ve kart uzar.
	 *
	 * @var array<string, array{0: int, 1: int}> genişlik => [ serbest tutar (hedefsiz), hedefli kampanya ].
	 */
	const HEIGHTS = array(
		'desktop' => array( 356, 356 ),
		'tablet'  => array( 356, 356 ),
		'mobile'  => array( 356, 356 ),
	);

	/** Ölçüm toleransı (px). */
	const HEIGHT_TOLERANCE = 2;

	/** Oluşturucudaki en çok ürün. */
	const MAX_PRODUCTS = 100;

	/**
	 * Bölümün altına eklenen araçlar.
	 *
	 * @return string
	 */
	public static function render() {
		return self::builder() . self::heights();
	}

	/**
	 * Kısa kod üretir (saf; test edilebilir).
	 *
	 * @param int $product_id Ürün (0 = bulunduğu ürünü bulur).
	 * @return string
	 */
	public static function shortcode( $product_id ) {
		$product_id = absint( $product_id );
		return $product_id > 0
			? '[wdp_donation_form id="' . $product_id . '" layout="compact"]'
			: '[wdp_donation_form layout="compact"]';
	}

	/**
	 * Kısa kod oluşturucu: ürün seçilir, kod güncellenir, tek tıkla kopyalanır (betiksiz: seçilmemiş kod seçilebilir metin).
	 *
	 * @return string
	 */
	private static function builder() {
		$options = '<option value="0">' . esc_html__( 'The product the card is placed in (no ID)', 'woo-donation-popup' ) . '</option>';
		foreach ( self::products() as $product ) {
			$options .= '<option value="' . (int) $product['id'] . '" data-dpa-shares="' . ( $product['shares'] ? '1' : '0' ) . '">' . esc_html( $product['label'] ) . '</option>';
		}
		$control = '<select class="dpa-input" id="dpa-compact-product" aria-describedby="dpa-compact-product-desc" data-dpa-compact-product>' . $options . '</select>';
		$row     = Admin_View::row(
			__( 'Shortcode for a product', 'woo-donation-popup' ),
			__( 'Choose a donation product and copy the shortcode into a slide, hero area or any text block. Share-based products always show the full form instead of the card.', 'woo-donation-popup' ),
			$control,
			'dpa-compact-product'
		);
		$code    = self::shortcode( 0 );
		$box     = '<div class="dpa-code" data-dpa-compact-code><code data-dpa-compact-text>' . esc_html( $code ) . '</code><button type="button" class="dpa-btn dpa-btn--small dpa-copy" data-dpa-copy="' . esc_attr( $code ) . '">' . esc_html__( 'Copy', 'woo-donation-popup' ) . '</button></div>';
		$note    = '<p class="dpa-row__help" data-dpa-compact-shares hidden>' . esc_html__( 'This product is share-based: the shortcode shows the full in-page form, because shareholder names do not fit in a fixed-height card.', 'woo-donation-popup' ) . '</p>';
		return $row . $box . $note;
	}

	/**
	 * Yükseklik tablosu + CSS değişkeni kullanımı.
	 *
	 * @return string
	 */
	private static function heights() {
		$labels = array(
			'desktop' => __( 'Desktop (1024 px and wider)', 'woo-donation-popup' ),
			'tablet'  => __( 'Tablet (640–1023 px)', 'woo-donation-popup' ),
			'mobile'  => __( 'Phone (up to 639 px)', 'woo-donation-popup' ),
		);
		$vars   = array(
			'desktop' => '--dp-compact-h',
			'tablet'  => '--dp-compact-h-md',
			'mobile'  => '--dp-compact-h-sm',
		);
		$rows   = '';
		foreach ( self::HEIGHTS as $key => $pair ) {
			$rows .= '<tr data-dpa-compact-height="' . esc_attr( $key ) . '"><th scope="row">' . esc_html( $labels[ $key ] ) . '</th>'
				. '<td>' . esc_html( self::px( $pair[0] ) ) . '</td><td>' . esc_html( self::px( $pair[1] ) ) . '</td><td><code>' . esc_html( $vars[ $key ] ) . '</code></td></tr>';
		}
		$table = '<div class="dpa-tablewrap"><table class="dpa-table dpa-compact-heights"><caption class="screen-reader-text">' . esc_html__( 'Compact card heights', 'woo-donation-popup' ) . '</caption><thead><tr>'
			. '<th scope="col">' . esc_html__( 'Screen', 'woo-donation-popup' ) . '</th>'
			. '<th scope="col">' . esc_html__( 'Without goal', 'woo-donation-popup' ) . '</th>'
			. '<th scope="col">' . esc_html__( 'With goal', 'woo-donation-popup' ) . '</th>'
			. '<th scope="col">' . esc_html__( 'CSS variable', 'woo-donation-popup' ) . '</th></tr></thead><tbody>' . $rows . '</tbody></table></div>';
		$help  = '<p class="dpa-row__help">' . esc_html__( 'The compact card is made for sliders and hero areas and always sends the donor to the checkout page; direct donation is not used with this layout. Its height is one single value for every product type and every step, and it never changes while the donor moves through the steps. Measured with a default block theme; your theme\'s font can change it a little.', 'woo-donation-popup' ) . '</p>'
			. '<p class="dpa-row__help">' . esc_html__( 'Steps: a custom amount has 2 steps (amount, then name and phone with "Continue to checkout · amount"); a fixed-price product has one screen: price and a quantity selector on one thin line, then name and phone and the button. The total is shown only on the main button and changes at once when the amount or quantity changes. The card never asks for an email address (checkout does).', 'woo-donation-popup' ) . '</p>'
			. '<p class="dpa-row__help">' . esc_html__( 'The card shows at most one extra line: the impact phrase of the chosen amount, or else the short product description. A fixed-price product never shows a goal bar: a product with a goal is a goal-based product and has the amount step. The height is the same with or without a goal, an impact phrase or the tax relief declaration.', 'woo-donation-popup' ) . '</p>'
			. '<p class="dpa-row__help">' . sprintf(
				/* translators: 1: card height in pixels, 2: minimum slide height in pixels. */
				esc_html__( 'Elementor and other sliders: the card is %1$d px tall on desktop, tablet and phone. Give the slide at least %2$d px (card plus a 16 px safety margin for your theme font).', 'woo-donation-popup' ),
				self::HEIGHTS['desktop'][0],
				self::HEIGHTS['desktop'][0] + 16
			) . '</p>'
			. '<p class="dpa-row__help">' . esc_html__( 'To give every card the same height, for example to match your slide, set the CSS variable on the slide or on a parent element:', 'woo-donation-popup' ) . '</p>';
		return '<h3 class="dpa-subtitle">' . esc_html__( 'Card height', 'woo-donation-popup' ) . '</h3>' . $help
			. Admin_View::code( '.my-slide { --dp-compact-h: 560px; --dp-compact-h-sm: 600px; }' ) . $table;
	}

	/**
	 * "560 px" biçimi (0 = ölçülmedi).
	 *
	 * @param int $value Değer.
	 * @return string
	 */
	private static function px( $value ) {
		/* translators: %d: height in pixels */
		return $value > 0 ? sprintf( __( 'about %d px', 'woo-donation-popup' ), (int) $value ) : '—';
	}

	/**
	 * Oluşturucu için yayımlanmış bağış ürünleri (en çok MAX_PRODUCTS; yalnız yönetici ekranında).
	 *
	 * @return array<int, array{id: int, label: string, shares: bool}>
	 */
	private static function products() {
		if ( ! function_exists( 'get_posts' ) ) {
			return array();
		}
		$ids = get_posts(
			array(
				'post_type'              => 'product',
				'post_status'            => 'publish',
				'numberposts'            => 300, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_numberposts -- yalnız yönetici ekranı; kimlik listesi.
				'orderby'                => 'title',
				'order'                  => 'ASC',
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_term_cache' => false,
			)
		);
		$out = array();
		foreach ( (array) $ids as $id ) {
			if ( count( $out ) >= self::MAX_PRODUCTS ) {
				break;
			}
			if ( ! Donation_Scope::is_donation_product( (int) $id ) ) {
				continue;
			}
			$out[] = array(
				'id'     => (int) $id,
				/* translators: 1: product name, 2: product ID */
				'label'  => sprintf( __( '%1$s (ID %2$d)', 'woo-donation-popup' ), html_entity_decode( (string) get_the_title( (int) $id ), ENT_QUOTES, 'UTF-8' ), (int) $id ),
				'shares' => Donation_Type::SHARES === Donation_Type::for_product( (int) $id ),
			);
		}
		return $out;
	}
}
