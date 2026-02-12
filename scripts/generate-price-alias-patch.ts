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

// Fiyat parse fonksiyonu (TL'den kuruş'a çevirir, kuruş cinsinden integer döner)
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

  // TL'yi kuruş'a çevir
  const priceKurus = Math.round(priceTl * 100);
  return priceKurus;
}

// Confirmed list (plan'dan)
const CONFIRMED_SOURCE_SLUGS = [
  "beautiful-johson-92-inc-vibrator",
  "ero-shop-barbara-83-inc-dildo",
  "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml-cilekli",
  "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-250-ml",
  "bona-tessa-su-bazli-kayganlastiricili-masaj-jeli-400-ml",
  "belden-baglamali-modern-dildo-siyah-125-cm",
  "belden-baglamali-titresimli-125-cm-ici-bos-ikili-catal-strapon-penis",
  "beyaz-dantel-fantazi-ic-camasir",
  "silky-kiss-aloa-vera-ozlu-prezervatif",
  "melez-jasiel-full-realistik-sex-doll",
];

interface PatchRow {
  source_slug: string;
  db_slug: string;
  source_price: number;
  warnings: string[];
}

async function main() {
  console.log("🚀 Price alias patch üretimi başlatılıyor...\n");

  // 1. unmatched-suggestions.csv oku
  const suggestionsPath = join(process.cwd(), "old-products", "unmatched-suggestions.csv");
  console.log("📂 unmatched-suggestions.csv okunuyor...");
  let suggestionsContent: string;
  try {
    suggestionsContent = await readFile(suggestionsPath, "utf-8");
  } catch (error) {
    console.error(`  ❌ HATA: ${suggestionsPath} dosyası bulunamadı`);
    process.exit(1);
  }

  const suggestionsLines = suggestionsContent.trim().split("\n");
  if (suggestionsLines.length < 2) {
    console.error("  ❌ HATA: CSV dosyası boş veya sadece header içeriyor");
    process.exit(1);
  }

  const suggestionsHeaders = parseCsvLine(suggestionsLines[0]);
  const sourceSlugIndex = suggestionsHeaders.indexOf("source_slug");
  const bestDbCandidateSlugIndex = suggestionsHeaders.indexOf("best_db_candidate_slug");

  if (sourceSlugIndex === -1 || bestDbCandidateSlugIndex === -1) {
    console.error("  ❌ HATA: CSV header'da gerekli kolonlar bulunamadı");
    process.exit(1);
  }

  // Map: source_slug -> best_db_candidate_slug
  const slugMap = new Map<string, string>();
  for (let i = 1; i < suggestionsLines.length; i++) {
    const values = parseCsvLine(suggestionsLines[i]);
    if (values.length <= sourceSlugIndex || values.length <= bestDbCandidateSlugIndex) {
      continue;
    }
    const sourceSlug = values[sourceSlugIndex]?.trim();
    const dbSlug = values[bestDbCandidateSlugIndex]?.trim();
    if (sourceSlug && dbSlug) {
      slugMap.set(sourceSlug.toLowerCase(), dbSlug);
    }
  }

  console.log(`  ✅ ${slugMap.size} slug mapping okundu\n`);

  // 2. eroshopa-products.final.json oku
  const sourceJsonPath = join(process.cwd(), "old-products", "eroshopa-products.final.json");
  console.log("📂 eroshopa-products.final.json okunuyor...");
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

  // slug -> price map çıkar
  const priceMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const product of sourceProductsRaw) {
    const slug = product.slug ? String(product.slug).trim() : null;
    if (!slug) {
      continue;
    }

    // price alanlarını dene
    let price: number | null = null;
    if (product.price !== undefined && product.price !== null) {
      price = parsePrice(product.price);
    } else if (product.price_text !== undefined && product.price_text !== null) {
      price = parsePrice(product.price_text);
    }

    if (price !== null) {
      priceMap.set(slug.toLowerCase(), price);
    }
  }

  console.log(`  ✅ ${priceMap.size} ürün fiyatı okundu\n`);

  // 3. Confirmed list üzerinde dön
  console.log("🔍 Confirmed list işleniyor...");
  const patchRows: PatchRow[] = [];
  let warningCount = 0;

  for (const sourceSlug of CONFIRMED_SOURCE_SLUGS) {
    const sourceSlugLower = sourceSlug.toLowerCase();
    const warnings: string[] = [];

    // source_slug var mı?
    if (!slugMap.has(sourceSlugLower)) {
      warnings.push(`source_slug bulunamadı: ${sourceSlug}`);
    }

    // db_slug (best candidate) var mı?
    const dbSlug = slugMap.get(sourceSlugLower);
    if (!dbSlug) {
      warnings.push(`db_slug bulunamadı: ${sourceSlug}`);
    }

    // source_price var mı?
    const sourcePrice = priceMap.get(sourceSlugLower);
    if (sourcePrice === undefined || sourcePrice === null) {
      warnings.push(`source_price bulunamadı: ${sourceSlug}`);
    }

    if (warnings.length > 0) {
      warningCount += warnings.length;
      console.log(`  ⚠️  ${sourceSlug}: ${warnings.join(", ")}`);
    }

    // Eğer tüm veriler varsa patch row ekle
    if (dbSlug && sourcePrice !== undefined && sourcePrice !== null) {
      patchRows.push({
        source_slug: sourceSlug,
        db_slug: dbSlug,
        source_price: sourcePrice,
        warnings,
      });
    }
  }

  console.log(`  ✅ ${patchRows.length} patch satırı hazırlandı`);
  if (warningCount > 0) {
    console.log(`  ⚠️  ${warningCount} warning\n`);
  } else {
    console.log();
  }

  // 4. Preview CSV oluştur
  console.log("📊 Preview CSV oluşturuluyor...");
  const previewCsv = [
    ["source_slug", "db_slug", "source_price"].map(escapeCsv).join(","),
    ...patchRows.map((row) =>
      [row.source_slug, row.db_slug, row.source_price].map(escapeCsv).join(",")
    ),
  ].join("\n");

  const previewPath = join(process.cwd(), "old-products", "price-update-alias-preview.csv");
  await writeFile(previewPath, previewCsv, "utf-8");
  console.log(`  ✅ ${previewPath} kaydedildi\n`);

  // 5. SQL dosyaları oluştur
  console.log("📝 SQL dosyaları oluşturuluyor...");

  // Plan SQL (ROLLBACK)
  const planSqlLines: string[] = ["BEGIN;", ""];
  for (const row of patchRows) {
    planSqlLines.push(
      `UPDATE products SET price = ${row.source_price}, regular_price = ${row.source_price} WHERE slug = '${row.db_slug.replace(/'/g, "''")}';`
    );
  }
  planSqlLines.push("", "ROLLBACK;");

  const planPath = join(process.cwd(), "old-products", "price-update-alias-plan.sql");
  await writeFile(planPath, planSqlLines.join("\n"), "utf-8");
  console.log(`  ✅ ${planPath} kaydedildi`);

  // Apply SQL (COMMIT)
  const applySqlLines: string[] = ["BEGIN;", ""];
  for (const row of patchRows) {
    applySqlLines.push(
      `UPDATE products SET price = ${row.source_price}, regular_price = ${row.source_price} WHERE slug = '${row.db_slug.replace(/'/g, "''")}';`
    );
  }
  applySqlLines.push("", "COMMIT;");

  const applyPath = join(process.cwd(), "old-products", "price-update-alias-apply.sql");
  await writeFile(applyPath, applySqlLines.join("\n"), "utf-8");
  console.log(`  ✅ ${applyPath} kaydedildi\n`);

  // 6. Konsola özet
  console.log("📊 Özet:");
  console.log(`   Patch satır sayısı: ${patchRows.length}`);
  console.log(`   Warning sayısı: ${warningCount}`);
  console.log();
  console.log("📁 Çıktı dosyaları:");
  console.log(`   - old-products/price-update-alias-preview.csv`);
  console.log(`   - old-products/price-update-alias-plan.sql (ROLLBACK)`);
  console.log(`   - old-products/price-update-alias-apply.sql (COMMIT)`);
  console.log();
}

main().catch((error) => {
  console.error("\n❌ HATA:", error);
  process.exit(1);
});
