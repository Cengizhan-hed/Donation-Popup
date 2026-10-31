<?php
/**
 * Kart formları için sıkıştırılmış gömme paketi: ortak şablon + ürün başına fark (12.4).
 *
 * Liste/mağaza kartlarının formları birbirine çok benzer (aynı alanlar, aynı ülke listesi; farkı ad, tutar, ürün kimliği).
 * Her form HTML'i küçük parçalara (etiket sonu `>` ve öznitelik başı) bölünür; parça dizisi daha önce görülen
 * "şablon akışına" (R) ya da formun kendi önceki kısmına `[konum, uzunluk]` kopyalarıyla, yeni parçalar düz metin olarak
 * yazılır (parça düzeyinde LZ77). Çok yeni içerik getiren form şablon olur (akışa eklenir), sonrakiler ona göre kısalır.
 * Ürün kimliği ve sayfa kimliği (`dom_key`) belirteçle değiştirilir; böylece aynı türden kartlar neredeyse tamamen kopyadır.
 *
 * Biçim (v1, JSON): `{"v":1,"t":[ops,…],"f":{"<id>":ops,…}}`. `ops`: dize = düz parça; sayı çifti = kopya
 * (`konum >= 0` → R[konum…], `konum < 0` → kendi çıktısı[-1-konum…]). Şablonlar sırayla çözülüp R'ye eklenir; form
 * `ops`'u R'nin tamamına göre çözülür. İstemci çözücüsü: `assets/src/list/pack.mjs` (birim testleri iki tarafı da sınar).
 *
 * Kayıpsızdır: çözülen dizi, belirteçler geri konunca (kimlik → ürün kimliği, anahtar → istemcinin ürettiği benzersiz
 * anahtar) özgün HTML'dir. Kullanıcıya özel veri yoktur (nonce boş; form ilk gönderimde tazesini alır).
 *
 * @package DonationPanel
 */

namespace DonationPanel\Modules\EntryPoints;

defined( 'ABSPATH' ) || exit;

/**
 * Form_Pack.
 */
class Form_Pack {

	/** Paket biçim sürümü (istemci yalnız bunu çözer). */
	const VERSION = 1;

	/** Sayfa kimliği (`dom_key`, ör. `dp-12-side_panel-3`) belirteci. */
	const KEY_TOKEN = "\x01";

	/** Ürün kimliği belirteci. */
	const ID_TOKEN = "\x02";

	/** Parçalama: etiket sonundan sonra ya da öznitelik adından önce. */
	const SPLIT = '/(?<=>)|(?=\s[a-z][a-z0-9-]*=")/';

	/** Yeni içeriği bundan fazla (bayt) olan form şablon olur. */
	const PROMOTE_BYTES = 2048;

	/** En çok şablon sayısı (çözüm maliyeti sınırlı). */
	const MAX_TEMPLATES = 12;

	/** Çift dizinde anahtar başına en çok aday konum. */
	const MAX_CANDIDATES = 8;

	/**
	 * Şablon akışı (R).
	 *
	 * @var string[]
	 */
	private $stream = array();

	/**
	 * R'de ardışık parça çifti → konumlar.
	 *
	 * @var array<string, int[]>
	 */
	private $pairs = array();

	/**
	 * R'de parça → ilk konum.
	 *
	 * @var array<string, int>
	 */
	private $singles = array();

	/**
	 * Şablonların ops dizileri.
	 *
	 * @var array<int, array<int, int|string>>
	 */
	private $templates = array();

	/**
	 * Ürün → ops.
	 *
	 * @var array<string, array<int, int|string>>
	 */
	private $forms = array();

	/**
	 * Formun HTML'ini belirteçlere çevirir; belirteç karakteri zaten varsa (kayıpsızlık sağlanamaz) null.
	 *
	 * @param string $html       Form HTML'i.
	 * @param int    $product_id Ürün.
	 * @return string|null
	 */
	public static function normalize( $html, $product_id ) {
		$html = (string) $html;
		$id   = (string) (int) $product_id;
		if ( '' === $html || false !== strpos( $html, self::KEY_TOKEN ) || false !== strpos( $html, self::ID_TOKEN ) ) {
			return null;
		}
		if ( preg_match( '/\bid="(dp-' . $id . '-[a-z_]+-\d+)"/', $html, $m ) ) {
			$html = str_replace( $m[1], self::KEY_TOKEN, $html );
		}
		$html = (string) preg_replace( '/((?:data-dp-product|data-product-id)=")' . $id . '"/', '$1' . self::ID_TOKEN . '"', $html );
		return (string) preg_replace( '/(&quot;id&quot;:)' . $id . '(?=[,}])/', '$1' . self::ID_TOKEN, $html );
	}

	/**
	 * Bir formu pakete ekler.
	 *
	 * @param int    $product_id Ürün.
	 * @param string $html       Form HTML'i (normalize edilmemiş).
	 * @return int Pakete eklenen yaklaşık bayt (0 = eklenmedi).
	 */
	public function add( $product_id, $html ) {
		$norm = self::normalize( $html, $product_id );
		return null === $norm ? 0 : $this->add_normalized( $product_id, $norm );
	}

	/**
	 * Belirteçlenmiş (`normalize`) formu pakete ekler (ürün başına önbellekten gelen parça).
	 *
	 * @param int    $product_id Ürün.
	 * @param string $norm       Belirteçli HTML.
	 * @return int Eklenen yaklaşık bayt (0 = eklenmedi).
	 */
	public function add_normalized( $product_id, $norm ) {
		$key = (string) (int) $product_id;
		if ( '' === (string) $norm || isset( $this->forms[ $key ] ) ) {
			return 0;
		}
		$segments = preg_split( self::SPLIT, $norm );
		if ( ! is_array( $segments ) || empty( $segments ) ) {
			return 0;
		}
		list( $ops, $literal ) = $this->encode( $segments );
		if ( $literal > self::PROMOTE_BYTES && count( $this->templates ) < self::MAX_TEMPLATES ) {
			$start             = count( $this->stream );
			$this->templates[] = $ops;
			foreach ( $segments as $segment ) {
				$this->stream[] = $segment;
			}
			$total = count( $this->stream );
			for ( $p = max( 0, $start - 1 ); $p < $total; $p++ ) {
				self::index( $this->stream, $p, $this->pairs, $this->singles );
			}
			$this->forms[ $key ] = array( $start, count( $segments ) );
			return self::size( $ops ) + 16;
		}
		$this->forms[ $key ] = $ops;
		return self::size( $ops );
	}

	/**
	 * Pakette ürün var mı.
	 *
	 * @param int $product_id Ürün.
	 * @return bool
	 */
	public function has( $product_id ) {
		return isset( $this->forms[ (string) (int) $product_id ] );
	}

	/**
	 * Ürün sayısı.
	 *
	 * @return int
	 */
	public function count() {
		return count( $this->forms );
	}

	/**
	 * Paket dizisi (JSON'a hazır).
	 *
	 * @return array<string, mixed>
	 */
	public function to_array() {
		return array(
			'v' => self::VERSION,
			't' => $this->templates,
			'f' => empty( $this->forms ) ? new \stdClass() : $this->forms,
		);
	}

	/**
	 * `<script type="application/json">` içine güvenli JSON: `</` ve `<!--` kaçışlı, Unicode ham (küçük).
	 *
	 * @param array<string, mixed> $data Veri.
	 * @return string
	 */
	public static function json( array $data ) {
		$json = wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		if ( ! is_string( $json ) ) {
			return '';
		}
		return str_replace( array( '</', '<!--' ), array( '<\/', '\\' . 'u003C!--' ), $json );
	}

	/**
	 * Parça dizisini R'ye ve kendi önceki kısmına göre kodlar.
	 *
	 * @param string[] $f Parçalar.
	 * @return array{0: array<int, int|string>, 1: int} Ops ve düz parça baytı.
	 */
	private function encode( array $f ) {
		$ops       = array();
		$literal   = 0;
		$own_pairs = array();
		$own_singl = array();
		$indexed   = 0;
		$n         = count( $f );
		$r_len     = count( $this->stream );
		$i         = 0;
		while ( $i < $n ) {
			while ( $indexed + 1 < $i ) {
				self::index( $f, $indexed, $own_pairs, $own_singl );
				++$indexed;
			}
			$best = 0;
			$pos  = 0;
			$pair = $i + 1 < $n ? $f[ $i ] . "\0" . $f[ $i + 1 ] : null;
			// Önce şablon akışı, sonra formun kendi önceki kısmı (yinelenen bloklar: ör. hissedar başına ülke listesi).
			foreach ( array( false, true ) as $self ) {
				$src_pairs = $self ? $own_pairs : $this->pairs;
				$src_singl = $self ? $own_singl : $this->singles;
				$cands     = ( null !== $pair && isset( $src_pairs[ $pair ] ) ) ? $src_pairs[ $pair ] : array();
				if ( $best < 2 && isset( $src_singl[ $f[ $i ] ] ) ) {
					$cands[] = $src_singl[ $f[ $i ] ];
				}
				foreach ( $cands as $p ) {
					$l = 0;
					if ( $self ) {
						while ( $i + $l < $n && $f[ $p + $l ] === $f[ $i + $l ] ) {
							++$l;
						}
					} else {
						while ( $i + $l < $n && $p + $l < $r_len && $this->stream[ $p + $l ] === $f[ $i + $l ] ) {
							++$l;
						}
					}
					if ( $l > $best ) {
						$best = $l;
						$pos  = $self ? -1 - $p : $p;
					}
				}
			}
			if ( $best >= 2 || ( 1 === $best && strlen( $f[ $i ] ) > 6 ) ) {
				$ops[] = $pos;
				$ops[] = $best;
				$i    += $best;
			} else {
				$ops[]    = $f[ $i ];
				$literal += strlen( $f[ $i ] );
				++$i;
			}
		}
		return array( $ops, $literal );
	}

	/**
	 * Konumu dizinler (çift → ilk MAX_CANDIDATES konum; tekil → ilk konum).
	 *
	 * @param string[]             $src     Dizi.
	 * @param int                  $p       Konum.
	 * @param array<string, int[]> $pairs   Çift dizini.
	 * @param array<string, int>   $singles Tekil dizin.
	 * @return void
	 */
	private static function index( array $src, $p, array &$pairs, array &$singles ) {
		if ( ! isset( $singles[ $src[ $p ] ] ) ) {
			$singles[ $src[ $p ] ] = $p;
		}
		if ( isset( $src[ $p + 1 ] ) ) {
			$key = $src[ $p ] . "\0" . $src[ $p + 1 ];
			if ( ! isset( $pairs[ $key ] ) ) {
				$pairs[ $key ] = array( $p );
			} elseif ( count( $pairs[ $key ] ) < self::MAX_CANDIDATES ) {
				$pairs[ $key ][] = $p;
			}
		}
	}

	/**
	 * Ops dizisinin yaklaşık JSON baytı.
	 *
	 * @param array<int, int|string> $ops Ops.
	 * @return int
	 */
	private static function size( array $ops ) {
		$bytes = 2;
		foreach ( $ops as $op ) {
			$bytes += is_string( $op ) ? strlen( $op ) + 3 : strlen( (string) $op ) + 1;
		}
		return $bytes;
	}
}
