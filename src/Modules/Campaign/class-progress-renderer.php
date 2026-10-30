<?php
/**
 * Kampanya ilerleme kartı çıktısı (sunucu tarafında tam; ön yüz yalnız canlandırır, tazeler ve kişisel önizleme ekler).
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
	 * Tutarı Woo biçimiyle düz metne çevirir (tam sayıda ondalık yok).
	 *
	 * @param float $amount Gösterim birimindeki tutar.
	 * @return string
	 */
	public static function money( $amount ) {
		return Progress_Live::money( $amount );
	}

	/**
	 * İlerleme kartı HTML'i.
	 *
	 * @param array<string, mixed>               $data    Progress_Data çıktısı.
	 * @param array<string, bool>                $show    `milestones`, `donors` bayrakları.
	 * @param array{p: int, c: int, k: int}|null $options Canlı çubuk ayarları (null: kayıtlı ayarlar).
	 * @return string
	 */
	public static function render( array $data, array $show = array(), $options = null ) {
		$show       = array_merge(
			array(
				'milestones' => true,
				'donors'     => true,
			),
			$show
		);
		$percent    = round( Progress_Live::exact_percent( $data ), 2 );
		$reached    = ! empty( $data['reached'] );
		$zero       = ! ( (float) $data['raised'] > 0 );
		$milestones = $show['milestones'] ? (array) $data['milestones'] : array();
		$live       = Progress_Live::config( $data, true, $options, 1 );
		$donors     = $show['donors'] ? (int) $data['donors'] : 0;

		ob_start();
		?>
<div class="donation-panel donation-panel-progress<?php echo $reached ? ' is-complete' : ''; ?><?php echo $milestones ? ' donation-panel-progress--ms' : ''; ?><?php echo esc_attr( Progress_Live::root_class( $live ) ); ?>" data-dp-progress data-product-id="<?php echo esc_attr( (string) (int) $data['product_id'] ); ?>"<?php echo Progress_Live::attr( $live ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- attr() kaçışlıdır. ?>>
	<div class="donation-panel-progress__nums">
		<span class="donation-panel-progress__raised donation-panel-num" data-dp-live-raised><?php echo esc_html( self::money( (float) $data['raised'] ) ); ?></span>
		<span class="donation-panel-progress__goal">
			<?php
			/* translators: %s: formatted goal amount */
			echo esc_html( sprintf( __( 'of %s goal', 'woo-donation-popup' ), self::money( (float) $data['goal'] ) ) );
			?>
		</span>
	</div>
	<div class="donation-panel-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?php echo esc_attr( (string) (int) floor( $percent ) ); ?>" aria-valuetext="<?php echo esc_attr( Progress_Live::value_text( $data, 1 ) ); ?>" aria-label="<?php esc_attr_e( 'Goal completion rate', 'woo-donation-popup' ); ?>">
		<span class="donation-panel-bar__clip" data-dp-live-bar><i class="donation-panel-live__fill" data-dp-live-fill style="--p:<?php echo esc_attr( (string) $percent ); ?>"></i></span>
		<?php foreach ( $milestones as $milestone ) : ?>
			<span class="donation-panel-bar__ms<?php echo ! empty( $milestone['hit'] ) ? ' is-hit' : ''; ?>" style="--at:<?php echo esc_attr( (string) $milestone['at'] ); ?>" data-dp-ms="<?php echo esc_attr( (string) $milestone['at'] ); ?>"<?php echo $milestone['at'] >= 88 ? ' data-dp-edge="end"' : ( $milestone['at'] <= 12 ? ' data-dp-edge="start"' : '' ); ?>>
				<svg class="donation-panel-ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>
				<span class="donation-panel-bar__ms-label"><?php echo esc_html( (string) $milestone['label'] ); ?></span>
			</span>
		<?php endforeach; ?>
	</div>
	<div class="donation-panel-stats"<?php echo $milestones ? ' style="margin-block-start:14px"' : ''; ?>>
		<span data-dp-live-zero="hide"<?php echo $zero ? ' hidden' : ''; ?>><b class="donation-panel-num" data-dp-live-pct><?php echo esc_html( Progress_Live::percent_text( $percent, 1 ) ); ?></b> <?php esc_html_e( 'funded', 'woo-donation-popup' ); ?></span>
		<span class="donation-panel-progress__meta" data-dp-live-meta>
			<span class="donation-panel-progress__first" data-dp-live-zero="show"<?php echo $zero ? '' : ' hidden'; ?>><?php echo esc_html( Progress_Live::first_text() ); ?></span>
			<?php if ( $show['donors'] ) : ?>
				<span data-dp-live-donors data-one="<?php /* translators: %s: number of donors, already formatted */ echo esc_attr( _n( '%s supporter', '%s supporters', 1, 'woo-donation-popup' ) ); ?>" data-many="<?php /* translators: %s: number of donors, already formatted */ echo esc_attr( _n( '%s supporter', '%s supporters', 2, 'woo-donation-popup' ) ); ?>"<?php echo $donors > 0 ? '' : ' hidden'; ?>>
					<?php
					echo esc_html(
						sprintf(
							/* translators: %s: number of donors, already formatted */
							_n( '%s supporter', '%s supporters', max( 1, $donors ), 'woo-donation-popup' ),
							number_format_i18n( $donors )
						)
					);
					?>
				</span>
			<?php endif; ?>
			<span class="donation-panel-badge donation-panel-badge--success" data-dp-reached<?php echo $reached ? '' : ' hidden'; ?>><?php esc_html_e( 'Goal reached', 'woo-donation-popup' ); ?></span>
		</span>
	</div>
</div>
		<?php
		return (string) ob_get_clean();
	}
}
