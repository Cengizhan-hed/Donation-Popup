# RAPOR 121-shotstable
## Alınan teknik kararlar
- Kök neden: hata ekranında ilk geçersiz alana odak → klavye modu (`data-dp-kb`, alt çubuk akışa). Çekimden önce `prepareErrorShot` odağı kaldırınca `layer.mjs` `onFieldBlur` → syncKeyboard → çubuğu 400 ms (BAR_RESTORE_MS) gecikmeyle sabit yerine döndürür; çekim bu geçişle yarışıyordu. Ürün davranışı doğru (gerçek klavye kapanınca aynı) → ürün koduna DOKUNULMADI.
- Düzeltme: tests/e2e/helpers/capture.mjs `prepareErrorShot`: blur sonrası `data-dp-kb` yok + çubuk position≠static durumu ≥300 ms değişmeden kalana dek bekle (≤3 sn). Referans durum: klavye kapalı, çubuk sabit altta.
## Kanıt tablosu (iphone popup-errors, sha256 ilk 12; 5 ardışık koşu e2e:queue e2e:quick --env local)
| ekran | k1 | k2 | k3 | k4 | k5 |
|---|---|---|---|---|---|
| campaign-errors | ad4dd010de7b | aynı | aynı | aynı | aynı |
| custom-errors | 2cdcf867885c | aynı | aynı | aynı | aynı |
| fixed-errors | cdb2fcc446d5 | aynı | aynı | aynı | aynı |
| shares-errors | 591c15648d25 | aynı | aynı | aynı | aynı |
5/5 bayt-eşit. lint:js 0 bulgu.
## Kalan işler
- "Görsel durum" kümesi: k2–k5 aynı 8 ekran (list, popup-campaign/custom-errors, product-campaign/custom/fixed/shares, shop); k1'de yalnız 2 (iki errors). Fark baseline'a göre (yeni worktree baseline'ı); küme kararlı, kabul sende. k1'in farklı olma nedeni incelenmedi (olası: ilk koşuda değişen-alan kapsamı).
