import dotenv from "dotenv";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { db } from "../src/db/connection";
import { categories, products, productCategories } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

// ENV değişkenleri
const WOO_BASE_URL = process.env.WOO_BASE_URL;
const WOO_CONSUMER_KEY = process.env.WOO_CONSUMER_KEY;
const WOO_CONSUMER_SECRET = process.env.WOO_CONSUMER_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const WOO_IMPORT_MODE = (process.env.WOO_IMPORT_MODE ?? "full") as "full" | "sample";
const WOO_IMPORT_LIMIT = parseInt(process.env.WOO_IMPORT_LIMIT ?? "20", 10);
const WOO_AUTH_MODE = (process.env.WOO_AUTH_MODE ?? "basic") as "basic" | "query";

if (!WOO_BASE_URL || !WOO_CONSUMER_KEY || !WOO_CONSUMER_SECRET) {
  console.error("HATA: WOO_BASE_URL, WOO_CONSUMER_KEY ve WOO_CONSUMER_SECRET .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

if (WOO_IMPORT_MODE !== "full" && WOO_IMPORT_MODE !== "sample") {
  console.error("HATA: WOO_IMPORT_MODE 'full' veya 'sample' olmalıdır.");
  process.exit(1);
}

if (WOO_AUTH_MODE !== "basic" && WOO_AUTH_MODE !== "query") {
  console.error("HATA: WOO_AUTH_MODE 'basic' veya 'query' olmalıdır.");
  process.exit(1);
}

// Snapshot klasörü (mode'a göre)
const SNAPSHOT_DIR = join(process.cwd(), "data", "snapshots", WOO_IMPORT_MODE);

// Basic Auth için base64 encode
function getAuthHeader(): string {
  const credentials = `${WOO_CONSUMER_KEY}:${WOO_CONSUMER_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

// Retry fonksiyonu (exponential backoff)
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 429 veya 5xx hataları için retry
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`  ⚠️  ${response.status} hatası, ${delay}ms sonra tekrar deneniyor... (deneme ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`  ⚠️  Hata: ${lastError.message}, ${delay}ms sonra tekrar deneniyor... (deneme ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Bilinmeyen hata");
}

// WooCommerce API'den veri çekme
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWooData(endpoint: string, page = 1, status?: string): Promise<{ data: any[]; totalPages?: number }> {
  const url = new URL(`${WOO_BASE_URL}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  
  if (status) {
    url.searchParams.set("status", status);
  }
  
  // Auth mode'a göre authentication ekle
  if (WOO_AUTH_MODE === "query") {
    url.searchParams.set("consumer_key", WOO_CONSUMER_KEY!);
    url.searchParams.set("consumer_secret", WOO_CONSUMER_SECRET!);
  }
  
  // Log için güvenli URL oluştur (consumer_key/secret mask'le)
  const safeUrl = new URL(url.toString());
  if (safeUrl.searchParams.has("consumer_key")) {
    safeUrl.searchParams.set("consumer_key", "***");
  }
  if (safeUrl.searchParams.has("consumer_secret")) {
    safeUrl.searchParams.set("consumer_secret", "***");
  }
  
  console.log(`  📥 Sayfa ${page} çekiliyor: ${safeUrl.pathname}${safeUrl.search}`);
  
  // Headers'ı auth mode'a göre ayarla
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (WOO_AUTH_MODE === "basic") {
    headers.Authorization = getAuthHeader();
  }
  
  const response = await fetchWithRetry(url.toString(), {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  const totalPages = response.headers.get("x-wp-totalpages");
  
  return {
    data: Array.isArray(data) ? data : [data],
    totalPages: totalPages ? parseInt(totalPages, 10) : undefined,
  };
}

// Tüm sayfaları çekme
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllPages(endpoint: string, status?: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allData: any[] = [];
  let page = 1;
  let totalPages: number | undefined;
  
  while (true) {
    const { data, totalPages: tp } = await fetchWooData(endpoint, page, status);
    
    if (data.length === 0) {
      break;
    }
    
    allData.push(...data);
    
    if (tp !== undefined) {
      totalPages = tp;
      if (page >= totalPages) {
        break;
      }
    } else {
      // totalPages bilgisi yoksa, boş gelene kadar devam et
      if (data.length < 100) {
        break;
      }
    }
    
    page++;
  }
  
  return allData;
}

// Fiyat string'ini kuruş cinsinden integer'a çevirme
function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr || priceStr === "" || priceStr === "0") {
    return null;
  }
  
  // "199.90" -> 19990 (kuruş)
  const num = parseFloat(priceStr);
  if (isNaN(num)) {
    return null;
  }
  
  return Math.round(num * 100);
}

// Snapshot klasörünü oluştur
async function ensureSnapshotDir(): Promise<void> {
  if (!existsSync(SNAPSHOT_DIR)) {
    await mkdir(SNAPSHOT_DIR, { recursive: true });
  }
}

// Ana import fonksiyonu
async function main() {
  console.log(`🚀 WooCommerce Import başlatılıyor (mode: ${WOO_IMPORT_MODE})...\n`);
  
  if (WOO_IMPORT_MODE === "sample") {
    console.log(`📊 Sample mod: İlk ${WOO_IMPORT_LIMIT} ürün import edilecek\n`);
  }
  
  await ensureSnapshotDir();
  
  const startTime = Date.now();
  
  // 1. Kategorileri çek (her zaman full)
  console.log("📂 Kategoriler çekiliyor...");
  const categoriesData = await fetchAllPages("products/categories");
  console.log(`  ✅ ${categoriesData.length} kategori çekildi\n`);
  
  // Kategorileri snapshot'a kaydet
  await writeFile(
    join(SNAPSHOT_DIR, "categories.json"),
    JSON.stringify(categoriesData, null, 2),
    "utf-8"
  );
  
  // 2. Ürünleri çek (sayfa sayfa)
  const productStatus = process.env.WOO_PRODUCT_STATUS ?? "publish";
  console.log(`📦 Ürünler çekiliyor (status: ${productStatus})...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsData: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allFetchedProducts: any[] = []; // Tüm çekilen ürünler (sample modda limit'ten fazla olabilir)
  let page = 1;
  let totalPages: number | undefined;
  
  while (true) {
    const { data, totalPages: tp } = await fetchWooData("products", page, productStatus);
    
    if (data.length === 0) {
      break;
    }
    
    allFetchedProducts.push(...data);
    
    // Sample mod: limit'e ulaşana kadar ekle
    if (WOO_IMPORT_MODE === "sample") {
      const remaining = WOO_IMPORT_LIMIT - productsData.length;
      if (remaining <= 0) {
        break;
      }
      // Sadece gereken kadarını ekle
      const toAdd = data.slice(0, remaining);
      productsData.push(...toAdd);
      
      // Her sayfayı ayrı dosyaya kaydet (tam sayfa)
      const pageNum = String(page).padStart(3, "0");
      await writeFile(
        join(SNAPSHOT_DIR, `products_page_${pageNum}.json`),
        JSON.stringify(data, null, 2),
        "utf-8"
      );
      
      // Limit'e ulaştıysak dur
      if (productsData.length >= WOO_IMPORT_LIMIT) {
        break;
      }
    } else {
      // Full mod: tüm ürünleri ekle
      productsData.push(...data);
      
      // Her sayfayı ayrı dosyaya kaydet
      const pageNum = String(page).padStart(3, "0");
      await writeFile(
        join(SNAPSHOT_DIR, `products_page_${pageNum}.json`),
        JSON.stringify(data, null, 2),
        "utf-8"
      );
    }
    
    if (tp !== undefined) {
      totalPages = tp;
      if (page >= totalPages) {
        break;
      }
    } else {
      if (data.length < 100) {
        break;
      }
    }
    
    page++;
  }
  
  console.log(`  ✅ ${productsData.length} ürün import edilecek (${allFetchedProducts.length} ürün çekildi, ${page - 1} sayfa)\n`);
  
  // 3. Summary oluştur
  const summary = {
    mode: WOO_IMPORT_MODE,
    limit: WOO_IMPORT_MODE === "sample" ? WOO_IMPORT_LIMIT : null,
    categories: categoriesData.length,
    importedProducts: productsData.length,
    totalFetchedProducts: allFetchedProducts.length,
    pages: page - 1,
    timestamp: new Date().toISOString(),
  };
  
  await writeFile(
    join(SNAPSHOT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );
  
  console.log("💾 Snapshot'lar kaydedildi\n");
  
  // 4. Veritabanına yazma
  console.log("🗄️  Veritabanına yazılıyor...\n");
  
  // 4.1. Kategorileri yaz (upsert)
  console.log("  📂 Kategoriler yazılıyor...");
  let categoriesInserted = 0;
  let categoriesUpdated = 0;
  
  for (const cat of categoriesData) {
    try {
      await db
        .insert(categories)
        .values({
          wcId: cat.id,
          slug: cat.slug,
          name: cat.name,
          parentWcId: cat.parent || null,
          description: cat.description || null,
          imageUrl: cat.image?.src || null,
        })
        .onConflictDoUpdate({
          target: categories.wcId,
          set: {
            slug: cat.slug,
            name: cat.name,
            parentWcId: cat.parent || null,
            description: cat.description || null,
            imageUrl: cat.image?.src || null,
            updatedAt: sql`now()`,
          },
        });
      categoriesInserted++;
    } catch (error) {
      // Conflict durumunda update olur, bu normal
      categoriesUpdated++;
    }
  }
  
  console.log(`    ✅ ${categoriesInserted} kategori eklendi, ${categoriesUpdated} kategori güncellendi`);
  
  // 4.2. Ürünleri yaz (upsert)
  console.log("  📦 Ürünler yazılıyor...");
  let productsInserted = 0;
  let productsUpdated = 0;
  
  for (const product of productsData) {
    // Images array'ini minimal formata çevir
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagesMinimal = product.images?.map((img: any) => ({
      id: img.id,
      src: img.src,
      alt: img.alt || null,
    })) || [];
    
    try {
      await db
        .insert(products)
        .values({
          wcId: product.id,
          slug: product.slug,
          name: product.name,
          status: product.status,
          type: product.type,
          sku: product.sku || null,
          price: parsePrice(product.price),
          regularPrice: parsePrice(product.regular_price),
          salePrice: parsePrice(product.sale_price),
          currency: "TRY",
          shortDescription: product.short_description || null,
          description: product.description || null,
          stockStatus: product.stock_status || null,
          stockQuantity: product.stock_quantity ? parseInt(String(product.stock_quantity), 10) : null,
          images: imagesMinimal.length > 0 ? imagesMinimal : null,
          raw: product, // Tam ürün objesi
        })
        .onConflictDoUpdate({
          target: products.wcId,
          set: {
            slug: product.slug,
            name: product.name,
            status: product.status,
            type: product.type,
            sku: product.sku || null,
            price: parsePrice(product.price),
            regularPrice: parsePrice(product.regular_price),
            salePrice: parsePrice(product.sale_price),
            currency: "TRY",
            shortDescription: product.short_description || null,
            description: product.description || null,
            stockStatus: product.stock_status || null,
            stockQuantity: product.stock_quantity ? parseInt(String(product.stock_quantity), 10) : null,
            images: imagesMinimal.length > 0 ? imagesMinimal : null,
            raw: product,
            updatedAt: sql`now()`,
          },
        });
      productsInserted++;
    } catch (error) {
      productsUpdated++;
    }
  }
  
  console.log(`    ✅ ${productsInserted} ürün eklendi, ${productsUpdated} ürün güncellendi`);
  
  // 4.3. Product-Category ilişkilerini yaz
  console.log("  🔗 Ürün-Kategori ilişkileri yazılıyor...");
  let relationsInserted = 0;
  
  for (const product of productsData) {
    if (!product.categories || product.categories.length === 0) {
      continue;
    }
    
    // Önce product'ın DB'deki id'sini bul
    const [dbProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.wcId, product.id))
      .limit(1);
    
    if (!dbProduct) {
      continue;
    }
    
    // Her kategori için ilişki oluştur
    for (const cat of product.categories) {
      // Kategorinin DB'deki id'sini bul
      const [dbCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.wcId, cat.id))
        .limit(1);
      
      if (!dbCategory) {
        continue;
      }
      
      try {
        await db
          .insert(productCategories)
          .values({
            productId: dbProduct.id,
            categoryId: dbCategory.id,
          })
          .onConflictDoNothing();
        relationsInserted++;
      } catch (error) {
        // Conflict durumu normal (zaten var)
      }
    }
  }
  
  console.log(`    ✅ ${relationsInserted} ilişki eklendi\n`);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log("✨ Import tamamlandı!");
  console.log(`\n📊 Özet:`);
  console.log(`   - Kategori: ${categoriesData.length}`);
  console.log(`   - Ürün: ${productsData.length}`);
  console.log(`   - Süre: ${duration}s\n`);
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});


