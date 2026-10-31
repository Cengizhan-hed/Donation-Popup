<?php
/**
 * Yalnız yerel e2e (12.2 fouc): ilk boyama test sayfaları (mu-plugin). Tema/oluşturucu adı yok; yalnız kısa kodlar.
 *
 *   /?dp_fp=page&dp_product=ID&dp_fixed=ID&dp_campaign=ID  -> hesap simgesi + yan sepet + tetikleyici + kampanya çubuğu +
 *                                                            sosyal kanıt + sayfa içi form + bağış listesi + slider + AJAX kabı
 *   /?dp_fp=slider&dp_fixed=ID                              -> yalnız gizli kap (500 ms sonra görünür) içinde form
 *   /?dp_fp=ajax&dp_fixed=ID                                -> yalnız boş kap; form HTML'i fetch + innerHTML ile gelir
 *   /?dp_fp=fragment&dp_fixed=ID                            -> yalnız kısa kod çıktısı (wp_head/wp_footer yok)
 *   /?dp_fp=trigger&dp_product=ID                           -> yalnız açma düğmesi (popup)
 *   /?dp_fp=single&dp_fixed=ID                              -> tek adımlı sayfa içi form (ek adımlar süzülür)
 *   /?dp_fp=compact&dp_product=ID&dp_campaign=ID            -> compact kart (görünür) + gizli kapta compact kart (slider)
 *   /?dp_fp=order&dp_order=cfhlsakp&…                       -> yüzeyler verilen harf sırasıyla (stil sıra bağımsızlığı)
 */
add_action(
	'template_redirect',
	static function () {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( ! isset( $_GET['dp_fp'] ) ) {
			return;
		}
		$view  = sanitize_key( (string) $_GET['dp_fp'] );
		$id    = isset( $_GET['dp_product'] ) ? (int) $_GET['dp_product'] : 0;
		$fixed = isset( $_GET['dp_fixed'] ) ? (int) $_GET['dp_fixed'] : $id;
		$cmp   = isset( $_GET['dp_campaign'] ) ? (int) $_GET['dp_campaign'] : $id;
		// phpcs:enable
		nocache_headers();
		if ( 'single' === $view ) {
			// Tek adımlı form benzetimi: ek modül adımları (ör. vergi beyanı) olmayan sitedeki sabit tutarlı ürün → yalnız
			// "details" adımı (ilk adım = son adım; düğme "%s bağışla").
			add_filter(
				'donation_panel_form_steps',
				static function ( $steps ) {
					return array_values(
						array_filter(
							(array) $steps,
							static function ( $step ) {
								return in_array( $step['id'], array( 'amount', 'details' ), true );
							}
						)
					);
				},
				99
			);
		}
		if ( 'fragment' === $view ) {
			echo do_shortcode( '[donation_panel_experience id="' . $fixed . '" kind="inline"]' ); // phpcs:ignore
			exit;
		}
		$self = esc_url_raw( add_query_arg( array( 'dp_fp' => 'fragment', 'dp_fixed' => $fixed ), home_url( '/' ) ) );
		echo '<!doctype html><html ' . get_language_attributes() . '><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>First paint e2e</title>'; // phpcs:ignore
		wp_head();
		echo '</head><body><header style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px"><b>Site</b>';
		if ( 'page' === $view ) {
			echo do_shortcode( '[donation_panel_account][donation_panel_side_cart]' ); // phpcs:ignore
		}
		echo '</header><main style="padding:16px"><h1>Test</h1><p>Sayfa metni.</p>';
		if ( 'page' === $view || 'trigger' === $view ) {
			echo '<section id="fp-trigger">' . do_shortcode( '[donation_panel_experience id="' . $id . '" kind="popup"]' ) . '</section>'; // phpcs:ignore
		}
		if ( 'page' === $view ) {
			echo '<section id="fp-progress">' . do_shortcode( '[donation_panel_progress id="' . $cmp . '"]' ) . '</section>'; // phpcs:ignore
			echo '<section id="fp-social">' . do_shortcode( '[donation_panel_social_proof id="' . $cmp . '" variant="counters"]' ) . '</section>'; // phpcs:ignore
			echo '<section id="fp-inline">' . do_shortcode( '[donation_panel_experience id="' . $id . '" kind="inline"]' ) . '</section>'; // phpcs:ignore
			echo '<section id="fp-list">' . do_shortcode( '[wdp_donations limit="3" button="link"]' ) . '</section>'; // phpcs:ignore
		}
		if ( 'order' === $view ) {
			// 122-cascade sıra bağımsızlığı: yüzeyler `dp_order` harf sırasıyla çizilir (satır içi stil basım sırası değişir).
			// c=kampanya çubuğu, f=sayfa içi form (sabit fiyatlı), h=sayfa içi form (serbest tutarlı), l=liste, s=yan sepet,
			// a=hesap simgesi, k=compact kart, p=sosyal kanıt.
			$order    = isset( $_GET['dp_order'] ) ? preg_replace( '/[^cfhlsakp]/', '', (string) $_GET['dp_order'] ) : 'cfl'; // phpcs:ignore WordPress.Security.NonceVerification, WordPress.Security.ValidatedSanitizedInput
			$surfaces = array(
				'c' => '[donation_panel_progress id="' . $cmp . '"]',
				'f' => '[donation_panel_experience id="' . $fixed . '" kind="inline"]',
				'h' => '[donation_panel_experience id="' . $id . '" kind="inline"]',
				'l' => '[wdp_donations limit="3" button="link"]',
				's' => '[donation_panel_side_cart]',
				'a' => '[donation_panel_account]',
				'k' => '[wdp_donation_form id="' . $cmp . '" layout="compact"]',
				'p' => '[donation_panel_social_proof id="' . $cmp . '" variant="counters"]',
			);
			foreach ( str_split( (string) $order ) as $key ) {
				echo '<section id="ord-' . esc_attr( $key ) . '">' . do_shortcode( $surfaces[ $key ] ) . '</section>'; // phpcs:ignore
			}
		}
		if ( 'form' === $view ) {
			echo do_shortcode( '[wdp_donation_form id="' . $id . '"]' ); // phpcs:ignore
		}
		if ( 'single' === $view ) {
			echo '<section id="fp-single">' . do_shortcode( '[donation_panel_experience id="' . $fixed . '" kind="inline"]' ) . '</section>'; // phpcs:ignore
		}
		if ( 'page' === $view || 'slider' === $view ) {
			// Slider benzetimi: kap gizli başlar, betik 500 ms sonra görünür yapar.
			echo '<section id="fp-slider" style="display:none">' . do_shortcode( '[donation_panel_experience id="' . $fixed . '" kind="inline"]' ) . '</section>'; // phpcs:ignore
			echo '<script>setTimeout(function(){document.getElementById("fp-slider").style.display="block";document.dispatchEvent(new Event("dp:scan"));},500);</script>';
		}
		if ( 'compact' === $view ) {
			// Compact kart: görünür kart + slider benzetimi (gizli kap 500 ms sonra görünür).
			echo '<section id="fp-compact">' . do_shortcode( '[wdp_donation_form id="' . $id . '" layout="compact"]' ) . '</section>'; // phpcs:ignore
			echo '<section id="fp-compact-slider" style="display:none">' . do_shortcode( '[wdp_donation_form id="' . $cmp . '" layout="compact"]' ) . '</section>'; // phpcs:ignore
			echo '<script>setTimeout(function(){document.getElementById("fp-compact-slider").style.display="block";document.dispatchEvent(new Event("dp:scan"));},500);</script>';
		}
		if ( 'page' === $view || 'ajax' === $view ) {
			// AJAX benzetimi: kısa kod HTML'i fetch ile alınır, innerHTML ile eklenir.
			echo '<section id="fp-ajax"></section>';
			echo '<script>setTimeout(function(){fetch(' . wp_json_encode( $self ) . ').then(function(r){return r.text();}).then(function(h){document.getElementById("fp-ajax").innerHTML=h;document.dispatchEvent(new Event("dp:scan"));});},300);</script>'; // phpcs:ignore
		}
		echo '<div style="height:40px"></div></main>';
		wp_footer();
		echo '</body></html>';
		exit;
	}
);
