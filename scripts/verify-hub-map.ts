import dotenv from "dotenv";
import { Pool } from "pg";
import { getCategoryItemsFromHubMap } from "../src/config/hub-map";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

async function main() {
  console.log("🔍 Hub Map Doğrulama başlatılıyor...\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 1. Hub Map'ten category item'larını al
    console.log("📥 Hub Map'ten kategori slug'ları çekiliyor...");
    const hubMapItems = getCategoryItemsFromHubMap();
    const hubMapSlugs = hubMapItems
      .filter((item) => item.slug)
      .map((item) => item.slug!);
    console.log(`  ✅ ${hubMapSlugs.length} kategori slug'ı Hub Map'te bulundu\n`);

    // 2. DB'den tüm kategori slug'larını çek
    console.log("📥 Veritabanından kategori slug'ları çekiliyor...");
    const dbResult = await pool.query<{ slug: string }>(`
      SELECT slug
      FROM categories
      ORDER BY slug
    `);
    const dbSlugs = new Set(dbResult.rows.map((row) => row.slug));
    console.log(`  ✅ ${dbSlugs.size} kategori slug'ı DB'de bulundu\n`);

    // 3. Hub Map'teki slug'ların DB'de varlığını kontrol et
    console.log("🔍 Hub Map slug'larının DB'de varlığı kontrol ediliyor...");
    const missingSlugs: string[] = [];

    for (const slug of hubMapSlugs) {
      if (!dbSlugs.has(slug)) {
        missingSlugs.push(slug);
      }
    }

    // 4. Sonuçları raporla
    if (missingSlugs.length === 0) {
      console.log("  ✅ Tüm Hub Map slug'ları DB'de mevcut!\n");
      console.log("✅ Hub Map doğrulama PASS\n");
      process.exit(0);
    } else {
      console.log(`  ❌ ${missingSlugs.length} slug DB'de bulunamadı:\n`);
      for (const slug of missingSlugs) {
        const item = hubMapItems.find((item) => item.slug === slug);
        console.log(`    - ${slug} (${item?.label || "unknown"})`);
      }
      console.log("\n❌ Hub Map doğrulama FAIL\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Hata oluştu:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
