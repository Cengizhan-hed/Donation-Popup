# RAPOR 121-listpage (dal v121-listpage)
- ikram-aid.json `listPage: "/appeals/"`; applyRemoteCatalog artık profil listPage'ini WP içerik taramasının önüne koyar (eskiden uzak profilde yok sayılıyordu).
- Profilsiz: catalog-resolve.php en çok 5 aday (`list_candidates`) döndürür; `verifyRenderedListPage` (catalog-core) adayları yalnız GET ile çekip eklentinin `.wdp-list-wrap`/`data-wdp-list-id` işaretini arar; çizmeyeni atlar, hiçbiri yoksa liste boş + gerekçeli atlama "liste ızgarası çizen sayfa bulunamadı".
- checkout-flow tetikleyicisi zaten eklentinin kendi işaretleriyle (`data-dp-open`, `.wdp-card__cta`, `.wdp-loop-donate`); değişiklik gerekmedi.
- Birim: catalog-resolve 4 yeni test (profil önceliği, çizilmemiş aday atlama, hepsi yok -> atlama); JS birim 761/762 geçti (1 atlandı); lint:js 0; yerel e2e:queue quick: 20 geçti / 0 hata, 22.7 sn.
- Kalan: uzak koşuda doğrulama yapılmadı (yasak). Merge/push yapılmadı; commit yalnız WIP.
