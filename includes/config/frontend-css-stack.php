<?php
/**
 * Frontend CSS bundle stack — single source for build script and enqueue fallback.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	'src/tokens.css',
	'src/base.css',
	'src/layout.css',
	'src/components/side-panel.css',
	'src/forms/shared.css',
	'src/forms/field-stack.css',
	'src/components/phone-field.css',
	'src/forms/hisseli.css',
	'src/components/buttons.css',
	'src/components/alerts.css',
	'src/components/loading.css',
	'src/components/quantity.css',
	'src/components/progress-bar.css',
	'src/components/success.css',
	'src/components/toast.css',
	'src/components/motion.css',
	'src/components/feedback.css',
	'src/components/accessibility.css',
	'src/components/amount-presets.css',
	'src/components/product-note.css',
	'src/components/sadaka-donation.css',
);
