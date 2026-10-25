<?php
/**
 * Sağdan açılan yan panel (RTL: soldan; ≤639 px: alttan panel).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\Experiences;

defined( 'ABSPATH' ) || exit;

/**
 * Side_Panel.
 */
final class Side_Panel extends Experience_Container {

	/**
	 * Kap slug'ı.
	 *
	 * @return string
	 */
	public function slug() {
		return 'side_panel';
	}

	/**
	 * Şablon adı.
	 *
	 * @return string
	 */
	public function template() {
		return 'experiences/side-panel.php';
	}

	/**
	 * Katman türü.
	 *
	 * @return string
	 */
	public function layer() {
		return 'panel';
	}
}
