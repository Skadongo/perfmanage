import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  distDir: process.env.DIST_DIR || '.next',

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: ['@heroicons/react', 'recharts'],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error'] }
      : false,
    suppressHydrationWarning: true,
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/performance-dashboard',
        permanent: false,
      },
    ];
  },

  webpack(
    config,
    {
      dev: dev,
      isServer
    }
  ) {
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [{
          loader: '@dhiwise/component-tagger/nextLoader',
        }],
      });
    }

    return config;
  }
};
export default nextConfig;