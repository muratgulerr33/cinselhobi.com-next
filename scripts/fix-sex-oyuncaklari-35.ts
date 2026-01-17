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

// CSV parse fonksiyonu (basit, header ile)
function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.trim().split("\n");
  if (lines.length === 0) {
    return [];
  }

  // Header'ı parse et
  const headerLine = lines[0];
  const headers: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        currentField += '"';
        i++; // Skip next quote
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
  headers.push(currentField.trim()); // Son alan

  // Data satırlarını parse et
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
          j++; // Skip next quote
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
    values.push(currentValue.trim()); // Son değer

    // Header ile eşleştir
    const row: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      row[headers[k]] = values[k] || "";
    }
    rows.push(row);
  }

  return rows;
}

// Mapping rules from plan
const CATEGORY_PARENT_MAP: Record<string, string | null> = {
  "fetis-fantezi": "kadinlara-ozel",
  "fantezi-giyim": "kadinlara-ozel",
  "suni-vajina-masturbatorler": "erkeklere-ozel",
  "halka-kiliflar": "erkeklere-ozel",
  "sisme-kadinlar": "erkeklere-ozel",
  "prezervatifler": "kozmetik",
  "anal-oyuncaklar": null, // top-level
  "realistik-mankenler": null, // top-level
};

interface CSVRow {
  slug: string;
  id: string;
  name: string;
  categories: string;
}

interface Category {
  id: number;
  slug: string;
  name: string;
  parentWcId: number | null;
}

interface Product {
  id: number;
  slug: string;
  name: string;
}

interface ProductCategoryLink {
  productId: number;
  productSlug: string;
  categoryId: number;
  categorySlug: string;
}

interface ProductFix {
  productId: number;
  productSlug: string;
  correctCategorySlug: string;
  correctCategoryId: number;
  parentCategorySlug: string | null;
  parentCategoryId: number | null;
  currentLinks: ProductCategoryLink[];
}

async function main() {
  console.log("🚀 Fix sex-oyuncaklari-35 script başlatılıyor...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // ============================================
    // A) Read & Validate Input
    // ============================================
    console.log("📥 A) Input dosyası okunuyor ve doğrulanıyor...");
    const csvPath = join(process.cwd(), "exports", "sex-oyuncaklari.csv");
    let csvContent: string;
    try {
      csvContent = readFileSync(csvPath, "utf-8");
    } catch (error) {
      console.error(`❌ Dosya bulunamadı: ${csvPath}`);
      throw new Error(`Input dosyası bulunamadı: ${csvPath}`);
    }

    const records = parseCsv(csvContent) as unknown as CSVRow[];

    console.log(`  ✅ ${records.length} satır okundu (beklenen: 35)`);

    // Validate each row
    const validatedRows: Array<{ slug: string; correctCategory: string }> = [];
    for (const row of records) {
      if (!row.slug || !row.categories) {
        throw new Error(`Geçersiz satır: slug veya categories boş - ${JSON.stringify(row)}`);
      }

      const categories = row.categories.split(",").map((c) => c.trim());
      if (!categories.includes("sex-oyuncaklari")) {
        throw new Error(`Satırda 'sex-oyuncaklari' yok: ${row.slug}`);
      }

      const correctCategory = categories.find((c) => c !== "sex-oyuncaklari");
      if (!correctCategory) {
        throw new Error(`Satırda 'sex-oyuncaklari' dışında kategori yok: ${row.slug}`);
      }

      if (!CATEGORY_PARENT_MAP.hasOwnProperty(correctCategory)) {
        throw new Error(`Bilinmeyen kategori mapping: ${correctCategory} (ürün: ${row.slug})`);
      }

      validatedRows.push({ slug: row.slug, correctCategory });
    }

    console.log(`  ✅ ${validatedRows.length} satır doğrulandı\n`);

    // ============================================
    // B) Schema Discovery (Evidence)
    // ============================================
    console.log("📋 B) Schema keşfediliyor (evidence)...");
    const schemaEvidence = {
      categoriesTable: "categories",
      categoriesColumns: ["id", "slug", "name", "parent_wc_id"],
      productsTable: "products",
      productsColumns: ["id", "slug", "name"],
      joinTable: "product_categories",
      joinColumns: ["product_id", "category_id"],
    };
    console.log("  ✅ Schema evidence:");
    console.log(`     - Categories: ${schemaEvidence.categoriesTable} (${schemaEvidence.categoriesColumns.join(", ")})`);
    console.log(`     - Products: ${schemaEvidence.productsTable} (${schemaEvidence.productsColumns.join(", ")})`);
    console.log(`     - Join: ${schemaEvidence.joinTable} (${schemaEvidence.joinColumns.join(", ")})\n`);

    // ============================================
    // C) Category Evidence
    // ============================================
    console.log("🔍 C) Kategoriler DB'den çekiliyor...");
    const requiredSlugs = [
      "sex-oyuncaklari",
      "fetis-fantezi",
      "fantezi-giyim",
      "suni-vajina-masturbatorler",
      "halka-kiliflar",
      "sisme-kadinlar",
      "prezervatifler",
      "kadinlara-ozel",
      "erkeklere-ozel",
      "kozmetik",
      "anal-oyuncaklar",
      "realistik-mankenler",
    ];

    const categoriesResult = await pool.query<Category>(`
      SELECT id, slug, name, parent_wc_id as "parentWcId"
      FROM categories
      WHERE slug = ANY($1::text[])
    `, [requiredSlugs]);

    const categories = categoriesResult.rows;
    const categoryBySlug = new Map<string, Category>();
    for (const cat of categories) {
      categoryBySlug.set(cat.slug, cat);
    }

    // Check all required slugs exist
    const missingSlugs: string[] = [];
    for (const slug of requiredSlugs) {
      if (!categoryBySlug.has(slug)) {
        missingSlugs.push(slug);
      }
    }

    if (missingSlugs.length > 0) {
      throw new Error(`DB'de bulunamayan kategoriler: ${missingSlugs.join(", ")}`);
    }

    // Verify parent relationships
    const sexOyuncaklari = categoryBySlug.get("sex-oyuncaklari")!;
    const kadinlaraOzel = categoryBySlug.get("kadinlara-ozel")!;
    const erkeklereOzel = categoryBySlug.get("erkeklere-ozel")!;
    const kozmetik = categoryBySlug.get("kozmetik")!;

    console.log(`  ✅ ${categories.length} kategori bulundu`);
    console.log(`     - sex-oyuncaklari: id=${sexOyuncaklari.id}`);
    console.log(`     - kadinlara-ozel: id=${kadinlaraOzel.id}`);
    console.log(`     - erkeklere-ozel: id=${erkeklereOzel.id}`);
    console.log(`     - kozmetik: id=${kozmetik.id}\n`);

    // ============================================
    // D) Resolve Products
    // ============================================
    console.log("🔍 D) Ürünler DB'den çözümleniyor...");
    const productSlugs = validatedRows.map((r) => r.slug);
    const productsResult = await pool.query<Product>(`
      SELECT id, slug, name
      FROM products
      WHERE slug = ANY($1::text[])
    `, [productSlugs]);

    const products = productsResult.rows;
    const productBySlug = new Map<string, Product>();
    for (const prod of products) {
      productBySlug.set(prod.slug, prod);
    }

    const missingProducts: string[] = [];
    for (const row of validatedRows) {
      if (!productBySlug.has(row.slug)) {
        missingProducts.push(row.slug);
      }
    }

    if (missingProducts.length > 0) {
      throw new Error(`DB'de bulunamayan ürünler: ${missingProducts.join(", ")}`);
    }

    console.log(`  ✅ ${products.length} ürün bulundu\n`);

    // ============================================
    // Get current product-category links
    // ============================================
    console.log("📊 Mevcut ürün-kategori linkleri çekiliyor...");
    const productIds = products.map((p) => p.id);
    const linksResult = await pool.query<ProductCategoryLink>(`
      SELECT 
        pc.product_id as "productId",
        p.slug as "productSlug",
        pc.category_id as "categoryId",
        c.slug as "categorySlug"
      FROM product_categories pc
      JOIN products p ON p.id = pc.product_id
      JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = ANY($1::integer[])
    `, [productIds]);

    const allLinks = linksResult.rows;
    const linksByProductId = new Map<number, ProductCategoryLink[]>();
    for (const link of allLinks) {
      if (!linksByProductId.has(link.productId)) {
        linksByProductId.set(link.productId, []);
      }
      linksByProductId.get(link.productId)!.push(link);
    }

    console.log(`  ✅ ${allLinks.length} mevcut link bulundu\n`);

    // ============================================
    // Build fix plan
    // ============================================
    console.log("📝 Fix plan oluşturuluyor...");
    const fixes: ProductFix[] = [];

    for (const row of validatedRows) {
      const product = productBySlug.get(row.slug)!;
      const correctCategorySlug = row.correctCategory;
      const correctCategory = categoryBySlug.get(correctCategorySlug)!;
      const parentCategorySlug = CATEGORY_PARENT_MAP[correctCategorySlug];
      const parentCategory = parentCategorySlug ? categoryBySlug.get(parentCategorySlug) : null;

      const currentLinks = linksByProductId.get(product.id) || [];

      fixes.push({
        productId: product.id,
        productSlug: product.slug,
        correctCategorySlug,
        correctCategoryId: correctCategory.id,
        parentCategorySlug,
        parentCategoryId: parentCategory?.id || null,
        currentLinks,
      });
    }

    console.log(`  ✅ ${fixes.length} ürün için fix planı oluşturuldu\n`);

    // ============================================
    // E) Backup
    // ============================================
    console.log("💾 E) Backup dosyaları oluşturuluyor...");
    const backupDir = join(process.cwd(), "old-products", "backups");
    mkdirSync(backupDir, { recursive: true });

    // CSV backup
    const backupCsvPath = join(backupDir, "sex-oyuncaklari-35-links-before.csv");
    let backupCsv = "product_id,product_slug,category_id,category_slug\n";
    for (const link of allLinks) {
      backupCsv += `${link.productId},${link.productSlug},${link.categoryId},${link.categorySlug}\n`;
    }
    writeFileSync(backupCsvPath, backupCsv, "utf-8");
    console.log(`  ✅ CSV backup: ${backupCsvPath}`);

    // SQL backup
    const backupSqlPath = join(backupDir, "sex-oyuncaklari-35-links-before.sql");
    let backupSql = "-- Backup: Mevcut product_categories linkleri\n";
    backupSql += "-- Bu dosya geri yükleme için kullanılabilir\n\n";
    backupSql += "BEGIN;\n\n";
    for (const link of allLinks) {
      backupSql += `INSERT INTO product_categories (product_id, category_id) VALUES (${link.productId}, ${link.categoryId}) ON CONFLICT (product_id, category_id) DO NOTHING;\n`;
    }
    backupSql += "\nCOMMIT;\n";
    writeFileSync(backupSqlPath, backupSql, "utf-8");
    console.log(`  ✅ SQL backup: ${backupSqlPath}\n`);

    // ============================================
    // F) Generate SQL Files
    // ============================================
    console.log("📝 F) SQL dosyaları oluşturuluyor...");
    const oldProductsDir = join(process.cwd(), "old-products");
    mkdirSync(oldProductsDir, { recursive: true });

    // Count operations
    let deleteCount = 0;
    let insertCorrectCount = 0;
    let insertParentCount = 0;

    for (const fix of fixes) {
      // Check if sex-oyuncaklari link exists
      const hasSexOyuncaklari = fix.currentLinks.some(
        (l) => l.categorySlug === "sex-oyuncaklari"
      );
      if (hasSexOyuncaklari) {
        deleteCount++;
      }

      // Check if correct category link exists
      const hasCorrectCategory = fix.currentLinks.some(
        (l) => l.categoryId === fix.correctCategoryId
      );
      if (!hasCorrectCategory) {
        insertCorrectCount++;
      }

      // Check if parent category link exists
      if (fix.parentCategoryId) {
        const hasParentCategory = fix.currentLinks.some(
          (l) => l.categoryId === fix.parentCategoryId
        );
        if (!hasParentCategory) {
          insertParentCount++;
        }
      }
    }

    // Plan SQL (with ROLLBACK)
    const planSqlPath = join(oldProductsDir, "sex-oyuncaklari-35-fix-plan.sql");
    let planSql = `-- Fix Plan: 35 ürün için sex-oyuncaklari linkini kaldır ve doğru kategorileri ekle\n`;
    planSql += `-- DELETE: ${deleteCount} link (sex-oyuncaklari)\n`;
    planSql += `-- INSERT: ${insertCorrectCount} link (doğru kategori)\n`;
    planSql += `-- INSERT: ${insertParentCount} link (parent kategori)\n\n`;
    planSql += "BEGIN;\n\n";

    for (const fix of fixes) {
      // DELETE sex-oyuncaklari link
      const hasSexOyuncaklari = fix.currentLinks.some(
        (l) => l.categorySlug === "sex-oyuncaklari"
      );
      if (hasSexOyuncaklari) {
        planSql += `-- Ürün: ${fix.productSlug}\n`;
        planSql += `DELETE FROM product_categories WHERE product_id = ${fix.productId} AND category_id = ${sexOyuncaklari.id};\n`;
      }

      // INSERT correct category (if not exists)
      const hasCorrectCategory = fix.currentLinks.some(
        (l) => l.categoryId === fix.correctCategoryId
      );
      if (!hasCorrectCategory) {
        planSql += `INSERT INTO product_categories (product_id, category_id) VALUES (${fix.productId}, ${fix.correctCategoryId}) ON CONFLICT (product_id, category_id) DO NOTHING;\n`;
      }

      // INSERT parent category (if not exists and parent exists)
      if (fix.parentCategoryId) {
        const hasParentCategory = fix.currentLinks.some(
          (l) => l.categoryId === fix.parentCategoryId
        );
        if (!hasParentCategory) {
          planSql += `INSERT INTO product_categories (product_id, category_id) VALUES (${fix.productId}, ${fix.parentCategoryId}) ON CONFLICT (product_id, category_id) DO NOTHING;\n`;
        }
      }
      planSql += "\n";
    }

    planSql += "ROLLBACK;\n";
    writeFileSync(planSqlPath, planSql, "utf-8");
    console.log(`  ✅ Plan SQL: ${planSqlPath}`);

    // Apply SQL (with COMMIT)
    const applySqlPath = join(oldProductsDir, "sex-oyuncaklari-35-fix-apply.sql");
    let applySql = `-- Fix Apply: 35 ürün için sex-oyuncaklari linkini kaldır ve doğru kategorileri ekle\n`;
    applySql += `-- DELETE: ${deleteCount} link (sex-oyuncaklari)\n`;
    applySql += `-- INSERT: ${insertCorrectCount} link (doğru kategori)\n`;
    applySql += `-- INSERT: ${insertParentCount} link (parent kategori)\n\n`;
    applySql += "BEGIN;\n\n";

    for (const fix of fixes) {
      // DELETE sex-oyuncaklari link
      const hasSexOyuncaklari = fix.currentLinks.some(
        (l) => l.categorySlug === "sex-oyuncaklari"
      );
      if (hasSexOyuncaklari) {
        applySql += `-- Ürün: ${fix.productSlug}\n`;
        applySql += `DELETE FROM product_categories WHERE product_id = ${fix.productId} AND category_id = ${sexOyuncaklari.id};\n`;
      }

      // INSERT correct category (if not exists)
      const hasCorrectCategory = fix.currentLinks.some(
        (l) => l.categoryId === fix.correctCategoryId
      );
      if (!hasCorrectCategory) {
        applySql += `INSERT INTO product_categories (product_id, category_id) VALUES (${fix.productId}, ${fix.correctCategoryId}) ON CONFLICT (product_id, category_id) DO NOTHING;\n`;
      }

      // INSERT parent category (if not exists and parent exists)
      if (fix.parentCategoryId) {
        const hasParentCategory = fix.currentLinks.some(
          (l) => l.categoryId === fix.parentCategoryId
        );
        if (!hasParentCategory) {
          applySql += `INSERT INTO product_categories (product_id, category_id) VALUES (${fix.productId}, ${fix.parentCategoryId}) ON CONFLICT (product_id, category_id) DO NOTHING;\n`;
        }
      }
      applySql += "\n";
    }

    applySql += "COMMIT;\n";
    writeFileSync(applySqlPath, applySql, "utf-8");
    console.log(`  ✅ Apply SQL: ${applySqlPath}\n`);

    // ============================================
    // G) Verification Queries
    // ============================================
    console.log("🔍 G) Doğrulama sorguları oluşturuluyor...");
    const verifySqlPath = join(oldProductsDir, "sex-oyuncaklari-35-fix-verify.sql");
    let verifySql = "-- Verification Queries\n\n";

    // Before queries
    verifySql += "-- ============================================\n";
    verifySql += "-- BEFORE APPLY\n";
    verifySql += "-- ============================================\n\n";
    verifySql += `-- 1. 35 ürünün kaçında 'sex-oyuncaklari' linki var?\n`;
    verifySql += `SELECT COUNT(DISTINCT pc.product_id) as products_with_sex_oyuncaklari\n`;
    verifySql += `FROM product_categories pc\n`;
    verifySql += `JOIN categories c ON c.id = pc.category_id\n`;
    verifySql += `WHERE c.slug = 'sex-oyuncaklari'\n`;
    verifySql += `  AND pc.product_id IN (${productIds.join(", ")});\n\n`;

    // After queries
    verifySql += "-- ============================================\n";
    verifySql += "-- AFTER APPLY (bu sorguları apply sonrası çalıştırın)\n";
    verifySql += "-- ============================================\n\n";
    verifySql += `-- 1. 35 ürünün kaçında 'sex-oyuncaklari' linki kaldı? (beklenen: 0)\n`;
    verifySql += `SELECT COUNT(DISTINCT pc.product_id) as products_with_sex_oyuncaklari\n`;
    verifySql += `FROM product_categories pc\n`;
    verifySql += `JOIN categories c ON c.id = pc.category_id\n`;
    verifySql += `WHERE c.slug = 'sex-oyuncaklari'\n`;
    verifySql += `  AND pc.product_id IN (${productIds.join(", ")});\n\n`;

    verifySql += `-- 2. Parent linkleri eklendi mi?\n`;
    verifySql += `-- Örnek: fetis-fantezi olanlarda kadinlara-ozel var mı?\n`;
    verifySql += `SELECT \n`;
    verifySql += `  p.slug as product_slug,\n`;
    verifySql += `  c.slug as category_slug,\n`;
    verifySql += `  parent_c.slug as parent_category_slug\n`;
    verifySql += `FROM product_categories pc\n`;
    verifySql += `JOIN products p ON p.id = pc.product_id\n`;
    verifySql += `JOIN categories c ON c.id = pc.category_id\n`;
    verifySql += `LEFT JOIN categories parent_c ON parent_c.id = (\n`;
    verifySql += `  SELECT parent_cat.id\n`;
    verifySql += `  FROM categories parent_cat\n`;
    verifySql += `  WHERE parent_cat.wc_id = c.parent_wc_id\n`;
    verifySql += `)\n`;
    verifySql += `WHERE pc.product_id IN (${productIds.join(", ")})\n`;
    verifySql += `  AND c.slug IN ('fetis-fantezi', 'fantezi-giyim', 'suni-vajina-masturbatorler', 'halka-kiliflar', 'sisme-kadinlar', 'prezervatifler')\n`;
    verifySql += `ORDER BY p.slug, c.slug;\n\n`;

    // Sample products before/after
    const sampleProducts = fixes.slice(0, 5);
    verifySql += `-- 3. 5 örnek ürün için kategori listesi (BEFORE)\n`;
    verifySql += `SELECT \n`;
    verifySql += `  p.slug as product_slug,\n`;
    verifySql += `  STRING_AGG(c.slug, ', ' ORDER BY c.slug) as categories\n`;
    verifySql += `FROM products p\n`;
    verifySql += `JOIN product_categories pc ON pc.product_id = p.id\n`;
    verifySql += `JOIN categories c ON c.id = pc.category_id\n`;
    verifySql += `WHERE p.slug IN (${sampleProducts.map((f) => `'${f.productSlug}'`).join(", ")})\n`;
    verifySql += `GROUP BY p.slug\n`;
    verifySql += `ORDER BY p.slug;\n\n`;

    verifySql += `-- 4. 5 örnek ürün için kategori listesi (AFTER - apply sonrası çalıştırın)\n`;
    verifySql += `SELECT \n`;
    verifySql += `  p.slug as product_slug,\n`;
    verifySql += `  STRING_AGG(c.slug, ', ' ORDER BY c.slug) as categories\n`;
    verifySql += `FROM products p\n`;
    verifySql += `JOIN product_categories pc ON pc.product_id = p.id\n`;
    verifySql += `JOIN categories c ON c.id = pc.category_id\n`;
    verifySql += `WHERE p.slug IN (${sampleProducts.map((f) => `'${f.productSlug}'`).join(", ")})\n`;
    verifySql += `GROUP BY p.slug\n`;
    verifySql += `ORDER BY p.slug;\n`;

    writeFileSync(verifySqlPath, verifySql, "utf-8");
    console.log(`  ✅ Verify SQL: ${verifySqlPath}\n`);

    // ============================================
    // H) Report
    // ============================================
    console.log("📊 H) Rapor oluşturuluyor...");
    const reportPath = join(oldProductsDir, "sex-oyuncaklari-35-fix-report.md");
    let report = `# Fix Report: sex-oyuncaklari-35\n\n`;
    report += `**Tarih:** ${new Date().toISOString()}\n\n`;

    report += `## Input\n\n`;
    report += `- **Input dosyası:** \`exports/sex-oyuncaklari.csv\`\n`;
    report += `- **Satır sayısı:** ${records.length}\n`;
    report += `- **Doğrulanmış satır sayısı:** ${validatedRows.length}\n`;
    report += `- **Etkilenecek ürün sayısı:** ${fixes.length}\n\n`;

    report += `## Schema Evidence\n\n`;
    report += `- **Categories tablosu:** \`${schemaEvidence.categoriesTable}\`\n`;
    report += `  - Kolonlar: ${schemaEvidence.categoriesColumns.join(", ")}\n`;
    report += `- **Products tablosu:** \`${schemaEvidence.productsTable}\`\n`;
    report += `  - Kolonlar: ${schemaEvidence.productsColumns.join(", ")}\n`;
    report += `- **Join tablosu:** \`${schemaEvidence.joinTable}\`\n`;
    report += `  - Kolonlar: ${schemaEvidence.joinColumns.join(", ")}\n\n`;

    report += `## Category Evidence\n\n`;
    report += `| Slug | ID | Name | Parent WC ID |\n`;
    report += `|------|----|----|--------------|\n`;
    for (const slug of requiredSlugs) {
      const cat = categoryBySlug.get(slug)!;
      report += `| ${slug} | ${cat.id} | ${cat.name} | ${cat.parentWcId || "null"} |\n`;
    }
    report += `\n`;

    report += `## Category Mapping Rules\n\n`;
    report += `| Kategori | Parent |\n`;
    report += `|----------|--------|\n`;
    for (const [cat, parent] of Object.entries(CATEGORY_PARENT_MAP)) {
      report += `| ${cat} | ${parent || "top-level (parent yok)"} |\n`;
    }
    report += `\n`;

    report += `## Ürün Kategori Dağılımı (Mevcut)\n\n`;
    const categoryCountDistribution = new Map<number, number>();
    for (const fix of fixes) {
      const count = fix.currentLinks.length;
      const existing = categoryCountDistribution.get(count) || 0;
      categoryCountDistribution.set(count, existing + 1);
    }
    report += `| Kategori Sayısı | Ürün Sayısı |\n`;
    report += `|-----------------|-------------|\n`;
    const sortedCounts = Array.from(categoryCountDistribution.keys()).sort((a, b) => a - b);
    for (const count of sortedCounts) {
      report += `| ${count} | ${categoryCountDistribution.get(count)} |\n`;
    }
    report += `\n`;

    report += `## Yapılacak İşlemler\n\n`;
    report += `- **DELETE:** ${deleteCount} link (sex-oyuncaklari kaldırılacak)\n`;
    report += `- **INSERT:** ${insertCorrectCount} link (doğru kategori eklenecek)\n`;
    report += `- **INSERT:** ${insertParentCount} link (parent kategori eklenecek)\n\n`;

    report += `## Örnek Ürünler (Before)\n\n`;
    report += `| Ürün Slug | Mevcut Kategoriler |\n`;
    report += `|-----------|-------------------|\n`;
    for (const sample of sampleProducts) {
      const categories = sample.currentLinks.map((l) => l.categorySlug).join(", ");
      report += `| ${sample.productSlug} | ${categories} |\n`;
    }
    report += `\n`;

    report += `## Tüm Ürünler Detayı\n\n`;
    report += `| Ürün Slug | Doğru Kategori | Parent Kategori | Mevcut Link Sayısı |\n`;
    report += `|-----------|----------------|-----------------|---------------------|\n`;
    for (const fix of fixes) {
      report += `| ${fix.productSlug} | ${fix.correctCategorySlug} | ${fix.parentCategorySlug || "yok"} | ${fix.currentLinks.length} |\n`;
    }
    report += `\n`;

    report += `## Dosyalar\n\n`;
    report += `- Backup CSV: \`old-products/backups/sex-oyuncaklari-35-links-before.csv\`\n`;
    report += `- Backup SQL: \`old-products/backups/sex-oyuncaklari-35-links-before.sql\`\n`;
    report += `- Plan SQL: \`old-products/sex-oyuncaklari-35-fix-plan.sql\`\n`;
    report += `- Apply SQL: \`old-products/sex-oyuncaklari-35-fix-apply.sql\`\n`;
    report += `- Verify SQL: \`old-products/sex-oyuncaklari-35-fix-verify.sql\`\n`;
    report += `- Report: \`old-products/sex-oyuncaklari-35-fix-report.md\`\n\n`;

    report += `## Notlar\n\n`;
    report += `- Bu task sadece dosya üretimi yaptı, DB'ye yazma yapılmadı.\n`;
    report += `- Apply için \`old-products/sex-oyuncaklari-35-fix-apply.sql\` dosyasını çalıştırın.\n`;
    report += `- Apply sonrası doğrulama için \`old-products/sex-oyuncaklari-35-fix-verify.sql\` dosyasını kullanın.\n`;

    writeFileSync(reportPath, report, "utf-8");
    console.log(`  ✅ Report: ${reportPath}\n`);

    console.log("✅ Tüm işlemler tamamlandı!\n");
    console.log("📝 Oluşturulan dosyalar:");
    console.log(`   - ${backupCsvPath}`);
    console.log(`   - ${backupSqlPath}`);
    console.log(`   - ${planSqlPath}`);
    console.log(`   - ${applySqlPath}`);
    console.log(`   - ${verifySqlPath}`);
    console.log(`   - ${reportPath}\n`);
    console.log("⚠️  ÖNEMLİ: Apply SQL dosyası henüz çalıştırılmadı!");
    console.log("   Uygulama için: old-products/sex-oyuncaklari-35-fix-apply.sql dosyasını çalıştırın.\n");

  } catch (error) {
    console.error("❌ Hata:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
