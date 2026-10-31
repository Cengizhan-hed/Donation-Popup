<?php
/**
 * Doğrudan (sepetsiz) bağış = ÖDEME DAVRANIŞI; görünümden (popup, sağ panel, alttan panel, sayfa içi form) bağımsızdır.
 * Compact kart bu karara uymaz: her zaman sepetlidir (`Compact_Card::render` modeli `direct = false` yapar). Açıkken bağış sepete eklenmez; gönderim sipariş (pending) üretir ve ödeme WooCommerce'in standart order-pay
 * uç noktasında yapılır.
 *
 * Üç seviye, öncelik ürün > bağış türü > genel:
 *  1) Ürün: meta `_donation_panel_direct` (yes | no | '' = aşağıdakini kullan) — sözleşme anahtarı, değişmez.
 *  2) Bağış türü: `direct.type_{fixed|custom|shares|campaign|addon}` ('' = genel | cart | direct). Ek bağış sunan üründe
 *     (`addon`) tür ayarı, ana türün ayarından önce gelir (daha belirgin kural).
 *  3) Genel: `direct.enabled` (Sepet ve ödeme ekranı; varsayılan kapalı).
 * Son karar `donation_panel_direct_enabled` süzgecinden geçer (sözleşme).
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Direct;

use DonationPanel\Core\Settings;
use DonationPanel\Domain\Addon_Product_Visibility;
use DonationPanel\Domain\Addon_Settings;
use DonationPanel\Domain\Donation_Type;
use DonationPanel\Domain\Product_Meta;

defined( 'ABSPATH' ) || exit;

/**
 * Direct_Settings.
 */
final class Direct_Settings {

	/** Ürün meta anahtarı (sözleşme; değişmez). */
	const META = '_donation_panel_direct';

	/** Tür ayarı değerleri. */
	const CART   = 'cart';
	const DIRECT = 'direct';

	/** Kaynaklar. */
	const SOURCE_PRODUCT = 'product';
	const SOURCE_TYPE    = 'type';
	const SOURCE_GLOBAL  = 'global';
	const SOURCE_FILTER  = 'filter';

	/** Ek bağış sunan ürünler için tür kimliği (Donation_Type dışında; yalnız bu ayar için). */
	const ADDON = 'addon';

	/**
	 * Tür ayarı olan türler (ekran sırası).
	 *
	 * @return string[]
	 */
	public static function types() {
		return array( Donation_Type::FIXED, Donation_Type::CUSTOM, Donation_Type::SHARES, Donation_Type::CAMPAIGN, self::ADDON );
	}

	/**
	 * Bu ürün için doğrudan bağış açık mı?
	 *
	 * @param object|null               $product \WC_Product.
	 * @param array<string, mixed>|null $model   Form modeli (varsa tür ve ek bağış oradan okunur; form ile REST aynı kararı verir).
	 * @return bool
	 */
	public static function enabled_for( $product, $model = null ) {
		$resolved = self::resolve( $product, $model );
		return $resolved['enabled'];
	}

	/**
	 * Geçerli değer ve kaynağı.
	 *
	 * @param object|null               $product \WC_Product.
	 * @param array<string, mixed>|null $model   Form modeli.
	 * @return array{enabled: bool, source: string, type: string}
	 */
	public static function resolve( $product, $model = null ) {
		if ( ! is_object( $product ) ) {
			return array(
				'enabled' => false,
				'source'  => self::SOURCE_GLOBAL,
				'type'    => '',
			);
		}
		$traits   = is_array( $model ) ? self::traits_from_model( $model ) : self::traits_from_product( $product );
		$resolved = self::decide(
			(string) Product_Meta::get( $product, self::META ),
			$traits['kind'],
			$traits['addon'],
			self::type_choices(),
			self::global_default()
		);

		/**
		 * Doğrudan (sepetsiz) bağışı ürün bazında açar/kapatır (son söz).
		 *
		 * @param bool   $enabled Açık mı.
		 * @param object $product Ürün.
		 */
		$filtered = (bool) apply_filters( 'donation_panel_direct_enabled', $resolved['enabled'], $product );
		if ( $filtered !== $resolved['enabled'] ) {
			$resolved['enabled'] = $filtered;
			$resolved['source']  = self::SOURCE_FILTER;
		}
		return $resolved;
	}

	/**
	 * Öncelik kuralı (saf; birim testli): ürün > tür (ek bağış, sonra ana tür) > genel.
	 *
	 * @param string                $product_value Ürün meta değeri (yes|no|'').
	 * @param string                $kind          fixed|custom|shares|campaign.
	 * @param bool                  $has_addon     Ürün ek bağış sunuyor mu.
	 * @param array<string, string> $choices       Tür => ''|cart|direct.
	 * @param bool                  $fallback      Genel varsayılan.
	 * @return array{enabled: bool, source: string, type: string}
	 */
	public static function decide( $product_value, $kind, $has_addon, array $choices, $fallback ) {
		$value = strtolower( trim( (string) $product_value ) );
		if ( 'yes' === $value || 'no' === $value ) {
			return array(
				'enabled' => 'yes' === $value,
				'source'  => self::SOURCE_PRODUCT,
				'type'    => '',
			);
		}
		$order = $has_addon ? array( self::ADDON, (string) $kind ) : array( (string) $kind );
		foreach ( $order as $type ) {
			$choice = isset( $choices[ $type ] ) ? self::sanitize_choice( $choices[ $type ] ) : '';
			if ( '' !== $choice ) {
				return array(
					'enabled' => self::DIRECT === $choice,
					'source'  => self::SOURCE_TYPE,
					'type'    => $type,
				);
			}
		}
		return array(
			'enabled' => (bool) $fallback,
			'source'  => self::SOURCE_GLOBAL,
			'type'    => '',
		);
	}

	/**
	 * Tür ayarı değerini sınırlar.
	 *
	 * @param mixed $value Ham değer.
	 * @return string ''|cart|direct
	 */
	public static function sanitize_choice( $value ) {
		$value = is_scalar( $value ) ? sanitize_key( (string) $value ) : '';
		return in_array( $value, array( self::CART, self::DIRECT ), true ) ? $value : '';
	}

	/**
	 * Tür ayarları (geçersizler '').
	 *
	 * @return array<string, string>
	 */
	public static function type_choices() {
		$settings = new Settings();
		$out      = array();
		foreach ( self::types() as $type ) {
			$out[ $type ] = self::sanitize_choice( $settings->get( 'direct.type_' . $type, '' ) );
		}
		return $out;
	}

	/**
	 * Genel varsayılan (`direct.enabled`; varsayılan kapalı).
	 *
	 * @return bool
	 */
	public static function global_default() {
		return (bool) ( new Settings() )->get( 'direct.enabled', false );
	}

	/**
	 * Form modelinden tür + ek bağış.
	 *
	 * @param array<string, mixed> $model Form modeli.
	 * @return array{kind: string, addon: bool}
	 */
	private static function traits_from_model( array $model ) {
		return array(
			'kind'  => isset( $model['kind'] ) ? (string) $model['kind'] : '',
			'addon' => ! empty( $model['addon_offered'] ) || ! empty( $model['addon'] ),
		);
	}

	/**
	 * Ürün meta'sından tür + ek bağış (yönetici ekranı; Form_Context::kind ile aynı sonuç: fiyatsız sabit = serbest).
	 *
	 * @param object $product Ürün.
	 * @return array{kind: string, addon: bool}
	 */
	public static function traits_from_product( $product ) {
		$id   = method_exists( $product, 'get_id' ) ? (int) $product->get_id() : 0;
		$kind = Donation_Type::for_product( $id );
		if ( Donation_Type::FIXED === $kind && method_exists( $product, 'get_price' ) && (float) $product->get_price() <= 0 ) {
			$kind = Donation_Type::CUSTOM;
		}
		$addon = 'yes' === (string) Addon_Product_Visibility::get_meta( $product, '_enable_addon_donation' )
			&& (int) Addon_Settings::get_configured_addon_wc_product_id( $product ) > 0;
		return array(
			'kind'  => $kind,
			'addon' => $addon,
		);
	}
}
