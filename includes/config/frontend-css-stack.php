<?php
/**
 * Ön yüz CSS dosyalarının birleştirme ve enqueue sırası yapılandırması.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	'src/foundation/tokens.css',
	'src/foundation/polish.css',
	'src/foundation/base.css',
	'src/foundation/layout.css',
	'src/forms/shared.css',
	'src/forms/field-stack.css',
	'src/components/phone-field.css',
	'src/forms/hisseli.css',
	'src/components/quantity.css',
	'src/components/amount-presets.css',
	'src/components/buttons.css',
	'src/components/loading.css',
	'src/components/wizard.css',
	'src/components/progress-bar.css',
	'src/components/success.css',
	'src/components/toast.css',
	'src/components/side-panel.css',
	'src/components/motion.css',
	'src/components/feedback.css',
	'src/components/accessibility.css',
	'src/components/product-note.css',
	'src/components/sadaka-donation.css',
	'src/components/ux-enhancements.css',
	'src/components/campaign-modules.css',
	'src/components/mobile-polish.css',
	'src/overrides/theme-isolation-overrides.css',
);
