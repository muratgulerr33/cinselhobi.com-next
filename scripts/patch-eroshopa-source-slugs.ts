import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// PATCH haritası: wc_id -> yeni slug
const PATCH_MAP: Record<number, string> = {
  294: "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml-cilekli",
  292: "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml",
  293: "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-400-ml",
  268: "silky-kiss-aloe-vera-ozlu-prezervatif",
};

interface Change {
  wc_id: number | string;
  old_slug: string;
  new_slug: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getWcId(item: any): number | null {
  // wc_id veya external_id alanlarını kontrol et
  const candidates = ["wc_id", "external_id"];
  for (const key of candidates) {
    if (item[key] !== undefined && item[key] !== null) {
      const num = Number(item[key]);
      if (!isNaN(num) && num > 0) {
        return Math.floor(num);
      }
    }
  }
  return null;
}

async function main() {
  console.log("🚀 EroshopA kaynak slug patch işlemi başlatılıyor...\n");

  // 1. Kaynak JSON'u oku
  const sourcePath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
  console.log("📂 Kaynak JSON okunuyor...");
  const sourceContent = await readFile(sourcePath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceProducts: any[] = JSON.parse(sourceContent);

  if (!Array.isArray(sourceProducts)) {
    console.error("❌ HATA: JSON bir array değil!");
    process.exit(1);
  }

  console.log(`  ✅ ${sourceProducts.length} ürün okundu\n`);

  // 2. Patch işlemi
  console.log("🔧 Slug patch işlemi yapılıyor...");
  const changes: Change[] = [];
  let changedCount = 0;

  for (const item of sourceProducts) {
    const wcId = getWcId(item);
    if (wcId === null) {
      continue; // wc_id yoksa skip et
    }

    const newSlug = PATCH_MAP[wcId];
    if (!newSlug) {
      continue; // Bu wc_id için patch yok
    }

    const oldSlug = item.slug || "";
    if (oldSlug === newSlug) {
      // Zaten doğru slug'a sahip
      continue;
    }

    // Slug'ı güncelle
    item.slug = newSlug;
    changedCount++;
    changes.push({
      wc_id: wcId,
      old_slug: oldSlug,
      new_slug: newSlug,
    });
  }

  console.log(`  ✅ ${changedCount} ürün güncellendi\n`);

  // 3. Duplicate slug kontrolü (sadece patch edilen slug'lar için)
  console.log("🔍 Duplicate slug kontrolü yapılıyor...");
  const patchedSlugs = new Set(changes.map((c) => c.new_slug));
  const slugCount = new Map<string, number>();
  
  // Sadece patch edilen slug'ları kontrol et
  for (const item of sourceProducts) {
    const slug = item.slug;
    if (slug && patchedSlugs.has(slug)) {
      slugCount.set(slug, (slugCount.get(slug) || 0) + 1);
    }
  }

  const duplicates: string[] = [];
  for (const [slug, count] of slugCount.entries()) {
    if (count > 1) {
      duplicates.push(slug);
    }
  }

  if (duplicates.length > 0) {
    console.error("❌ HATA: Patch edilen slug'larda duplicate bulundu:");
    for (const slug of duplicates) {
      console.error(`   - "${slug}" (${slugCount.get(slug)} kez)`);
    }
    process.exit(1);
  }

  console.log("  ✅ Patch edilen slug'larda duplicate yok\n");

  // 4. Patched JSON'u kaydet
  const patchedPath = join(process.cwd(), "old-products", "eroshopa-products.final.patched.json");
  console.log("💾 Patched JSON kaydediliyor...");
  await writeFile(patchedPath, JSON.stringify(sourceProducts, null, 2), "utf-8");
  console.log(`  ✅ ${patchedPath}\n`);

  // 5. CSV raporu oluştur
  const reportPath = join(process.cwd(), "old-products", "source-slug-patch-report.csv");
  console.log("📊 CSV raporu oluşturuluyor...");
  const csvLines = ["wc_id,old_slug,new_slug"];
  for (const change of changes) {
    csvLines.push(`${change.wc_id},"${change.old_slug}","${change.new_slug}"`);
  }
  await writeFile(reportPath, csvLines.join("\n"), "utf-8");
  console.log(`  ✅ ${reportPath}\n`);

  // 6. Özet
  console.log("📊 Özet:");
  console.log(`   Changed rows: ${changedCount}`);
  console.log(`   Patched file: ${patchedPath}`);
  console.log(`   Report file: ${reportPath}`);
  console.log();

  // 7. Doğrulama önerileri
  if (changedCount > 0) {
    console.log("🔍 Doğrulama önerileri:");
    console.log(`   - Patched dosyada 4 slug kontrolü: grep -c "bona-tessa-su-bazli-kayganlastirici-masaj-jeli" ${patchedPath}`);
    console.log(`   - Report CSV'de satır sayısı: wc -l ${reportPath}`);
    console.log();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
