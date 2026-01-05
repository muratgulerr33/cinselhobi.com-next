import dotenv from "dotenv";
import { db } from "../src/db/connection";
import { categories, products, productCategories } from "../src/db/schema";
import { eq, and, inArray, sql, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

interface CategoryNode {
  id: number;
  wcId: number;
  parentWcId: number | null;
  slug: string;
  name: string;
}

interface DuplicationReport {
  productId: number;
  productName: string;
  parentCategoryId: number;
  parentCategoryName: string;
  parentCategorySlug: string;
  descendantCategoryIds: number[];
}

/**
 * Bir parent kategorinin tüm descendant'larını (child, grandchild, vb.) döndürür
 */
async function getCategoryDescendants(parentId: number, allCategories: CategoryNode[]): Promise<CategoryNode[]> {
  const descendants: CategoryNode[] = [];
  const visited = new Set<number>();

  // Parent kategoriyi bul
  const parent = allCategories.find((c) => c.id === parentId);
  if (!parent) return descendants;

  function traverse(wcId: number) {
    if (visited.has(wcId)) return;
    visited.add(wcId);

    const children = allCategories.filter((c) => c.parentWcId === wcId);
    for (const child of children) {
      descendants.push(child);
      traverse(child.wcId);
    }
  }

  // Parent'ın wcId'sinden başlayarak tüm child'ları bul
  traverse(parent.wcId);
  return descendants;
}

/**
 * Parent+child duplication'ları bulur
 */
async function findDuplications(): Promise<DuplicationReport[]> {
  const reports: DuplicationReport[] = [];

  // Tüm kategorileri çek
  const allCategories = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      parentWcId: categories.parentWcId,
      slug: categories.slug,
      name: categories.name,
    })
    .from(categories);

  // Tüm ürün-kategori ilişkilerini çek
  const allProductCategories = await db
    .select({
      productId: productCategories.productId,
      categoryId: productCategories.categoryId,
      productName: products.name,
      categoryId2: categories.id,
      categoryWcId: categories.wcId,
      categoryParentWcId: categories.parentWcId,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(productCategories)
    .innerJoin(products, eq(productCategories.productId, products.id))
    .innerJoin(categories, eq(productCategories.categoryId, categories.id));

  // Ürün bazında grupla
  const productMap = new Map<number, typeof allProductCategories>();
  for (const pc of allProductCategories) {
    if (!productMap.has(pc.productId)) {
      productMap.set(pc.productId, []);
    }
    productMap.get(pc.productId)!.push(pc);
  }

  // Her ürün için kontrol et
  for (const [productId, categoryLinks] of productMap.entries()) {
    // Bu ürünün bağlı olduğu tüm kategorileri al
    const categoryIds = categoryLinks.map((pc) => pc.categoryId);

    // Her kategori için, parent olup olmadığını ve descendant'larından herhangi birinin bu ürüne bağlı olup olmadığını kontrol et
    for (const link of categoryLinks) {
      const categoryId = link.categoryId;
      const category = allCategories.find((c) => c.id === categoryId);
      
      if (!category) continue;

      // Bu kategorinin descendant'larını bul
      const descendants = await getCategoryDescendants(categoryId, allCategories);
      const descendantIds = descendants.map((d) => d.id);

      // Bu ürün descendant'lardan herhangi birine bağlı mı?
      const hasDescendantLink = categoryLinks.some((pc) =>
        descendantIds.includes(pc.categoryId)
      );

      if (hasDescendantLink) {
        // Bu kategori bir parent ve ürün aynı zamanda descendant'ına da bağlı
        // Duplication raporuna ekle
        const existingReport = reports.find(
          (r) => r.productId === productId && r.parentCategoryId === categoryId
        );

        if (!existingReport) {
          reports.push({
            productId,
            productName: link.productName,
            parentCategoryId: categoryId,
            parentCategoryName: link.categoryName,
            parentCategorySlug: link.categorySlug,
            descendantCategoryIds: categoryLinks
              .filter((pc) => descendantIds.includes(pc.categoryId))
              .map((pc) => pc.categoryId),
          });
        }
      }
    }
  }

  return reports;
}

/**
 * Rapor yazdırır
 */
function printReport(reports: DuplicationReport[], isDryRun: boolean) {
  console.log("\n" + "=".repeat(80));
  console.log(isDryRun ? "DRY-RUN RAPORU" : "UYGULAMA RAPORU");
  console.log("=".repeat(80));
  console.log(`\nToplam bulunan duplication: ${reports.length}\n`);

  if (reports.length === 0) {
    console.log("✅ Duplication bulunamadı. Temizlik gerekmiyor.\n");
    return;
  }

  // Ürün bazında grupla
  const byProduct = new Map<number, DuplicationReport[]>();
  for (const report of reports) {
    if (!byProduct.has(report.productId)) {
      byProduct.set(report.productId, []);
    }
    byProduct.get(report.productId)!.push(report);
  }

  console.log(`Silinecek parent bağlantı sayısı: ${reports.length}`);
  console.log(`Etkilenen ürün sayısı: ${byProduct.size}\n`);

  // İlk 10 örneği göster
  const sampleSize = Math.min(10, reports.length);
  console.log(`İlk ${sampleSize} örnek:\n`);
  for (let i = 0; i < sampleSize; i++) {
    const r = reports[i];
    console.log(
      `  ${i + 1}. Ürün: "${r.productName}" (ID: ${r.productId})`
    );
    console.log(
      `     Parent: "${r.parentCategoryName}" (${r.parentCategorySlug})`
    );
    console.log(
      `     Descendant kategoriler: ${r.descendantCategoryIds.length} adet\n`
    );
  }

  if (reports.length > sampleSize) {
    console.log(`  ... ve ${reports.length - sampleSize} tane daha\n`);
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes("--apply");

  try {
    console.log("Kategori veri tutarlılığı temizleme scripti başlatılıyor...");
    console.log(`Mod: ${isDryRun ? "DRY-RUN (değişiklik yapılmayacak)" : "APPLY (değişiklikler uygulanacak)"}\n`);

    // Duplication'ları bul
    console.log("Parent+child duplication'ları taranıyor...");
    const reports = await findDuplications();

    // Rapor yazdır
    printReport(reports, isDryRun);

    if (reports.length === 0) {
      console.log("✅ İşlem tamamlandı. Temizlik gerekmiyor.\n");
      process.exit(0);
    }

    if (isDryRun) {
      console.log("\n💡 Değişiklikleri uygulamak için: npm run fix:categories -- --apply\n");
      process.exit(0);
    }

    // Apply modunda: Transaction içinde sil
    console.log("\nDeğişiklikler uygulanıyor...");
    let removedCount = 0;

    await db.transaction(async (tx) => {
      for (const report of reports) {
        await tx
          .delete(productCategories)
          .where(
            and(
              eq(productCategories.productId, report.productId),
              eq(productCategories.categoryId, report.parentCategoryId)
            )
          );
        removedCount++;
      }
    });

    console.log(`✅ ${removedCount} parent bağlantısı silindi.\n`);

    // Son durumu kontrol et
    console.log("Son durum kontrol ediliyor...");
    const remainingReports = await findDuplications();
    console.log(`\nKalan duplication sayısı: ${remainingReports.length}`);

    if (remainingReports.length === 0) {
      console.log("✅ Tüm duplication'lar temizlendi!\n");
    } else {
      console.log(`⚠️  Hala ${remainingReports.length} duplication var.\n`);
    }

    // Ek metrikler
    console.log("\nEk Metrikler:");
    console.log("-".repeat(80));

    // Top-level'e doğrudan bağlı ürün sayısı
    const topLevelCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(or(isNull(categories.parentWcId), eq(categories.parentWcId, 0)));

    const topLevelIds = topLevelCategories.map((c) => c.id);
    const directToTopLevel = await db
      .selectDistinct({ productId: productCategories.productId })
      .from(productCategories)
      .where(inArray(productCategories.categoryId, topLevelIds));

    console.log(`Top-level kategoriye doğrudan bağlı ürün sayısı: ${directToTopLevel.length}`);

    // Boş kategoriler
    const allCategories = await db.select({ id: categories.id }).from(categories);
    const categoriesWithProducts = await db
      .selectDistinct({ categoryId: productCategories.categoryId })
      .from(productCategories);

    const categoryIdsWithProducts = new Set(
      categoriesWithProducts.map((c) => c.categoryId)
    );
    const emptyCategories = allCategories.filter(
      (c) => !categoryIdsWithProducts.has(c.id)
    );

    console.log(`Boş kategori sayısı: ${emptyCategories.length}`);

    // Overlap çiftleri (>=10 ürün paylaşan kategori çiftleri)
    const pc1 = alias(productCategories, "pc1");
    const pc2 = alias(productCategories, "pc2");
    const categoryPairs = await db
      .select({
        categoryId1: pc1.categoryId,
        categoryId2: pc2.categoryId,
        count: sql<number>`COUNT(DISTINCT ${pc1.productId})`,
      })
      .from(pc1)
      .innerJoin(
        pc2,
        and(
          eq(pc1.productId, pc2.productId),
          sql`${pc1.categoryId} < ${pc2.categoryId}`
        )
      )
      .groupBy(pc1.categoryId, pc2.categoryId)
      .having(sql`COUNT(DISTINCT ${pc1.productId}) >= 10`);

    console.log(`Yüksek overlap kategori çiftleri (>=10 ürün): ${categoryPairs.length}`);

    if (categoryPairs.length > 0) {
      console.log("\nİlk 5 overlap çifti:");
      for (let i = 0; i < Math.min(5, categoryPairs.length); i++) {
        const pair = categoryPairs[i];
        const cat1 = await db
          .select({ name: categories.name, slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, pair.categoryId1))
          .limit(1);
        const cat2 = await db
          .select({ name: categories.name, slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, pair.categoryId2))
          .limit(1);

        if (cat1[0] && cat2[0]) {
          console.log(
            `  - "${cat1[0].name}" (${cat1[0].slug}) <-> "${cat2[0].name}" (${cat2[0].slug}): ${pair.count} ürün`
          );
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ İşlem tamamlandı!\n");
  } catch (error) {
    console.error("\n❌ HATA:", error);
    process.exit(1);
  }
}

main();

