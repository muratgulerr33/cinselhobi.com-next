import dotenv from "dotenv";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

// Çıktı klasörü
const OUTPUT_DIR = join(process.cwd(), "old-products");

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
  if (current) headers.push(current.trim());

  // Data satırlarını parse et
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values: string[] = [];
    current = "";
    inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // Tırnakları kaldır
        const cleaned = current.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
        values.push(cleaned);
        current = "";
      } else {
        current += char;
      }
    }
    // Son değeri ekle
    if (current || values.length > 0) {
      const cleaned = current.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
      values.push(cleaned);
    }

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      for (let k = 0; k < headers.length; k++) {
        // Header'dan da tırnakları kaldır
        const headerKey = headers[k].replace(/^"|"$/g, '').replace(/""/g, '"');
        row[headerKey] = values[k] || "";
      }
      rows.push(row);
    }
  }

  return rows;
}

// SQL string escape
function sqlEscape(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log("🔧 Kategori slug güncelleme SQL dosyaları oluşturuluyor...\n");

  const csvPath = join(OUTPUT_DIR, "category-slug-conjunction-audit.csv");
  
  if (!existsSync(csvPath)) {
    console.error(`❌ HATA: ${csvPath} dosyası bulunamadı.`);
    console.error("   Önce 'audit-category-slugs-conjunctions.ts' script'ini çalıştırın.");
    process.exit(1);
  }

  console.log(`📖 CSV dosyası okunuyor: ${csvPath}`);
  const csvContent = await readFile(csvPath, "utf-8");
  const rows = parseCsv(csvContent);

  console.log(`  ✅ ${rows.length} satır parse edildi`);
  if (rows.length > 0) {
    console.log(`  Örnek satır:`, JSON.stringify(rows[0]));
  }

  // Sadece action="update" olanları filtrele
  const updateRows = rows.filter((row) => row.action === "update");

  if (updateRows.length === 0) {
    console.log("⚠️  Güncellenecek kategori bulunamadı.");
    return;
  }

  console.log(`  ✅ ${updateRows.length} kategori güncellenecek\n`);

  // SQL dosyalarını oluştur
  const planSqlPath = join(OUTPUT_DIR, "category-slug-update-plan.sql");
  const applySqlPath = join(OUTPUT_DIR, "category-slug-update-apply.sql");

  // Plan SQL (ROLLBACK)
  const planSqlLines: string[] = [
    "-- Kategori Slug Güncelleme - PLAN (ROLLBACK)",
    "-- Bu dosya test amaçlıdır. Çalıştırıldığında değişiklikler geri alınır.",
    "",
    "BEGIN;",
    "",
  ];

  // Apply SQL (COMMIT)
  const applySqlLines: string[] = [
    "-- Kategori Slug Güncelleme - APPLY (COMMIT)",
    "-- Bu dosya gerçek güncellemeleri yapar. Çalıştırmadan önce plan.sql'i test edin!",
    "",
    "BEGIN;",
    "",
  ];

  // UPDATE statement'ları
  const oldSlugs: string[] = [];
  for (const row of updateRows) {
    const id = row.id;
    const oldSlug = row.old_slug;
    const newSlug = row.new_slug;

    oldSlugs.push(oldSlug);

    const updateSql = `UPDATE categories SET slug = ${sqlEscape(newSlug)} WHERE id = ${id};`;
    planSqlLines.push(updateSql);
    applySqlLines.push(updateSql);
  }

  planSqlLines.push("");
  applySqlLines.push("");

  // Doğrulama query'leri
  planSqlLines.push("-- Doğrulama query'leri:");
  planSqlLines.push("-- 1. Duplicate slug kontrolü (0 satır olmalı):");
  planSqlLines.push(
    "SELECT slug, COUNT(*) as count FROM categories GROUP BY slug HAVING COUNT(*) > 1;"
  );
  planSqlLines.push("");
  planSqlLines.push("-- 2. Eski slug'lardan kalan var mı? (0 satır olmalı):");
  if (oldSlugs.length > 0) {
    const oldSlugsSql = oldSlugs.map((s) => sqlEscape(s)).join(", ");
    planSqlLines.push(
      `SELECT COUNT(*) as count FROM categories WHERE slug IN (${oldSlugsSql});`
    );
  }
  planSqlLines.push("");
  planSqlLines.push("-- 3. Güncellenen kategori sayısı:");
  planSqlLines.push(`SELECT COUNT(*) as updated_count FROM categories WHERE id IN (${updateRows.map((r) => r.id).join(", ")});`);
  planSqlLines.push("");
  planSqlLines.push("ROLLBACK;");
  planSqlLines.push("-- NOT: Yukarıdaki ROLLBACK ile değişiklikler geri alınır.");

  applySqlLines.push("-- Doğrulama query'leri:");
  applySqlLines.push("-- 1. Duplicate slug kontrolü (0 satır olmalı):");
  applySqlLines.push(
    "SELECT slug, COUNT(*) as count FROM categories GROUP BY slug HAVING COUNT(*) > 1;"
  );
  applySqlLines.push("");
  applySqlLines.push("-- 2. Eski slug'lardan kalan var mı? (0 satır olmalı):");
  if (oldSlugs.length > 0) {
    const oldSlugsSql = oldSlugs.map((s) => sqlEscape(s)).join(", ");
    applySqlLines.push(
      `SELECT COUNT(*) as count FROM categories WHERE slug IN (${oldSlugsSql});`
    );
  }
  applySqlLines.push("");
  applySqlLines.push("-- 3. Güncellenen kategori sayısı:");
  applySqlLines.push(`SELECT COUNT(*) as updated_count FROM categories WHERE id IN (${updateRows.map((r) => r.id).join(", ")});`);
  applySqlLines.push("");
  applySqlLines.push("COMMIT;");
  applySqlLines.push("-- NOT: Değişiklikler kaydedildi.");

  // Dosyaları yaz
  console.log("📝 SQL dosyaları oluşturuluyor...");
  await writeFile(planSqlPath, planSqlLines.join("\n") + "\n", "utf-8");
  await writeFile(applySqlPath, applySqlLines.join("\n") + "\n", "utf-8");

  console.log(`  ✅ Plan SQL: ${planSqlPath}`);
  console.log(`  ✅ Apply SQL: ${applySqlPath}\n`);

  // Özet
  console.log("📊 ÖZET:");
  console.log(`   - Güncellenecek kategori: ${updateRows.length}`);
  console.log(`   - Plan SQL: ${planSqlPath}`);
  console.log(`   - Apply SQL: ${applySqlPath}\n`);

  console.log("⚠️  ÖNEMLİ:");
  console.log("   1. Önce plan.sql dosyasını çalıştırın ve sonuçları kontrol edin.");
  console.log("   2. Doğrulama query'leri 0 satır döndürmeli (duplicate ve eski slug kontrolü).");
  console.log("   3. Her şey doğruysa apply.sql dosyasını çalıştırın.\n");
}

main();
