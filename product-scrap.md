apple@Murat-MacBook-Pro cinselhobi.com-next % python3 - <<'PY'
import csv
rows=[]
with open("old-products/unmatched-suggestions.csv", newline="", encoding="utf-8") as f:
    r=csv.DictReader(f)
    for row in r:
        try:
            row["best_score_num"]=float(row.get("best_score","") or 0)
        except:
            row["best_score_num"]=0.0
        rows.append(row)

rows.sort(key=lambda x: x["best_score_num"], reverse=True)

print("TOP 30 (muhtemel aynı ürün):")
for row in rows[:30]:
    print(f'{row["best_score_num"]:.3f} | {row["source_slug"]} -> {row["best_db_candidate_slug"]} | {row["source_name"]}')
PY

TOP 30 (muhtemel aynı ürün):

| Skor | Kaynak Slug | DB Slug | Ürün Adı |
|------|-------------|---------|----------|
| **1.000** | `beautiful-johson-92-inc-vibrator` | `beautiful-johson-9-2-inc-vibrator` | Beautiful Johson 9.2 İnç Vibratör |
| **1.000** | `ero-shop-barbara-83-inc-dildo` | `ero-shop-barbara-8-3-inc-dildo` | Ero Shop Barbara 8.3 İnç Dildo |
| **0.961** | `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml-cilekli` | `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml-cilekli` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 250 ML Çilekli |
| **0.956** | `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml` | `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 250 ML |
| **0.956** | `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-400-ml` | `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-400-ml` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 400 ML |
| **0.950** | `belden-baglamali-modern-dildo-siyah-125-cm` | `belden-baglamali-modern-dildo-siyah-12-5-cm` | Belden Bağlamalı Modern Dildo Siyah 12,5 cm |
| **0.950** | `belden-baglamali-titresimli-125-cm-ici-bos-ikili-catal-strapon-penis` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | Belden Bağlamalı Titreşimli 12,5 cm İçi Boş İkili Çatal Strapon Penis |
| **0.926** | `beyaz-dantel-fantazi-ic-camasir` | `beyaz-danteli-fantazi-ic-camasir` | Beyaz Dantel Fantazi İç Çamaşır |
| **0.917** | `silky-kiss-aloa-vera-ozlu-prezervatif` | `silky-kiss-aloe-vera-ozlu-prezervatif` | Silky Kiss Aloa Vera Özlü Prezervatif |
| **0.857** | `melez-jasiel-full-realistik-sex-doll` | `melez-jaseii-full-realistik-sex-doll` | Melez Jasiel Full Realistik Sex Doll |
| **0.821** | `okey-ritim-prezervatif-10lu` | `okey-ritm-prezervatif-10-lu` | Okey Ritim Prezervatif 10'Lu |
| **0.789** | `pozizyon-zari-siyah` | `pozisyon-zari-siyah` | Pozizyon Zarı Siyah |
| **0.757** | `seksi-liseli-kiz-kostumu-corap-hediyeli` | `fantazi-liseli-kiz-kostumu-corap-hediyeli` | Seksi Liseli Kız Kostümü+ ÇORAP HEDİYELİ - |
| **0.623** | `belden-baglamali-ici-bos-titresimli-penis-vibrator` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | Belden Bağlamalı İçi Boş Titreşimli Penis Vibratör |
| **0.541** | `strapon-ici-bos-belden-baglamali-penis-vibrator` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | STRAPON İÇİ BOŞ Belden Bağlamalı Penis Vibratör |
| **0.521** | `gercekci-dildo-kalca-masturbator` | `ultra-gercekci-full-realistik-kalca-masturbator` | Gerçekçi Dildo Kalça Mastürbatör |
| **0.507** | `dolgulu-ici-bos-belden-baglamali-titresimli-kumandali-vibrator-strap-on` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | DOLGULU İÇİ BOŞ BELDEN BAĞLAMALI TİTREŞİMLİ KUMANDALI VİBRATÖR STRAP-ON |
| **0.500** | `belden-baglamali-cift-tarafli-ici-dolu-strapon-penis` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | Belden Bağlamalı Çift Taraflı İçi Dolu Strapon Penis |
| **0.500** | `belden-baglamali-ici-dolu-strapon-penis` | `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis` | Belden Bağlamalı İçi Dolu Strapon Penis |
| **0.477** | `19-cm-ten-rengi-vantuzlu-dildo-gercekci-silikon-seks-oyuncagi-realistik-penis-dildo` | `realistik-dokuda-damarli-dildo-vantuzlu-buyuk-boy-gercekci-yapay-penis-27-cm` | 19 CM Ten Rengi Vantuzlu Dildo – Gerçekçi Silikon Seks Oyuncağı \| Realistik Penis Dildo |
| **0.430** | `ero-shop-seffaf-mavi-realistik-dildo-20-cm-esnek-jel-doku-damarli-gercekci-penis` | `realistik-dokuda-damarli-dildo-vantuzlu-buyuk-boy-gercekci-yapay-penis-27-cm` | Ero Shop Şeffaf Mavi Realistik Dildo 20 cm – Esnek Jel Doku, Damarlı Gerçekçi Penis |
| **0.426** | `gercek-boyut-kalca-masturbator-55-kg` | `ultra-gercekci-full-realistik-kalca-masturbator` | Gerçek Boyut Kalça Mastürbatör – 5,5 kg |
| **0.421** | `realistik-ten-penis-vibrator-et-doku-cift-katmanli` | `yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-zenci-penis-24-cm` | REALİSTİK TEN PENİS VİBRATÖR Et Doku Çift Katmanlı |
| **0.417** | `gercekci-vajina-masturbator` | `ultra-gercekci-full-realistik-kalca-masturbator` | Gerçekçi Vajina Mastürbatör |
| **0.416** | `12-titresim-fonksiyonlu-uzaktan-kumandali-yumurta-vibrator` | `ultra-yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-penis-2` | 12 TİTREŞİM FONKSİYONLU UZAKTAN KUMANDALI YUMURTA VİBRATÖR |
| **0.407** | `11-inc-titresimli-et-doku-penis-vibrator-gercek-hissin-yeni-tanimi` | `ultra-yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-penis-2` | 11 İnç Titreşimli Et Doku Penis Vibratör – Gerçek Hissin Yeni Tanımı! |
| **0.382** | `21cm-gercekci-dildo-yapay-penis-vibrator` | `realistik-dokuda-damarli-dildo-vantuzlu-buyuk-boy-gercekci-yapay-penis-27-cm` | 21CM Gerçekçi Dildo Yapay Penis Vibratör |
| **0.379** | `28-cm-titresimli-gercekci-kalin-dildo-penis-guclu-titresim-realistik-dick` | `realistik-dokuda-damarli-dildo-vantuzlu-buyuk-boy-gercekci-yapay-penis-27-cm` | 28 cm Titreşimli Gerçekçi Kalın Dildo Penis \| Güçlü Titreşim – Realistik Dick |
| **0.370** | `yeni-nesil-cift-katmanli-realistik-vantuzlu-testissiz-melez-dildo-penis` | `eroshop-belden-baglamali-vantuzlu-realistik-penis` | Yeni Nesil Çift Katmanlı Realistik Vantuzlu Testissiz Melez Dildo Penis |
| **0.364** | `parlak-dantel-transparan-vucut-corabi-kirmizi` | `vucut-corabi-miss-feliz-kirmizi` | Parlak Dantel Transparan Vücut Çorabı Kırmızı |
apple@Murat-MacBook-Pro cinselhobi.com-next % python3 - <<'PY'
import csv
rows=[]
with open("old-products/unmatched_suggestions.csv".replace("_","-"), newline="", encoding="utf-8") as f:
    r=csv.DictReader(f)
    scores=[]
    for row in r:
        try:
            scores.append(float(row.get("best_score","") or 0))
        except:
            pass

for t in [0.95,0.92,0.90,0.85]:
    print(t, "üstü:", sum(1 for s in scores if s>=t))
PY

0.95 üstü: 7
0.92 üstü: 8
0.9 üstü: 9
0.85 üstü: 10
apple@Murat-MacBook-Pro cinselhobi.com-next % head -n 31 old-products/unmatched-source-only.csv

| Slug | Ürün Adı | SKU | Fiyat (kuruş) | ID |
|------|----------|-----|---------------|-----|
| `11-inc-titresimli-et-doku-penis-vibrator-gercek-hissin-yeni-tanimi` | 11 İnç Titreşimli Et Doku Penis Vibratör – Gerçek Hissin Yeni Tanımı! | - | 2600 | 318 |
| `12-titresim-fonksiyonlu-uzaktan-kumandali-yumurta-vibrator` | 12 TİTREŞİM FONKSİYONLU UZAKTAN KUMANDALI YUMURTA VİBRATÖR | - | 1790 | 351 |
| `19-cm-ten-rengi-vantuzlu-dildo-gercekci-silikon-seks-oyuncagi-realistik-penis-dildo` | 19 CM Ten Rengi Vantuzlu Dildo – Gerçekçi Silikon Seks Oyuncağı \| Realistik Penis Dildo | - | 1100 | 319 |
| `21cm-gercekci-dildo-yapay-penis-vibrator` | 21CM Gerçekçi Dildo Yapay Penis Vibratör | - | 1790 | 253 |
| `28-cm-gercekci-et-doku-uzun-dildo-penis` | 28 cm Gerçekçi Et Doku Uzun Dildo Penis | - | 2490 | 342 |
| `28-cm-titresimli-gercekci-kalin-dildo-penis-guclu-titresim-realistik-dick` | 28 cm Titreşimli Gerçekçi Kalın Dildo Penis \| Güçlü Titreşim – Realistik Dick | - | 2600 | 341 |
| `ava-tpe-skeleton-tam-realistik-manken` | Ava TPE-Skeleton Tam Realistik Manken | - | 74900 | 155 |
| `baile-dolgulu-titresimli-protez-strapon` | Baile Dolgulu Titreşimli Protez Strapon | - | 1890 | 106 |
| `bastan-cikarici-parlak-dantel-transparan-vucut-corabi` | Baştan Çıkarıcı Parlak Dantel Transparan Vücut Çorabı | - | 59000 | 331 |
| `bdsm-fetis-deri-baglama-seti` | BDSM FETİŞ DERİ BAĞLAMA SETİ | - | 79900 | 355 |
| `beautiful-johson-92-inc-vibrator` | Beautiful Johson 9.2 İnç Vibratör | - | 2400 | 311 |
| `belden-baglamali-cift-tarafli-ici-dolu-strapon-penis` | Belden Bağlamalı Çift Taraflı İçi Dolu Strapon Penis | - | 1750 | 172 |
| `belden-baglamali-ici-bos-titresimli-penis-vibrator` | Belden Bağlamalı İçi Boş Titreşimli Penis Vibratör | - | 2100 | 320 |
| `belden-baglamali-ici-dolu-strapon-penis` | Belden Bağlamalı İçi Dolu Strapon Penis | - | 1690 | 133 |
| `belden-baglamali-modern-dildo-siyah-125-cm` | Belden Bağlamalı Modern Dildo Siyah 12,5 cm | - | 1200 | 308 |
| `belden-baglamali-titresimli-125-cm-ici-bos-ikili-catal-strapon-penis` | Belden Bağlamalı Titreşimli 12,5 cm İçi Boş İkili Çatal Strapon Penis | - | 1699 | 223 |
| `beyaz-dantel-fantazi-ic-camasir` | Beyaz Dantel Fantazi İç Çamaşır | - | 39000 | 194 |
| `big-pussy-lilac-cift-tarafli-gercekci-et-dokusunda-anal-oral-ve-vajina-masturbator` | BIG PUSSY Lilac Çift Taraflı Gerçekçi Et Dokusunda Anal Oral ve Vajina Mastürbatör | - | 1690 | 144 |
| `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml-cilekli` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 250 ML Çilekli | - | 34900 | 294 |
| `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 250 ML | - | 34900 | 292 |
| `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-400-ml` | Bona Tessa Su Bazlı Kayganlaştırıcılı Masaj Jeli 400 ML | - | 45000 | 293 |
| `chane-5-cm-dolgulu-premium-silikon-penis-kilifi-ten-rengi-gercekci` | Chane 5 cm Dolgulu Premium Silikon Penis Kılıfı – Ten Rengi Gerçekçi | - | 95000 | 338 |
| `dolgulu-ici-bos-belden-baglamali-titresimli-kumandali-vibrator-strap-on` | DOLGULU İÇİ BOŞ BELDEN BAĞLAMALI TİTREŞİMLİ KUMANDALI VİBRATÖR STRAP-ON | - | 1750 | 350 |
| `ero-shop-barbara-83-inc-dildo` | Ero Shop Barbara 8.3 İnç Dildo | - | 1200 | 309 |
| `ero-shop-bunion-gercek-hissiyatli-uzatici-penis-kilifi` | Ero Shop Bunion Gerçek Hissiyatlı Uzatıcı Penis Kılıfı | - | 89000 | 335 |
| `ero-shop-seffaf-mavi-realistik-dildo-20-cm-esnek-jel-doku-damarli-gercekci-penis` | Ero Shop Şeffaf Mavi Realistik Dildo 20 cm – Esnek Jel Doku, Damarlı Gerçekçi Penis | - | 1250 | 344 |
| `ero-shop-seffaf-pembe-realistik-dildo-23-cm` | Ero Shop Şeffaf Pembe Realistik Dildo 23 cm | - | 1399 | 348 |
| `ero-shop-seffaf-realistik-dildo-23-cm` | Ero Shop Şeffaf Realistik Dildo 23 cm | - | 1400 | 343 |
| `ero-shop-silikon-seffaf-mavi-realistik-dildo-175-cm` | Ero Shop Silikon Şeffaf Mavi Realistik Dildo – 17,5 cm | - | 99000 | 346 |
| `ero-shop-silikon-seffaf-mor-renkli-realistik-dildo-20-cm` | Ero Shop Silikon Şeffaf Mor Renkli Realistik Dildo – 20 cm | - | 1250 | 345 |
apple@Murat-MacBook-Pro cinselhobi.com-next % 




30 old-products/db-only-not-in-eroshopa.slugs.filtered.txt
uzaktan-kumandali-masaj-vibratoru - Kumandalı Giyilebilir Titreşimli Yumurta Vibratör – 10 Modlu
passion-cup-vajina -Passion Cup Kutulu Realistik Vajina Mastürbatör resimleride çok bizde 1 tane var
cilek-aromali-masaj-yagi - stokta yok o yüzden kaynakta yok
fantazi-liseli-kiz-kostumu-corap-hediyeli - stokta yok o yüzden kaynakta yok
fantazi-liseli-kiz-kostumu - stokta yok o yüzden kaynakta yok
seksi-ekose-etekli-bustiyerli-fantazi-kostum - stokta yok o yüzden kaynakta yok
tavsan-kulakli-tirtikli-penis-halkasi - stokta yok o yüzden kaynakta yok
eroshop-belden-baglamali-vantuzlu-realistik-penis - stokta yok o yüzden kaynakta yok
musele-kadin-damla - stokta yok o yüzden kaynakta yok
penis-pompasi-vajina-basligi - stokta yok o yüzden kaynakta yok
ultra-yumusak-dokulu-testissiz-realistik-jel-penis-mor - stokta yok o yüzden kaynakta yok
ultra-yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-penis-2 - bizim veritabanında duplicate ürün sadece bir tane var hem bizde hem eroshopada ve slug ultra-yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-penis
seksi-uzun-fantezi-gece-elbiesi - stokta yok o yüzden kaynakta yok
deri-gorunumlu-fantezi-gecelik-siyah-seksi-kombin - stokta yok o yüzden kaynakta yok
yumusak-dokulu-titresimli-ve-rotasyonlu-realistik-vibrator-zenci-penis-24-cm - ststokta yok o yüzden kaynakta yok
pozisyon-zari-siyah - Pozizyon Zarı Siyah (kaynakta slugda yazım yanlışı yapılmış bizde var ürün ve doğru slugda)
ero-shop-kirmizi-deri-goz-maskesi - stokta yok o yüzden kaynakta yok
ero-shop-deri-goz-maskesi - stokta yok o yüzden kaynakta yok
ero-shop-prostat-g-spot-uyaricili-vibrator - stokta yok o yüzden kaynakta yok
realistik-dokuda-damarli-dildo-vantuzlu-buyuk-boy-gercekci-yapay-penis-27-cm - stokta yok o yüzden kaynakta yok
vucut-corabi-miss-feliz-kirmizi - stokta yok o yüzden kaynakta yok
vucut-corabi-miss-feliz-siyah - stokta yok o yüzden kaynakta yok
vucut-corabi-miss-feliz- stokta yok o yüzden kaynakta yok
ultra-gercekci-full-realistik-kalca-masturbator - stokta yok o yüzden kaynakta yok
arkadan-acik-fantezi-giyim-kirmizi - stokta yok o yüzden kaynakta yok
babydoll-transparan-ic-giyim-fantezi - stokta yok o yüzden kaynakta yok
jartiyerli-deri-kirmizi-gecelik-corap-hediyeli - stokta yok o yüzden kaynakta yok
okey-ritm-prezervatif-10-lu - Okey Ritim Prezervatif 10'Lu kaynakta var bizde imla hatası var
ozel-bolgesi-acik-seksi-ic-giyim - stokta yok o yüzden kaynakta yok
masaj-yagi-tutti-frutti-karisik-meyve-aromali - stokta yok o yüzden kaynakta yok
apple@Murat-MacBook-Pro cinselhobi.com-next % 