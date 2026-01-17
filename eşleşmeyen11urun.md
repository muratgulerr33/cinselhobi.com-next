Aynen bro, bu 11’inde **asıl problem “resim yok” değil** → **slug uyuşmuyor.**

Script şunu arıyor:

* `public/products/<DB_SLUG>/<DB_SLUG>.webp`

Ama sende klasör + dosyalar şu isimle duruyor:

* `public/products/<CLOSEST_SLUG>/<CLOSEST_SLUG>.webp`

O yüzden **hem `has_public_folder=false` hem `cover_exists=false`** görünüyor.

Aşağıda **okunabilir şekilde 11 eşleşmeyen ürün** + **ne fark var** + **ne yapacaksın** listesi:

---

## Eşleşmeyen 11 ürün (DB slug ↔ public klasör slug)

1. **DB:** `beautiful-johson-9-2-inc-vibrator`
   **Public’te var:** `beautiful-johson-92-inc-vibrator` düzeltildi
   **Fark:** `9-2` ↔ `92` (tire farkı)
   **Yapılacak:** klasörü+dosyaları DB slug’a göre rename

2. **DB:** `belden-baglamali-modern-dildo-siyah-12-5-cm`
   **Public:** `belden-baglamali-modern-dildo-siyah-125-cm`düzeltildi
   **Fark:** `12-5` ↔ `125`
   **Yapılacak:** rename

3. **DB:** `belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis`
   **Public:** `belden-baglamali-titresimli-125-cm-ici-bos-ikili-catal-strapon-penis`düzeltildi
   **Fark:** `12-5` ↔ `125`
   **Yapılacak:** rename

4. **DB:** `beyaz-danteli-fantazi-ic-camasir` veritabanından rename edilecek bizdeki adı yanlış
   **Public:** `beyaz-dantel-fantazi-ic-camasir`
   **Fark:** `danteli` ↔ `dantel`
   **Yapılacak:** rename

5. **DB:** `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml`
   **Public:** `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml`düzeltildi
   **Fark:** `kayganlastirici` ↔ `kayganlastiricili` (fazladan “li”)
   **Yapılacak:** rename

6. **DB:** `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml-cilekli`
   **Public:** `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml-cilekli`düzeltildi
   **Fark:** `kayganlastirici` ↔ `kayganlastiricili`
   **Yapılacak:** rename

7. **DB:** `bona-tessa-su-bazli-kayganlastirici-masaj-jeli-400-ml`
   **Public:** `bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-400-ml`düzeltildi
   **Fark:** `kayganlastirici` ↔ `kayganlastiricili`
   **Yapılacak:** rename

8. **DB:** `ero-shop-barbara-8-3-inc-dildo`
   **Public:** `ero-shop-barbara-83-inc-dildo`düzeltildi
   **Fark:** `8-3` ↔ `83`
   **Yapılacak:** rename

9. **DB:** `melez-jaseii-full-realistik-sex-doll`  bizdeyanlış doğru olan publicte olan 
   **Public:** `melez-jasiel-full-realistik-sex-doll`
   **Fark:** yazım farkı (`jaseii` ↔ `jasiel`)
   **Yapılacak:** rename

10. **DB:** `okey-ritm-prezervatif-10-lu` bizde yanlışpulicte doğru 
    **Public:** `okey-ritim-prezervatif-10lu`
    **Fark:** `ritm` ↔ `ritim` + `10-lu` ↔ `10lu`
    **Yapılacak:** rename

11. **DB:** `silky-kiss-aloe-vera-ozlu-prezervatif`
    **Public:** `silky-kiss-aloa-vera-ozlu-prezervatif` düzeltildi
    **Fark:** `aloe` ↔ `aloa`
    **Yapılacak:** rename

---

## Manuel düzeltme (en kolay ve güvenli yol)

**Canonical (tek doğru) olarak DB slug’ı alıyoruz.**
Yani her satırda: **public’teki klasör adını DB slug’a çevir** + klasör içindeki dosyaların başını da değiştir.

### Tek seferlik kopyala-yapıştır yardımcı fonksiyon

Bunu terminale bir kere yapıştır:

```bash
rename_slug () {
  OLD="$1"
  NEW="$2"

  echo "==> $OLD  ->  $NEW"
  mv "public/products/$OLD" "public/products/$NEW"

  # klasör içindeki tüm dosyalarda baştaki OLD'yi NEW yap
  for f in "public/products/$NEW/$OLD"*; do
    [ -e "$f" ] || continue
    mv "$f" "${f//$OLD/$NEW}"
  done
}
```

Sonra 11’ini tek tek çalıştır:

```bash
rename_slug "beautiful-johson-92-inc-vibrator" "beautiful-johson-9-2-inc-vibrator"
rename_slug "belden-baglamali-modern-dildo-siyah-125-cm" "belden-baglamali-modern-dildo-siyah-12-5-cm"
rename_slug "belden-baglamali-titresimli-125-cm-ici-bos-ikili-catal-strapon-penis" "belden-baglamali-titresimli-12-5-cm-ici-bos-ikili-catal-strapon-penis"
rename_slug "beyaz-dantel-fantazi-ic-camasir" "beyaz-danteli-fantazi-ic-camasir"
rename_slug "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml" "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml"
rename_slug "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml-cilekli" "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml-cilekli"
rename_slug "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-400-ml" "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-400-ml"
rename_slug "ero-shop-barbara-83-inc-dildo" "ero-shop-barbara-8-3-inc-dildo"
rename_slug "melez-jasiel-full-realistik-sex-doll" "melez-jaseii-full-realistik-sex-doll"
rename_slug "okey-ritim-prezervatif-10lu" "okey-ritm-prezervatif-10-lu"
rename_slug "silky-kiss-aloa-vera-ozlu-prezervatif" "silky-kiss-aloe-vera-ozlu-prezervatif"
```

