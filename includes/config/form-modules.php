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
		'sadaka',
		'trust',
	),
	'labels' => array(
		'media'        => __('Campaign media', 'woo-donation-popup'),
		'impact'       => __('Impact line', 'woo-donation-popup'),
		'urgency'      => __('Urgency strip', 'woo-donation-popup'),
		'social_proof' => __('Social proof', 'woo-donation-popup'),
		'progress'     => __('Progress bar', 'woo-donation-popup'),
		'amount'       => __('Amount / quantity', 'woo-donation-popup'),
		'donor'        => __('Donor fields', 'woo-donation-popup'),
		'dedication'   => __('Dedication / anonymous', 'woo-donation-popup'),
		'cover_fee'    => __('Processing fee', 'woo-donation-popup'),
		'sadaka'       => __('Additional donation', 'woo-donation-popup'),
		'trust'        => __('Trust badges', 'woo-donation-popup'),
	),
);
