<?php
/**
 * E3: ara hedefler, ilerleme verisi, etki ifadeleri, sosyal kanıt gizliliği, modül anahtarları.
 *
 * @package WooCommerce\Donation_Popup
 */

declare(strict_types=1);

require_once dirname( __DIR__, 2 ) . '/support/e0-stubs.php';

use DonationPanel\Core\Container;
use DonationPanel\Core\Module_Registry;
use DonationPanel\Core\Plugin;
use DonationPanel\Core\Settings;
use DonationPanel\Modules\Campaign\Milestones;
use DonationPanel\Modules\Campaign\Progress_Data;
use DonationPanel\Modules\Impact\Impact_Map;
use DonationPanel\Modules\SocialProof\Donation_Feed;
use PHPUnit\Framework\TestCase;

final class E3CampaignTest extends TestCase {

	protected function setUp(): void {
		WDP_Test_State::reset();
	}

	public function test_milestones_parse_sorts_dedupes_and_drops_invalid_lines(): void {
		$parsed = Milestones::parse( "72=Well 2\n40=Well 1\nabc=x\n0=zero\n101=big\n40=Duplicate\n=none\n100=Village" );
		$this->assertSame( array( 40.0, 72.0, 100.0 ), array_column( $parsed, 'at' ) );
		$this->assertSame( 'Duplicate', $parsed[0]['label'] );
	}

	public function test_milestones_hits_follow_percent(): void {
		$hits = Milestones::with_hits( Milestones::parse( "40=A\n72=B\n100=C" ), 72.0 );
		$this->assertSame( array( true, true, false ), array_column( $hits, 'hit' ) );
	}

	public function test_progress_build_percent_caps_at_100_and_has_no_personal_data(): void {
		$data = Progress_Data::build(
			array(
				'product_id' => 9,
				'raised'     => 300.0,
				'goal'       => 200.0,
				'donors'     => 12,
				'milestones' => Milestones::parse( '50=Half' ),
				'reached'    => true,
				'decimals'   => 2,
				'symbol'     => '£',
				'currency'   => 'GBP',
			)
		);
		$this->assertSame( 100.0, $data['percent'] );
		$this->assertSame( 0.0, $data['remaining'] );
		$this->assertTrue( $data['milestones'][0]['hit'] );
		$this->assertSame( 12, $data['donors'] );
		$this->assertEqualsCanonicalizing(
			array( 'product_id', 'raised', 'goal', 'remaining', 'percent', 'donors', 'reached', 'milestones', 'currency' ),
			array_keys( $data )
		);
	}

	public function test_progress_build_partial(): void {
		$data = Progress_Data::build(
			array(
				'product_id' => 9,
				'raised'     => 184.0,
				'goal'       => 250.0,
				'donors'     => 0,
				'milestones' => array(),
				'reached'    => false,
				'decimals'   => 0,
				'symbol'     => '₺',
				'currency'   => 'TRY',
			)
		);
		$this->assertSame( 73.6, $data['percent'] );
		$this->assertSame( 66.0, $data['remaining'] );
	}

	public function test_impact_parse_and_describe_tiers_with_plural(): void {
		$tiers = Impact_Map::parse( "40={count} food parcel|{count} food parcels\n250={count} water well|{count} water wells\nbad\n0=zero" );
		$this->assertCount( 2, $tiers );
		$this->assertNull( Impact_Map::describe( 39.0, $tiers ) );
		$this->assertSame( '1 food parcel', Impact_Map::describe( 40.0, $tiers )['text'] );
		$this->assertSame( '3 food parcels', Impact_Map::describe( 125.0, $tiers )['text'] );
		$this->assertSame( '2 water wells', Impact_Map::describe( 500.0, $tiers )['text'] );
	}

	public function test_impact_presets_skip_amounts_without_phrase(): void {
		$tiers = Impact_Map::parse( '40={count} meal|{count} meals' );
		$out   = Impact_Map::for_amounts( array( 20.0, 40.0, 80.0 ), $tiers );
		$this->assertSame( array( 40.0, 80.0 ), array_column( $out, 'amount' ) );
		$this->assertSame( '2 meals', $out[1]['text'] );
	}

	public function test_impact_product_meta_beats_site_default(): void {
		WDP_Test_State::$post_meta[7] = array( Impact_Map::META_KEY => '10=1 book' );
		$tiers                        = Impact_Map::tiers_for_product( 7, '10=1 default' );
		$this->assertSame( '1 book', $tiers[0]['one'] );
		$this->assertSame( '1 default', Impact_Map::tiers_for_product( 8, '10=1 default' )[0]['one'] );
		$this->assertSame( array(), Impact_Map::tiers_for_product( 8, '' ) );
	}

	public function test_social_proof_name_is_first_name_plus_last_initial(): void {
		$this->assertSame( 'Ayşe Y.', Donation_Feed::public_name( 'Ayşe  Yılmaz' ) );
		$this->assertSame( 'Elif Ç.', Donation_Feed::public_name( 'Elif Maria çelik' ) );
		$this->assertSame( 'Can', Donation_Feed::public_name( 'Can' ) );
		$this->assertSame( '', Donation_Feed::public_name( '   ' ) );
	}

	public function test_social_proof_hides_name_without_consent_or_when_anonymous(): void {
		$base = array(
			'full_name' => 'Ayşe Yılmaz',
			'amount'    => 50.0,
			'timestamp' => 1700000000,
		);
		$this->assertSame( '', Donation_Feed::build_entry( $base )['name'] );
		$this->assertSame( '', Donation_Feed::build_entry( $base + array( 'consent' => false ) )['name'] );
		$this->assertSame( 'Ayşe Y.', Donation_Feed::build_entry( $base + array( 'consent' => true ) )['name'] );
		$this->assertSame( '', Donation_Feed::build_entry( $base + array( 'consent' => true, 'anonymous' => true ) )['name'] );
	}

	public function test_social_proof_entry_has_only_allowed_keys(): void {
		$entry = Donation_Feed::build_entry(
			array(
				'full_name' => 'Ayşe Yılmaz',
				'consent'   => true,
				'email'     => 'a@example.test',
				'phone'     => '555',
				'note'      => 'secret',
				'amount'    => 10,
				'timestamp' => 5,
			)
		);
		$this->assertSame( array( 'name', 'amount', 'timestamp' ), array_keys( $entry ) );
	}

	public function test_social_proof_per_page_is_clamped(): void {
		$this->assertSame( 5, Donation_Feed::clamp_per_page( 'x' ) );
		$this->assertSame( 1, Donation_Feed::clamp_per_page( -4 ) );
		$this->assertSame( 20, Donation_Feed::clamp_per_page( 500 ) );
	}

	public function test_module_defaults_and_switches(): void {
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertContains( 'campaign', $registry->slugs() );
		$this->assertTrue( $registry->is_enabled( 'campaign' ) );
		$this->assertFalse( $registry->is_enabled( 'impact' ) );
		$this->assertFalse( $registry->is_enabled( 'social_proof' ) );

		( new Settings() )->update( array( 'modules' => array( 'social_proof' => true, 'campaign' => false ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$this->assertTrue( $registry->is_enabled( 'social_proof' ) );
		$this->assertFalse( $registry->is_enabled( 'campaign' ) );
	}

	/**
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_disabled_modules_load_no_files(): void {
		( new Settings() )->update( array( 'modules' => array( 'campaign' => false ) ) );
		$registry = new Module_Registry( new Settings() );
		Plugin::register_modules( $registry );
		$registry->boot( new Container() );
		foreach ( array( 'Campaign', 'Impact', 'SocialProof' ) as $dir ) {
			$loaded = array_filter(
				get_included_files(),
				static function ( $file ) use ( $dir ) {
					return false !== strpos( $file, '/src/Modules/' . $dir . '/class-' ) && false !== strpos( $file, '-module.php' );
				}
			);
			$this->assertSame( array(), array_values( $loaded ), $dir . ' dosyası kapalıyken yüklenmemeli' );
		}
	}

	public function test_impact_map_setting_keeps_line_breaks(): void {
		( new Settings() )->update( array( 'impact' => array( 'map' => "10=a\n20=b" ) ) );
		$this->assertSame( "10=a\n20=b", ( new Settings() )->get( 'impact.map' ) );
	}
}
