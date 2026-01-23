import dotenv from "dotenv";
import { Pool } from "pg";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

// CSV escape fonksiyonu
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // İç tırnakları "" yap ve tüm hücreyi çift tırnakla sar
  return `"${str.replace(/"/g, '""')}"`;
}

// Kaynak JSON'dan ürün array'ini çıkar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProductsArray(data: any): { products: any[]; error: string | null } {
  // Array ise direkt kullan
  if (Array.isArray(data)) {
    return { products: data, error: null };
  }

  // Object ise products/items/data gibi alanları dene
  if (typeof data === "object" && data !== null) {
    const candidates = ["products", "items", "data", "results", "rows", "list"];
    for (const key of candidates) {
      if (Array.isArray(data[key])) {
        return { products: data[key], error: null };
      }
    }

    // Bulunamadı, örnek key'leri döndür
    const sampleKeys = Object.keys(data).slice(0, 10);
    return {
      products: [],
      error: `Unknown shape: Array veya products/items/data/rows/list alanı bulunamadı. Örnek key'ler: ${sampleKeys.join(", ")}`,
    };
  }

  return { products: [], error: "Unknown shape: Ne array ne de object" };
}

interface DbProduct {
  id: number;
  wc_id: number | null;
  slug: string;
  name: string;
  status: string;
  stock_status: string | null;
  price: number | null;
  regular_price: number | null;
  created_at: Date;
  updated_at: Date;
}

async function main() {
  console.log("🚀 DB-only ürünler export ediliyor...\n");

  // 1. DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 2. DB'den tüm ürünleri çek
    console.log("📥 DB'den ürünler çekiliyor...");
    const dbResult = await pool.query<DbProduct>(`
      SELECT id, wc_id, slug, name, status, stock_status, price, regular_price, created_at, updated_at
      FROM products
      ORDER BY id
    `);
    const dbProducts = dbResult.rows;
    console.log(`  ✅ ${dbProducts.length} ürün DB'den çekildi\n`);

    // 3. Kaynak JSON'u oku
    const sourcePath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
    console.log("📂 Kaynak JSON okunuyor...");
    let sourceContent: string;
    try {
      sourceContent = await readFile(sourcePath, "utf-8");
    } catch (error) {
      console.error(`  ❌ HATA: Dosya okunamadı: ${sourcePath}`);
      console.error(`  Detay: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    let sourceData: unknown;
    try {
      sourceData = JSON.parse(sourceContent);
    } catch (error) {
      console.error(`  ❌ HATA: JSON parse edilemedi`);
      console.error(`  Detay: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    const { products: sourceProducts, error: extractError } = extractProductsArray(sourceData);

    if (extractError) {
      console.error(`  ❌ HATA: ${extractError}`);
      process.exit(1);
    }

    console.log(`  ✅ ${sourceProducts.length} ürün kaynak dosyadan okundu\n`);

    // 4. Kaynak ürünlerden slug'ları çıkar (boş slug'ları atla)
    console.log("🔍 Kaynak ürünlerden slug'lar çıkarılıyor...");
    const sourceSlugs = new Set<string>();
    for (const product of sourceProducts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slug = (product as any).slug;
      if (slug !== null && slug !== undefined && typeof slug === "string") {
        const trimmedSlug = slug.trim();
        if (trimmedSlug !== "") {
          sourceSlugs.add(trimmedSlug.toLowerCase());
        }
      }
    }
    console.log(`  ✅ ${sourceSlugs.size} benzersiz slug kaynak dosyadan çıkarıldı\n`);

    // 5. DB'de olup kaynakta olmayan ürünleri bul
    console.log("🔗 DB-only ürünler bulunuyor...");
    const dbOnlyProducts: DbProduct[] = [];
    for (const dbProduct of dbProducts) {
      const dbSlug = dbProduct.slug.trim().toLowerCase();
      if (!sourceSlugs.has(dbSlug)) {
        dbOnlyProducts.push(dbProduct);
      }
    }
    console.log(`  ✅ ${dbOnlyProducts.length} DB-only ürün bulundu\n`);

    // 6. CSV yaz
    console.log("📝 CSV dosyası yazılıyor...");
    const csvPath = join(process.cwd(), "old-products", "db-only-not-in-eroshopa.csv");
    const csvRows: string[] = [];

    // Header
    csvRows.push(
      ["id", "wc_id", "slug", "name", "status", "stock_status", "price", "regular_price", "price_tl", "regular_tl"]
        .map(escapeCsv)
        .join(",")
    );

    // Data rows
    for (const product of dbOnlyProducts) {
      const priceTl = product.price !== null ? product.price / 100.0 : null;
      const regularTl = product.regular_price !== null ? product.regular_price / 100.0 : null;

      csvRows.push(
        [
          product.id,
          product.wc_id ?? "",
          product.slug,
          product.name,
          product.status,
          product.stock_status ?? "",
          product.price ?? "",
          product.regular_price ?? "",
          priceTl !== null ? priceTl.toFixed(2) : "",
          regularTl !== null ? regularTl.toFixed(2) : "",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    await writeFile(csvPath, csvRows.join("\n"), "utf-8");
    console.log(`  ✅ CSV dosyası kaydedildi: ${csvPath}\n`);

    // 7. Konsola özet bas
    console.log("📊 Özet:");
    console.log(`   DB ürün sayısı: ${dbProducts.length}`);
    console.log(`   Kaynak slug sayısı: ${sourceSlugs.size}`);
    console.log(`   DB-only ürün sayısı: ${dbOnlyProducts.length}`);
    console.log();

    // İlk 5 satırı göster
    if (dbOnlyProducts.length > 0) {
      console.log("📋 DB-only ürünler (ilk 5):");
      const displayCount = Math.min(5, dbOnlyProducts.length);
      for (let i = 0; i < displayCount; i++) {
        const product = dbOnlyProducts[i];
        const priceTl = product.price !== null ? (product.price / 100.0).toFixed(2) : "N/A";
        console.log(
          `   ${i + 1}. wc_id: ${product.wc_id ?? "N/A"} | slug: ${product.slug} | name: ${product.name} | price_tl: ${priceTl}`
        );
      }
      if (dbOnlyProducts.length > 5) {
        console.log(`   ... ve ${dbOnlyProducts.length - 5} ürün daha`);
      }
      console.log();
    } else {
      console.log("   DB-only ürün bulunamadı.\n");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
