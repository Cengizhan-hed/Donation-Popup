<?php
/**
 * Alttan açılan panel.
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Bottom_Sheet.
 */
final class Bottom_Sheet extends Experience_Container {

	/**
	 * Kap slug'ı.
	 *
	 * @return string
	 */
	public function slug() {
		return 'bottom_sheet';
	}

	/**
	 * Şablon adı.
	 *
	 * @return string
	 */
	public function template() {
		return 'experiences/bottom-sheet.php';
	}

	/**
	 * Katman türü.
	 *
	 * @return string
	 */
	public function layer() {
		return 'sheet';
	}
}
