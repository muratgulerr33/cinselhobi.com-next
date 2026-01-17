# TOPLEVEL_TODO - Manuel Kategori Atama

**Oluşturulma Tarihi:** 14.01.2026 00:04:31

---

## Kullanım Talimatı

1. `TOPLEVEL_TODO.csv` dosyasını açın
2. Her ürün için `final_top_level_slug` kolonunu manuel olarak doldurun
3. `suggested_top_level` kolonu sadece bir öneridir, kesin karar `final_top_level_slug` kolonunda verilir
4. Olası değerler:
   - `kadinlara-ozel` - Kadınlara özel ürünler
   - `erkeklere-ozel` - Erkeklere özel ürünler
   - `ciftlere-ozel` - Çiftlere özel ürünler (eğer DB'de varsa)
   - Boş bırakılabilir (üst kategori yok)

## Özet İstatistikler

### HUB Kategori Adayları

#### Top-level Kategoriler (parent NULL)

| Slug | Name |
|------|------|
| anal-oyuncaklar | ANAL OYUNCAKLAR |
| erkeklere-ozel | ERKEKLERE ÖZEL |
| fantezi-aksesuarlar | FANTEZİ AKSESUARLAR |
| geciktiriciler | GECİKTİRİCİLER |
| kadinlara-ozel | KADINLARA ÖZEL |
| kayganlastirici-jeller | KAYGANLAŞTIRICI JELLER |
| kozmetik | KOZMETİK |
| realistik-mankenler | REALİSTİK MANKENLER |
| sex-oyuncaklari | SEX OYUNCAKLARI |

#### Slug'da 'ozel' Geçen Kategoriler

| Slug | Name | Parent WC ID |
|------|------|--------------|
| erkeklere-ozel | ERKEKLERE ÖZEL | null |
| kadinlara-ozel | KADINLARA ÖZEL | null |

### Ürün İstatistikleri

- **Toplam Ürün:** 244
- **Filtre:** publish+instock

### Suggested Top Level Dağılımı

| Öneri | Sayı |
|-------|------|
| kadin | 26 |
| erkek | 36 |
| cift | 8 |
| none | 174 |

## Heuristic Açıklaması

`suggested_top_level` değeri şu kurallara göre hesaplanır:

1. Eğer ürünün kategorileri arasında `kadinlara-ozel` varsa → **kadin**
2. Eğer ürünün kategorileri arasında `erkeklere-ozel` varsa → **erkek**
3. Eğer ikisi de yoksa:
   - Ürün adında 'çift', 'partner' gibi kelimeler varsa → **cift**
   - Yoksa → **none**

**Not:** Bu sadece bir öneridir. Kesin karar `final_top_level_slug` kolonunda manuel olarak verilir.
