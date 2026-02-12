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

const OUTPUT_DIR = join(process.cwd(), "old-products");

// Evidence: Schema alanları (schema.ts'den doğrulandı)
// - products tablosu: slug, name, description, short_description, price, regular_price, sale_price, status, stock_status
// - categories tablosu: id, slug, wc_id, parent_wc_id
// - product_categories tablosu: product_id, category_id

// Keyword set (hardcoded list)
const KEYWORDS = [
  // TR
  "akıllı",
  "akilli",
  "telefon",
  "mobil",
  "uygulama",
  "uygulamadan",
  "aplikasyon",
  "kumanda",
  "kumandalı",
  "kumandali",
  "uzaktan",
  "kontrol",
  "kontrollü",
  "kontrollu",
  "kablosuz",
  "bluetooth",
  // EN
  "app",
  "app-controlled",
  "application",
  "smart",
  "smart toy",
  "remote",
  "remote control",
  "wifi",
  "ios",
  "android",
  "phone",
];

// CSV escape fonksiyonu
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

// HTML'den düz metne yakın çevirme (basit)
function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Snippet üretme (eşleşme noktasından 120-160 karakter)
function extractSnippet(text: string, keyword: string, maxLength: number = 160): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  
  if (index === -1) {
    return text.substring(0, maxLength).trim();
  }
  
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + keyword.length + 80);
  let snippet = text.substring(start, end).trim();
  
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  
  return snippet.substring(0, maxLength).trim();
}

// Heuristic tag'ler
function getHeuristicTags(matchedKeywords: string[]): string[] {
  const tags: string[] = [];
  const lowerKeywords = matchedKeywords.map((k) => k.toLowerCase());
  
  if (lowerKeywords.some((k) => k.includes("app") || k.includes("uygulama") || k.includes("aplikasyon"))) {
    tags.push("app_controlled_candidate");
  }
  if (lowerKeywords.some((k) => k.includes("kumanda") || k.includes("remote") || k.includes("uzaktan"))) {
    tags.push("remote_control_candidate");
  }
  if (lowerKeywords.some((k) => k.includes("bluetooth") || k.includes("wifi"))) {
    tags.push("connectivity_candidate");
  }
  if (lowerKeywords.some((k) => k.includes("smart") || k.includes("akıllı") || k.includes("akilli"))) {
    tags.push("smart_candidate");
  }
  
  return tags;
}

interface SmartProduct {
  productSlug: string;
  productName: string;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  status: string;
  stockStatus: string | null;
  categorySlugs: string[];
  matchedKeywords: string[];
  matchedFields: string[];
  snippet: string;
  heuristicTags: string[];
}

interface KeywordFrequency {
  keyword: string;
  count: number;
}

interface CategoryDistribution {
  categorySlug: string;
  count: number;
}

async function main() {
  console.log("🔍 Smart Products Detective başlatılıyor...\n");

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
    // 1. Tüm ürünleri ve açıklamalarını çek
    console.log("📥 Ürünler ve açıklamalar çekiliyor...");
    const productsResult = await pool.query<{
      id: number;
      slug: string;
      name: string;
      description: string | null;
      short_description: string | null;
      price: number | null;
      regular_price: number | null;
      sale_price: number | null;
      status: string;
      stock_status: string | null;
    }>(`
      SELECT 
        id,
        slug,
        name,
        description,
        short_description,
        price,
        regular_price,
        sale_price,
        status,
        stock_status
      FROM products
      ORDER BY id
    `);
    const allProducts = productsResult.rows;
    console.log(`  ✅ ${allProducts.length} ürün bulundu\n`);

    // 2. Kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<{
      id: number;
      slug: string;
    }>(`
      SELECT id, slug
      FROM categories
    `);
    const categoryMap = new Map<number, string>();
    for (const cat of categoriesResult.rows) {
      categoryMap.set(cat.id, cat.slug);
    }
    console.log(`  ✅ ${categoryMap.size} kategori bulundu\n`);

    // 3. Ürün-kategori ilişkilerini çek
    console.log("📥 Ürün-kategori ilişkileri çekiliyor...");
    const productCategoriesResult = await pool.query<{
      product_id: number;
      category_id: number;
    }>(`
      SELECT product_id, category_id
      FROM product_categories
    `);
    const productCategoryMap = new Map<number, number[]>();
    for (const pc of productCategoriesResult.rows) {
      if (!productCategoryMap.has(pc.product_id)) {
        productCategoryMap.set(pc.product_id, []);
      }
      productCategoryMap.get(pc.product_id)!.push(pc.category_id);
    }
    console.log(`  ✅ ${productCategoriesResult.rows.length} ürün-kategori ilişkisi bulundu\n`);

    // 4. Keyword eşleştirmesi yap
    console.log("🔍 Keyword eşleştirmesi yapılıyor...");
    const smartProducts: SmartProduct[] = [];
    const keywordFrequency = new Map<string, number>();

    for (const product of allProducts) {
      const matchedKeywords: string[] = [];
      const matchedFields: string[] = [];
      let bestSnippet = "";

      // description alanında ara
      if (product.description) {
        const descText = stripHtml(product.description);
        const lowerDesc = descText.toLowerCase();
        
        for (const keyword of KEYWORDS) {
          const lowerKeyword = keyword.toLowerCase();
          if (lowerDesc.includes(lowerKeyword)) {
            if (!matchedKeywords.includes(keyword)) {
              matchedKeywords.push(keyword);
            }
            if (!matchedFields.includes("description")) {
              matchedFields.push("description");
            }
            if (!bestSnippet) {
              bestSnippet = extractSnippet(descText, keyword);
            }
            keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
          }
        }
      }

      // short_description alanında ara
      if (product.short_description) {
        const shortDescText = stripHtml(product.short_description);
        const lowerShortDesc = shortDescText.toLowerCase();
        
        for (const keyword of KEYWORDS) {
          const lowerKeyword = keyword.toLowerCase();
          if (lowerShortDesc.includes(lowerKeyword)) {
            if (!matchedKeywords.includes(keyword)) {
              matchedKeywords.push(keyword);
            }
            if (!matchedFields.includes("short_description")) {
              matchedFields.push("short_description");
            }
            if (!bestSnippet) {
              bestSnippet = extractSnippet(shortDescText, keyword);
            }
            keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
          }
        }
      }

      // Eşleşme varsa ekle
      if (matchedKeywords.length > 0) {
        const categoryIds = productCategoryMap.get(product.id) || [];
        const categorySlugs = categoryIds
          .map((id) => categoryMap.get(id))
          .filter((slug): slug is string => slug !== undefined);

        smartProducts.push({
          productSlug: product.slug,
          productName: product.name,
          price: product.price,
          regularPrice: product.regular_price,
          salePrice: product.sale_price,
          status: product.status,
          stockStatus: product.stock_status,
          categorySlugs,
          matchedKeywords,
          matchedFields,
          snippet: bestSnippet || "Snippet bulunamadı",
          heuristicTags: getHeuristicTags(matchedKeywords),
        });
      }
    }

    console.log(`  ✅ ${smartProducts.length} ürün eşleşti\n`);

    // 5. İstatistikleri hesapla
    console.log("📊 İstatistikler hesaplanıyor...");
    
    // Keyword frequency
    const keywordFreq: KeywordFrequency[] = Array.from(keywordFrequency.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count);

    // Category distribution
    const categoryDistMap = new Map<string, number>();
    for (const product of smartProducts) {
      for (const catSlug of product.categorySlugs) {
        categoryDistMap.set(catSlug, (categoryDistMap.get(catSlug) || 0) + 1);
      }
    }
    const categoryDist: CategoryDistribution[] = Array.from(categoryDistMap.entries())
      .map(([categorySlug, count]) => ({ categorySlug, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Field distribution
    const fieldDistMap = new Map<string, number>();
    for (const product of smartProducts) {
      for (const field of product.matchedFields) {
        fieldDistMap.set(field, (fieldDistMap.get(field) || 0) + 1);
      }
    }

    console.log("  ✅ İstatistikler hesaplandı\n");

    // 6. CSV raporu oluştur
    console.log("📝 CSV raporu oluşturuluyor...");
    const csvPath = join(OUTPUT_DIR, "smart-detective-products.csv");
    let csvContent = "product_slug,product_name,price,regular_price,sale_price,status,stock_status,category_slugs,heuristic_tags,matched_keywords,matched_fields,snippet\n";

    for (const product of smartProducts) {
      csvContent += [
        escapeCsv(product.productSlug),
        escapeCsv(product.productName),
        product.price !== null ? product.price : "",
        product.regularPrice !== null ? product.regularPrice : "",
        product.salePrice !== null ? product.salePrice : "",
        escapeCsv(product.status),
        escapeCsv(product.stockStatus),
        escapeCsv(product.categorySlugs.join("; ")),
        escapeCsv(product.heuristicTags.join("; ")),
        escapeCsv(product.matchedKeywords.join("; ")),
        escapeCsv(product.matchedFields.join("; ")),
        escapeCsv(product.snippet),
      ].join(",") + "\n";
    }

    await writeFile(csvPath, csvContent, "utf-8");
    console.log(`  ✅ ${csvPath} oluşturuldu\n`);

    // 7. Markdown raporu oluştur
    console.log("📝 Markdown raporu oluşturuluyor...");
    const mdPath = join(OUTPUT_DIR, "smart-detective-report.md");
    const mdContent = generateMarkdownReport({
      totalProducts: allProducts.length,
      matchedProducts: smartProducts.length,
      keywordFrequency: keywordFreq,
      categoryDistribution: categoryDist,
      fieldDistribution: Array.from(fieldDistMap.entries()).map(([field, count]) => ({ field, count })),
      sampleProducts: smartProducts.slice(0, 10),
    });

    await writeFile(mdPath, mdContent, "utf-8");
    console.log(`  ✅ ${mdPath} oluşturuldu\n`);

    console.log("✨ Smart Products Detective tamamlandı!");
    console.log(`\n📊 ÖZET:`);
    console.log(`  • Toplam ürün: ${allProducts.length}`);
    console.log(`  • Eşleşen ürün: ${smartProducts.length}`);
    console.log(`  • En çok eşleşen keyword: ${keywordFreq[0]?.keyword || "N/A"} (${keywordFreq[0]?.count || 0} kez)`);
    console.log(`  • CSV dosyası: ${csvPath}`);
    console.log(`  • Markdown raporu: ${mdPath}\n`);

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

function generateMarkdownReport(data: {
  totalProducts: number;
  matchedProducts: number;
  keywordFrequency: KeywordFrequency[];
  categoryDistribution: CategoryDistribution[];
  fieldDistribution: Array<{ field: string; count: number }>;
  sampleProducts: SmartProduct[];
}): string {
  const lines: string[] = [];

  lines.push("# Smart Products Detective Report");
  lines.push("");
  lines.push(`**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}`);
  lines.push("");

  // Evidence
  lines.push("## Evidence (Schema Alanları)");
  lines.push("");
  lines.push("### Products Tablosu");
  lines.push("- **slug**: `slug`");
  lines.push("- **name**: `name`");
  lines.push("- **description**: `description`");
  lines.push("- **short_description**: `short_description`");
  lines.push("- **price**: `price` (kuruş cinsinden)");
  lines.push("- **regular_price**: `regular_price` (kuruş cinsinden)");
  lines.push("- **sale_price**: `sale_price` (kuruş cinsinden)");
  lines.push("- **status**: `status`");
  lines.push("- **stock_status**: `stock_status`");
  lines.push("");
  lines.push("### Categories Tablosu");
  lines.push("- **id**: `id`");
  lines.push("- **slug**: `slug`");
  lines.push("- **wc_id**: `wc_id`");
  lines.push("- **parent_wc_id**: `parent_wc_id`");
  lines.push("");
  lines.push("### Product Categories Tablosu");
  lines.push("- **product_id**: `product_id`");
  lines.push("- **category_id**: `category_id`");
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Toplam Ürün Sayısı:** ${data.totalProducts}`);
  lines.push(`- **Eşleşen Ürün Sayısı:** ${data.matchedProducts}`);
  lines.push(`- **Eşleşme Oranı:** ${((data.matchedProducts / data.totalProducts) * 100).toFixed(2)}%`);
  lines.push("");

  // Keyword Frequency
  lines.push("## Keyword Frequency");
  lines.push("");
  lines.push("| Keyword | Count |");
  lines.push("|---------|-------|");
  for (const kf of data.keywordFrequency.slice(0, 30)) {
    const keyword = kf.keyword.replace(/\|/g, "\\|");
    lines.push(`| ${keyword} | ${kf.count} |`);
  }
  if (data.keywordFrequency.length > 30) {
    lines.push(`| ... | ... |`);
    lines.push(`| *Toplam ${data.keywordFrequency.length} farklı keyword* | |`);
  }
  lines.push("");

  // Field Distribution
  lines.push("## Field Distribution (Eşleşme Alanları)");
  lines.push("");
  lines.push("| Field | Count |");
  lines.push("|-------|-------|");
  for (const fd of data.fieldDistribution) {
    lines.push(`| ${fd.field} | ${fd.count} |`);
  }
  lines.push("");

  // Category Distribution
  lines.push("## Category Distribution (Top 20)");
  lines.push("");
  lines.push("| Category Slug | Count |");
  lines.push("|---------------|-------|");
  for (const cd of data.categoryDistribution) {
    const slug = cd.categorySlug.replace(/\|/g, "\\|");
    lines.push(`| ${slug} | ${cd.count} |`);
  }
  lines.push("");

  // Sample Products
  lines.push("## Sample Products (İlk 10)");
  lines.push("");
  for (let i = 0; i < data.sampleProducts.length; i++) {
    const product = data.sampleProducts[i];
    lines.push(`### ${i + 1}. ${product.productName}`);
    lines.push("");
    lines.push(`- **Slug:** \`${product.productSlug}\``);
    lines.push(`- **Price:** ${product.price !== null ? product.price / 100 + " TL" : "N/A"}`);
    lines.push(`- **Status:** ${product.status}`);
    lines.push(`- **Categories:** ${product.categorySlugs.join(", ") || "N/A"}`);
    lines.push(`- **Matched Keywords:** ${product.matchedKeywords.join(", ")}`);
    lines.push(`- **Matched Fields:** ${product.matchedFields.join(", ")}`);
    lines.push(`- **Heuristic Tags:** ${product.heuristicTags.join(", ") || "N/A"}`);
    lines.push(`- **Snippet:** ${product.snippet}`);
    lines.push("");
  }

  // Notes
  lines.push("## Notes");
  lines.push("");
  lines.push("- Bu rapor READ-ONLY bir keşif raporudur. Veritabanında hiçbir değişiklik yapılmamıştır.");
  lines.push("- Fiyatlar kuruş cinsinden gösterilmiştir (TL * 100).");
  lines.push("- Heuristic tag'ler sadece rapor amaçlıdır ve veritabanına yazılmamıştır.");
  lines.push("- False positive olabilecek kelimeler:");
  lines.push("  - 'smart' kelimesi genel bir sıfat olarak kullanılmış olabilir");
  lines.push("  - 'app' kelimesi 'application' anlamında değil, başka bir bağlamda geçmiş olabilir");
  lines.push("  - 'kontrol' kelimesi 'kontrol edilebilir' anlamında değil, 'kontrol altında' gibi başka anlamda kullanılmış olabilir");
  lines.push("");
  lines.push("Detaylı liste için `smart-detective-products.csv` dosyasına bakın.");
  lines.push("");

  return lines.join("\n");
}

// Script'i çalıştır
main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
