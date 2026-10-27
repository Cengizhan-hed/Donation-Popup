<?php
/**
 * Eski iç adlar için okuma bağdaştırıcıları (dışa açık `wdp_form_context` süzgeci ve eski sepet oturumları).
 *
 * Eklentinin iç kodu ek bağış alanlarını `addon_*` adlarıyla taşır; ancak `wdp_form_context` süzgecini kullanan
 * üçüncü taraf kodu yıllardır `sadaka_*` anahtarlarını görür/değiştirir. Bu sınıf süzgeçten ÖNCE eski anahtarları
 * ekler, SONRA süzgeçte değiştirilmiş olanları yeni anahtarlara geri yazar ve eski anahtarları atar.
 * Veritabanı anahtarlarına (meta/seçenek) dokunmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Compat;

defined( 'ABSPATH' ) || exit;

/**
 * Legacy_Context.
 */
final class Legacy_Context {

	/**
	 * Yeni iç anahtar => eski dışa açık anahtar (form bağlamı).
	 */
	const CONTEXT_ALIASES = array(
		'enable_addon_donation'   => 'enable_sadaka_donation',
		'addon_donation_message'  => 'sadaka_donation_message',
		'addon_min_price'         => 'sadaka_min_price',
		'addon_fixed_price'       => 'sadaka_fixed_price',
		'addon_is_fixed_price'    => 'sadaka_is_fixed_price',
		'addon_wc_product_id'     => 'sadaka_wc_product_id',
		'addon_toggle_label'      => 'sadaka_toggle_label',
		'addon_price_placeholder' => 'sadaka_price_placeholder',
	);

	/**
	 * Eski sürümlerin sepet oturumunda bıraktığı ek bağış işareti (`donation_data`).
	 */
	const LEGACY_ADDON_FLAG = 'is_sadaka';

	/**
	 * `wdp_form_context` süzgecini eski anahtar adlarıyla çalıştırır.
	 *
	 * @param array<string, mixed> $context Form bağlamı (yeni adlar).
	 * @param mixed                $product Ürün.
	 * @return array<string, mixed>
	 */
	public static function filter_form_context( array $context, $product ) {
		$legacy = $context;
		foreach ( self::CONTEXT_ALIASES as $new => $old ) {
			if ( array_key_exists( $new, $context ) ) {
				$legacy[ $old ] = $context[ $new ];
			}
		}

		$filtered = apply_filters( 'wdp_form_context', $legacy, $product ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- geriye dönük uyumluluk sözleşmesi: eski wdp_ kanca adı değişmez.
		if ( ! is_array( $filtered ) ) {
			return $context;
		}

		foreach ( self::CONTEXT_ALIASES as $new => $old ) {
			if ( array_key_exists( $old, $filtered ) && ( ! array_key_exists( $old, $legacy ) || $filtered[ $old ] !== $legacy[ $old ] ) ) {
				$filtered[ $new ] = $filtered[ $old ];
			}
			unset( $filtered[ $old ] );
		}
		return $filtered;
	}

	/**
	 * Sepet kalemi bağış verisi ek bağış satırına mı ait (yeni ya da eski işaret).
	 *
	 * @param array<string, mixed> $donation_data `donation_data`.
	 * @return bool
	 */
	public static function is_addon_data( array $donation_data ) {
		return ! empty( $donation_data['is_addon'] ) || ! empty( $donation_data[ self::LEGACY_ADDON_FLAG ] );
	}
}
