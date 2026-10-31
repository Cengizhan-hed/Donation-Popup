<?php
/**
 * Yalnız birim testi (WP yüklemez): stdin'deki `{"<id>": "<html>"}` formlarını `Form_Pack` ile kodlayıp paketi yazar.
 * `list-pack.test.mjs` PHP kodlayıcı ↔ JS çözücü uyumunu bununla sınar.
 *
 *   php tests/unit/js/form-pack-encode.php < forms.json
 */
define( 'ABSPATH', __DIR__ . '/' );
if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * @param mixed $data    Veri.
	 * @param int   $options Seçenekler.
	 * @return string|false
	 */
	function wp_json_encode( $data, $options = 0 ) {
		return json_encode( $data, $options );
	}
}
require dirname( __DIR__, 3 ) . '/src/Modules/EntryPoints/class-form-pack.php';

$forms = json_decode( (string) file_get_contents( 'php://stdin' ), true );
$pack  = new \DonationPanel\Modules\EntryPoints\Form_Pack();
$added = array();
foreach ( (array) $forms as $id => $html ) {
	$added[ $id ] = $pack->add( (int) $id, (string) $html );
}
$data          = $pack->to_array();
$data['kind']  = 'popup';
$data['added'] = $added;
echo \DonationPanel\Modules\EntryPoints\Form_Pack::json( $data ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
