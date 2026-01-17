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
        hostname: "cinselhobi.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
