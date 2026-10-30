<?php
/**
 * 12.3 ön alma: toplu form ucunun kimlik ayrıştırması (benzersiz, pozitif, en çok BATCH_MAX).
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Modules\EntryPoints\Experience_Controller;
use PHPUnit\Framework\TestCase;

final class ExperienceBatchIdsTest extends TestCase {
	public function test_parses_unique_positive_ids(): void {
		$this->assertSame( array( 12, 13 ), Experience_Controller::parse_ids( '12, 13,13,abc,-4,0' ) );
		$this->assertSame( array(), Experience_Controller::parse_ids( '' ) );
	}

	public function test_caps_at_batch_max(): void {
		$ids = Experience_Controller::parse_ids( implode( ',', range( 1, 40 ) ) );
		$this->assertCount( Experience_Controller::BATCH_MAX, $ids );
		$this->assertSame( 1, $ids[0] );
	}
}
