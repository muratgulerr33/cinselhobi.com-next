import dotenv from "dotenv";
import { Pool } from "pg";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("HATA: DATABASE_URL .env.local dosyasında tanımlı olmalıdır.");
  process.exit(1);
}

// CSV escape fonksiyonu
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  // İç tırnakları "" yap ve tüm hücreyi çift tırnakla sar
  return `"${str.replace(/"/g, '""')}"`;
}

// Fiyat parse fonksiyonu (kuruş cinsinden integer döner)
function parsePrice(value: unknown): { price: number | null; error: string | null } {
  if (value === null || value === undefined) {
    return { price: null, error: null };
  }

  // Sayı ise direkt kullan
  if (typeof value === "number") {
    if (isNaN(value) || value < 0) {
      return { price: null, error: "Geçersiz sayı" };
    }
    // TL cinsinden geldiğini varsay, kuruşa çevir
    return { price: Math.round(value * 100), error: null };
  }

  // String ise parse et
  if (typeof value === "string") {
    // Boş string
    if (value.trim() === "" || value === "0") {
      return { price: null, error: null };
    }

    // "2,600.00 TL" gibi formatları temizle
    let cleaned = value
      .replace(/TL/gi, "")
      .replace(/TRY/gi, "")
      .replace(/₺/g, "")
      .trim();

    // Virgül ve nokta toleranslı parse
    // Türk formatı: 2.600,00 veya İngiliz formatı: 2,600.00
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");

    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) {
      return { price: null, error: `Parse edilemedi: ${value}` };
    }

    return { price: Math.round(num * 100), error: null };
  }

  return { price: null, error: `Bilinmeyen tip: ${typeof value}` };
}

// Name normalize fonksiyonu (karşılaştırma için)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

// Kaynak JSON'dan ürün array'ini çıkar
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractProductsArray(data: any): { products: any[]; error: string | null } {
  // Array ise direkt kullan
  if (Array.isArray(data)) {
    return { products: data, error: null };
  }

  // Object ise products/items/data gibi alanları dene
  if (typeof data === "object" && data !== null) {
    const candidates = ["products", "items", "data", "results"];
    for (const key of candidates) {
      if (Array.isArray(data[key])) {
        return { products: data[key], error: null };
      }
    }

    // Bulunamadı, örnek key'leri döndür
    const sampleKeys = Object.keys(data).slice(0, 10);
    return {
      products: [],
      error: `Unknown shape: Array veya products/items/data alanı bulunamadı. Örnek key'ler: ${sampleKeys.join(", ")}`,
    };
  }

  return { products: [], error: "Unknown shape: Ne array ne de object" };
}

// Kaynak ürünlerde alan keşfi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discoverFields(product: any): {
  wcId: number | null;
  sku: string | null;
  slug: string | null;
  name: string | null;
  price: { price: number | null; error: string | null };
} {
  // wc_id alanları
  let wcId: number | null = null;
  const wcIdCandidates = ["wc_id", "id", "product_id", "external_id"];
  for (const key of wcIdCandidates) {
    if (product[key] !== undefined && product[key] !== null) {
      const num = Number(product[key]);
      if (!isNaN(num) && num > 0) {
        wcId = Math.floor(num);
        break;
      }
    }
  }

  // sku alanları
  let sku: string | null = null;
  if (product.sku !== undefined && product.sku !== null) {
    sku = String(product.sku).trim() || null;
  }

  // slug alanları
  let slug: string | null = null;
  if (product.slug !== undefined && product.slug !== null) {
    slug = String(product.slug).trim() || null;
  }

  // name alanları
  let name: string | null = null;
  const nameCandidates = ["name", "title"];
  for (const key of nameCandidates) {
    if (product[key] !== undefined && product[key] !== null) {
      name = String(product[key]).trim() || null;
      break;
    }
  }

  // fiyat alanları
  const priceCandidates = ["price", "regular_price", "sale_price", "price_try", "price_text"];
  let priceResult = { price: null as number | null, error: null as string | null };
  for (const key of priceCandidates) {
    if (product[key] !== undefined && product[key] !== null) {
      priceResult = parsePrice(product[key]);
      if (priceResult.price !== null || priceResult.error !== null) {
        break;
      }
    }
  }

  return { wcId, sku, slug, name, price: priceResult };
}

async function main() {
  console.log("🚀 EroshopA-DB karşılaştırması başlatılıyor...\n");

  // 1. DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 2. DB'den tüm ürünleri çek
    console.log("📥 DB'den ürünler çekiliyor...");
    const dbResult = await pool.query(`
      SELECT id, wc_id, slug, name, sku, price, regular_price, sale_price 
      FROM products
    `);
    const dbProducts = dbResult.rows;
    console.log(`  ✅ ${dbProducts.length} ürün DB'den çekildi\n`);

    // 3. Kaynak JSON'u oku
    const sourcePath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
    console.log("📂 Kaynak JSON okunuyor...");
    const sourceContent = await readFile(sourcePath, "utf-8");
    const sourceData = JSON.parse(sourceContent);
    const { products: sourceProducts, error: extractError } = extractProductsArray(sourceData);

    if (extractError) {
      console.error(`  ❌ HATA: ${extractError}`);
      process.exit(1);
    }

    console.log(`  ✅ ${sourceProducts.length} ürün kaynak dosyadan okundu\n`);

    // 4. Kaynak shape'i kaydet (sadece key listesi, değerler yok)
    const sourceShapeSample = sourceProducts.slice(0, 2).map((p: unknown) => {
      if (typeof p === "object" && p !== null) {
        return { keys: Object.keys(p) };
      }
      return { keys: [] };
    });
    await writeFile(
      join(process.cwd(), "old-products", "source-shape.json"),
      JSON.stringify(sourceShapeSample, null, 2),
      "utf-8"
    );

    // 5. Kaynak ürünlerde alan keşfi ve parse
    console.log("🔍 Kaynak ürünlerde alan keşfi yapılıyor...");
    const processedSourceProducts: Array<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      original: any;
      wcId: number | null;
      sku: string | null;
      slug: string | null;
      name: string | null;
      normalizedName: string | null;
      price: number | null;
      priceError: string | null;
    }> = [];

    const parseFailures: Array<{ product: unknown; error: string }> = [];

    for (const product of sourceProducts) {
      const fields = discoverFields(product);
      const normalizedName = fields.name ? normalizeName(fields.name) : null;

      if (fields.price.error) {
        parseFailures.push({
          product: { wcId: fields.wcId, slug: fields.slug, name: fields.name },
          error: fields.price.error,
        });
      }

      processedSourceProducts.push({
        original: product,
        wcId: fields.wcId,
        sku: fields.sku,
        slug: fields.slug,
        name: fields.name,
        normalizedName,
        price: fields.price.price,
        priceError: fields.price.error,
      });
    }

    console.log(`  ✅ ${processedSourceProducts.length} ürün işlendi`);
    if (parseFailures.length > 0) {
      console.log(`  ⚠️  ${parseFailures.length} fiyat parse hatası\n`);
    } else {
      console.log();
    }

    // 6. Eşleştirme stratejisi
    console.log("🔗 Eşleştirme yapılıyor...");

    // DB ürünlerini index'le (hızlı lookup için)
    const dbByWcId = new Map<number, typeof dbProducts[0]>();
    const dbBySku = new Map<string, typeof dbProducts[0]>();
    const dbBySlug = new Map<string, typeof dbProducts[0]>();
    const dbByName = new Map<string, Array<typeof dbProducts[0]>>(); // name ile birden fazla olabilir

    for (const dbProduct of dbProducts) {
      if (dbProduct.wc_id) {
        dbByWcId.set(dbProduct.wc_id, dbProduct);
      }
      if (dbProduct.sku) {
        dbBySku.set(dbProduct.sku.trim().toLowerCase(), dbProduct);
      }
      if (dbProduct.slug) {
        dbBySlug.set(dbProduct.slug.trim().toLowerCase(), dbProduct);
      }
      if (dbProduct.name) {
        const normalized = normalizeName(dbProduct.name);
        if (!dbByName.has(normalized)) {
          dbByName.set(normalized, []);
        }
        dbByName.get(normalized)!.push(dbProduct);
      }
    }

    // Eşleştirme sonuçları
    const matchedByWcId: Array<{ source: typeof processedSourceProducts[0]; db: typeof dbProducts[0] }> = [];
    const matchedBySku: Array<{ source: typeof processedSourceProducts[0]; db: typeof dbProducts[0] }> = [];
    const matchedBySlug: Array<{ source: typeof processedSourceProducts[0]; db: typeof dbProducts[0] }> = [];
    const matchedByName: Array<{ source: typeof processedSourceProducts[0]; db: typeof dbProducts[0] }> = [];
    const missingInDb: Array<typeof processedSourceProducts[0]> = [];
    const priceDiffs: Array<{
      wcId: number | null;
      slug: string | null;
      name: string | null;
      dbPrice: number | null;
      sourcePrice: number | null;
      delta: number | null;
    }> = [];
    const ambiguousMatches: Array<{
      source: typeof processedSourceProducts[0];
      dbMatches: Array<typeof dbProducts[0]>;
    }> = [];

    const matchedDbIds = new Set<number>();

    for (const sourceProduct of processedSourceProducts) {
      let matched = false;
      let matchedDb: typeof dbProducts[0] | null = null;

      // 1) wc_id ile eşleştir
      if (sourceProduct.wcId && !matched) {
        const dbProduct = dbByWcId.get(sourceProduct.wcId);
        if (dbProduct) {
          matched = true;
          matchedDb = dbProduct;
          matchedByWcId.push({ source: sourceProduct, db: dbProduct });
          matchedDbIds.add(dbProduct.id);
        }
      }

      // 2) sku ile eşleştir
      if (sourceProduct.sku && !matched) {
        const dbProduct = dbBySku.get(sourceProduct.sku.trim().toLowerCase());
        if (dbProduct) {
          matched = true;
          matchedDb = dbProduct;
          matchedBySku.push({ source: sourceProduct, db: dbProduct });
          matchedDbIds.add(dbProduct.id);
        }
      }

      // 3) slug ile eşleştir
      if (sourceProduct.slug && !matched) {
        const dbProduct = dbBySlug.get(sourceProduct.slug.trim().toLowerCase());
        if (dbProduct) {
          matched = true;
          matchedDb = dbProduct;
          matchedBySlug.push({ source: sourceProduct, db: dbProduct });
          matchedDbIds.add(dbProduct.id);
        }
      }

      // 4) name ile eşleştir (sadece raporla, otomatik karar verme)
      if (sourceProduct.normalizedName && !matched) {
        const dbMatches = dbByName.get(sourceProduct.normalizedName) || [];
        if (dbMatches.length === 1) {
          // Tek eşleşme varsa kullan
          matched = true;
          matchedDb = dbMatches[0];
          matchedByName.push({ source: sourceProduct, db: dbMatches[0] });
          matchedDbIds.add(dbMatches[0].id);
        } else if (dbMatches.length > 1) {
          // Birden fazla eşleşme varsa ambiguous
          ambiguousMatches.push({ source: sourceProduct, dbMatches });
        }
      }

      // Eşleşme bulunduysa fiyat kontrolü yap
      if (matched && matchedDb) {
        const dbPrice = matchedDb.price || matchedDb.sale_price || matchedDb.regular_price;
        const sourcePrice = sourceProduct.price;

        if (dbPrice !== null && sourcePrice !== null && dbPrice !== sourcePrice) {
          priceDiffs.push({
            wcId: sourceProduct.wcId,
            slug: sourceProduct.slug,
            name: sourceProduct.name,
            dbPrice,
            sourcePrice,
            delta: sourcePrice - dbPrice,
          });
        }
      }

      // Eşleşme bulunamadıysa missing_in_db'ye ekle
      if (!matched) {
        missingInDb.push(sourceProduct);
      }
    }

    // DB'de olup kaynakta olmayanları bul
    const missingInSource = dbProducts.filter((dbProduct) => !matchedDbIds.has(dbProduct.id));

    console.log(`  ✅ Eşleştirme tamamlandı\n`);

    // 7. Rapor üret
    console.log("📊 Rapor üretiliyor...");

    const summary = {
      dbCount: dbProducts.length,
      sourceCount: processedSourceProducts.length,
      matchedCount: matchedByWcId.length + matchedBySku.length + matchedBySlug.length + matchedByName.length,
      missingInDbCount: missingInDb.length,
      missingInSourceCount: missingInSource.length,
      priceDiffCount: priceDiffs.length,
      parseFailuresCount: parseFailures.length,
      matchedBy: {
        wc_id: matchedByWcId.length,
        sku: matchedBySku.length,
        slug: matchedBySlug.length,
        name: matchedByName.length,
      },
    };

    const report = {
      summary,
      matchedByWcId: matchedByWcId.map((m) => ({
        source: { wcId: m.source.wcId, slug: m.source.slug, name: m.source.name, price: m.source.price },
        db: { id: m.db.id, wcId: m.db.wc_id, slug: m.db.slug, name: m.db.name, price: m.db.price },
      })),
      matchedBySku: matchedBySku.map((m) => ({
        source: { wcId: m.source.wcId, slug: m.source.slug, name: m.source.name, price: m.source.price },
        db: { id: m.db.id, wcId: m.db.wc_id, slug: m.db.slug, name: m.db.name, price: m.db.price },
      })),
      matchedBySlug: matchedBySlug.map((m) => ({
        source: { wcId: m.source.wcId, slug: m.source.slug, name: m.source.name, price: m.source.price },
        db: { id: m.db.id, wcId: m.db.wc_id, slug: m.db.slug, name: m.db.name, price: m.db.price },
      })),
      matchedByName: matchedByName.map((m) => ({
        source: { wcId: m.source.wcId, slug: m.source.slug, name: m.source.name, price: m.source.price },
        db: { id: m.db.id, wcId: m.db.wc_id, slug: m.db.slug, name: m.db.name, price: m.db.price },
      })),
      missingInDb: missingInDb.map((p) => ({
        wcId: p.wcId,
        slug: p.slug,
        name: p.name,
        price: p.price,
        priceError: p.priceError,
      })),
      missingInSource: missingInSource.map((p) => ({
        id: p.id,
        wcId: p.wc_id,
        slug: p.slug,
        name: p.name,
        price: p.price,
      })),
      priceDiffs,
      ambiguousMatches: ambiguousMatches.map((a) => ({
        source: { wcId: a.source.wcId, slug: a.source.slug, name: a.source.name },
        dbMatches: a.dbMatches.map((db) => ({ id: db.id, wcId: db.wc_id, slug: db.slug, name: db.name })),
      })),
      parseFailures,
    };

    // JSON raporu kaydet
    await writeFile(
      join(process.cwd(), "old-products", "compare-eroshopa-to-db.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    // CSV: price-diffs.csv
    const priceDiffsCsv = [
      ["wc_id", "slug", "name", "db_price", "source_price", "delta"].map(escapeCsv).join(","),
      ...priceDiffs.map((diff) =>
        [
          diff.wcId || "",
          diff.slug || "",
          diff.name || "",
          diff.dbPrice !== null ? diff.dbPrice : "",
          diff.sourcePrice !== null ? diff.sourcePrice : "",
          diff.delta !== null ? diff.delta : "",
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");

    await writeFile(join(process.cwd(), "old-products", "price-diffs.csv"), priceDiffsCsv, "utf-8");

    // CSV: missing-in-db.csv
    const missingInDbCsv = [
      ["wc_id", "slug", "name", "price", "price_error"].map(escapeCsv).join(","),
      ...missingInDb.map((p) =>
        [
          p.wcId || "",
          p.slug || "",
          p.name || "",
          p.price !== null ? p.price : "",
          p.priceError || "",
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");

    await writeFile(join(process.cwd(), "old-products", "missing-in-db.csv"), missingInDbCsv, "utf-8");

    console.log("  ✅ Raporlar kaydedildi\n");

    // 8. Console özeti
    console.log("📊 Özet:");
    console.log(`   DB ürün sayısı: ${summary.dbCount}`);
    console.log(`   Kaynak ürün sayısı: ${summary.sourceCount}`);
    console.log(`   Eşleşen: ${summary.matchedCount}`);
    console.log(`     - wc_id ile: ${summary.matchedBy.wc_id}`);
    console.log(`     - sku ile: ${summary.matchedBy.sku}`);
    console.log(`     - slug ile: ${summary.matchedBy.slug}`);
    console.log(`     - name ile: ${summary.matchedBy.name}`);
    console.log(`   DB'de eksik: ${summary.missingInDbCount}`);
    console.log(`   Kaynakta eksik: ${summary.missingInSourceCount}`);
    console.log(`   Fiyat farkı: ${summary.priceDiffCount}`);
    console.log(`   Fiyat parse hatası: ${summary.parseFailuresCount}`);
    if (ambiguousMatches.length > 0) {
      console.log(`   Belirsiz eşleşmeler (name): ${ambiguousMatches.length}`);
    }
    console.log();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
