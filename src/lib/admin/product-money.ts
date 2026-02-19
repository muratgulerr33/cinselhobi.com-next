const trMoneyFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function parseMoneyToCents(rawValue: string, required: true): number;
export function parseMoneyToCents(rawValue: string, required: false): number | null;
export function parseMoneyToCents(rawValue: string, required: boolean): number | null {
  const compact = rawValue.trim().replace(/\s+/g, "");
  if (!compact) {
    return required ? Number.NaN : null;
  }

  if (!/^[\d.,]+$/.test(compact)) {
    return Number.NaN;
  }

  if (compact.includes(",")) {
    const commaCount = (compact.match(/,/g) ?? []).length;
    if (commaCount !== 1) {
      return Number.NaN;
    }

    const [integerRaw, fractionRaw = ""] = compact.split(",");
    const integerPartRaw = integerRaw.replace(/\./g, "");
    if (!/^\d+$/.test(integerPartRaw)) {
      return Number.NaN;
    }

    if (fractionRaw.length > 2 || (fractionRaw.length > 0 && !/^\d+$/.test(fractionRaw))) {
      return Number.NaN;
    }

    const integerPart = Number.parseInt(integerPartRaw, 10);
    const fractionPart = fractionRaw.padEnd(2, "0");
    const fractionValue = fractionPart ? Number.parseInt(fractionPart, 10) : 0;
    return (integerPart * 100) + fractionValue;
  }

  const dotMatches = compact.match(/\./g) ?? [];
  if (dotMatches.length === 1) {
    const [integerRaw, fractionRaw = ""] = compact.split(".");
    if (/^\d+$/.test(integerRaw) && /^\d{1,2}$/.test(fractionRaw)) {
      const integerPart = Number.parseInt(integerRaw, 10);
      const fractionValue = Number.parseInt(fractionRaw.padEnd(2, "0"), 10);
      return (integerPart * 100) + fractionValue;
    }
  }

  const integerPartRaw = compact.replace(/\./g, "");
  if (!/^\d+$/.test(integerPartRaw)) {
    return Number.NaN;
  }

  const tlValue = Number.parseInt(integerPartRaw, 10);
  return tlValue * 100;
}

export function formatCentsForInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return "";
  }

  return trMoneyFormatter.format(cents / 100);
}
