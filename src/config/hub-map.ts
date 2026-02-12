/**
 * Hub Map Configuration (v1)
 * 
 * UI Navigation Hub Mapping - Single Source of Truth
 * 
 * Bu dosya, UI navigasyonunda gösterilecek hub'ları ve kategorileri tanımlar.
 * Navigation asla DB'den otomatik türetilmez; bu config dosyasından beslenir.
 * 
 * Hub'lar DB top-level kategorileri ile birebir olmak zorunda değildir.
 * Hub'lar kullanıcı intent'ine göre organize edilir.
 */

export type HubItemType = "category" | "virtual";
export type HubItemAudience = "women" | "men" | "unisex" | "mixed";
export type HubItemPolicy = "safe" | "mixed" | "hidden-if-empty";

export interface HubItem {
  type: HubItemType;
  label: string; // UI'da görünen isim
  slug?: string; // type="category" ise zorunlu
  note?: string; // Kısa açıklama
  audience: HubItemAudience;
  policy: HubItemPolicy;
}

export interface Hub {
  id: string;
  title: string;
  subtitle?: string;
  items: HubItem[];
}

/**
 * Hub Map v1 - Initial Mapping
 * 
 * 5 Hub tanımı:
 * 1. Erkek & Performans
 * 2. Kadın & Haz
 * 3. Çiftlere Özel
 * 4. Sağlık & Bakım
 * 5. Fantezi Dünyası
 */
export const hubMap: Hub[] = [
  {
    id: "men-performance",
    title: "Erkek & Performans",
    items: [
      {
        type: "category",
        label: "Erkeklere Özel",
        slug: "erkeklere-ozel",
        audience: "men",
        policy: "safe",
      },
      {
        type: "category",
        label: "Şişme Kadınlar",
        slug: "sisme-kadinlar",
        audience: "men",
        policy: "safe",
        note: "erkeklere-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Penis Pompaları",
        slug: "penis-pompalari",
        audience: "men",
        policy: "safe",
        note: "erkeklere-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Suni Vajina Mastürbatörler",
        slug: "suni-vajina-masturbatorler",
        audience: "men",
        policy: "safe",
        note: "erkeklere-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Halka ve Kılıflar",
        slug: "halka-kiliflar",
        audience: "men",
        policy: "safe",
        note: "erkeklere-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Geciktiriciler",
        slug: "geciktiriciler",
        audience: "men",
        policy: "safe",
      },
    ],
  },
  {
    id: "women-pleasure",
    title: "Kadın & Haz",
    items: [
      {
        type: "category",
        label: "Kadınlara Özel",
        slug: "kadinlara-ozel",
        audience: "women",
        policy: "safe",
      },
      {
        type: "category",
        label: "Bayan İstek Arttırıcılar",
        slug: "bayan-istek-arttiricilar",
        audience: "women",
        policy: "safe",
        note: "kadinlara-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Fantezi Giyim",
        slug: "fantezi-giyim",
        audience: "women",
        policy: "safe",
        note: "kadinlara-ozel alt kategorisi",
      },
      {
        type: "category",
        label: "Fetiş ve Fantezi",
        slug: "fetis-fantezi",
        audience: "women",
        policy: "safe",
        note: "kadinlara-ozel alt kategorisi",
      },
      // Sex Oyuncakları altındaki kadın odaklı kategoriler
      // Mixed intent kategorisi olduğu için direkt eklenmez; sadece güvenli alt linkler eklenir
      {
        type: "category",
        label: "Belden Bağlamalılar",
        slug: "belden-baglamalilar",
        audience: "women",
        policy: "safe",
        note: "sex-oyuncaklari alt kategorisi",
      },
      {
        type: "category",
        label: "Ten Dokulu Modeller",
        slug: "et-dokulu-urunler",
        audience: "women",
        policy: "safe",
        note: "sex-oyuncaklari alt kategorisi - UI'da daha anlaşılır label",
      },
      {
        type: "category",
        label: "Modern Vibratörler",
        slug: "modern-vibratorler",
        audience: "women",
        policy: "safe",
        note: "sex-oyuncaklari alt kategorisi",
      },
      {
        type: "category",
        label: "Realistik Dildolar",
        slug: "realistik-dildolar",
        audience: "women",
        policy: "safe",
        note: "sex-oyuncaklari alt kategorisi",
      },
    ],
  },
  {
    id: "couples",
    title: "Çiftlere Özel",
    subtitle: "Çiftler için özel koleksiyonlar",
    items: [
      {
        type: "virtual",
        label: "Çiftler Koleksiyonu",
        audience: "unisex",
        policy: "hidden-if-empty",
        note: "Virtual collection - query/collection sonraki adımda tanımlanacak",
      },
    ],
  },
  {
    id: "health-care",
    title: "Sağlık & Bakım",
    items: [
      {
        type: "category",
        label: "Kozmetik",
        slug: "kozmetik",
        audience: "unisex",
        policy: "hidden-if-empty",
      },
      {
        type: "category",
        label: "Prezervatifler",
        slug: "prezervatifler",
        audience: "unisex",
        policy: "safe",
        note: "kozmetik alt kategorisi",
      },
      {
        type: "category",
        label: "Parfümler",
        slug: "parfumler",
        audience: "unisex",
        policy: "safe",
        note: "kozmetik alt kategorisi",
      },
      {
        type: "category",
        label: "Masaj Yağları",
        slug: "masaj-yaglari",
        audience: "unisex",
        policy: "safe",
        note: "kozmetik alt kategorisi",
      },
      {
        type: "category",
        label: "Kayganlaştırıcı Jeller",
        slug: "kayganlastirici-jeller",
        audience: "unisex",
        policy: "safe",
      },
    ],
  },
  {
    id: "fantasy-world",
    title: "Fantezi Dünyası",
    items: [
      {
        type: "category",
        label: "Fetiş ve Fantezi",
        slug: "fetis-fantezi",
        audience: "mixed",
        policy: "safe",
      },
      {
        type: "category",
        label: "Fantezi Giyim",
        slug: "fantezi-giyim",
        audience: "mixed",
        policy: "safe",
      },
      {
        type: "category",
        label: "Anal Oyuncaklar",
        slug: "anal-oyuncaklar",
        audience: "mixed",
        policy: "safe",
      },
      {
        type: "category",
        label: "Realistik Mankenler",
        slug: "realistik-mankenler",
        audience: "mixed",
        policy: "safe",
      },
    ],
  },
];

/**
 * Helper: Hub Map'ten sadece category tipindeki item'ları filtrele
 */
export function getCategoryItemsFromHubMap(): HubItem[] {
  return hubMap.flatMap((hub) => hub.items.filter((item) => item.type === "category"));
}

/**
 * Helper: Hub Map'ten navigation için category tree yapısı oluştur
 * DesktopNavigation component'i için uyumlu format
 * 
 * Parent-child ilişkisi hub map'te manuel olarak tanımlanmıştır.
 * note alanında "alt kategorisi" yazıyorsa, o item bir child kategoridir.
 * note formatı: "{parent-slug} alt kategorisi"
 */
export function getCategoryTreeFromHubMap(): Array<{
  label: string;
  slug: string;
  children: Array<{ label: string; slug: string }>;
}> {
  const tree: Array<{
    label: string;
    slug: string;
    children: Array<{ label: string; slug: string }>;
  }> = [];

  // Tüm hub'lardan category item'larını topla
  const allCategoryItems: HubItem[] = [];
  for (const hub of hubMap) {
    allCategoryItems.push(...hub.items.filter((item) => item.type === "category" && item.slug));
  }
  
  // Parent kategorileri bul (note'unda "alt kategorisi" yazmayanlar)
  const parentItems = allCategoryItems.filter((item) => !item.note?.includes("alt kategorisi"));
  
  // Her parent kategori için tree entry oluştur
  for (const parentItem of parentItems) {
    if (!parentItem.slug) continue;
    
    // Bu parent'a ait child'ları bul
    // Child'lar, note'unda "{parent-slug} alt kategorisi" formatında olan item'lar
    const children: Array<{ label: string; slug: string }> = [];
    
    for (const childItem of allCategoryItems) {
      if (
        childItem.slug &&
        childItem.note?.includes("alt kategorisi") &&
        childItem.note.includes(parentItem.slug)
      ) {
        children.push({
          label: childItem.label,
          slug: childItem.slug,
        });
      }
    }
    
    tree.push({
      label: parentItem.label,
      slug: parentItem.slug,
      children,
    });
  }

  // Duplicate slug'ları kaldır (ilk görüneni tut)
  const seen = new Set<string>();
  return tree.filter((item) => {
    if (seen.has(item.slug)) {
      return false;
    }
    seen.add(item.slug);
    return true;
  });
}
