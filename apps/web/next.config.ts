import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    'playwright',
    'playwright-core',
    'chromium-bidi',
    'bullmq',
    'ioredis',
    '@pagepulse/browser',
    '@pagepulse/worker',
  ],
  transpilePackages: [
    '@pagepulse/config',
    '@pagepulse/core',
    '@pagepulse/db',
    '@pagepulse/notifications',
  ],
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    if (isServer) {
      // Prevent webpack from trying to bundle Playwright internals
      config.externals = config.externals || [];
      const externalsArray = Array.isArray(config.externals) ? config.externals : [config.externals];
      externalsArray.push(
        'playwright',
        'playwright-core',
        'chromium-bidi',
        /^chromium-bidi\//,
        /^playwright-core\//,
      );
      config.externals = externalsArray;
    }
    return config;
  },
};

export default nextConfig;
