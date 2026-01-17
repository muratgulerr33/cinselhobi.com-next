import dotenv from "dotenv";
import { Pool } from "pg";
import { writeFile, mkdir, readFile } from "fs/promises";
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

// Image normalize fonksiyonu (API route'taki ile aynı mantık)
function normalizeImages(images: unknown): Array<{ src: string; alt?: string }> {
  if (!images) return [];
  
  if (Array.isArray(images)) {
    return images
      .map((img: unknown) => {
        if (typeof img === "string") {
          return { src: img.trim() };
        }
        if (typeof img === "object" && img !== null) {
          const obj = img as { src?: string; url?: string; alt?: string };
          if (typeof obj.src === "string") {
            return {
              src: (obj.src ?? "").trim(),
              alt: (obj.alt ?? "").trim() || undefined,
            };
          }
          if (typeof obj.url === "string") {
            return {
              src: (obj.url ?? "").trim(),
              alt: (obj.alt ?? "").trim() || undefined,
            };
          }
        }
        return null;
      })
      .filter((item): item is { src: string; alt?: string } => item !== null)
      .filter((img) => img.src.length > 0);
  }
  
  return [];
}

// External URL kontrolü
function isExternalUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

// WordPress domain kontrolü
function checkWpDomain(src: string): boolean {
  return (
    src.includes("cinselhobi.com/wp-content/uploads") ||
    src.includes("www.cinselhobi.com/wp-content/uploads")
  );
}

// Public path'e çevir (Next.js'te public/xxx -> /xxx olarak servis edilir)
function toPublicPath(src: string): string | null {
  // External URL ise null döndür
  if (isExternalUrl(src)) {
    return null;
  }
  
  // Zaten / ile başlıyorsa public/ ekle
  if (src.startsWith("/")) {
    return join(process.cwd(), "public", src.slice(1));
  }
  
  // Relative path ise direkt public altına koy
  return join(process.cwd(), "public", src);
}

// Source-only CSV'den slug listesi oku
async function readSourceOnlySlugs(): Promise<Set<string> | null> {
  const sourceOnlyPath = join(OUTPUT_DIR, "source-only-final.csv");
  if (!existsSync(sourceOnlyPath)) {
    return null;
  }
  
  try {
    const content = await readFile(sourceOnlyPath, "utf-8");
    const lines = content.split("\n").slice(1); // Header'ı atla
    const slugs = new Set<string>();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      // CSV parse: ilk kolon source_slug
      const match = line.match(/^"([^"]+)"/);
      if (match) {
        slugs.add(match[1]);
      }
    }
    
    return slugs.size > 0 ? slugs : null;
  } catch (error) {
    console.warn(`⚠️  source-only-final.csv okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Ana fonksiyon
async function main() {
  const onlySourceOnly = process.argv.includes("--onlySourceOnly") || process.argv.includes("--onlySourceOnly=1");
  
  console.log("🚀 Ürün görsel audit'i başlatılıyor...\n");
  
  if (onlySourceOnly) {
    console.log("📋 Mod: Sadece source-only-final.csv'deki ürünler\n");
  } else {
    console.log("📋 Mod: Tüm publish + instock ürünler\n");
  }
  
  // Çıktı klasörünü oluştur
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 ${OUTPUT_DIR} klasörü oluşturuldu\n`);
  }
  
  // Source-only slug listesi (eğer mod aktifse)
  let sourceOnlySlugs: Set<string> | null = null;
  if (onlySourceOnly) {
    sourceOnlySlugs = await readSourceOnlySlugs();
    if (!sourceOnlySlugs) {
      console.error("❌ HATA: --onlySourceOnly modu aktif ama source-only-final.csv bulunamadı veya boş.");
      process.exit(1);
    }
    console.log(`📊 ${sourceOnlySlugs.size} slug source-only listesinde bulundu\n`);
  }
  
  // Postgres bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });
  
  try {
    // Ürünleri çek
    let query: string;
    let params: string[] = [];
    
    if (onlySourceOnly && sourceOnlySlugs) {
      // Source-only mod: slug listesine göre filtrele
      const slugArray = Array.from(sourceOnlySlugs);
      const placeholders = slugArray.map((_, i) => `$${i + 1}`).join(",");
      query = `
        SELECT slug, status, stock_status, images, raw
        FROM products
        WHERE slug IN (${placeholders})
        ORDER BY slug
      `;
      params = slugArray;
    } else {
      // Normal mod: publish + instock
      query = `
        SELECT slug, status, stock_status, images, raw
        FROM products
        WHERE status = 'publish' AND stock_status = 'instock'
        ORDER BY slug
      `;
    }
    
    console.log("📊 Veritabanından ürünler çekiliyor...");
    const result = await pool.query(query, params);
    const products = result.rows;
    console.log(`✅ ${products.length} ürün bulundu\n`);
    
    // Audit sonuçları
    const auditResults: Array<{
      slug: string;
      status: string;
      stock_status: string;
      cover_src: string;
      cover_is_external: boolean;
      cover_public_path_checked: string;
      cover_exists: boolean;
      gallery_count: number;
      gallery_missing_count: number;
      has_wp_domain: boolean;
      notes: string;
    }> = [];
    
    // İstatistikler
    let externalCount = 0;
    let coverMissingCount = 0;
    let galleryZeroCount = 0;
    let publicMissingCount = 0;
    let wpDomainCount = 0;
    
    console.log("🔍 Ürünler analiz ediliyor...\n");
    
    for (const product of products) {
      const slug = product.slug || "";
      const status = product.status || "";
      const stockStatus = product.stock_status || "";
      
      let coverSrc = "";
      let coverIsExternal = false;
      let coverPublicPathChecked = "";
      let coverExists = false;
      let galleryCount = 0;
      let galleryMissingCount = 0;
      let hasWpDomain = false;
      const notes: string[] = [];
      
      try {
        // Images alanını normalize et
        const normalizedImages = normalizeImages(product.images);
        galleryCount = normalizedImages.length;
        
        if (galleryCount === 0) {
          galleryZeroCount++;
          notes.push("gallery_count=0");
        }
        
        // Cover image (ilk görsel)
        if (normalizedImages.length > 0) {
          coverSrc = normalizedImages[0].src;
          coverIsExternal = isExternalUrl(coverSrc);
          
          if (coverIsExternal) {
            externalCount++;
            hasWpDomain = checkWpDomain(coverSrc);
            if (hasWpDomain) {
              wpDomainCount++;
            }
          } else {
            // Public path kontrolü
            const publicPath = toPublicPath(coverSrc);
            if (publicPath) {
              coverPublicPathChecked = publicPath;
              coverExists = existsSync(publicPath);
              if (!coverExists) {
                publicMissingCount++;
                notes.push(`cover_missing:${coverSrc}`);
              }
            } else {
              notes.push(`cover_path_invalid:${coverSrc}`);
            }
          }
        } else {
          coverMissingCount++;
          notes.push("cover_missing");
        }
        
        // Gallery missing count (external olmayan ve dosya eksik olanlar)
        for (let i = 1; i < normalizedImages.length; i++) {
          const img = normalizedImages[i];
          if (!isExternalUrl(img.src)) {
            const publicPath = toPublicPath(img.src);
            if (publicPath && !existsSync(publicPath)) {
              galleryMissingCount++;
            }
          }
        }
        
        if (galleryMissingCount > 0) {
          notes.push(`gallery_missing_count=${galleryMissingCount}`);
        }
        
      } catch (error) {
        notes.push(`parse_error:${error instanceof Error ? error.message : String(error)}`);
      }
      
      auditResults.push({
        slug,
        status,
        stock_status: stockStatus,
        cover_src: coverSrc,
        cover_is_external: coverIsExternal,
        cover_public_path_checked: coverPublicPathChecked,
        cover_exists: coverExists,
        gallery_count: galleryCount,
        gallery_missing_count: galleryMissingCount,
        has_wp_domain: hasWpDomain,
        notes: notes.join("; "),
      });
    }
    
    // CSV oluştur
    const csvLines: string[] = [];
    
    // Header
    csvLines.push(createCsvRow([
      "slug",
      "status",
      "stock_status",
      "cover_src",
      "cover_is_external",
      "cover_public_path_checked",
      "cover_exists",
      "gallery_count",
      "gallery_missing_count",
      "has_wp_domain",
      "notes",
    ]));
    
    // Data rows
    for (const result of auditResults) {
      csvLines.push(createCsvRow([
        result.slug,
        result.status,
        result.stock_status,
        result.cover_src,
        result.cover_is_external,
        result.cover_public_path_checked,
        result.cover_exists,
        result.gallery_count,
        result.gallery_missing_count,
        result.has_wp_domain,
        result.notes,
      ]));
    }
    
    // Dosyaya yaz
    const csvContent = csvLines.join("\n");
    const csvPath = join(OUTPUT_DIR, "image-audit.csv");
    await writeFile(csvPath, csvContent, "utf-8");
    
    console.log("✨ Audit tamamlandı!\n");
    console.log("📊 Özet:");
    console.log(`   - Toplam ürün: ${products.length}`);
    console.log(`   - External URL kullanan: ${externalCount}`);
    console.log(`   - WordPress domain içeren: ${wpDomainCount}`);
    console.log(`   - Cover missing: ${coverMissingCount}`);
    console.log(`   - Gallery count = 0: ${galleryZeroCount}`);
    console.log(`   - Public altında eksik dosya: ${publicMissingCount}`);
    console.log(`\n💾 CSV dosyası: ${csvPath}\n`);
    
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
