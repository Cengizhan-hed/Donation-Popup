<?php
/**
 * Müşteri e-postalarında (işleniyor / tamamlandı) sipariş tablosunun üstünde kısa teşekkür bölümü.
 *
 * - Metin, teşekkür ekranıyla AYNI kaynaktan: `thanks.message` (boşsa yerleşik söz) → `Thanks_Summary::message`.
 * - Kampanyalı üründe TEK satır: toplanan / hedef (e-posta anındaki değer, WooCommerce para biçimi).
 * - Görsel ve satır içi stil yok: düz paragraf; WooCommerce e-posta CSS'i uygulanır. Düz metin sürümü de çizilir.
 * - Yönetici e-postasına eklenmez. Ayardan kapatılabilir (`thanks.email`, varsayılan AÇIK). Teşekkür ekranı modülünden bağımsızdır.
 * - Bağış satırı olmayan siparişlerde hiçbir şey basılmaz.
 *
 * @package DonationPanel
 */

namespace DonationPanel\WooCommerce\Email;

use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\Campaign\Progress_Data;
use DonationPanel\Modules\Thanks\Thanks_Summary;

defined( 'ABSPATH' ) || exit;

/**
 * Email_Thanks.
 */
final class Email_Thanks {

	/**
	 * Teşekkür bölümü basılan müşteri e-postaları.
	 *
	 * @var string[]
	 */
	const EMAIL_IDS = array( 'customer_processing_order', 'customer_completed_order' );

	/**
	 * `woocommerce_email_before_order_table` geri çağrısı.
	 *
	 * @param mixed $order         Sipariş.
	 * @param mixed $sent_to_admin Yöneticiye mi.
	 * @param mixed $plain_text    Düz metin mi.
	 * @param mixed $email         WC_Email.
	 * @return void
	 */
	public static function render( $order = null, $sent_to_admin = false, $plain_text = false, $email = null ) {
		if ( $sent_to_admin || ! is_object( $order ) || ! is_object( $email ) || ! isset( $email->id ) || ! in_array( (string) $email->id, self::EMAIL_IDS, true ) ) {
			return;
		}
		$settings = self::settings();
		if ( null === $settings ) {
			return;
		}
		$parts = self::parts( $order, $settings );
		if ( ! $parts ) {
			return;
		}
		if ( $plain_text ) {
			echo self::plain( $parts ) . "\n\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Düz metin e-posta: plain() etiketleri ayıklar; HTML bağlamı yok.
			return;
		}
		echo self::html( $parts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- html() her parçayı kaçışlar / wp_kses ile sınırlar.
	}

	/**
	 * Çizilecek parçalar; ayar kapalıysa ya da bağış satırı yoksa boş dizi.
	 *
	 * @param object   $order    Sipariş.
	 * @param Settings $settings Ayarlar.
	 * @return array{message: string, campaign: array<string, string>}|array{}
	 */
	public static function parts( $order, Settings $settings ) {
		if ( ! (bool) $settings->get( 'thanks.email', true ) ) {
			return array();
		}
		$summary = Thanks_Summary::build( $order );
		if ( ! $summary ) {
			return array();
		}
		return array(
			'message'  => Thanks_Summary::message( (string) $settings->get( 'thanks.message', '' ) ),
			'campaign' => self::campaign( $summary, $settings ),
		);
	}

	/**
	 * İlk kampanyalı bağış satırı için toplanan/hedef bilgisi (yoksa boş).
	 *
	 * @param array<string, mixed> $summary  `Thanks_Summary::build` çıktısı.
	 * @param Settings             $settings Ayarlar.
	 * @return array<string, string> project, raised (HTML), goal (HTML); boş dizi: satır yok.
	 */
	private static function campaign( array $summary, Settings $settings ) {
		if ( ! $settings->module_enabled( 'campaign', true ) ) {
			return array();
		}
		foreach ( (array) $summary['lines'] as $line ) {
			$data = Progress_Data::for_product( (int) $line['product_id'] );
			if ( ! is_array( $data ) || empty( $data['goal'] ) ) {
				continue;
			}
			$code  = isset( $data['currency']['code'] ) ? (string) $data['currency']['code'] : (string) $summary['currency'];
			$money = static function ( $amount ) use ( $code ) {
				return function_exists( 'wc_price' ) ? wc_price( (float) $amount, array( 'currency' => $code ) ) : esc_html( (string) $amount );
			};
			return array(
				'project' => (string) $line['project'],
				'raised'  => (string) $money( $data['raised'] ),
				'goal'    => (string) $money( $data['goal'] ),
			);
		}
		return array();
	}

	/**
	 * Kampanya satırı metni (HTML kaçışlı ya da düz).
	 *
	 * @param array<string, string> $campaign Kampanya parçası.
	 * @param bool                  $plain    Düz metin.
	 * @return string
	 */
	public static function campaign_line( array $campaign, $plain ) {
		if ( ! $campaign ) {
			return '';
		}
		/* translators: 1: campaign name, 2: amount raised so far, 3: goal amount. */
		$format = __( '%1$s: %2$s raised of %3$s goal so far.', 'woo-donation-popup' );
		if ( $plain ) {
			$raised = html_entity_decode( wp_strip_all_tags( $campaign['raised'] ), ENT_QUOTES, 'UTF-8' );
			$goal   = html_entity_decode( wp_strip_all_tags( $campaign['goal'] ), ENT_QUOTES, 'UTF-8' );
			return sprintf( $format, wp_strip_all_tags( $campaign['project'] ), $raised, $goal );
		}
		return sprintf( $format, esc_html( $campaign['project'] ), $campaign['raised'], $campaign['goal'] );
	}

	/**
	 * HTML bölümü: düz paragraflar (satır içi stil yok).
	 *
	 * @param array<string, mixed> $parts `parts` çıktısı.
	 * @return string
	 */
	public static function html( array $parts ) {
		$allowed = array(
			'a'      => array(
				'href'   => true,
				'target' => true,
				'rel'    => true,
			),
			'strong' => array(),
			'b'      => array(),
			'em'     => array(),
			'i'      => array(),
			'br'     => array(),
		);
		$html    = wpautop( wp_kses( (string) $parts['message'], $allowed ) );
		$line    = self::campaign_line( (array) $parts['campaign'], false );
		if ( '' !== $line ) {
			$html .= '<p>' . wp_kses_post( $line ) . '</p>';
		}
		return $html;
	}

	/**
	 * Düz metin bölümü.
	 *
	 * @param array<string, mixed> $parts `parts` çıktısı.
	 * @return string
	 */
	public static function plain( array $parts ) {
		$message = preg_replace( '#<br\s*/?>#i', "\n", (string) $parts['message'] );
		$text    = html_entity_decode( wp_strip_all_tags( (string) $message ), ENT_QUOTES, 'UTF-8' );
		$line    = self::campaign_line( (array) $parts['campaign'], true );
		return '' !== $line ? $text . "\n\n" . $line : $text;
	}

	/**
	 * Ayarlar (eklenti kapsayıcısından).
	 *
	 * @return Settings|null
	 */
	private static function settings() {
		$plugin = Plugin::instance();
		if ( null === $plugin ) {
			return null;
		}
		$settings = $plugin->container()->get( Settings::class );
		return $settings instanceof Settings ? $settings : null;
	}
}
