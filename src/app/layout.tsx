import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Yeni güncellediğimiz provider
import { ThemeProvider } from "@/components/theme/theme-provider";
import { HeaderContent } from "@/components/layout/header";
import { HeaderProvider } from "@/components/layout/header-context";
import { DesktopHeader } from "@/components/layout/DesktopHeader";
import Footer from "@/components/app/Footer";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { PageTransition } from "@/components/app/page-transition";
import { CartProvider } from "@/components/cart/cart-provider";
import { SearchProvider } from "@/components/search/search-provider";
import { SearchOverlay } from "@/components/search/search-overlay";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FavoritesProvider } from "@/components/favorites/favorites-provider";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.cinselhobi.com"
  ),
  title: {
    default: "Cinselhobi",
    template: "%s | Cinselhobi",
  },
  description: "Türkiye'deki en gizli ve plus deneyimlerin platformu.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "icon", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { rel: "icon", url: "/favicon-16x16.webp", sizes: "16x16", type: "image/webp" },
      { rel: "icon", url: "/favicon-32x32.webp", sizes: "32x32", type: "image/webp" },
      { rel: "icon", url: "/apple-touch-icon.webp", sizes: "180x180", type: "image/webp" },
      { rel: "icon", url: "/android-chrome-192x192.webp", sizes: "192x192", type: "image/webp" },
      { rel: "icon", url: "/android-chrome-512x512.webp", sizes: "512x512", type: "image/webp" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    images: ["/og.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
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
                    <div className="min-h-dvh bg-background text-foreground">
                      <Suspense fallback={<header className="fixed top-0 left-0 right-0 z-50 h-14 xl:h-16 border-b border-border bg-background" />}>
                        <HeaderContent />
                      </Suspense>
                      <DesktopHeader />
                      <SearchOverlay />
                      <main className="flex-1 overflow-hidden xl:overflow-visible">
                        <PageTransition>{children}</PageTransition>
                      </main>
                      <div className="hidden xl:block">
                        <Footer />
                      </div>
                      <MobileBottomNav />
                    </div>
                    <Toaster position="top-center" richColors />
                  </SearchProvider>
                </HeaderProvider>
              </CartProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
