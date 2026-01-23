import dotenv from "dotenv";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

const OUTPUT_DIR = join(process.cwd(), "exports");

// Tip tanımlamaları
interface Category {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
}

interface Product {
  id: number;
  slug: string;
  name: string;
  status: string;
  stockStatus: string | null;
}

interface TopLevelMode {
  category: Category;
  childrenCount: number;
  directInstock: number;
  overlapInstock: number;
  mode: "hub" | "leaf" | "hybrid";
  consistencyScore: number; // 0-1 arası, 1 = tam tutarlı
}

interface ChildOnlyProduct {
  topLevelId: number;
  topLevelSlug: string;
  topLevelName: string;
  productId: number;
  productSlug: string;
  productName: string;
  childCategoryId: number;
  childCategorySlug: string;
  childCategoryName: string;
  status: string;
  stockStatus: string | null;
}

interface ParentOnlyProduct {
  topLevelId: number;
  topLevelSlug: string;
  topLevelName: string;
  productId: number;
  productSlug: string;
  productName: string;
  status: string;
  stockStatus: string | null;
  childCount: number; // Bu top-level'in child sayısı
}

interface BadParentLink {
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  parentWcId: number | null;
  parentExists: boolean;
  parentId: number | null;
  parentSlug: string | null;
  parentName: string | null;
}

interface DuplicatePivot {
  productId: number;
  productSlug: string;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  duplicateCount: number;
}

interface OrphanProduct {
  productId: number;
  slug: string;
  name: string;
  status: string;
  stockStatus: string | null;
}

interface EmptyCategory {
  categoryId: number;
  slug: string;
  name: string;
  isTopLevel: boolean;
  hasChildren: boolean;
}

interface InstockZeroCategory {
  categoryId: number;
  slug: string;
  name: string;
  totalProducts: number;
  publishProducts: number;
  instockProducts: number;
}

// Ana fonksiyon
async function main() {
  console.log("🔍 CURSOR DEDEKTİF - Kategori Hatalarını Akıl Yürüterek Keşfet\n");
  console.log("⚠️  Bu görev %100 READ-ONLY. DB'ye yazma yok.\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  // DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. Tüm kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      ORDER BY id
    `);
    const categories = categoriesResult.rows;
    console.log(`  ✅ ${categories.length} kategori bulundu\n`);

    // 2. wcId -> Category mapping oluştur
    const categoryByWcId = new Map<number, Category>();
    const categoryById = new Map<number, Category>();
    for (const cat of categories) {
      categoryByWcId.set(cat.wcId, cat);
      categoryById.set(cat.id, cat);
    }

    // 3. Parent-child ağacını kur
    console.log("🌳 Parent-child ağacı kuruluyor...");
    const childrenMap = new Map<number, Category[]>();
    const parentMap = new Map<number, number>(); // categoryId -> parentCategoryId

    for (const cat of categories) {
      if (!childrenMap.has(cat.id)) {
        childrenMap.set(cat.id, []);
      }
    }

    for (const cat of categories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (parent) {
          parentMap.set(cat.id, parent.id);
          childrenMap.get(parent.id)!.push(cat);
        }
      }
    }

    // Top-level kategorileri bul
    const topLevelCategories = categories.filter(cat => cat.parentWcId === null);
    console.log(`  ✅ ${topLevelCategories.length} top-level kategori bulundu\n`);

    // 4. Ürün-kategori ilişkilerini çek
    console.log("📥 Ürün-kategori ilişkileri çekiliyor...");
    const productCategoriesResult = await pool.query<{
      productId: number;
      productSlug: string;
      productName: string;
      categoryId: number;
      status: string;
      stockStatus: string | null;
    }>(`
      SELECT 
        pc.product_id as "productId",
        p.slug as "productSlug",
        p.name as "productName",
        pc.category_id as "categoryId",
        p.status,
        p.stock_status as "stockStatus"
      FROM product_categories pc
      JOIN products p ON p.id = pc.product_id
    `);
    const productCategories = productCategoriesResult.rows;
    console.log(`  ✅ ${productCategories.length} ürün-kategori ilişkisi bulundu\n`);

    // 5. Tüm ürünleri çek
    console.log("📥 Tüm ürünler çekiliyor...");
    const allProductsResult = await pool.query<Product>(`
      SELECT id, slug, name, status, stock_status as "stockStatus"
      FROM products
    `);
    const allProducts = allProductsResult.rows;
    console.log(`  ✅ ${allProducts.length} ürün bulundu\n`);

    // 6. Her kategori için direct instock sayısını hesapla
    console.log("🔢 Direct instock sayıları hesaplanıyor...");
    const directInstockCounts = new Map<number, number>();
    const directInstockProducts = new Map<number, Set<number>>(); // categoryId -> Set<productId>

    for (const pc of productCategories) {
      if (pc.status === "publish" && pc.stockStatus === "instock") {
        if (!directInstockCounts.has(pc.categoryId)) {
          directInstockCounts.set(pc.categoryId, 0);
          directInstockProducts.set(pc.categoryId, new Set());
        }
        directInstockCounts.set(pc.categoryId, directInstockCounts.get(pc.categoryId)! + 1);
        directInstockProducts.get(pc.categoryId)!.add(pc.productId);
      }
    }

    // 7. Top-level kategoriler için hub-mode analizi
    console.log("🔍 Top-level kategoriler için hub-mode analizi yapılıyor...");
    const topLevelModes: TopLevelMode[] = [];

    for (const topLevelCat of topLevelCategories) {
      const children = childrenMap.get(topLevelCat.id) || [];
      const childrenCount = children.length;
      const directInstock = directInstockCounts.get(topLevelCat.id) || 0;

      // Overlap hesapla: hem top-level'e hem child'a bağlı ürünler
      const topLevelProductIds = directInstockProducts.get(topLevelCat.id) || new Set<number>();
      let overlapCount = 0;
      for (const child of children) {
        const childProductIds = directInstockProducts.get(child.id) || new Set<number>();
        for (const productId of topLevelProductIds) {
          if (childProductIds.has(productId)) {
            overlapCount++;
          }
        }
      }

      // Mode belirleme
      let mode: "hub" | "leaf" | "hybrid";
      let consistencyScore: number;

      if (childrenCount === 0) {
        mode = "leaf";
        consistencyScore = 1.0; // Leaf için tutarlılık skoru 1
      } else {
        // Overlap oranı hesapla
        const overlapRatio = directInstock > 0 ? overlapCount / directInstock : 0;
        
        if (overlapRatio >= 0.8) {
          // %80+ overlap = hub-mode
          mode = "hub";
          // Hub-mode için tutarlılık: overlap ne kadar yüksekse o kadar tutarlı
          consistencyScore = Math.min(1.0, overlapRatio);
        } else if (overlapRatio >= 0.3) {
          // %30-80 arası = hybrid-mode
          mode = "hybrid";
          // Hybrid için tutarlılık: overlap oranına göre
          consistencyScore = overlapRatio;
        } else {
          // %30'dan az = leaf-mode (parent'ta ürün var ama child'larda yok)
          mode = "leaf";
          // Leaf için tutarlılık: overlap düşükse düşük
          consistencyScore = overlapRatio;
        }
      }

      topLevelModes.push({
        category: topLevelCat,
        childrenCount,
        directInstock,
        overlapInstock: overlapCount,
        mode,
        consistencyScore,
      });
    }

    console.log(`  ✅ ${topLevelModes.length} top-level kategori analiz edildi\n`);

    // 8. Child'da var ama parent'ta yok ürünleri bul
    console.log("🔍 Child'da var ama parent'ta yok ürünler tespit ediliyor...");
    const childOnlyProducts: ChildOnlyProduct[] = [];

    for (const topLevelCat of topLevelCategories) {
      const children = childrenMap.get(topLevelCat.id) || [];
      if (children.length === 0) continue;

      const topLevelProductIds = directInstockProducts.get(topLevelCat.id) || new Set<number>();

      for (const child of children) {
        const childProductIds = directInstockProducts.get(child.id) || new Set<number>();
        
        for (const productId of childProductIds) {
          // Bu ürün top-level'de yok mu?
          if (!topLevelProductIds.has(productId)) {
            // Ürün bilgilerini bul
            const pc = productCategories.find(
              p => p.productId === productId && p.categoryId === child.id
            );
            if (pc) {
              childOnlyProducts.push({
                topLevelId: topLevelCat.id,
                topLevelSlug: topLevelCat.slug,
                topLevelName: topLevelCat.name,
                productId,
                productSlug: pc.productSlug,
                productName: pc.productName,
                childCategoryId: child.id,
                childCategorySlug: child.slug,
                childCategoryName: child.name,
                status: pc.status,
                stockStatus: pc.stockStatus,
              });
            }
          }
        }
      }
    }

    console.log(`  ✅ ${childOnlyProducts.length} şüpheli ürün bulundu\n`);

    // 9. Parent'ta var ama hiçbir child'da yok ürünleri bul
    console.log("🔍 Parent'ta var ama hiçbir child'da yok ürünler tespit ediliyor...");
    const parentOnlyProducts: ParentOnlyProduct[] = [];

    for (const topLevelCat of topLevelCategories) {
      const children = childrenMap.get(topLevelCat.id) || [];
      const childrenCount = children.length;
      if (childrenCount === 0) continue; // Child yoksa atla

      const topLevelProductIds = directInstockProducts.get(topLevelCat.id) || new Set<number>();
      const allChildProductIds = new Set<number>();
      
      for (const child of children) {
        const childProductIds = directInstockProducts.get(child.id) || new Set<number>();
        for (const productId of childProductIds) {
          allChildProductIds.add(productId);
        }
      }

      for (const productId of topLevelProductIds) {
        // Bu ürün hiçbir child'da yok mu?
        if (!allChildProductIds.has(productId)) {
          const pc = productCategories.find(
            p => p.productId === productId && p.categoryId === topLevelCat.id
          );
          if (pc) {
            parentOnlyProducts.push({
              topLevelId: topLevelCat.id,
              topLevelSlug: topLevelCat.slug,
              topLevelName: topLevelCat.name,
              productId,
              productSlug: pc.productSlug,
              productName: pc.productName,
              status: pc.status,
              stockStatus: pc.stockStatus,
              childCount: childrenCount,
            });
          }
        }
      }
    }

    console.log(`  ✅ ${parentOnlyProducts.length} şüpheli ürün bulundu\n`);

    // 10. Yanlış parent bağlanmış child'ları bul
    console.log("🔍 Yanlış parent bağlanmış child'lar tespit ediliyor...");
    const badParentLinks: BadParentLink[] = [];

    for (const cat of categories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (!parent) {
          // Parent yok
          badParentLinks.push({
            categoryId: cat.id,
            categorySlug: cat.slug,
            categoryName: cat.name,
            parentWcId: cat.parentWcId,
            parentExists: false,
            parentId: null,
            parentSlug: null,
            parentName: null,
          });
        }
      }
    }

    console.log(`  ✅ ${badParentLinks.length} şüpheli kategori bulundu\n`);

    // 11. Duplicate pivot'ları bul
    console.log("🔍 Duplicate pivot'lar tespit ediliyor...");
    const pivotCounts = new Map<string, number>(); // "productId-categoryId" -> count
    const duplicatePivots: DuplicatePivot[] = [];

    for (const pc of productCategories) {
      const key = `${pc.productId}-${pc.categoryId}`;
      pivotCounts.set(key, (pivotCounts.get(key) || 0) + 1);
    }

    for (const [key, count] of pivotCounts.entries()) {
      if (count > 1) {
        const [productIdStr, categoryIdStr] = key.split("-");
        const productId = parseInt(productIdStr);
        const categoryId = parseInt(categoryIdStr);
        
        const category = categoryById.get(categoryId);
        const product = allProducts.find(p => p.id === productId);
        
        if (category && product) {
          duplicatePivots.push({
            productId,
            productSlug: product.slug,
            categoryId,
            categorySlug: category.slug,
            categoryName: category.name,
            duplicateCount: count,
          });
        }
      }
    }

    console.log(`  ✅ ${duplicatePivots.length} duplicate pivot bulundu\n`);

    // 12. Orphan product'ları bul
    console.log("🔍 Orphan product'lar tespit ediliyor...");
    const productsWithCategories = new Set(productCategories.map(pc => pc.productId));
    const orphanProducts: OrphanProduct[] = allProducts
      .filter(p => !productsWithCategories.has(p.id))
      .map(p => ({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        status: p.status,
        stockStatus: p.stockStatus,
      }));

    console.log(`  ✅ ${orphanProducts.length} orphan product bulundu\n`);

    // 13. Empty category'leri bul
    console.log("🔍 Empty category'ler tespit ediliyor...");
    const categoriesWithProducts = new Set(productCategories.map(pc => pc.categoryId));
    const emptyCategories: EmptyCategory[] = categories
      .filter(cat => !categoriesWithProducts.has(cat.id))
      .map(cat => ({
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
        isTopLevel: cat.parentWcId === null,
        hasChildren: (childrenMap.get(cat.id) || []).length > 0,
      }));

    console.log(`  ✅ ${emptyCategories.length} empty category bulundu\n`);

    // 14. Instock=0 ama publish ürün var kategorileri bul
    console.log("🔍 Instock=0 ama publish ürün var kategorileri tespit ediliyor...");
    const categoryProductCounts = new Map<number, {
      total: number;
      publish: number;
      instock: number;
    }>();

    for (const pc of productCategories) {
      if (!categoryProductCounts.has(pc.categoryId)) {
        categoryProductCounts.set(pc.categoryId, { total: 0, publish: 0, instock: 0 });
      }
      const counts = categoryProductCounts.get(pc.categoryId)!;
      counts.total++;
      if (pc.status === "publish") {
        counts.publish++;
        if (pc.stockStatus === "instock") {
          counts.instock++;
        }
      }
    }

    const instockZeroCategories: InstockZeroCategory[] = [];
    for (const [categoryId, counts] of categoryProductCounts.entries()) {
      if (counts.instock === 0 && counts.publish > 0) {
        const category = categoryById.get(categoryId);
        if (category) {
          instockZeroCategories.push({
            categoryId,
            slug: category.slug,
            name: category.name,
            totalProducts: counts.total,
            publishProducts: counts.publish,
            instockProducts: counts.instock,
          });
        }
      }
    }

    console.log(`  ✅ ${instockZeroCategories.length} kategori bulundu\n`);

    // 15. Raporları üret
    console.log("📝 Raporlar oluşturuluyor...");

    // Ana markdown raporu
    const summaryMarkdown = generateSummaryMarkdown(
      topLevelModes,
      childOnlyProducts,
      parentOnlyProducts,
      badParentLinks,
      duplicatePivots,
      orphanProducts,
      emptyCategories,
      instockZeroCategories
    );
    const summaryPath = join(OUTPUT_DIR, "suspect-summary.md");
    await writeFile(summaryPath, summaryMarkdown, "utf-8");
    console.log(`  ✅ Ana rapor: ${summaryPath}`);

    // CSV'ler
    const childOnlyCsv = generateChildOnlyCsv(childOnlyProducts);
    const childOnlyPath = join(OUTPUT_DIR, "suspect-child-only.csv");
    await writeFile(childOnlyPath, childOnlyCsv, "utf-8");
    console.log(`  ✅ Child-only CSV: ${childOnlyPath}`);

    const parentOnlyCsv = generateParentOnlyCsv(parentOnlyProducts);
    const parentOnlyPath = join(OUTPUT_DIR, "suspect-parent-only.csv");
    await writeFile(parentOnlyPath, parentOnlyCsv, "utf-8");
    console.log(`  ✅ Parent-only CSV: ${parentOnlyPath}`);

    const badParentLinksCsv = generateBadParentLinksCsv(badParentLinks);
    const badParentLinksPath = join(OUTPUT_DIR, "suspect-bad-parent-links.csv");
    await writeFile(badParentLinksPath, badParentLinksCsv, "utf-8");
    console.log(`  ✅ Bad parent links CSV: ${badParentLinksPath}`);

    const duplicatePivotsCsv = generateDuplicatePivotsCsv(duplicatePivots);
    const duplicatePivotsPath = join(OUTPUT_DIR, "suspect-dup-pivot.csv");
    await writeFile(duplicatePivotsPath, duplicatePivotsCsv, "utf-8");
    console.log(`  ✅ Duplicate pivots CSV: ${duplicatePivotsPath}`);

    const orphanProductsCsv = generateOrphanProductsCsv(orphanProducts);
    const orphanProductsPath = join(OUTPUT_DIR, "suspect-orphan-products.csv");
    await writeFile(orphanProductsPath, orphanProductsCsv, "utf-8");
    console.log(`  ✅ Orphan products CSV: ${orphanProductsPath}`);

    const emptyCategoriesCsv = generateEmptyCategoriesCsv(emptyCategories);
    const emptyCategoriesPath = join(OUTPUT_DIR, "suspect-empty-categories.csv");
    await writeFile(emptyCategoriesPath, emptyCategoriesCsv, "utf-8");
    console.log(`  ✅ Empty categories CSV: ${emptyCategoriesPath}`);

    // SQL plan ve rollback plan
    const { fixPlan, rollbackPlan } = generateSqlPlans(
      childOnlyProducts,
      parentOnlyProducts,
      badParentLinks,
      duplicatePivots,
      orphanProducts,
      emptyCategories
    );

    const fixPlanPath = join(OUTPUT_DIR, "suspect-fix-plan.sql");
    await writeFile(fixPlanPath, fixPlan, "utf-8");
    console.log(`  ✅ Fix plan SQL: ${fixPlanPath} ⛔`);

    const rollbackPlanPath = join(OUTPUT_DIR, "suspect-fix-rollback.sql");
    await writeFile(rollbackPlanPath, rollbackPlan, "utf-8");
    console.log(`  ✅ Rollback plan SQL: ${rollbackPlanPath} ⛔`);

    console.log("\n✅ Dedektif analizi tamamlandı!\n");

  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Markdown rapor oluştur
function generateSummaryMarkdown(
  topLevelModes: TopLevelMode[],
  childOnlyProducts: ChildOnlyProduct[],
  parentOnlyProducts: ParentOnlyProduct[],
  badParentLinks: BadParentLink[],
  duplicatePivots: DuplicatePivot[],
  orphanProducts: OrphanProduct[],
  emptyCategories: EmptyCategory[],
  instockZeroCategories: InstockZeroCategory[]
): string {
  let report = `# CURSOR DEDEKTİF Raporu — Kategori Hataları Analizi\n\n`;
  report += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  report += `**⚠️ UYARI:** Bu görev %100 READ-ONLY. DB'ye yazma yok.\n\n`;
  report += `---\n\n`;

  // 1. Hub-mode analizi
  report += `## 1. Hub-Mode Analizi\n\n`;
  report += `Top-level kategoriler hub-mode, leaf-mode veya hybrid-mode olarak sınıflandırılmıştır:\n\n`;
  report += `- **Hub-mode**: children_count > 0 ve overlap_instock ≈ direct_instock (oran çok yüksek)\n`;
  report += `- **Hybrid-mode**: children_count > 0 ve overlap oranı %30-80 arası\n`;
  report += `- **Leaf-mode**: children_count = 0 veya overlap oranı < %30\n\n`;

  report += `| Top-Level Kategori | Children | Direct Instock | Overlap | Mode | Tutarlılık Skoru |\n`;
  report += `|---------------------|----------|----------------|---------|------|------------------|\n`;
  for (const mode of topLevelModes.sort((a, b) => a.category.id - b.category.id)) {
    report += `| ${mode.category.name} (${mode.category.slug}) | ${mode.childrenCount} | ${mode.directInstock} | ${mode.overlapInstock} | ${mode.mode} | ${(mode.consistencyScore * 100).toFixed(1)}% |\n`;
  }
  report += `\n`;

  report += `### Hub-Mode Kategorilerde Şüpheli Durumlar\n\n`;
  const hubModes = topLevelModes.filter(m => m.mode === "hub");
  report += `**Hub-mode kategoriler:** ${hubModes.length} adet\n\n`;
  report += `Hub-mode kategorilerde child'da olup parent'ta olmayan ürünler **büyük ihtimal "kaçmış link"** olarak değerlendirilmelidir.\n\n`;

  report += `### Leaf/Hybrid-Mode Kategorilerde Şüpheli Durumlar\n\n`;
  const leafHybridModes = topLevelModes.filter(m => m.mode === "leaf" || m.mode === "hybrid");
  report += `**Leaf/Hybrid-mode kategoriler:** ${leafHybridModes.length} adet\n\n`;
  report += `Leaf/Hybrid-mode kategorilerde parent'ta olup child'da olmayan ürünler her zaman hata değildir; ama **outlier** olanları bulunmuştur.\n\n`;

  report += `---\n\n`;

  // 2. Child-only ürünler
  report += `## 2. Child'da Var Ama Parent'ta Yok Ürünler\n\n`;
  report += `**Toplam:** ${childOnlyProducts.length} ürün\n\n`;
  report += `> **Not:** Hub-mode kategorilerde bu durum **büyük ihtimal "kaçmış link"** olarak değerlendirilmelidir.\n\n`;

  if (childOnlyProducts.length > 0) {
    // Top-level bazlı grupla
    const byTopLevel = new Map<number, ChildOnlyProduct[]>();
    for (const product of childOnlyProducts) {
      if (!byTopLevel.has(product.topLevelId)) {
        byTopLevel.set(product.topLevelId, []);
      }
      byTopLevel.get(product.topLevelId)!.push(product);
    }

    for (const [topLevelId, products] of byTopLevel.entries()) {
      const first = products[0];
      const mode = topLevelModes.find(m => m.category.id === topLevelId);
      report += `### ${first.topLevelName} (${first.topLevelSlug}) - Mode: ${mode?.mode || "unknown"}\n\n`;
      report += `**Sayı:** ${products.length} ürün\n\n`;
      report += `| Product ID | Product Slug | Product Name | Child Category |\n`;
      report += `|------------|--------------|--------------|----------------|\n`;
      for (const p of products.slice(0, 10)) {
        report += `| ${p.productId} | ${p.productSlug} | ${p.productName} | ${p.childCategoryName} (${p.childCategorySlug}) |\n`;
      }
      if (products.length > 10) {
        report += `\n*... ve ${products.length - 10} tane daha (CSV'de tam liste)*\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;

  // 3. Parent-only ürünler
  report += `## 3. Parent'ta Var Ama Hiçbir Child'da Yok Ürünler\n\n`;
  report += `**Toplam:** ${parentOnlyProducts.length} ürün\n\n`;
  report += `> **Not:** Leaf/Hybrid-mode kategorilerde bu durum normal olabilir, ama outlier'lar şüpheli olabilir.\n\n`;

  if (parentOnlyProducts.length > 0) {
    // Top-level bazlı grupla
    const byTopLevel = new Map<number, ParentOnlyProduct[]>();
    for (const product of parentOnlyProducts) {
      if (!byTopLevel.has(product.topLevelId)) {
        byTopLevel.set(product.topLevelId, []);
      }
      byTopLevel.get(product.topLevelId)!.push(product);
    }

    for (const [topLevelId, products] of byTopLevel.entries()) {
      const first = products[0];
      const mode = topLevelModes.find(m => m.category.id === topLevelId);
      report += `### ${first.topLevelName} (${first.topLevelSlug}) - Mode: ${mode?.mode || "unknown"}\n\n`;
      report += `**Sayı:** ${products.length} ürün (Child sayısı: ${first.childCount})\n\n`;
      report += `| Product ID | Product Slug | Product Name |\n`;
      report += `|------------|--------------|--------------|\n`;
      for (const p of products.slice(0, 10)) {
        report += `| ${p.productId} | ${p.productSlug} | ${p.productName} |\n`;
      }
      if (products.length > 10) {
        report += `\n*... ve ${products.length - 10} tane daha (CSV'de tam liste)*\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;

  // 4. Bad parent links
  report += `## 4. Yanlış Parent Bağlanmış Child'lar\n\n`;
  report += `**Toplam:** ${badParentLinks.length} kategori\n\n`;
  if (badParentLinks.length > 0) {
    report += `| Category ID | Category Slug | Category Name | Parent WC ID | Durum |\n`;
    report += `|-------------|---------------|---------------|--------------|-------|\n`;
    for (const link of badParentLinks) {
      report += `| ${link.categoryId} | ${link.categorySlug} | ${link.categoryName} | ${link.parentWcId} | Parent yok |\n`;
    }
  }

  report += `\n---\n\n`;

  // 5. Duplicate pivots
  report += `## 5. Duplicate Pivot'lar\n\n`;
  report += `**Toplam:** ${duplicatePivots.length} duplicate pivot\n\n`;
  report += `> **Not:** Aynı ürün-kategori ilişkisi 2+ kez kaydedilmiş. Bu durum veritabanı hatasıdır.\n\n`;
  if (duplicatePivots.length > 0) {
    report += `| Product ID | Product Slug | Category | Duplicate Count |\n`;
    report += `|------------|--------------|---------|-----------------|\n`;
    for (const dp of duplicatePivots.slice(0, 20)) {
      report += `| ${dp.productId} | ${dp.productSlug} | ${dp.categoryName} (${dp.categorySlug}) | ${dp.duplicateCount} |\n`;
    }
    if (duplicatePivots.length > 20) {
      report += `\n*... ve ${duplicatePivots.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }

  report += `\n---\n\n`;

  // 6. Orphan products
  report += `## 6. Orphan Product'lar (Kategorisiz Ürünler)\n\n`;
  report += `**Toplam:** ${orphanProducts.length} ürün\n\n`;
  if (orphanProducts.length > 0) {
    report += `| Product ID | Slug | Name | Status | Stock Status |\n`;
    report += `|------------|------|------|--------|--------------|\n`;
    for (const op of orphanProducts.slice(0, 20)) {
      report += `| ${op.productId} | ${op.slug} | ${op.name} | ${op.status} | ${op.stockStatus || "null"} |\n`;
    }
    if (orphanProducts.length > 20) {
      report += `\n*... ve ${orphanProducts.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }

  report += `\n---\n\n`;

  // 7. Empty categories
  report += `## 7. Empty Category'ler (Ürünsüz Kategoriler)\n\n`;
  report += `**Toplam:** ${emptyCategories.length} kategori\n\n`;
  if (emptyCategories.length > 0) {
    report += `| Category ID | Slug | Name | Top-Level | Has Children |\n`;
    report += `|------------|------|------|-----------|--------------|\n`;
    for (const ec of emptyCategories) {
      report += `| ${ec.categoryId} | ${ec.slug} | ${ec.name} | ${ec.isTopLevel ? "✓" : ""} | ${ec.hasChildren ? "✓" : ""} |\n`;
    }
  }

  report += `\n---\n\n`;

  // 8. Instock=0 ama publish ürün var
  report += `## 8. Instock=0 Ama Publish Ürün Var Kategoriler\n\n`;
  report += `**Toplam:** ${instockZeroCategories.length} kategori\n\n`;
  report += `> **Not:** UI davranışı için önemli. Bu kategorilerde kategori sayfasında "0 ürün" davranışı netleştirilmelidir.\n\n`;
  if (instockZeroCategories.length > 0) {
    report += `| Category ID | Slug | Name | Total Products | Publish Products | Instock Products |\n`;
    report += `|------------|------|------|----------------|------------------|-----------------|\n`;
    for (const iz of instockZeroCategories) {
      report += `| ${iz.categoryId} | ${iz.slug} | ${iz.name} | ${iz.totalProducts} | ${iz.publishProducts} | ${iz.instockProducts} |\n`;
    }
  }

  report += `\n---\n\n`;

  // 9. Özet
  report += `## 9. Özet\n\n`;
  report += `| Hata Türü | Sayı | Durum |\n`;
  report += `|-----------|------|-------|\n`;
  report += `| Child-only ürünler | ${childOnlyProducts.length} | ${childOnlyProducts.length > 0 ? "⚠️ Şüpheli" : "✅ Temiz"} |\n`;
  report += `| Parent-only ürünler | ${parentOnlyProducts.length} | ${parentOnlyProducts.length > 0 ? "⚠️ Şüpheli" : "✅ Temiz"} |\n`;
  report += `| Bad parent links | ${badParentLinks.length} | ${badParentLinks.length > 0 ? "❌ Hata" : "✅ Temiz"} |\n`;
  report += `| Duplicate pivots | ${duplicatePivots.length} | ${duplicatePivots.length > 0 ? "❌ Hata" : "✅ Temiz"} |\n`;
  report += `| Orphan products | ${orphanProducts.length} | ${orphanProducts.length > 0 ? "❌ Hata" : "✅ Temiz"} |\n`;
  report += `| Empty categories | ${emptyCategories.length} | ${emptyCategories.length > 0 ? "⚠️ Şüpheli" : "✅ Temiz"} |\n`;
  report += `| Instock=0 kategoriler | ${instockZeroCategories.length} | ${instockZeroCategories.length > 0 ? "⚠️ UI için önemli" : "✅ Temiz"} |\n`;

  report += `\n---\n\n`;

  report += `## 10. SQL Fix Plan ve Rollback Plan\n\n`;
  report += `⛔ **UYARI:** SQL plan ve rollback plan dosyaları oluşturulmuştur ama **SADECE ÖNERİ** amaçlıdır.\n\n`;
  report += `- \`suspect-fix-plan.sql\` - Fix önerileri (Murat onayı gerekli)\n`;
  report += `- \`suspect-fix-rollback.sql\` - Rollback planı\n\n`;
  report += `**DB'ye yazma yapılmadan önce mutlaka backup alınmalı ve planlar gözden geçirilmelidir.**\n\n`;

  return report;
}

// CSV fonksiyonları
function generateChildOnlyCsv(products: ChildOnlyProduct[]): string {
  const header = "Top_Level_ID,Top_Level_Slug,Top_Level_Name,Product_ID,Product_Slug,Product_Name,Child_Category_ID,Child_Category_Slug,Child_Category_Name,Status,Stock_Status\n";
  const rows = products.map(p => {
    return [
      p.topLevelId,
      `"${p.topLevelSlug}"`,
      `"${p.topLevelName}"`,
      p.productId,
      `"${p.productSlug}"`,
      `"${p.productName}"`,
      p.childCategoryId,
      `"${p.childCategorySlug}"`,
      `"${p.childCategoryName}"`,
      p.status,
      p.stockStatus || "",
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateParentOnlyCsv(products: ParentOnlyProduct[]): string {
  const header = "Top_Level_ID,Top_Level_Slug,Top_Level_Name,Product_ID,Product_Slug,Product_Name,Status,Stock_Status,Child_Count\n";
  const rows = products.map(p => {
    return [
      p.topLevelId,
      `"${p.topLevelSlug}"`,
      `"${p.topLevelName}"`,
      p.productId,
      `"${p.productSlug}"`,
      `"${p.productName}"`,
      p.status,
      p.stockStatus || "",
      p.childCount,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateBadParentLinksCsv(links: BadParentLink[]): string {
  const header = "Category_ID,Category_Slug,Category_Name,Parent_WC_ID,Parent_Exists\n";
  const rows = links.map(l => {
    return [
      l.categoryId,
      `"${l.categorySlug}"`,
      `"${l.categoryName}"`,
      l.parentWcId || "",
      l.parentExists ? "1" : "0",
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateDuplicatePivotsCsv(pivots: DuplicatePivot[]): string {
  const header = "Product_ID,Product_Slug,Category_ID,Category_Slug,Category_Name,Duplicate_Count\n";
  const rows = pivots.map(dp => {
    return [
      dp.productId,
      `"${dp.productSlug}"`,
      dp.categoryId,
      `"${dp.categorySlug}"`,
      `"${dp.categoryName}"`,
      dp.duplicateCount,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateOrphanProductsCsv(products: OrphanProduct[]): string {
  const header = "Product_ID,Slug,Name,Status,Stock_Status\n";
  const rows = products.map(p => {
    return [
      p.productId,
      `"${p.slug}"`,
      `"${p.name}"`,
      p.status,
      p.stockStatus || "",
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateEmptyCategoriesCsv(categories: EmptyCategory[]): string {
  const header = "Category_ID,Slug,Name,Is_Top_Level,Has_Children\n";
  const rows = categories.map(c => {
    return [
      c.categoryId,
      `"${c.slug}"`,
      `"${c.name}"`,
      c.isTopLevel ? "1" : "0",
      c.hasChildren ? "1" : "0",
    ].join(",");
  });
  return header + rows.join("\n");
}

// SQL plan fonksiyonları
function generateSqlPlans(
  childOnlyProducts: ChildOnlyProduct[],
  parentOnlyProducts: ParentOnlyProduct[],
  badParentLinks: BadParentLink[],
  duplicatePivots: DuplicatePivot[],
  orphanProducts: OrphanProduct[],
  emptyCategories: EmptyCategory[]
): { fixPlan: string; rollbackPlan: string } {
  let fixPlan = `-- ⛔ UYARI: Bu SQL plan SADECE ÖNERİ amaçlıdır. Murat onayı gerekir.\n`;
  fixPlan += `-- DB'ye yazma yapılmadan önce mutlaka backup alınmalıdır.\n\n`;
  fixPlan += `-- BEGIN TRANSACTION;\n\n`;

  let rollbackPlan = `-- Rollback plan - Fix plan'ı geri almak için\n\n`;
  rollbackPlan += `-- BEGIN TRANSACTION;\n\n`;

  // 1. Child-only ürünler için parent'a link ekleme önerisi
  if (childOnlyProducts.length > 0) {
    fixPlan += `-- 1. Child-only ürünler için parent'a link ekleme önerisi\n`;
    fixPlan += `-- Toplam: ${childOnlyProducts.length} ürün\n\n`;
    fixPlan += `-- NOT: Bu işlem hub-mode kategorilerde önerilir.\n`;
    fixPlan += `-- Leaf/Hybrid-mode kategorilerde dikkatli olunmalıdır.\n\n`;

    // Top-level bazlı grupla
    const byTopLevel = new Map<number, ChildOnlyProduct[]>();
    for (const product of childOnlyProducts) {
      if (!byTopLevel.has(product.topLevelId)) {
        byTopLevel.set(product.topLevelId, []);
      }
      byTopLevel.get(product.topLevelId)!.push(product);
    }

    for (const [topLevelId, products] of byTopLevel.entries()) {
      const first = products[0];
      fixPlan += `-- Top-Level: ${first.topLevelName} (${first.topLevelSlug}) - ${products.length} ürün\n`;
      for (const p of products) {
        fixPlan += `-- INSERT INTO product_categories (product_id, category_id) VALUES (${p.productId}, ${p.topLevelId}); -- ${p.productSlug}\n`;
      }
      fixPlan += `\n`;
    }

    rollbackPlan += `-- 1. Child-only ürünler için parent linklerini geri alma\n`;
    for (const p of childOnlyProducts) {
      rollbackPlan += `-- DELETE FROM product_categories WHERE product_id = ${p.productId} AND category_id = ${p.topLevelId};\n`;
    }
    rollbackPlan += `\n`;
  }

  // 2. Bad parent links için düzeltme
  if (badParentLinks.length > 0) {
    fixPlan += `-- 2. Bad parent links için düzeltme\n`;
    fixPlan += `-- Toplam: ${badParentLinks.length} kategori\n\n`;
    fixPlan += `-- NOT: Bu kategorilerin parent_wc_id değerleri NULL yapılmalı veya doğru parent bulunmalıdır.\n\n`;
    for (const link of badParentLinks) {
      fixPlan += `-- UPDATE categories SET parent_wc_id = NULL WHERE id = ${link.categoryId}; -- ${link.categorySlug} (parent_wc_id: ${link.parentWcId} mevcut değil)\n`;
    }
    fixPlan += `\n`;

    rollbackPlan += `-- 2. Bad parent links için geri alma\n`;
    for (const link of badParentLinks) {
      rollbackPlan += `-- UPDATE categories SET parent_wc_id = ${link.parentWcId} WHERE id = ${link.categoryId}; -- ${link.categorySlug}\n`;
    }
    rollbackPlan += `\n`;
  }

  // 3. Duplicate pivots için temizleme
  if (duplicatePivots.length > 0) {
    fixPlan += `-- 3. Duplicate pivots için temizleme\n`;
    fixPlan += `-- Toplam: ${duplicatePivots.length} duplicate pivot\n\n`;
    fixPlan += `-- NOT: Bu durum veritabanı hatasıdır. Duplicate kayıtlar temizlenmelidir.\n`;
    fixPlan += `-- Ancak bu işlem için önce duplicate kayıtların tam listesi çıkarılmalıdır.\n\n`;
    fixPlan += `-- Örnek: Aynı product_id ve category_id için birden fazla kayıt varsa, sadece birini tut\n`;
    fixPlan += `-- DELETE FROM product_categories WHERE ctid NOT IN (\n`;
    fixPlan += `--   SELECT MIN(ctid) FROM product_categories GROUP BY product_id, category_id\n`;
    fixPlan += `-- );\n\n`;

    rollbackPlan += `-- 3. Duplicate pivots için geri alma\n`;
    rollbackPlan += `-- NOT: Bu işlem geri alınamaz. Backup'tan restore edilmelidir.\n\n`;
  }

  // 4. Orphan products için kategori atama önerisi
  if (orphanProducts.length > 0) {
    fixPlan += `-- 4. Orphan products için kategori atama önerisi\n`;
    fixPlan += `-- Toplam: ${orphanProducts.length} ürün\n\n`;
    fixPlan += `-- NOT: Bu ürünlere manuel olarak uygun kategori atanmalıdır.\n`;
    fixPlan += `-- Otomatik atama yapılamaz.\n\n`;
    for (const p of orphanProducts) {
      fixPlan += `-- INSERT INTO product_categories (product_id, category_id) VALUES (${p.productId}, ?); -- ${p.slug} - KATEGORI_ID_BURAYA\n`;
    }
    fixPlan += `\n`;

    rollbackPlan += `-- 4. Orphan products için kategori atamalarını geri alma\n`;
    for (const p of orphanProducts) {
      rollbackPlan += `-- DELETE FROM product_categories WHERE product_id = ${p.productId};\n`;
    }
    rollbackPlan += `\n`;
  }

  // 5. Empty categories için not
  if (emptyCategories.length > 0) {
    fixPlan += `-- 5. Empty categories\n`;
    fixPlan += `-- Toplam: ${emptyCategories.length} kategori\n\n`;
    fixPlan += `-- NOT: Empty category'ler DB'den silinmemelidir.\n`;
    fixPlan += `-- UI'da gizlenmelidir (DB değişikliği gerekmez).\n\n`;
  }

  fixPlan += `-- COMMIT;\n`;
  rollbackPlan += `-- COMMIT;\n`;

  return { fixPlan, rollbackPlan };
}

// Script'i çalıştır
main().catch(console.error);
