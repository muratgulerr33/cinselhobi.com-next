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

interface IntentMatrixProduct {
  productId: number;
  productSlug: string;
  productName: string;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  hubSlug: string;
  hubName: string;
  intentClass: "erkek" | "kadin" | "neutral" | "unknown";
  keywords: string[];
}

interface CategoryIntentSummary {
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  hubSlug: string;
  hubName: string;
  totalProducts: number;
  erkekCount: number;
  kadinCount: number;
  neutralCount: number;
  unknownCount: number;
  intentStatus: "pure-erkek" | "pure-kadin" | "mixed" | "neutral" | "unknown";
}

interface KadinHubRisk {
  productId: number;
  productSlug: string;
  productName: string;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  hubSlug: string;
  hubName: string;
  intentClass: "erkek" | "mixed" | "unknown";
  riskReason: string;
}

// Intent heuristics
const ERKEK_KEYWORDS = ["penis", "masturbator", "pompa", "kilif", "halka", "suni-vajina"];
const KADIN_KEYWORDS = ["vibrator", "dildo", "vajina"];
const NEUTRAL_KEYWORDS = ["kayganlastirici", "prezervatif", "geciktirici", "fantezi", "kozmetik"];

function detectIntent(slug: string, name: string, categoryContext: string): {
  intent: "erkek" | "kadin" | "neutral" | "unknown";
  keywords: string[];
} {
  const combined = `${slug} ${name} ${categoryContext}`.toLowerCase();
  const foundKeywords: string[] = [];

  // Erkek intent kontrolü
  for (const keyword of ERKEK_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  // Kadın intent kontrolü
  for (const keyword of KADIN_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  // Neutral kontrolü
  for (const keyword of NEUTRAL_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  // Karar verme: önce kategori bağlamı, sonra keyword'ler
  if (categoryContext.toLowerCase().includes("erkek") || 
      categoryContext.toLowerCase().includes("erkeklere")) {
    return { intent: "erkek", keywords: foundKeywords };
  }
  if (categoryContext.toLowerCase().includes("kadin") || 
      categoryContext.toLowerCase().includes("kadinlara") ||
      categoryContext.toLowerCase().includes("bayan")) {
    return { intent: "kadin", keywords: foundKeywords };
  }

  // Keyword bazlı karar
  const hasErkekKeyword = ERKEK_KEYWORDS.some(k => foundKeywords.includes(k));
  const hasKadinKeyword = KADIN_KEYWORDS.some(k => foundKeywords.includes(k));
  const hasNeutralKeyword = NEUTRAL_KEYWORDS.some(k => foundKeywords.includes(k));

  if (hasErkekKeyword && !hasKadinKeyword) {
    return { intent: "erkek", keywords: foundKeywords };
  }
  if (hasKadinKeyword && !hasErkekKeyword) {
    return { intent: "kadin", keywords: foundKeywords };
  }
  if (hasNeutralKeyword) {
    return { intent: "neutral", keywords: foundKeywords };
  }

  return { intent: "unknown", keywords: foundKeywords };
}

async function main() {
  console.log("🚀 Intent Matrix Detective başlatılıyor...\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Kategorileri çek
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

    // Top-level hub'ları bul
    const hubs = allCategories.filter(c => c.parentWcId === null);
    console.log(`  ✅ ${allCategories.length} kategori, ${hubs.length} hub bulundu\n`);

    // Hub -> child mapping
    const hubChildrenMap = new Map<number, Category[]>();
    for (const hub of hubs) {
      hubChildrenMap.set(hub.id, []);
    }
    for (const cat of allCategories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (parent && hubs.some(h => h.id === parent.id)) {
          hubChildrenMap.get(parent.id)!.push(cat);
        }
      }
    }

    // Kategori -> hub mapping
    const categoryToHub = new Map<number, Category>();
    for (const hub of hubs) {
      categoryToHub.set(hub.id, hub);
      const children = hubChildrenMap.get(hub.id) || [];
      for (const child of children) {
        categoryToHub.set(child.id, hub);
      }
    }

    // Ürün-kategori ilişkilerini çek
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
      WHERE p.status = 'publish' AND p.stock_status = 'instock'
    `);
    console.log(`  ✅ ${productCategoriesResult.rows.length} ürün-kategori ilişkisi bulundu\n`);

    // Intent matrix oluştur
    console.log("🔍 Intent matrix oluşturuluyor...");
    const intentMatrix: IntentMatrixProduct[] = [];

    for (const pc of productCategoriesResult.rows) {
      const category = categoryById.get(pc.categoryId);
      if (!category) continue;

      const hub = categoryToHub.get(pc.categoryId);
      if (!hub) continue;

      // Ürünün diğer kategorilerini topla (bağlam için)
      const productCategories = productCategoriesResult.rows
        .filter(pc2 => pc2.productId === pc.productId)
        .map(pc2 => categoryById.get(pc2.categoryId))
        .filter(Boolean) as Category[];
      
      const categoryContext = productCategories.map(c => `${c.slug} ${c.name}`).join(" ");

      const intentResult = detectIntent(pc.productSlug, pc.productName, categoryContext);

      intentMatrix.push({
        productId: pc.productId,
        productSlug: pc.productSlug,
        productName: pc.productName,
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        hubSlug: hub.slug,
        hubName: hub.name,
        intentClass: intentResult.intent,
        keywords: intentResult.keywords,
      });
    }

    console.log(`  ✅ ${intentMatrix.length} ürün analiz edildi\n`);

    // Kategori bazlı özet oluştur
    console.log("📊 Kategori bazlı özet oluşturuluyor...");
    const categorySummaries = new Map<number, CategoryIntentSummary>();

    for (const item of intentMatrix) {
      if (!categorySummaries.has(item.categoryId)) {
        categorySummaries.set(item.categoryId, {
          categoryId: item.categoryId,
          categorySlug: item.categorySlug,
          categoryName: item.categoryName,
          hubSlug: item.hubSlug,
          hubName: item.hubName,
          totalProducts: 0,
          erkekCount: 0,
          kadinCount: 0,
          neutralCount: 0,
          unknownCount: 0,
          intentStatus: "unknown",
        });
      }

      const summary = categorySummaries.get(item.categoryId)!;
      summary.totalProducts++;
      if (item.intentClass === "erkek") summary.erkekCount++;
      else if (item.intentClass === "kadin") summary.kadinCount++;
      else if (item.intentClass === "neutral") summary.neutralCount++;
      else summary.unknownCount++;
    }

    // Intent status belirleme
    for (const summary of categorySummaries.values()) {
      if (summary.erkekCount > 0 && summary.kadinCount === 0 && summary.neutralCount === 0 && summary.unknownCount === 0) {
        summary.intentStatus = "pure-erkek";
      } else if (summary.kadinCount > 0 && summary.erkekCount === 0 && summary.neutralCount === 0 && summary.unknownCount === 0) {
        summary.intentStatus = "pure-kadin";
      } else if (summary.erkekCount > 0 && summary.kadinCount > 0) {
        summary.intentStatus = "mixed";
      } else if (summary.neutralCount > 0 && summary.erkekCount === 0 && summary.kadinCount === 0) {
        summary.intentStatus = "neutral";
      } else {
        summary.intentStatus = "unknown";
      }
    }

    console.log(`  ✅ ${categorySummaries.size} kategori özeti oluşturuldu\n`);

    // Et Dokulu özel analizi
    console.log("📊 Et Dokulu özel analizi...");
    const etDokuluCategory = allCategories.find(c => c.slug === "et-dokulu-urunler");
    const etDokuluProducts = intentMatrix.filter(item => item.categorySlug === "et-dokulu-urunler");
    console.log(`  ✅ ${etDokuluProducts.length} et-dokulu ürün bulundu\n`);

    // Kadın Hub risk analizi
    console.log("📊 Kadın Hub risk analizi...");
    const kadinHub = hubs.find(h => h.slug === "kadinlara-ozel");
    const kadinHubRisks: KadinHubRisk[] = [];

    if (kadinHub) {
      // Kadın hub'ın child kategorileri
      const kadinHubChildren = hubChildrenMap.get(kadinHub.id) || [];
      const kadinHubCategoryIds = new Set([kadinHub.id, ...kadinHubChildren.map(c => c.id)]);

      // Kadın hub altındaki kategorilerdeki tüm ürünleri bul
      const kadinHubProducts = intentMatrix.filter(item => kadinHubCategoryIds.has(item.categoryId));

      for (const item of kadinHubProducts) {
        // Risk: erkek intent veya mixed kategori
        if (item.intentClass === "erkek") {
          kadinHubRisks.push({
            productId: item.productId,
            productSlug: item.productSlug,
            productName: item.productName,
            categoryId: item.categoryId,
            categorySlug: item.categorySlug,
            categoryName: item.categoryName,
            hubSlug: item.hubSlug,
            hubName: item.hubName,
            intentClass: "erkek",
            riskReason: "Erkek-intent ürün kadın hub'ında",
          });
        } else if (item.intentClass === "unknown") {
          // Mixed kategori kontrolü
          const categorySummary = categorySummaries.get(item.categoryId);
          if (categorySummary && categorySummary.intentStatus === "mixed") {
            kadinHubRisks.push({
              productId: item.productId,
              productSlug: item.productSlug,
              productName: item.productName,
              categoryId: item.categoryId,
              categorySlug: item.categorySlug,
              categoryName: item.categoryName,
              hubSlug: item.hubSlug,
              hubName: item.hubName,
              intentClass: "mixed",
              riskReason: "Mixed intent kategoride unknown intent ürün",
            });
          }
        }
      }
    }

    console.log(`  ✅ ${kadinHubRisks.length} risk bulundu\n`);

    // Raporları oluştur
    console.log("📝 Raporlar oluşturuluyor...\n");

    // 1. intent-matrix-summary.md
    const summaryMd = generateSummaryMarkdown(
      Array.from(categorySummaries.values()),
      etDokuluProducts,
      kadinHubRisks
    );
    await writeFile(join(OUTPUT_DIR, "intent-matrix-summary.md"), summaryMd, "utf-8");
    console.log("  ✅ intent-matrix-summary.md oluşturuldu");

    // 2. intent-matrix-et-dokulu.csv
    const etDokuluCsv = generateEtDokuluCsv(etDokuluProducts);
    await writeFile(join(OUTPUT_DIR, "intent-matrix-et-dokulu.csv"), etDokuluCsv, "utf-8");
    console.log("  ✅ intent-matrix-et-dokulu.csv oluşturuldu");

    // 3. intent-matrix-kadin-hub-risk.csv
    const kadinHubRiskCsv = generateKadinHubRiskCsv(kadinHubRisks);
    await writeFile(join(OUTPUT_DIR, "intent-matrix-kadin-hub-risk.csv"), kadinHubRiskCsv, "utf-8");
    console.log("  ✅ intent-matrix-kadin-hub-risk.csv oluşturuldu");

    console.log("\n✅ Intent Matrix Detective tamamlandı!\n");

  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function generateSummaryMarkdown(
  categorySummaries: CategoryIntentSummary[],
  etDokuluProducts: IntentMatrixProduct[],
  kadinHubRisks: KadinHubRisk[]
): string {
  let md = `# Intent Matrix Summary\n\n`;
  md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  md += `---\n\n`;

  // Kategori Intent Durumu Tablosu
  md += `## 1. Kategori Intent Durumu\n\n`;
  md += `| Kategori | Hub | Intent Status | Toplam | Erkek | Kadın | Neutral | Unknown |\n`;
  md += `|----------|-----|---------------|--------|-------|-------|---------|----------|\n`;
  
  for (const summary of categorySummaries.sort((a, b) => a.categorySlug.localeCompare(b.categorySlug))) {
    md += `| ${summary.categoryName} (${summary.categorySlug}) | ${summary.hubName} | ${summary.intentStatus} | ${summary.totalProducts} | ${summary.erkekCount} | ${summary.kadinCount} | ${summary.neutralCount} | ${summary.unknownCount} |\n`;
  }
  md += `\n`;

  // Safe vs Mixed kategoriler
  md += `## 2. Safe vs Mixed Kategoriler\n\n`;
  const pureKadin = categorySummaries.filter(s => s.intentStatus === "pure-kadin");
  const pureErkek = categorySummaries.filter(s => s.intentStatus === "pure-erkek");
  const mixed = categorySummaries.filter(s => s.intentStatus === "mixed");
  const neutral = categorySummaries.filter(s => s.intentStatus === "neutral");
  const unknown = categorySummaries.filter(s => s.intentStatus === "unknown");

  md += `### Safe Kategoriler (Pure Intent)\n\n`;
  md += `**Pure Kadın:** ${pureKadin.length} kategori\n`;
  for (const s of pureKadin) {
    md += `- ${s.categoryName} (${s.categorySlug}) - ${s.hubName}\n`;
  }
  md += `\n`;

  md += `**Pure Erkek:** ${pureErkek.length} kategori\n`;
  for (const s of pureErkek) {
    md += `- ${s.categoryName} (${s.categorySlug}) - ${s.hubName}\n`;
  }
  md += `\n`;

  md += `### Mixed Kategoriler\n\n`;
  md += `**Toplam:** ${mixed.length} kategori\n\n`;
  for (const s of mixed) {
    md += `- ${s.categoryName} (${s.categorySlug}) - ${s.hubName} (Erkek: ${s.erkekCount}, Kadın: ${s.kadinCount})\n`;
  }
  md += `\n`;

  md += `### Neutral Kategoriler\n\n`;
  md += `**Toplam:** ${neutral.length} kategori\n\n`;
  for (const s of neutral) {
    md += `- ${s.categoryName} (${s.categorySlug}) - ${s.hubName}\n`;
  }
  md += `\n`;

  md += `### Unknown Kategoriler\n\n`;
  md += `**Toplam:** ${unknown.length} kategori\n\n`;
  for (const s of unknown) {
    md += `- ${s.categoryName} (${s.categorySlug}) - ${s.hubName}\n`;
  }
  md += `\n`;

  // Et Dokulu Özet
  md += `---\n\n`;
  md += `## 3. Et Dokulu Ürünler Özeti\n\n`;
  md += `**Toplam Ürün:** ${etDokuluProducts.length}\n\n`;
  
  const etDokuluErkek = etDokuluProducts.filter(p => p.intentClass === "erkek").length;
  const etDokuluKadin = etDokuluProducts.filter(p => p.intentClass === "kadin").length;
  const etDokuluNeutral = etDokuluProducts.filter(p => p.intentClass === "neutral").length;
  const etDokuluUnknown = etDokuluProducts.filter(p => p.intentClass === "unknown").length;

  md += `| Intent | Sayı | Yüzde |\n`;
  md += `|--------|------|-------|\n`;
  md += `| Erkek | ${etDokuluErkek} | ${etDokuluProducts.length > 0 ? ((etDokuluErkek / etDokuluProducts.length) * 100).toFixed(1) : 0}% |\n`;
  md += `| Kadın | ${etDokuluKadin} | ${etDokuluProducts.length > 0 ? ((etDokuluKadin / etDokuluProducts.length) * 100).toFixed(1) : 0}% |\n`;
  md += `| Neutral | ${etDokuluNeutral} | ${etDokuluProducts.length > 0 ? ((etDokuluNeutral / etDokuluProducts.length) * 100).toFixed(1) : 0}% |\n`;
  md += `| Unknown | ${etDokuluUnknown} | ${etDokuluProducts.length > 0 ? ((etDokuluUnknown / etDokuluProducts.length) * 100).toFixed(1) : 0}% |\n\n`;

  // Kadın Hub Risk Özeti
  md += `---\n\n`;
  md += `## 4. Kadın Hub Risk Özeti\n\n`;
  md += `**Toplam Risk:** ${kadinHubRisks.length} ürün\n\n`;
  
  if (kadinHubRisks.length > 0) {
    md += `| Ürün | Kategori | Intent | Risk Nedeni |\n`;
    md += `|------|----------|--------|-------------|\n`;
    for (const risk of kadinHubRisks.slice(0, 20)) {
      md += `| ${risk.productName} (${risk.productSlug}) | ${risk.categoryName} | ${risk.intentClass} | ${risk.riskReason} |\n`;
    }
    if (kadinHubRisks.length > 20) {
      md += `\n*... ve ${kadinHubRisks.length - 20} tane daha (CSV'de tam liste)*\n`;
    }
  } else {
    md += `✅ Kadın hub'da risk bulunamadı.\n`;
  }
  md += `\n`;

  md += `---\n\n`;
  md += `## 5. Guardrail Önerileri\n\n`;
  md += `### Kadın Hub Navigasyon\n\n`;
  md += `**Safe Kategoriler (Gösterilebilir):**\n`;
  for (const s of pureKadin) {
    if (s.hubSlug === "kadinlara-ozel") {
      md += `- ${s.categoryName} (${s.categorySlug})\n`;
    }
  }
  md += `\n`;

  md += `**Mixed/Unknown Kategoriler (Gösterilmemeli veya Filtrelenmeli):**\n`;
  for (const s of [...mixed, ...unknown]) {
    if (s.hubSlug === "kadinlara-ozel") {
      md += `- ${s.categoryName} (${s.categorySlug}) - ${s.intentStatus}\n`;
    }
  }
  md += `\n`;

  md += `### Et Dokulu Ürünler\n\n`;
  md += `**Öneri:** UI filtre (Soft-Split) uygulanmalı:\n`;
  md += `- Kategori sayfasında "Kadın / Erkek / Tümü" filtre chip'leri\n`;
  md += `- Default: Tümü veya Kadın (karar doc'a yazılmalı)\n`;
  md += `\n`;

  return md;
}

function generateEtDokuluCsv(products: IntentMatrixProduct[]): string {
  const header = "Product_ID,Product_Slug,Product_Name,Category_Slug,Category_Name,Hub_Slug,Hub_Name,Intent_Class,Keywords\n";
  const rows = products.map(p => {
    return [
      p.productId,
      `"${p.productSlug}"`,
      `"${p.productName}"`,
      `"${p.categorySlug}"`,
      `"${p.categoryName}"`,
      `"${p.hubSlug}"`,
      `"${p.hubName}"`,
      p.intentClass,
      `"${p.keywords.join(", ")}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateKadinHubRiskCsv(risks: KadinHubRisk[]): string {
  const header = "Product_ID,Product_Slug,Product_Name,Category_ID,Category_Slug,Category_Name,Hub_Slug,Hub_Name,Intent_Class,Risk_Reason\n";
  const rows = risks.map(r => {
    return [
      r.productId,
      `"${r.productSlug}"`,
      `"${r.productName}"`,
      r.categoryId,
      `"${r.categorySlug}"`,
      `"${r.categoryName}"`,
      `"${r.hubSlug}"`,
      `"${r.hubName}"`,
      r.intentClass,
      `"${r.riskReason}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

// Script'i çalıştır
main().catch(console.error);
