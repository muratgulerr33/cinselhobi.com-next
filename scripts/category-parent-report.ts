import { Pool } from "pg";
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

interface Category {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
}

interface ProductCategory {
  productId: number;
  categoryId: number;
  productSlug: string;
  productName: string;
}

async function main() {
  console.log("🚀 Kategori-Ürün Analiz Raporu oluşturuluyor...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. Tüm kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId"
      FROM categories
      ORDER BY id
    `);
    const categories = categoriesResult.rows;
    console.log(`  ✅ ${categories.length} kategori bulundu\n`);

    // 2. Kategori mapping oluştur
    const categoryById = new Map<number, Category>();
    const categoryByWcId = new Map<number, Category>();
    for (const cat of categories) {
      categoryById.set(cat.id, cat);
      categoryByWcId.set(cat.wcId, cat);
    }

    // 3. Üst ve alt kategorileri ayır
    const topCategories = categories.filter(
      (cat) => !cat.parentWcId || cat.parentWcId === 0
    );
    const childCategories = categories.filter(
      (cat) => cat.parentWcId && cat.parentWcId !== 0
    );

    // 4. Ürün-kategori ilişkilerini çek
    console.log("📥 Ürün-kategori ilişkileri çekiliyor...");
    const productCategoriesResult = await pool.query<ProductCategory>(`
      SELECT 
        pc.product_id as "productId",
        pc.category_id as "categoryId",
        p.slug as "productSlug",
        p.name as "productName"
      FROM product_categories pc
      JOIN products p ON p.id = pc.product_id
      WHERE p.status = 'publish'
    `);
    const productCategories = productCategoriesResult.rows;
    console.log(`  ✅ ${productCategories.length} ürün-kategori ilişkisi bulundu\n`);

    // 5. Kategori bazlı ürün sayılarını hesapla
    console.log("🔢 Kategori bazlı ürün sayıları hesaplanıyor...");
    const categoryProductCounts = new Map<number, number>();
    for (const pc of productCategories) {
      const count = categoryProductCounts.get(pc.categoryId) || 0;
      categoryProductCounts.set(pc.categoryId, count + 1);
    }

    // 6. Ürün bazlı kategori sayılarını hesapla (bir ürün kaç kategoride var?)
    console.log("🔢 Ürün bazlı kategori sayıları hesaplanıyor...");
    const productCategoryCounts = new Map<number, number>();
    const productCategoriesMap = new Map<number, number[]>();
    for (const pc of productCategories) {
      const count = productCategoryCounts.get(pc.productId) || 0;
      productCategoryCounts.set(pc.productId, count + 1);

      if (!productCategoriesMap.has(pc.productId)) {
        productCategoriesMap.set(pc.productId, []);
      }
      productCategoriesMap.get(pc.productId)!.push(pc.categoryId);
    }

    // 7. Birden fazla kategoride olan ürünleri bul
    const multiCategoryProducts: Array<{
      productId: number;
      productSlug: string;
      productName: string;
      categories: Array<{ id: number; slug: string; name: string; parentWcId: number | null }>;
    }> = [];

    for (const [productId, categoryIds] of productCategoriesMap.entries()) {
      if (categoryIds.length > 1) {
        const product = productCategories.find((pc) => pc.productId === productId);
        if (product) {
          const cats = categoryIds.map((catId) => {
            const cat = categoryById.get(catId);
            return {
              id: catId,
              slug: cat?.slug || "unknown",
              name: cat?.name || "Unknown",
              parentWcId: cat?.parentWcId || null,
            };
          });
          multiCategoryProducts.push({
            productId,
            productSlug: product.productSlug,
            productName: product.productName,
            categories: cats,
          });
        }
      }
    }

    // 8. Üst-alt kategori eşleşmelerini kontrol et
    console.log("🔍 Üst-alt kategori eşleşmeleri kontrol ediliyor...");
    const parentChildMismatches: Array<{
      productId: number;
      productSlug: string;
      productName: string;
      parentCategory: { id: number; slug: string; name: string };
      childCategory: { id: number; slug: string; name: string };
    }> = [];

    for (const [productId, categoryIds] of productCategoriesMap.entries()) {
      if (categoryIds.length > 1) {
        // Bu ürünün kategorileri arasında üst-alt ilişkisi var mı?
        for (let i = 0; i < categoryIds.length; i++) {
          for (let j = i + 1; j < categoryIds.length; j++) {
            const cat1 = categoryById.get(categoryIds[i]);
            const cat2 = categoryById.get(categoryIds[j]);

            if (cat1 && cat2) {
              // cat1, cat2'nin parent'ı mı?
              if (cat1.wcId === cat2.parentWcId) {
                const product = productCategories.find((pc) => pc.productId === productId);
                if (product) {
                  parentChildMismatches.push({
                    productId,
                    productSlug: product.productSlug,
                    productName: product.productName,
                    parentCategory: {
                      id: cat1.id,
                      slug: cat1.slug,
                      name: cat1.name,
                    },
                    childCategory: {
                      id: cat2.id,
                      slug: cat2.slug,
                      name: cat2.name,
                    },
                  });
                }
              }
              // cat2, cat1'nin parent'ı mı?
              if (cat2.wcId === cat1.parentWcId) {
                const product = productCategories.find((pc) => pc.productId === productId);
                if (product) {
                  parentChildMismatches.push({
                    productId,
                    productSlug: product.productSlug,
                    productName: product.productName,
                    parentCategory: {
                      id: cat2.id,
                      slug: cat2.slug,
                      name: cat2.name,
                    },
                    childCategory: {
                      id: cat1.id,
                      slug: cat1.slug,
                      name: cat1.name,
                    },
                  });
                }
              }
            }
          }
        }
      }
    }

    // 9. Raporu oluştur
    console.log("📝 Rapor oluşturuluyor...");
    let report = `# Kategori-Ürün Analiz Raporu\n\n`;
    report += `**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}\n\n`;
    report += `---\n\n`;

    // Genel İstatistikler
    report += `## 📊 Genel İstatistikler\n\n`;
    report += `- **Toplam Kategori Sayısı:** ${categories.length}\n`;
    report += `- **Üst Kategori Sayısı:** ${topCategories.length}\n`;
    report += `- **Alt Kategori Sayısı:** ${childCategories.length}\n`;
    report += `- **Toplam Ürün-Kategori İlişkisi:** ${productCategories.length}\n`;
    report += `- **Benzersiz Ürün Sayısı:** ${productCategoryCounts.size}\n`;
    report += `- **Birden Fazla Kategoride Olan Ürün Sayısı:** ${multiCategoryProducts.length}\n`;
    report += `- **Üst-Alt Kategori Eşleşme Sorunu Olan Ürün Sayısı:** ${parentChildMismatches.length}\n\n`;
    report += `---\n\n`;

    // Üst Kategoriler ve Ürün Sayıları
    report += `## 📁 Üst Kategoriler ve Ürün Sayıları\n\n`;
    report += `| Slug | İsim | Ürün Sayısı |\n`;
    report += `|------|------|-------------|\n`;
    for (const cat of topCategories.sort((a, b) => {
      const countA = categoryProductCounts.get(a.id) || 0;
      const countB = categoryProductCounts.get(b.id) || 0;
      return countB - countA;
    })) {
      const count = categoryProductCounts.get(cat.id) || 0;
      report += `| ${cat.slug} | ${cat.name} | ${count} |\n`;
    }
    report += `\n---\n\n`;

    // Alt Kategoriler ve Ürün Sayıları
    report += `## 📂 Alt Kategoriler ve Ürün Sayıları\n\n`;
    report += `| Slug | İsim | Parent | Ürün Sayısı |\n`;
    report += `|------|------|--------|-------------|\n`;
    for (const cat of childCategories.sort((a, b) => {
      const countA = categoryProductCounts.get(a.id) || 0;
      const countB = categoryProductCounts.get(b.id) || 0;
      return countB - countA;
    })) {
      const parent = cat.parentWcId ? categoryByWcId.get(cat.parentWcId) : null;
      const count = categoryProductCounts.get(cat.id) || 0;
      report += `| ${cat.slug} | ${cat.name} | ${parent ? parent.slug : "N/A"} | ${count} |\n`;
    }
    report += `\n---\n\n`;

    // Birden Fazla Kategoride Olan Ürünler
    report += `## 🔄 Birden Fazla Kategoride Olan Ürünler\n\n`;
    report += `**Toplam:** ${multiCategoryProducts.length} ürün\n\n`;

    // Kategori sayısına göre grupla
    const byCategoryCount = new Map<number, typeof multiCategoryProducts>();
    for (const product of multiCategoryProducts) {
      const count = product.categories.length;
      if (!byCategoryCount.has(count)) {
        byCategoryCount.set(count, []);
      }
      byCategoryCount.get(count)!.push(product);
    }

    for (const [count, products] of Array.from(byCategoryCount.entries()).sort(
      (a, b) => b[0] - a[0]
    )) {
      report += `### ${count} Kategoride Olan Ürünler (${products.length} adet)\n\n`;
      report += `| Ürün Slug | Ürün Adı | Kategoriler |\n`;
      report += `|-----------|----------|-------------|\n`;
      for (const product of products.slice(0, 20)) {
        const catList = product.categories
          .map((c) => `${c.slug} (${c.name})`)
          .join(", ");
        report += `| ${product.productSlug} | ${product.productName.substring(0, 50)}... | ${catList} |\n`;
      }
      if (products.length > 20) {
        report += `\n*... ve ${products.length - 20} ürün daha*\n`;
      }
      report += `\n`;
    }
    report += `---\n\n`;

    // Üst-Alt Kategori Eşleşme Sorunları
    report += `## ⚠️ Üst-Alt Kategori Eşleşme Sorunları\n\n`;
    report += `**Açıklama:** Bir ürün hem üst hem de alt kategoride listeleniyor. Bu durumda sadece alt kategoride olması yeterlidir.\n\n`;
    report += `**Toplam Sorunlu Ürün:** ${parentChildMismatches.length}\n\n`;

    if (parentChildMismatches.length > 0) {
      report += `| Ürün Slug | Ürün Adı | Üst Kategori | Alt Kategori |\n`;
      report += `|-----------|----------|--------------|--------------|\n`;
      for (const mismatch of parentChildMismatches.slice(0, 50)) {
        report += `| ${mismatch.productSlug} | ${mismatch.productName.substring(0, 50)}... | ${mismatch.parentCategory.slug} (${mismatch.parentCategory.name}) | ${mismatch.childCategory.slug} (${mismatch.childCategory.name}) |\n`;
      }
      if (parentChildMismatches.length > 50) {
        report += `\n*... ve ${parentChildMismatches.length - 50} ürün daha*\n`;
      }
    } else {
      report += `✅ Sorun bulunamadı! Tüm ürünler doğru şekilde kategorize edilmiş.\n`;
    }
    report += `\n---\n\n`;

    // Kategori Ağacı Yapısı
    report += `## 🌳 Kategori Ağacı Yapısı\n\n`;
    for (const topCat of topCategories.sort((a, b) => a.name.localeCompare(b.name))) {
      const children = childCategories.filter(
        (c) => c.parentWcId === topCat.wcId
      );
      const topCount = categoryProductCounts.get(topCat.id) || 0;

      report += `### ${topCat.name} (${topCat.slug})\n`;
      report += `- **Ürün Sayısı:** ${topCount}\n`;
      report += `- **Alt Kategori Sayısı:** ${children.length}\n`;

      if (children.length > 0) {
        report += `\n**Alt Kategoriler:**\n`;
        for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
          const childCount = categoryProductCounts.get(child.id) || 0;
          report += `  - ${child.name} (${child.slug}) - ${childCount} ürün\n`;
        }
      }
      report += `\n`;
    }

    // Dosyaya yaz
    writeFileSync("report-category-parent.md", report, "utf-8");
    console.log("✅ Rapor oluşturuldu: report-category-parent.md\n");

    // Özet
    console.log("📊 Özet:");
    console.log(`  - Toplam Kategori: ${categories.length}`);
    console.log(`  - Üst Kategori: ${topCategories.length}`);
    console.log(`  - Alt Kategori: ${childCategories.length}`);
    console.log(`  - Birden Fazla Kategoride Olan Ürün: ${multiCategoryProducts.length}`);
    console.log(`  - Üst-Alt Eşleşme Sorunu: ${parentChildMismatches.length}`);
  } catch (error) {
    console.error("❌ Hata:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
