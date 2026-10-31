<?php
/**
 * Bağış tipinin eski meta bayraklarından çıkarımı (geçiş) ve tipten meta üretimi testleri.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class DonationTypeTest extends TestCase {
	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	/**
	 * @return array<string, array{0:array<string,string>, 1:string}>
	 */
	public function legacyMetaProvider(): array {
		return array(
			'no meta at all'                 => array(array(), \DonationPanel\Domain\Donation_Type::FIXED),
			'all flags no'                   => array(array('_allow_custom_price' => 'no', '_allow_multiple_shares' => 'no', '_enable_progress_bar' => 'no'), \DonationPanel\Domain\Donation_Type::FIXED),
			'custom amount'                  => array(array('_allow_custom_price' => 'yes'), \DonationPanel\Domain\Donation_Type::CUSTOM),
			'shares'                         => array(array('_allow_multiple_shares' => 'yes'), \DonationPanel\Domain\Donation_Type::SHARES),
			'campaign (progress + custom)'   => array(array('_allow_custom_price' => 'yes', '_enable_progress_bar' => 'yes'), \DonationPanel\Domain\Donation_Type::CAMPAIGN),
			'campaign without custom flag'   => array(array('_enable_progress_bar' => 'yes'), \DonationPanel\Domain\Donation_Type::CAMPAIGN),
			'conflict: shares beat progress' => array(array('_allow_multiple_shares' => 'yes', '_enable_progress_bar' => 'yes', '_allow_custom_price' => 'yes'), \DonationPanel\Domain\Donation_Type::SHARES),
			'conflict: shares beat custom'   => array(array('_allow_multiple_shares' => 'yes', '_allow_custom_price' => 'yes'), \DonationPanel\Domain\Donation_Type::SHARES),
			'only strict yes counts'         => array(array('_allow_custom_price' => '1', '_allow_multiple_shares' => 'on', '_enable_progress_bar' => 'true'), \DonationPanel\Domain\Donation_Type::FIXED),
			'uppercase YES is not yes'       => array(array('_allow_custom_price' => 'YES'), \DonationPanel\Domain\Donation_Type::FIXED),
		);
	}

	/**
	 * @dataProvider legacyMetaProvider
	 *
	 * @param array<string,string> $meta     Legacy meta.
	 * @param string               $expected Expected type.
	 */
	public function test_infer_from_meta_matches_front_end_priority(array $meta, string $expected): void {
		$this->assertSame($expected, \DonationPanel\Domain\Donation_Type::infer_from_meta($meta));
	}

	public function test_for_product_reads_post_meta(): void {
		WDP_Test_State::$post_meta[12] = array(
			'_allow_custom_price'  => 'yes',
			'_enable_progress_bar' => 'yes',
		);
		WDP_Test_State::$post_meta[13] = array('_allow_multiple_shares' => 'yes');

		$this->assertSame(\DonationPanel\Domain\Donation_Type::CAMPAIGN, \DonationPanel\Domain\Donation_Type::for_product(12));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::SHARES, \DonationPanel\Domain\Donation_Type::for_product(13));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::FIXED, \DonationPanel\Domain\Donation_Type::for_product(99));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::FIXED, \DonationPanel\Domain\Donation_Type::for_product(0));
	}

	public function test_to_meta_writes_legacy_keys(): void {
		$this->assertSame(
			array('_allow_custom_price' => 'no', '_allow_multiple_shares' => 'no', '_enable_progress_bar' => 'no'),
			\DonationPanel\Domain\Donation_Type::to_meta(\DonationPanel\Domain\Donation_Type::FIXED)
		);
		$this->assertSame(
			array('_allow_custom_price' => 'yes', '_allow_multiple_shares' => 'no', '_enable_progress_bar' => 'no'),
			\DonationPanel\Domain\Donation_Type::to_meta(\DonationPanel\Domain\Donation_Type::CUSTOM)
		);
		$this->assertSame(
			array('_allow_custom_price' => 'no', '_allow_multiple_shares' => 'yes', '_enable_progress_bar' => 'no'),
			\DonationPanel\Domain\Donation_Type::to_meta(\DonationPanel\Domain\Donation_Type::SHARES)
		);
		$this->assertSame(
			array('_allow_custom_price' => 'yes', '_allow_multiple_shares' => 'no', '_enable_progress_bar' => 'yes'),
			\DonationPanel\Domain\Donation_Type::to_meta(\DonationPanel\Domain\Donation_Type::CAMPAIGN)
		);
	}

	public function test_round_trip_type_to_meta_and_back(): void {
		foreach (\DonationPanel\Domain\Donation_Type::ids() as $type) {
			$this->assertSame($type, \DonationPanel\Domain\Donation_Type::infer_from_meta(\DonationPanel\Domain\Donation_Type::to_meta($type)), $type);
		}
	}

	public function test_sanitize_rejects_unknown_values(): void {
		$this->assertSame(\DonationPanel\Domain\Donation_Type::SHARES, \DonationPanel\Domain\Donation_Type::sanitize(' Shares '));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::FIXED, \DonationPanel\Domain\Donation_Type::sanitize('nope'));
		$this->assertSame('', \DonationPanel\Domain\Donation_Type::sanitize('nope', ''));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::FIXED, \DonationPanel\Domain\Donation_Type::sanitize(array('campaign')));
		$this->assertSame(\DonationPanel\Domain\Donation_Type::FIXED, \DonationPanel\Domain\Donation_Type::sanitize(null));
	}

	public function test_definitions_cover_every_type(): void {
		$defs = \DonationPanel\Domain\Donation_Type::get_definitions();
		$this->assertSame(\DonationPanel\Domain\Donation_Type::ids(), array_keys($defs));
		foreach ($defs as $def) {
			$this->assertNotSame('', $def['label']);
			$this->assertNotSame('', $def['description']);
		}
		$this->assertSame('Hedefli kampanya', \DonationPanel\Domain\Donation_Type::get_label('campaign'));
		$this->assertSame('Sabit tutar', \DonationPanel\Domain\Donation_Type::get_label('unknown'));
	}

	public function test_meta_query_shapes(): void {
		$this->assertSame(array(), \DonationPanel\Domain\Donation_Type::get_meta_query('bogus'));

		$shares = \DonationPanel\Domain\Donation_Type::get_meta_query('shares');
		$this->assertSame(array(array('key' => '_allow_multiple_shares', 'value' => 'yes', 'compare' => '=')), $shares);

		$campaign = \DonationPanel\Domain\Donation_Type::get_meta_query('campaign');
		$this->assertSame('AND', $campaign['relation']);
		$this->assertSame('_enable_progress_bar', $campaign[0]['key']);
		$this->assertSame('OR', $campaign[1]['relation']);
		$this->assertSame('NOT EXISTS', $campaign[1][0]['compare']);

		$custom = \DonationPanel\Domain\Donation_Type::get_meta_query('custom');
		$this->assertSame('_allow_custom_price', $custom[0]['key']);
		$this->assertCount(4, $custom);

		$fixed = \DonationPanel\Domain\Donation_Type::get_meta_query('fixed');
		$this->assertCount(4, $fixed);
		foreach (array(0, 1, 2) as $i) {
			$this->assertSame('OR', $fixed[ $i ]['relation']);
			$this->assertSame('!=', $fixed[ $i ][1]['compare']);
		}
	}
}
