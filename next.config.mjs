import { imageHosts } from './image-hosts.config.mjs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Webpack plugin that runs the hydration scanner once per build (server compilation). */
class HydrationScannerPlugin {
  apply(compiler) {
    compiler.hooks.beforeRun.tapAsync('HydrationScannerPlugin', (compiler, callback) => {
      try {
        const result = spawnSync(
          process.execPath,
          ['--input-type=commonjs', path.join(__dirname, 'scripts', 'check-hydration.js'), '--json'],
          { stdio: 'inherit', cwd: __dirname, encoding: 'utf8' }
        );
        if (result.status !== 0) {
          callback(new Error(
            '\n\n🚫 Hydration Scanner: SSR mismatch triggers detected.\n' +
            '   Run `npm run check-hydration` for the full report.\n' +
            '   Fix all ✖ errors before deploying.\n'
          ));
        } else {
          callback();
        }
      } catch {
        // Scanner unavailable — don't block the build
        callback();
      }
    });
  }
}

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
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      isServer,
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

    // Run hydration scanner once per production build (server compilation only)
    if (!dev && isServer) {
      config.plugins.push(new HydrationScannerPlugin());
    }

    return config;
  }
};
export default nextConfig;