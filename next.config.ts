import type { NextConfig } from "next";

const isTossBundle = process.env.TOSS_BUNDLE === 'true';

const nextConfig: NextConfig = {
  ...(isTossBundle ? { output: 'export' } : {}),
  images: {
    unoptimized: isTossBundle,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
