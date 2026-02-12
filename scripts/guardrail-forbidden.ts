import dotenv from "dotenv";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { detectIntent } from "../src/lib/intent-heuristics";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

const OUTPUT_DIR = join(process.cwd(), "exports");
const EXCEPTIONS_FILE = join(process.cwd(), "locks", "guardrail-exceptions.json");

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

interface Violation {
  rule: string;
  productId: number;
  productSlug: string;
  productName: string;
  hubId: number | null;
  hubSlug: string | null;
  hubName: string | null;
  categorySlugs: string[];
  reason: string;
}

// Intent heuristics artık src/lib/intent-heuristics.ts'den import ediliyor

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log("🚀 Guardrail Forbidden Rules Check başlatılıyor...\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. Kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      ORDER BY id
    `);
    const allCategories = categoriesResult.rows;
    const categoryById = new Map<number, Category>();
    const categoryByWcId = new Map<number, Category>();

    for (const cat of allCategories) {
      categoryById.set(cat.id, cat);
      categoryByWcId.set(cat.wcId, cat);
    }

    // Top-level hub'ları bul (parent_wc_id IS NULL)
    const hubs = allCategories.filter(c => c.parentWcId === null);
    console.log(`  ✅ ${allCategories.length} kategori, ${hubs.length} hub bulundu`);

    // Kategori -> hub mapping (her kategori için top-level hub'ı bul)
    const categoryToHub = new Map<number, Category>();
    
    function findHub(categoryId: number, visited: Set<number>): Category | null {
      if (visited.has(categoryId)) {
        return null; // Circular reference
      }
      visited.add(categoryId);

      const category = categoryById.get(categoryId);
      if (!category) {
        return null;
      }

      // Eğer bu kategori bir hub ise (parent NULL), kendisini döndür
      if (category.parentWcId === null) {
        return category;
      }

      // Parent'ı bul ve recursive olarak hub'ı bul
      const parent = categoryByWcId.get(category.parentWcId);
      if (!parent) {
        return null;
      }

      return findHub(parent.id, visited);
    }

    // Her kategori için hub'ı hesapla
    for (const cat of allCategories) {
      const hub = findHub(cat.id, new Set());
      if (hub) {
        categoryToHub.set(cat.id, hub);
      }
    }

    console.log(`  ✅ Kategori -> hub mapping oluşturuldu\n`);

    // 2. Publish + instock ürünleri çek
    console.log("📥 Publish + instock ürünleri çekiliyor...");
    const productsResult = await pool.query<Product>(`
      SELECT id, slug, name, status, stock_status as "stockStatus"
      FROM products
      WHERE status = 'publish' AND stock_status = 'instock'
      ORDER BY id
    `);
    const products = productsResult.rows;
    console.log(`  ✅ ${products.length} ürün bulundu\n`);

    // 3. Ürün-kategori ilişkilerini çek
    console.log("📥 Ürün-kategori ilişkileri çekiliyor...");
    const productCategoriesResult = await pool.query<{
      productId: number;
      categoryId: number;
    }>(`
      SELECT product_id as "productId", category_id as "categoryId"
      FROM product_categories
    `);

    // Ürün -> kategoriler mapping
    const productToCategories = new Map<number, number[]>();
    for (const pc of productCategoriesResult.rows) {
      if (!productToCategories.has(pc.productId)) {
        productToCategories.set(pc.productId, []);
      }
      productToCategories.get(pc.productId)!.push(pc.categoryId);
    }
    console.log(`  ✅ ${productCategoriesResult.rows.length} ürün-kategori ilişkisi bulundu\n`);

    // 4. Exceptions dosyasını oku (varsa)
    let exceptions: Record<string, string[]> = {
      "RULE-1": [],
      "RULE-2": [],
      "RULE-3": [],
    };
    
    if (existsSync(EXCEPTIONS_FILE)) {
      try {
        const exceptionsContent = await readFile(EXCEPTIONS_FILE, "utf-8");
        exceptions = JSON.parse(exceptionsContent);
        console.log(`  ✅ Exceptions dosyası yüklendi: ${Object.values(exceptions).flat().length} istisna\n`);
      } catch (error) {
        console.warn(`  ⚠️  Exceptions dosyası okunamadı, devam ediliyor: ${error}\n`);
      }
    } else {
      console.log(`  ℹ️  Exceptions dosyası bulunamadı, tüm kurallar uygulanacak\n`);
    }

    // 5. Guardrail kurallarını kontrol et
    console.log("🔍 Guardrail kuralları kontrol ediliyor...\n");

    const violations: Violation[] = [];
    
    // Exceptions kontrolü için helper fonksiyon
    const isException = (rule: string, productSlug: string): boolean => {
      const ruleExceptions = exceptions[rule] || [];
      return ruleExceptions.includes(productSlug);
    };

    for (const product of products) {
      const categoryIds = productToCategories.get(product.id) || [];
      const categorySlugs: string[] = [];
      const hubIds = new Set<number>();

      // Ürünün kategorilerini ve hub'larını topla
      for (const categoryId of categoryIds) {
        const category = categoryById.get(categoryId);
        if (category) {
          categorySlugs.push(category.slug);
          const hub = categoryToHub.get(categoryId);
          if (hub) {
            hubIds.add(hub.id);
          }
        }
      }

      // RULE-1: (slug/name contains 'manken') ürünler `et-dokulu-urunler` altında olamaz
      const isManken = product.slug.toLowerCase().includes("manken") || 
                       product.name.toLowerCase().includes("manken");
      if (isManken && categorySlugs.includes("et-dokulu-urunler")) {
        // Exception kontrolü
        if (!isException("RULE-1", product.slug)) {
          violations.push({
            rule: "RULE-1",
            productId: product.id,
            productSlug: product.slug,
            productName: product.name,
            hubId: null,
            hubSlug: null,
            hubName: null,
            categorySlugs: categorySlugs,
            reason: "Ürün slug/name'de 'manken' içeriyor ve 'et-dokulu-urunler' kategorisinde bulunuyor"
          });
        }
      }

      // RULE-2 ve RULE-3 için intent'i hesapla (categorySlugs ile)
      const { intent } = detectIntent(product.slug, product.name, categorySlugs);

      // Her hub için kontrol et
      for (const hubId of hubIds) {
        const hub = categoryById.get(hubId);
        if (!hub) continue;

        // RULE-2: `kadinlara-ozel` hub altında erkek-intent keyword'lü ürün olamaz
        if (hub.slug === "kadinlara-ozel" && intent === "erkek") {
          // Exception kontrolü
          if (!isException("RULE-2", product.slug)) {
            violations.push({
              rule: "RULE-2",
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              hubId: hub.id,
              hubSlug: hub.slug,
              hubName: hub.name,
              categorySlugs: categorySlugs,
              reason: `'kadinlara-ozel' hub'ı altında erkek-intent keyword'lü ürün bulunuyor (intent: ${intent})`
            });
          }
        }

        // RULE-3: `erkeklere-ozel` hub altında kadın-intent keyword'lü ürün olamaz
        if (hub.slug === "erkeklere-ozel" && intent === "kadin") {
          // Exception kontrolü
          if (!isException("RULE-3", product.slug)) {
            violations.push({
              rule: "RULE-3",
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              hubId: hub.id,
              hubSlug: hub.slug,
              hubName: hub.name,
              categorySlugs: categorySlugs,
              reason: `'erkeklere-ozel' hub'ı altında kadın-intent keyword'lü ürün bulunuyor (intent: ${intent})`
            });
          }
        }
      }
    }

    console.log(`  ✅ Kontrol tamamlandı: ${violations.length} ihlal bulundu\n`);

    // 6. Violations CSV'ye yaz
    if (violations.length > 0) {
      console.log("📝 Violations CSV dosyası oluşturuluyor...");
      const csvPath = join(OUTPUT_DIR, "guardrail-violations.csv");
      const csvLines: string[] = [];
      
      // Header
      csvLines.push("rule,product_id,product_slug,product_name,hub_id,hub_slug,hub_name,category_slugs,reason");
      
      // Rows
      for (const violation of violations) {
        csvLines.push([
          escapeCsv(violation.rule),
          violation.productId,
          escapeCsv(violation.productSlug),
          escapeCsv(violation.productName),
          violation.hubId !== null ? violation.hubId : "",
          escapeCsv(violation.hubSlug || ""),
          escapeCsv(violation.hubName || ""),
          escapeCsv(violation.categorySlugs.join("; ")),
          escapeCsv(violation.reason),
        ].join(","));
      }

      await writeFile(csvPath, csvLines.join("\n"), "utf-8");
      console.log(`  ✅ ${csvPath} oluşturuldu\n`);

      // Violations'ı konsola yazdır
      console.log("=".repeat(60));
      console.log("❌ GUARDRAIL İHLALLERİ BULUNDU");
      console.log("=".repeat(60));
      for (const violation of violations) {
        console.log(`\n[${violation.rule}] ${violation.productSlug}`);
        console.log(`  Ürün: ${violation.productName}`);
        if (violation.hubSlug) {
          console.log(`  Hub: ${violation.hubSlug} (${violation.hubName})`);
        }
        console.log(`  Kategoriler: ${violation.categorySlugs.join(", ")}`);
        console.log(`  Neden: ${violation.reason}`);
      }
      console.log("\n" + "=".repeat(60));
      console.log(`\n❌ Toplam ${violations.length} ihlal bulundu. Script FAIL ile sonlanıyor.\n`);
      
      await pool.end();
      process.exit(1);
    } else {
      console.log("=".repeat(60));
      console.log("✅ GUARDRAIL KONTROLÜ BAŞARILI");
      console.log("=".repeat(60));
      console.log(`✅ Hiçbir ihlal bulunamadı. Tüm kurallar geçti.\n`);
      
      await pool.end();
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ HATA:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
