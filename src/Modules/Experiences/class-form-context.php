<?php
/**
 * Form modeli: ürün ayarlarından, kap ve gösterimden bağımsız tek veri yapısı üretir.
 *
 * Mevcut ürün bağlamı (eski motor) okunur; model yalnız form çekirdeğinin ihtiyacı olan alanları taşır
 * ve kişi verisi içermez.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

use DonationPanel\Domain\Amount_Presets;
use DonationPanel\Core\Settings;
use DonationPanel\Domain\Privacy_Notice;
use DonationPanel\Domain\Product_Context;
use DonationPanel\Support\Phone_Countries;

defined( 'ABSPATH' ) || exit;

/**
 * Form_Context.
 */
final class Form_Context {

	/**
	 * Bir ürün için form modelini üretir; ürün bağış formu çizemiyorsa boş dizi döner.
	 *
	 * @param \WC_Product|object $product Ürün.
	 * @return array<string, mixed>
	 */
	public static function for_product( $product ) {
		if ( ! is_object( $product ) || ! method_exists( $product, 'get_id' ) ) {
			return array();
		}

		$legacy = array();
		$legacy = Product_Context::build_form_context( $product );
		return self::from_legacy( is_array( $legacy ) ? $legacy : array(), $product );
	}

	/**
	 * Eski motor bağlamından modeli türetir (saf; test edilebilir).
	 *
	 * @param array<string, mixed> $legacy  Eski form bağlamı.
	 * @param object|null          $product Ürün (başlık/görsel için).
	 * @return array<string, mixed>
	 */
	public static function from_legacy( array $legacy, $product = null ) {
		$product_id = isset( $legacy['product_id'] ) ? (int) $legacy['product_id'] : 0;
		if ( $product_id < 1 && is_object( $product ) && method_exists( $product, 'get_id' ) ) {
			$product_id = (int) $product->get_id();
		}

		$title = isset( $legacy['product_name'] ) ? (string) $legacy['product_name'] : '';
		if ( '' === $title && is_object( $product ) && method_exists( $product, 'get_name' ) ) {
			$title = (string) $product->get_name();
		}

		$fixed_price  = isset( $legacy['product_price'] ) && is_numeric( $legacy['product_price'] ) ? (float) $legacy['product_price'] : 0.0;
		$allow_custom = ! empty( $legacy['allow_custom_price'] ) || $fixed_price <= 0;
		$min_raw      = ! empty( $legacy['enable_progress_bar'] ) && isset( $legacy['progress_min_price'] ) ? $legacy['progress_min_price'] : ( isset( $legacy['min_price'] ) ? $legacy['min_price'] : '' );
		$min          = is_numeric( $min_raw ) ? max( 0.0, (float) $min_raw ) : 0.0;
		$kind         = self::kind( $legacy, $allow_custom );
		if ( 'shares' === $kind ) {
			$allow_custom = false;
		}

		$presets = array();
		if ( ! empty( $legacy['enable_amount_presets'] ) ) {
			$presets = self::parse_presets( isset( $legacy['amount_presets'] ) ? (string) $legacy['amount_presets'] : '' );
		}
		if ( ! $allow_custom && $fixed_price > 0 ) {
			$presets = array( $fixed_price );
		}

		/**
		 * Hızlı tutar seçeneklerini değiştirir.
		 *
		 * @param float[] $presets    Tutarlar (en çok 6).
		 * @param int     $product_id Ürün.
		 */
		$presets = array_slice( array_values( array_filter( array_map( 'floatval', (array) apply_filters( 'donation_panel_amount_presets', $presets, $product_id ) ) ) ), 0, 6 );

		$recommended = null;
		if ( isset( $legacy['amount_preset_recommended'] ) && is_numeric( $legacy['amount_preset_recommended'] ) ) {
			foreach ( $presets as $preset ) {
				if ( abs( $preset - (float) $legacy['amount_preset_recommended'] ) < 0.005 ) {
					$recommended = $preset;
				}
			}
		}

		$decimals = function_exists( 'wc_get_price_decimals' ) ? (int) wc_get_price_decimals() : 2;
		$symbol   = isset( $legacy['currency_symbol'] ) ? (string) $legacy['currency_symbol'] : '';
		if ( '' === $symbol && function_exists( 'get_woocommerce_currency_symbol' ) ) {
			$symbol = html_entity_decode( (string) get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' );
		}

		$shares = 'shares' === $kind;
		$model  = array(
			'product_id'     => $product_id,
			'title'          => $title,
			'symbol'         => $symbol,
			'decimals'       => max( 0, $decimals ),
			'presets'        => $presets,
			'recommended'    => $recommended,
			'allow_custom'   => $allow_custom,
			'min'            => $min,
			'closed'         => ! empty( $legacy['goal_closed'] ),
			'closed_message' => isset( $legacy['goal_reached_message'] ) ? (string) $legacy['goal_reached_message'] : '',
			'types'          => self::types( $product_id ),
			'kind'           => $kind,
			'unit_price'     => in_array( $kind, array( 'fixed', 'shares' ), true ) ? max( 0.0, $fixed_price ) : 0.0,
			'quantity'       => self::quantity( $legacy, $kind ),
			'cover_fee'      => self::cover_fee_percent( $legacy ),
			'addon'          => self::addon( $legacy ),
			'steps'          => self::steps( $product_id, $kind ),
			'subtitle'       => '',
			'badge'          => '',
			'brand'          => self::custom_color( 'design.brand' ),
			'accent'         => self::custom_color( 'design.accent' ),
			'privacy_url'    => '',
			'privacy_label'  => '',
			'phone'          => self::phone(),
			'fields'         => $shares ? array() : self::fields( $legacy ),
			'shareholder'    => $shares ? self::shareholder_fields() : array(),
			'direct'         => false,
		);

		// Doğrudan (sepetsiz) bağış = ödeme davranışı; düzenden (popup/panel/alttan/sayfa içi/compact) bağımsız, her düzende
		// aynı karar (ürün > tür > genel). Gönderim sepete değil siparişe (order-pay) gider. Doğrudan sipariş tek kalemlidir:
		// ek bağış satırı oluşturulamadığından seçenek gösterilmez (sessiz veri kaybı yok); `addon_offered` kararı sabit tutar.
		$model['addon_offered'] = ! empty( $model['addon'] );
		if ( is_object( $product ) && class_exists( '\DonationPanel\WooCommerce\Direct\Direct_Settings' ) ) {
			$model['direct'] = \DonationPanel\WooCommerce\Direct\Direct_Settings::enabled_for( $product, $model );
		}
		if ( $model['direct'] ) {
			$model['addon']  = null;
			$model['fields'] = self::require_email( $model['fields'] );
		}

		// Form altı gizlilik bağlantısı: ayar açıksa ve form kişisel veri alanı topluyorsa; adres boşsa WordPress gizlilik sayfası.
		$field_names = array_column( $model['fields'], 'name' );
		$notice      = Privacy_Notice::resolve(
			array(
				'has_email'        => in_array( 'donation_email', $field_names, true ),
				'has_dedication'   => in_array( 'donation_dedication', $field_names, true ),
				'has_shareholders' => $shares,
			)
		);
		if ( $notice && '' !== $notice['url'] ) {
			$model['privacy_url']   = (string) $notice['url'];
			$model['privacy_label'] = (string) $notice['link_label'];
		}

		$model['subtitle'] = ! empty( $model['types'][0]['label'] ) ? (string) $model['types'][0]['label'] : __( 'One-time donation', 'woo-donation-popup' );

		/**
		 * Form modelini değiştirir (kişi verisi eklenmemelidir). Ek anahtarlar: `badge` (başlık altı kısa etiket),
		 * `brand` / `accent` (geçerli #hex; boşsa tema/belirteç değeri), `campaign` (ilerleme), `impact`.
		 *
		 * @param array<string, mixed> $model  Form modeli.
		 * @param array<string, mixed> $legacy Eski bağlam.
		 */
		return (array) apply_filters( 'donation_panel_form_model', $model, $legacy );
	}

	/**
	 * Bağış türü: hisseli > hedefli kampanya > bağışçı belirler (serbest tutar) > sabit tutar.
	 * Eski ürün bayraklarından türetilir (`Donation_Type::infer_from_flags` ile aynı öncelik).
	 *
	 * @param array<string, mixed> $legacy       Eski bağlam.
	 * @param bool                 $allow_custom Serbest tutar mı.
	 * @return string fixed|custom|shares|campaign
	 */
	public static function kind( array $legacy, $allow_custom ) {
		if ( ! empty( $legacy['allow_multiple_shares'] ) ) {
			return 'shares';
		}
		if ( ! empty( $legacy['enable_progress_bar'] ) ) {
			return 'campaign';
		}
		return $allow_custom ? 'custom' : 'fixed';
	}

	/**
	 * Adet/hisse sayısı seçici.
	 *
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @param string               $kind   Bağış türü.
	 * @return array{enabled: bool, min: int, max: int}
	 */
	private static function quantity( array $legacy, $kind ) {
		if ( 'shares' === $kind ) {
			$max = isset( $legacy['max_shares'] ) && is_numeric( $legacy['max_shares'] ) ? (int) $legacy['max_shares'] : 7;
			return array(
				'enabled' => true,
				'min'     => 1,
				'max'     => min( 50, max( 1, $max ) ),
			);
		}
		$enabled = 'fixed' === $kind && ( ! array_key_exists( 'enable_quantity', $legacy ) || ! empty( $legacy['enable_quantity'] ) );
		return array(
			'enabled' => $enabled,
			'min'     => 1,
			'max'     => 99,
		);
	}

	/**
	 * İşlem ücreti yüzdesi (kapalıysa 0). Sunucu yüzdeyi her zaman ürün ayarından okur; istemci değeri yok sayılır.
	 *
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @return float
	 */
	private static function cover_fee_percent( array $legacy ) {
		if ( empty( $legacy['enable_cover_fee'] ) || ! isset( $legacy['cover_fee_percent'] ) || ! is_numeric( $legacy['cover_fee_percent'] ) ) {
			return 0.0;
		}
		return max( 0.0, (float) $legacy['cover_fee_percent'] );
	}

	/**
	 * Ek bağış (AddOn) satırı tanımı; kapalı ya da ürünü yoksa null.
	 *
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @return array{label: string, message: string, fixed: float, min: float}|null
	 */
	private static function addon( array $legacy ) {
		$product_id = isset( $legacy['addon_wc_product_id'] ) ? (int) $legacy['addon_wc_product_id'] : 0;
		if ( empty( $legacy['enable_addon_donation'] ) || $product_id < 1 ) {
			return null;
		}
		$fixed = ! empty( $legacy['addon_is_fixed_price'] ) && isset( $legacy['addon_fixed_price'] ) && is_numeric( $legacy['addon_fixed_price'] ) ? (float) $legacy['addon_fixed_price'] : 0.0;
		$min   = isset( $legacy['addon_min_price'] ) && is_numeric( $legacy['addon_min_price'] ) ? max( 0.0, (float) $legacy['addon_min_price'] ) : 0.0;
		return array(
			'label'   => isset( $legacy['addon_toggle_label'] ) ? (string) $legacy['addon_toggle_label'] : '',
			'message' => isset( $legacy['addon_donation_message'] ) ? (string) $legacy['addon_donation_message'] : '',
			'fixed'   => $fixed,
			'min'     => $min,
		);
	}

	/**
	 * Form adımları: tutar -> bilgiler. Tutarı kullanıcı belirlemeyen türlerde (sabit tutar, hisseli) tutar/adet seçimi
	 * ve bilgiler tek adımdır (`details`). Ek adım (ör. vergi indirimi) `donation_panel_form_steps` ile eklenir;
	 * ek adımın içeriği `donation_panel_form_step_{id}` kancasına yazılır.
	 *
	 * @param int    $product_id Ürün.
	 * @param string $kind       Bağış türü.
	 * @return array<int, array{id: string, label: string}>
	 */
	private static function steps( $product_id, $kind = 'custom' ) {
		$single = in_array( $kind, array( 'fixed', 'shares' ), true );
		$steps  = array();
		if ( ! $single ) {
			$steps[] = array(
				'id'    => 'amount',
				'label' => __( 'Amount', 'woo-donation-popup' ),
			);
		}
		$steps[] = array(
			'id'    => 'details',
			'label' => __( 'Your details', 'woo-donation-popup' ),
		);

		/**
		 * Form adımlarını değiştirir (ek adım eklemek için). `details` (ve tutarı kullanıcı seçiyorsa `amount`) adımı kaldırılamaz.
		 *
		 * @param array<int, array{id: string, label: string}> $steps      Adımlar.
		 * @param int                                          $product_id Ürün.
		 */
		$filtered = (array) apply_filters( 'donation_panel_form_steps', $steps, $product_id );
		$out      = array();
		foreach ( $filtered as $step ) {
			if ( is_array( $step ) && ! empty( $step['id'] ) && isset( $step['label'] ) ) {
				$out[] = array(
					'id'    => sanitize_key( (string) $step['id'] ),
					'label' => (string) $step['label'],
				);
			}
		}
		$ids = array_column( $out, 'id' );
		return ( in_array( 'details', $ids, true ) && ( $single || in_array( 'amount', $ids, true ) ) ) ? $out : $steps;
	}

	/**
	 * Yönetici ayarındaki özel renk (yalnız "kendi renklerimi seçeyim" seçiliyse ve geçerli #hex ya da `var(--ad[, #yedek])`
	 * ise); aksi halde '' (form tema ön ayarından/belirteçten renk alır).
	 *
	 * @param string $path `design.brand` ya da `design.accent`.
	 * @return string
	 */
	private static function custom_color( $path ) {
		$settings = new Settings();
		if ( 'custom' !== (string) $settings->get( 'design.colors', 'theme' ) ) {
			return '';
		}
		return \DonationPanel\Frontend\Theme_Colors::sanitize_color( $settings->get( $path, '' ) );
	}

	/**
	 * Telefon ön eki seçenekleri ve varsayılan ülke (mağaza ülkesinden).
	 *
	 * @return array{iso: string, dial: string, countries: array<int, array{iso: string, name: string, dial: string}>}
	 */
	private static function phone() {
		$out  = array(
			'iso'       => '',
			'dial'      => '',
			'countries' => array(),
		);
		$list = Phone_Countries::get_countries();
		$iso  = Phone_Countries::get_default_country_iso();
		foreach ( $list as $code => $row ) {
			$out['countries'][] = array(
				'iso'  => (string) $code,
				'name' => (string) $row['name'],
				'dial' => (string) $row['dial'],
			);
		}
		$out['iso']  = $iso;
		$out['dial'] = isset( $list[ $iso ]['dial'] ) ? (string) $list[ $iso ]['dial'] : '';
		return $out;
	}

	/**
	 * Hissedar başına alanlar (ad ve telefon zorunlu; not isteğe bağlı; e-posta sorulmaz).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private static function shareholder_fields() {
		$fields   = array(
			array(
				'key'          => 'name',
				'type'         => 'text',
				'label'        => __( 'Full name *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter the shareholder’s name.', 'woo-donation-popup' ),
				'autocomplete' => 'off',
				'maxlength'    => 100,
			),
			array(
				'key'          => 'phone',
				'type'         => 'tel',
				'label'        => __( 'Phone number *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter the shareholder’s phone number.', 'woo-donation-popup' ),
				'autocomplete' => 'off',
				'inputmode'    => 'tel',
				'maxlength'    => 28,
			),
		);
		$fields[] = array(
			'key'          => 'note',
			'type'         => 'text',
			'label'        => __( 'Note (optional)', 'woo-donation-popup' ),
			'required'     => false,
			'autocomplete' => 'off',
			'maxlength'    => 500,
		);
		return $fields;
	}

	/**
	 * Tutar listesini ayrıştırır (boşluk, virgül, noktalı virgül; en çok 6; pozitif).
	 *
	 * @param string $csv Ham liste.
	 * @return float[]
	 */
	public static function parse_presets( $csv ) {
		$csv = trim( (string) $csv );
		if ( '' === $csv ) {
			$csv = Amount_Presets::default_csv();
		}
		$out   = array();
		$parts = preg_split( '/[\s,;]+/', $csv );
		foreach ( (array) $parts as $part ) {
			if ( ! is_numeric( $part ) || (float) $part <= 0 ) {
				continue;
			}
			$out[] = (float) $part;
			if ( count( $out ) >= 6 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * Bağış türü seçenekleri (yalnız `donation_panel_frequency_options` doluysa görünür).
	 *
	 * @param int $product_id Ürün.
	 * @return array<int, array{value: string, label: string}>
	 */
	private static function types( $product_id ) {
		/**
		 * Bağış türü (ör. tek seferlik/aylık) seçenekleri; boş dizi türü gizler.
		 *
		 * @param array<int, array{value: string, label: string}> $options    Seçenekler.
		 * @param int                                             $product_id Ürün.
		 */
		$options = (array) apply_filters( 'donation_panel_frequency_options', array(), $product_id );
		$out     = array();
		foreach ( $options as $option ) {
			if ( is_array( $option ) && isset( $option['value'], $option['label'] ) ) {
				$out[] = array(
					'value' => sanitize_key( (string) $option['value'] ),
					'label' => (string) $option['label'],
				);
			}
		}
		return count( $out ) > 1 ? $out : array();
	}

	/**
	 * Doğrudan (sepetsiz) bağışta e-posta zorunludur: sipariş WooCommerce'in ödeme sayfasında (order-pay) ödenir ve o sayfa
	 * fatura alanı sormaz. WooCommerce ödeme formunda fatura e-postası zorunlu bir standart alandır; ödeme geçitleri (ör. kartlı
	 * ödeme) ve sipariş e-postaları onu bekler. E-posta alanı kapalı olsa bile doğrudan akışta eklenir (telefondan sonra),
	 * açıksa zorunlu yapılır. Geçide özel kod değildir.
	 *
	 * @param array<int, array<string, mixed>> $fields Alanlar.
	 * @return array<int, array<string, mixed>>
	 */
	private static function require_email( array $fields ) {
		$email = array(
			'name'         => 'donation_email',
			'type'         => 'email',
			'label'        => __( 'Email *', 'woo-donation-popup' ),
			'required'     => true,
			'required_msg' => __( 'Please enter your email address.', 'woo-donation-popup' ),
			'autocomplete' => 'email',
			'inputmode'    => 'email',
			'maxlength'    => 100,
		);
		$after = -1;
		foreach ( $fields as $i => $field ) {
			$name = is_array( $field ) && isset( $field['name'] ) ? (string) $field['name'] : '';
			if ( 'donation_email' === $name ) {
				$fields[ $i ] = array_merge( $field, array_intersect_key( $email, array_flip( array( 'label', 'required', 'required_msg' ) ) ) );
				return $fields;
			}
			if ( in_array( $name, array( 'donation_full_name', 'donation_phone' ), true ) ) {
				$after = (int) $i;
			}
		}
		array_splice( $fields, $after + 1, 0, array( $email ) );
		return array_values( $fields );
	}

	/**
	 * Bağışçı alan tanımları (sipariş sözleşmesiyle aynı alan adları; hisseli bağışta kullanılmaz).
	 *
	 * @param array<string, mixed> $legacy Eski bağlam.
	 * @return array<int, array<string, mixed>>
	 */
	private static function fields( array $legacy ) {
		$fields = array(
			array(
				'name'         => 'donation_full_name',
				'type'         => 'text',
				'label'        => __( 'Full name *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter your full name.', 'woo-donation-popup' ),
				'autocomplete' => 'name',
				'maxlength'    => 100,
			),
			array(
				'name'         => 'donation_phone',
				'type'         => 'tel',
				'label'        => __( 'Phone number *', 'woo-donation-popup' ),
				'required'     => true,
				'required_msg' => __( 'Please enter your phone number.', 'woo-donation-popup' ),
				'autocomplete' => 'tel',
				'inputmode'    => 'tel',
				'maxlength'    => 28,
			),
		);
		if ( ! empty( $legacy['enable_dedication'] ) ) {
			$placeholder = isset( $legacy['dedication_placeholder'] ) ? (string) $legacy['dedication_placeholder'] : '';
			$fields[]    = array(
				'name'         => 'donation_dedication',
				'type'         => 'text',
				'label'        => __( 'Dedication', 'woo-donation-popup' ),
				'placeholder'  => $placeholder,
				'required'     => false,
				'autocomplete' => 'off',
				'maxlength'    => 120,
			);
		}
		$fields[] = array(
			'name'         => 'donation_note',
			'type'         => 'textarea',
			'label'        => __( 'Note (optional)', 'woo-donation-popup' ),
			'required'     => false,
			'autocomplete' => 'off',
			'maxlength'    => 500,
		);
		if ( ! empty( $legacy['enable_anonymous'] ) ) {
			$fields[] = array(
				'name'     => 'donation_anonymous',
				'type'     => 'checkbox',
				'label'    => __( 'Anonymous donation', 'woo-donation-popup' ),
				'required' => false,
			);
		}

		/**
		 * Form alanlarını değiştirir. Alan adları sipariş sözleşmesiyle aynı kalmalıdır.
		 *
		 * @param array<int, array<string, mixed>> $fields Alan tanımları.
		 * @param array<string, mixed>             $legacy Eski bağlam.
		 */
		return array_values( (array) apply_filters( 'donation_panel_form_fields', $fields, $legacy ) );
	}
}
