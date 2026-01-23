import { Pool } from "pg";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

// CSV parse fonksiyonu
function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.trim().split("\n");
  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  const headers: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      headers.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }
  headers.push(currentField.trim());

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let currentValue = "";
    let inQuotes2 = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes2 && line[j + 1] === '"') {
          currentValue += '"';
          j++;
        } else {
          inQuotes2 = !inQuotes2;
        }
      } else if (char === "," && !inQuotes2) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    const row: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      row[headers[k]] = values[k] || "";
    }
    rows.push(row);
  }

  return rows;
}

interface ProductCategoryInfo {
  productId: number;
  productSlug: string;
  productName: string;
  categories: string[];
  hasSexOyuncaklari: boolean;
  correctCategory: string;
  hasParentCategory: boolean;
}

async function main() {
  console.log("🔍 sex-oyuncaklari fix doğrulaması başlatılıyor...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. CSV'den 35 ürünü oku
    console.log("📥 CSV dosyası okunuyor...");
    const csvPath = join(process.cwd(), "exports", "sex-oyuncaklari.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    const csvRows = parseCsv(csvContent);
    console.log(`  ✅ ${csvRows.length} ürün CSV'den okundu\n`);

    const productSlugs = csvRows.map((row) => row.slug);

    // 2. Backup dosyasından önceki durumu oku (eğer varsa)
    console.log("📥 Backup dosyası kontrol ediliyor...");
    let beforeLinks: Array<{ productId: number; categorySlug: string }> = [];
    const backupPath = join(process.cwd(), "old-products", "backups", "sex-oyuncaklari-35-links-before.csv");
    try {
      const backupContent = readFileSync(backupPath, "utf-8");
      const backupRows = parseCsv(backupContent);
      beforeLinks = backupRows.map((row) => ({
        productId: parseInt(row.product_id, 10),
        categorySlug: row.category_slug,
      }));
      console.log(`  ✅ Backup dosyasından ${beforeLinks.length} link okundu\n`);
    } catch (error) {
      console.log(`  ⚠️  Backup dosyası bulunamadı (normal olabilir)\n`);
    }

    // 3. DB'den 35 ürünün mevcut kategorilerini çek
    console.log("📥 DB'den ürün kategorileri çekiliyor...");
    const productsResult = await pool.query<{
      id: number;
      slug: string;
      name: string;
    }>(`
      SELECT id, slug, name
      FROM products
      WHERE slug = ANY($1::text[])
    `, [productSlugs]);

    const products = productsResult.rows;
    const productById = new Map(products.map((p) => [p.id, p]));
    const productBySlug = new Map(products.map((p) => [p.slug, p]));

    const productIds = products.map((p) => p.id);

    // Kategori linklerini çek
    const linksResult = await pool.query<{
      productId: number;
      categorySlug: string;
      categoryName: string;
    }>(`
      SELECT 
        pc.product_id as "productId",
        c.slug as "categorySlug",
        c.name as "categoryName"
      FROM product_categories pc
      JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = ANY($1::integer[])
      ORDER BY pc.product_id, c.slug
    `, [productIds]);

    const currentLinks = linksResult.rows;
    console.log(`  ✅ ${currentLinks.length} mevcut kategori linki bulundu\n`);

    // 4. Her ürün için kategori bilgilerini topla
    console.log("📊 Ürün kategorileri analiz ediliyor...");
    const productInfos: ProductCategoryInfo[] = [];

    for (const row of csvRows) {
      const product = productBySlug.get(row.slug);
      if (!product) {
        console.warn(`  ⚠️  Ürün bulunamadı: ${row.slug}`);
        continue;
      }

      const categories = row.categories.split(",").map((c) => c.trim());
      const correctCategory = categories.find((c) => c !== "sex-oyuncaklari") || "";

      const productCategories = currentLinks
        .filter((l) => l.productId === product.id)
        .map((l) => l.categorySlug);

      const hasSexOyuncaklari = productCategories.includes("sex-oyuncaklari");

      // Parent kategori kontrolü
      let hasParentCategory = false;
      if (correctCategory === "fetis-fantezi" || correctCategory === "fantezi-giyim") {
        hasParentCategory = productCategories.includes("kadinlara-ozel");
      } else if (
        correctCategory === "suni-vajina-masturbatorler" ||
        correctCategory === "halka-kiliflar" ||
        correctCategory === "sisme-kadinlar"
      ) {
        hasParentCategory = productCategories.includes("erkeklere-ozel");
      } else if (correctCategory === "prezervatifler") {
        hasParentCategory = productCategories.includes("kozmetik");
      }

      productInfos.push({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        categories: productCategories,
        hasSexOyuncaklari,
        correctCategory,
        hasParentCategory,
      });
    }

    console.log(`  ✅ ${productInfos.length} ürün analiz edildi\n`);

    // 5. "sex-oyuncaklari" kategorisindeki toplam ürün sayısını kontrol et
    console.log("📊 'sex-oyuncaklari' kategorisindeki toplam ürün sayısı kontrol ediliyor...");
    const totalSexOyuncaklariResult = await pool.query<{ count: string }>(`
      SELECT COUNT(DISTINCT pc.product_id) as count
      FROM product_categories pc
      JOIN categories c ON c.id = pc.category_id
      WHERE c.slug = 'sex-oyuncaklari'
    `);
    const totalSexOyuncaklariNow = parseInt(totalSexOyuncaklariResult.rows[0].count, 10);

    // Backup'tan önceki toplam sayıyı hesapla (eğer varsa)
    const beforeTotalSexOyuncaklari = beforeLinks.filter((l) => l.categorySlug === "sex-oyuncaklari").length;
    const beforeTotalUnique = new Set(beforeLinks.filter((l) => l.categorySlug === "sex-oyuncaklari").map((l) => l.productId)).size;

    console.log(`  ✅ Şimdiki toplam: ${totalSexOyuncaklariNow} ürün`);
    if (beforeTotalUnique > 0) {
      console.log(`  ✅ Önceki toplam (35 ürün için): ${beforeTotalUnique} ürün`);
      console.log(`  ✅ Fark: ${beforeTotalUnique - 0} ürün kaldırıldı (35 ürün için beklenen: 0)\n`);
    } else {
      console.log(`  ⚠️  Önceki toplam bilgisi yok\n`);
    }

    // 6. 35 ürün içinde kaçında hala sex-oyuncaklari var?
    const stillHasSexOyuncaklari = productInfos.filter((p) => p.hasSexOyuncaklari);
    console.log(`📊 35 ürün içinde hala 'sex-oyuncaklari' olan: ${stillHasSexOyuncaklari.length} ürün`);
    console.log(`   Beklenen: 0 ürün\n`);

    // 7. Parent kategoriler kontrolü
    const needsParent = productInfos.filter(
      (p) =>
        (p.correctCategory === "fetis-fantezi" ||
          p.correctCategory === "fantezi-giyim" ||
          p.correctCategory === "suni-vajina-masturbatorler" ||
          p.correctCategory === "halka-kiliflar" ||
          p.correctCategory === "sisme-kadinlar" ||
          p.correctCategory === "prezervatifler") &&
        !p.hasParentCategory
    );
    console.log(`📊 Parent kategori eksik olan: ${needsParent.length} ürün`);
    console.log(`   Beklenen: 0 ürün\n`);

    // 8. Rapor oluştur
    console.log("📝 Rapor oluşturuluyor...");
    const reportDir = join(process.cwd(), "old-products");
    mkdirSync(reportDir, { recursive: true });
    const reportPath = join(reportDir, "sex-oyuncaklari-35-fix-verification.md");

    let report = `# Doğrulama Raporu: sex-oyuncaklari-35 Fix\n\n`;
    report += `**Tarih:** ${new Date().toISOString()}\n\n`;

    report += `## Özet\n\n`;
    report += `- **CSV'den okunan ürün sayısı:** ${csvRows.length}\n`;
    report += `- **DB'de bulunan ürün sayısı:** ${products.length}\n`;
    report += `- **Hala 'sex-oyuncaklari' kategorisinde olan (35 ürün içinde):** ${stillHasSexOyuncaklari.length} ürün\n`;
    report += `- **Parent kategori eksik olan:** ${needsParent.length} ürün\n\n`;

    report += `## 'sex-oyuncaklari' Kategorisi Toplam Ürün Sayısı\n\n`;
    report += `| Durum | Ürün Sayısı |\n`;
    report += `|-------|-------------|\n`;
    report += `| **Şimdiki toplam** | **${totalSexOyuncaklariNow}** |\n`;
    if (beforeTotalUnique > 0) {
      report += `| Önceki toplam (35 ürün için) | ${beforeTotalUnique} |\n`;
      report += `| **Fark (35 ürün için)** | **${beforeTotalUnique - 0} kaldırıldı** |\n`;
    }
    report += `\n`;

    report += `## 35 Ürün Detaylı Durum\n\n`;
    report += `| Ürün Slug | Doğru Kategori | Mevcut Kategoriler | sex-oyuncaklari? | Parent Var? | Durum |\n`;
    report += `|-----------|----------------|-------------------|------------------|-------------|-------|\n`;

    for (const info of productInfos) {
      const status = [];
      if (info.hasSexOyuncaklari) {
        status.push("❌ sex-oyuncaklari hala var");
      } else {
        status.push("✅ sex-oyuncaklari kaldırıldı");
      }

      if (
        (info.correctCategory === "fetis-fantezi" ||
          info.correctCategory === "fantezi-giyim" ||
          info.correctCategory === "suni-vajina-masturbatorler" ||
          info.correctCategory === "halka-kiliflar" ||
          info.correctCategory === "sisme-kadinlar" ||
          info.correctCategory === "prezervatifler") &&
        !info.hasParentCategory
      ) {
        status.push("❌ parent eksik");
      } else if (info.correctCategory !== "anal-oyuncaklar" && info.correctCategory !== "realistik-mankenler") {
        status.push("✅ parent var");
      }

      const categoriesStr = info.categories.join(", ");
      report += `| ${info.productSlug} | ${info.correctCategory} | ${categoriesStr} | ${info.hasSexOyuncaklari ? "❌ Evet" : "✅ Hayır"} | ${info.hasParentCategory ? "✅" : info.correctCategory === "anal-oyuncaklar" || info.correctCategory === "realistik-mankenler" ? "N/A" : "❌"} | ${status.join(", ")} |\n`;
    }
    report += `\n`;

    if (stillHasSexOyuncaklari.length > 0) {
      report += `## ⚠️ Hala 'sex-oyuncaklari' Kategorisinde Olan Ürünler\n\n`;
      report += `| Ürün Slug | Mevcut Kategoriler |\n`;
      report += `|-----------|-------------------|\n`;
      for (const info of stillHasSexOyuncaklari) {
        report += `| ${info.productSlug} | ${info.categories.join(", ")} |\n`;
      }
      report += `\n`;
    }

    if (needsParent.length > 0) {
      report += `## ⚠️ Parent Kategori Eksik Olan Ürünler\n\n`;
      report += `| Ürün Slug | Doğru Kategori | Beklenen Parent | Mevcut Kategoriler |\n`;
      report += `|-----------|----------------|-----------------|-------------------|\n`;
      for (const info of needsParent) {
        let expectedParent = "";
        if (info.correctCategory === "fetis-fantezi" || info.correctCategory === "fantezi-giyim") {
          expectedParent = "kadinlara-ozel";
        } else if (
          info.correctCategory === "suni-vajina-masturbatorler" ||
          info.correctCategory === "halka-kiliflar" ||
          info.correctCategory === "sisme-kadinlar"
        ) {
          expectedParent = "erkeklere-ozel";
        } else if (info.correctCategory === "prezervatifler") {
          expectedParent = "kozmetik";
        }
        report += `| ${info.productSlug} | ${info.correctCategory} | ${expectedParent} | ${info.categories.join(", ")} |\n`;
      }
      report += `\n`;
    }

    report += `## Sonuç\n\n`;
    if (stillHasSexOyuncaklari.length === 0 && needsParent.length === 0) {
      report += `✅ **Tüm düzeltmeler başarıyla uygulandı!**\n\n`;
      report += `- 35 ürünün hiçbirinde 'sex-oyuncaklari' kategorisi kalmadı\n`;
      report += `- Tüm gerekli parent kategoriler eklendi\n`;
      report += `- 'sex-oyuncaklari' kategorisindeki toplam ürün sayısı: ${totalSexOyuncaklariNow}\n`;
    } else {
      report += `⚠️ **Bazı sorunlar tespit edildi:**\n\n`;
      if (stillHasSexOyuncaklari.length > 0) {
        report += `- ${stillHasSexOyuncaklari.length} ürün hala 'sex-oyuncaklari' kategorisinde\n`;
      }
      if (needsParent.length > 0) {
        report += `- ${needsParent.length} ürün için parent kategori eksik\n`;
      }
    }
    report += `\n`;

    writeFileSync(reportPath, report, "utf-8");
    console.log(`  ✅ Rapor: ${reportPath}\n`);

    // Özet
    console.log("📊 ÖZET:");
    console.log(`   - CSV'den okunan: ${csvRows.length} ürün`);
    console.log(`   - DB'de bulunan: ${products.length} ürün`);
    console.log(`   - Hala 'sex-oyuncaklari' olan (35 içinde): ${stillHasSexOyuncaklari.length} ürün`);
    console.log(`   - Parent eksik olan: ${needsParent.length} ürün`);
    console.log(`   - 'sex-oyuncaklari' toplam ürün sayısı: ${totalSexOyuncaklariNow}`);
    if (stillHasSexOyuncaklari.length > 0) {
      console.log(`\n   ⚠️  Hala 'sex-oyuncaklari' olan ürünler:`);
      for (const info of stillHasSexOyuncaklari) {
        console.log(`      - ${info.productSlug}`);
      }
    }
    if (needsParent.length > 0) {
      console.log(`\n   ⚠️  Parent eksik olan ürünler:`);
      for (const info of needsParent) {
        console.log(`      - ${info.productSlug} (beklenen parent: ${info.correctCategory === "fetis-fantezi" || info.correctCategory === "fantezi-giyim" ? "kadinlara-ozel" : info.correctCategory === "suni-vajina-masturbatorler" || info.correctCategory === "halka-kiliflar" || info.correctCategory === "sisme-kadinlar" ? "erkeklere-ozel" : "kozmetik"})`);
      }
    }
    console.log(`\n✅ Doğrulama tamamlandı!`);
    console.log(`   Rapor: ${reportPath}\n`);

  } catch (error) {
    console.error("❌ Hata:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
