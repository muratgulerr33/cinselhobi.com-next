/**
 * Hub UI Configuration
 * 
 * Single source of truth for hub screens.
 * Maps UI hubs to locked category tree slugs.
 */

export interface HubCard {
  key: string;
  label: string;
  parentSlug: string;
  childSlug: string;
  policy: "hidden-if-empty";
}

export interface Hub {
  hubSlug: string;
  label: string;
  subtitle: string;
  primaryCta: {
    label: string;
    href: string;
  };
  cards: HubCard[];
}

/**
 * Builds href for hub card: /${parentSlug}?sub=${childWcId}
 */
export function buildHubCardHref(parentSlug: string, childWcId: number): string {
  return `/${parentSlug}?sub=${childWcId}`;
}

export const HUBS: Hub[] = [
  {
    hubSlug: "erkek-ve-performans",
    label: "Erkek & Performans",
    subtitle: "Performans ve güven için özel ürünler",
    primaryCta: {
      label: "Tümünü Gör",
      href: "/erkeklere-ozel",
    },
    cards: [
      {
        key: "geciktiriciler",
        label: "Geciktiriciler",
        parentSlug: "erkeklere-ozel",
        childSlug: "geciktiriciler",
        policy: "hidden-if-empty",
      },
      {
        key: "sertlesme-pompalar",
        label: "Sertleşme & Pompalar",
        parentSlug: "erkeklere-ozel",
        childSlug: "penis-pompalari",
        policy: "hidden-if-empty",
      },
      {
        key: "masturbatorler",
        label: "Masturbatörler",
        parentSlug: "erkeklere-ozel",
        childSlug: "suni-vajina-masturbatorler",
        policy: "hidden-if-empty",
      },
      {
        key: "realistik-mankenler",
        label: "Realistik Mankenler",
        parentSlug: "erkeklere-ozel",
        childSlug: "realistik-mankenler",
        policy: "hidden-if-empty",
      },
      {
        key: "halkalar-kiliflar",
        label: "Halkalar & Kılıflar",
        parentSlug: "erkeklere-ozel",
        childSlug: "halka-kiliflar",
        policy: "hidden-if-empty",
      },
    ],
  },
  {
    hubSlug: "kadin-ve-haz",
    label: "Kadın & Haz",
    subtitle: "Zevk ve haz için özenle seçilmiş ürünler",
    primaryCta: {
      label: "Tümünü Gör",
      href: "/sex-oyuncaklari",
    },
    cards: [
      {
        key: "modern-vibratorler",
        label: "Modern Vibratörler",
        parentSlug: "sex-oyuncaklari",
        childSlug: "modern-vibratorler",
        policy: "hidden-if-empty",
      },
      {
        key: "realistik-vibratorler",
        label: "Realistik Vibratörler",
        parentSlug: "sex-oyuncaklari",
        childSlug: "realistik-vibratorler",
        policy: "hidden-if-empty",
      },
      {
        key: "realistik-dildolar",
        label: "Realistik Dildolar",
        parentSlug: "sex-oyuncaklari",
        childSlug: "realistik-dildolar",
        policy: "hidden-if-empty",
      },
      {
        key: "fantezi-giyim",
        label: "Fantezi Giyim",
        parentSlug: "kadinlara-ozel",
        childSlug: "fantezi-giyim",
        policy: "hidden-if-empty",
      },
      {
        key: "istek-arttiricilar",
        label: "İstek Arttırıcılar",
        parentSlug: "kadinlara-ozel",
        childSlug: "bayan-istek-arttiricilar",
        policy: "hidden-if-empty",
      },
    ],
  },
  {
    hubSlug: "ciftlere-ozel",
    label: "Çiftlere Özel",
    subtitle: "Birlikte keyif alabileceğiniz özel ürünler",
    primaryCta: {
      label: "Tümünü Gör",
      href: "/kozmetik",
    },
    cards: [
      {
        key: "kayganlastiricilar",
        label: "Kayganlaştırıcılar",
        parentSlug: "kozmetik",
        childSlug: "kayganlastirici-jeller",
        policy: "hidden-if-empty",
      },
      {
        key: "masaj-yaglari",
        label: "Masaj Yağları",
        parentSlug: "kozmetik",
        childSlug: "masaj-yaglari",
        policy: "hidden-if-empty",
      },
      {
        key: "prezervatifler",
        label: "Prezervatifler",
        parentSlug: "kozmetik",
        childSlug: "prezervatifler",
        policy: "hidden-if-empty",
      },
      {
        key: "belden-baglamalilar",
        label: "Beden Bağlamalılar",
        parentSlug: "sex-oyuncaklari",
        childSlug: "belden-baglamalilar",
        policy: "hidden-if-empty",
      },
      {
        key: "fetis-fantezi",
        label: "Fetiş & Fantezi",
        parentSlug: "kadinlara-ozel",
        childSlug: "fetis-fantezi",
        policy: "hidden-if-empty",
      },
    ],
  },
  {
    hubSlug: "saglik-ve-bakim",
    label: "Sağlık & Bakım",
    subtitle: "Sağlık ve bakım için güvenilir ürünler",
    primaryCta: {
      label: "Tümünü Gör",
      href: "/kozmetik",
    },
    cards: [
      {
        key: "kayganlastiricilar",
        label: "Kayganlaştırıcılar",
        parentSlug: "kozmetik",
        childSlug: "kayganlastirici-jeller",
        policy: "hidden-if-empty",
      },
      {
        key: "masaj-yaglari",
        label: "Masaj Yağları",
        parentSlug: "kozmetik",
        childSlug: "masaj-yaglari",
        policy: "hidden-if-empty",
      },
      {
        key: "prezervatifler",
        label: "Prezervatifler",
        parentSlug: "kozmetik",
        childSlug: "prezervatifler",
        policy: "hidden-if-empty",
      },
      {
        key: "parfumler",
        label: "Parfümler",
        parentSlug: "kozmetik",
        childSlug: "parfumler",
        policy: "hidden-if-empty",
      },
      {
        key: "geciktiriciler",
        label: "Geciktiriciler",
        parentSlug: "erkeklere-ozel",
        childSlug: "geciktiriciler",
        policy: "hidden-if-empty",
      },
    ],
  },
  {
    hubSlug: "fantezi-dunyasi",
    label: "Fantezi Dünyası",
    subtitle: "Hayal gücünüzün sınırlarını zorlayan ürünler",
    primaryCta: {
      label: "Tümünü Gör",
      href: "/kadinlara-ozel",
    },
    cards: [
      {
        key: "fetis-fantezi",
        label: "Fetiş & Fantezi",
        parentSlug: "kadinlara-ozel",
        childSlug: "fetis-fantezi",
        policy: "hidden-if-empty",
      },
      {
        key: "fantezi-giyim",
        label: "Fantezi Giyim",
        parentSlug: "kadinlara-ozel",
        childSlug: "fantezi-giyim",
        policy: "hidden-if-empty",
      },
      {
        key: "anal-oyuncaklar",
        label: "Anal Oyuncaklar",
        parentSlug: "sex-oyuncaklari",
        childSlug: "anal-oyuncaklar",
        policy: "hidden-if-empty",
      },
      {
        key: "belden-baglamalilar",
        label: "Beden Bağlamalılar",
        parentSlug: "sex-oyuncaklari",
        childSlug: "belden-baglamalilar",
        policy: "hidden-if-empty",
      },
    ],
  },
];

/**
 * Get hub by slug
 */
export function getHubBySlug(hubSlug: string): Hub | undefined {
  return HUBS.find((hub) => hub.hubSlug === hubSlug);
}

/**
 * Get all hub slugs
 */
export function getAllHubSlugs(): string[] {
  return HUBS.map((hub) => hub.hubSlug);
}
