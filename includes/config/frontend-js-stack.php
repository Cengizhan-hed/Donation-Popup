<?php
/**
 * Frontend JS module stack — load order, paths, and WordPress dependencies.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	array(
		'handle' => 'wdp-constants-js',
		'file'   => 'src/core/constants.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-meta-tracking-js',
		'file'   => 'src/meta-tracking.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-utils-js',
		'file'   => 'src/core/utils.js',
		'deps'   => array(),
	),
	array(
		'handle' => 'wdp-state-js',
		'file'   => 'src/core/state.js',
		'deps'   => array('wdp-utils-js'),
	),
	array(
		'handle' => 'wdp-dom-js',
		'file'   => 'src/core/dom.js',
		'deps'   => array('wdp-state-js'),
	),
	array(
		'handle' => 'wdp-phone-input-js',
		'file'   => 'src/phone-input.js',
		'deps'   => array('wdp-utils-js'),
	),
	array(
		'handle' => 'wdp-product-js',
		'file'   => 'src/product.js',
		'deps'   => array('wdp-utils-js', 'wdp-state-js'),
	),
	array(
		'handle' => 'wdp-cart-js',
		'file'   => 'src/cart.js',
		'deps'   => array('wdp-utils-js', 'wdp-state-js'),
	),
	array(
		'handle' => 'wdp-form-js',
		'file'   => 'src/form.js',
		'deps'   => array('wdp-utils-js', 'wdp-state-js', 'wdp-cart-js', 'wdp-phone-input-js'),
	),
	array(
		'handle' => 'wdp-shareholder-js',
		'file'   => 'src/shareholder.js',
		'deps'   => array('wdp-utils-js', 'wdp-state-js', 'wdp-dom-js', 'wdp-product-js', 'wdp-form-js'),
	),
	array(
		'handle' => 'wdp-progress-bar-js',
		'file'   => 'src/progress-bar.js',
		'deps'   => array('wdp-utils-js'),
	),
	array(
		'handle' => 'wdp-modal-js',
		'file'   => 'src/modal.js',
		'deps'   => array('wdp-utils-js', 'wdp-state-js', 'wdp-form-js', 'wdp-shareholder-js'),
	),
	array(
		'handle' => 'wdp-form-initializer-js',
		'file'   => 'src/bootstrap/form-initializer.js',
		'deps'   => array('wdp-utils-js', 'wdp-form-js', 'wdp-shareholder-js'),
	),
	array(
		'handle' => 'wdp-event-manager-js',
		'file'   => 'src/bootstrap/event-manager.js',
		'deps'   => array('wdp-utils-js', 'wdp-modal-js', 'wdp-form-js'),
	),
	array(
		'handle' => 'wdp-module-loader-js',
		'file'   => 'src/bootstrap/module-loader.js',
		'deps'   => array('wdp-utils-js'),
	),
	array(
		'handle' => 'wdp-init-js',
		'file'   => 'src/bootstrap/init.js',
		'deps'   => array(
			'wdp-utils-js',
			'wdp-state-js',
			'wdp-dom-js',
			'wdp-modal-js',
			'wdp-form-js',
			'wdp-shareholder-js',
			'wdp-cart-js',
			'wdp-progress-bar-js',
			'wdp-form-initializer-js',
			'wdp-event-manager-js',
			'wdp-module-loader-js',
			'wdp-constants-js',
		),
	),
);
