export function formatPriceCents(
  cents?: number | null,
  currency: string = "TRY"
): string {
  if (cents === null || cents === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatPrice(price: number | string | null | undefined) {
  if (price === null || price === undefined || price === "") return "";

  let tl: number;

  if (typeof price === "number") {
    // DB: integer kuruş varsayımı
    tl = price / 100;
  } else {
    const raw = String(price).trim();

    // "1.250,00" -> "1250.00"
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) return "";
    // String: TL varsayımı
    tl = parsed;
  }

  return (
    new Intl.NumberFormat("tr-TR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(tl) + " TL"
  );
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(d);
}

export function getPrimaryImageUrl(images: unknown): string | null {
  if (!images) {
    return null;
  }

  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "object" && first !== null && "src" in first) {
      const src = first.src;
      if (typeof src === "string") {
        return src;
      }
    }
  }

  return null;
}

