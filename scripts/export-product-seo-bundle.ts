import dotenv from "dotenv";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { db } from "../src/db/connection";
import { products, productCategories, categories } from "../src/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const EXPORT_BASE_DIR = join(process.cwd(), "export", "aciklama");

// HTML'den edit-friendly text'e dönüştür
function htmlToEditFriendlyText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // HTML entity decode
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

  // Numeric entities
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));

  // Heading'leri markdown'a çevir
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // List items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");

  // Paragraph ve br'leri newline'a çevir
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<br\s+[^>]*>/gi, "\n");

  // Strong ve em
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");

  // Diğer tag'leri strip et
  text = text.replace(/<[^>]*>/g, "");

  // Fazla boşlukları temizle
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  return text;
}

// Slug'ı dosya adı için güvenli hale getir
function sanitizeSlugForFilename(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-");
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

// TSV escape fonksiyonu
function escapeTsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // TSV için tab ve newline'ı escape et
  return str.replace(/\t/g, " ").replace(/\n/g, " ");
}

interface ProductData {
  id: number;
  slug: string;
  sku: string | null;
  description: string | null;
  categories: string[];
}

interface ManifestItem {
  id: number;
  slug: string;
  sku: string | null;
  categories: string[];
  meta_title: string;
  meta_description: string;
  files: {
    md: string;
    csvRow: number;
  };
}

async function main() {
  console.log("🚀 Product SEO Bundle Export başlatılıyor...\n");

  // Run klasörü oluştur
  const now = new Date();
  const runDirName = `run-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const runDir = join(EXPORT_BASE_DIR, runDirName);
  const itemsDir = join(runDir, "items");

  if (!existsSync(EXPORT_BASE_DIR)) {
    await mkdir(EXPORT_BASE_DIR, { recursive: true });
  }
  await mkdir(runDir, { recursive: true });
  await mkdir(itemsDir, { recursive: true });

  console.log(`📁 Çıktı klasörü: ${runDir}\n`);

  try {
    // 1. Ürünleri çek (publish + instock, slug ASC)
    console.log("📥 Ürünler çekiliyor (status='publish' AND stockStatus='instock')...");

    const productResults = await db
      .select({
        id: products.id,
        slug: products.slug,
        sku: products.sku,
        description: products.description,
      })
      .from(products)
      .where(and(eq(products.status, "publish"), eq(products.stockStatus, "instock")))
      .orderBy(products.slug);

    console.log(`  ✅ ${productResults.length} ürün bulundu\n`);

    if (productResults.length === 0) {
      console.log("⚠️  Hiç ürün bulunamadı. Export sonlandırılıyor.");
      return;
    }

    // 2. Product ID listesi çıkar
    const productIds = productResults.map((p) => p.id);

    // 3. Kategorileri çek ve grupla
    console.log("📥 Kategoriler çekiliyor...");

    const categoryRelations = await db
      .select({
        productId: productCategories.productId,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(inArray(productCategories.productId, productIds));

    // ProductId bazında grupla
    const categoriesByProductId = new Map<number, string[]>();
    for (const rel of categoryRelations) {
      const existing = categoriesByProductId.get(rel.productId) || [];
      existing.push(rel.categorySlug);
      categoriesByProductId.set(rel.productId, existing);
    }

    const productsWithCategoriesCount = Array.from(categoriesByProductId.keys()).length;
    console.log(`  ✅ ${categoryRelations.length} kategori ilişkisi bulundu`);
    console.log(`  ✅ ${productsWithCategoriesCount} ürünün kategorisi var\n`);

    // 4. Export verilerini hazırla
    console.log("🔄 Export verileri hazırlanıyor...");

    const exportData: ProductData[] = [];
    const manifest: ManifestItem[] = [];

    for (let i = 0; i < productResults.length; i++) {
      const product = productResults[i];
      const productCategories = categoriesByProductId.get(product.id) || [];

      exportData.push({
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        categories: productCategories,
      });

      manifest.push({
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        categories: productCategories,
        meta_title: "", // DB'de meta_title kolonu yok
        meta_description: "", // DB'de meta_description kolonu yok
        files: {
          md: `items/${sanitizeSlugForFilename(product.slug)}.md`,
          csvRow: i + 2, // +2 çünkü header 1. satır, ilk data 2. satır
        },
      });
    }

    // 5. CSV ve TSV yaz
    console.log("📝 CSV ve TSV dosyaları yazılıyor...");

    const csvHeaders = ["slug", "description", "meta_description", "meta_title", "categories", "sku", "id"];
    const csvLines: string[] = [csvHeaders.map(escapeCsv).join(",")];
    const tsvLines: string[] = [csvHeaders.map(escapeTsv).join("\t")];

    for (const data of exportData) {
      const editFriendlyText = htmlToEditFriendlyText(data.description);
      const categoriesStr = data.categories.join("|");

      const csvRow = [
        data.slug,
        editFriendlyText,
        "", // meta_description
        "", // meta_title
        categoriesStr,
        data.sku || "",
        data.id,
      ].map(escapeCsv);

      const tsvRow = [
        data.slug,
        editFriendlyText,
        "", // meta_description
        "", // meta_title
        categoriesStr,
        data.sku || "",
        data.id,
      ].map(escapeTsv);

      csvLines.push(csvRow.join(","));
      tsvLines.push(tsvRow.join("\t"));
    }

    const csvPath = join(runDir, "products.csv");
    const tsvPath = join(runDir, "products.tsv");

    await writeFile(csvPath, csvLines.join("\n"), "utf-8");
    await writeFile(tsvPath, tsvLines.join("\n"), "utf-8");

    console.log(`  ✅ ${csvPath} yazıldı`);
    console.log(`  ✅ ${tsvPath} yazıldı\n`);

    // 6. Markdown dosyalarını yaz
    console.log("📝 Markdown dosyaları yazılıyor...");

    for (let i = 0; i < exportData.length; i++) {
      const data = exportData[i];
      const editFriendlyText = htmlToEditFriendlyText(data.description);
      const originalHtml = data.description || "";

      const frontmatter = `---
id: ${data.id}
slug: ${data.slug}
sku: ${data.sku || ""}
categories: [${data.categories.map((c) => `"${c}"`).join(", ")}]
meta_title: ""
meta_description: ""
---

## Description (EDIT THIS)
${editFriendlyText}

## Original HTML (REFERENCE)
\`\`\`html
${originalHtml}
\`\`\`
`;

      const mdFilename = `${sanitizeSlugForFilename(data.slug)}.md`;
      const mdPath = join(itemsDir, mdFilename);
      await writeFile(mdPath, frontmatter, "utf-8");
    }

    console.log(`  ✅ ${exportData.length} markdown dosyası yazıldı\n`);

    // 7. Manifest yaz
    console.log("📝 Manifest dosyası yazılıyor...");

    const manifestPath = join(runDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    console.log(`  ✅ ${manifestPath} yazıldı\n`);

    // 8. Rapor
    console.log("=".repeat(60));
    console.log("📊 EXPORT RAPORU");
    console.log("=".repeat(60));
    console.log(`✅ Export edilen ürün sayısı: ${exportData.length}`);
    console.log(`✅ Kategorisi bulunan ürün sayısı: ${productsWithCategoriesCount}`);
    console.log(`📁 Output path: ${runDir}`);
    console.log("=".repeat(60));
    console.log("\n✅ Export tamamlandı!");
  } catch (error) {
    console.error("❌ HATA:", error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
