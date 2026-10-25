<?php
/**
 * Kampanya ilerleme kartı çıktısı (sunucu tarafında tam; ön yüz yalnız canlandırır ve tazeler).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Campaign;

defined( 'ABSPATH' ) || exit;

/**
 * Progress_Renderer.
 */
final class Progress_Renderer {

	/**
	 * Tutarı Woo biçimiyle düz metne çevirir.
	 *
	 * @param float $amount Gösterim birimindeki tutar.
	 * @return string
	 */
	public static function money( $amount ) {
		$html = function_exists( 'wc_price' ) ? (string) wc_price( (float) $amount ) : (string) $amount;
		return trim( html_entity_decode( wp_strip_all_tags( $html ), ENT_QUOTES, 'UTF-8' ) );
	}

	/**
	 * İlerleme kartı HTML'i.
	 *
	 * @param array<string, mixed> $data  Progress_Data çıktısı.
	 * @param array<string, bool>  $show  `milestones`, `donors` bayrakları.
	 * @return string
	 */
	public static function render( array $data, array $show = array() ) {
		$show       = array_merge(
			array(
				'milestones' => true,
				'donors'     => true,
			),
			$show
		);
		$percent    = (float) $data['percent'];
		$reached    = ! empty( $data['reached'] );
		$currency   = (array) $data['currency'];
		$milestones = $show['milestones'] ? (array) $data['milestones'] : array();

		$percent_text = ( floor( $percent ) === $percent ? (string) (int) $percent : (string) $percent ) . '%';

		ob_start();
		?>
<div class="dp dp-progress<?php echo $reached ? ' is-complete' : ''; ?>" data-dp-progress data-product-id="<?php echo esc_attr( (string) (int) $data['product_id'] ); ?>" data-percent="<?php echo esc_attr( (string) $percent ); ?>" data-raised="<?php echo esc_attr( (string) $data['raised'] ); ?>" data-symbol="<?php echo esc_attr( (string) $currency['symbol'] ); ?>" data-decimals="<?php echo esc_attr( (string) (int) $currency['decimals'] ); ?>">
	<div class="dp-progress__nums">
		<span class="dp-progress__raised dp-num" data-dp-raised><?php echo esc_html( self::money( (float) $data['raised'] ) ); ?></span>
		<span class="dp-progress__goal">
			<?php
			/* translators: %s: formatted goal amount */
			echo esc_html( sprintf( __( 'of %s goal', 'woo-donation-popup' ), self::money( (float) $data['goal'] ) ) );
			?>
		</span>
	</div>
	<div class="dp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) $percent ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>">
		<div class="dp-bar__fill" style="--p:<?php echo esc_attr( (string) $percent ); ?>"></div>
		<?php foreach ( $milestones as $milestone ) : ?>
			<span class="dp-bar__ms<?php echo ! empty( $milestone['hit'] ) ? ' is-hit' : ''; ?>" style="--at:<?php echo esc_attr( (string) $milestone['at'] ); ?>" data-dp-ms="<?php echo esc_attr( (string) $milestone['at'] ); ?>">
				<svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>
				<span class="dp-bar__ms-label"><?php echo esc_html( (string) $milestone['label'] ); ?></span>
			</span>
		<?php endforeach; ?>
	</div>
	<div class="dp-stats"<?php echo $milestones ? ' style="margin-block-start:14px"' : ''; ?>>
		<span><b class="dp-num" data-dp-percent><?php echo esc_html( $percent_text ); ?></b> <?php esc_html_e( 'funded', 'woo-donation-popup' ); ?></span>
		<?php if ( $show['donors'] && (int) $data['donors'] > 0 ) : ?>
			<span data-dp-donors>
				<?php
				echo esc_html(
					sprintf(
						/* translators: %s: number of donors, already formatted */
						_n( '%s supporter', '%s supporters', (int) $data['donors'], 'woo-donation-popup' ),
						number_format_i18n( (int) $data['donors'] )
					)
				);
				?>
			</span>
		<?php endif; ?>
		<?php if ( $reached ) : ?>
			<span class="dp-badge dp-badge--success" data-dp-reached><?php esc_html_e( 'Goal reached', 'woo-donation-popup' ); ?></span>
		<?php else : ?>
			<span class="dp-badge dp-badge--success" data-dp-reached hidden><?php esc_html_e( 'Goal reached', 'woo-donation-popup' ); ?></span>
		<?php endif; ?>
	</div>
</div>
		<?php
		return (string) ob_get_clean();
	}
}
