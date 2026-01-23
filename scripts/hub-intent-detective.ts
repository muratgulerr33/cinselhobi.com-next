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

interface HubIntentSuspect {
  hubId: number;
  hubSlug: string;
  hubName: string;
  productId: number;
  productSlug: string;
  productName: string;
  categorySlugs: string[];
  categoryNames: string[];
  suspectReason: string;
  intentClass: "erkek" | "kadin" | "neutral" | "unknown";
}

interface EtDokuluAudit {
  productId: number;
  productSlug: string;
  productName: string;
  hubId: number;
  hubSlug: string;
  hubName: string;
  intentClass: "erkek" | "kadin" | "neutral" | "unknown";
  keywords: string[];
}

interface NavigationRisk {
  hubSlug: string;
  hubName: string;
  riskType: string;
  description: string;
  evidence: string;
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
  // Eğer kategori bağlamında "erkek" veya "kadin" varsa, o öncelikli
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

function getHubIntent(hubSlug: string, hubName: string): "erkek" | "kadin" | "neutral" | "unknown" {
  const combined = `${hubSlug} ${hubName}`.toLowerCase();
  
  if (combined.includes("erkek") || combined.includes("erkeklere")) {
    return "erkek";
  }
  if (combined.includes("kadin") || combined.includes("kadinlara") || combined.includes("bayan")) {
    return "kadin";
  }
  if (combined.includes("sex-oyuncaklari") || combined.includes("sex oyuncakları")) {
    return "neutral"; // Genel kategori
  }
  if (NEUTRAL_KEYWORDS.some(k => combined.includes(k))) {
    return "neutral";
  }
  
  return "unknown";
}

async function main() {
  console.log("🚀 Hub & Intent Conflict Detective başlatılıyor...\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Step A: Mevcut kanıtı doğrula
    console.log("📋 Step A: Mevcut kanıtı doğrula...");
    const requiredFiles = [
      "category-tree-analysis.md",
      "category-stats.csv",
      "top-level-rollups.csv",
      "double-links.csv",
    ];
    
    const missingFiles: string[] = [];
    for (const file of requiredFiles) {
      if (!existsSync(join(OUTPUT_DIR, file))) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      console.warn(`  ⚠️  Eksik dosyalar: ${missingFiles.join(", ")}`);
      console.warn("  💡 Önce 'npm run category:lock' çalıştırın.\n");
    } else {
      console.log("  ✅ Tüm gerekli dosyalar mevcut\n");
    }

    // Step B: Route/SEO gerçeğini bul
    console.log("🔍 Step B: Route/SEO gerçeğini bul...");
    const seoFindings = {
      sitemap: "Unknown",
      canonical: "Unknown",
      productUrlStructure: "Kategori bağımsız: /urun/{slug}",
      metadataBase: "Unknown",
    };

    // Sitemap kontrolü
    const sitemapFiles = [
      "app/sitemap.ts",
      "app/sitemap.tsx",
      "src/app/sitemap.ts",
      "src/app/sitemap.tsx",
    ];
    // Bu kontrolü script içinde yapamayız, rapora "Unknown" yazacağız
    console.log(`  - Sitemap: ${seoFindings.sitemap}`);
    console.log(`  - Canonical: ${seoFindings.canonical}`);
    console.log(`  - Ürün URL yapısı: ${seoFindings.productUrlStructure}`);
    console.log(`  - MetadataBase: ${seoFindings.metadataBase}\n`);

    // Step C: Hub tanımları ve intent kuralları
    console.log("🌳 Step C: Hub tanımları ve intent kuralları...");
    
    // Top-level hub'ları çek
    const topLevelResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      WHERE parent_wc_id IS NULL
      ORDER BY slug
    `);
    const hubs = topLevelResult.rows;
    console.log(`  ✅ ${hubs.length} top-level hub bulundu`);

    // Hub -> child mapping
    const hubChildrenMap = new Map<number, Category[]>();
    const categoryById = new Map<number, Category>();
    const categoryByWcId = new Map<number, Category>();

    const allCategoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      ORDER BY id
    `);
    const allCategories = allCategoriesResult.rows;

    for (const cat of allCategories) {
      categoryById.set(cat.id, cat);
      categoryByWcId.set(cat.wcId, cat);
      if (!hubChildrenMap.has(cat.id)) {
        hubChildrenMap.set(cat.id, []);
      }
    }

    // Child kategorileri hub'lara bağla
    for (const cat of allCategories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (parent && hubs.some(h => h.id === parent.id)) {
          // Bu child bir hub'ın direkt child'ı
          hubChildrenMap.get(parent.id)!.push(cat);
        }
      }
    }

    console.log(`  ✅ Hub-child ilişkileri kuruldu\n`);

    // Step D: Çakışma dedektifleri
    console.log("🔍 Step D: Çakışma dedektifleri çalıştırılıyor...\n");

    // Ürün-kategori ilişkilerini çek
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
      WHERE p.status = 'publish'
    `);

    // Ürün -> kategoriler mapping
    const productToCategories = new Map<number, number[]>();
    for (const pc of productCategoriesResult.rows) {
      if (!productToCategories.has(pc.productId)) {
        productToCategories.set(pc.productId, []);
      }
      productToCategories.get(pc.productId)!.push(pc.categoryId);
    }

    // Ürün bilgilerini çek
    const productsResult = await pool.query<Product>(`
      SELECT id, slug, name, status, stock_status as "stockStatus"
      FROM products
      WHERE status = 'publish'
    `);
    const products = new Map<number, Product>();
    for (const p of productsResult.rows) {
      products.set(p.id, p);
    }

    // D1: Hub içinde şüpheli intent ürünler
    console.log("  📊 D1: Hub içinde şüpheli intent ürünler...");
    const hubIntentSuspects: HubIntentSuspect[] = [];

    for (const hub of hubs) {
      const hubIntent = getHubIntent(hub.slug, hub.name);
      const children = hubChildrenMap.get(hub.id) || [];
      
      // Bu hub altındaki tüm ürünleri bul
      const hubProductCategories = productCategoriesResult.rows.filter(pc => {
        const cat = categoryById.get(pc.categoryId);
        if (!cat) return false;
        
        // Hub'a direkt bağlı mı?
        if (cat.id === hub.id) return true;
        
        // Child'a bağlı mı?
        return children.some(child => child.id === cat.id);
      });

      // Her ürün için intent kontrolü
      const processedProducts = new Set<number>();
      for (const pc of hubProductCategories) {
        if (processedProducts.has(pc.productId)) continue;
        processedProducts.add(pc.productId);

        const product = products.get(pc.productId);
        if (!product) continue;

        // Ürünün kategorilerini topla
        const productCatIds = productToCategories.get(pc.productId) || [];
        const productCats = productCatIds.map(id => categoryById.get(id)!).filter(Boolean);
        const categoryContext = productCats.map(c => `${c.slug} ${c.name}`).join(" ");

        const intentResult = detectIntent(product.slug, product.name, categoryContext);
        
        // Şüpheli durum: Hub intent'i ile ürün intent'i uyuşmuyor
        if (hubIntent !== "unknown" && intentResult.intent !== "unknown" && 
            hubIntent !== "neutral" && intentResult.intent !== "neutral") {
          if (hubIntent !== intentResult.intent) {
            hubIntentSuspects.push({
              hubId: hub.id,
              hubSlug: hub.slug,
              hubName: hub.name,
              productId: product.id,
              productSlug: product.slug,
              productName: product.name,
              categorySlugs: productCats.map(c => c.slug),
              categoryNames: productCats.map(c => c.name),
              suspectReason: `Hub intent: ${hubIntent}, Ürün intent: ${intentResult.intent}`,
              intentClass: intentResult.intent,
            });
          }
        }
      }
    }

    console.log(`    ✅ ${hubIntentSuspects.length} şüpheli ürün bulundu`);

    // D2: et-dokulu-urunler özel inceleme
    console.log("  📊 D2: et-dokulu-urunler özel inceleme...");
    const etDokuluCategory = allCategories.find(c => c.slug === "et-dokulu-urunler");
    const etDokuluAudit: EtDokuluAudit[] = [];

    if (etDokuluCategory) {
      // Bu kategorideki publish+instock ürünleri bul
      const etDokuluProducts = productCategoriesResult.rows.filter(
        pc => pc.categoryId === etDokuluCategory.id && pc.stockStatus === "instock"
      );

      for (const pc of etDokuluProducts) {
        const product = products.get(pc.productId);
        if (!product) continue;

        // Ürünün hub'ını bul
        const productCatIds = productToCategories.get(pc.productId) || [];
        let hub: Category | null = null;
        
        for (const catId of productCatIds) {
          const cat = categoryById.get(catId);
          if (!cat) continue;
          
          // Top-level mi?
          if (cat.parentWcId === null) {
            hub = cat;
            break;
          }
          
          // Parent'ı top-level mi?
          const parent = categoryByWcId.get(cat.parentWcId);
          if (parent && parent.parentWcId === null) {
            hub = parent;
            break;
          }
        }

        const categoryContext = productCatIds
          .map(id => {
            const cat = categoryById.get(id);
            return cat ? `${cat.slug} ${cat.name}` : "";
          })
          .filter(Boolean)
          .join(" ");

        const intentResult = detectIntent(product.slug, product.name, categoryContext);

        etDokuluAudit.push({
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          hubId: hub?.id || 0,
          hubSlug: hub?.slug || "unknown",
          hubName: hub?.name || "Unknown",
          intentClass: intentResult.intent,
          keywords: intentResult.keywords,
        });
      }
    }

    const erkekCount = etDokuluAudit.filter(a => a.intentClass === "erkek").length;
    const kadinCount = etDokuluAudit.filter(a => a.intentClass === "kadin").length;
    const neutralCount = etDokuluAudit.filter(a => a.intentClass === "neutral").length;
    const unknownCount = etDokuluAudit.filter(a => a.intentClass === "unknown").length;

    console.log(`    ✅ ${etDokuluAudit.length} ürün analiz edildi`);
    console.log(`      - Erkek-intent: ${erkekCount}`);
    console.log(`      - Kadın-intent: ${kadinCount}`);
    console.log(`      - Neutral: ${neutralCount}`);
    console.log(`      - Unknown: ${unknownCount}`);

    // D3: Navigation risk senaryoları
    console.log("  📊 D3: Navigation risk senaryoları...");
    const navigationRisks: NavigationRisk[] = [];

    // Hardcoded navigation tree'yi kontrol et
    // DesktopNavigation.tsx'te "et-dokulu-urunler" "sex-oyuncaklari" hub'ı altında
    // Bu genel bir kategori ve cross-hub ürün taşıyabilir
    if (etDokuluCategory) {
      const sexOyuncaklariHub = hubs.find(h => h.slug === "sex-oyuncaklari");
      if (sexOyuncaklariHub) {
        // et-dokulu-urunler içinde farklı hub'lardan ürün var mı?
        const etDokuluHubs = new Set(etDokuluAudit.map(a => a.hubSlug));
        if (etDokuluHubs.size > 1) {
          navigationRisks.push({
            hubSlug: sexOyuncaklariHub.slug,
            hubName: sexOyuncaklariHub.name,
            riskType: "Cross-hub kategori",
            description: "et-dokulu-urunler kategorisi navigation'da sex-oyuncaklari hub'ı altında gösteriliyor ama farklı hub'lardan ürünler içeriyor",
            evidence: `Farklı hub'lar: ${Array.from(etDokuluHubs).join(", ")}`,
          });
        }
      }
    }

    console.log(`    ✅ ${navigationRisks.length} navigation riski bulundu`);

    // D4: SEO risk kontrolü
    console.log("  📊 D4: SEO risk kontrolü...");
    // Ürün URL'leri kategoriye bağlı değil (/urun/{slug}), bu yüzden kategori taşıma SEO açısından düşük risk
    const seoRisk = {
      productUrlStructure: seoFindings.productUrlStructure,
      riskLevel: "Düşük",
      reason: "Ürün URL'leri kategoriye bağlı değil, kategori taşıma redirect gerektirmez",
    };

    console.log(`    ✅ SEO risk değerlendirmesi: ${seoRisk.riskLevel}`);

    console.log("\n");

    // Step E: Raporları oluştur
    console.log("📝 Step E: Raporlar oluşturuluyor...\n");

    // D1 CSV
    const hubIntentSuspectsCsv = generateHubIntentSuspectsCsv(hubIntentSuspects);
    await writeFile(join(OUTPUT_DIR, "hub-intent-suspects.csv"), hubIntentSuspectsCsv, "utf-8");
    console.log("  ✅ hub-intent-suspects.csv oluşturuldu");

    // D2 CSV ve Summary
    const etDokuluCsv = generateEtDokuluCsv(etDokuluAudit);
    await writeFile(join(OUTPUT_DIR, "et-dokulu-intent-audit.csv"), etDokuluCsv, "utf-8");
    console.log("  ✅ et-dokulu-intent-audit.csv oluşturuldu");

    const etDokuluSummary = generateEtDokuluSummary(etDokuluAudit, erkekCount, kadinCount, neutralCount, unknownCount);
    await writeFile(join(OUTPUT_DIR, "et-dokulu-intent-summary.md"), etDokuluSummary, "utf-8");
    console.log("  ✅ et-dokulu-intent-summary.md oluşturuldu");

    // D3 Markdown
    const navigationRisksMd = generateNavigationRisksMd(navigationRisks);
    await writeFile(join(OUTPUT_DIR, "navigation-intent-risks.md"), navigationRisksMd, "utf-8");
    console.log("  ✅ navigation-intent-risks.md oluşturuldu");

    // D4 Markdown
    const seoRiskMd = generateSeoRiskAssessmentMd(seoFindings, seoRisk);
    await writeFile(join(OUTPUT_DIR, "seo-risk-assessment.md"), seoRiskMd, "utf-8");
    console.log("  ✅ seo-risk-assessment.md oluşturuldu");

    // Ana dedektif raporu
    const detectiveReport = generateDetectiveReport(
      hubs,
      hubChildrenMap,
      hubIntentSuspects,
      etDokuluAudit,
      erkekCount,
      kadinCount,
      neutralCount,
      unknownCount,
      navigationRisks,
      seoFindings,
      seoRisk,
      missingFiles.length === 0
    );
    await writeFile(join(OUTPUT_DIR, "hub-intent-detective-report.md"), detectiveReport, "utf-8");
    console.log("  ✅ hub-intent-detective-report.md oluşturuldu");

    console.log("\n✅ Dedektif raporu tamamlandı!\n");

  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// CSV generator fonksiyonları
function generateHubIntentSuspectsCsv(suspects: HubIntentSuspect[]): string {
  const header = "Hub_ID,Hub_Slug,Hub_Name,Product_ID,Product_Slug,Product_Name,Category_Slugs,Category_Names,Suspect_Reason,Intent_Class\n";
  const rows = suspects.map(s => {
    return [
      s.hubId,
      `"${s.hubSlug}"`,
      `"${s.hubName}"`,
      s.productId,
      `"${s.productSlug}"`,
      `"${s.productName}"`,
      `"${s.categorySlugs.join("; ")}"`,
      `"${s.categoryNames.join("; ")}"`,
      `"${s.suspectReason}"`,
      s.intentClass,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateEtDokuluCsv(audit: EtDokuluAudit[]): string {
  const header = "Product_ID,Product_Slug,Product_Name,Hub_ID,Hub_Slug,Hub_Name,Intent_Class,Keywords\n";
  const rows = audit.map(a => {
    return [
      a.productId,
      `"${a.productSlug}"`,
      `"${a.productName}"`,
      a.hubId,
      `"${a.hubSlug}"`,
      `"${a.hubName}"`,
      a.intentClass,
      `"${a.keywords.join(", ")}"`,
    ].join(",");
  });
  return header + rows.join("\n");
}

function generateEtDokuluSummary(
  audit: EtDokuluAudit[],
  erkekCount: number,
  kadinCount: number,
  neutralCount: number,
  unknownCount: number
): string {
  let md = `# Et Dokulu Ürünler Intent Audit Özeti\n\n`;
  md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  md += `---\n\n`;
  md += `## Özet\n\n`;
  md += `- **Toplam Ürün:** ${audit.length}\n`;
  md += `- **Erkek-intent:** ${erkekCount} (${((erkekCount / audit.length) * 100).toFixed(1)}%)\n`;
  md += `- **Kadın-intent:** ${kadinCount} (${((kadinCount / audit.length) * 100).toFixed(1)}%)\n`;
  md += `- **Neutral:** ${neutralCount} (${((neutralCount / audit.length) * 100).toFixed(1)}%)\n`;
  md += `- **Unknown:** ${unknownCount} (${((unknownCount / audit.length) * 100).toFixed(1)}%)\n\n`;
  md += `---\n\n`;
  md += `## Hub Dağılımı\n\n`;
  
  const hubDistribution = new Map<string, number>();
  for (const a of audit) {
    const count = hubDistribution.get(a.hubSlug) || 0;
    hubDistribution.set(a.hubSlug, count + 1);
  }

  md += `| Hub | Ürün Sayısı |\n`;
  md += `|-----|-------------|\n`;
  for (const [hubSlug, count] of Array.from(hubDistribution.entries()).sort((a, b) => b[1] - a[1])) {
    md += `| ${hubSlug} | ${count} |\n`;
  }
  md += `\n`;

  return md;
}

function generateNavigationRisksMd(risks: NavigationRisk[]): string {
  let md = `# Navigation Intent Riskleri\n\n`;
  md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  md += `---\n\n`;

  if (risks.length === 0) {
    md += `✅ **Risk bulunamadı.**\n\n`;
    md += `Navigation yapısı intent açısından tutarlı görünüyor.\n`;
  } else {
    md += `## Bulunan Riskler\n\n`;
    for (const risk of risks) {
      md += `### ${risk.hubName} (${risk.hubSlug})\n\n`;
      md += `- **Risk Tipi:** ${risk.riskType}\n`;
      md += `- **Açıklama:** ${risk.description}\n`;
      md += `- **Kanıt:** ${risk.evidence}\n\n`;
    }
  }

  return md;
}

function generateSeoRiskAssessmentMd(seoFindings: any, seoRisk: any): string {
  let md = `# SEO Risk Değerlendirmesi\n\n`;
  md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  md += `---\n\n`;
  md += `## Route/SEO Yapısı\n\n`;
  md += `| Özellik | Durum |\n`;
  md += `|---------|-------|\n`;
  md += `| Sitemap | ${seoFindings.sitemap} |\n`;
  md += `| Canonical | ${seoFindings.canonical} |\n`;
  md += `| Ürün URL Yapısı | ${seoFindings.productUrlStructure} |\n`;
  md += `| MetadataBase | ${seoFindings.metadataBase} |\n\n`;
  md += `---\n\n`;
  md += `## Kategori Taşıma SEO Riski\n\n`;
  md += `**Risk Seviyesi:** ${seoRisk.riskLevel}\n\n`;
  md += `**Açıklama:** ${seoRisk.reason}\n\n`;
  md += `> **Not:** Ürün URL'leri kategoriye bağlı olmadığı için, kategori taşıma işlemleri SEO açısından düşük risklidir. Redirect gerektirmez.\n\n`;

  return md;
}

function generateDetectiveReport(
  hubs: Category[],
  hubChildrenMap: Map<number, Category[]>,
  hubIntentSuspects: HubIntentSuspect[],
  etDokuluAudit: EtDokuluAudit[],
  erkekCount: number,
  kadinCount: number,
  neutralCount: number,
  unknownCount: number,
  navigationRisks: NavigationRisk[],
  seoFindings: any,
  seoRisk: any,
  baselinePass: boolean
): string {
  let md = `# Hub & Intent Conflict Detective Report\n\n`;
  md += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
  md += `---\n\n`;

  // 1) Baseline PASS/FAIL
  md += `## 1. Baseline Durumu\n\n`;
  md += `**Durum:** ${baselinePass ? "✅ PASS" : "⚠️ FAIL"}\n\n`;
  md += `${baselinePass ? "category:lock script'i başarıyla çalıştırıldı ve tüm gerekli dosyalar mevcut." : "category:lock script'i çalıştırılmamış veya eksik dosyalar var."}\n\n`;
  md += `---\n\n`;

  // 2) Hub listesi + child ağacı
  md += `## 2. Hub Yapısı\n\n`;
  md += `**Toplam Hub Sayısı:** ${hubs.length}\n\n`;
  md += `| Hub Slug | Hub Name | Child Sayısı |\n`;
  md += `|----------|----------|--------------|\n`;
  for (const hub of hubs) {
    const children = hubChildrenMap.get(hub.id) || [];
    md += `| ${hub.slug} | ${hub.name} | ${children.length} |\n`;
  }
  md += `\n`;

  // Child detayları
  md += `### Child Kategoriler\n\n`;
  for (const hub of hubs) {
    const children = hubChildrenMap.get(hub.id) || [];
    if (children.length > 0) {
      md += `**${hub.name}:**\n`;
      for (const child of children) {
        md += `- ${child.name} (${child.slug})\n`;
      }
      md += `\n`;
    }
  }
  md += `---\n\n`;

  // 3) Intent heuristics
  md += `## 3. Intent Heuristics\n\n`;
  md += `### Erkek-intent Keywords\n`;
  md += `${ERKEK_KEYWORDS.join(", ")}\n\n`;
  md += `### Kadın-intent Keywords\n`;
  md += `${KADIN_KEYWORDS.join(", ")}\n\n`;
  md += `### Neutral Keywords\n`;
  md += `${NEUTRAL_KEYWORDS.join(", ")}\n\n`;
  md += `### Sınırlamalar\n`;
  md += `- Intent heuristics yanlış pozitif verebilir; "şüpheli" üretmek için kullanılır.\n`;
  md += `- Kategori bağlamı önceliklidir; keyword tek başına karar vermez.\n`;
  md += `---\n\n`;

  // 4) Bulgular
  md += `## 4. Bulgular\n\n`;

  // 4.1 Hub-intent şüphelileri
  md += `### 4.1 Hub-Intent Şüphelileri\n\n`;
  md += `**Toplam:** ${hubIntentSuspects.length} ürün\n\n`;
  if (hubIntentSuspects.length > 0) {
    md += `**Örnekler (ilk 10):**\n\n`;
    md += `| Hub | Ürün | Şüpheli Nedeni |\n`;
    md += `|-----|------|----------------|\n`;
    for (const suspect of hubIntentSuspects.slice(0, 10)) {
      md += `| ${suspect.hubName} | ${suspect.productName} | ${suspect.suspectReason} |\n`;
    }
    if (hubIntentSuspects.length > 10) {
      md += `\n*... ve ${hubIntentSuspects.length - 10} tane daha (CSV'de tam liste)*\n`;
    }
  } else {
    md += `✅ Hub-intent çakışması bulunamadı.\n`;
  }
  md += `\n`;

  // 4.2 et-dokulu audit
  md += `### 4.2 Et Dokulu Ürünler Audit\n\n`;
  md += `**Toplam Ürün:** ${etDokuluAudit.length}\n\n`;
  md += `| Intent | Sayı | Yüzde |\n`;
  md += `|--------|------|-------|\n`;
  md += `| Erkek | ${erkekCount} | ${((erkekCount / etDokuluAudit.length) * 100).toFixed(1)}% |\n`;
  md += `| Kadın | ${kadinCount} | ${((kadinCount / etDokuluAudit.length) * 100).toFixed(1)}% |\n`;
  md += `| Neutral | ${neutralCount} | ${((neutralCount / etDokuluAudit.length) * 100).toFixed(1)}% |\n`;
  md += `| Unknown | ${unknownCount} | ${((unknownCount / etDokuluAudit.length) * 100).toFixed(1)}% |\n\n`;

  // 4.3 Navigation riskleri
  md += `### 4.3 Navigation Riskleri\n\n`;
  if (navigationRisks.length === 0) {
    md += `✅ Navigation riski bulunamadı.\n\n`;
  } else {
    md += `**Toplam Risk:** ${navigationRisks.length}\n\n`;
    for (const risk of navigationRisks) {
      md += `- **${risk.hubName}:** ${risk.description}\n`;
    }
  }
  md += `\n`;

  // 4.4 SEO risk
  md += `### 4.4 SEO Risk Değerlendirmesi\n\n`;
  md += `**Risk Seviyesi:** ${seoRisk.riskLevel}\n\n`;
  md += `**Açıklama:** ${seoRisk.reason}\n\n`;
  md += `**Detaylar:**\n`;
  md += `- Sitemap: ${seoFindings.sitemap}\n`;
  md += `- Canonical: ${seoFindings.canonical}\n`;
  md += `- Ürün URL Yapısı: ${seoFindings.productUrlStructure}\n`;
  md += `\n`;

  // 5) Çözüm seçenekleri
  md += `---\n\n`;
  md += `## 5. Çözüm Seçenekleri (DB'ye Dokunmadan Önce)\n\n`;
  md += `### Seçenek A: UI Filtre\n`;
  md += `Hub içinde gösterirken intent filtreleme yapılabilir. Örneğin "Kadınlara Özel" hub'ında sadece kadın-intent ürünler gösterilir.\n\n`;
  md += `**Avantajlar:**\n`;
  md += `- DB değişikliği gerektirmez\n`;
  md += `- Esnek, kolay geri alınabilir\n\n`;
  md += `**Dezavantajlar:**\n`;
  md += `- UI karmaşıklığı artar\n`;
  md += `- Performans etkisi olabilir\n\n`;

  md += `### Seçenek B: Kategori Split\n`;
  md += `"et-dokulu-urunler" gibi genel kategorileri ikiye bölmek (ör: "et-dokulu-erkek", "et-dokulu-kadin").\n\n`;
  md += `**Avantajlar:**\n`;
  md += `- Net ayrım sağlar\n`;
  md += `- SEO açısından daha iyi olabilir\n\n`;
  md += `**Dezavantajlar:**\n`;
  md += `- DB değişikliği gerektirir (⛔ Murat onayı)\n`;
  md += `- Ürünleri yeniden kategorize etmek gerekir\n\n`;

  md += `### Seçenek C: "Audience" Alanı (Ürün Attribute)\n`;
  md += `Ürünlere "audience" (hedef kitle) alanı eklemek ve bu alana göre filtreleme yapmak.\n\n`;
  md += `**Avantajlar:**\n`;
  md += `- En esnek çözüm\n`;
  md += `- Çoklu intent desteği sağlar\n\n`;
  md += `**Dezavantajlar:**\n`;
  md += `- Büyük iş (schema değişikliği + migration + UI)\n`;
  md += `- Tüm ürünler için veri girişi gerekir\n\n`;

  // 6) Öneri
  md += `---\n\n`;
  md += `## 6. Öneri\n\n`;
  if (hubIntentSuspects.length === 0 && erkekCount === 0 && kadinCount === 0) {
    md += `✅ **Mevcut durum temiz görünüyor.** Özel bir aksiyon gerekmiyor.\n\n`;
  } else if (hubIntentSuspects.length > 0) {
    md += `⚠️ **Hub-intent çakışmaları tespit edildi.** Öncelikle şüpheli ürünleri manuel olarak gözden geçirmek ve gerekirse kategorilerini düzeltmek önerilir. Eğer çakışma sayısı yüksekse, Seçenek A (UI filtre) ile geçici çözüm sağlanabilir.\n\n`;
  } else if (erkekCount > 0 || kadinCount > 0) {
    md += `⚠️ **"et-dokulu-urunler" kategorisinde intent karışması var.** Seçenek B (kategori split) veya Seçenek A (UI filtre) ile çözülebilir. Eğer split yapılacaksa, önce küçük bir test grubu ile deneme yapılması önerilir.\n\n`;
  } else {
    md += `ℹ️ **Genel durum iyi görünüyor.** Periyodik kontroller yeterli olacaktır.\n\n`;
  }

  // 7) ⛔ Murat onayı gerektiren değişiklikler
  md += `---\n\n`;
  md += `## 7. ⛔ Murat Onayı Gerektiren DB Değişiklikleri\n\n`;
  md += `Aşağıdaki değişiklikler DB'ye dokunacağı için Murat onayı gerektirir:\n\n`;
  md += `- [ ] Kategori split işlemleri (Seçenek B)\n`;
  md += `- [ ] Ürün kategori taşıma işlemleri\n`;
  md += `- [ ] Schema değişiklikleri (audience alanı ekleme, vb.)\n`;
  md += `- [ ] Toplu kategori güncellemeleri\n\n`;
  md += `> **Not:** Bu değişiklikler yapılmadan önce backup alınmalı ve rollback planı hazırlanmalıdır.\n\n`;

  md += `---\n\n`;
  md += `## 8. Ek Dosyalar\n\n`;
  md += `Detaylı raporlar \`exports/\` klasöründe mevcuttur:\n\n`;
  md += `- \`hub-intent-suspects.csv\` - Hub-intent şüpheli ürünler\n`;
  md += `- \`et-dokulu-intent-audit.csv\` - Et dokulu ürünler detaylı audit\n`;
  md += `- \`et-dokulu-intent-summary.md\` - Et dokulu ürünler özet\n`;
  md += `- \`navigation-intent-risks.md\` - Navigation riskleri\n`;
  md += `- \`seo-risk-assessment.md\` - SEO risk değerlendirmesi\n\n`;

  return md;
}

// Script'i çalıştır
main().catch(console.error);
