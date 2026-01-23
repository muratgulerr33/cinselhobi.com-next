import { cache } from "react";
import { readFileSync } from "fs";
import { join } from "path";

type HukukiSection = {
  title: string;
  body: string;
};

// Sabit slug map'i
const SLUG_MAP: Record<string, string> = {
  "Gizlilik ve Güvenlik": "gizlilik-ve-guvenlik",
  "Ödeme ve Teslimat": "odeme-ve-teslimat",
  "Cayma ve İade Koşulları": "cayma-ve-iade-kosullari",
  "Mesafeli Satış Sözleşmesi": "mesafeli-satis-sozlesmesi",
  "Biz kimiz?": "about",
  "İletişim & Destek": "support",
};

// Başlığı normalize et (lowercase + trim)
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim();
}

// Türkçe karakterleri slug'a çevir
function slugifyTR(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Başlıktan slug üret
function titleToSlug(title: string): string {
  const normalized = normalizeTitle(title);
  
  // Önce exact map'te ara
  for (const [mapTitle, slug] of Object.entries(SLUG_MAP)) {
    if (normalizeTitle(mapTitle) === normalized) {
      return slug;
    }
  }
  
  // Bulunamazsa slugifyTR ile fallback
  return slugifyTR(title);
}

// MD dosyasını oku ve bölümlere ayır
const parseHukukiMD = cache((): Record<string, HukukiSection> => {
  const filePath = join(process.cwd(), "hukuki.md");
  const content = readFileSync(filePath, "utf-8");
  
  const sections: Record<string, HukukiSection> = {};
  const lines = content.split("\n");
  
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";
    const isPrevEmpty = !prevLine;
    
    // Başlık kontrolü: #, ##, ### ile başlayan satırlar
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    
    if (headingMatch) {
      // Önceki bölümü kaydet
      if (currentTitle !== null) {
        const slug = titleToSlug(currentTitle);
        sections[slug] = {
          title: currentTitle,
          body: currentBody.join("\n").trim(),
        };
      }
      
      // Yeni bölüm başlat
      currentTitle = headingMatch[1].trim();
      currentBody = [];
    } else if (trimmed && isPrevEmpty) {
      // Önceki satır boşsa ve satır boş değilse,
      // normalize edilmiş hali SLUG_MAP'teki bir başlıkla eşleşiyorsa başlık olarak kabul et
      const cleanedTitle = trimmed.replace(/^[≥#\s]+/, "").trim();
      const normalized = normalizeTitle(cleanedTitle);
      let isHeading = false;
      
      for (const [mapTitle] of Object.entries(SLUG_MAP)) {
        if (normalizeTitle(mapTitle) === normalized) {
          // Önceki bölümü kaydet (eğer varsa)
          if (currentTitle !== null) {
            const slug = titleToSlug(currentTitle);
            sections[slug] = {
              title: currentTitle,
              body: currentBody.join("\n").trim(),
            };
          }
          
          // Yeni bölüm başlat
          currentTitle = cleanedTitle;
          currentBody = [];
          isHeading = true;
          break;
        }
      }
      
      // Başlık olarak algılanmadıysa içerik olarak ekle
      if (!isHeading && currentTitle !== null) {
        currentBody.push(line);
      }
    } else {
      // İçerik satırı
      if (currentTitle !== null) {
        currentBody.push(line);
      }
    }
  }
  
  // Son bölümü kaydet
  if (currentTitle !== null) {
    const slug = titleToSlug(currentTitle);
    sections[slug] = {
      title: currentTitle,
      body: currentBody.join("\n").trim(),
    };
  }
  
  return sections;
});

// Belirli bir slug için bölüm getir
export async function getHukukiSection(
  slug: string
): Promise<HukukiSection | null> {
  const sections = parseHukukiMD();
  return sections[slug] || null;
}

// Tüm bölümleri getir
export async function getAllHukukiSections(): Promise<
  Record<string, HukukiSection>
> {
  return parseHukukiMD();
}

