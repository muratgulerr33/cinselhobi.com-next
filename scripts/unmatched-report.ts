import { readFile, writeFile } from "fs/promises";
import { join } from "path";

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

// Basit benzerlik skoru (0-1 arası)
// Dice coefficient benzeri
function similarityScore(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 0.95; // Normalize sonrası eşitse yüksek skor

  // Basit Levenshtein benzeri yaklaşım
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  // Bigram benzerliği (basit yaklaşım)
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

  // Object ise products/items/data/rows/list gibi alanları dene
  if (typeof data === "object" && data !== null) {
    const candidates = ["products", "items", "data", "rows", "list"];
    for (const key of candidates) {
      if (Array.isArray(data[key])) {
        return { products: data[key], error: null };
      }
    }

    // Bulunamadı, örnek key'leri döndür
    const sampleKeys = Object.keys(data).slice(0, 10);
    return {
      products: [],
      error: `Unknown shape: Array veya products/items/data/rows/list alanı bulunamadı. Örnek key'ler: ${sampleKeys.join(", ")}`,
    };
  }

  return { products: [], error: "Unknown shape: Ne array ne de object" };
}

// Fiyat parse fonksiyonu (kuruş cinsinden integer döner)
function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Sayı ise direkt kullan (zaten kuruş cinsinden olabilir)
  if (typeof value === "number") {
    if (isNaN(value) || value < 0) {
      return null;
    }
    // Eğer çok küçükse (örn. 26.00 gibi) TL cinsinden olabilir, kuruşa çevir
    if (value < 1000) {
      return Math.round(value * 100);
    }
    return Math.round(value);
  }

  // String ise parse et
  if (typeof value === "string") {
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

    // Eğer çok küçükse TL cinsinden olabilir, kuruşa çevir
    if (num < 1000) {
      return Math.round(num * 100);
    }
    return Math.round(num);
  }

  return null;
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
  id: string;
  wc_id: string;
  slug: string;
  name: string;
  sku: string;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  status: string;
  type: string;
}

interface SourceProduct {
  slug: string;
  name: string;
  sku: string | null;
  price: number | null;
  id: number | null;
}

async function main() {
  console.log("🚀 Eşleşmeyen ürün raporu oluşturuluyor...\n");

  // 1. DB CSV'yi oku
  const dbCsvPath = join(process.cwd(), "old-products", "products-core.csv");
  console.log("📂 DB CSV okunuyor...");
  let dbCsvContent: string;
  try {
    dbCsvContent = await readFile(dbCsvPath, "utf-8");
  } catch (error) {
    console.error(`  ❌ HATA: ${dbCsvPath} dosyası bulunamadı`);
    process.exit(1);
  }

  const dbLines = dbCsvContent.trim().split("\n");
  if (dbLines.length < 2) {
    console.error("  ❌ HATA: CSV dosyası boş veya sadece header içeriyor");
    process.exit(1);
  }

  const dbHeaders = parseCsvLine(dbLines[0]);
  const dbProducts: DbProduct[] = [];

  for (let i = 1; i < dbLines.length; i++) {
    const values = parseCsvLine(dbLines[i]);
    if (values.length !== dbHeaders.length) {
      console.warn(`  ⚠️  Satır ${i + 1} atlandı (alan sayısı uyuşmuyor)`);
      continue;
    }

    const product: DbProduct = {
      id: values[dbHeaders.indexOf("id")] || "",
      wc_id: values[dbHeaders.indexOf("wc_id")] || "",
      slug: values[dbHeaders.indexOf("slug")] || "",
      name: values[dbHeaders.indexOf("name")] || "",
      sku: values[dbHeaders.indexOf("sku")] || "",
      price: parsePrice(values[dbHeaders.indexOf("price")]),
      regular_price: parsePrice(values[dbHeaders.indexOf("regular_price")]),
      sale_price: parsePrice(values[dbHeaders.indexOf("sale_price")]),
      status: values[dbHeaders.indexOf("status")] || "",
      type: values[dbHeaders.indexOf("type")] || "",
    };

    dbProducts.push(product);
  }

  console.log(`  ✅ ${dbProducts.length} ürün DB CSV'den okundu\n`);

  // 2. Kaynak JSON'u oku
  const sourceJsonPath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
  console.log("📂 Kaynak JSON okunuyor...");
  let sourceJsonContent: string;
  try {
    sourceJsonContent = await readFile(sourceJsonPath, "utf-8");
  } catch (error) {
    console.error(`  ❌ HATA: ${sourceJsonPath} dosyası bulunamadı`);
    process.exit(1);
  }

  let sourceData: unknown;
  try {
    sourceData = JSON.parse(sourceJsonContent);
  } catch (error) {
    console.error(`  ❌ HATA: JSON parse edilemedi: ${error}`);
    process.exit(1);
  }

  const { products: sourceProductsRaw, error: extractError } = extractProductsArray(sourceData);

  if (extractError) {
    console.error(`  ❌ HATA: ${extractError}`);
    process.exit(1);
  }

  console.log(`  ✅ ${sourceProductsRaw.length} ürün kaynak JSON'dan okundu\n`);

  // 3. Kaynak ürünleri işle
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

    // sku alanını dene
    let sku: string | null = null;
    if (product.sku !== undefined && product.sku !== null) {
      sku = String(product.sku).trim() || null;
    }

    // price alanlarını dene
    let price: number | null = null;
    if (product.price !== undefined && product.price !== null) {
      price = parsePrice(product.price);
    } else if (product.price_text !== undefined && product.price_text !== null) {
      price = parsePrice(product.price_text);
    }

    // id alanlarını dene
    let id: number | null = null;
    if (product.id !== undefined && product.id !== null) {
      const num = Number(product.id);
      if (!isNaN(num) && num > 0) {
        id = Math.floor(num);
      }
    } else if (product.external_id !== undefined && product.external_id !== null) {
      const num = Number(product.external_id);
      if (!isNaN(num) && num > 0) {
        id = Math.floor(num);
      }
    }

    sourceProducts.push({
      slug,
      name: name || "",
      sku,
      price,
      id,
    });
  }

  console.log(`  ✅ ${sourceProducts.length} kaynak ürün işlendi\n`);

  // 4. Slug ile eşleştirme
  console.log("🔗 Slug ile eşleştirme yapılıyor...");

  const dbBySlug = new Map<string, DbProduct>();
  for (const dbProduct of dbProducts) {
    if (dbProduct.slug) {
      dbBySlug.set(dbProduct.slug.trim().toLowerCase(), dbProduct);
    }
  }

  const sourceBySlug = new Map<string, SourceProduct>();
  for (const sourceProduct of sourceProducts) {
    if (sourceProduct.slug) {
      sourceBySlug.set(sourceProduct.slug.trim().toLowerCase(), sourceProduct);
    }
  }

  const matchedSlugs = new Set<string>();
  for (const [slug, dbProduct] of dbBySlug) {
    if (sourceBySlug.has(slug)) {
      matchedSlugs.add(slug);
    }
  }

  const sourceOnly: SourceProduct[] = [];
  for (const [slug, sourceProduct] of sourceBySlug) {
    if (!matchedSlugs.has(slug)) {
      sourceOnly.push(sourceProduct);
    }
  }

  const dbOnly: DbProduct[] = [];
  for (const [slug, dbProduct] of dbBySlug) {
    if (!matchedSlugs.has(slug)) {
      dbOnly.push(dbProduct);
    }
  }

  console.log(`  ✅ Eşleştirme tamamlandı\n`);

  // 5. Suggestions oluştur (source-only için DB-only içinde en yakın aday)
  console.log("💡 Öneriler oluşturuluyor...");

  interface Suggestion {
    source_slug: string;
    source_name: string | null;
    source_price: number | null;
    best_db_candidate_slug: string | null;
    best_db_candidate_name: string | null;
    best_score: number;
  }

  const suggestions: Suggestion[] = [];

  for (const sourceProduct of sourceOnly) {
    if (!sourceProduct.name) {
      suggestions.push({
        source_slug: sourceProduct.slug,
        source_name: null,
        source_price: sourceProduct.price,
        best_db_candidate_slug: null,
        best_db_candidate_name: null,
        best_score: 0,
      });
      continue;
    }

    let bestMatch: { product: DbProduct; score: number } | null = null;

    for (const dbProduct of dbOnly) {
      if (!dbProduct.name) continue;

      const score = similarityScore(sourceProduct.name, dbProduct.name);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { product: dbProduct, score };
      }
    }

    suggestions.push({
      source_slug: sourceProduct.slug,
      source_name: sourceProduct.name,
      source_price: sourceProduct.price,
      best_db_candidate_slug: bestMatch ? bestMatch.product.slug : null,
      best_db_candidate_name: bestMatch ? bestMatch.product.name : null,
      best_score: bestMatch ? bestMatch.score : 0,
    });
  }

  console.log(`  ✅ ${suggestions.length} öneri oluşturuldu\n`);

  // 6. CSV dosyalarını oluştur
  console.log("📊 CSV dosyaları oluşturuluyor...");

  // unmatched-source-only.csv
  const sourceOnlyCsv = [
    ["slug", "name", "sku", "price", "id"].map(escapeCsv).join(","),
    ...sourceOnly.map((p) =>
      [
        p.slug,
        p.name || "",
        p.sku || "",
        p.price !== null ? p.price : "",
        p.id !== null ? p.id : "",
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ].join("\n");

  await writeFile(
    join(process.cwd(), "old-products", "unmatched-source-only.csv"),
    sourceOnlyCsv,
    "utf-8"
  );

  // unmatched-db-only.csv
  const dbOnlyCsv = [
    ["id", "wc_id", "slug", "name", "sku", "price", "regular_price", "sale_price", "status", "type"]
      .map(escapeCsv)
      .join(","),
    ...dbOnly.map((p) =>
      [
        p.id,
        p.wc_id,
        p.slug,
        p.name,
        p.sku,
        p.price !== null ? p.price : "",
        p.regular_price !== null ? p.regular_price : "",
        p.sale_price !== null ? p.sale_price : "",
        p.status,
        p.type,
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ].join("\n");

  await writeFile(join(process.cwd(), "old-products", "unmatched-db-only.csv"), dbOnlyCsv, "utf-8");

  // unmatched-suggestions.csv
  const suggestionsCsv = [
    ["source_slug", "source_name", "source_price", "best_db_candidate_slug", "best_db_candidate_name", "best_score"]
      .map(escapeCsv)
      .join(","),
    ...suggestions.map((s) =>
      [
        s.source_slug,
        s.source_name || "",
        s.source_price !== null ? s.source_price : "",
        s.best_db_candidate_slug || "",
        s.best_db_candidate_name || "",
        s.best_score.toFixed(4),
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ].join("\n");

  await writeFile(
    join(process.cwd(), "old-products", "unmatched-suggestions.csv"),
    suggestionsCsv,
    "utf-8"
  );

  console.log("  ✅ CSV dosyaları kaydedildi\n");

  // 7. Konsol özeti
  const dbSkuNonEmptyCount = dbProducts.filter((p) => p.sku && p.sku.trim() !== "").length;
  const sourceSkuNonEmptyCount = sourceProducts.filter((p) => p.sku && p.sku.trim() !== "").length;

  console.log("📊 Özet:");
  console.log(`   DB ürün sayısı: ${dbProducts.length}`);
  console.log(`   Kaynak ürün sayısı: ${sourceProducts.length}`);
  console.log(`   Slug ile eşleşen: ${matchedSlugs.size}`);
  console.log(`   Kaynakta var, DB'de yok (source-only): ${sourceOnly.length}`);
  console.log(`   DB'de var, kaynakta yok (db-only): ${dbOnly.length}`);
  console.log(`   DB'de SKU dolu: ${dbSkuNonEmptyCount}`);
  console.log(`   Kaynakta SKU dolu: ${sourceSkuNonEmptyCount}`);
  console.log();
  console.log("📁 Çıktı dosyaları:");
  console.log(`   - old-products/unmatched-source-only.csv`);
  console.log(`   - old-products/unmatched-db-only.csv`);
  console.log(`   - old-products/unmatched-suggestions.csv`);
  console.log();
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
