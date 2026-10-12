<?php
/**
 * Bağış formu içerik modüllerinin varsayılan sırası ve etiketleri.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	'order'  => array(
		'media',
		'impact',
		'urgency',
		'social_proof',
		'progress',
		'donor',
		'dedication',
		'amount',
		'cover_fee',
		'faq',
		'sadaka',
		'trust',
	),
	'labels' => array(
		'media'        => 'Kampanya medyası',
		'impact'       => 'Etki satırı',
		'urgency'      => 'Aciliyet şeridi',
		'social_proof' => 'Sosyal kanıt',
		'progress'     => 'Progress bar',
		'amount'       => 'Tutar / adet',
		'donor'        => 'Bağışçı alanları',
		'dedication'   => 'İthaf / anonim',
		'cover_fee'    => 'İşlem ücreti',
		'faq'          => 'SSS',
		'sadaka'       => 'Alt bağış',
		'trust'        => 'Güven rozetleri',
	),
);
