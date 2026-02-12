import dotenv from "dotenv";
import { writeFile, mkdir, readFile } from "fs/promises";
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
const BASELINE_PATH = join(process.cwd(), "locks", "category-lock-baseline.json");

// Tip tanımlamaları
interface Category {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
  description: string | null;
  imageUrl: string | null;
}

interface CategoryStats {
  category: Category;
  directTotal: number;
  directPublish: number;
  directInstock: number;
  depth: number;
  isTopLevel: boolean;
  childrenIds: number[];
}

interface TopLevelRollup {
  category: Category;
  directInstock: number;
  descInstock: number;
  overlapInstock: number;
  rolledUpUniqueInstock: number;
}

interface ChaosReport {
  doubleLinks: Array<{
    productId: number;
    productSlug: string;
    parentCategoryId: number;
    parentCategoryName: string;
    childCategoryId: number;
    childCategoryName: string;
  }>;
  multiLeaf: Array<{
    productId: number;
    productSlug: string;
    productName: string;
    leafCategoryIds: number[];
    leafCategoryNames: string[];
  }>;
  multiTopLevel: Array<{
    productId: number;
    productSlug: string;
    productName: string;
    topLevelCategoryIds: number[];
    topLevelCategoryNames: string[];
  }>;
  orphanProducts: Array<{
    productId: number;
    slug: string;
    name: string;
    status: string;
    stockStatus: string | null;
  }>;
  emptyCategories: Array<{
    categoryId: number;
    slug: string;
    name: string;
  }>;
  instockZeroButHasProducts: Array<{
    categoryId: number;
    slug: string;
    name: string;
    totalProducts: number;
    publishProducts: number;
    instockProducts: number;
  }>;
}

interface BaselineCheck {
  publishInstock: number;
  publishOutofstock: number;
  publishTotal: number;
  expectedInstock: number;
  expectedOutofstock: number;
  expectedTotal: number;
  pass: boolean;
}

interface SchemaValidation {
  categories: { columns: string[] };
  products: { columns: string[] };
  productCategories: { columns: string[] };
  valid: boolean;
}

interface BaselineData {
  version: string;
  createdAt: string;
  description: string;
  baseline: {
    products: {
      publishInstock: number;
      publishOutofstock: number;
      publishTotal: number;
    };
    categories: {
      total: number;
      topLevel: number;
      child: number;
      maxDepth: number;
    };
    healthChecks: {
      orphanProducts: number;
      multiTopLevel: number;
    };
  };
}

interface AssertResults {
  baselineProducts: boolean;
  baselineCategories: boolean;
  orphanProducts: boolean;
  multiTopLevel: boolean;
  allPass: boolean;
  errors: string[];
}

// Baseline dosyasını oku
async function loadBaseline(): Promise<BaselineData | null> {
  if (!existsSync(BASELINE_PATH)) {
    console.warn(`⚠️  Baseline dosyası bulunamadı: ${BASELINE_PATH}`);
    console.warn("   Hardcoded baseline değerleri kullanılacak.\n");
    return null;
  }

  try {
    const content = await readFile(BASELINE_PATH, "utf-8");
    const baseline = JSON.parse(content) as BaselineData;
    console.log(`✅ Baseline dosyası yüklendi: ${baseline.version} (${baseline.createdAt})\n`);
    return baseline;
  } catch (error) {
    console.error(`❌ Baseline dosyası okunamadı: ${error}`);
    console.warn("   Hardcoded baseline değerleri kullanılacak.\n");
    return null;
  }
}

// Assert kontrolleri
function runAsserts(
  baseline: BaselineData | null,
  baselineCheck: BaselineCheck,
  categories: Category[],
  topLevelCount: number,
  maxDepth: number,
  chaosReport: ChaosReport
): AssertResults {
  const errors: string[] = [];
  let baselineProducts = true;
  let baselineCategories = true;
  let orphanProducts = true;
  let multiTopLevel = true;

  if (baseline) {
    // Ürün baseline kontrolü
    if (
      baselineCheck.publishInstock !== baseline.baseline.products.publishInstock ||
      baselineCheck.publishOutofstock !== baseline.baseline.products.publishOutofstock ||
      baselineCheck.publishTotal !== baseline.baseline.products.publishTotal
    ) {
      baselineProducts = false;
      errors.push(
        `Ürün baseline uyuşmuyor: ` +
        `Instock ${baselineCheck.publishInstock} (beklenen: ${baseline.baseline.products.publishInstock}), ` +
        `Outofstock ${baselineCheck.publishOutofstock} (beklenen: ${baseline.baseline.products.publishOutofstock}), ` +
        `Total ${baselineCheck.publishTotal} (beklenen: ${baseline.baseline.products.publishTotal})`
      );
    }

    // Kategori baseline kontrolü
    const childCount = categories.length - topLevelCount;
    if (
      categories.length !== baseline.baseline.categories.total ||
      topLevelCount !== baseline.baseline.categories.topLevel ||
      childCount !== baseline.baseline.categories.child ||
      maxDepth !== baseline.baseline.categories.maxDepth
    ) {
      baselineCategories = false;
      errors.push(
        `Kategori baseline uyuşmuyor: ` +
        `Total ${categories.length} (beklenen: ${baseline.baseline.categories.total}), ` +
        `Top-Level ${topLevelCount} (beklenen: ${baseline.baseline.categories.topLevel}), ` +
        `Child ${childCount} (beklenen: ${baseline.baseline.categories.child}), ` +
        `Max Depth ${maxDepth} (beklenen: ${baseline.baseline.categories.maxDepth})`
      );
    }

    // Orphan products kontrolü
    if (chaosReport.orphanProducts.length !== baseline.baseline.healthChecks.orphanProducts) {
      orphanProducts = false;
      errors.push(
        `Orphan products: ${chaosReport.orphanProducts.length} (beklenen: ${baseline.baseline.healthChecks.orphanProducts})`
      );
    }

    // Multi-top-level kontrolü
    if (chaosReport.multiTopLevel.length !== baseline.baseline.healthChecks.multiTopLevel) {
      multiTopLevel = false;
      errors.push(
        `Multi-top-level: ${chaosReport.multiTopLevel.length} (beklenen: ${baseline.baseline.healthChecks.multiTopLevel})`
      );
    }
  } else {
    // Baseline yoksa hardcoded değerlerle kontrol
    if (chaosReport.orphanProducts.length !== 0) {
      orphanProducts = false;
      errors.push(`Orphan products: ${chaosReport.orphanProducts.length} (beklenen: 0)`);
    }

    if (chaosReport.multiTopLevel.length !== 0) {
      multiTopLevel = false;
      errors.push(`Multi-top-level: ${chaosReport.multiTopLevel.length} (beklenen: 0)`);
    }
  }

  const allPass = baselineProducts && baselineCategories && orphanProducts && multiTopLevel;

  return {
    baselineProducts,
    baselineCategories,
    orphanProducts,
    multiTopLevel,
    allPass,
    errors,
  };
}

// Ana fonksiyon
async function main() {
  console.log("🚀 Kategori Ağacı + Ürün Sayımları Analizi başlatılıyor...\n");

  // Baseline dosyasını yükle
  const baseline = await loadBaseline();

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
    // Step 0: READ-ONLY şema doğrulama
    console.log("🔍 Step 0: Şema doğrulama yapılıyor...");
    const schemaValidation = await validateSchema(pool);
    if (!schemaValidation.valid) {
      console.error("❌ Şema doğrulama başarısız!");
      console.error("Beklenen kolonlar:");
      console.error("categories: id, wc_id, parent_wc_id, slug, name");
      console.error("products: id, slug, status, stock_status");
      console.error("product_categories: product_id, category_id");
      process.exit(1);
    }
    console.log("  ✅ Şema doğrulandı:");
    console.log(`    - categories: ${schemaValidation.categories.columns.join(", ")}`);
    console.log(`    - products: ${schemaValidation.products.columns.join(", ")}`);
    console.log(`    - product_categories: ${schemaValidation.productCategories.columns.join(", ")}\n`);

    // Step 1: Sağlık kontrol - publish/stock baseline check
    console.log("🔍 Step 1: Publish/Stock baseline kontrolü yapılıyor...");
    const baselineCheck = await checkBaseline(pool, baseline);
    console.log(`  📊 Publish + Instock: ${baselineCheck.publishInstock} (hedef: ${baselineCheck.expectedInstock})`);
    console.log(`  📊 Publish + Outofstock: ${baselineCheck.publishOutofstock} (hedef: ${baselineCheck.expectedOutofstock})`);
    console.log(`  📊 Publish Total: ${baselineCheck.publishTotal} (hedef: ${baselineCheck.expectedTotal})`);
    if (baselineCheck.pass) {
      console.log("  ✅ Baseline kontrolü PASS\n");
    } else {
      console.log("  ⚠️  Baseline kontrolü FAIL (sayılar hedefle uyuşmuyor)\n");
    }

    // 1. Tüm kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId", description, image_url as "imageUrl"
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

    // 3. Ürün-kategori ilişkilerini çek (status ve stock_status dahil)
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

    // 4. Tüm ürünleri çek (orphan tespiti için)
    console.log("📥 Tüm ürünler çekiliyor...");
    const allProductsResult = await pool.query<{
      id: number;
      slug: string;
      name: string;
      status: string;
      stockStatus: string | null;
    }>(`
      SELECT id, slug, name, status, stock_status as "stockStatus"
      FROM products
    `);
    const allProducts = allProductsResult.rows;
    console.log(`  ✅ ${allProducts.length} ürün bulundu\n`);

    // 5. Parent-child ağacını kur
    console.log("🌳 Parent-child ağacı kuruluyor...");
    const childrenMap = new Map<number, Category[]>();
    const parentMap = new Map<number, number>(); // categoryId -> parentCategoryId

    // Children mapping - önce tüm kategoriler için entry oluştur
    for (const cat of categories) {
      if (!childrenMap.has(cat.id)) {
        childrenMap.set(cat.id, []);
      }
    }

    // Sonra parent-child ilişkilerini kur
    for (const cat of categories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (parent) {
          parentMap.set(cat.id, parent.id);
          childrenMap.get(parent.id)!.push(cat);
        }
      }
    }

    // 6. Depth hesapla ve top-level tespiti
    console.log("📏 Depth hesaplanıyor ve top-level kategoriler tespit ediliyor...");
    const depthMap = new Map<number, number>();
    const topLevelCategories: Category[] = [];

    function calculateDepth(catId: number, visited: Set<number>): number {
      if (visited.has(catId)) {
        return depthMap.get(catId) || 0;
      }
      visited.add(catId);

      const parentId = parentMap.get(catId);
      if (parentId === undefined) {
        depthMap.set(catId, 0);
        topLevelCategories.push(categoryById.get(catId)!);
        return 0;
      }

      const parentDepth = calculateDepth(parentId, visited);
      const depth = parentDepth + 1;
      depthMap.set(catId, depth);
      return depth;
    }

    const depthVisited = new Set<number>();
    for (const cat of categories) {
      if (!depthMap.has(cat.id)) {
        calculateDepth(cat.id, depthVisited);
      }
    }

    const maxDepth = Math.max(...Array.from(depthMap.values()), 0);
    console.log(`  ✅ Top-level kategori sayısı: ${topLevelCategories.length}`);
    console.log(`  ✅ Max depth: ${maxDepth}\n`);

    // 7. Her kategori için direct ürün sayımlarını hesapla
    console.log("🔢 Direct ürün sayıları hesaplanıyor...");
    const directProductCounts = new Map<number, {
      total: number;
      publish: number;
      instock: number;
    }>();

    for (const pc of productCategories) {
      const catId = pc.categoryId;
      if (!directProductCounts.has(catId)) {
        directProductCounts.set(catId, { total: 0, publish: 0, instock: 0 });
      }
      const counts = directProductCounts.get(catId)!;
      counts.total++;
      if (pc.status === "publish") {
        counts.publish++;
        if (pc.stockStatus === "instock") {
          counts.instock++;
        }
      }
    }

    // 8. CategoryStats oluştur
    const categoryStats: CategoryStats[] = categories.map(cat => {
      const counts = directProductCounts.get(cat.id) || { total: 0, publish: 0, instock: 0 };
      const children = childrenMap.get(cat.id) || [];
      return {
        category: cat,
        directTotal: counts.total,
        directPublish: counts.publish,
        directInstock: counts.instock,
        depth: depthMap.get(cat.id) || 0,
        isTopLevel: !parentMap.has(cat.id),
        childrenIds: children.map(c => c.id),
      };
    });

    // 9. Top-level kategoriler için rollup hesapları
    console.log("📊 Top-level kategoriler için rollup hesapları yapılıyor...");
    const rollups: TopLevelRollup[] = [];

    for (const topLevelCat of topLevelCategories) {
      // Direct instock (top-level'e direkt bağlı)
      const directInstock = directProductCounts.get(topLevelCat.id)?.instock || 0;

      // Descendant kategorilerdeki instock ürünler
      const descendantCategories: number[] = [];
      function collectDescendants(catId: number) {
        const children = childrenMap.get(catId) || [];
        for (const child of children) {
          descendantCategories.push(child.id);
          collectDescendants(child.id);
        }
      }
      collectDescendants(topLevelCat.id);

      // Descendant'lardaki instock ürünler
      const descInstockProducts = new Set<number>();
      for (const descCatId of descendantCategories) {
        const descCounts = directProductCounts.get(descCatId);
        if (descCounts) {
          // Bu kategorideki instock ürünleri bul
          for (const pc of productCategories) {
            if (pc.categoryId === descCatId && 
                pc.status === "publish" && 
                pc.stockStatus === "instock") {
              descInstockProducts.add(pc.productId);
            }
          }
        }
      }

      const descInstock = descInstockProducts.size;

      // Overlap: Aynı ürün hem top-level'e hem descendant'a bağlı
      const directInstockProducts = new Set<number>();
      for (const pc of productCategories) {
        if (pc.categoryId === topLevelCat.id && 
            pc.status === "publish" && 
            pc.stockStatus === "instock") {
          directInstockProducts.add(pc.productId);
        }
      }

      const overlapInstock = Array.from(directInstockProducts).filter(
        productId => descInstockProducts.has(productId)
      ).length;

      // Rolled up unique instock
      const rolledUpUniqueInstock = directInstock + descInstock - overlapInstock;

      rollups.push({
        category: topLevelCat,
        directInstock,
        descInstock,
        overlapInstock,
        rolledUpUniqueInstock,
      });
    }

    console.log(`  ✅ ${rollups.length} top-level kategori için rollup hesaplandı\n`);

    // 10. Karmaşa tespiti
    console.log("🔍 Karmaşa kaynakları tespit ediliyor...");

    // Leaf kategorileri belirle: depth=1 child kategoriler + children_count=0 top-level kategoriler
    const leafCategories = new Set<number>();
    for (const cat of categories) {
      const isChild = parentMap.has(cat.id);
      const hasChildren = (childrenMap.get(cat.id) || []).length === 0;
      if ((isChild && depthMap.get(cat.id) === 1) || (!isChild && hasChildren)) {
        leafCategories.add(cat.id);
      }
    }

    // Ürün -> kategori mapping oluştur
    const productToCategories = new Map<number, Set<number>>();
    for (const pc of productCategories) {
      if (!productToCategories.has(pc.productId)) {
        productToCategories.set(pc.productId, new Set());
      }
      productToCategories.get(pc.productId)!.add(pc.categoryId);
    }

    // Double-link tespiti: Aynı ürün hem parent'a hem child'a bağlı
    const doubleLinks: ChaosReport["doubleLinks"] = [];
    for (const pc of productCategories) {
      const category = categoryById.get(pc.categoryId);
      if (!category) continue;

      const parentId = parentMap.get(pc.categoryId);
      if (parentId !== undefined) {
        // Bu ürün parent'a da bağlı mı?
        const isInParent = productCategories.some(
          pc2 => pc2.productId === pc.productId && pc2.categoryId === parentId
        );
        if (isInParent) {
          const parent = categoryById.get(parentId)!;
          doubleLinks.push({
            productId: pc.productId,
            productSlug: pc.productSlug,
            parentCategoryId: parentId,
            parentCategoryName: parent.name,
            childCategoryId: pc.categoryId,
            childCategoryName: category.name,
          });
        }
      }
    }

    // Multi-leaf tespiti: Ürün 2+ leaf kategoride
    const multiLeaf: ChaosReport["multiLeaf"] = [];
    for (const [productId, categoryIds] of productToCategories.entries()) {
      const leafCategoryIds = Array.from(categoryIds).filter(catId => leafCategories.has(catId));
      if (leafCategoryIds.length >= 2) {
        const product = allProducts.find(p => p.id === productId);
        if (product) {
          multiLeaf.push({
            productId,
            productSlug: product.slug,
            productName: product.name,
            leafCategoryIds,
            leafCategoryNames: leafCategoryIds.map(id => categoryById.get(id)!.name),
          });
        }
      }
    }

    // Multi-top-level tespiti: Ürün 2+ top-level kategoride
    const topLevelCategoryIds = new Set(topLevelCategories.map(c => c.id));
    const multiTopLevel: ChaosReport["multiTopLevel"] = [];
    for (const [productId, categoryIds] of productToCategories.entries()) {
      const topLevelIds = Array.from(categoryIds).filter(catId => topLevelCategoryIds.has(catId));
      if (topLevelIds.length >= 2) {
        const product = allProducts.find(p => p.id === productId);
        if (product) {
          multiTopLevel.push({
            productId,
            productSlug: product.slug,
            productName: product.name,
            topLevelCategoryIds: topLevelIds,
            topLevelCategoryNames: topLevelIds.map(id => categoryById.get(id)!.name),
          });
        }
      }
    }

    // Orphan products: Kategorisiz ürünler
    const productsWithCategories = new Set(productCategories.map(pc => pc.productId));
    const orphanProducts: ChaosReport["orphanProducts"] = allProducts
      .filter(p => !productsWithCategories.has(p.id))
      .map(p => ({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        status: p.status,
        stockStatus: p.stockStatus,
      }));

    // Empty categories: Ürünsüz kategoriler
    const categoriesWithProducts = new Set(productCategories.map(pc => pc.categoryId));
    const emptyCategories: ChaosReport["emptyCategories"] = categories
      .filter(cat => !categoriesWithProducts.has(cat.id))
      .map(cat => ({
        categoryId: cat.id,
        slug: cat.slug,
        name: cat.name,
      }));

    // Instock=0 olan ama ürün olan kategoriler
    const instockZeroButHasProducts: ChaosReport["instockZeroButHasProducts"] = categoryStats
      .filter(stat => stat.directInstock === 0 && stat.directTotal > 0)
      .map(stat => ({
        categoryId: stat.category.id,
        slug: stat.category.slug,
        name: stat.category.name,
        totalProducts: stat.directTotal,
        publishProducts: stat.directPublish,
        instockProducts: stat.directInstock,
      }));

    const chaosReport: ChaosReport = {
      doubleLinks,
      multiLeaf,
      multiTopLevel,
      orphanProducts,
      emptyCategories,
      instockZeroButHasProducts,
    };

    console.log(`  ✅ Double-link sayısı: ${doubleLinks.length}`);
    console.log(`  ✅ Multi-leaf sayısı: ${multiLeaf.length}`);
    console.log(`  ✅ Multi-top-level sayısı: ${multiTopLevel.length}`);
    console.log(`  ✅ Orphan product sayısı: ${orphanProducts.length}`);
    console.log(`  ✅ Empty category sayısı: ${emptyCategories.length}`);
    console.log(`  ✅ Instock=0 ama ürün olan kategori sayısı: ${instockZeroButHasProducts.length}\n`);

    // 11. Assert kontrolleri
    console.log("🔍 Assert kontrolleri yapılıyor...");
    const assertResults = runAsserts(
      baseline,
      baselineCheck,
      categories,
      topLevelCategories.length,
      maxDepth,
      chaosReport
    );

    if (assertResults.allPass) {
      console.log("  ✅ Tüm assert kontrolleri PASS\n");
    } else {
      console.log("  ❌ Assert kontrolleri FAIL:\n");
      for (const error of assertResults.errors) {
        console.log(`    - ${error}`);
      }
      console.log("");
    }

    // 12. Rapor oluştur
    console.log("📝 Rapor oluşturuluyor...");

    // Markdown rapor
    const markdownReport = generateMarkdownReport(
      categories,
      categoryStats,
      rollups,
      chaosReport,
      maxDepth,
      topLevelCategories.length,
      baselineCheck,
      schemaValidation,
      assertResults
    );
    const markdownPath = join(OUTPUT_DIR, "category-tree-analysis.md");
    await writeFile(markdownPath, markdownReport, "utf-8");
    console.log(`  ✅ Markdown rapor: ${markdownPath}`);

    // CSV export'lar
    const categoryStatsCsv = generateCategoryStatsCsv(categoryStats);
    const categoryStatsCsvPath = join(OUTPUT_DIR, "category-stats.csv");
    await writeFile(categoryStatsCsvPath, categoryStatsCsv, "utf-8");
    console.log(`  ✅ Category stats CSV: ${categoryStatsCsvPath}`);

    const rollupsCsv = generateRollupsCsv(rollups);
    const rollupsCsvPath = join(OUTPUT_DIR, "top-level-rollups.csv");
    await writeFile(rollupsCsvPath, rollupsCsv, "utf-8");
    console.log(`  ✅ Top-level rollups CSV: ${rollupsCsvPath}`);

    const doubleLinksCsv = generateDoubleLinksCsv(chaosReport.doubleLinks);
    const doubleLinksCsvPath = join(OUTPUT_DIR, "double-links.csv");
    await writeFile(doubleLinksCsvPath, doubleLinksCsv, "utf-8");
    console.log(`  ✅ Double links CSV: ${doubleLinksCsvPath}`);

    const orphanProductsCsv = generateOrphanProductsCsv(chaosReport.orphanProducts);
    const orphanProductsCsvPath = join(OUTPUT_DIR, "orphan-products.csv");
    await writeFile(orphanProductsCsvPath, orphanProductsCsv, "utf-8");
    console.log(`  ✅ Orphan products CSV: ${orphanProductsCsvPath}`);

    const emptyCategoriesCsv = generateEmptyCategoriesCsv(chaosReport.emptyCategories);
    const emptyCategoriesCsvPath = join(OUTPUT_DIR, "empty-categories.csv");
    await writeFile(emptyCategoriesCsvPath, emptyCategoriesCsv, "utf-8");
    console.log(`  ✅ Empty categories CSV: ${emptyCategoriesCsvPath}`);

    const instockZeroCsv = generateInstockZeroCsv(chaosReport.instockZeroButHasProducts);
    const instockZeroCsvPath = join(OUTPUT_DIR, "instock-zero-but-has-products.csv");
    await writeFile(instockZeroCsvPath, instockZeroCsv, "utf-8");
    console.log(`  ✅ Instock=0 but has products CSV: ${instockZeroCsvPath}`);

    const multiLeafCsv = generateMultiLeafCsv(chaosReport.multiLeaf);
    const multiLeafCsvPath = join(OUTPUT_DIR, "multi-leaf.csv");
    await writeFile(multiLeafCsvPath, multiLeafCsv, "utf-8");
    console.log(`  ✅ Multi-leaf CSV: ${multiLeafCsvPath}`);

    const multiTopLevelCsv = generateMultiTopLevelCsv(chaosReport.multiTopLevel);
    const multiTopLevelCsvPath = join(OUTPUT_DIR, "multi-top-level.csv");
    await writeFile(multiTopLevelCsvPath, multiTopLevelCsv, "utf-8");
    console.log(`  ✅ Multi-top-level CSV: ${multiTopLevelCsvPath}\n`);

    // Final durum kontrolü
    if (!assertResults.allPass) {
      console.log("=".repeat(60));
      console.log("❌ HATA: Assert kontrolleri başarısız!");
      console.log("=".repeat(60));
      for (const error of assertResults.errors) {
        console.log(`  - ${error}`);
      }
      console.log("");
      console.log("Lütfen hataları çözün ve tekrar çalıştırın.");
      console.log("");
      await pool.end();
      process.exit(1);
    }

    console.log("✅ Analiz tamamlandı!\n");

  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Şema doğrulama fonksiyonu
async function validateSchema(pool: Pool): Promise<SchemaValidation> {
  const requiredColumns = {
    categories: ["id", "wc_id", "parent_wc_id", "slug", "name"],
    products: ["id", "slug", "status", "stock_status"],
    productCategories: ["product_id", "category_id"],
  };

  const result: SchemaValidation = {
    categories: { columns: [] },
    products: { columns: [] },
    productCategories: { columns: [] },
    valid: true,
  };

  // categories tablosu
  const catResult = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'categories'
    ORDER BY ordinal_position
  `);
  result.categories.columns = catResult.rows.map((r: any) => r.column_name);
  const catMissing = requiredColumns.categories.filter(col => !result.categories.columns.includes(col));
  if (catMissing.length > 0) {
    result.valid = false;
  }

  // products tablosu
  const prodResult = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'products'
    ORDER BY ordinal_position
  `);
  result.products.columns = prodResult.rows.map((r: any) => r.column_name);
  const prodMissing = requiredColumns.products.filter(col => !result.products.columns.includes(col));
  if (prodMissing.length > 0) {
    result.valid = false;
  }

  // product_categories tablosu
  const pcResult = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'product_categories'
    ORDER BY ordinal_position
  `);
  result.productCategories.columns = pcResult.rows.map((r: any) => r.column_name);
  const pcMissing = requiredColumns.productCategories.filter(col => !result.productCategories.columns.includes(col));
  if (pcMissing.length > 0) {
    result.valid = false;
  }

  return result;
}

// Baseline kontrol fonksiyonu
async function checkBaseline(pool: Pool, baseline: BaselineData | null): Promise<BaselineCheck> {
  const result = await pool.query<{
    status: string;
    stock_status: string | null;
    count: string;
  }>(`
    SELECT 
      status,
      stock_status,
      COUNT(DISTINCT id)::int as count
    FROM products
    WHERE status = 'publish'
    GROUP BY status, stock_status
  `);

  let publishInstock = 0;
  let publishOutofstock = 0;
  let publishTotal = 0;

  for (const row of result.rows) {
    publishTotal += parseInt(row.count);
    if (row.stock_status === "instock") {
      publishInstock = parseInt(row.count);
    } else if (row.stock_status === "outofstock") {
      publishOutofstock = parseInt(row.count);
    }
  }

  // Baseline dosyasından oku, yoksa hardcoded değerler kullan
  const expectedInstock = baseline?.baseline.products.publishInstock ?? 244;
  const expectedOutofstock = baseline?.baseline.products.publishOutofstock ?? 30;
  const expectedTotal = baseline?.baseline.products.publishTotal ?? 274;

  return {
    publishInstock,
    publishOutofstock,
    publishTotal,
    expectedInstock,
    expectedOutofstock,
    expectedTotal,
    pass: publishInstock === expectedInstock && 
          publishOutofstock === expectedOutofstock && 
          publishTotal === expectedTotal,
  };
}

// Markdown rapor oluştur
function generateMarkdownReport(
  categories: Category[],
  categoryStats: CategoryStats[],
  rollups: TopLevelRollup[],
  chaosReport: ChaosReport,
  maxDepth: number,
  topLevelCount: number,
  baselineCheck: BaselineCheck,
  schemaValidation: SchemaValidation,
  assertResults: AssertResults
): string {
  const childCount = categories.length - topLevelCount;

  let report = `# Kategori Ağacı + Ürün Sayımları Analiz Raporu\n\n`;
  report += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  report += `---\n\n`;

  // Baseline Check
  report += `## 0. Baseline Sağlık Kontrolü\n\n`;
  report += `**Durum:** ${baselineCheck.pass ? "✅ PASS" : "⚠️ FAIL"}\n\n`;
  report += `| Metrik | Gerçek | Hedef | Durum |\n`;
  report += `|--------|--------|-------|-------|\n`;
  report += `| Publish + Instock | ${baselineCheck.publishInstock} | ${baselineCheck.expectedInstock} | ${baselineCheck.publishInstock === baselineCheck.expectedInstock ? "✅" : "❌"} |\n`;
  report += `| Publish + Outofstock | ${baselineCheck.publishOutofstock} | ${baselineCheck.expectedOutofstock} | ${baselineCheck.publishOutofstock === baselineCheck.expectedOutofstock ? "✅" : "❌"} |\n`;
  report += `| Publish Total | ${baselineCheck.publishTotal} | ${baselineCheck.expectedTotal} | ${baselineCheck.publishTotal === baselineCheck.expectedTotal ? "✅" : "❌"} |\n\n`;
  report += `> **Not:** UI kararları bu baseline sayılarına göre kilitlenmiştir.\n\n`;
  report += `---\n\n`;

  // Şema Doğrulama
  report += `## 0.1 Şema Doğrulama\n\n`;
  report += `**Durum:** ${schemaValidation.valid ? "✅ Geçerli" : "❌ Geçersiz"}\n\n`;
  report += `### Tablolar ve Kolonlar\n\n`;
  report += `**categories:** ${schemaValidation.categories.columns.join(", ")}\n\n`;
  report += `**products:** ${schemaValidation.products.columns.join(", ")}\n\n`;
  report += `**product_categories:** ${schemaValidation.productCategories.columns.join(", ")}\n\n`;
  report += `---\n\n`;

  // Assert Sonuçları
  report += `## 0.2 Assert Kontrolleri\n\n`;
  report += `**Durum:** ${assertResults.allPass ? "✅ PASS" : "❌ FAIL"}\n\n`;
  if (!assertResults.allPass) {
    report += `### Hatalar:\n\n`;
    for (const error of assertResults.errors) {
      report += `- ${error}\n`;
    }
    report += `\n`;
  } else {
    report += `- ✅ Ürün baseline kontrolü: PASS\n`;
    report += `- ✅ Kategori baseline kontrolü: PASS\n`;
    report += `- ✅ Orphan products kontrolü: PASS\n`;
    report += `- ✅ Multi-top-level kontrolü: PASS\n`;
  }
  report += `\n---\n\n`;

  // Genel Metrikler
  report += `## 1. Genel Metrikler\n\n`;
  report += `- **Toplam Kategori Sayısı:** ${categories.length}\n`;
  report += `- **Top-Level Kategori Sayısı:** ${topLevelCount}\n`;
  report += `- **Child Kategori Sayısı:** ${childCount}\n`;
  report += `- **Max Depth:** ${maxDepth}\n\n`;

  // Kategori İstatistikleri
  report += `## 2. Kategori İstatistikleri\n\n`;
  report += `| ID | Slug | Name | Depth | Top-Level | Direct Total | Direct Publish | Direct Instock | Children Count |\n`;
  report += `|----|------|------|-------|-----------|--------------|----------------|----------------|----------------|\n`;
  for (const stat of categoryStats.sort((a, b) => a.category.id - b.category.id)) {
    report += `| ${stat.category.id} | ${stat.category.slug} | ${stat.category.name} | ${stat.depth} | ${stat.isTopLevel ? "✓" : ""} | ${stat.directTotal} | ${stat.directPublish} | ${stat.directInstock} | ${stat.childrenIds.length} |\n`;
  }
  report += `\n`;

  // Top-Level Rollups
  report += `## 3. Top-Level Kategori Rollup Hesapları\n\n`;
  report += `| ID | Slug | Name | Direct Instock | Desc Instock | Overlap Instock | Rolled Up Unique Instock |\n`;
  report += `|----|------|------|----------------|--------------|-----------------|--------------------------|\n`;
  for (const rollup of rollups.sort((a, b) => a.category.id - b.category.id)) {
    report += `| ${rollup.category.id} | ${rollup.category.slug} | ${rollup.category.name} | ${rollup.directInstock} | ${rollup.descInstock} | ${rollup.overlapInstock} | ${rollup.rolledUpUniqueInstock} |\n`;
  }
  report += `\n`;

  // Karmaşa Raporu
  report += `## 4. Karmaşa Tespiti\n\n`;

  report += `### 4.1 Double-Link (Parent + Child Overlap)\n\n`;
  report += `**Toplam:** ${chaosReport.doubleLinks.length}\n\n`;
  if (chaosReport.doubleLinks.length > 0) {
    report += `| Product ID | Product Slug | Parent Category | Child Category |\n`;
    report += `|------------|--------------|-----------------|----------------|\n`;
    for (const dl of chaosReport.doubleLinks.slice(0, 20)) {
      report += `| ${dl.productId} | ${dl.productSlug} | ${dl.parentCategoryName} (${dl.parentCategoryId}) | ${dl.childCategoryName} (${dl.childCategoryId}) |\n`;
    }
    if (chaosReport.doubleLinks.length > 20) {
      report += `\n*... ve ${chaosReport.doubleLinks.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `### 4.2 Multi-Leaf (Ürün 2+ Leaf Kategoride)\n\n`;
  report += `**Toplam:** ${chaosReport.multiLeaf.length}\n\n`;
  report += `> **Not:** Leaf = depth=1 child kategoriler + children_count=0 top-level kategoriler\n\n`;
  if (chaosReport.multiLeaf.length > 0) {
    report += `| Product ID | Product Slug | Product Name | Leaf Categories |\n`;
    report += `|------------|--------------|--------------|------------------|\n`;
    for (const ml of chaosReport.multiLeaf.slice(0, 20)) {
      report += `| ${ml.productId} | ${ml.productSlug} | ${ml.productName} | ${ml.leafCategoryNames.join(", ")} |\n`;
    }
    if (chaosReport.multiLeaf.length > 20) {
      report += `\n*... ve ${chaosReport.multiLeaf.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `### 4.3 Multi-Top-Level (Ürün 2+ Top-Level Kategoride)\n\n`;
  report += `**Toplam:** ${chaosReport.multiTopLevel.length}\n\n`;
  report += `> **Not:** Hub mantığı için bilinçli olabilir ama raporlanmalı.\n\n`;
  if (chaosReport.multiTopLevel.length > 0) {
    report += `| Product ID | Product Slug | Product Name | Top-Level Categories |\n`;
    report += `|------------|--------------|--------------|----------------------|\n`;
    for (const mtl of chaosReport.multiTopLevel.slice(0, 20)) {
      report += `| ${mtl.productId} | ${mtl.productSlug} | ${mtl.productName} | ${mtl.topLevelCategoryNames.join(", ")} |\n`;
    }
    if (chaosReport.multiTopLevel.length > 20) {
      report += `\n*... ve ${chaosReport.multiTopLevel.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `### 4.4 Orphan Products (Kategorisiz Ürünler)\n\n`;
  report += `**Toplam:** ${chaosReport.orphanProducts.length}\n\n`;
  if (chaosReport.orphanProducts.length > 0) {
    report += `| Product ID | Slug | Name | Status | Stock Status |\n`;
    report += `|------------|------|------|--------|--------------|\n`;
    for (const op of chaosReport.orphanProducts.slice(0, 20)) {
      report += `| ${op.productId} | ${op.slug} | ${op.name} | ${op.status} | ${op.stockStatus || "null"} |\n`;
    }
    if (chaosReport.orphanProducts.length > 20) {
      report += `\n*... ve ${chaosReport.orphanProducts.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `### 4.5 Empty Categories (Ürünsüz Kategoriler)\n\n`;
  report += `**Toplam:** ${chaosReport.emptyCategories.length}\n\n`;
  if (chaosReport.emptyCategories.length > 0) {
    report += `| Category ID | Slug | Name |\n`;
    report += `|-------------|------|------|\n`;
    for (const ec of chaosReport.emptyCategories.slice(0, 20)) {
      report += `| ${ec.categoryId} | ${ec.slug} | ${ec.name} |\n`;
    }
    if (chaosReport.emptyCategories.length > 20) {
      report += `\n*... ve ${chaosReport.emptyCategories.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `### 4.6 Instock=0 Ama Ürün Olan Kategoriler\n\n`;
  report += `**Toplam:** ${chaosReport.instockZeroButHasProducts.length}\n\n`;
  if (chaosReport.instockZeroButHasProducts.length > 0) {
    report += `| Category ID | Slug | Name | Total Products | Publish Products | Instock Products |\n`;
    report += `|-------------|------|------|----------------|------------------|------------------|\n`;
    for (const iz of chaosReport.instockZeroButHasProducts.slice(0, 20)) {
      report += `| ${iz.categoryId} | ${iz.slug} | ${iz.name} | ${iz.totalProducts} | ${iz.publishProducts} | ${iz.instockProducts} |\n`;
    }
    if (chaosReport.instockZeroButHasProducts.length > 20) {
      report += `\n*... ve ${chaosReport.instockZeroButHasProducts.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  }
  report += `\n`;

  report += `---\n\n`;

  // UI Kararları için Yorum
  report += `## 5. UI Kararları için Yorum\n\n`;
  report += `### 5.1 Empty Categories\n\n`;
  report += `**Öneri:** Empty category'ler UI'da gizlenmeli (DB'den silinmemeli).\n\n`;
  report += `**Etkilenen Kategoriler:** ${chaosReport.emptyCategories.length} adet\n\n`;

  report += `### 5.2 Instock=0 Ama Ürün Olan Kategoriler\n\n`;
  report += `**Öneri:** Bu kategorilerde kategori sayfasında "0 ürün" davranışı netleştirilmeli.\n\n`;
  report += `**Etkilenen Kategoriler:** ${chaosReport.instockZeroButHasProducts.length} adet\n\n`;

  report += `### 5.3 Double-Link (Parent + Child Overlap)\n\n`;
  report += `**Durum:** ${chaosReport.doubleLinks.length} ürün hem parent hem child kategoriye bağlı.\n\n`;
  report += `**Politika Seçenekleri:**\n\n`;
  report += `1. **Hub Tasarımı:** Parent kategori "hub" olarak kullanılacaksa, double-link kalabilir (ama sayımda unique gösterilmeli).\n\n`;
  report += `2. **Leaf-Only Tasarımı:** "1 ürün 1 leaf" istenecekse, parent linklerini toplu kaldırma planı üretilmeli (ayrı iş/ayrı PR).\n\n`;
  report += `> **Not:** Bu karar ayrı kilit toplantısı gerektirir.\n\n`;

  report += `### 5.4 Multi-Leaf ve Multi-Top-Level\n\n`;
  report += `**Multi-Leaf:** ${chaosReport.multiLeaf.length} ürün 2+ leaf kategoride.\n\n`;
  report += `**Multi-Top-Level:** ${chaosReport.multiTopLevel.length} ürün 2+ top-level kategoride.\n\n`;
  report += `**Öneri:** Bu durumlar "unique instock" hesabını bozabilir. UI tasarımında dikkate alınmalı.\n\n`;

  report += `---\n\n`;

  // Cleanup Önerisi
  report += `## 6. Cleanup Önerisi (DB'ye Dokunmadan)\n\n`;
  report += `> **UYARI:** Aşağıdaki öneriler sadece bilgilendirme amaçlıdır. DB değişikliği gereken işler için backup + plan/apply/verify kuralı zorunludur.\n\n`;

  report += `### 6.1 Parent+Child Double-Link Politikası\n\n`;
  report += `**Seçenek A - Hub Tasarımı:**\n`;
  report += `- Parent kategoriler "hub" olarak kullanılacaksa, double-link kalabilir.\n`;
  report += `- Sayımda unique gösterilmeli (rolled-up unique instock kullanılmalı).\n`;
  report += `- UI'da parent kategori sayfasında hem direct hem descendant ürünler gösterilebilir.\n\n`;

  report += `**Seçenek B - Leaf-Only Tasarımı:**\n`;
  report += `- "1 ürün 1 leaf" istenecekse, parent linklerini toplu kaldırma planı üretilmeli.\n`;
  report += `- Bu işlem ayrı bir iş/ayrı PR olarak yapılmalı.\n`;
  report += `- Backup + plan/apply/verify kuralı zorunlu.\n\n`;

  report += `### 6.2 Empty Category'ler\n\n`;
  report += `- **DB Değişikliği:** Gerekli değil.\n`;
  report += `- **UI Değişikliği:** Empty category'ler UI'da gizlenmeli.\n`;
  report += `- **Filtreleme:** Kategori listesinde sadece direct_total > 0 olanlar gösterilmeli.\n\n`;

  report += `### 6.3 Instock=0 Ama Ürün Olan Kategoriler\n\n`;
  report += `- **DB Değişikliği:** Gerekli değil.\n`;
  report += `- **UI Değişikliği:** Kategori sayfasında "0 ürün" davranışı netleştirilmeli.\n`;
  report += `- **Örnek:** "Bu kategoride şu anda stokta ürün bulunmamaktadır" mesajı gösterilebilir.\n\n`;

  report += `---\n\n`;

  // CSV Listesi
  report += `## 7. CSV Export Dosyaları\n\n`;
  report += `Detaylı CSV export'lar \`exports/\` klasöründe mevcuttur:\n\n`;
  report += `- \`category-stats.csv\` - Her kategori için direct ürün sayımları\n`;
  report += `- \`top-level-rollups.csv\` - Top-level kategoriler için rollup hesapları\n`;
  report += `- \`double-links.csv\` - Parent+child double-link listesi\n`;
  report += `- \`multi-leaf.csv\` - 2+ leaf kategoride olan ürünler\n`;
  report += `- \`multi-top-level.csv\` - 2+ top-level kategoride olan ürünler\n`;
  report += `- \`orphan-products.csv\` - Kategorisiz ürünler\n`;
  report += `- \`empty-categories.csv\` - Ürünsüz kategoriler\n`;
  report += `- \`instock-zero-but-has-products.csv\` - Instock=0 ama ürün olan kategoriler\n\n`;

  return report;
}

// CSV export fonksiyonları
function generateCategoryStatsCsv(stats: CategoryStats[]): string {
  const header = "ID,WC_ID,Slug,Name,Parent_WC_ID,Depth,Is_Top_Level,Direct_Total,Direct_Publish,Direct_Instock,Children_Count\n";
  const rows = stats.map(stat => {
    return [
      stat.category.id,
      stat.category.wcId,
      `"${stat.category.slug}"`,
      `"${stat.category.name}"`,
      stat.category.parentWcId || "",
      stat.depth,
      stat.isTopLevel ? "1" : "0",
      stat.directTotal,
      stat.directPublish,
      stat.directInstock,
      stat.childrenIds.length,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateRollupsCsv(rollups: TopLevelRollup[]): string {
  const header = "ID,WC_ID,Slug,Name,Direct_Instock,Desc_Instock,Overlap_Instock,Rolled_Up_Unique_Instock\n";
  const rows = rollups.map(rollup => {
    return [
      rollup.category.id,
      rollup.category.wcId,
      `"${rollup.category.slug}"`,
      `"${rollup.category.name}"`,
      rollup.directInstock,
      rollup.descInstock,
      rollup.overlapInstock,
      rollup.rolledUpUniqueInstock,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateDoubleLinksCsv(doubleLinks: ChaosReport["doubleLinks"]): string {
  const header = "Product_ID,Product_Slug,Parent_Category_ID,Parent_Category_Name,Child_Category_ID,Child_Category_Name\n";
  const rows = doubleLinks.map(dl => {
    return [
      dl.productId,
      `"${dl.productSlug}"`,
      dl.parentCategoryId,
      `"${dl.parentCategoryName}"`,
      dl.childCategoryId,
      `"${dl.childCategoryName}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateOrphanProductsCsv(orphans: ChaosReport["orphanProducts"]): string {
  const header = "Product_ID,Slug,Name,Status,Stock_Status\n";
  const rows = orphans.map(op => {
    return [
      op.productId,
      `"${op.slug}"`,
      `"${op.name}"`,
      op.status,
      op.stockStatus || "",
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateEmptyCategoriesCsv(empty: ChaosReport["emptyCategories"]): string {
  const header = "Category_ID,Slug,Name\n";
  const rows = empty.map(ec => {
    return [
      ec.categoryId,
      `"${ec.slug}"`,
      `"${ec.name}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateInstockZeroCsv(instockZero: ChaosReport["instockZeroButHasProducts"]): string {
  const header = "Category_ID,Slug,Name,Total_Products,Publish_Products,Instock_Products\n";
  const rows = instockZero.map(iz => {
    return [
      iz.categoryId,
      `"${iz.slug}"`,
      `"${iz.name}"`,
      iz.totalProducts,
      iz.publishProducts,
      iz.instockProducts,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateMultiLeafCsv(multiLeaf: ChaosReport["multiLeaf"]): string {
  const header = "Product_ID,Product_Slug,Product_Name,Leaf_Category_IDs,Leaf_Category_Names\n";
  const rows = multiLeaf.map(ml => {
    return [
      ml.productId,
      `"${ml.productSlug}"`,
      `"${ml.productName}"`,
      ml.leafCategoryIds.join(";"),
      `"${ml.leafCategoryNames.join("; ")}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateMultiTopLevelCsv(multiTopLevel: ChaosReport["multiTopLevel"]): string {
  const header = "Product_ID,Product_Slug,Product_Name,Top_Level_Category_IDs,Top_Level_Category_Names\n";
  const rows = multiTopLevel.map(mtl => {
    return [
      mtl.productId,
      `"${mtl.productSlug}"`,
      `"${mtl.productName}"`,
      mtl.topLevelCategoryIds.join(";"),
      `"${mtl.topLevelCategoryNames.join("; ")}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

// Script'i çalıştır
main().catch(console.error);
