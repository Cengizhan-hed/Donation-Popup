<?php
/**
 * Kampanya toplamları REST uçları (yalnız yönetici): devreden tutar düzenleme, yeniden hesap ÖNİZLEMESİ (yazmaz) ve
 * onaylı uygulama.
 *
 * Hepsi `manage_woocommerce` + REST nonce ister; her uç hız sınırlıdır. Veri yalnız Woo veri API'leriyle okunur
 * (HPOS/postmeta uyumlu); ham SQL yoktur. Toplu/otomatik yeniden hesap yoktur: tek ürün, tek istek.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Admin;

use DonationPanel\Domain\Campaign_Formula;
use DonationPanel\Http\Rest_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Campaign_Totals_Controller.
 */
final class Campaign_Totals_Controller extends Rest_Controller {

	/**
	 * Rotalar.
	 *
	 * @return void
	 */
	public function register_routes() {
		$permission = $this->permission_for( Admin_Bootstrap::CAPABILITY );
		$id_arg     = array(
			'id' => array(
				'validate_callback' => static function ( $value ) {
					return is_numeric( $value ) && (int) $value > 0;
				},
			),
		);

		// Önizleme POST'tur (gövdede tarih; düz kalıcı bağlantıda sorgu dizesi sorunu olmasın) ama YAZMAZ.
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/campaigns/(?P<id>\d+)/recalc/preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'preview' ),
				'permission_callback' => $permission,
				'args'                => $id_arg,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/campaigns/(?P<id>\d+)/recalc',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'apply' ),
				'permission_callback' => $permission,
				'args'                => $id_arg,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/campaigns/(?P<id>\d+)/carried',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'set_carried' ),
				'permission_callback' => $permission,
				'args'                => $id_arg,
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/admin/campaigns/(?P<id>\d+)/manual',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'set_manual' ),
				'permission_callback' => $permission,
				'args'                => $id_arg,
			)
		);
	}

	/**
	 * POST .../recalc/preview: önizleme. YAZMAZ.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function preview( $request ) {
		$guard = $this->guard( $request, 'campaign_preview', 20 );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$range = $this->range( $request );
		if ( is_wp_error( $range ) ) {
			return $range;
		}
		$product_id = $this->product_id( $request );
		if ( is_wp_error( $product_id ) ) {
			return $product_id;
		}
		if ( function_exists( 'wc_set_time_limit' ) ) {
			wc_set_time_limit( 0 );
		}
		return rest_ensure_response( $this->present( Campaign_Formula::preview( $product_id, $range['from'], $range['to'] ) ) );
	}

	/**
	 * POST .../recalc: önizlenen sonucu yazar (`expected` = önizlemede görülen hesaplanan toplam).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function apply( $request ) {
		$guard = $this->guard( $request, 'campaign_apply', 10 );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$range = $this->range( $request );
		if ( is_wp_error( $range ) ) {
			return $range;
		}
		$product_id = $this->product_id( $request );
		if ( is_wp_error( $product_id ) ) {
			return $product_id;
		}
		$expected = $request->get_param( 'expected' );
		if ( ! is_numeric( $expected ) ) {
			return $this->error( 'donation_panel_bad_expected', 'Preview the recalculation first, then approve it.', 400 );
		}
		if ( function_exists( 'wc_set_time_limit' ) ) {
			wc_set_time_limit( 0 );
		}
		$done = Campaign_Formula::apply( $product_id, $range['from'], $range['to'], (float) $expected, (int) get_current_user_id() );
		if ( ! $done['ok'] ) {
			if ( 'end_in_past' === $done['reason'] ) {
				return $this->error( 'donation_panel_end_in_past', 'The end date must be empty or in the future. Later donations would be lost from the total.', 400 );
			}
			return $this->error( 'donation_panel_stale_preview', 'The numbers changed since the preview. Preview again.', 409, array( 'preview' => $this->present( $done['result'] ) ) );
		}
		return rest_ensure_response( $this->present( $done['result'] ) + $this->raised( $product_id ) );
	}

	/**
	 * POST .../carried: devreden tutarı yazar.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_carried( $request ) {
		$guard = $this->guard( $request, 'campaign_carried', 30 );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$product_id = $this->product_id( $request );
		if ( is_wp_error( $product_id ) ) {
			return $product_id;
		}
		$amount = $request->get_param( 'amount' );
		if ( ! is_numeric( $amount ) || (float) $amount < 0 || (float) $amount > 1000000000000 ) {
			return $this->error( 'donation_panel_bad_amount', 'Enter a number that is zero or more.', 400 );
		}
		$res = Campaign_Formula::set_carried( $product_id, (float) $amount, (int) get_current_user_id() );
		return rest_ensure_response(
			array(
				'carried'      => $res['new'],
				'carried_text' => $this->money( $res['new'] ),
				'stored'       => $res['stored'],
				'stored_text'  => $this->money( $res['stored'] ),
			) + $this->raised( $product_id )
		);
	}

	/**
	 * POST .../manual: elle eklenen tutarı yazar (günlüklü; saklanan toplamı değiştirmez, gösterilen toplama eklenir).
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_manual( $request ) {
		$guard = $this->guard( $request, 'campaign_manual', 30 );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$product_id = $this->product_id( $request );
		if ( is_wp_error( $product_id ) ) {
			return $product_id;
		}
		$amount = $request->get_param( 'amount' );
		if ( ! is_numeric( $amount ) || (float) $amount < 0 || (float) $amount > 1000000000000 ) {
			return $this->error( 'donation_panel_bad_amount', 'Enter a number that is zero or more.', 400 );
		}
		$res = Campaign_Formula::set_manual( $product_id, (float) $amount, (int) get_current_user_id() );
		return rest_ensure_response(
			array(
				'manual'      => $res['new'],
				'manual_text' => $this->money( $res['new'] ),
			) + $this->raised( $product_id )
		);
	}

	/**
	 * Gösterilen toplam (saklanan + elle eklenen) ve bekleme durumu.
	 *
	 * @param int $product_id Ürün.
	 * @return array<string, mixed>
	 */
	private function raised( $product_id ) {
		return array(
			'raised_text' => $this->money( (float) \DonationPanel\Domain\Campaign_Totals::get_total_donation_amount( $product_id ) ),
			'pending'     => Campaign_Formula::is_pending( $product_id ),
		);
	}

	/**
	 * Ortak denetimler: nonce + hız sınırı.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @param string           $bucket  Hız sınırı kovası.
	 * @param int              $limit   Dakikada üst sınır.
	 * @return true|\WP_Error
	 */
	private function guard( $request, $bucket, $limit ) {
		$nonce = $this->verify_nonce( $request );
		if ( is_wp_error( $nonce ) ) {
			return $nonce;
		}
		$throttled = $this->throttle( $bucket, $limit );
		return is_wp_error( $throttled ) ? $throttled : true;
	}

	/**
	 * Ürün kimliği: var olan bir WooCommerce ürünü olmalı.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return int|\WP_Error
	 */
	private function product_id( $request ) {
		$id = absint( $request->get_param( 'id' ) );
		if ( $id < 1 || 'product' !== get_post_type( $id ) ) {
			return $this->error( 'donation_panel_no_product', 'Product not found.', 404 );
		}
		return $id;
	}

	/**
	 * `from` / `to` (Y-m-d, site saat dilimi) -> Unix.
	 *
	 * @param \WP_REST_Request $request Istek.
	 * @return array{from:int|null,to:int|null}|\WP_Error
	 */
	private function range( $request ) {
		$out = array(
			'from' => null,
			'to'   => null,
		);
		foreach ( array(
			'from' => false,
			'to'   => true,
		) as $key => $end_of_day ) {
			$raw = $request->get_param( $key );
			if ( null === $raw || '' === $raw ) {
				continue;
			}
			$ts = Campaign_Formula::parse_date( $raw, $end_of_day );
			if ( null === $ts ) {
				return $this->error( 'donation_panel_bad_date', 'Dates must look like 2026-01-31.', 400 );
			}
			$out[ $key ] = $ts;
		}
		if ( null !== $out['from'] && null !== $out['to'] && $out['from'] > $out['to'] ) {
			return $this->error( 'donation_panel_bad_range', 'The start date must not be after the end date.', 400 );
		}
		return $out;
	}

	/**
	 * Yanıt: sayılar + biçimli metinler (yazılacak tutarın kendisi, kişisel veri yok).
	 *
	 * @param array<string, mixed> $r Formül sonucu.
	 * @return array<string, mixed>
	 */
	private function present( array $r ) {
		$stored = array_key_exists( 'stored', $r ) ? $r['stored'] : null;
		$diff   = array_key_exists( 'diff', $r ) ? $r['diff'] : null;
		return array(
			'stored'        => $stored,
			'stored_text'   => null === $stored ? '' : $this->money( (float) $stored ),
			'computed'      => (float) $r['computed'],
			'computed_text' => $this->money( (float) $r['computed'] ),
			'diff'          => $diff,
			'diff_text'     => null === $diff ? '' : $this->money( (float) $diff ),
			'carried'       => (float) $r['carried'],
			'carried_text'  => $this->money( (float) $r['carried'] ),
			'new_sum'       => (float) $r['new_sum'],
			'orders'        => (int) $r['orders'],
			'unconverted'   => (int) $r['unconverted'],
			'from'          => null === $r['from'] ? '' : wp_date( 'Y-m-d', (int) $r['from'] ),
			'to'            => null === $r['to'] ? '' : wp_date( 'Y-m-d', (int) $r['to'] ),
		);
	}

	/**
	 * Tutar metni (mağaza para birimi ve ayarlarıyla).
	 *
	 * @param float $amount Tutar.
	 * @return string
	 */
	private function money( $amount ) {
		if ( function_exists( 'wc_price' ) ) {
			return html_entity_decode( wp_strip_all_tags( (string) wc_price( $amount ) ), ENT_QUOTES, 'UTF-8' );
		}
		return (string) $amount;
	}
}
