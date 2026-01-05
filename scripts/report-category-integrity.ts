import { db } from "../src/db/connection";
import { categories, products, productCategories } from "../src/db/schema";
import { eq, isNull, sql, inArray, and, count, desc } from "drizzle-orm";

// Hardcoded slug'lar (UI'dan toplanan)
const HARDCODED_SLUGS = {
  desktopNav: [
    "kadinlara-ozel",
    "erkeklere-ozel",
    "sex-oyuncaklari",
    "kozmetik",
    "geciktiriciler",
    "kayganlastirici-jeller",
    "anal-oyuncaklar",
    "realistik-mankenler",
    "fantezi-giyim",
    "fetis-ve-fantezi",
    "sisme-erkekler",
    "bayan-istek-arttiricilar",
    "sisme-kadinlar",
    "penis-pompalari",
    "suni-vajina-masturbatorler",
    "halka-ve-kiliflar",
    "belden-baglamalilar",
    "et-dokulu-urunler",
    "modern-vibratorler",
    "realistik-dildolar",
    "sex-makinalari",
    "prezervatifler",
    "parfumler",
    "masaj-yaglari",
  ],
  footer: [
    "kadinlara-ozel",
    "erkeklere-ozel",
    "vibratorler",
    "kayganlastiricilar",
    "geciktiriciler",
  ],
};

// Overlap analizi için kategori çiftleri
const OVERLAP_PAIRS = [
  ["kadinlara-ozel", "fetis-ve-fantezi"],
  ["kadinlara-ozel", "fantezi-giyim"],
  ["fetis-ve-fantezi", "sex-oyuncaklari"],
  ["sex-oyuncaklari", "fantezi-giyim"],
];

interface CategoryTree {
  name: string;
  slug: string;
  children: CategoryTree[];
}

interface CategoryStats {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
  productCount: number;
  isTopLevel: boolean;
}

interface ProductCategoryCount {
  productId: number;
  productName: string;
  productSlug: string;
  categoryCount: number;
  categories: string[];
}

interface OverlapResult {
  category1: string;
  category2: string;
  overlapCount: number;
  category1Exists: boolean;
  category2Exists: boolean;
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

function printSubsection(title: string) {
  console.log("\n" + "-".repeat(80));
  console.log(title);
  console.log("-".repeat(80));
}

function printCategoryTree(tree: CategoryTree[], indent = 0) {
  for (const cat of tree) {
    const prefix = "  ".repeat(indent);
    console.log(`${prefix}${cat.name} (${cat.slug})`);
    if (cat.children.length > 0) {
      printCategoryTree(cat.children, indent + 1);
    }
  }
}

async function buildCategoryTree(
  allCategories: Array<{
    id: number;
    wcId: number;
    slug: string;
    name: string;
    parentWcId: number | null;
  }>
): Promise<CategoryTree[]> {
  const categoryMap = new Map<number, CategoryTree>();
  const topLevel: CategoryTree[] = [];

  // İlk geçiş: tüm kategorileri oluştur
  for (const cat of allCategories) {
    categoryMap.set(cat.wcId, {
      name: cat.name,
      slug: cat.slug,
      children: [],
    });
  }

  // İkinci geçiş: parent-child ilişkilerini kur
  for (const cat of allCategories) {
    const treeNode = categoryMap.get(cat.wcId)!;
    if (cat.parentWcId === null || cat.parentWcId === 0) {
      topLevel.push(treeNode);
    } else {
      const parent = categoryMap.get(cat.parentWcId);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Orphan kategori - top-level'e ekle
        topLevel.push(treeNode);
      }
    }
  }

  // Alfabetik sıralama
  const sortTree = (nodes: CategoryTree[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortTree(node.children);
    }
  };
  sortTree(topLevel);

  return topLevel;
}

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║          KATEGORİ-ÜRÜN TUTARLILIK RAPORU (Read-Only Analiz)              ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝");

  // ============================================================================
  // ADIM A: ŞEMA KEŞFİ
  // ============================================================================
  printSection("ADIM A: ŞEMA KEŞFİ");

  console.log("\n✓ Şema Dosyası: src/db/schema.ts");
  console.log("  - products tablosu: id (primary key), wcId, slug, name");
  console.log("  - categories tablosu: id (primary key), wcId, slug, name, parentWcId");
  console.log("  - productCategories tablosu: productId, categoryId (join table)");
  console.log("  - Connection: src/db/connection.ts (drizzle + node-postgres)");

  // Tüm kategorileri çek
  const allCategories = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      slug: categories.slug,
      name: categories.name,
      parentWcId: categories.parentWcId,
    })
    .from(categories)
    .orderBy(categories.name);

  console.log(`\n✓ Toplam kategori sayısı: ${allCategories.length}`);

  // Kategori ağacını oluştur
  const categoryTree = await buildCategoryTree(allCategories);

  // ============================================================================
  // (1) KATEGORİ AĞACI
  // ============================================================================
  printSection("(1) KATEGORİ AĞACI (IDsiz Görünüm)");

  printCategoryTree(categoryTree);

  // ============================================================================
  // (2) KATEGORİ BAŞINA ÜRÜN SAYISI
  // ============================================================================
  printSection("(2) KATEGORİ BAŞINA ÜRÜN SAYISI");

  // Kategori başına ürün sayısını hesapla
  const categoryProductCounts = await db
    .select({
      categoryId: productCategories.categoryId,
      productCount: sql<number>`COUNT(DISTINCT ${productCategories.productId})::int`,
    })
    .from(productCategories)
    .groupBy(productCategories.categoryId);

  const categoryStatsMap = new Map<number, number>();
  for (const row of categoryProductCounts) {
    categoryStatsMap.set(row.categoryId, row.productCount);
  }

  const categoryStats: CategoryStats[] = allCategories.map((cat) => ({
    id: cat.id,
    wcId: cat.wcId,
    slug: cat.slug,
    name: cat.name,
    parentWcId: cat.parentWcId,
    productCount: categoryStatsMap.get(cat.id) || 0,
    isTopLevel: cat.parentWcId === null || cat.parentWcId === 0,
  }));

  // Top-level kategoriler
  printSubsection("Top-Level Kategoriler (parentWcId IS NULL)");
  const topLevelCategories = categoryStats.filter((c) => c.isTopLevel);
  topLevelCategories.sort((a, b) => b.productCount - a.productCount);
  console.log("\nKategori Adı | Slug | Ürün Sayısı");
  console.log("-".repeat(60));
  for (const cat of topLevelCategories) {
    console.log(`${cat.name.padEnd(30)} | ${cat.slug.padEnd(25)} | ${cat.productCount}`);
  }

  // Child kategoriler
  printSubsection("Child Kategoriler (parentWcId NOT NULL)");
  const childCategories = categoryStats.filter((c) => !c.isTopLevel);
  childCategories.sort((a, b) => b.productCount - a.productCount);
  console.log("\nKategori Adı | Slug | Parent | Ürün Sayısı");
  console.log("-".repeat(70));
  for (const cat of childCategories) {
    const parent = allCategories.find((c) => c.wcId === cat.parentWcId);
    const parentName = parent ? parent.name : `Unknown (wcId: ${cat.parentWcId})`;
    console.log(
      `${cat.name.padEnd(30)} | ${cat.slug.padEnd(25)} | ${parentName.padEnd(20)} | ${cat.productCount}`
    );
  }

  // 0 ürün kategorileri
  printSubsection("0 Ürün Kategorileri");
  const emptyCategories = categoryStats.filter((c) => c.productCount === 0);
  if (emptyCategories.length === 0) {
    console.log("\n✓ Tüm kategorilerde en az 1 ürün var.");
  } else {
    console.log(`\n⚠️  ${emptyCategories.length} kategori boş:`);
    for (const cat of emptyCategories) {
      const level = cat.isTopLevel ? "Top-Level" : "Child";
      console.log(`  - ${cat.name} (${cat.slug}) [${level}]`);
    }
  }

  // ============================================================================
  // (3) ÜRÜN BAŞINA KATEGORİ SAYISI (ÇOKLU KATEGORİ)
  // ============================================================================
  printSection("(3) ÜRÜN BAŞINA KATEGORİ SAYISI");

  // Ürün başına kategori sayısını hesapla
  const productCategoryCounts = await db
    .select({
      productId: productCategories.productId,
      categoryCount: sql<number>`COUNT(${productCategories.categoryId})::int`,
    })
    .from(productCategories)
    .groupBy(productCategories.productId)
    .orderBy(desc(sql`COUNT(${productCategories.categoryId})`))
    .limit(30);

  const productIds = productCategoryCounts.map((p) => p.productId);
  const productDetails = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
    })
    .from(products)
    .where(inArray(products.id, productIds));

  const productDetailsMap = new Map(productDetails.map((p) => [p.id, p]));

  // Her ürünün kategorilerini çek
  const productCategoriesMap = new Map<number, string[]>();
  for (const pc of await db
    .select({
      productId: productCategories.productId,
      categorySlug: categories.slug,
    })
    .from(productCategories)
    .innerJoin(categories, eq(productCategories.categoryId, categories.id))
    .where(inArray(productCategories.productId, productIds))) {
    const existing = productCategoriesMap.get(pc.productId) || [];
    existing.push(pc.categorySlug);
    productCategoriesMap.set(pc.productId, existing);
  }

  const productCategoryStats: ProductCategoryCount[] = productCategoryCounts.map((pc) => {
    const product = productDetailsMap.get(pc.productId);
    return {
      productId: pc.productId,
      productName: product?.name || `Unknown (ID: ${pc.productId})`,
      productSlug: product?.slug || `unknown-${pc.productId}`,
      categoryCount: pc.categoryCount,
      categories: productCategoriesMap.get(pc.productId) || [],
    };
  });

  console.log("\nEn Çok Kategoriye Bağlı İlk 30 Ürün:");
  console.log("\nÜrün Adı | Slug | Kategori Sayısı | Kategoriler");
  console.log("-".repeat(100));
  for (const stat of productCategoryStats) {
    const name = stat.productName.length > 40 ? stat.productName.substring(0, 37) + "..." : stat.productName;
    const categoriesStr = stat.categories.join(", ");
    const categoriesDisplay = categoriesStr.length > 50 ? categoriesStr.substring(0, 47) + "..." : categoriesStr;
    console.log(
      `${name.padEnd(40)} | ${stat.productSlug.padEnd(25)} | ${stat.categoryCount.toString().padStart(3)} | ${categoriesDisplay}`
    );
  }

  // Medyan ve ortalama
  const allProductCategoryCounts = await db
    .select({
      categoryCount: sql<number>`COUNT(${productCategories.categoryId})::int`,
    })
    .from(productCategories)
    .groupBy(productCategories.productId);

  const counts = allProductCategoryCounts.map((r) => r.categoryCount);
  counts.sort((a, b) => a - b);
  const median = counts.length > 0 ? counts[Math.floor(counts.length / 2)] : 0;
  const average = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

  console.log(`\n📊 İstatistikler:`);
  console.log(`  - Toplam ürün sayısı: ${counts.length}`);
  console.log(`  - Ortalama kategori sayısı: ${average.toFixed(2)}`);
  console.log(`  - Medyan kategori sayısı: ${median}`);
  console.log(`  - Minimum kategori sayısı: ${counts.length > 0 ? counts[0] : 0}`);
  console.log(`  - Maksimum kategori sayısı: ${counts.length > 0 ? counts[counts.length - 1] : 0}`);

  // ============================================================================
  // (4) PARENT KATEGORİYE DOĞRUDAN BAĞLI ÜRÜNLER (KRİTİK)
  // ============================================================================
  printSection("(4) PARENT KATEGORİYE DOĞRUDAN BAĞLI ÜRÜNLER");

  const directProductsByCategory = new Map<number, number[]>();
  const topLevelCategoryIds = topLevelCategories.map((c) => c.id);
  if (topLevelCategoryIds.length === 0) {
    console.log("\n⚠️  Top-level kategori bulunamadı.");
  } else {
    // Top-level kategorilere doğrudan bağlı ürünleri bul
    const directProducts = await db
      .select({
        categoryId: productCategories.categoryId,
        productId: productCategories.productId,
      })
      .from(productCategories)
      .where(inArray(productCategories.categoryId, topLevelCategoryIds));
    for (const dp of directProducts) {
      const existing = directProductsByCategory.get(dp.categoryId) || [];
      existing.push(dp.productId);
      directProductsByCategory.set(dp.categoryId, existing);
    }

    console.log("\nTop-Level Kategori | Doğrudan Bağlı Ürün Sayısı");
    console.log("-".repeat(60));
    for (const topCat of topLevelCategories) {
      const directCount = directProductsByCategory.get(topCat.id)?.length || 0;
      if (directCount > 0) {
        console.log(`${topCat.name.padEnd(30)} | ${directCount.toString().padStart(3)}`);
      }
    }

    // Örnek ürünler (ilk 20)
    printSubsection("Örnek Ürünler (İlk 20)");
    const allDirectProductIds = Array.from(new Set(directProducts.map((dp) => dp.productId))).slice(0, 20);
    if (allDirectProductIds.length > 0) {
      const sampleProducts = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
        })
        .from(products)
        .where(inArray(products.id, allDirectProductIds));

      const sampleProductCategories = await db
        .select({
          productId: productCategories.productId,
          categorySlug: categories.slug,
          categoryName: categories.name,
          isTopLevel: sql<boolean>`${categories.parentWcId} IS NULL`,
        })
        .from(productCategories)
        .innerJoin(categories, eq(productCategories.categoryId, categories.id))
        .where(inArray(productCategories.productId, allDirectProductIds));

      const productCategoryMap = new Map<number, Array<{ slug: string; name: string; isTopLevel: boolean }>>();
      for (const spc of sampleProductCategories) {
        const existing = productCategoryMap.get(spc.productId) || [];
        existing.push({
          slug: spc.categorySlug,
          name: spc.categoryName,
          isTopLevel: spc.isTopLevel,
        });
        productCategoryMap.set(spc.productId, existing);
      }

      console.log("\nÜrün Adı | Slug | Kategoriler (Top-Level işaretli)");
      console.log("-".repeat(100));
      for (const product of sampleProducts) {
        const cats = productCategoryMap.get(product.id) || [];
        const topLevelCats = cats.filter((c) => c.isTopLevel).map((c) => `*${c.name}*`);
        const childCats = cats.filter((c) => !c.isTopLevel).map((c) => c.name);
        const allCats = [...topLevelCats, ...childCats].join(", ");
        const name = product.name.length > 40 ? product.name.substring(0, 37) + "..." : product.name;
        console.log(`${name.padEnd(40)} | ${product.slug.padEnd(25)} | ${allCats}`);
      }
      console.log("\n* = Top-level kategori");
    }
  }

  // ============================================================================
  // (5) ÇAKIŞMA ANALİZİ (OVERLAP)
  // ============================================================================
  printSection("(5) ÇAKIŞMA ANALİZİ (Overlap)");

  // Slug'dan kategori ID'ye map
  const slugToIdMap = new Map<string, number>();
  for (const cat of allCategories) {
    slugToIdMap.set(cat.slug, cat.id);
  }

  const overlapResults: OverlapResult[] = [];

  for (const [slug1, slug2] of OVERLAP_PAIRS) {
    const id1 = slugToIdMap.get(slug1);
    const id2 = slugToIdMap.get(slug2);
    const exists1 = id1 !== undefined;
    const exists2 = id2 !== undefined;

    let overlapCount = 0;
    if (exists1 && exists2) {
      // Her iki kategoriye de bağlı ürünleri bul
      const productsInCat1 = await db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(eq(productCategories.categoryId, id1!));

      const productsInCat2 = await db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(eq(productCategories.categoryId, id2!));

      const set1 = new Set(productsInCat1.map((p) => p.productId));
      const set2 = new Set(productsInCat2.map((p) => p.productId));
      overlapCount = Array.from(set1).filter((id) => set2.has(id)).length;
    }

    overlapResults.push({
      category1: slug1,
      category2: slug2,
      overlapCount,
      category1Exists: exists1,
      category2Exists: exists2,
    });
  }

  console.log("\nKategori 1 | Kategori 2 | Kesişim Sayısı | Durum");
  console.log("-".repeat(80));
  for (const result of overlapResults) {
    let status = "✓ Her iki kategori mevcut";
    if (!result.category1Exists && !result.category2Exists) {
      status = "⚠️  Her iki kategori de bulunamadı";
    } else if (!result.category1Exists) {
      status = "⚠️  Kategori 1 bulunamadı";
    } else if (!result.category2Exists) {
      status = "⚠️  Kategori 2 bulunamadı";
    }

    console.log(
      `${result.category1.padEnd(25)} | ${result.category2.padEnd(25)} | ${result.overlapCount.toString().padStart(3)} | ${status}`
    );
  }

  // ============================================================================
  // (6) ORPHAN / BOZUK AĞAÇ
  // ============================================================================
  printSection("(6) ORPHAN / BOZUK AĞAÇ KONTROLÜ");

  // Orphan kategoriler (parentWcId dolu ama parent kaydı yok)
  const wcIdSet = new Set(allCategories.map((c) => c.wcId));
  const orphanCategories = allCategories.filter(
    (cat) => cat.parentWcId !== null && cat.parentWcId !== 0 && !wcIdSet.has(cat.parentWcId)
  );

  if (orphanCategories.length === 0) {
    console.log("\n✓ Orphan kategori yok (tüm parent'lar mevcut).");
  } else {
    console.log(`\n⚠️  ${orphanCategories.length} orphan kategori bulundu:`);
    for (const orphan of orphanCategories) {
      console.log(`  - ${orphan.name} (${orphan.slug}) → parentWcId: ${orphan.parentWcId} (bulunamadı)`);
    }
  }

  // Duplicate slug kontrolü
  const slugCounts = new Map<string, number>();
  for (const cat of allCategories) {
    slugCounts.set(cat.slug, (slugCounts.get(cat.slug) || 0) + 1);
  }

  const duplicateSlugs = Array.from(slugCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicateSlugs.length === 0) {
    console.log("\n✓ Duplicate slug yok (tüm slug'lar unique).");
  } else {
    console.log(`\n⚠️  ${duplicateSlugs.length} duplicate slug bulundu:`);
    for (const [slug, count] of duplicateSlugs) {
      const cats = allCategories.filter((c) => c.slug === slug);
      console.log(`  - "${slug}" (${count} kez):`);
      for (const cat of cats) {
        console.log(`    * ${cat.name} (wcId: ${cat.wcId}, id: ${cat.id})`);
      }
    }
  }

  // ============================================================================
  // (7) UI QUERY BEHAVIOR ANALİZİ
  // ============================================================================
  printSection("(7) UI QUERY BEHAVIOR ANALİZİ");

  console.log("\n✓ Kategori Sayfası: src/app/[slug]/page.tsx");
  console.log("✓ Query Fonksiyonu: src/db/queries/catalog.ts -> getProductsCursor()");
  console.log("\n📋 Query Davranışı:");
  console.log("  - Fonksiyon: getProductsCursor()");
  console.log("  - Parametre: categorySlug");
  console.log("  - Davranış: 'includes descendants'");
  console.log("  - Detay: Eğer subCategoryIds yoksa, parent'ın child kategorilerini de dahil ediyor");
  console.log("  - Kod Referansı: src/db/queries/catalog.ts:254-262");
  console.log("\n  Örnek:");
  console.log("    - Kullanıcı '/kadinlara-ozel' sayfasını açtığında");
  console.log("    - Sistem 'kadinlara-ozel' kategorisini bulur");
  console.log("    - Bu kategorinin child'larını da çeker");
  console.log("    - Hem parent hem child kategorilere bağlı ürünleri gösterir");
  console.log("\n⚠️  Bu davranış, parent kategori sayfalarında child kategorilerin ürünlerinin");
  console.log("   de görünmesine neden olur. Bu beklenen bir davranış mı kontrol edilmeli.");

  // ============================================================================
  // (8) HARDCODED SLUG MISMATCH KONTROLÜ
  // ============================================================================
  printSection("(8) HARDCODED SLUG MISMATCH KONTROLÜ");

  const allSlugs = new Set(allCategories.map((c) => c.slug));
  const allHardcodedSlugs = new Set([
    ...HARDCODED_SLUGS.desktopNav,
    ...HARDCODED_SLUGS.footer,
  ]);

  const missingSlugs: string[] = [];
  for (const slug of allHardcodedSlugs) {
    if (!allSlugs.has(slug)) {
      missingSlugs.push(slug);
    }
  }

  if (missingSlugs.length === 0) {
    console.log("\n✓ Tüm hardcoded slug'lar DB'de mevcut.");
  } else {
    console.log(`\n⚠️  ${missingSlugs.length} hardcoded slug DB'de bulunamadı (404/SEO riski):`);
    for (const slug of missingSlugs) {
      const sources: string[] = [];
      if (HARDCODED_SLUGS.desktopNav.includes(slug)) {
        sources.push("DesktopNavigation");
      }
      if (HARDCODED_SLUGS.footer.includes(slug)) {
        sources.push("Footer");
      }
      console.log(`  - "${slug}" (kaynak: ${sources.join(", ")})`);
    }
  }

  // Hardcoded slug kaynakları
  printSubsection("Hardcoded Slug Kaynakları");
  console.log("\nDesktopNavigation.tsx:");
  console.log(`  - Top-level: ${HARDCODED_SLUGS.desktopNav.filter((s) => !allSlugs.has(s)).length} missing`);
  console.log(`  - Toplam: ${HARDCODED_SLUGS.desktopNav.length} slug`);
  console.log("\nFooter.tsx:");
  console.log(`  - Missing: ${HARDCODED_SLUGS.footer.filter((s) => !allSlugs.has(s)).length} missing`);
  console.log(`  - Toplam: ${HARDCODED_SLUGS.footer.length} slug`);

  // ============================================================================
  // ÖZET VE BULGULAR
  // ============================================================================
  printSection("ÖZET VE BULGULAR");

  console.log("\n📊 Rapor Özeti:");
  console.log(`  - Toplam kategori: ${allCategories.length}`);
  console.log(`  - Top-level kategori: ${topLevelCategories.length}`);
  console.log(`  - Child kategori: ${childCategories.length}`);
  console.log(`  - Boş kategori: ${emptyCategories.length}`);
  console.log(`  - Orphan kategori: ${orphanCategories.length}`);
  console.log(`  - Duplicate slug: ${duplicateSlugs.length}`);
  console.log(`  - Hardcoded slug mismatch: ${missingSlugs.length}`);

  const totalDirectProducts = Array.from(directProductsByCategory.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(`  - Top-level'e doğrudan bağlı ürün: ${totalDirectProducts || 0}`);

  console.log("\n🎯 En Kritik 10 Bulgu:");
  const criticalFindings: string[] = [];

  if (totalDirectProducts > 0) {
    criticalFindings.push(
      `⚠️  ${totalDirectProducts} ürün doğrudan top-level kategoriye bağlı (child kategori yerine)`
    );
  }

  if (orphanCategories.length > 0) {
    criticalFindings.push(`⚠️  ${orphanCategories.length} orphan kategori var (parent kaydı yok)`);
  }

  if (duplicateSlugs.length > 0) {
    criticalFindings.push(`⚠️  ${duplicateSlugs.length} duplicate slug var (SEO riski)`);
  }

  if (missingSlugs.length > 0) {
    criticalFindings.push(`⚠️  ${missingSlugs.length} hardcoded slug DB'de yok (404 riski)`);
  }

  if (emptyCategories.length > 0) {
    criticalFindings.push(`⚠️  ${emptyCategories.length} boş kategori var`);
  }

  const highOverlap = overlapResults.filter((r) => r.overlapCount > 10);
  if (highOverlap.length > 0) {
    criticalFindings.push(
      `⚠️  ${highOverlap.length} kategori çiftinde yüksek overlap var (>10 ürün)`
    );
  }

  const multiCategoryProducts = productCategoryStats.filter((p) => p.categoryCount > 3);
  if (multiCategoryProducts.length > 0) {
    criticalFindings.push(
      `ℹ️  ${multiCategoryProducts.length} ürün 3'ten fazla kategoriye bağlı (çoklu kategori)`
    );
  }

  if (criticalFindings.length === 0) {
    console.log("  ✓ Kritik bulgu yok - sistem tutarlı görünüyor.");
  } else {
    for (let i = 0; i < Math.min(10, criticalFindings.length); i++) {
      console.log(`  ${i + 1}. ${criticalFindings[i]}`);
    }
  }

  console.log("\n🔍 Veri mi Problem, Query mi Problem?");
  console.log("  - UI Query: 'includes descendants' davranışı var");
  console.log("  - Bu, parent kategori sayfalarında child ürünlerin görünmesine neden olur");
  console.log("  - Eğer bu beklenen bir davranış değilse, query davranışı değiştirilmeli");
  console.log("  - Eğer beklenen bir davranışsa, veri tutarlılığı kontrol edilmeli");

  console.log("\n💡 V2 Önerileri (Eşleştirme/Migration):");
  console.log("  1. Orphan kategorileri düzelt (parentWcId'leri güncelle veya sil)");
  console.log("  2. Duplicate slug'ları unique hale getir");
  console.log("  3. Hardcoded slug'ları DB'den dinamik çek (veya DB'yi hardcoded'a uyarla)");
  console.log("  4. Top-level kategorilere doğrudan bağlı ürünleri child kategorilere taşı");
  console.log("  5. Yüksek overlap'li kategori çiftlerini gözden geçir (kategori hiyerarşisi)");
  console.log("  6. UI query davranışını gözden geçir (descendants dahil etme mantığı)");

  console.log("\n" + "=".repeat(80));
  console.log("Rapor tamamlandı.");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Hata:", error);
    process.exit(1);
  });

