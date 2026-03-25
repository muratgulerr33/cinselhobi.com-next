"use client";

export const TAWK_SUPPRESSION_SOURCES = {
  searchOverlay: "search-overlay",
  catalogControls: "catalog-controls",
  mobileCartDrawer: "mobile-cart-drawer",
  hubQuickLook: "hub-quick-look",
  checkoutThreeDS: "checkout-3ds",
  checkoutPayTR: "checkout-paytr",
  accountAddressDrawer: "account-address-drawer",
  ageGate: "age-gate",
} as const;

export type TawkSuppressionSource =
  (typeof TAWK_SUPPRESSION_SOURCES)[keyof typeof TAWK_SUPPRESSION_SOURCES];

type TawkSuppressionListener = (sources: ReadonlySet<TawkSuppressionSource>) => void;

const suppressionCounts = new Map<TawkSuppressionSource, number>();
const listeners = new Set<TawkSuppressionListener>();

function emitSuppressionChange() {
  const snapshot = new Set(suppressionCounts.keys());

  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function getTawkSuppressionSources(): ReadonlySet<TawkSuppressionSource> {
  return new Set(suppressionCounts.keys());
}

export function setTawkSuppressed(source: TawkSuppressionSource, suppressed: boolean) {
  if (suppressed) {
    const nextCount = (suppressionCounts.get(source) ?? 0) + 1;
    suppressionCounts.set(source, nextCount);
    if (nextCount === 1) {
      emitSuppressionChange();
    }
    return;
  }

  const currentCount = suppressionCounts.get(source);
  if (!currentCount) {
    return;
  }

  if (currentCount === 1) {
    suppressionCounts.delete(source);
    emitSuppressionChange();
    return;
  }

  suppressionCounts.set(source, currentCount - 1);
}

export function subscribeToTawkSuppression(listener: TawkSuppressionListener) {
  listeners.add(listener);
  listener(getTawkSuppressionSources());

  return () => {
    listeners.delete(listener);
  };
}
