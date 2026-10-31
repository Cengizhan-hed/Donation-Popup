<?php
/**
 * Ortada açılan popup (≤639 px: alttan panel).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Popup.
 */
final class Popup extends Experience_Container {

	/**
	 * Kap slug'ı.
	 *
	 * @return string
	 */
	public function slug() {
		return 'popup';
	}

	/**
	 * Şablon adı.
	 *
	 * @return string
	 */
	public function template() {
		return 'experiences/popup.php';
	}

	/**
	 * Katman türü.
	 *
	 * @return string
	 */
	public function layer() {
		return 'modal';
	}
}
