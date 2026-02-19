import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Yeni güncellediğimiz provider
import { ThemeProvider } from "@/components/theme/theme-provider";
import { HeaderProvider } from "@/components/layout/header-context";
import { AppRouteChrome } from "@/components/app/app-route-chrome";
import { CartProvider } from "@/components/cart/cart-provider";
import { SearchProvider } from "@/components/search/search-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FavoritesProvider } from "@/components/favorites/favorites-provider";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { getCanonicalBaseUrl } from "@/lib/seo/canonical";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { GA4PageViews } from "@/components/analytics/GA4PageViews";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Canonical URL'yi tek bir formata sabitle (www + https, trailing slash yok)
// Not: www yalnızca apex domainlerde (example.com, example.com.tr gibi) zorlanır;
// api.example.com gibi subdomainlerde dokunulmaz.
const canonicalBase = (() => {
  const raw = getCanonicalBaseUrl();
  try {
    const u = new URL(raw);
    const hostParts = u.hostname.split(".");
    const isLocalhost = u.hostname === "localhost" || u.hostname.endsWith(".localhost");
    const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname);
    const isApex = hostParts.length === 2 || (u.hostname.endsWith(".com.tr") && hostParts.length === 3);
    
    if (!isLocalhost && !isIp && isApex && !u.hostname.startsWith("www.")) {
      u.hostname = `www.${u.hostname}`;
    }

    // build-time'ta güvenli olması için https'e zorla (localhost/IP hariç)
    if (!isLocalhost && !isIp) u.protocol = "https:";

    // trailing slash kaldır
    return u.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
})();

const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${canonicalBase}/#organization`,
      name: "Cinselhobi",
      url: canonicalBase,
    },
    {
      "@type": "WebSite",
      "@id": `${canonicalBase}/#website`,
      url: canonicalBase,
      name: "Cinselhobi",
      publisher: { "@id": `${canonicalBase}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${canonicalBase}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(canonicalBase),
  alternates: { canonical: "./" },
  title: {
    default: "Cinselhobi",
    template: "%s | Cinselhobi",
  },
  description: "Türkiye'deki en gizli ve plus deneyimlerin platformu.",
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: canonicalBase,
    title: "Cinselhobi",
    description: "Türkiye'deki en gizli ve plus deneyimlerin platformu.",
    images: [
      {
        url: "/og/cinselhobi-share-2026-02-13.jpg",
        width: 1200,
        height: 630,
        alt: "Cinselhobi",
      },
    ],
    ...(process.env.NEXT_PUBLIC_FB_APP_ID && {
      siteName: "Cinselhobi",
      locale: "tr_TR",
    }),
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/cinselhobi-share-2026-02-13.jpg"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  interactiveWidget: "resizes-content" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: Next.js'in tema uyumsuzluğu uyarısını engeller
    <html lang="tr" suppressHydrationWarning className={cn(geistSans.variable, geistMono.variable, "overflow-x-clip")}>
      <body className={cn("font-sans antialiased overflow-hidden xl:overflow-auto overflow-x-clip")}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData) }}
        />
        {/* attribute="class": Tailwind kullandığımız için .dark class'ını html'e ekler
            defaultTheme="system": Kullanıcının cihaz ayarını otomatik algılar
            enableSystem: Sistem değişikliğini dinler
            disableTransitionOnChange: Tema değişirken anlık CSS transitionlarını kapatır (Göz yormayı engeller)
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <FavoritesProvider>
              <CartProvider>
                <HeaderProvider>
                  <SearchProvider>
                    <AppRouteChrome>{children}</AppRouteChrome>
                    <Toaster position="top-center" richColors />
                  </SearchProvider>
                </HeaderProvider>
              </CartProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && (
          <>
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
            <Suspense fallback={null}>
              <GA4PageViews gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
            </Suspense>
          </>
        )}
      </body>
    </html>
  );
}
