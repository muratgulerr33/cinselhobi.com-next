import dotenv from "dotenv";
import { writeFile } from "fs/promises";
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

// Varsayılan ürün seti: publish+instock (244), env ile override edilebilir
const PRODUCT_FILTER = process.env.PRODUCT_FILTER || "publish+instock";

// Tip tanımlamaları
interface HubCandidate {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
}

interface ProductRow {
  productSlug: string;
  productName: string;
  currentCategories: string;
  suggestedTopLevel: string;
  finalTopLevelSlug: string; // MANUEL doldurulacak
}

// Ana fonksiyon
async function main() {
  console.log("🚀 HUB kategori adayları ve TOPLEVEL_TODO export scripti başlatılıyor...\n");

  // DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // A) HUB adaylarını kanıtla
    console.log("📥 HUB kategori adayları çekiliyor...");
    
    // 1. Parent NULL olan tüm üst kategoriler
    const topLevelResult = await pool.query<HubCandidate>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      WHERE parent_wc_id IS NULL
      ORDER BY slug
    `);
    const topLevelCategories = topLevelResult.rows;
    console.log(`  ✅ ${topLevelCategories.length} üst kategori (parent NULL) bulundu`);

    // 2. Slug LIKE '%ozel%' filtreli liste
    const ozelResult = await pool.query<HubCandidate>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      WHERE slug LIKE '%ozel%'
      ORDER BY slug
    `);
    const ozelCategories = ozelResult.rows;
    console.log(`  ✅ ${ozelCategories.length} kategori slug'ında 'ozel' geçiyor\n`);

    // HUB adaylarını raporla
    console.log("📋 HUB Candidate Slugs:");
    console.log("  Top-level (parent NULL):");
    for (const cat of topLevelCategories) {
      console.log(`    - ${cat.slug} (${cat.name})`);
    }
    console.log("\n  Slug'da 'ozel' geçen:");
    for (const cat of ozelCategories) {
      console.log(`    - ${cat.slug} (${cat.name})`);
    }
    console.log("");

    // B) Export script - Ürünleri çek
    console.log("📥 Ürünler çekiliyor...");
    
    // Ürün filtreleme sorgusu
    let productFilterQuery = "";
    if (PRODUCT_FILTER === "publish+instock") {
      productFilterQuery = "WHERE p.status = 'publish' AND p.stock_status = 'instock'";
    } else if (PRODUCT_FILTER === "publish") {
      productFilterQuery = "WHERE p.status = 'publish'";
    } else {
      productFilterQuery = ""; // Tüm ürünler
    }

    const productsResult = await pool.query<{
      productSlug: string;
      productName: string;
      categorySlugs: string;
    }>(`
      SELECT 
        p.slug as "productSlug",
        p.name as "productName",
        STRING_AGG(DISTINCT c.slug, ',' ORDER BY c.slug) as "categorySlugs"
      FROM products p
      LEFT JOIN product_categories pc ON pc.product_id = p.id
      LEFT JOIN categories c ON c.id = pc.category_id
      ${productFilterQuery}
      GROUP BY p.id, p.slug, p.name
      ORDER BY p.slug
    `);
    
    const products = productsResult.rows;
    console.log(`  ✅ ${products.length} ürün bulundu (filtre: ${PRODUCT_FILTER})\n`);

    // C) Heuristic - suggested_top_level hesapla
    console.log("🔍 Heuristic ile suggested_top_level hesaplanıyor...");
    
    const productRows: ProductRow[] = products.map((product) => {
      const categorySlugs = product.categorySlugs ? product.categorySlugs.split(",") : [];
      const categorySlugsLower = categorySlugs.map((s) => s.toLowerCase());
      
      let suggestedTopLevel = "none";
      
      // current_categories içinde kontrol
      if (categorySlugsLower.includes("kadinlara-ozel")) {
        suggestedTopLevel = "kadin";
      } else if (categorySlugsLower.includes("erkeklere-ozel")) {
        suggestedTopLevel = "erkek";
      } else {
        // product_name içinde "çift, partner" gibi kelimeler varsa cift
        const productNameLower = product.productName.toLowerCase();
        const coupleKeywords = ["çift", "partner", "cift", "çiftlere", "ciftlere"];
        if (coupleKeywords.some((keyword) => productNameLower.includes(keyword))) {
          suggestedTopLevel = "cift";
        }
      }
      
      return {
        productSlug: product.productSlug,
        productName: product.productName,
        currentCategories: categorySlugs.join(", "),
        suggestedTopLevel,
        finalTopLevelSlug: "", // MANUEL doldurulacak
      };
    });

    console.log(`  ✅ ${productRows.length} ürün için heuristic uygulandı\n`);

    // İstatistikler
    const suggestedStats = {
      kadin: productRows.filter((r) => r.suggestedTopLevel === "kadin").length,
      erkek: productRows.filter((r) => r.suggestedTopLevel === "erkek").length,
      cift: productRows.filter((r) => r.suggestedTopLevel === "cift").length,
      none: productRows.filter((r) => r.suggestedTopLevel === "none").length,
    };

    console.log("📊 Suggested Top Level İstatistikleri:");
    console.log(`  - kadin: ${suggestedStats.kadin}`);
    console.log(`  - erkek: ${suggestedStats.erkek}`);
    console.log(`  - cift: ${suggestedStats.cift}`);
    console.log(`  - none: ${suggestedStats.none}\n`);

    // D) CSV ve MD dosyalarını oluştur
    console.log("📝 Dosyalar oluşturuluyor...");

    // CSV oluştur
    const csvLines: string[] = [];
    csvLines.push("product_slug,product_name,current_categories,suggested_top_level,final_top_level_slug");
    
    for (const row of productRows) {
      // CSV için değerleri escape et
      const escapeCsv = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      
      csvLines.push(
        [
          escapeCsv(row.productSlug),
          escapeCsv(row.productName),
          escapeCsv(row.currentCategories),
          escapeCsv(row.suggestedTopLevel),
          escapeCsv(row.finalTopLevelSlug),
        ].join(",")
      );
    }

    const csvPath = join(process.cwd(), "TOPLEVEL_TODO.csv");
    await writeFile(csvPath, csvLines.join("\n"), "utf-8");
    console.log(`  ✅ ${csvPath} oluşturuldu`);

    // MD oluştur
    const mdLines: string[] = [];
    mdLines.push("# TOPLEVEL_TODO - Manuel Kategori Atama");
    mdLines.push("");
    mdLines.push(`**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}`);
    mdLines.push("");
    mdLines.push("---");
    mdLines.push("");
    mdLines.push("## Kullanım Talimatı");
    mdLines.push("");
    mdLines.push("1. `TOPLEVEL_TODO.csv` dosyasını açın");
    mdLines.push("2. Her ürün için `final_top_level_slug` kolonunu manuel olarak doldurun");
    mdLines.push("3. `suggested_top_level` kolonu sadece bir öneridir, kesin karar `final_top_level_slug` kolonunda verilir");
    mdLines.push("4. Olası değerler:");
    mdLines.push("   - `kadinlara-ozel` - Kadınlara özel ürünler");
    mdLines.push("   - `erkeklere-ozel` - Erkeklere özel ürünler");
    mdLines.push("   - `ciftlere-ozel` - Çiftlere özel ürünler (eğer DB'de varsa)");
    mdLines.push("   - Boş bırakılabilir (üst kategori yok)");
    mdLines.push("");
    mdLines.push("## Özet İstatistikler");
    mdLines.push("");
    mdLines.push("### HUB Kategori Adayları");
    mdLines.push("");
    mdLines.push("#### Top-level Kategoriler (parent NULL)");
    mdLines.push("");
    mdLines.push("| Slug | Name |");
    mdLines.push("|------|------|");
    for (const cat of topLevelCategories) {
      mdLines.push(`| ${cat.slug} | ${cat.name} |`);
    }
    mdLines.push("");
    mdLines.push("#### Slug'da 'ozel' Geçen Kategoriler");
    mdLines.push("");
    mdLines.push("| Slug | Name | Parent WC ID |");
    mdLines.push("|------|------|--------------|");
    for (const cat of ozelCategories) {
      mdLines.push(`| ${cat.slug} | ${cat.name} | ${cat.parentWcId ?? "null"} |`);
    }
    mdLines.push("");
    mdLines.push("### Ürün İstatistikleri");
    mdLines.push("");
    mdLines.push(`- **Toplam Ürün:** ${productRows.length}`);
    mdLines.push(`- **Filtre:** ${PRODUCT_FILTER}`);
    mdLines.push("");
    mdLines.push("### Suggested Top Level Dağılımı");
    mdLines.push("");
    mdLines.push("| Öneri | Sayı |");
    mdLines.push("|-------|------|");
    mdLines.push(`| kadin | ${suggestedStats.kadin} |`);
    mdLines.push(`| erkek | ${suggestedStats.erkek} |`);
    mdLines.push(`| cift | ${suggestedStats.cift} |`);
    mdLines.push(`| none | ${suggestedStats.none} |`);
    mdLines.push("");
    mdLines.push("## Heuristic Açıklaması");
    mdLines.push("");
    mdLines.push("`suggested_top_level` değeri şu kurallara göre hesaplanır:");
    mdLines.push("");
    mdLines.push("1. Eğer ürünün kategorileri arasında `kadinlara-ozel` varsa → **kadin**");
    mdLines.push("2. Eğer ürünün kategorileri arasında `erkeklere-ozel` varsa → **erkek**");
    mdLines.push("3. Eğer ikisi de yoksa:");
    mdLines.push("   - Ürün adında 'çift', 'partner' gibi kelimeler varsa → **cift**");
    mdLines.push("   - Yoksa → **none**");
    mdLines.push("");
    mdLines.push("**Not:** Bu sadece bir öneridir. Kesin karar `final_top_level_slug` kolonunda manuel olarak verilir.");
    mdLines.push("");

    const mdPath = join(process.cwd(), "TOPLEVEL_TODO.md");
    await writeFile(mdPath, mdLines.join("\n"), "utf-8");
    console.log(`  ✅ ${mdPath} oluşturuldu`);

    console.log("\n✅ Export tamamlandı!");
    console.log(`\n📋 Örnek 5 ürün:`);
    for (let i = 0; i < Math.min(5, productRows.length); i++) {
      const row = productRows[i];
      console.log(`  ${i + 1}. ${row.productSlug}`);
      console.log(`     Kategoriler: ${row.currentCategories || "(yok)"}`);
      console.log(`     Öneri: ${row.suggestedTopLevel}`);
    }
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

// Script'i çalıştır
main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
