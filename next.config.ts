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
};

export default nextConfig;
