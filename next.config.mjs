import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
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

  webpack(config, { dev, isServer }) {
if (dev) {
  config.module.rules.push({
    test: /\.(jsx|tsx)$/,
    exclude: [/node_modules/],
    use: [{
      loader: '@dhiwise/component-tagger/nextLoader',
    }],
  });
}

    // Alias pdfjs-dist to its legacy webpack-compatible build
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf.js',
    };

    return config;
  }
};
export default nextConfig;