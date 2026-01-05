import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Resim optimizasyonu ve güvenlik izinleri
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Unsplash resimlerine izin ver
      },
      {
        protocol: 'https',
        hostname: 'placehold.co', // Gerekirse placeholder servislerine izin ver
      },
      {
        protocol: 'https',
        hostname: 'www.cinselhobi.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'cinselhobi.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;