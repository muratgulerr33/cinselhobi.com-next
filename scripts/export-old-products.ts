import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

// DATABASE_URL'yi güvenli al
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

// Çıktı klasörü
const OUTPUT_DIR = join(process.cwd(), "old-products");

// CSV escape fonksiyonu
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  const str = String(value);
  // Tırnak karakterlerini çift tırnak yap
  const escaped = str.replace(/"/g, '""');
  // Tırnak ile sar
  return `"${escaped}"`;
}

// CSV satırı oluştur
function createCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(",");
}

// Tablo export fonksiyonu
async function exportTable(
  pool: Pool,
  tableName: string
): Promise<{ rowCount: number; columns: string[] }> {
  // Tablo adını identifier olarak quote et
  const quotedTableName = `"${tableName}"`;
  
  // Kolonları sırayla al
  const columnsQuery = `
    SELECT column_name, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const columnsResult = await pool.query(columnsQuery, [tableName]);
  const columns = columnsResult.rows.map((row) => row.column_name);
  
  if (columns.length === 0) {
    throw new Error(`Tablo ${tableName} için kolon bulunamadı`);
  }
  
  // Veriyi çek
  const dataQuery = `SELECT * FROM ${quotedTableName}`;
  const dataResult = await pool.query(dataQuery);
  
  // CSV oluştur
  const csvLines: string[] = [];
  
  // Header
  csvLines.push(createCsvRow(columns));
  
  // Data rows
  for (const row of dataResult.rows) {
    const values = columns.map((col) => row[col]);
    csvLines.push(createCsvRow(values));
  }
  
  // Dosyaya yaz
  const csvContent = csvLines.join("\n");
  const csvPath = join(OUTPUT_DIR, `${tableName}.csv`);
  await writeFile(csvPath, csvContent, "utf-8");
  
  return {
    rowCount: dataResult.rows.length,
    columns,
  };
}

// Ana fonksiyon
async function main() {
  console.log("🚀 Ürün/Kategori verileri export ediliyor...\n");
  
  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }
  
  // Postgres bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  
  try {
    // Product/categor içeren tabloları bul
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND (
          LOWER(table_name) LIKE '%product%'
          OR LOWER(table_name) LIKE '%categor%'
        )
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    
    if (tableNames.length === 0) {
      console.log("⚠️  Product/categor içeren tablo bulunamadı.\n");
      return;
    }
    
    console.log(`📊 ${tableNames.length} tablo bulundu:\n`);
    for (const tableName of tableNames) {
      console.log(`   - ${tableName}`);
    }
    console.log();
    
    // Her tabloyu export et
    const exportResults: Array<{
      tableName: string;
      rowCount: number;
      columnCount: number;
    }> = [];
    
    for (const tableName of tableNames) {
      console.log(`📤 ${tableName} export ediliyor...`);
      try {
        const { rowCount, columns } = await exportTable(pool, tableName);
        exportResults.push({
          tableName,
          rowCount,
          columnCount: columns.length,
        });
        console.log(`   ✅ ${rowCount} satır, ${columns.length} kolon\n`);
      } catch (error) {
        console.error(`   ❌ Hata: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
    
    // DATABASE_URL'den güvenli bilgiler çıkar (sadece host ve db name)
    let dbHost = "unknown";
    let dbName = "unknown";
    try {
      // DATABASE_URL zaten yukarıda kontrol edildi, burada undefined olamaz
      const url = new URL(DATABASE_URL as string);
      dbHost = url.hostname;
      dbName = url.pathname.slice(1) || "unknown";
    } catch {
      // URL parse edilemezse olduğu gibi bırak
    }
    
    // Manifest oluştur
    const manifest = {
      exportedAt: new Date().toISOString(),
      dbHost,
      dbName,
      tables: exportResults.map((r) => ({
        name: r.tableName,
        rowCount: r.rowCount,
        columnCount: r.columnCount,
      })),
      totalTables: exportResults.length,
      totalRows: exportResults.reduce((sum, r) => sum + r.rowCount, 0),
    };
    
    const manifestPath = join(OUTPUT_DIR, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    
    console.log("✨ Export tamamlandı!\n");
    console.log("📊 Özet:");
    console.log(`   - Tablo sayısı: ${exportResults.length}`);
    console.log(`   - Toplam satır: ${manifest.totalRows}`);
    console.log("\n📋 Export edilen tablolar:");
    for (const result of exportResults) {
      console.log(`   - ${result.tableName}: ${result.rowCount} satır`);
    }
    console.log(`\n💾 Dosyalar: ${OUTPUT_DIR}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
