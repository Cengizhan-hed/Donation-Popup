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

	public function test_rate_limit_is_charged_per_id_from_shared_bucket(): void {
		$limiter = new class() {
			/** @var array<int, string> */
			public $calls = array();
			/** @var int */
			public $left = 3;
			public function hit( $bucket, $limit ) {
				$this->calls[] = $bucket . ':' . $limit;
				return $this->left-- > 0;
			}
		};
		$allowed = Experience_Controller::charge_ids( $limiter, range( 1, 12 ), Experience_Controller::RATE_LIMIT );
		// Bütçe 3 istek: yalnız ilk 3 ürün çizilir; 4. denemede durur (sonrakiler sayaç düşürmez).
		$this->assertSame( array( 1, 2, 3 ), $allowed );
		$this->assertCount( 4, $limiter->calls );
		$this->assertSame( 'entry_experience:60', $limiter->calls[0] ); // tek form ucuyla ortak kova
	}

	public function test_charge_never_exceeds_batch_max(): void {
		$limiter = new class() {
			/** @var int */
			public $n = 0;
			public function hit() {
				++$this->n;
				return true;
			}
		};
		$this->assertCount( Experience_Controller::BATCH_MAX, Experience_Controller::charge_ids( $limiter, range( 1, 50 ), 60 ) );
		$this->assertSame( Experience_Controller::BATCH_MAX, $limiter->n );
	}

	public function test_caps_at_batch_max(): void {
		$ids = Experience_Controller::parse_ids( implode( ',', range( 1, 40 ) ) );
		$this->assertCount( Experience_Controller::BATCH_MAX, $ids );
		$this->assertSame( 1, $ids[0] );
	}
}
