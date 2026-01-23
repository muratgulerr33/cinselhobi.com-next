import dotenv from "dotenv";
import { Pool } from "pg";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

// Çıktı klasörü
const OUTPUT_DIR = join(process.cwd(), "old-products");

// CSV escape fonksiyonu
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

// SQL escape fonksiyonu (single quote escape)
function sqlEscape(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

// Kaynak JSON'dan ürün array'ini çıkar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProductsArray(data: any): { products: any[]; error: string | null } {
  if (Array.isArray(data)) {
    return { products: data, error: null };
  }

  if (typeof data === "object" && data !== null) {
    const candidates = ["products", "items", "data", "results", "rows", "list"];
    for (const key of candidates) {
      if (Array.isArray(data[key])) {
        return { products: data[key], error: null };
      }
    }

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
  slug: string;
  name: string;
  description: string | null;
}

interface SourceProduct {
  slug: string;
  description_html: string;
  title?: string;
}

interface MatchResult {
  dbProduct: DbProduct;
  sourceDescription: string;
  matched: boolean;
}

async function main() {
  console.log("🔍 Boş açıklamalı ürünler için ön keşif başlatılıyor...\n");

  // 1. DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 2. DB'den boş açıklamalı ürünleri çek
    console.log("📥 DB'den boş açıklamalı ürünler çekiliyor...");
    const dbResult = await pool.query<DbProduct>(`
      SELECT id, slug, name, description
      FROM products
      WHERE description IS NULL OR description = '' OR TRIM(description) = ''
      ORDER BY id
    `);
    const dbProducts = dbResult.rows;
    console.log(`  ✅ ${dbProducts.length} ürün boş açıklamaya sahip\n`);

    if (dbProducts.length === 0) {
      console.log("✨ Tüm ürünlerin açıklaması dolu! İşlem tamamlandı.");
      await pool.end();
      return;
    }

    // 3. Kaynak JSON'u oku
    const sourcePath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
    console.log("📂 Kaynak JSON okunuyor...");
    let sourceContent: string;
    try {
      sourceContent = await readFile(sourcePath, "utf-8");
    } catch (error) {
      console.error(`  ❌ HATA: Dosya okunamadı: ${sourcePath}`);
      console.error(`  Detay: ${error instanceof Error ? error.message : String(error)}`);
      await pool.end();
      process.exit(1);
    }

    let sourceData: unknown;
    try {
      sourceData = JSON.parse(sourceContent);
    } catch (error) {
      console.error(`  ❌ HATA: JSON parse edilemedi`);
      console.error(`  Detay: ${error instanceof Error ? error.message : String(error)}`);
      await pool.end();
      process.exit(1);
    }

    const { products: sourceProducts, error: extractError } = extractProductsArray(sourceData);
    if (extractError) {
      console.error(`  ❌ HATA: ${extractError}`);
      await pool.end();
      process.exit(1);
    }

    console.log(`  ✅ ${sourceProducts.length} ürün kaynak dosyadan okundu\n`);

    // 4. Kaynak dosyadan slug -> description_html mapping oluştur
    console.log("🔗 Slug eşleştirmesi yapılıyor...");
    const sourceMap = new Map<string, SourceProduct>();
    for (const product of sourceProducts) {
      if (product.slug && product.description_html) {
        sourceMap.set(product.slug, {
          slug: product.slug,
          description_html: product.description_html,
          title: product.title,
        });
      }
    }
    console.log(`  ✅ ${sourceMap.size} ürün kaynak mapping'de mevcut\n`);

    // 5. DB ürünlerini kaynak ile eşleştir
    const matches: MatchResult[] = [];
    const unmatched: DbProduct[] = [];

    for (const dbProduct of dbProducts) {
      const sourceProduct = sourceMap.get(dbProduct.slug);
      if (sourceProduct && sourceProduct.description_html) {
        matches.push({
          dbProduct,
          sourceDescription: sourceProduct.description_html,
          matched: true,
        });
      } else {
        unmatched.push(dbProduct);
      }
    }

    console.log("📊 Eşleştirme Sonuçları:");
    console.log(`  ✅ Eşleşen: ${matches.length} ürün`);
    console.log(`  ❌ Eşleşmeyen: ${unmatched.length} ürün\n`);

    // 6. Çıktı klasörünü oluştur
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    // 7. SQL UPDATE statement'ları oluştur (SADECE DOSYAYA YAZ, ÇALIŞTIRMA!)
    const sqlFilePath = join(OUTPUT_DIR, "update-missing-descriptions.sql");
    let sqlContent = `-- Boş açıklamalı ürünler için UPDATE statement'ları\n`;
    sqlContent += `-- DİKKAT: Bu dosya SADECE ÖN KEŞİF içindir. Veritabanına uygulanmamıştır!\n`;
    sqlContent += `-- Oluşturulma tarihi: ${new Date().toISOString()}\n`;
    sqlContent += `-- Toplam ${matches.length} ürün için UPDATE statement'ı\n\n`;
    sqlContent += `BEGIN;\n\n`;

    for (const match of matches) {
      const escapedDescription = sqlEscape(match.sourceDescription);
      sqlContent += `UPDATE products SET description = ${escapedDescription} WHERE slug = ${sqlEscape(match.dbProduct.slug)};\n`;
    }

    sqlContent += `\nCOMMIT;\n`;

    await writeFile(sqlFilePath, sqlContent, "utf-8");
    console.log(`  ✅ SQL dosyası oluşturuldu: ${sqlFilePath}`);

    // 8. CSV raporu oluştur
    const csvFilePath = join(OUTPUT_DIR, "missing-descriptions-report.csv");
    let csvContent = "id,slug,name,matched,source_description_preview\n";

    // Eşleşenler
    for (const match of matches) {
      const preview = match.sourceDescription.substring(0, 100).replace(/\n/g, " ").replace(/"/g, '""');
      csvContent += `${match.dbProduct.id},${escapeCsv(match.dbProduct.slug)},${escapeCsv(match.dbProduct.name)},Evet,${escapeCsv(preview + "...")}\n`;
    }

    // Eşleşmeyenler
    for (const dbProduct of unmatched) {
      csvContent += `${dbProduct.id},${escapeCsv(dbProduct.slug)},${escapeCsv(dbProduct.name)},Hayır,""\n`;
    }

    await writeFile(csvFilePath, csvContent, "utf-8");
    console.log(`  ✅ CSV raporu oluşturuldu: ${csvFilePath}\n`);

    // 9. Özet bilgiler
    console.log("📋 ÖZET:");
    console.log(`  • DB'de boş açıklamalı ürün sayısı: ${dbProducts.length}`);
    console.log(`  • Kaynak dosyada toplam ürün sayısı: ${sourceProducts.length}`);
    console.log(`  • Eşleşen ürün sayısı: ${matches.length}`);
    console.log(`  • Eşleşmeyen ürün sayısı: ${unmatched.length}`);
    console.log(`  • SQL dosyası: ${sqlFilePath}`);
    console.log(`  • CSV raporu: ${csvFilePath}\n`);

    if (unmatched.length > 0) {
      console.log("⚠️  Eşleşmeyen ürünler (ilk 10):");
      for (const product of unmatched.slice(0, 10)) {
        console.log(`    - ${product.slug} (ID: ${product.id})`);
      }
      if (unmatched.length > 10) {
        console.log(`    ... ve ${unmatched.length - 10} ürün daha`);
      }
      console.log("");
    }

    console.log("✨ Ön keşif tamamlandı! SQL dosyasını inceleyip karar verebilirsiniz.");
    console.log("⚠️  DİKKAT: SQL dosyası henüz veritabanına uygulanmamıştır!\n");

  } catch (error) {
    console.error("❌ HATA:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
