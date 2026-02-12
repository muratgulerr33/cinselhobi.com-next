import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir } from "fs/promises";
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

// Bağlaç listesi
const CONJUNCTIONS = ["ve", "ile", "veya", "yada", "ya-da"];

// Slug'da bağlaç var mı kontrol et
function hasConjunction(slug: string): boolean {
  // Regex: (^|-) (ve|ile|veya|yada|ya-da) (-|$)
  const pattern = new RegExp(`(^|-)(?:${CONJUNCTIONS.map(c => c.replace(/-/g, "\\-")).join("|")})(-|$)`);
  return pattern.test(slug);
}

// Bağlaçları temizle ve yeni slug üret
function removeConjunction(slug: string): string {
  let newSlug = slug;
  
  // Her bağlacı kaldır
  for (const conj of CONJUNCTIONS) {
    // Başta veya sonda veya ortada (tire ile çevrili) bağlaçları kaldır
    const patterns = [
      new RegExp(`^-${conj.replace(/-/g, "\\-")}-`, "g"), // -bağlaç-
      new RegExp(`^-${conj.replace(/-/g, "\\-")}$`, "g"), // -bağlaç (sonda)
      new RegExp(`^${conj.replace(/-/g, "\\-")}-`, "g"),  // bağlaç- (başta)
      new RegExp(`-${conj.replace(/-/g, "\\-")}-`, "g"), // -bağlaç- (ortada)
      new RegExp(`-${conj.replace(/-/g, "\\-")}$`, "g"), // -bağlaç (sonda)
    ];
    
    for (const pattern of patterns) {
      newSlug = newSlug.replace(pattern, "-");
    }
  }
  
  // Çift tire'leri tek tire'ye çevir
  newSlug = newSlug.replace(/-+/g, "-");
  
  // Baş ve sondaki tire'leri temizle
  newSlug = newSlug.replace(/^-+|-+$/g, "");
  
  return newSlug;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

interface AuditRow {
  id: number;
  name: string;
  old_slug: string;
  new_slug: string;
  has_conjunction: boolean;
  collision_with: string | null;
  action: "update" | "skip";
  notes: string;
}

async function main() {
  console.log("🔍 Kategori slug'larında bağlaç analizi başlatılıyor...\n");

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Tüm kategorileri çek
    console.log("📊 Kategoriler veritabanından çekiliyor...");
    const result = await pool.query<CategoryRow>(
      `SELECT id, name, slug FROM categories ORDER BY id`
    );

    console.log(`  ✅ ${result.rows.length} kategori bulundu\n`);

    // Bağlaç içeren slug'ları bul
    console.log("🔎 Bağlaç içeren slug'lar taranıyor...");
    const candidates: AuditRow[] = [];

    for (const row of result.rows) {
      if (hasConjunction(row.slug)) {
        const newSlug = removeConjunction(row.slug);
        
        // Boş slug kontrolü
        if (!newSlug || newSlug.trim() === "") {
          candidates.push({
            id: row.id,
            name: row.name,
            old_slug: row.slug,
            new_slug: "",
            has_conjunction: true,
            collision_with: null,
            action: "skip",
            notes: "Yeni slug boş - bağlaç kaldırılınca slug kalmadı",
          });
          continue;
        }

        candidates.push({
          id: row.id,
          name: row.name,
          old_slug: row.slug,
          new_slug: newSlug,
          has_conjunction: true,
          collision_with: null,
          action: "update",
          notes: "",
        });
      }
    }

    console.log(`  ✅ ${candidates.length} kategori bağlaç içeriyor\n`);

    // Çakışma kontrolü
    console.log("⚠️  Çakışma kontrolü yapılıyor...");
    const allSlugs = new Set(result.rows.map((r) => r.slug));
    const newSlugMap = new Map<string, number[]>(); // newSlug -> category ids

    for (const candidate of candidates) {
      if (candidate.action === "skip") continue;

      // Yeni slug zaten başka bir kategoride var mı?
      if (allSlugs.has(candidate.new_slug)) {
        // Aynı kategori değilse çakışma var
        const existingCategory = result.rows.find((r) => r.slug === candidate.new_slug);
        if (existingCategory && existingCategory.id !== candidate.id) {
          candidate.collision_with = `${existingCategory.name} (id: ${existingCategory.id})`;
          candidate.action = "skip";
          candidate.notes = `Çakışma: "${candidate.new_slug}" slug'ı zaten "${existingCategory.name}" kategorisinde kullanılıyor`;
        }
      }

      // Aynı new_slug'a sahip birden fazla candidate var mı?
      if (!newSlugMap.has(candidate.new_slug)) {
        newSlugMap.set(candidate.new_slug, []);
      }
      newSlugMap.get(candidate.new_slug)!.push(candidate.id);
    }

    // Aynı new_slug'a sahip birden fazla candidate varsa, hepsini skip et
    for (const [newSlug, ids] of newSlugMap.entries()) {
      if (ids.length > 1) {
        for (const candidate of candidates) {
          if (candidate.new_slug === newSlug && candidate.action === "update") {
            candidate.action = "skip";
            candidate.notes = `Çakışma: "${newSlug}" slug'ı ${ids.length} kategori için aynı (diğer kategori ID'leri: ${ids.filter(id => id !== candidate.id).join(", ")})`;
          }
        }
      }
    }

    const collisionCount = candidates.filter((c) => c.collision_with !== null || c.action === "skip").length;
    const updateCount = candidates.filter((c) => c.action === "update").length;
    console.log(`  ✅ Çakışma kontrolü tamamlandı:`);
    console.log(`     - Güncellenecek: ${updateCount}`);
    console.log(`     - Atlanacak: ${collisionCount}\n`);

    // CSV dosyasını oluştur
    console.log("📝 CSV raporu oluşturuluyor...");
    
    if (!existsSync(OUTPUT_DIR)) {
      await mkdir(OUTPUT_DIR, { recursive: true });
    }

    const csvPath = join(OUTPUT_DIR, "category-slug-conjunction-audit.csv");
    const csvLines: string[] = [
      ["id", "name", "old_slug", "new_slug", "has_conjunction", "collision_with", "action", "notes"]
        .map(escapeCsv)
        .join(","),
    ];

    for (const row of candidates) {
      csvLines.push(
        [
          row.id,
          row.name,
          row.old_slug,
          row.new_slug,
          row.has_conjunction ? "true" : "false",
          row.collision_with || "",
          row.action,
          row.notes,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    await writeFile(csvPath, csvLines.join("\n") + "\n", "utf-8");
    console.log(`  ✅ CSV raporu oluşturuldu: ${csvPath}\n`);

    // Özet
    console.log("📊 ÖZET:");
    console.log(`   - Toplam kategori: ${result.rows.length}`);
    console.log(`   - Bağlaç içeren: ${candidates.length}`);
    console.log(`   - Güncellenecek: ${updateCount}`);
    console.log(`   - Atlanacak: ${collisionCount}`);
    console.log(`   - CSV dosyası: ${csvPath}\n`);

    // Örnekler göster
    if (updateCount > 0) {
      console.log("📋 Güncellenecek örnekler (ilk 5):");
      const examples = candidates.filter((c) => c.action === "update").slice(0, 5);
      for (const ex of examples) {
        console.log(`   - "${ex.old_slug}" → "${ex.new_slug}" (${ex.name})`);
      }
      console.log();
    }

    if (collisionCount > 0) {
      console.log("⚠️  Atlanacak örnekler (ilk 5):");
      const skipped = candidates.filter((c) => c.action === "skip").slice(0, 5);
      for (const ex of skipped) {
        console.log(`   - "${ex.old_slug}" → "${ex.new_slug}" (${ex.name})`);
        console.log(`     Not: ${ex.notes}`);
      }
      console.log();
    }

  } catch (error) {
    console.error("❌ HATA:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
