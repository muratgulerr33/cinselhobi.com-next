export function formatPriceTL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "—";
  }

  const hasFraction = Math.abs(cents) % 100 !== 0;

  return `${new Intl.NumberFormat("tr-TR", {
    style: "decimal",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)} TL`;
}
