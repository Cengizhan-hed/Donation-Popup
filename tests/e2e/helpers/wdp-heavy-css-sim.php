<?php
/**
 * Yalnız yerel ölçüm (12.2 openperf): ağır tema CSS'i ve kalabalık DOM benzetimi (mu-plugin). Tema/oluşturucu adı yok.
 *
 * Girdi: wp-content/wdp-heavy-css.json
 *   {"rules": 3000, "nodes": 1000, "sticky": 1}
 *   - rules : `.x-N .y-N > div:not(.z-N)` biçiminde N genel kural + yaygın evrensel/öznitelik seçicileri
 *             (her zorunlu stil yeniden hesaplamasını pahalılaştırır; eklenti öğelerine görsel etki yapmaz).
 *   - nodes : sayfa sonuna görünmez olmayan (yüksekliği 0, taşması gizli) N dolgu düğümü (kalabalık DOM).
 *   - sticky: üstte sabit (position: fixed) 72 px üstbilgi (dokunma hedefini örtebilen genel durum).
 * Dosya yoksa ya da boşsa hiçbir şey yapmaz.
 */
$wdp_heavy = json_decode( (string) @file_get_contents( WP_CONTENT_DIR . '/wdp-heavy-css.json' ), true ); // phpcs:ignore

if ( is_array( $wdp_heavy ) && ! empty( $wdp_heavy ) && ! is_admin() ) {
	$wdp_heavy_rules = isset( $wdp_heavy['rules'] ) ? max( 0, (int) $wdp_heavy['rules'] ) : 0;
	$wdp_heavy_nodes = isset( $wdp_heavy['nodes'] ) ? max( 0, (int) $wdp_heavy['nodes'] ) : 0;
	$wdp_heavy_stick = ! empty( $wdp_heavy['sticky'] );
	// smooth: yumuşak kaydırma (temalarda yaygın; scrollIntoView iki karede bitmez). scrollbox: iç kaydırma kabı (kök taşmayı
	// gizler, belge gövdesi kendi içinde kayar; pencere kaydırması etkisiz).
	$wdp_heavy_extra = ( ! empty( $wdp_heavy['smooth'] ) ? 'html,body{scroll-behavior:smooth}' : '' ) . ( ! empty( $wdp_heavy['scrollbox'] ) ? 'html{overflow:hidden;height:100%}body{height:100%;overflow-y:auto;margin:0}' : '' );

	add_action(
		'wp_head',
		static function () use ( $wdp_heavy_rules, $wdp_heavy_stick, $wdp_heavy_extra ) {
			if ( '' !== $wdp_heavy_extra ) {
				echo '<style id="sim-scroll-css">' . $wdp_heavy_extra . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput
			}
			$css = array();
			// Evrensel ve öznitelik alt dizgesi seçicileri: her öğe için denenir.
			$css[] = '*{-webkit-tap-highlight-color:transparent}';
			$css[] = '*,*::before,*::after{box-sizing:border-box}';
			$css[] = '[class*="sim-col-"]{float:left}';
			$css[] = 'div[class*="-wrapper"] span:not(.sim-a){letter-spacing:normal}';
			$css[] = 'body:not(.sim-off) [class*="sim-"] > *:not(.sim-b){outline:0}';
			// Kök öğe sınıfı / odak / bağlantı durumu / :has() bağımlı genel kurallar (temalarda yaygın): kök sınıfı
			// değişince, odak taşınınca ya da adres (history) değişince geniş stil geçersizlemesi doğurur.
			$css[] = 'html[class*="-lock"] body div:not(.sim-c){scroll-margin-top:0}';
			$css[] = 'body:focus-within div[class] > span:not(.sim-d){text-decoration-skip-ink:auto}';
			$css[] = 'a:visited span,a:any-link div{text-underline-offset:auto}';
			$css[] = ':target ~ div,:target div{scroll-margin-top:72px}';
			$css[] = 'body:has(dialog[open]) div:not(.sim-e) > p{orphans:2}';
			for ( $i = 0; $i < $wdp_heavy_rules; $i++ ) {
				$css[] = '.x-' . $i . ' .y-' . $i . ' > div:not(.z-' . $i . '){margin:0;padding:' . ( $i % 7 ) . 'px}';
				if ( 0 === $i % 10 ) {
					$css[] = '[class*="k-' . $i . '"] a:not([href*="sim"]){color:inherit}';
					$css[] = 'section:not(.s-' . $i . ') :is(p,li,span).t-' . $i . '{line-height:1.6}';
				}
			}
			if ( $wdp_heavy_stick ) {
				$css[] = '.sim-sticky-header{position:fixed;top:0;left:0;right:0;height:72px;z-index:9990;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15);display:flex;align-items:center;padding:0 16px}';
				$css[] = 'body{padding-top:72px}';
			}
			echo '<style id="sim-heavy-css">' . implode( "\n", $css ) . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput
		},
		1
	);

	add_action(
		'wp_footer',
		static function () use ( $wdp_heavy_nodes, $wdp_heavy_stick ) {
			if ( $wdp_heavy_stick ) {
				echo '<div class="sim-sticky-header"><b>Site</b>&nbsp;<a href="#">Menu</a></div>';
			}
			if ( $wdp_heavy_nodes > 0 ) {
				echo '<div class="sim-fill-wrapper" style="height:0;overflow:hidden" aria-hidden="true">';
				for ( $i = 0; $i < $wdp_heavy_nodes; $i++ ) {
					echo '<div class="sim-col-' . ( $i % 12 ) . ' x-' . ( $i % 50 ) . '"><span class="t-' . ( $i % 30 ) . '">.</span></div>';
				}
				echo '</div>';
			}
		},
		1
	);
}
