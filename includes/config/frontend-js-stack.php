<?php
/**
 * Frontend JS bundle stack — load order for build script and dev fallback.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	'src/constants.js',
	'src/meta-tracking.js',
	'src/utils.js',
	'src/state.js',
	'src/dom.js',
	'src/phone-input.js',
	'src/product.js',
	'src/cart.js',
	'src/form.js',
	'src/shareholder.js',
	'src/progress-bar.js',
	'src/modal.js',
	'src/form-initializer.js',
	'src/event-manager.js',
	'src/module-loader.js',
	'src/init.js',
);
