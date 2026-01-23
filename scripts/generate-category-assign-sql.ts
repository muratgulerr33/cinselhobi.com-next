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

// CSV parse fonksiyonu (basit, header ile)
function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return [];
  }

  // Header'ı parse et
  const headerLine = lines[0];
  const headers: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      headers.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  headers.push(current.trim());

  // Data satırlarını parse et
  const rows: Array<Record<string, string>> = [];
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const values: string[] = [];
    current = "";
    inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }
  }

  return rows;
}

// Typo fix'ler
const TYPO_FIXES: Record<string, string> = {
  "feti-ve-fantezi": "fetis-ve-fantezi",
  "dildoalar": "dildolar",
  "vibratrler": "vibratorler",
  "klflar": "kiliflar",
  "rnler": "urunler",
  "mastrbatrler": "masturbatorler",
  "anal-sex-oyuncak": "anal-oyuncaklar",
};

// Türkçe slugify fonksiyonu
function turkishSlugify(text: string): string {
  let slug = text
    .toLowerCase()
    .trim()
    // Türkçe karakterleri değiştir
    .replace(/ç/g, "c")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    // Boşlukları tire yap
    .replace(/\s+/g, "-")
    // Noktalama işaretlerini sil (tire hariç)
    .replace(/[^\w\-]/g, "")
    // Birden fazla tireyi tek tire yap
    .replace(/-+/g, "-")
    // Başta ve sonda tire varsa kaldır
    .replace(/^-+|-+$/g, "");

  // Özel fix'ler
  slug = slug.replace(/realistikmankenler/g, "realistik-mankenler");
  slug = slug.replace(/realistikviratorler/g, "realistik-vibratorler");

  return slug;
}

// Slug'dan suffix kırpma (-[a-z0-9]{5} pattern)
function trimSuffix(slug: string): string {
  return slug.replace(/-[a-z0-9]{5}$/i, "");
}

// Kategori slug normalizasyonu
function normalizeCategorySlug(slug: string): string {
  // Suffix kırp
  let normalized = trimSuffix(slug);
  // Typo fix'ler
  normalized = TYPO_FIXES[normalized] || normalized;
  return normalized;
}

// Final category slugs hesaplama
function calculateFinalCategorySlugs(
  audit: string,
  hedefKategoriSlug: string
): { slugs: string[]; notes: string } {
  const auditLower = audit.toLowerCase().trim();

  if (auditLower === "doğru") {
    // hedef_kategori_slug(cursor) normalize et
    const normalized = normalizeCategorySlug(hedefKategoriSlug);
    return { slugs: [normalized], notes: "audit: doğru" };
  }

  if (auditLower.startsWith("yanlış")) {
    // "yanlış"tan sonrasını al
    const afterYanlis = audit.substring(audit.indexOf("yanlış") + "yanlış".length).trim();
    // "/" ile ayrılmış kategorileri al
    const parts = afterYanlis
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const slugs: string[] = [];
    for (const part of parts) {
      // Türkçe slugify yap
      const slug = turkishSlugify(part);
      if (slug.length > 0) {
        slugs.push(slug);
      }
    }

    return {
      slugs: slugs.length > 0 ? slugs : [],
      notes: `audit: yanlış -> ${afterYanlis}`,
    };
  }

  // Bilinmeyen audit değeri
  return { slugs: [], notes: `audit: bilinmeyen (${audit})` };
}

async function main() {
  console.log("🚀 Kategori atama SQL üretimi başlatılıyor...\n");

  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }

  // 1. CSV dosyalarını oku
  console.log("📂 CSV dosyaları okunuyor...");
  const categoryFinalPath = join(process.cwd(), "CATEGORY_final.csv");
  const sourceOnlyPath = join(OUTPUT_DIR, "source-only-final.csv");

  const categoryFinalContent = await readFile(categoryFinalPath, "utf-8");
  const sourceOnlyContent = await readFile(sourceOnlyPath, "utf-8");

  const categoryFinalRows = parseCsv(categoryFinalContent);
  const sourceOnlyRows = parseCsv(sourceOnlyContent);

  console.log(`  ✅ CATEGORY_final.csv: ${categoryFinalRows.length} satır`);
  console.log(`  ✅ source-only-final.csv: ${sourceOnlyRows.length} satır\n`);

  // source-only-final.csv'den slug listesi çıkar (source_slug kolonu)
  const sourceOnlySlugs = new Set(
    sourceOnlyRows.map((row) => row["source_slug"] || row["slug"] || "").filter((s) => s.length > 0)
  );

  // 2. Final category slugs hesapla
  console.log("🔍 Final category slugs hesaplanıyor...");
  interface ProductCategoryAssignment {
    slug: string;
    name: string;
    finalCategorySlugs: string[];
    notes: string;
  }

  const assignments: ProductCategoryAssignment[] = [];
  const allCategorySlugs = new Set<string>();

  for (const row of categoryFinalRows) {
    const slug = row["slug"] || "";
    const name = row["name"] || "";
    const audit = row["audit (manuel kontrol)"] || row["audit"] || "";
    const hedefKategoriSlug = row["hedef_kategori_slug(cursor)"] || row["hedef_kategori_slug"] || "";

    if (!slug) {
      continue;
    }

    const { slugs, notes } = calculateFinalCategorySlugs(audit, hedefKategoriSlug);
    slugs.forEach((s) => allCategorySlugs.add(s));

    assignments.push({
      slug,
      name,
      finalCategorySlugs: slugs,
      notes,
    });
  }

  console.log(`  ✅ ${assignments.length} ürün işlendi`);
  console.log(`  ✅ ${allCategorySlugs.size} benzersiz kategori slug bulundu\n`);

  // 3. DB doğrulamaları
  console.log("🔍 DB doğrulamaları yapılıyor...");
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 3.1. Category slug'larını kontrol et
    const categorySlugsArray = Array.from(allCategorySlugs);
    if (categorySlugsArray.length === 0) {
      console.error("  ❌ HATA: Hiç kategori slug bulunamadı!");
      process.exit(1);
    }

    const categoryPlaceholders = categorySlugsArray.map((_, i) => `$${i + 1}`).join(",");
    const categoryCheckQuery = `
      SELECT slug, id
      FROM categories
      WHERE slug IN (${categoryPlaceholders})
    `;
    const categoryCheckResult = await pool.query(categoryCheckQuery, categorySlugsArray);

    const foundCategorySlugs = new Set(categoryCheckResult.rows.map((r) => r.slug));
    const missingCategorySlugs = categorySlugsArray.filter((s) => !foundCategorySlugs.has(s));

    if (missingCategorySlugs.length > 0) {
      console.error("  ❌ HATA: Eksik kategori slug'ları bulundu:");
      for (const missing of missingCategorySlugs) {
        console.error(`     - ${missing}`);
      }
      process.exit(1);
    }

    console.log(`  ✅ Tüm kategori slug'ları DB'de mevcut (${categorySlugsArray.length} kategori)\n`);

    // 3.2. Product slug'larını kontrol et
    const productSlugsArray = Array.from(sourceOnlySlugs);
    if (productSlugsArray.length === 0) {
      console.error("  ❌ HATA: Hiç ürün slug bulunamadı!");
      process.exit(1);
    }

    const productPlaceholders = productSlugsArray.map((_, i) => `$${i + 1}`).join(",");
    const productCheckQuery = `
      SELECT slug, id
      FROM products
      WHERE slug IN (${productPlaceholders})
    `;
    const productCheckResult = await pool.query(productCheckQuery, productSlugsArray);

    const foundProductSlugs = new Set(productCheckResult.rows.map((r) => r.slug));
    const missingProductSlugs = productSlugsArray.filter((s) => !foundProductSlugs.has(s));

    if (missingProductSlugs.length > 0) {
      console.error("  ❌ HATA: Eksik ürün slug'ları bulundu:");
      for (const missing of missingProductSlugs) {
        console.error(`     - ${missing}`);
      }
      process.exit(1);
    }

    console.log(`  ✅ Tüm ürün slug'ları DB'de mevcut (${productSlugsArray.length} ürün)\n`);

    // 3.3. Diff kontrolü (CATEGORY_final.csv 56 satırsa source-only ile diff)
    if (categoryFinalRows.length === 56 && sourceOnlySlugs.size !== 58) {
      console.log("  ⚠️  UYARI: CATEGORY_final.csv 56 satır, source-only-final.csv farklı sayıda slug içeriyor:");
      console.log(`     - CATEGORY_final.csv: ${categoryFinalRows.length} satır`);
      console.log(`     - source-only-final.csv: ${sourceOnlySlugs.size} slug\n`);

      // CATEGORY_final.csv'deki slug'ları al
      const categoryFinalSlugs = new Set(
        categoryFinalRows.map((row) => row["slug"] || "").filter((s) => s.length > 0)
      );

      // source-only'de olup category-final'de olmayanlar
      const inSourceOnlyNotInFinal = Array.from(sourceOnlySlugs).filter((s) => !categoryFinalSlugs.has(s));
      if (inSourceOnlyNotInFinal.length > 0) {
        console.log("     - source-only'de olup category-final'de olmayanlar:");
        for (const slug of inSourceOnlyNotInFinal) {
          console.log(`       - ${slug}`);
        }
      }

      // category-final'de olup source-only'de olmayanlar
      const inFinalNotInSourceOnly = Array.from(categoryFinalSlugs).filter((s) => !sourceOnlySlugs.has(s));
      if (inFinalNotInSourceOnly.length > 0) {
        console.log("     - category-final'de olup source-only'de olmayanlar:");
        for (const slug of inFinalNotInSourceOnly) {
          console.log(`       - ${slug}`);
        }
      }
      console.log();
    }

    // 4. Preview CSV oluştur
    console.log("📝 Preview CSV oluşturuluyor...");
    const previewLines: string[] = [];
    previewLines.push(["slug", "name", "final_category_slugs", "notes"].map(escapeCsv).join(","));

    for (const assignment of assignments) {
      previewLines.push(
        [
          assignment.slug,
          assignment.name,
          assignment.finalCategorySlugs.join(" / "),
          assignment.notes,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    const previewPath = join(OUTPUT_DIR, "category-assign-preview.csv");
    await writeFile(previewPath, previewLines.join("\n"), "utf-8");
    console.log(`  ✅ ${previewPath}\n`);

    // 5. SQL üretimi
    console.log("📝 SQL dosyaları oluşturuluyor...");

    // Product-category eşleştirmelerini hazırla
    const productCategoryPairs: Array<{ productSlug: string; categorySlug: string }> = [];
    for (const assignment of assignments) {
      for (const categorySlug of assignment.finalCategorySlugs) {
        productCategoryPairs.push({
          productSlug: assignment.slug,
          categorySlug,
        });
      }
    }

    if (productCategoryPairs.length === 0) {
      console.error("  ❌ HATA: Hiç product-category eşleştirmesi bulunamadı!");
      process.exit(1);
    }

    // SQL escape fonksiyonu (single quote escape)
    function sqlEscape(str: string): string {
      return `'${str.replace(/'/g, "''")}'`;
    }

    // VALUES clause oluştur (literal değerler)
    const valuesClause = productCategoryPairs
      .map((pair) => {
        return `(${sqlEscape(pair.productSlug)}, ${sqlEscape(pair.categorySlug)})`;
      })
      .join(",\n    ");

    // INSERT SQL
    const insertSql = `
INSERT INTO product_categories (product_id, category_id)
SELECT p.id, c.id
FROM (VALUES
    ${valuesClause}
) v(product_slug, category_slug)
JOIN products p ON p.slug = v.product_slug
JOIN categories c ON c.slug = v.category_slug
LEFT JOIN product_categories pc ON pc.product_id = p.id AND pc.category_id = c.id
WHERE pc.product_id IS NULL;
`;

    // Plan SQL (ROLLBACK)
    const planSql = `-- Kategori atama plan SQL (ROLLBACK)
-- Oluşturulma: ${new Date().toISOString()}
-- Toplam eşleştirme: ${productCategoryPairs.length}

BEGIN;

${insertSql}

-- Eklenen kayıt sayısını kontrol et
SELECT COUNT(*) as inserted_count
FROM product_categories pc
WHERE EXISTS (
  SELECT 1
  FROM (VALUES
    ${valuesClause}
  ) v(product_slug, category_slug)
  JOIN products p ON p.slug = v.product_slug
  JOIN categories c ON c.slug = v.category_slug
  WHERE pc.product_id = p.id AND pc.category_id = c.id
);

ROLLBACK;
`;

    // Apply SQL (COMMIT)
    const applySql = `-- Kategori atama apply SQL (COMMIT)
-- Oluşturulma: ${new Date().toISOString()}
-- Toplam eşleştirme: ${productCategoryPairs.length}

BEGIN;

${insertSql}

-- Eklenen kayıt sayısını kontrol et
SELECT COUNT(*) as inserted_count
FROM product_categories pc
WHERE EXISTS (
  SELECT 1
  FROM (VALUES
    ${valuesClause}
  ) v(product_slug, category_slug)
  JOIN products p ON p.slug = v.product_slug
  JOIN categories c ON c.slug = v.category_slug
  WHERE pc.product_id = p.id AND pc.category_id = c.id
);

COMMIT;
`;

    // SQL dosyalarını kaydet
    const planPath = join(OUTPUT_DIR, "category-assign-plan.sql");
    const applyPath = join(OUTPUT_DIR, "category-assign-apply.sql");

    await writeFile(planPath, planSql, "utf-8");
    await writeFile(applyPath, applySql, "utf-8");

    console.log(`  ✅ ${planPath}`);
    console.log(`  ✅ ${applyPath}\n`);

    // Özet
    console.log("✨ SQL üretimi tamamlandı!\n");
    console.log("📊 Özet:");
    console.log(`   - İşlenen ürün sayısı: ${assignments.length}`);
    console.log(`   - Toplam kategori eşleştirmesi: ${productCategoryPairs.length}`);
    console.log(`   - Benzersiz kategori sayısı: ${allCategorySlugs.size}`);
    console.log(`\n💾 Dosyalar:`);
    console.log(`   - ${previewPath}`);
    console.log(`   - ${planPath}`);
    console.log(`   - ${applyPath}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
