/**
 * Kategori isimlerini normalize eder: FULL CAPS -> Title Case (TR uyumlu)
 * 
 * Sadece "tamamı büyük harf" gibi görünen string'leri düzelt.
 * TR locale kullanarak Türkçe karakterleri doğru şekilde işler.
 * 
 * Örnekler:
 * - "GECİKTİRİCİLER" -> "Geciktiriciler"
 * - "REALİSTİK MANKENLER" -> "Realistik Mankenler"
 * - "ANAL OYUNCAKLAR" -> "Anal Oyuncaklar"
 * - "Halka ve Kılıflar" -> "Halka ve Kılıflar" (değişmez)
 */

/**
 * String'in tamamı büyük harf mi kontrol eder
 */
function isAllCaps(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  
  const upper = trimmed.toLocaleUpperCase('tr-TR');
  const lower = trimmed.toLocaleLowerCase('tr-TR');
  
  // Tamamı büyük harf ise ve küçük harfe çevrildiğinde farklıysa all-caps kabul et
  return trimmed === upper && trimmed !== lower;
}

/**
 * Bir kelimeyi Title Case'e çevirir (TR uyumlu)
 */
function capitalizeTr(word: string): string {
  if (word.length === 0) return word;
  
  const first = word[0].toLocaleUpperCase('tr-TR');
  const rest = word.slice(1).toLocaleLowerCase('tr-TR');
  
  return first + rest;
}

/**
 * Kategori ismini normalize eder: FULL CAPS -> Title Case
 * 
 * @param name - Normalize edilecek kategori ismi
 * @returns Normalize edilmiş kategori ismi
 */
export function normalizeCategoryName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }
  
  // All-caps değilse aynen döndür
  if (!isAllCaps(name)) {
    return name;
  }
  
  // All-caps ise Title Case'e çevir
  const lower = name.toLocaleLowerCase('tr-TR');
  const words = lower.split(/\s+/);
  const titleCase = words.map(capitalizeTr).join(' ');
  
  return titleCase;
}
