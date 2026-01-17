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

// Name normalize fonksiyonu (karşılaştırma için)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Türkçe karakter normalize
    .replace(/[^\w\s]/g, ""); // Noktalama temizleme
}

// Benzerlik skoru (0-1 arası)
function similarityScore(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 0.95; // Normalize sonrası eşitse yüksek skor

  // Bigram benzerliği
  const getBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
    }
  }

  const union = bigrams1.size + bigrams2.size - intersection;
  if (union === 0) return 0.0;

  return intersection / union;
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

// Fiyat parse fonksiyonu (kuruş cinsinden integer döner)
// Kaynak JSON'daki price alanı daima TL cinsindendir, bu fonksiyon TL * 100 yaparak kuruşa çevirir
function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  let priceTl: number;

  // Sayı ise direkt kullan (TL olarak kabul et)
  if (typeof value === "number") {
    if (isNaN(value) || value < 0) {
      return null;
    }
    priceTl = value;
  } else if (typeof value === "string") {
    // Boş string
    if (value.trim() === "" || value === "0") {
      return null;
    }

    // "2,600.00 TL" gibi formatları temizle
    let cleaned = value
      .replace(/TL/gi, "")
      .replace(/TRY/gi, "")
      .replace(/₺/g, "")
      .trim();

    // Virgül ve nokta toleranslı parse
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");

    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) {
      return null;
    }
    priceTl = num;
  } else {
    return null;
  }

  // TL'yi kuruş'a çevir (daima TL * 100)
  const priceKurus = Math.round(priceTl * 100);
  return priceKurus;
}

// CSV satırını parse et
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);
  return result;
}

interface DbProduct {
  id: number;
  wc_id: number;
  slug: string;
  name: string;
  status: string;
  type: string;
  sku: string | null;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  stock_status: string | null;
  raw: unknown;
  images: unknown;
  created_at: Date;
  updated_at: Date;
}

interface SourceProduct {
  slug: string;
  name: string;
  price: number | null;
  wc_id: number | null;
  images: unknown;
  raw: unknown;
}

interface MatchResult {
  dbProduct: DbProduct;
  sourceProduct: SourceProduct;
  matchType: "exact" | "alias" | "name";
  similarityScore?: number;
}

interface DbOnlyResult {
  dbProduct: DbProduct;
  maybeSourceSlug: string | null;
  maybeSourceName: string | null;
  similarityScore: number | null;
  reason: string;
}

interface SourceOnlyResult {
  sourceProduct: SourceProduct;
  maybeDbSlug: string | null;
  similarityScore: number | null;
}

async function main() {
  console.log("🚀 EroshopA-DB senkronizasyon scripti başlatılıyor...\n");

  // 1. DB bağlantısı
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // 2. DB'den tüm ürünleri çek
    console.log("📥 DB'den ürünler çekiliyor...");
    const dbResult = await pool.query(`
      SELECT id, wc_id, slug, name, status, type, sku, price, regular_price, sale_price, stock_status, raw, images, created_at, updated_at
      FROM products
      ORDER BY id
    `);
    const dbProducts: DbProduct[] = dbResult.rows.map((row) => ({
      id: row.id,
      wc_id: row.wc_id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      type: row.type,
      sku: row.sku,
      price: row.price,
      regular_price: row.regular_price,
      sale_price: row.sale_price,
      stock_status: row.stock_status,
      raw: row.raw,
      images: row.images,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    console.log(`  ✅ ${dbProducts.length} ürün DB'den çekildi\n`);

    // 3. Kaynak JSON'u oku
    const sourcePath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
    console.log("📂 Kaynak JSON okunuyor...");
    const sourceContent = await readFile(sourcePath, "utf-8");
    const sourceData = JSON.parse(sourceContent);
    const { products: sourceProductsRaw, error: extractError } = extractProductsArray(sourceData);

    if (extractError) {
      console.error(`  ❌ HATA: ${extractError}`);
      process.exit(1);
    }

    console.log(`  ✅ ${sourceProductsRaw.length} ürün kaynak dosyadan okundu\n`);

    // 4. Alias mapping'i yükle
    console.log("📂 Alias mapping yükleniyor...");
    const aliasMap = new Map<string, string>(); // source_slug -> db_slug
    const aliasPath = join(process.cwd(), "old-products", "price-update-alias-preview.csv");
    try {
      const aliasContent = await readFile(aliasPath, "utf-8");
      const aliasLines = aliasContent.trim().split("\n");
      if (aliasLines.length > 1) {
        const headers = parseCsvLine(aliasLines[0]);
        const sourceSlugIdx = headers.indexOf("source_slug");
        const dbSlugIdx = headers.indexOf("db_slug");

        if (sourceSlugIdx >= 0 && dbSlugIdx >= 0) {
          for (let i = 1; i < aliasLines.length; i++) {
            const values = parseCsvLine(aliasLines[i]);
            if (values.length > Math.max(sourceSlugIdx, dbSlugIdx)) {
              const sourceSlug = values[sourceSlugIdx]?.trim().toLowerCase();
              const dbSlug = values[dbSlugIdx]?.trim().toLowerCase();
              if (sourceSlug && dbSlug) {
                aliasMap.set(sourceSlug, dbSlug);
              }
            }
          }
        }
      }
      console.log(`  ✅ ${aliasMap.size} alias mapping yüklendi\n`);
    } catch (error) {
      console.log(`  ⚠️  Alias dosyası bulunamadı veya okunamadı, devam ediliyor...\n`);
    }

    // 5. Kaynak ürünleri işle
    console.log("🔍 Kaynak ürünler işleniyor...");
    const sourceProducts: SourceProduct[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const product of sourceProductsRaw) {
      const slug = product.slug ? String(product.slug).trim() : null;
      if (!slug) {
        continue; // Slug yoksa atla
      }

      // name/title alanlarını dene
      let name: string | null = null;
      if (product.name) {
        name = String(product.name).trim();
      } else if (product.title) {
        name = String(product.title).trim();
      }

      // price alanlarını dene
      let price: number | null = null;
      if (product.price !== undefined && product.price !== null) {
        price = parsePrice(product.price);
      }

      // wc_id/external_id alanlarını dene
      let wc_id: number | null = null;
      if (product.wc_id !== undefined && product.wc_id !== null) {
        const num = Number(product.wc_id);
        if (!isNaN(num) && num > 0) {
          wc_id = Math.floor(num);
        }
      } else if (product.external_id !== undefined && product.external_id !== null) {
        const num = Number(product.external_id);
        if (!isNaN(num) && num > 0) {
          wc_id = Math.floor(num);
        }
      }

      // images alanını al
      const images = product.images || null;

      sourceProducts.push({
        slug,
        name: name || "",
        price,
        wc_id,
        images,
        raw: product, // Tüm product objesini raw olarak sakla
      });
    }

    console.log(`  ✅ ${sourceProducts.length} kaynak ürün işlendi\n`);

    // 6. Eşleştirme
    console.log("🔗 Eşleştirme yapılıyor...");

    // Index'ler
    const dbBySlug = new Map<string, DbProduct>();
    const dbByName = new Map<string, DbProduct[]>();

    for (const dbProduct of dbProducts) {
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

    const sourceBySlug = new Map<string, SourceProduct>();
    for (const sourceProduct of sourceProducts) {
      sourceBySlug.set(sourceProduct.slug.trim().toLowerCase(), sourceProduct);
    }

    // Eşleştirme sonuçları
    const matches: MatchResult[] = [];
    const matchedDbIds = new Set<number>();
    const matchedSourceSlugs = new Set<string>();

    // 1) Exact slug match
    for (const [slug, sourceProduct] of sourceBySlug) {
      const dbProduct = dbBySlug.get(slug);
      if (dbProduct) {
        matches.push({
          dbProduct,
          sourceProduct,
          matchType: "exact",
        });
        matchedDbIds.add(dbProduct.id);
        matchedSourceSlugs.add(slug);
      }
    }

    // 2) Alias slug match
    for (const [sourceSlug, sourceProduct] of sourceBySlug) {
      if (matchedSourceSlugs.has(sourceSlug)) continue; // Zaten eşleşti

      const dbSlug = aliasMap.get(sourceSlug);
      if (dbSlug) {
        const dbProduct = dbBySlug.get(dbSlug);
        if (dbProduct && !matchedDbIds.has(dbProduct.id)) {
          matches.push({
            dbProduct,
            sourceProduct,
            matchType: "alias",
          });
          matchedDbIds.add(dbProduct.id);
          matchedSourceSlugs.add(sourceSlug);
        }
      }
    }

    // 3) Normalize name match (sadece eşleşmemiş olanlar için)
    for (const [sourceSlug, sourceProduct] of sourceBySlug) {
      if (matchedSourceSlugs.has(sourceSlug)) continue; // Zaten eşleşti
      if (!sourceProduct.name) continue; // Name yoksa atla

      const normalizedSourceName = normalizeName(sourceProduct.name);
      const dbCandidates = dbByName.get(normalizedSourceName) || [];

      // Sadece tek eşleşme varsa kullan
      if (dbCandidates.length === 1) {
        const dbProduct = dbCandidates[0];
        if (!matchedDbIds.has(dbProduct.id)) {
          const score = similarityScore(sourceProduct.name, dbProduct.name);
          matches.push({
            dbProduct,
            sourceProduct,
            matchType: "name",
            similarityScore: score,
          });
          matchedDbIds.add(dbProduct.id);
          matchedSourceSlugs.add(sourceSlug);
        }
      }
    }

    console.log(`  ✅ Eşleştirme tamamlandı:`);
    console.log(`     - Exact slug: ${matches.filter((m) => m.matchType === "exact").length}`);
    console.log(`     - Alias slug: ${matches.filter((m) => m.matchType === "alias").length}`);
    console.log(`     - Name match: ${matches.filter((m) => m.matchType === "name").length}\n`);

    // 7. DB-only ürünleri bul (eşleşmemiş DB ürünleri)
    console.log("🔍 DB-only ürünler analiz ediliyor...");
    const dbOnly: DbOnlyResult[] = [];

    for (const dbProduct of dbProducts) {
      if (matchedDbIds.has(dbProduct.id)) continue; // Zaten eşleşti

      // Source'ta en yakın adayı bul (name ile)
      let bestMatch: { source: SourceProduct; score: number } | null = null;

      for (const sourceProduct of sourceProducts) {
        if (matchedSourceSlugs.has(sourceProduct.slug.trim().toLowerCase())) continue;
        if (!sourceProduct.name || !dbProduct.name) continue;

        const score = similarityScore(sourceProduct.name, dbProduct.name);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { source: sourceProduct, score };
        }
      }

      // Eğer similarity score yüksekse (0.80+) "typo/alias olabilir" olarak işaretle
      // Düşükse "gerçekten kaynakta yok" olarak işaretle
      const threshold = 0.80;
      if (bestMatch && bestMatch.score >= threshold) {
        dbOnly.push({
          dbProduct,
          maybeSourceSlug: bestMatch.source.slug,
          maybeSourceName: bestMatch.source.name,
          similarityScore: bestMatch.score,
          reason: `Yüksek benzerlik (${bestMatch.score.toFixed(2)}) - typo/alias olabilir, outofstock'a alma`,
        });
      } else {
        dbOnly.push({
          dbProduct,
          maybeSourceSlug: bestMatch?.source.slug || null,
          maybeSourceName: bestMatch?.source.name || null,
          similarityScore: bestMatch?.score || null,
          reason: bestMatch
            ? `Düşük benzerlik (${bestMatch.score.toFixed(2)}) - gerçekten kaynakta yok`
            : "Kaynakta eşleşme bulunamadı - gerçekten kaynakta yok",
        });
      }
    }

    // DB-only'yi ikiye ayır: outofstock'a gidecekler ve gitmeyecekler
    const dbOnlyOutOfStock = dbOnly.filter((item) => {
      // Sadece "gerçekten kaynakta yok" olanlar outofstock'a gidecek
      return !item.reason.includes("typo/alias olabilir");
    });

    const dbOnlyKeep = dbOnly.filter((item) => {
      // "typo/alias olabilir" olanlar outofstock'a gitmeyecek
      return item.reason.includes("typo/alias olabilir");
    });

    console.log(`  ✅ DB-only analizi tamamlandı:`);
    console.log(`     - Outofstock'a gidecek: ${dbOnlyOutOfStock.length}`);
    console.log(`     - Typo/alias şüphesi (outofstock'a gitmeyecek): ${dbOnlyKeep.length}\n`);

    // 8. Source-only ürünleri bul (eşleşmemiş kaynak ürünleri)
    console.log("🔍 Source-only ürünler analiz ediliyor...");
    const sourceOnly: SourceOnlyResult[] = [];

    for (const sourceProduct of sourceProducts) {
      const sourceSlug = sourceProduct.slug.trim().toLowerCase();
      if (matchedSourceSlugs.has(sourceSlug)) continue; // Zaten eşleşti

      // DB'de en yakın adayı bul (name ile)
      let bestMatch: { db: DbProduct; score: number } | null = null;

      for (const dbProduct of dbProducts) {
        if (matchedDbIds.has(dbProduct.id)) continue;
        if (!sourceProduct.name || !dbProduct.name) continue;

        const score = similarityScore(sourceProduct.name, dbProduct.name);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { db: dbProduct, score };
        }
      }

      sourceOnly.push({
        sourceProduct,
        maybeDbSlug: bestMatch?.db.slug || null,
        similarityScore: bestMatch?.score || null,
      });
    }

    console.log(`  ✅ ${sourceOnly.length} source-only ürün bulundu\n`);

    // 9. Riskli eşleşmeleri say (similarity_score 0.80-0.90 arası)
    const riskyMatches = matches.filter(
      (m) => m.similarityScore !== undefined && m.similarityScore >= 0.80 && m.similarityScore < 0.90
    ).length;

    // 10. Özet JSON oluştur
    console.log("📊 Özet JSON oluşturuluyor...");
    const summary = {
      matched_count: matches.length,
      matched_by_type: {
        exact: matches.filter((m) => m.matchType === "exact").length,
        alias: matches.filter((m) => m.matchType === "alias").length,
        name: matches.filter((m) => m.matchType === "name").length,
      },
      db_only_final_count: dbOnlyOutOfStock.length,
      db_only_keep_count: dbOnlyKeep.length,
      source_only_final_count: sourceOnly.length,
      risky_matches_count: riskyMatches,
      db_count: dbProducts.length,
      source_count: sourceProducts.length,
    };

    const reconcileSummary = {
      summary,
      db_only_outofstock: dbOnlyOutOfStock.map((item) => ({
        db_id: item.dbProduct.id,
        db_wc_id: item.dbProduct.wc_id,
        db_slug: item.dbProduct.slug,
        db_name: item.dbProduct.name,
        db_status: item.dbProduct.status,
        db_stock_status: item.dbProduct.stock_status,
        db_price: item.dbProduct.price,
        db_price_tl: item.dbProduct.price ? (item.dbProduct.price / 100).toFixed(2) : null,
        maybe_source_slug: item.maybeSourceSlug,
        maybe_source_name: item.maybeSourceName,
        similarity_score: item.similarityScore,
        reason: item.reason,
      })),
      db_only_keep: dbOnlyKeep.map((item) => ({
        db_id: item.dbProduct.id,
        db_wc_id: item.dbProduct.wc_id,
        db_slug: item.dbProduct.slug,
        db_name: item.dbProduct.name,
        maybe_source_slug: item.maybeSourceSlug,
        maybe_source_name: item.maybeSourceName,
        similarity_score: item.similarityScore,
        reason: item.reason,
      })),
      source_only: sourceOnly.map((item) => ({
        source_slug: item.sourceProduct.slug,
        source_name: item.sourceProduct.name,
        source_price: item.sourceProduct.price,
        source_price_tl: item.sourceProduct.price ? (item.sourceProduct.price / 100).toFixed(2) : null,
        source_wc_id: item.sourceProduct.wc_id,
        maybe_db_slug: item.maybeDbSlug,
        similarity_score: item.similarityScore,
      })),
    };

    await writeFile(
      join(process.cwd(), "old-products", "reconcile-summary.json"),
      JSON.stringify(reconcileSummary, null, 2),
      "utf-8"
    );
    console.log("  ✅ Özet JSON kaydedildi\n");

    // 11. CSV dosyalarını oluştur
    console.log("📊 CSV dosyaları oluşturuluyor...");

    // db-only-final.csv
    const dbOnlyFinalCsv = [
      [
        "db_id",
        "db_wc_id",
        "db_slug",
        "db_name",
        "db_status",
        "db_stock_status",
        "db_price",
        "db_price_tl",
        "maybe_source_slug",
        "maybe_source_name",
        "similarity_score",
        "reason",
      ]
        .map(escapeCsv)
        .join(","),
      ...dbOnlyOutOfStock.map((item) =>
        [
          item.dbProduct.id,
          item.dbProduct.wc_id,
          item.dbProduct.slug,
          item.dbProduct.name,
          item.dbProduct.status,
          item.dbProduct.stock_status || "",
          item.dbProduct.price !== null ? item.dbProduct.price : "",
          item.dbProduct.price !== null ? (item.dbProduct.price / 100).toFixed(2) : "",
          item.maybeSourceSlug || "",
          item.maybeSourceName || "",
          item.similarityScore !== null ? item.similarityScore.toFixed(4) : "",
          item.reason,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");

    await writeFile(join(process.cwd(), "old-products", "db-only-final.csv"), dbOnlyFinalCsv, "utf-8");

    // source-only-final.csv
    const sourceOnlyFinalCsv = [
      ["source_slug", "source_name", "source_price", "source_price_tl", "source_wc_id", "maybe_db_slug", "similarity_score"]
        .map(escapeCsv)
        .join(","),
      ...sourceOnly.map((item) =>
        [
          item.sourceProduct.slug,
          item.sourceProduct.name,
          item.sourceProduct.price !== null ? item.sourceProduct.price : "",
          item.sourceProduct.price !== null ? (item.sourceProduct.price / 100).toFixed(2) : "",
          item.sourceProduct.wc_id !== null ? item.sourceProduct.wc_id : "",
          item.maybeDbSlug || "",
          item.similarityScore !== null ? item.similarityScore.toFixed(4) : "",
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");

    await writeFile(join(process.cwd(), "old-products", "source-only-final.csv"), sourceOnlyFinalCsv, "utf-8");

    console.log("  ✅ CSV dosyaları kaydedildi\n");

    // 12. Safety checks
    console.log("🔒 Safety checks yapılıyor...");

    // Check 1: Insert edilecek slug'ların DB'de zaten olmaması
    const insertSlugs = sourceOnly.map((item) => item.sourceProduct.slug.trim().toLowerCase());
    const duplicateSlugs: string[] = [];
    for (const slug of insertSlugs) {
      if (dbBySlug.has(slug)) {
        duplicateSlugs.push(slug);
      }
    }
    if (duplicateSlugs.length > 0) {
      console.error(`  ❌ HATA: ${duplicateSlugs.length} slug zaten DB'de var:`);
      duplicateSlugs.slice(0, 10).forEach((slug) => console.error(`     - ${slug}`));
      if (duplicateSlugs.length > 10) {
        console.error(`     ... ve ${duplicateSlugs.length - 10} tane daha`);
      }
      throw new Error(`Slug çakışması: ${duplicateSlugs.length} slug zaten DB'de var!`);
    }

    // Check 2: Insert edilecek wc_id'lerin unique olması (çakışırsa negative'e düş)
    const existingWcIds = new Set(dbProducts.map((p) => p.wc_id));
    const insertWcIds = new Set<number>();
    const wcIdConflicts: Array<{ sourceSlug: string; wcId: number }> = [];

    for (const item of sourceOnly) {
      if (item.sourceProduct.wc_id !== null) {
        if (existingWcIds.has(item.sourceProduct.wc_id) || insertWcIds.has(item.sourceProduct.wc_id)) {
          wcIdConflicts.push({
            sourceSlug: item.sourceProduct.slug,
            wcId: item.sourceProduct.wc_id,
          });
        } else {
          insertWcIds.add(item.sourceProduct.wc_id);
        }
      }
    }

    if (wcIdConflicts.length > 0) {
      console.log(`  ⚠️  ${wcIdConflicts.length} wc_id çakışması tespit edildi, negative wc_id üretilecek`);
    }

    // Check 3: Update count kontrolü (outofstock)
    if (dbOnlyOutOfStock.length === 0) {
      console.log("  ⚠️  Outofstock'a gidecek ürün yok, SQL dosyası boş olacak");
    } else {
      console.log(`  ✅ ${dbOnlyOutOfStock.length} ürün outofstock'a alınacak`);
    }

    // Check 4: Insert count kontrolü
    if (sourceOnly.length === 0) {
      console.log("  ⚠️  Eklenecek ürün yok, SQL dosyası boş olacak");
    } else {
      console.log(`  ✅ ${sourceOnly.length} ürün eklenecek`);
    }

    console.log("  ✅ Safety checks tamamlandı\n");

    // 13. SQL dosyalarını oluştur
    console.log("📝 SQL dosyaları oluşturuluyor...");

    // archive-db-only-outofstock-plan.sql (ROLLBACK)
    const outOfStockSql = `-- DB-only ürünleri outofstock yap (ROLLBACK)
-- Bu dosya ${dbOnlyOutOfStock.length} ürünü outofstock'a alacak
-- Uygulamadan önce dry-run yapın: cat old-products/archive-db-only-outofstock-plan.sql | docker exec -i cinselhobi_db psql -U cinselhobi -d cinselhobi

BEGIN;

UPDATE products
SET stock_status = 'outofstock',
    updated_at = NOW()
WHERE id IN (${dbOnlyOutOfStock.map((item) => item.dbProduct.id).join(", ")});

-- Kontrol: kaç ürün güncellendi?
SELECT COUNT(*) as updated_count FROM products WHERE id IN (${dbOnlyOutOfStock.map((item) => item.dbProduct.id).join(", ")});

ROLLBACK;
`;

    await writeFile(
      join(process.cwd(), "old-products", "archive-db-only-outofstock-plan.sql"),
      outOfStockSql,
      "utf-8"
    );

    // archive-db-only-outofstock-apply.sql (COMMIT)
    const outOfStockApplySql = `-- DB-only ürünleri outofstock yap (COMMIT)
-- Bu dosya ${dbOnlyOutOfStock.length} ürünü outofstock'a alacak
-- UYARI: Bu dosyayı çalıştırmadan önce plan dosyasını dry-run yapın!

BEGIN;

UPDATE products
SET stock_status = 'outofstock',
    updated_at = NOW()
WHERE id IN (${dbOnlyOutOfStock.map((item) => item.dbProduct.id).join(", ")});

-- Kontrol: kaç ürün güncellendi?
SELECT COUNT(*) as updated_count FROM products WHERE id IN (${dbOnlyOutOfStock.map((item) => item.dbProduct.id).join(", ")});

COMMIT;
`;

    await writeFile(
      join(process.cwd(), "old-products", "archive-db-only-outofstock-apply.sql"),
      outOfStockApplySql,
      "utf-8"
    );

    // insert-source-only-plan.sql (ROLLBACK)
    // wc_id çakışmalarını çöz ve negative wc_id üret
    let nextNegativeWcId = -1;
    const allWcIds = new Set(dbProducts.map((p) => p.wc_id));

    const insertProducts = sourceOnly.map((item) => {
      let wc_id = item.sourceProduct.wc_id;
      if (wc_id === null || allWcIds.has(wc_id)) {
        // Çakışma var, negative wc_id üret
        while (allWcIds.has(nextNegativeWcId)) {
          nextNegativeWcId--;
        }
        wc_id = nextNegativeWcId;
        nextNegativeWcId--;
      }
      allWcIds.add(wc_id); // Sonraki iterasyonlar için kaydet

      // Slug zaten safety check'te kontrol edildi, burada sadece kullan
      const slug = item.sourceProduct.slug;

      // Fiyat: kaynak JSON'daki raw.price alanı TL cinsindendir, daima TL * 100 yaparak kuruşa çevir
      // raw.price/raw.currency alanlarına dokunmuyoruz, sadece DB kolonlarına giden price/regular_price'ı düzeltiyoruz
      const rawObj = item.sourceProduct.raw as Record<string, unknown> | null | undefined;
      const rawPriceVal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawObj && typeof rawObj === "object" && "price" in rawObj ? (rawObj as any).price : null;

      const rawPriceTl =
        rawPriceVal === null || rawPriceVal === undefined ? null : Number(rawPriceVal);

      const priceKurus = rawPriceTl !== null && !Number.isNaN(rawPriceTl)
        ? Math.round(rawPriceTl * 100)
        : 0;
      const price = priceKurus;
      const regularPrice = priceKurus;
      const salePrice = null;

      // Images JSON formatında
      let imagesJson = "NULL";
      if (item.sourceProduct.images) {
        imagesJson = `'${JSON.stringify(item.sourceProduct.images).replace(/'/g, "''")}'::jsonb`;
      }

      // Raw JSON formatında (NOT NULL şartı)
      const rawJson = `'${JSON.stringify(item.sourceProduct.raw).replace(/'/g, "''")}'::jsonb`;

      return {
        wc_id,
        slug,
        name: item.sourceProduct.name.replace(/'/g, "''"),
        status: "publish", // sync-notes.md'ye göre publish yapılmalı
        type: "simple", // Varsayılan type
        currency: "TRY",
        price,
        regularPrice,
        salePrice,
        stockStatus: "instock", // sync-notes.md'ye göre instock yapılmalı
        imagesJson,
        rawJson,
      };
    });

    const insertSql = `-- Source-only ürünleri ekle (ROLLBACK)
-- Bu dosya ${insertProducts.length} ürün ekleyecek
-- Uygulamadan önce dry-run yapın: cat old-products/insert-source-only-plan.sql | docker exec -i cinselhobi_db psql -U cinselhobi -d cinselhobi

BEGIN;

INSERT INTO products (wc_id, slug, name, status, type, currency, price, regular_price, sale_price, stock_status, images, raw, created_at, updated_at)
VALUES
${insertProducts
  .map(
    (p) =>
      `  (${p.wc_id}, '${p.slug}', '${p.name}', '${p.status}', '${p.type}', '${p.currency}', ${p.price}, ${p.regularPrice}, ${p.salePrice === null ? "NULL" : p.salePrice}, '${p.stockStatus}', ${p.imagesJson}, ${p.rawJson}, NOW(), NOW())`
  )
  .join(",\n")};

-- Kontrol: kaç ürün eklendi?
SELECT COUNT(*) as inserted_count FROM products WHERE wc_id IN (${insertProducts.map((p) => p.wc_id).join(", ")});

ROLLBACK;
`;

    await writeFile(join(process.cwd(), "old-products", "insert-source-only-plan.sql"), insertSql, "utf-8");

    // insert-source-only-apply.sql (COMMIT)
    const insertApplySql = `-- Source-only ürünleri ekle (COMMIT)
-- Bu dosya ${insertProducts.length} ürün ekleyecek
-- UYARI: Bu dosyayı çalıştırmadan önce plan dosyasını dry-run yapın!

BEGIN;

INSERT INTO products (wc_id, slug, name, status, type, currency, price, regular_price, sale_price, stock_status, images, raw, created_at, updated_at)
VALUES
${insertProducts
  .map(
    (p) =>
      `  (${p.wc_id}, '${p.slug}', '${p.name}', '${p.status}', '${p.type}', '${p.currency}', ${p.price}, ${p.regularPrice}, ${p.salePrice === null ? "NULL" : p.salePrice}, '${p.stockStatus}', ${p.imagesJson}, ${p.rawJson}, NOW(), NOW())`
  )
  .join(",\n")};

-- Kontrol: kaç ürün eklendi?
SELECT COUNT(*) as inserted_count FROM products WHERE wc_id IN (${insertProducts.map((p) => p.wc_id).join(", ")});

COMMIT;
`;

    await writeFile(join(process.cwd(), "old-products", "insert-source-only-apply.sql"), insertApplySql, "utf-8");

    console.log("  ✅ SQL dosyaları kaydedildi\n");

    // 13. Konsol özeti
    console.log("📊 Özet:");
    console.log(`   DB ürün sayısı: ${summary.db_count}`);
    console.log(`   Kaynak ürün sayısı: ${summary.source_count}`);
    console.log(`   Eşleşen: ${summary.matched_count}`);
    console.log(`     - Exact slug: ${summary.matched_by_type.exact}`);
    console.log(`     - Alias slug: ${summary.matched_by_type.alias}`);
    console.log(`     - Name match: ${summary.matched_by_type.name}`);
    console.log(`   DB-only (outofstock'a gidecek): ${summary.db_only_final_count}`);
    console.log(`   DB-only (typo/alias şüphesi, outofstock'a gitmeyecek): ${summary.db_only_keep_count}`);
    console.log(`   Source-only (eklenecek): ${summary.source_only_final_count}`);
    console.log(`   Riskli eşleşmeler (0.80-0.90): ${summary.risky_matches_count}`);
    console.log();
    console.log("📁 Çıktı dosyaları:");
    console.log(`   - old-products/reconcile-summary.json`);
    console.log(`   - old-products/db-only-final.csv`);
    console.log(`   - old-products/source-only-final.csv`);
    console.log(`   - old-products/archive-db-only-outofstock-plan.sql (ROLLBACK)`);
    console.log(`   - old-products/archive-db-only-outofstock-apply.sql (COMMIT)`);
    console.log(`   - old-products/insert-source-only-plan.sql (ROLLBACK)`);
    console.log(`   - old-products/insert-source-only-apply.sql (COMMIT)`);
    console.log();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
