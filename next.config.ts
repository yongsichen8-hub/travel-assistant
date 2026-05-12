import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/travel',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's1-imfile.feishucdn.com',
      },
      {
        protocol: 'https',
        hostname: 's3-imfile.feishucdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.feishucdn.com',
      },
    ],
  },
};

export default nextConfig;
