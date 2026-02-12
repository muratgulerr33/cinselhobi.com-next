import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir } from "fs/promises";
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

const OUTPUT_DIR = join(process.cwd(), "exports");

// HTML etiketlerini temizle (düz metne çevir)
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  // HTML etiketlerini kaldır
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// CSV escape fonksiyonu (RFC4180 uyumlu)
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // Eğer newline, tırnak veya virgül içeriyorsa çift tırnakla sar
  if (str.includes('"') || str.includes("\n") || str.includes(",")) {
    // İç tırnakları "" yap
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

interface ColumnInfo {
  column_name: string;
}

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  meta_title: string | null | undefined;
  meta_description: string | null | undefined;
  categories: string;
}

interface ExportRow {
  slug: string;
  id: number;
  name: string;
  categories: string;
  description_html: string;
  description_text: string;
  edit_description_text: string;
  short_description_html: string;
  short_description_text: string;
  edit_short_description_text: string;
  meta_title: string;
  meta_title_default: string;
  meta_description: string;
  notes: string;
}

async function main() {
  console.log("🚀 SEO/Ürün Edit Export başlatılıyor...\n");

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
    // 1. Schema keşfi: products tablosunda hangi kolonlar var?
    console.log("🔍 Schema keşfi yapılıyor...");
    const columnsResult = await pool.query<ColumnInfo>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'products'
        AND column_name IN ('description', 'short_description', 'meta_title', 'meta_description')
      ORDER BY column_name
    `);
    
    const existingColumns = new Set(columnsResult.rows.map((r) => r.column_name));
    const hasDescription = existingColumns.has("description");
    const hasShortDescription = existingColumns.has("short_description");
    const hasMetaTitle = existingColumns.has("meta_title");
    const hasMetaDescription = existingColumns.has("meta_description");

    const missingColumns: string[] = [];
    if (!hasDescription) missingColumns.push("description");
    if (!hasShortDescription) missingColumns.push("short_description");
    if (!hasMetaTitle) missingColumns.push("meta_title");
    if (!hasMetaDescription) missingColumns.push("meta_description");

    console.log(`  ✅ Mevcut kolonlar: description=${hasDescription}, short_description=${hasShortDescription}, meta_title=${hasMetaTitle}, meta_description=${hasMetaDescription}`);
    if (missingColumns.length > 0) {
      console.log(`  ⚠️  Eksik kolonlar: ${missingColumns.join(", ")}`);
    }
    console.log();

    // 2. Ürünleri çek (publish + instock)
    console.log("📥 Ürünler çekiliyor (status='publish' AND stock_status='instock')...");
    
    // Dinamik SELECT: sadece mevcut kolonları seç
    const selectFields = [
      "p.id",
      "p.slug",
      "p.name",
      hasDescription ? "p.description" : "NULL as description",
      hasShortDescription ? "p.short_description" : "NULL as short_description",
      hasMetaTitle ? "p.meta_title" : "NULL as meta_title",
      hasMetaDescription ? "p.meta_description" : "NULL as meta_description",
    ].join(", ");

    const productsResult = await pool.query<ProductRow>(`
      SELECT 
        ${selectFields},
        COALESCE(
          STRING_AGG(DISTINCT c.slug, ',' ORDER BY c.slug),
          ''
        ) as categories
      FROM products p
      LEFT JOIN product_categories pc ON pc.product_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id
      WHERE p.status = 'publish' AND p.stock_status = 'instock'
      GROUP BY p.id, p.slug, p.name${hasDescription ? ", p.description" : ""}${hasShortDescription ? ", p.short_description" : ""}${hasMetaTitle ? ", p.meta_title" : ""}${hasMetaDescription ? ", p.meta_description" : ""}
      ORDER BY p.id
    `);

    const products = productsResult.rows;
    console.log(`  ✅ ${products.length} ürün bulundu\n`);

    // 3. Export verilerini hazırla
    console.log("🔄 Export verileri hazırlanıyor...");
    const exportRows: ExportRow[] = [];
    let emptyDescriptions = 0;
    let emptyMetaTitle = 0;
    let emptyMetaDescription = 0;

    for (const product of products) {
      const descriptionHtml = product.description || "";
      const descriptionText = stripHtml(descriptionHtml);
      const shortDescriptionHtml = product.short_description || "";
      const shortDescriptionText = stripHtml(shortDescriptionHtml);

      if (!descriptionText && !shortDescriptionText) {
        emptyDescriptions++;
      }

      // meta_title: DB'de varsa değeri, yoksa boş
      // meta_title_default: her zaman name
      let metaTitle = "";
      if (hasMetaTitle && product.meta_title) {
        metaTitle = product.meta_title;
      }
      if (!metaTitle) {
        emptyMetaTitle++;
      }

      // meta_description: DB'de varsa değeri, yoksa boş
      let metaDescription = "";
      if (hasMetaDescription && product.meta_description) {
        metaDescription = product.meta_description;
      }
      if (!metaDescription) {
        emptyMetaDescription++;
      }

      exportRows.push({
        slug: product.slug,
        id: product.id,
        name: product.name,
        categories: product.categories,
        description_html: descriptionHtml,
        description_text: descriptionText,
        edit_description_text: descriptionText, // default: description_text
        short_description_html: shortDescriptionHtml,
        short_description_text: shortDescriptionText,
        edit_short_description_text: shortDescriptionText, // default: short_description_text
        meta_title: metaTitle,
        meta_title_default: product.name, // her zaman name
        meta_description: metaDescription,
        notes: "", // boş, manuel not alanı
      });
    }

    console.log(`  ✅ ${exportRows.length} satır hazırlandı\n`);

    // 4. CSV yaz
    console.log("📝 CSV dosyası yazılıyor...");
    const csvPath = join(OUTPUT_DIR, "products-seo.csv");
    const csvHeaders = [
      "slug",
      "id",
      "name",
      "categories",
      "description_html",
      "description_text",
      "edit_description_text",
      "short_description_html",
      "short_description_text",
      "edit_short_description_text",
      "meta_title",
      "meta_title_default",
      "meta_description",
      "notes",
    ];

    const csvLines: string[] = [];
    // Header
    csvLines.push(csvHeaders.map(escapeCsv).join(","));

    // Rows
    for (const row of exportRows) {
      const csvRow = [
        row.slug,
        row.id,
        row.name,
        row.categories,
        row.description_html,
        row.description_text,
        row.edit_description_text,
        row.short_description_html,
        row.short_description_text,
        row.edit_short_description_text,
        row.meta_title,
        row.meta_title_default,
        row.meta_description,
        row.notes,
      ].map(escapeCsv);
      csvLines.push(csvRow.join(","));
    }

    await writeFile(csvPath, csvLines.join("\n"), "utf-8");
    console.log(`  ✅ ${csvPath} yazıldı\n`);

    // 5. JSON yaz
    console.log("📝 JSON dosyası yazılıyor...");
    const jsonPath = join(OUTPUT_DIR, "products-seo.json");
    await writeFile(jsonPath, JSON.stringify(exportRows, null, 2), "utf-8");
    console.log(`  ✅ ${jsonPath} yazıldı\n`);

    // 6. Rapor
    console.log("=".repeat(60));
    console.log("📊 EXPORT RAPORU");
    console.log("=".repeat(60));
    console.log(`✅ Exported products: ${exportRows.length}`);
    if (missingColumns.length > 0) {
      console.log(`⚠️  Missing columns: ${missingColumns.join(", ")}`);
    }
    console.log(`📝 Empty descriptions: ${emptyDescriptions}`);
    if (hasMetaTitle) {
      console.log(`📝 Empty meta_title in DB: ${emptyMetaTitle}`);
    }
    if (hasMetaDescription) {
      console.log(`📝 Empty meta_description in DB: ${emptyMetaDescription}`);
    }
    console.log("=".repeat(60));
    console.log("\n✅ Export tamamlandı!");
  } catch (error) {
    console.error("❌ HATA:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
