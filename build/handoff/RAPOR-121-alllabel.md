# RAPOR-121-alllabel
- Kök neden: class-donations-list-widget.php:263 `default => __('All')` editörde yönetici dilinde (tr_TR) çözülüp widget verisine kaydediliyordu.
- Düzeltme: default '' + placeholder `__('All')` + açıklama (çevrilebilir); çizimde boş etiket Donations_List::sanitize_atts ile ziyaretçi dilinde `__('All')`.
- Tarama: widget'ta başka çevrilebilir 'default' yok; blocks/*/block.json defaultları teknik değerler (yes/no/h3/4:3...), çevrilebilir metin yok -> değişiklik gerekmedi.
- Test: ElementorI18nTest::test_empty_all_label_follows_visitor_locale (en_US=All, tr_TR=Tümü). PHPUnit 735/0 hata; lint:js 0; phpcs değişen dosyada 0.
- Çeviri: languages/parts/alllabel.po (1 dizge). Birleştirme Claude'da.
- Not: Elementor'da önceden kaydedilmiş sayfalarda "Tümü" metni saklıysa o widget'ta alan elle boşaltılmalı.
