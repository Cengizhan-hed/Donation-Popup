# RAPOR 121-stgfix (dal v121-stgfix)
## Kök nedenler
1. capture.mjs openShellForMode: `[data-dp-exp][data-dp-product=ID] [data-dp-open]` `.first()` gizli aday seçiyordu (ürün 10720: inline + Avada düğmesi). Artık görünür ilk aday; hepsi gizliyse detail'e "adaylar=N hepsi gizli" yazılıp hata döner.
2. donation-flow.mjs resolveDonationFillAmount: hazır tutar yoksa (sabit birim/adet/hisse; hazır tutar seçili gelmiyor) hiçbir değer okunamıyordu. Yedek: form `data-unit` / gizli `amount` değeri; form çizilirken ≤5 sn yoklama. Hâlâ yoksa hata kalır.
3. submit-fault (Ikram): hata sonrası form tutar adımında kalınca ad alanı gizli; `fill` 30 sn bekliyordu. Artık ad görünür değilse advanceToDetails ile bilgi adımına geçilir.
4. remote-smoke shell-open: tutar boşken ana düğme aria-disabled (12.1); boş gönderim `click()` zaman aşımı. Artık pasiflik doğrulanır (tıklama yok), tutar seçilir, bilgi adımında boş gönderilir (matrixfix mantığı).
Ortak: dp-form.mjs advanceToDetails pasif düğmede önce `selectAnyAmount` (yeni; hazır tutar ya da min/25) çağırır.
## Kanıt
lint:js 0; JS birim 736/0; yerel e2e:quick --env local (port 8937) 2 koşu 41 geçti/0 hata. remote-smoke yerelde koşmaz (uzak yasak); yardımcı yolu yerel e2e ile (advanceToDetails/pasif düğme) kanıtlandı. Not: ara koşularda 1 kez geçici submit-fault zaman aşımı görüldü (28/1), sonraki koşular temiz; tekrar olursa izlenmeli.
## Kalan
Negatif kontrol yapılmadı (staging DOM'u yerelde yok). Uzak yeniden koşu Claude'da.
