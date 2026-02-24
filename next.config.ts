import type { NextConfig } from "next";

process.env.TZ = "Europe/Istanbul";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "www.cinselhobi.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "www.cinselhobi.com",
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: "cinselhobi.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "cinselhobi.com",
        pathname: "/products/**",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async redirects() {
    return [
      // Legacy WordPress sitemap endpoint'leri soft-404 yerine /sitemap.xml'e 301 yönlendir
      {
        source: "/wp-sitemap.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
      },
      {
        source: "/sitemap:page(\\d+)\\.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
      },
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
      },
      {
        source: "/product-sitemap:page(\\d+)\\.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
      },
      {
        source: "/product_cat-sitemap.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
      },
      // Kategori slug bağlaç temizliği redirect'leri (SEO için 301)
      {
        source: "/fetis-ve-fantezi",
        destination: "/fetis-fantezi",
        permanent: true, // 301 redirect
      },
      {
        source: "/halka-ve-kiliflar",
        destination: "/halka-kiliflar",
        permanent: true, // 301 redirect
      },
      // Ürün slug düzeltme redirect'leri (SEO için 308)
      {
        source: "/urun/beyaz-danteli-fantazi-ic-camasir",
        destination: "/urun/beyaz-dantel-fantazi-ic-camasir",
        permanent: true, // 308 redirect
      },
      {
        source: "/urun/melez-jaseii-full-realistik-sex-doll",
        destination: "/urun/melez-jasiel-full-realistik-sex-doll",
        permanent: true, // 308 redirect
      },
      {
        source: "/urun/okey-ritm-prezervatif-10-lu",
        destination: "/urun/okey-ritim-prezervatif-10lu",
        permanent: true, // 308 redirect
      },
      // Typo ürün canonical redirect (402 → 143)
      {
        source: "/urun/pozizyon-zari-siyah",
        destination: "/urun/pozisyon-zari-siyah",
        permanent: true, // 308
      },
    ];
  },
};

export default nextConfig;
