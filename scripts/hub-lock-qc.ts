import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir, readFile } from "fs/promises";
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

// CSV escape helper
function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Tip tanımlamaları
interface Category {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
}

interface CategoryWithStats extends Category {
  childrenCount: number;
  totalProducts: number;
  publishProducts: number;
  publishInstockProducts: number;
}

interface HubMappingCandidate {
  uiLabel: string;
  candidateSlug: string;
  categoryName: string;
  isTopLevel: boolean;
  childrenCount: number;
  publishInstockCount: number;
}

interface AppAkilliProduct {
  productSlug: string;
  productName: string;
  status: string;
  stockStatus: string | null;
  price: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  categorySlugs: string[];
}

// Hub kart mapping tanımları
const HUB_MAPPINGS: Array<{ uiLabel: string; patterns: string[] }> = [
  { uiLabel: "Vibratörler", patterns: ["vibrator", "vibratör"] },
  { uiLabel: "Dildolar", patterns: ["dildo"] },
  { uiLabel: "Giyim", patterns: ["giyim"] },
  { uiLabel: "İstek", patterns: ["istek"] },
  { uiLabel: "Geciktiriciler", patterns: ["geciktir"] },
  { uiLabel: "Masturbatorler", patterns: ["masturb"] },
  { uiLabel: "Pompalar", patterns: ["pompa"] },
  { uiLabel: "Mankenler", patterns: ["manken"] },
  { uiLabel: "Prezervatifler", patterns: ["prezerv"] },
  { uiLabel: "Kayganlaştırıcılar", patterns: ["kaygan"] },
  { uiLabel: "Anal Oyuncaklar", patterns: ["anal"] },
  { uiLabel: "Fetis/BDSM", patterns: ["fetis", "bdsm"] },
  { uiLabel: "Et Dokulu", patterns: ["et", "dokulu"] }, // AND condition
];

async function main() {
  console.log("🚀 Hub Lock QC raporu oluşturuluyor...\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  let hasErrors = false;
  const errors: string[] = [];

  try {
    // A) DB keşfi
    console.log("📥 A) DB keşfi yapılıyor...");

    // 1. Top-level kategoriler (parent_wc_id IS NULL) + children_count
    console.log("  - Top-level kategoriler çekiliyor...");
    const topLevelResult = await pool.query<Category & { children_count: number }>(`
      SELECT 
        c.id,
        c.wc_id as "wcId",
        c.slug,
        c.name,
        c.parent_wc_id as "parentWcId",
        COUNT(child.id) as children_count
      FROM categories c
      LEFT JOIN categories child ON child.parent_wc_id = c.wc_id
      WHERE c.parent_wc_id IS NULL
      GROUP BY c.id, c.wc_id, c.slug, c.name, c.parent_wc_id
      ORDER BY c.slug
    `);
    const topLevelCategories = topLevelResult.rows;
    console.log(`    ✅ ${topLevelCategories.length} top-level kategori bulundu`);

    // 2. Tüm kategoriler
    console.log("  - Tüm kategoriler çekiliyor...");
    const allCategoriesResult = await pool.query<Category>(`
      SELECT 
        id,
        wc_id as "wcId",
        slug,
        name,
        parent_wc_id as "parentWcId"
      FROM categories
      ORDER BY slug
    `);
    const allCategories = allCategoriesResult.rows;
    console.log(`    ✅ ${allCategories.length} kategori bulundu`);

    // 3. Her kategori için product count
    console.log("  - Kategori bazlı ürün sayıları hesaplanıyor...");
    const categoryStatsResult = await pool.query<{
      category_id: number;
      total_products: number;
      publish_products: number;
      publish_instock_products: number;
      children_count: number;
    }>(`
      SELECT 
        c.id as category_id,
        COUNT(DISTINCT pc.product_id) as total_products,
        COUNT(DISTINCT CASE WHEN p.status = 'publish' THEN pc.product_id END) as publish_products,
        COUNT(DISTINCT CASE WHEN p.status = 'publish' AND p.stock_status = 'instock' THEN pc.product_id END) as publish_instock_products,
        (SELECT COUNT(*) FROM categories child WHERE child.parent_wc_id = c.wc_id) as children_count
      FROM categories c
      LEFT JOIN product_categories pc ON pc.category_id = c.id
      LEFT JOIN products p ON p.id = pc.product_id
      GROUP BY c.id
    `);
    const categoryStatsMap = new Map(
      categoryStatsResult.rows.map((row) => [
        row.category_id,
        {
          totalProducts: Number(row.total_products),
          publishProducts: Number(row.publish_products),
          publishInstockProducts: Number(row.publish_instock_products),
          childrenCount: Number(row.children_count),
        },
      ])
    );

    const categoriesWithStats: CategoryWithStats[] = allCategories.map((cat) => {
      const stats = categoryStatsMap.get(cat.id) || {
        totalProducts: 0,
        publishProducts: 0,
        publishInstockProducts: 0,
        childrenCount: 0,
      };
      return {
        ...cat,
        ...stats,
      };
    });
    console.log(`    ✅ ${categoriesWithStats.length} kategori için istatistikler hesaplandı\n`);

    // B) Hub kart mapping QC
    console.log("📥 B) Hub kart mapping QC yapılıyor...");
    const hubMappings: HubMappingCandidate[] = [];

    for (const mapping of HUB_MAPPINGS) {
      const { uiLabel, patterns } = mapping;
      console.log(`  - "${uiLabel}" için adaylar aranıyor...`);

      let query: string;
      let params: string[];

      if (uiLabel === "Et Dokulu") {
        // AND condition: hem "et" hem "dokulu" içermeli
        query = `
          SELECT DISTINCT
            c.id,
            c.wc_id as "wcId",
            c.slug,
            c.name,
            c.parent_wc_id as "parentWcId"
          FROM categories c
          WHERE (
            LOWER(c.name) LIKE '%et%' AND LOWER(c.name) LIKE '%dokulu%'
            OR LOWER(c.slug) LIKE '%et%' AND LOWER(c.slug) LIKE '%dokulu%'
          )
          ORDER BY c.slug
        `;
        params = [];
      } else {
        // OR condition: herhangi bir pattern eşleşmeli
        const conditions = patterns
          .map((pattern, idx) => {
            const param = `pattern${idx}`;
            return `(LOWER(c.name) LIKE $${idx + 1} OR LOWER(c.slug) LIKE $${idx + 1})`;
          })
          .join(" OR ");
        query = `
          SELECT DISTINCT
            c.id,
            c.wc_id as "wcId",
            c.slug,
            c.name,
            c.parent_wc_id as "parentWcId"
          FROM categories c
          WHERE ${conditions}
          ORDER BY c.slug
        `;
        params = patterns.map((p) => `%${p}%`);
      }

      const candidatesResult = await pool.query<Category>(query, params);
      const candidates = candidatesResult.rows;

      if (candidates.length === 0) {
        const errorMsg = `⚠️ "${uiLabel}" için hiç aday kategori bulunamadı - NEEDS_MANUAL_DECISION`;
        console.log(`    ${errorMsg}`);
        errors.push(errorMsg);
        hasErrors = true;
      } else {
        console.log(`    ✅ ${candidates.length} aday bulundu`);
        for (const candidate of candidates) {
          const stats = categoryStatsMap.get(candidate.id) || {
            totalProducts: 0,
            publishProducts: 0,
            publishInstockProducts: 0,
            childrenCount: 0,
          };
          hubMappings.push({
            uiLabel,
            candidateSlug: candidate.slug,
            categoryName: candidate.name,
            isTopLevel: candidate.parentWcId === null,
            childrenCount: stats.childrenCount,
            publishInstockCount: stats.publishInstockProducts,
          });
        }
      }
    }
    console.log("");

    // C) "App & Akıllı" QC
    console.log("📥 C) 'App & Akıllı' QC yapılıyor...");
    const smartProductsFile = join(process.cwd(), "old-products", "smart-detective-products.csv");
    let appAkilliProducts: AppAkilliProduct[] = [];

    if (!existsSync(smartProductsFile)) {
      const errorMsg = `⚠️ smart-detective-products.csv dosyası bulunamadı: ${smartProductsFile}`;
      console.log(`  ${errorMsg}`);
      errors.push(errorMsg);
      hasErrors = true;
    } else {
      console.log(`  - ${smartProductsFile} dosyası okunuyor...`);
      const fileContent = await readFile(smartProductsFile, "utf-8");
      const lines = fileContent.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim());

      // product_slug kolonunu bul
      const slugColIndex = headers.findIndex(
        (h) => h.toLowerCase() === "product_slug" || h.toLowerCase() === "slug"
      );

      if (slugColIndex === -1) {
        const errorMsg = `⚠️ CSV dosyasında 'product_slug' veya 'slug' kolonu bulunamadı. Mevcut kolonlar: ${headers.join(", ")}`;
        console.log(`  ${errorMsg}`);
        errors.push(errorMsg);
        hasErrors = true;
      } else {
        // CSV'den slug'ları çıkar
        const productSlugs: string[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          if (values[slugColIndex]) {
            const slug = values[slugColIndex].trim().replace(/^"|"$/g, "");
            if (slug) {
              productSlugs.push(slug);
            }
          }
        }

        console.log(`    ✅ ${productSlugs.length} ürün slug'ı bulundu`);

        if (productSlugs.length === 0) {
          const errorMsg = `⚠️ CSV dosyasında hiç ürün slug'ı bulunamadı`;
          console.log(`  ${errorMsg}`);
          errors.push(errorMsg);
          hasErrors = true;
        } else {
          // DB'den ürün bilgilerini çek
          console.log(`  - DB'den ürün bilgileri çekiliyor...`);
          const placeholders = productSlugs.map((_, idx) => `$${idx + 1}`).join(",");
          const productsResult = await pool.query<{
            slug: string;
            name: string;
            status: string;
            stock_status: string | null;
            price: number | null;
            regular_price: number | null;
            sale_price: number | null;
            category_slugs: string[];
          }>(`
            SELECT 
              p.slug,
              p.name,
              p.status,
              p.stock_status,
              p.price,
              p.regular_price,
              p.sale_price,
              ARRAY_AGG(DISTINCT c.slug) FILTER (WHERE c.slug IS NOT NULL) as category_slugs
            FROM products p
            LEFT JOIN product_categories pc ON pc.product_id = p.id
            LEFT JOIN categories c ON c.id = pc.category_id
            WHERE p.slug = ANY(ARRAY[${placeholders}])
            GROUP BY p.slug, p.name, p.status, p.stock_status, p.price, p.regular_price, p.sale_price
          `, productSlugs);

          appAkilliProducts = productsResult.rows.map((row) => ({
            productSlug: row.slug,
            productName: row.name,
            status: row.status,
            stockStatus: row.stock_status,
            price: row.price,
            regularPrice: row.regular_price,
            salePrice: row.sale_price,
            categorySlugs: row.category_slugs || [],
          }));

          const instockCount = appAkilliProducts.filter(
            (p) => p.status === "publish" && p.stockStatus === "instock"
          ).length;
          console.log(`    ✅ ${appAkilliProducts.length} ürün bulundu (${instockCount} instock)\n`);
        }
      }
    }

    // D) Output dosyaları oluştur
    console.log("📝 D) Output dosyaları oluşturuluyor...");

    // 1. hub-lock-qc.csv
    const csvLines: string[] = [];
    csvLines.push(
      "ui_label,candidate_slug,category_name,is_top_level,children_count,publish_instock_count"
    );
    for (const mapping of hubMappings) {
      csvLines.push(
        [
          escapeCsv(mapping.uiLabel),
          escapeCsv(mapping.candidateSlug),
          escapeCsv(mapping.categoryName),
          mapping.isTopLevel ? "Yes" : "No",
          mapping.childrenCount,
          mapping.publishInstockCount,
        ].join(",")
      );
    }
    const csvPath = join(OUTPUT_DIR, "hub-lock-qc.csv");
    await writeFile(csvPath, csvLines.join("\n"), "utf-8");
    console.log(`  ✅ ${csvPath} oluşturuldu`);

    // 2. hub-lock-qc.app-akilli.csv
    const appCsvLines: string[] = [];
    appCsvLines.push(
      "product_slug,product_name,status,stock_status,price,regular_price,sale_price,category_slugs"
    );
    for (const product of appAkilliProducts) {
      appCsvLines.push(
        [
          escapeCsv(product.productSlug),
          escapeCsv(product.productName),
          escapeCsv(product.status),
          escapeCsv(product.stockStatus),
          product.price !== null ? product.price : "",
          product.regularPrice !== null ? product.regularPrice : "",
          product.salePrice !== null ? product.salePrice : "",
          escapeCsv(product.categorySlugs.join("; ")),
        ].join(",")
      );
    }
    const appCsvPath = join(OUTPUT_DIR, "hub-lock-qc.app-akilli.csv");
    await writeFile(appCsvPath, appCsvLines.join("\n"), "utf-8");
    console.log(`  ✅ ${appCsvPath} oluşturuldu`);

    // 3. hub-lock-qc.md
    const mdLines: string[] = [];
    mdLines.push("# Hub Lock QC Raporu");
    mdLines.push("");
    mdLines.push(`**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}`);
    mdLines.push("");
    mdLines.push("---");
    mdLines.push("");
    mdLines.push("## Özet");
    mdLines.push("");
    mdLines.push("### DB Keşfi");
    mdLines.push(`- **Top-level Kategoriler:** ${topLevelCategories.length}`);
    mdLines.push(`- **Toplam Kategoriler:** ${allCategories.length}`);
    mdLines.push("");
    mdLines.push("### Hub Kart Mapping");
    mdLines.push(`- **Toplam Mapping:** ${hubMappings.length}`);
    mdLines.push(
      `- **Benzersiz UI Label:** ${new Set(hubMappings.map((m) => m.uiLabel)).size}`
    );
    mdLines.push("");
    mdLines.push("### App & Akıllı");
    mdLines.push(`- **Toplam Ürün:** ${appAkilliProducts.length}`);
    const instockCount = appAkilliProducts.filter(
      (p) => p.status === "publish" && p.stockStatus === "instock"
    ).length;
    mdLines.push(`- **Instock Ürün:** ${instockCount}`);
    mdLines.push("");

    // Hatalar varsa göster
    if (errors.length > 0) {
      mdLines.push("## ⚠️ Hatalar ve Manuel Karar Gereken Durumlar");
      mdLines.push("");
      for (const error of errors) {
        mdLines.push(`- ${error}`);
      }
      mdLines.push("");
      mdLines.push("**DUR:** Bu hatalar çözülene kadar işlem devam edemez.");
      mdLines.push("");
    }

    // Hub mapping detayları
    mdLines.push("## Hub Kart Mapping Detayları");
    mdLines.push("");
    mdLines.push("| UI Label | Candidate Slug | Category Name | Top Level | Children | Publish+Instock |");
    mdLines.push("|----------|----------------|---------------|-----------|----------|-----------------|");
    for (const mapping of hubMappings) {
      mdLines.push(
        `| ${mapping.uiLabel} | ${mapping.candidateSlug} | ${mapping.categoryName} | ${
          mapping.isTopLevel ? "Yes" : "No"
        } | ${mapping.childrenCount} | ${mapping.publishInstockCount} |`
      );
    }
    mdLines.push("");

    // Top-level kategoriler özeti
    mdLines.push("## Top-level Kategoriler Özeti");
    mdLines.push("");
    mdLines.push("| Slug | Name | Children Count |");
    mdLines.push("|------|------|---------------|");
    for (const cat of topLevelCategories) {
      mdLines.push(`| ${cat.slug} | ${cat.name} | ${cat.children_count} |`);
    }
    mdLines.push("");

    // App & Akıllı ürünler
    if (appAkilliProducts.length > 0) {
      mdLines.push("## App & Akıllı Ürünler");
      mdLines.push("");
      mdLines.push("| Slug | Name | Status | Stock | Price | Categories |");
      mdLines.push("|------|------|--------|-------|-------|------------|");
      for (const product of appAkilliProducts) {
        mdLines.push(
          `| ${product.productSlug} | ${product.productName} | ${product.status} | ${
            product.stockStatus || "N/A"
          } | ${product.price !== null ? product.price / 100 : "N/A"} | ${product.categorySlugs.join(", ")} |`
        );
      }
      mdLines.push("");
    }

    mdLines.push("## Notlar");
    mdLines.push("");
    mdLines.push("- Bu rapor READ-ONLY modda oluşturulmuştur (DB'de değişiklik yapılmamıştır).");
    mdLines.push("- Detaylı CSV dosyaları için `hub-lock-qc.csv` ve `hub-lock-qc.app-akilli.csv` dosyalarına bakın.");
    mdLines.push("");

    const mdPath = join(OUTPUT_DIR, "hub-lock-qc.md");
    await writeFile(mdPath, mdLines.join("\n"), "utf-8");
    console.log(`  ✅ ${mdPath} oluşturuldu\n`);

    // E) Durma kuralları kontrolü
    if (hasErrors) {
      console.log("=".repeat(60));
      console.log("❌ HATA: Manuel karar gereken durumlar tespit edildi!");
      console.log("=".repeat(60));
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
      console.log("");
      console.log("Lütfen hataları çözün ve tekrar çalıştırın.");
      console.log("");
      await pool.end();
      process.exit(1);
    }

    console.log("=".repeat(60));
    console.log("✅ Hub Lock QC raporu başarıyla oluşturuldu!");
    console.log("=".repeat(60));
    console.log(`📊 Toplam kategori mapping: ${hubMappings.length}`);
    console.log(`📦 App & Akıllı ürün: ${appAkilliProducts.length}`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ HATA:", error instanceof Error ? error.message : String(error));
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Script'i çalıştır
main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
