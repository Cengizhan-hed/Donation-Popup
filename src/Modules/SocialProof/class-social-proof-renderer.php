<?php
/**
 * Sosyal kanıt çıktısı: tek satır, sayaç şeridi, canlı liste (tasarım: design/social.html).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\SocialProof;

use DonationPanel\Modules\Campaign\Progress_Renderer;

defined( 'ABSPATH' ) || exit;

/**
 * Social_Proof_Renderer.
 */
final class Social_Proof_Renderer {

	/**
	 * Geçerli görünümler.
	 *
	 * @var string[]
	 */
	const VARIANTS = array( 'line', 'counters', 'feed' );

	/**
	 * Görünüm adını doğrular.
	 *
	 * @param string $variant Ham değer.
	 * @return string
	 */
	public static function sanitize_variant( $variant ) {
		$variant = sanitize_key( (string) $variant );
		return in_array( $variant, self::VARIANTS, true ) ? $variant : 'line';
	}

	/**
	 * HTML üretir; gösterilecek gerçek veri yoksa boş döner (boş "sıfır bağış" gösterilmez).
	 *
	 * @param string               $variant    line|counters|feed.
	 * @param int                  $product_id Ürün (0 = tümü).
	 * @param array<string, mixed> $stats      Donation_Feed::stats çıktısı.
	 * @param array<string, mixed> $feed       Donation_Feed::page çıktısı (yalnız feed).
	 * @return string
	 */
	public static function render( $variant, $product_id, array $stats, array $feed = array() ) {
		$variant = self::sanitize_variant( $variant );
		if ( 'feed' === $variant ) {
			return empty( $feed['items'] ) ? '' : self::feed( $product_id, $feed );
		}
		if ( (int) $stats['donors'] < 1 ) {
			return '';
		}
		return 'counters' === $variant ? self::counters( $product_id, $stats ) : self::line( $product_id, $stats );
	}

	/**
	 * A: tek satır.
	 *
	 * @param int                  $product_id Ürün.
	 * @param array<string, mixed> $stats      Sayılar.
	 * @return string
	 */
	private static function line( $product_id, array $stats ) {
		ob_start();
		?>
<p class="donation-panel donation-panel-social donation-panel-social--line" data-dp-social="line" data-product-id="<?php echo esc_attr( (string) (int) $product_id ); ?>">
	<span class="donation-panel-social__dot" aria-hidden="true"></span>
	<span>
		<?php
		echo esc_html(
			sprintf(
				/* translators: %s: number of donors, already formatted */
				_n( '%s person has donated', '%s people have donated', (int) $stats['donors'], 'woo-donation-popup' ),
				number_format_i18n( (int) $stats['donors'] )
			)
		);
		if ( (int) $stats['today'] > 0 ) {
			echo ' · ';
			echo esc_html(
				sprintf(
					/* translators: %s: number of donations today, already formatted */
					__( '%s today', 'woo-donation-popup' ),
					number_format_i18n( (int) $stats['today'] )
				)
			);
		}
		?>
	</span>
</p>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * B: sayaç şeridi.
	 *
	 * @param int                  $product_id Ürün.
	 * @param array<string, mixed> $stats      Sayılar.
	 * @return string
	 */
	private static function counters( $product_id, array $stats ) {
		$cells = array(
			array( number_format_i18n( (int) $stats['donors'] ), __( 'donors', 'woo-donation-popup' ) ),
			array( number_format_i18n( (int) $stats['today'] ), __( 'today', 'woo-donation-popup' ) ),
			array( Progress_Renderer::money( (float) $stats['raised'] ), __( 'raised', 'woo-donation-popup' ) ),
		);
		ob_start();
		?>
<div class="donation-panel donation-panel-social donation-panel-social--counters" data-dp-social="counters" data-product-id="<?php echo esc_attr( (string) (int) $product_id ); ?>">
		<?php foreach ( $cells as $cell ) : ?>
	<div class="donation-panel-social__cell"><b class="donation-panel-num"><?php echo esc_html( (string) $cell[0] ); ?></b><span><?php echo esc_html( (string) $cell[1] ); ?></span></div>
	<?php endforeach; ?>
</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * C: canlı liste.
	 *
	 * @param int                  $product_id Ürün.
	 * @param array<string, mixed> $feed       Sayfa verisi.
	 * @return string
	 */
	private static function feed( $product_id, array $feed ) {
		ob_start();
		?>
<div class="donation-panel donation-panel-social donation-panel-social--feed" data-dp-social="feed" data-product-id="<?php echo esc_attr( (string) (int) $product_id ); ?>" data-page="<?php echo esc_attr( (string) (int) $feed['page'] ); ?>" data-per-page="<?php echo esc_attr( (string) (int) $feed['per_page'] ); ?>" data-anon="<?php echo esc_attr__( 'A kind donor', 'woo-donation-popup' ); ?>">
	<ul class="donation-panel-list" data-dp-feed-list>
		<?php foreach ( (array) $feed['items'] as $item ) : ?>
			<?php self::row( (array) $item ); ?>
		<?php endforeach; ?>
	</ul>
	<button type="button" class="donation-panel-btn donation-panel-btn--ghost" data-dp-feed-more<?php echo empty( $feed['has_more'] ) ? ' hidden' : ''; ?>><?php esc_html_e( 'Show more', 'woo-donation-popup' ); ?></button>
</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * Tek liste satırı.
	 *
	 * @param array<string, mixed> $item Girdi (Donation_Feed::format_entry).
	 * @return void
	 */
	private static function row( array $item ) {
		$name = (string) $item['name'];
		?>
		<li class="donation-panel-list__row">
			<span class="donation-panel-avatar" aria-hidden="true"><?php echo '' !== $name ? esc_html( function_exists( 'mb_substr' ) ? mb_substr( $name, 0, 1, 'UTF-8' ) : substr( $name, 0, 1 ) ) : '&#9825;'; ?></span>
			<div class="donation-panel-list__t"><b><?php echo esc_html( '' !== $name ? $name : __( 'A kind donor', 'woo-donation-popup' ) ); ?></b><small><?php echo esc_html( (string) $item['ago'] ); ?></small></div>
			<span class="donation-panel-num"><?php echo esc_html( (string) $item['label'] ); ?></span>
		</li>
		<?php
	}
}
