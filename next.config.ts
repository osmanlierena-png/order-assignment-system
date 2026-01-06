import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-side external packages
  serverExternalPackages: ['pdf-parse', 'tesseract.js'],
  // Turbopack config (Next.js 16+)
  turbopack: {},
  // Webpack config (for non-turbopack builds)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
