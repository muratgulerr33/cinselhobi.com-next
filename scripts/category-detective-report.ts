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

const OUTPUT_DIR = join(process.cwd(), "old-products");

// Tip tanımlamaları
interface Category {
  id: number;
  wcId: number;
  slug: string;
  name: string;
  parentWcId: number | null;
  description: string | null;
  imageUrl: string | null;
}

interface CategoryStats {
  category: Category;
  directTotal: number;
  directPublish: number;
  directInstockPublish: number;
  subtreeTotal: number;
  subtreePublish: number;
  subtreeInstockPublish: number;
  childrenCount: number;
  leafCount: number;
  depth: number;
  isOrphan: boolean;
  inCycle: boolean;
  cyclePath?: number[];
}

interface CycleInfo {
  categoryId: number;
  path: number[];
}

// Ana fonksiyon
async function main() {
  console.log("🚀 Kategori dedektif raporu oluşturuluyor...\n");

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
    // 1. Tüm kategorileri çek
    console.log("📥 Kategoriler çekiliyor...");
    const categoriesResult = await pool.query<Category>(`
      SELECT id, wc_id as "wcId", slug, name, parent_wc_id as "parentWcId", description, image_url as "imageUrl"
      FROM categories
      ORDER BY id
    `);
    const categories = categoriesResult.rows;
    console.log(`  ✅ ${categories.length} kategori bulundu\n`);

    // 2. wcId -> Category mapping oluştur
    const categoryByWcId = new Map<number, Category>();
    const categoryById = new Map<number, Category>();
    for (const cat of categories) {
      categoryByWcId.set(cat.wcId, cat);
      categoryById.set(cat.id, cat);
    }

    // 3. Ürün-kategori ilişkilerini çek
    console.log("📥 Ürün-kategori ilişkileri çekiliyor...");
    const productCategoriesResult = await pool.query<{
      productId: number;
      categoryId: number;
      status: string;
      stockStatus: string | null;
    }>(`
      SELECT 
        pc.product_id as "productId",
        pc.category_id as "categoryId",
        p.status,
        p.stock_status as "stockStatus"
      FROM product_categories pc
      JOIN products p ON p.id = pc.product_id
    `);
    const productCategories = productCategoriesResult.rows;
    console.log(`  ✅ ${productCategories.length} ürün-kategori ilişkisi bulundu\n`);

    // 4. Kategori bazlı ürün sayılarını hesapla (direct)
    console.log("🔢 Direct ürün sayıları hesaplanıyor...");
    const directProductCounts = new Map<number, {
      total: number;
      publish: number;
      instockPublish: number;
    }>();

    for (const pc of productCategories) {
      const catId = pc.categoryId;
      if (!directProductCounts.has(catId)) {
        directProductCounts.set(catId, { total: 0, publish: 0, instockPublish: 0 });
      }
      const counts = directProductCounts.get(catId)!;
      counts.total++;
      if (pc.status === "publish") {
        counts.publish++;
        if (pc.stockStatus === "instock") {
          counts.instockPublish++;
        }
      }
    }

    // 5. Parent-child ağacını kur ve cycle/orphan tespiti yap
    console.log("🌳 Parent-child ağacı kuruluyor ve cycle/orphan tespiti yapılıyor...");
    const childrenMap = new Map<number, Category[]>();
    const parentMap = new Map<number, number>(); // categoryId -> parentCategoryId
    const orphans: number[] = [];
    const cycles: CycleInfo[] = [];

    // Children mapping - önce tüm kategoriler için entry oluştur
    for (const cat of categories) {
      if (!childrenMap.has(cat.id)) {
        childrenMap.set(cat.id, []);
      }
    }

    // Sonra parent-child ilişkilerini kur
    for (const cat of categories) {
      if (cat.parentWcId !== null) {
        const parent = categoryByWcId.get(cat.parentWcId);
        if (parent) {
          parentMap.set(cat.id, parent.id);
          // Parent için de entry olmasını garanti et
          if (!childrenMap.has(parent.id)) {
            childrenMap.set(parent.id, []);
          }
          childrenMap.get(parent.id)!.push(cat);
        } else {
          orphans.push(cat.id);
        }
      }
    }

    // Cycle tespiti (DFS ile)
    const visited = new Set<number>();
    const recStack = new Set<number>();
    const cyclePaths: CycleInfo[] = [];

    function detectCycle(catId: number, path: number[]): void {
      if (recStack.has(catId)) {
        // Cycle bulundu
        const cycleStart = path.indexOf(catId);
        cyclePaths.push({
          categoryId: catId,
          path: path.slice(cycleStart),
        });
        return;
      }
      if (visited.has(catId)) {
        return;
      }

      visited.add(catId);
      recStack.add(catId);
      path.push(catId);

      const children = childrenMap.get(catId) || [];
      for (const child of children) {
        detectCycle(child.id, [...path]);
      }

      recStack.delete(catId);
    }

    for (const cat of categories) {
      if (!visited.has(cat.id)) {
        detectCycle(cat.id, []);
      }
    }

    // Cycle'ları categoryStats'a işaretle
    const inCycleSet = new Set<number>();
    for (const cycle of cyclePaths) {
      for (const catId of cycle.path) {
        inCycleSet.add(catId);
      }
      cycles.push(cycle);
    }

    // 6. Depth hesapla (cycle varsa güvenli şekilde)
    console.log("📏 Depth hesaplanıyor...");
    const depthMap = new Map<number, number>();
    const maxDepth = 0;

    function calculateDepth(catId: number, visited: Set<number>, currentPath: number[]): number {
      if (visited.has(catId) || currentPath.includes(catId)) {
        // Cycle veya ziyaret edilmiş, güvenli depth döndür
        return depthMap.get(catId) || 0;
      }
      visited.add(catId);
      currentPath.push(catId);

      const parentId = parentMap.get(catId);
      if (parentId === undefined) {
        depthMap.set(catId, 0);
        currentPath.pop();
        return 0;
      }

      const parentDepth = calculateDepth(parentId, visited, currentPath);
      const depth = parentDepth + 1;
      depthMap.set(catId, depth);
      currentPath.pop();
      return depth;
    }

    const depthVisited = new Set<number>();
    for (const cat of categories) {
      if (!depthMap.has(cat.id)) {
        calculateDepth(cat.id, depthVisited, []);
      }
    }

    const actualMaxDepth = Math.max(...Array.from(depthMap.values()), 0);

    // 7. Leaf count ve children count hesapla
    console.log("🍃 Leaf ve children sayıları hesaplanıyor...");
    const leafCountMap = new Map<number, number>();
    const childrenCountMap = new Map<number, number>();

    function calculateLeafCount(catId: number, visited: Set<number>, currentPath: number[]): number {
      if (visited.has(catId) || currentPath.includes(catId)) {
        return leafCountMap.get(catId) || 0;
      }
      visited.add(catId);
      currentPath.push(catId);

      const children = childrenMap.get(catId) || [];
      childrenCountMap.set(catId, children.length);

      if (children.length === 0) {
        leafCountMap.set(catId, 1);
        currentPath.pop();
        return 1;
      }

      let leafCount = 0;
      for (const child of children) {
        leafCount += calculateLeafCount(child.id, visited, currentPath);
      }
      leafCountMap.set(catId, leafCount);
      currentPath.pop();
      return leafCount;
    }

    const leafVisited = new Set<number>();
    for (const cat of categories) {
      if (!leafCountMap.has(cat.id)) {
        calculateLeafCount(cat.id, leafVisited, []);
      }
    }

    // 8. Subtree ürün sayılarını hesapla (recursive, cycle-safe)
    console.log("🌲 Subtree ürün sayıları hesaplanıyor...");
    const subtreeCounts = new Map<number, {
      total: number;
      publish: number;
      instockPublish: number;
    }>();

    function calculateSubtree(catId: number, visited: Set<number>, currentPath: number[]): {
      total: number;
      publish: number;
      instockPublish: number;
    } {
      if (visited.has(catId) || currentPath.includes(catId)) {
        // Cycle veya ziyaret edilmiş, mevcut değeri döndür
        return subtreeCounts.get(catId) || { total: 0, publish: 0, instockPublish: 0 };
      }
      visited.add(catId);
      currentPath.push(catId);

      const direct = directProductCounts.get(catId) || { total: 0, publish: 0, instockPublish: 0 };
      const subtree = { ...direct };

      const children = childrenMap.get(catId) || [];
      for (const child of children) {
        const childSubtree = calculateSubtree(child.id, visited, currentPath);
        subtree.total += childSubtree.total;
        subtree.publish += childSubtree.publish;
        subtree.instockPublish += childSubtree.instockPublish;
      }

      subtreeCounts.set(catId, subtree);
      currentPath.pop();
      return subtree;
    }

    const subtreeVisited = new Set<number>();
    for (const cat of categories) {
      if (!subtreeCounts.has(cat.id)) {
        calculateSubtree(cat.id, subtreeVisited, []);
      }
    }

    // 9. CategoryStats oluştur
    console.log("📊 İstatistikler derleniyor...");
    const categoryStats: CategoryStats[] = categories.map((cat) => {
      const direct = directProductCounts.get(cat.id) || { total: 0, publish: 0, instockPublish: 0 };
      const subtree = subtreeCounts.get(cat.id) || { total: 0, publish: 0, instockPublish: 0 };
      return {
        category: cat,
        directTotal: direct.total,
        directPublish: direct.publish,
        directInstockPublish: direct.instockPublish,
        subtreeTotal: subtree.total,
        subtreePublish: subtree.publish,
        subtreeInstockPublish: subtree.instockPublish,
        childrenCount: childrenCountMap.get(cat.id) || 0,
        leafCount: leafCountMap.get(cat.id) || 0,
        depth: depthMap.get(cat.id) || 0,
        isOrphan: orphans.includes(cat.id),
        inCycle: inCycleSet.has(cat.id),
      };
    });

    // 10. Top-level kategorileri bul
    const topLevelCategories = categories.filter((cat) => cat.parentWcId === null);

    // 11. Duplicate slug/name tespiti
    console.log("🔍 Duplicate slug/name tespiti yapılıyor...");
    const slugCounts = new Map<string, number[]>();
    const nameCounts = new Map<string, number[]>();

    for (const cat of categories) {
      if (!slugCounts.has(cat.slug)) {
        slugCounts.set(cat.slug, []);
      }
      slugCounts.get(cat.slug)!.push(cat.id);

      if (!nameCounts.has(cat.name)) {
        nameCounts.set(cat.name, []);
      }
      nameCounts.get(cat.name)!.push(cat.id);
    }

    const duplicateSlugs = Array.from(slugCounts.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([slug, ids]) => ({ slug, categoryIds: ids }));
    const duplicateNames = Array.from(nameCounts.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([name, ids]) => ({ name, categoryIds: ids }));

    // 12. Boş kategoriler (direct=0 ve subtree=0)
    const emptyCategories = categoryStats.filter(
      (stats) => stats.directTotal === 0 && stats.subtreeTotal === 0
    );

    // 13. Aşırı şişkin kategoriler (subtree_instock_publish'e göre)
    const bloatedCategories = [...categoryStats]
      .sort((a, b) => b.subtreeInstockPublish - a.subtreeInstockPublish)
      .slice(0, 20);

    // 14. Rapor oluştur
    console.log("📝 Rapor oluşturuluyor...");

    // Markdown raporu
    const mdReport = generateMarkdownReport({
      totalCategories: categories.length,
      topLevelCount: topLevelCategories.length,
      childCount: categories.length - topLevelCategories.length,
      leafCount: categoryStats.filter((s) => s.childrenCount === 0).length,
      maxDepth: actualMaxDepth,
      orphanCount: orphans.length,
      cycleCount: cycles.length,
      cycles,
      topLevelCategories: topLevelCategories.map((cat) => {
        const stats = categoryStats.find((s) => s.category.id === cat.id)!;
        return { category: cat, stats };
      }),
      emptyCategories,
      bloatedCategories,
      duplicateSlugs,
      duplicateNames,
      orphans: orphans.map((id) => categoryById.get(id)!),
      categoryStats,
    });

    // CSV raporu
    const csvReport = generateCsvReport(categoryStats);

    // Mermaid tree (opsiyonel)
    const mermaidTree = generateMermaidTree(topLevelCategories, childrenMap, categoryById);

    // Dosyalara yaz
    const mdPath = join(OUTPUT_DIR, "CATEGORY_DETECTIVE_REPORT.md");
    const csvPath = join(OUTPUT_DIR, "CATEGORY_DETECTIVE_REPORT.csv");
    const mmdPath = join(OUTPUT_DIR, "category-tree.mmd");

    await writeFile(mdPath, mdReport, "utf-8");
    console.log(`  ✅ ${mdPath} oluşturuldu`);

    await writeFile(csvPath, csvReport, "utf-8");
    console.log(`  ✅ ${csvPath} oluşturuldu`);

    await writeFile(mmdPath, mermaidTree, "utf-8");
    console.log(`  ✅ ${mmdPath} oluşturuldu`);

    console.log("\n✅ Rapor oluşturma tamamlandı!");
  } catch (error) {
    console.error("❌ HATA:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function generateMarkdownReport(data: {
  totalCategories: number;
  topLevelCount: number;
  childCount: number;
  leafCount: number;
  maxDepth: number;
  orphanCount: number;
  cycleCount: number;
  cycles: CycleInfo[];
  topLevelCategories: Array<{ category: Category; stats: CategoryStats }>;
  emptyCategories: CategoryStats[];
  bloatedCategories: CategoryStats[];
  duplicateSlugs: Array<{ slug: string; categoryIds: number[] }>;
  duplicateNames: Array<{ name: string; categoryIds: number[] }>;
  orphans: Category[];
  categoryStats: CategoryStats[];
}): string {
  const lines: string[] = [];

  lines.push("# Category Detective Report");
  lines.push("");
  lines.push(`**Oluşturulma Tarihi:** ${new Date().toLocaleString("tr-TR")}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push("### Kategori İstatistikleri");
  lines.push(`- **Toplam Kategori:** ${data.totalCategories}`);
  lines.push(`- **Üst Kategori (parent yok):** ${data.topLevelCount}`);
  lines.push(`- **Alt Kategori (parent var):** ${data.childCount}`);
  lines.push(`- **Leaf Kategori (çocuk yok):** ${data.leafCount}`);
  lines.push(`- **Maksimum Depth:** ${data.maxDepth}`);
  lines.push("");
  lines.push("### Sorun Tespitleri");
  lines.push(`- **Orphan Kategori:** ${data.orphanCount}`);
  lines.push(`- **Cycle (Döngü):** ${data.cycleCount}`);
  lines.push(`- **Boş Kategori (0 ürün):** ${data.emptyCategories.length}`);
  lines.push(`- **Duplicate Slug:** ${data.duplicateSlugs.length}`);
  lines.push(`- **Duplicate Name:** ${data.duplicateNames.length}`);
  lines.push("");

  // Top-level overview
  lines.push("## Top-level Overview");
  lines.push("");
  lines.push("| Slug | Name | Children | Leaf | Subtree Total | Subtree Publish | Subtree Instock+Publish |");
  lines.push("|------|------|----------|------|---------------|-----------------|------------------------|");
  for (const { category, stats } of data.topLevelCategories) {
    lines.push(
      `| ${category.slug} | ${category.name} | ${stats.childrenCount} | ${stats.leafCount} | ${stats.subtreeTotal} | ${stats.subtreePublish} | ${stats.subtreeInstockPublish} |`
    );
  }
  lines.push("");

  // Suspicious / Cleanup candidates
  lines.push("## Suspicious / Cleanup Candidates");
  lines.push("");

  // Boş kategoriler
  if (data.emptyCategories.length > 0) {
    lines.push("### Boş Kategoriler (0 ürün)");
    lines.push("");
    lines.push("| ID | Slug | Name | Parent WC ID |");
    lines.push("|----|------|------|--------------|");
    for (const stats of data.emptyCategories.slice(0, 50)) {
      const cat = stats.category;
      lines.push(`| ${cat.id} | ${cat.slug} | ${cat.name} | ${cat.parentWcId ?? "null"} |`);
    }
    if (data.emptyCategories.length > 50) {
      lines.push(`\n*... ve ${data.emptyCategories.length - 50} kategori daha (CSV'ye bakın)*`);
    }
    lines.push("");
  }

  // Aşırı şişkin kategoriler
  lines.push("### Aşırı Şişkin Kategoriler (Top 20 - Subtree Instock+Publish)");
  lines.push("");
  lines.push("| ID | Slug | Name | Subtree Instock+Publish | Subtree Total |");
  lines.push("|----|------|------|------------------------|---------------|");
  for (const stats of data.bloatedCategories) {
    const cat = stats.category;
    lines.push(
      `| ${cat.id} | ${cat.slug} | ${cat.name} | ${stats.subtreeInstockPublish} | ${stats.subtreeTotal} |`
    );
  }
  lines.push("");

  // Duplicate slugs
  if (data.duplicateSlugs.length > 0) {
    lines.push("### Duplicate Slugs");
    lines.push("");
    lines.push("| Slug | Category IDs |");
    lines.push("|------|--------------|");
    for (const dup of data.duplicateSlugs) {
      lines.push(`| ${dup.slug} | ${dup.categoryIds.join(", ")} |`);
    }
    lines.push("");
  }

  // Duplicate names
  if (data.duplicateNames.length > 0) {
    lines.push("### Duplicate Names");
    lines.push("");
    lines.push("| Name | Category IDs |");
    lines.push("|------|--------------|");
    for (const dup of data.duplicateNames) {
      lines.push(`| ${dup.name} | ${dup.categoryIds.join(", ")} |`);
    }
    lines.push("");
  }

  // Orphan kategoriler
  if (data.orphans.length > 0) {
    lines.push("### Orphan Kategoriler");
    lines.push("");
    lines.push("| ID | Slug | Name | Parent WC ID |");
    lines.push("|----|------|------|--------------|");
    for (const cat of data.orphans) {
      lines.push(`| ${cat.id} | ${cat.slug} | ${cat.name} | ${cat.parentWcId} |`);
    }
    lines.push("");
  }

  // Cycles
  if (data.cycles.length > 0) {
    lines.push("### Cycle (Döngü) Detayları");
    lines.push("");
    for (const cycle of data.cycles) {
      const cycleCats = cycle.path.map((id) => {
        const cat = data.categoryStats.find((s) => s.category.id === id)?.category;
        return cat ? `${cat.slug} (ID: ${cat.id})` : `ID: ${id}`;
      });
      lines.push(`- **Cycle Path:** ${cycleCats.join(" → ")} → (döngü)`);
    }
    lines.push("");
  }

  // Full list referansı
  lines.push("## Full List");
  lines.push("");
  lines.push("Tüm kategorilerin detaylı listesi için `CATEGORY_DETECTIVE_REPORT.csv` dosyasına bakın.");
  lines.push("");

  return lines.join("\n");
}

function generateCsvReport(categoryStats: CategoryStats[]): string {
  const lines: string[] = [];

  // Header
  lines.push(
    "ID,WC ID,Slug,Name,Parent WC ID,Depth,Children Count,Leaf Count,Direct Total,Direct Publish,Direct Instock+Publish,Subtree Total,Subtree Publish,Subtree Instock+Publish,Is Orphan,In Cycle"
  );

  // Data
  for (const stats of categoryStats) {
    const cat = stats.category;
    lines.push(
      [
        cat.id,
        cat.wcId,
        `"${cat.slug}"`,
        `"${cat.name}"`,
        cat.parentWcId ?? "",
        stats.depth,
        stats.childrenCount,
        stats.leafCount,
        stats.directTotal,
        stats.directPublish,
        stats.directInstockPublish,
        stats.subtreeTotal,
        stats.subtreePublish,
        stats.subtreeInstockPublish,
        stats.isOrphan ? "Yes" : "No",
        stats.inCycle ? "Yes" : "No",
      ].join(",")
    );
  }

  return lines.join("\n");
}

function generateMermaidTree(
  topLevelCategories: Category[],
  childrenMap: Map<number, Category[]>,
  categoryById: Map<number, Category>
): string {
  const lines: string[] = [];
  lines.push("graph TD");

  function addNode(catId: number, visited: Set<number>, currentPath: number[]): void {
    if (visited.has(catId) || currentPath.includes(catId)) {
      return; // Cycle veya ziyaret edilmiş, atla
    }
    visited.add(catId);
    currentPath.push(catId);

    const cat = categoryById.get(catId);
    if (!cat) return;

    const nodeId = `cat${catId}`;
    const label = `${cat.slug}\\n(${cat.name})`;
    lines.push(`    ${nodeId}["${label}"]`);

    const children = childrenMap.get(catId) || [];
    for (const child of children) {
      const childNodeId = `cat${child.id}`;
      lines.push(`    ${nodeId} --> ${childNodeId}`);
      addNode(child.id, visited, currentPath);
    }

    currentPath.pop();
  }

  const visited = new Set<number>();
  for (const topCat of topLevelCategories) {
    addNode(topCat.id, visited, []);
  }

  return lines.join("\n");
}

// Script'i çalıştır
main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
