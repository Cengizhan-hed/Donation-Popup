<?php
/**
 * E0: bağımlılık kabı.
 *
 * @package DonationPanel
 */

declare(strict_types=1);

use DonationPanel\Core\Container;
use PHPUnit\Framework\TestCase;

final class E0ContainerDep {
}

final class E0ContainerNeedsDep {
	/** @var E0ContainerDep */
	public $dep;

	public function __construct(E0ContainerDep $dep) {
		$this->dep = $dep;
	}
}

final class E0ContainerNeedsScalar {
	public function __construct(string $name) {
		unset($name);
	}
}

final class E0ContainerLoopA {
	public function __construct(E0ContainerLoopB $b) {
		unset($b);
	}
}

final class E0ContainerLoopB {
	public function __construct(E0ContainerLoopA $a) {
		unset($a);
	}
}

final class E0ContainerTest extends TestCase {

	public function test_constructor_injection_resolves_class_parameters(): void {
		$c   = new Container();
		$obj = $c->get(E0ContainerNeedsDep::class);
		$this->assertInstanceOf(E0ContainerDep::class, $obj->dep);
	}

	public function test_singleton_returns_same_instance_and_bind_returns_new(): void {
		$c = new Container();
		$c->singleton('one', static function () {
			return new stdClass();
		});
		$c->bind('many', static function () {
			return new stdClass();
		});
		$this->assertSame($c->get('one'), $c->get('one'));
		$this->assertNotSame($c->get('many'), $c->get('many'));
	}

	public function test_factory_receives_container(): void {
		$c = new Container();
		$c->singleton('dep', static function () {
			return new E0ContainerDep();
		});
		$c->singleton('needs', static function (Container $container) {
			return new E0ContainerNeedsDep($container->get('dep'));
		});
		$this->assertSame($c->get('dep'), $c->get('needs')->dep);
	}

	public function test_instance_and_has(): void {
		$c = new Container();
		$o = new stdClass();
		$c->instance('x', $o);
		$this->assertTrue($c->has('x'));
		$this->assertTrue($c->has(E0ContainerDep::class));
		$this->assertFalse($c->has('nope'));
		$this->assertSame($o, $c->get('x'));
	}

	public function test_unresolvable_scalar_throws(): void {
		$this->expectException(RuntimeException::class);
		(new Container())->get(E0ContainerNeedsScalar::class);
	}

	public function test_circular_dependency_throws(): void {
		$this->expectException(RuntimeException::class);
		(new Container())->get(E0ContainerLoopA::class);
	}

	public function test_unknown_id_throws(): void {
		$this->expectException(RuntimeException::class);
		(new Container())->get('Not\\A\\Class');
	}
}
