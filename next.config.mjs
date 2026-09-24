import { imageHosts } from './image-hosts.config.mjs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Webpack plugin that runs the hydration scanner once per build (server compilation). */
class HydrationScannerPlugin {
  apply(compiler) {
    compiler.hooks.beforeRun.tapAsync('HydrationScannerPlugin', (compiler, callback) => {
      try {
        execFileSync(
          process.execPath,
          [path.join(__dirname, 'scripts', 'check-hydration.js'), '--json'],
          { stdio: 'inherit', cwd: __dirname }
        );
        callback();
      } catch {
        // check-hydration exits with code 1 when errors are found
        callback(new Error(
          '\n\n🚫 Hydration Scanner: SSR mismatch triggers detected.\n' +
          '   Run `npm run check-hydration` for the full report.\n' +
          '   Fix all ✖ errors before deploying.\n'
        ));
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