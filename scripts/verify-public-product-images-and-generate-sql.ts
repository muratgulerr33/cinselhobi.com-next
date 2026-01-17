import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir, readdir } from "fs/promises";
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
const PUBLIC_PRODUCTS_DIR = join(process.cwd(), "public", "products");

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

// Levenshtein distance (edit distance) hesaplama
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// En yakın slug bulma
function findClosestSlug(targetSlug: string, candidateSlugs: string[]): string | null {
  if (candidateSlugs.length === 0) return null;
  
  let minDistance = Infinity;
  let closestSlug: string | null = null;
  
  for (const candidate of candidateSlugs) {
    const distance = levenshteinDistance(targetSlug, candidate);
    if (distance < minDistance) {
      minDistance = distance;
      closestSlug = candidate;
    }
  }
  
  // Eğer distance çok büyükse (örneğin slug uzunluğunun yarısından fazla), null döndür
  const maxReasonableDistance = Math.max(targetSlug.length, 20) * 0.5;
  if (minDistance > maxReasonableDistance) {
    return null;
  }
  
  return closestSlug;
}

// Public klasör taraması
interface PublicFolderInfo {
  slug: string;
  coverExists: boolean;
  galleryFiles: string[]; // Kapak dışındaki tüm .webp dosyaları
  allFiles: string[]; // Tüm .webp dosyaları (kapak dahil)
  notes: string[];
}

async function scanPublicFolders(): Promise<Map<string, PublicFolderInfo>> {
  console.log("📁 Public klasörleri taranıyor...");
  
  if (!existsSync(PUBLIC_PRODUCTS_DIR)) {
    console.warn(`⚠️  ${PUBLIC_PRODUCTS_DIR} klasörü bulunamadı`);
    return new Map();
  }
  
  const folders = await readdir(PUBLIC_PRODUCTS_DIR, { withFileTypes: true });
  const folderMap = new Map<string, PublicFolderInfo>();
  
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    
    const slug = folder.name;
    const folderPath = join(PUBLIC_PRODUCTS_DIR, slug);
    
    // Cover dosyası kontrolü
    const coverFileName = `${slug}.webp`;
    const coverPath = join(folderPath, coverFileName);
    const coverExists = existsSync(coverPath);
    
    // Tüm .webp dosyalarını al
    const allFiles = await readdir(folderPath);
    const allWebpFiles = allFiles
      .filter(f => f.endsWith(".webp"))
      .sort(); // Alfabetik sıralama (deterministik)
    
    // Galeri dosyaları: kapak dışındaki tüm .webp dosyaları
    const galleryFiles = allWebpFiles
      .filter(f => f !== coverFileName)
      .sort(); // Alfabetik sıralama
    
    const notes: string[] = [];
    if (!coverExists && allWebpFiles.length > 0) {
      notes.push(`Kapak dosyası (${coverFileName}) bulunamadı, skip edilecek`);
    }
    
    folderMap.set(slug, {
      slug,
      coverExists,
      galleryFiles,
      allFiles: allWebpFiles,
      notes,
    });
  }
  
  console.log(`✅ ${folderMap.size} klasör bulundu\n`);
  return folderMap;
}

// DB'den ürünleri çek
interface DbProduct {
  slug: string;
  name: string;
  images: unknown;
  imgCount: number; // jsonb_array_length(images)
}

async function fetchDbProducts(pool: Pool): Promise<DbProduct[]> {
  console.log("📊 Veritabanından ürünler çekiliyor...");
  
  const query = `
    SELECT 
      slug, 
      name, 
      images,
      COALESCE(jsonb_array_length(images), 0) AS img_count
    FROM products
    WHERE status = 'publish' AND stock_status = 'instock'
    ORDER BY slug
  `;
  
  const result = await pool.query(query);
  console.log(`✅ ${result.rows.length} ürün bulundu\n`);
  
  return result.rows.map(row => ({
    slug: row.slug,
    name: row.name,
    images: row.images,
    imgCount: parseInt(row.img_count, 10) || 0,
  }));
}

// Galeri audit bilgisi
interface GalleryAuditInfo {
  slug: string;
  public_file_count: number;
  public_cover_exists: boolean;
  public_gallery_count: number;
  db_img_count: number;
  needs_update: boolean;
  notes: string;
}

// Galeri audit CSV oluştur
function generateGalleryAudit(
  dbProducts: DbProduct[],
  publicFolders: Map<string, PublicFolderInfo>
): GalleryAuditInfo[] {
  console.log("🔍 Galeri audit bilgisi oluşturuluyor...");
  
  const auditInfos: GalleryAuditInfo[] = [];
  const productMap = new Map(dbProducts.map(p => [p.slug, p]));
  
  // DB ürünleri için audit
  for (const product of dbProducts) {
    const publicInfo = publicFolders.get(product.slug);
    
    if (publicInfo) {
      const publicFileCount = publicInfo.allFiles.length;
      const publicGalleryCount = publicInfo.galleryFiles.length;
      const dbImgCount = product.imgCount;
      const needsUpdate = dbImgCount !== publicFileCount;
      
      auditInfos.push({
        slug: product.slug,
        public_file_count: publicFileCount,
        public_cover_exists: publicInfo.coverExists,
        public_gallery_count: publicGalleryCount,
        db_img_count: dbImgCount,
        needs_update: needsUpdate,
        notes: publicInfo.notes.join("; ") || "",
      });
    } else {
      // Public klasörü yok
      auditInfos.push({
        slug: product.slug,
        public_file_count: 0,
        public_cover_exists: false,
        public_gallery_count: 0,
        db_img_count: product.imgCount,
        needs_update: false,
        notes: "Public klasörü bulunamadı",
      });
    }
  }
  
  // Public'de var ama DB'de olmayan klasörler
  for (const [slug, info] of publicFolders.entries()) {
    if (!productMap.has(slug)) {
      auditInfos.push({
        slug,
        public_file_count: info.allFiles.length,
        public_cover_exists: info.coverExists,
        public_gallery_count: info.galleryFiles.length,
        db_img_count: 0,
        needs_update: false,
        notes: "DB'de ürün bulunamadı",
      });
    }
  }
  
  console.log(`✅ ${auditInfos.length} audit kaydı oluşturuldu\n`);
  
  return auditInfos;
}

// SQL escape (JSONB için - PostgreSQL literal format)
function escapeJsonbString(str: string): string {
  // PostgreSQL'de JSONB literal için tek tırnak içine alınır
  // İçindeki tek tırnaklar '' ile escape edilir
  return str.replace(/'/g, "''");
}

// SQL dosyaları oluştur
async function generateSqlFiles(
  auditInfos: GalleryAuditInfo[],
  dbProducts: DbProduct[],
  publicFolders: Map<string, PublicFolderInfo>
): Promise<void> {
  console.log("📝 SQL dosyaları oluşturuluyor...");
  
  const productMap = new Map(dbProducts.map(p => [p.slug, p]));
  const updates: Array<{ slug: string; imagesJson: string }> = [];
  
  // Sadece needs_update=true olanları işle
  for (const audit of auditInfos) {
    if (!audit.needs_update || !audit.public_cover_exists) {
      continue;
    }
    
    const product = productMap.get(audit.slug);
    if (!product) continue;
    
    const publicInfo = publicFolders.get(audit.slug);
    if (!publicInfo) continue;
    
    // Images array oluştur
    const images: Array<{ src: string; alt?: string }> = [];
    
    // Cover (ilk eleman)
    images.push({
      src: `/products/${audit.slug}/${audit.slug}.webp`,
      alt: product.name,
    });
    
    // Galeri dosyaları (alfabetik sıralı)
    for (const galleryFile of publicInfo.galleryFiles) {
      images.push({
        src: `/products/${audit.slug}/${galleryFile}`,
        alt: product.name,
      });
    }
    
    // JSONB string oluştur
    const imagesJson = JSON.stringify(images);
    updates.push({ slug: audit.slug, imagesJson });
  }
  
  // Plan SQL (BEGIN ... ROLLBACK)
  const planSql: string[] = [
    "-- Plan SQL: Bu dosyayı çalıştırarak etkilenecek satırları görebilirsiniz",
    "-- ROLLBACK ile değişiklikler geri alınır",
    "",
    "BEGIN;",
    "",
    `-- ${updates.length} ürün güncellenecek`,
    "",
  ];
  
  // Apply SQL (BEGIN ... COMMIT)
  const applySql: string[] = [
    "-- Apply SQL: Bu dosyayı çalıştırarak değişiklikleri uygulayabilirsiniz",
    "-- COMMIT ile değişiklikler kalıcı olur",
    "",
    "BEGIN;",
    "",
    `-- ${updates.length} ürün güncellenecek`,
    "",
  ];
  
  for (const update of updates) {
    const escapedJson = escapeJsonbString(update.imagesJson);
    const escapedSlug = update.slug.replace(/'/g, "''");
    const sqlLine = `UPDATE products SET images = '${escapedJson}'::jsonb WHERE slug = '${escapedSlug}';`;
    
    planSql.push(sqlLine);
    applySql.push(sqlLine);
  }
  
  planSql.push(
    "",
    "-- Değişiklikleri görmek için:",
    "-- SELECT slug, jsonb_array_length(images) AS img_count FROM products WHERE slug IN (...);",
    "",
    "-- Duplicate/bozuk JSON kontrolü:",
    "SELECT COUNT(*) AS invalid_json FROM products WHERE images IS NOT NULL AND jsonb_typeof(images) != 'array';",
    "",
    "ROLLBACK;"
  );
  
  applySql.push(
    "",
    "-- Değişiklikleri görmek için:",
    "-- SELECT slug, jsonb_array_length(images) AS img_count FROM products WHERE slug IN (...);",
    "",
    "COMMIT;"
  );
  
  // Dosyalara yaz
  const planPath = join(OUTPUT_DIR, "gallery-paths-plan.sql");
  const applyPath = join(OUTPUT_DIR, "gallery-paths-apply.sql");
  
  await writeFile(planPath, planSql.join("\n"), "utf-8");
  await writeFile(applyPath, applySql.join("\n"), "utf-8");
  
  console.log(`✅ SQL dosyaları oluşturuldu: ${updates.length} güncelleme\n`);
}

// Galeri audit CSV oluştur
async function generateGalleryAuditCsv(auditInfos: GalleryAuditInfo[]): Promise<void> {
  console.log("📄 Galeri audit CSV oluşturuluyor...");
  
  const headers = [
    "slug",
    "public_file_count",
    "public_cover_exists",
    "public_gallery_count",
    "db_img_count",
    "needs_update",
    "notes",
  ];
  
  const rows = auditInfos.map(audit => [
    audit.slug,
    audit.public_file_count.toString(),
    audit.public_cover_exists ? "true" : "false",
    audit.public_gallery_count.toString(),
    audit.db_img_count.toString(),
    audit.needs_update ? "true" : "false",
    audit.notes,
  ]);
  
  const csv = [
    createCsvRow(headers),
    ...rows.map(row => createCsvRow(row)),
  ].join("\n");
  
  const csvPath = join(OUTPUT_DIR, "gallery-audit.csv");
  await writeFile(csvPath, csv, "utf-8");
  
  const needsUpdateCount = auditInfos.filter(a => a.needs_update).length;
  console.log(`✅ Galeri audit CSV oluşturuldu: ${auditInfos.length} kayıt, ${needsUpdateCount} güncelleme gerekiyor\n`);
}

// Ana fonksiyon
async function main() {
  console.log("🚀 Public ürün görselleri doğrulama ve SQL üretimi başlatılıyor...\n");
  
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
    // A) Public klasör taraması
    const publicFolders = await scanPublicFolders();
    
    // B) DB slug listesi
    const dbProducts = await fetchDbProducts(pool);
    
    // C) Galeri audit bilgisi
    const auditInfos = generateGalleryAudit(dbProducts, publicFolders);
    
    // D) Galeri audit CSV
    await generateGalleryAuditCsv(auditInfos);
    
    // E) SQL dosyaları (sadece needs_update=true olanlar için)
    await generateSqlFiles(auditInfos, dbProducts, publicFolders);
    
    // Özet
    const needsUpdateCount = auditInfos.filter(a => a.needs_update).length;
    const withCoverCount = auditInfos.filter(a => a.public_cover_exists).length;
    const withGalleryCount = auditInfos.filter(a => a.public_gallery_count > 0).length;
    
    console.log("📊 ÖZET:");
    console.log(`   - DB'de ${dbProducts.length} ürün (publish + instock)`);
    console.log(`   - Public'de ${publicFolders.size} klasör`);
    console.log(`   - Kapak dosyası olan: ${withCoverCount} ürün`);
    console.log(`   - Galeri dosyası olan: ${withGalleryCount} ürün`);
    console.log(`   - Güncelleme gereken: ${needsUpdateCount} ürün`);
    console.log(`\n✅ İşlem tamamlandı!`);
    console.log(`\n📁 Çıktı dosyaları:`);
    console.log(`   - ${join(OUTPUT_DIR, "gallery-audit.csv")}`);
    console.log(`   - ${join(OUTPUT_DIR, "gallery-paths-plan.sql")}`);
    console.log(`   - ${join(OUTPUT_DIR, "gallery-paths-apply.sql")}`);
    
  } catch (error) {
    console.error("❌ HATA:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Script'i çalıştır
main().catch((error) => {
  console.error("❌ Beklenmeyen hata:", error);
  process.exit(1);
});
