<?php
/**
 * Ön yüz CSS dosyalarının birleştirme ve enqueue sırası yapılandırması.
 * Stage 2C: foundation → shells → components → list.
 *
 * @package WooCommerce\Donation_Popup
 */

if (!defined('ABSPATH')) {
	exit;
}

return array(
	'src/foundation/tokens.css',
	'src/foundation/reset-scope.css',
	'src/foundation/base.css',
	'src/shells/modal.css',
	'src/shells/panel.css',
	'src/shells/sheet.css',
	'src/shells/inline.css',
	'src/components/field.css',
	'src/components/phone.css',
	'src/components/amount.css',
	'src/components/chips.css',
	'src/components/stepper.css',
	'src/components/shares.css',
	'src/components/progress.css',
	'src/components/sadaka.css',
	'src/components/checkbox.css',
	'src/components/info-row.css',
	'src/components/buttons.css',
	'src/components/footer.css',
	'src/components/success.css',
	'src/components/toast.css',
	'src/components/wizard.css',
	'src/components/loading.css',
	'src/list/list.css',
);
