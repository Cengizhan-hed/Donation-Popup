# RAPOR 121-crfix (dal v121-crfix)
Alınan teknik kararlar:
- require_same_origin: Origin yalnız host (küçük harf) ile home_url/site_url host'una karşılaştırılır; şema/port yok sayılır; 'null' ve yabancı/alt alan adı 403; Sec-Fetch-Site: cross-site hâlâ 403 (origin_of -> host_of).
- Direct_Order_Factory: yeniden oynatma yalnız sahip karması iki tarafta da boş değil ve hash_equals eşitse; aksi 422 key_reused. Mevcut 3 entegrasyon testi belirteçsiz oynatıyordu (açığın kendisi); client_token ile güncellendi. Not: gerçek istemci hep belirteç gönderir.
- store.mjs: Object.hasOwn -> Object.prototype.hasOwnProperty.call. assets/src + blocks + src taraması (Object.hasOwn, .at(, structuredClone, findLast, replaceAll): başka kullanım yok.
- Theme_Colors::pick_primary: adlandırılmış renk için MIN_TEXT_CONTRAST (4.5); yoksa mevcut yedek (ilk koyu renk).
Kanıt tablosu: PHPUnit 730/0 (+yeni); test:integration 56/56 (693 assertion, +1 yeni boş-sahip testi); JS birim yeşil (+store-reducer 2 test); lint:js 0; phpcs değişen src dosyalarında 0; analyse:php 2 (stil, öncesiyle aynı, bu değişikliklerden değil).
Yeni testler: SecurityHardeningTest (http/port farkı kabul, yabancı host red), ThemeColorsTest (3.4:1 seçilmez), DirectDonationTest (boş sahip 422), tests/unit/js/store-reducer.test.mjs.
Kalan: yok. docs/MIMARI.md "12.1 güvenlik sertleştirmesi" güncellendi.
