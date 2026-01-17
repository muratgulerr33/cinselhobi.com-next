import dotenv from "dotenv";
import { writeFile } from "fs/promises";
import { join } from "path";
import { Pool } from "pg";

// .env dosyalarını yükle
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

const OUTPUT_DIR = join(process.cwd(), "exports");

/**
 * Intent bazlı kategori taşıma SQL plan'ı üretir
 * Plan: Step 3 - Opsiyonel DB Fix Plan
 */
async function main() {
  console.log("🚀 Intent Fix SQL Plan üretiliyor...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. et-dokulu-urunler kategorisini bul
    const etDokuluResult = await pool.query(`
      SELECT id, wc_id, slug, name
      FROM categories
      WHERE slug = 'et-dokulu-urunler'
      LIMIT 1
    `);

    if (etDokuluResult.rows.length === 0) {
      console.error("❌ et-dokulu-urunler kategorisi bulunamadı!");
      process.exit(1);
    }

    const etDokuluCategory = etDokuluResult.rows[0];
    console.log(`✅ et-dokulu-urunler kategorisi bulundu: ID=${etDokuluCategory.id}, WC_ID=${etDokuluCategory.wc_id}\n`);

    // 2. Erkek intent ürünlerini bul (intent-matrix-et-dokulu.csv'den)
    // Product ID 95: "EXTRA SLEVE Penis Kılıfı" -> "halka-kiliflar" kategorisine taşı
    // Product ID 231: "Et Doku Kıkırdaklı Penis Chisa" -> "realistik-mankenler" kategorisine taşı
    const erkekProducts = [
      { productId: 95, targetCategorySlug: "halka-kiliflar", reason: "Penis kılıfı, erkek kategorisi" },
      { productId: 231, targetCategorySlug: "realistik-mankenler", reason: "Penis ürünü, realistik kategorisi" },
    ];

    // 3. Hedef kategorileri bul
    const targetCategories: Array<{ productId: number; categoryId: number; categorySlug: string }> = [];
    for (const erkekProduct of erkekProducts) {
      const targetResult = await pool.query(`
        SELECT id, wc_id, slug, name
        FROM categories
        WHERE slug = $1
        LIMIT 1
      `, [erkekProduct.targetCategorySlug]);

      if (targetResult.rows.length === 0) {
        console.warn(`⚠️  Hedef kategori bulunamadı: ${erkekProduct.targetCategorySlug}`);
        continue;
      }

      targetCategories.push({
        productId: erkekProduct.productId,
        categoryId: targetResult.rows[0].id,
        categorySlug: erkekProduct.targetCategorySlug,
      });
    }

    console.log(`✅ ${targetCategories.length} hedef kategori bulundu\n`);

    // 4. Ürün bilgilerini doğrula
    const productIds = erkekProducts.map((p) => p.productId);
    const productsResult = await pool.query(`
      SELECT id, wc_id, slug, name
      FROM products
      WHERE id = ANY($1)
    `, [productIds]);

    console.log(`✅ ${productsResult.rows.length} ürün bulundu:\n`);
    for (const product of productsResult.rows) {
      const target = targetCategories.find((t) => t.productId === product.id);
      console.log(`  - ${product.name} (ID: ${product.id}) -> ${target?.categorySlug || "BULUNAMADI"}`);
    }
    console.log("");

    // 5. SQL plan'ı oluştur
    const fixPlan: string[] = [];
    const rollbackPlan: string[] = [];

    fixPlan.push("-- Intent Fix Plan: Erkek intent ürünlerini et-dokulu-urunler'den taşıma");
    fixPlan.push("-- Oluşturulma Tarihi: " + new Date().toLocaleString("tr-TR"));
    fixPlan.push("-- ⛔ MURAT ONAYI GEREKLİ");
    fixPlan.push("");
    fixPlan.push("BEGIN;");
    fixPlan.push("");

    rollbackPlan.push("-- Intent Fix Rollback Plan");
    rollbackPlan.push("-- Oluşturulma Tarihi: " + new Date().toLocaleString("tr-TR"));
    rollbackPlan.push("");
    rollbackPlan.push("BEGIN;");
    rollbackPlan.push("");

    for (const target of targetCategories) {
      const product = productsResult.rows.find((p) => p.id === target.productId);
      if (!product) continue;

      // Eski pivot'u kaldır
      fixPlan.push(`-- Ürün: ${product.name} (ID: ${product.id})`);
      fixPlan.push(`-- Eski kategori: et-dokulu-urunler (ID: ${etDokuluCategory.id})`);
      fixPlan.push(`-- Yeni kategori: ${target.categorySlug} (ID: ${target.categoryId})`);
      fixPlan.push(`DELETE FROM product_categories WHERE product_id = ${product.id} AND category_id = ${etDokuluCategory.id};`);
      fixPlan.push("");

      // Yeni pivot'u ekle (eğer zaten yoksa)
      fixPlan.push(`-- Yeni kategori bağlantısı ekle`);
      fixPlan.push(`INSERT INTO product_categories (product_id, category_id) VALUES (${product.id}, ${target.categoryId})`);
      fixPlan.push(`ON CONFLICT (product_id, category_id) DO NOTHING;`);
      fixPlan.push("");

      // Rollback: Yeni pivot'u kaldır, eski pivot'u geri ekle
      rollbackPlan.push(`-- Rollback: ${product.name} (ID: ${product.id})`);
      rollbackPlan.push(`DELETE FROM product_categories WHERE product_id = ${product.id} AND category_id = ${target.categoryId};`);
      rollbackPlan.push(`INSERT INTO product_categories (product_id, category_id) VALUES (${product.id}, ${etDokuluCategory.id})`);
      rollbackPlan.push(`ON CONFLICT (product_id, category_id) DO NOTHING;`);
      rollbackPlan.push("");
    }

    fixPlan.push("-- Doğrulama: category:lock script'i çalıştırılmalı");
    fixPlan.push("-- npm run category:lock");
    fixPlan.push("");
    fixPlan.push("COMMIT;");

    rollbackPlan.push("COMMIT;");

    // 6. SQL dosyalarını kaydet
    const fixPlanPath = join(OUTPUT_DIR, "intent-fix-plan.sql");
    const rollbackPlanPath = join(OUTPUT_DIR, "intent-fix-rollback.sql");

    await writeFile(fixPlanPath, fixPlan.join("\n"), "utf-8");
    await writeFile(rollbackPlanPath, rollbackPlan.join("\n"), "utf-8");

    console.log(`✅ SQL plan'ları oluşturuldu:`);
    console.log(`  - ${fixPlanPath}`);
    console.log(`  - ${rollbackPlanPath}`);
    console.log("");
    console.log("⚠️  UYARI: Bu SQL plan'ları ⛔ MURAT ONAYI ile çalıştırılmalıdır!");
    console.log("");

  } catch (error) {
    console.error("❌ Hata:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
