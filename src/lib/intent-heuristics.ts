// Intent heuristics utility
// Skor bazlı intent detection ile kategori bağlamı desteği

const ERKEK_KEYWORDS = [
  "penis",
  "masturbator",
  "mastürbatör",
  "pompa",
  "kilif",
  "halka",
  "suni-vajina",
  "kalca",
];

const KADIN_KEYWORDS = [
  "vibrator",
  "vibratör",
  "dildo",
  "realistik-vibrator",
];

// "vajina/vajinal" kelimesi tek başına kadın intent yapmamalı
// Çünkü "suni vajina masturbator" erkek bağlamında normal
const VAJINA_KEYWORDS = ["vajina", "vajinal"];

const NEUTRAL_KEYWORDS = [
  "kayganlastirici",
  "prezervatif",
  "geciktirici",
  "fantezi",
  "kozmetik",
];

// Kategori override: Bu kategoriler intent'i kesin olarak belirler
const ERKEK_OVERRIDE_CATEGORIES = ["suni-vajina-masturbatorler"];
const KADIN_OVERRIDE_CATEGORIES = [
  "realistik-vibratorler",
  "modern-vibratorler",
];

export type IntentClass = "erkek" | "kadin" | "neutral" | "unknown";

export interface IntentResult {
  intent: IntentClass;
  keywords: string[];
  scores?: {
    erkekScore: number;
    kadinScore: number;
  };
}

/**
 * Ürün intent'ini tespit eder (slug, name ve kategori slug'larına göre)
 * Skor bazlı hesaplama yapar ve kategori override'ları uygular.
 */
export function detectIntent(
  slug: string,
  name: string,
  categorySlugs: string[] = []
): IntentResult {
  const combined = `${slug} ${name}`.toLowerCase();
  const foundKeywords: string[] = [];

  let erkekScore = 0;
  let kadinScore = 0;

  // Erkek intent keyword'leri kontrolü
  for (const keyword of ERKEK_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
      erkekScore += 1;
    }
  }

  // Kadın intent keyword'leri kontrolü
  for (const keyword of KADIN_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
      kadinScore += 1;
    }
  }

  // "vajina/vajinal" kelimesi - neutral puan (çok düşük kadın puanı)
  for (const keyword of VAJINA_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
      // Çok düşük kadın puanı (0.1 gibi), ama override olabilir
      kadinScore += 0.1;
    }
  }

  // Neutral keyword'ler
  for (const keyword of NEUTRAL_KEYWORDS) {
    if (combined.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }

  // Kategori override kontrolü (en kritik - öncelikli)
  const categorySlugsLower = categorySlugs.map((s) => s.toLowerCase());
  
  for (const catSlug of categorySlugsLower) {
    if (ERKEK_OVERRIDE_CATEGORIES.includes(catSlug)) {
      return {
        intent: "erkek",
        keywords: foundKeywords,
        scores: { erkekScore: erkekScore + 10, kadinScore }, // Override için yüksek skor
      };
    }
    if (KADIN_OVERRIDE_CATEGORIES.includes(catSlug)) {
      return {
        intent: "kadin",
        keywords: foundKeywords,
        scores: { erkekScore, kadinScore: kadinScore + 10 }, // Override için yüksek skor
      };
    }
  }

  // Skor bazlı karar verme
  const hasNeutralKeyword = NEUTRAL_KEYWORDS.some((k) =>
    foundKeywords.includes(k)
  );

  if (hasNeutralKeyword && erkekScore === 0 && kadinScore === 0) {
    return {
      intent: "neutral",
      keywords: foundKeywords,
      scores: { erkekScore, kadinScore },
    };
  }

  if (erkekScore > kadinScore) {
    return {
      intent: "erkek",
      keywords: foundKeywords,
      scores: { erkekScore, kadinScore },
    };
  }

  if (kadinScore > erkekScore) {
    return {
      intent: "kadin",
      keywords: foundKeywords,
      scores: { erkekScore, kadinScore },
    };
  }

  if (erkekScore === kadinScore && erkekScore > 0) {
    return {
      intent: "neutral",
      keywords: foundKeywords,
      scores: { erkekScore, kadinScore },
    };
  }

  return {
    intent: "unknown",
    keywords: foundKeywords,
    scores: { erkekScore, kadinScore },
  };
}
